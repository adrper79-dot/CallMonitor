import { neon } from '@neondatabase/serverless'
import Stripe from 'stripe'

export async function onRequestPost({ request, env }) {
  const sql = neon(env.NEON_CONNECTION_STRING)
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
    typescript: true
  })

  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let event

    try {
      event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      console.error('Stripe webhook signature verification failed', err)
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('Stripe webhook received', { type: event.type, id: event.id })

    // Idempotency Check
    const existingRes = await sql`SELECT id, processed FROM stripe_events WHERE stripe_event_id = ${event.id} LIMIT 1`
    if (existingRes.length > 0 && existingRes[0].processed) {
      console.log('Stripe webhook already processed', { eventId: event.id })
      return new Response(JSON.stringify({ received: true, status: 'already_processed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Upsert Event
    await sql`
      INSERT INTO stripe_events (stripe_event_id, event_type, data, processed)
      VALUES (${event.id}, ${event.type}, ${JSON.stringify(event.data)}, false)
      ON CONFLICT (stripe_event_id) DO UPDATE SET data = EXCLUDED.data
    `

    // Process
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, sql, stripe)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, sql, stripe)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, sql)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object, sql)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, sql)
        break
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object, sql, stripe)
        break
      default:
        console.log('Stripe webhook event not handled', { type: event.type })
    }

    // Mark Processed
    await sql`
      UPDATE stripe_events SET processed = true, processed_at = NOW() WHERE stripe_event_id = ${event.id}
    `

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Stripe webhook processing failed', error, { eventType: event?.type, eventId: event?.id })
    if (event?.id) {
      await sql`
        UPDATE stripe_events SET processed = false, error_message = ${error.message}, processed_at = NOW() WHERE stripe_event_id = ${event.id}
      `
    }
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleCheckoutCompleted(session, sql, stripe) {
  const organizationId = session.metadata?.organization_id
  if (!organizationId) return

  if (session.mode !== 'subscription' || !session.subscription) return

  const subscription = await stripe.subscriptions.retrieve(session.subscription)
  await handleSubscriptionUpdated(subscription, sql, stripe)
  await writeAudit(sql, 'organizations', organizationId, 'subscription_checkout_completed', {
    session_id: session.id, subscription_id: subscription.id
  })
}

async function handleSubscriptionUpdated(subscription, sql, stripe) {
  const organizationId = subscription.metadata?.organization_id
  if (!organizationId) return

  const priceId = subscription.items.data[0]?.price.id || ''
  const plan = extractPlanFromPriceId(priceId)

  const subscriptionData = {
    organization_id: organizationId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    amount_cents: subscription.items.data[0]?.price.unit_amount || 0,
    currency: subscription.currency,
    interval: subscription.items.data[0]?.price.recurring?.interval || 'month',
    trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  }

  // Upsert Subscription
  const cols = Object.keys(subscriptionData)
  const vals = Object.values(subscriptionData)
  const placeholders = vals.map((_, i) => `$${i + 1}`)
  const setClause = cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')

  await sql.unsafe(`
    INSERT INTO stripe_subscriptions (${cols.join(',')}) VALUES (${placeholders.join(',')})
    ON CONFLICT (stripe_subscription_id) DO UPDATE SET ${setClause}
  `, vals)

  await writeAudit(sql, 'organizations', organizationId, 'subscription_updated', {
    subscription_id: subscription.id, status: subscription.status, plan
  })
}

async function handleSubscriptionDeleted(subscription, sql) {
  const organizationId = subscription.metadata?.organization_id
  if (!organizationId) return

  await sql`UPDATE stripe_subscriptions SET status = 'canceled', canceled_at = NOW() WHERE stripe_subscription_id = ${subscription.id}`
  await writeAudit(sql, 'organizations', organizationId, 'subscription_deleted', { subscription_id: subscription.id })
}

async function handleInvoicePaid(invoice, sql) {
  const organizationId = invoice.subscription_details?.metadata?.organization_id || invoice.metadata?.organization_id
  if (!organizationId) return

  const invoiceData = {
    organization_id: organizationId,
    stripe_invoice_id: invoice.id,
    stripe_customer_id: invoice.customer,
    stripe_subscription_id: invoice.subscription || null,
    status: invoice.status || 'paid',
    amount_due_cents: invoice.amount_due,
    amount_paid_cents: invoice.amount_paid,
    currency: invoice.currency,
    invoice_date: new Date(invoice.created * 1000).toISOString(),
    due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
    paid_at: new Date().toISOString(),
    invoice_pdf_url: invoice.invoice_pdf || null,
    hosted_invoice_url: invoice.hosted_invoice_url || null,
  }

  const cols = Object.keys(invoiceData)
  const vals = Object.values(invoiceData)
  const placeholders = vals.map((_, i) => `$${i + 1}`)
  const setClause = cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')

  await sql.unsafe(`
    INSERT INTO stripe_invoices (${cols.join(',')}) VALUES (${placeholders.join(',')})
    ON CONFLICT (stripe_invoice_id) DO UPDATE SET ${setClause}
  `, vals)

  await writeAudit(sql, 'organizations', organizationId, 'invoice_paid', {
    invoice_id: invoice.id, amount_cents: invoice.amount_paid
  })
}

async function handleInvoicePaymentFailed(invoice, sql) {
  const organizationId = invoice.subscription_details?.metadata?.organization_id || invoice.metadata?.organization_id
  if (!organizationId) return

  const invoiceData = {
    organization_id: organizationId,
    stripe_invoice_id: invoice.id,
    stripe_customer_id: invoice.customer,
    stripe_subscription_id: invoice.subscription || null,
    status: 'uncollectible',
    amount_due_cents: invoice.amount_due,
    amount_paid_cents: invoice.amount_paid,
    currency: invoice.currency,
    invoice_date: new Date(invoice.created * 1000).toISOString(),
    due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
    paid_at: null,
    invoice_pdf_url: invoice.invoice_pdf || null,
    hosted_invoice_url: invoice.hosted_invoice_url || null,
  }

  const cols = Object.keys(invoiceData)
  const vals = Object.values(invoiceData)
  const placeholders = vals.map((_, i) => `$${i + 1}`)
  const setClause = cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')

  await sql.unsafe(`
    INSERT INTO stripe_invoices (${cols.join(',')}) VALUES (${placeholders.join(',')})
    ON CONFLICT (stripe_invoice_id) DO UPDATE SET ${setClause}
  `, vals)

  await writeAuditError(sql, 'organizations', organizationId, {
    message: 'Invoice payment failed', invoice_id: invoice.id, amount_due_cents: invoice.amount_due
  })
}

async function handlePaymentMethodAttached(paymentMethod, sql, stripe) {
  if (!paymentMethod.customer) return

  const customer = await stripe.customers.retrieve(paymentMethod.customer)
  const organizationId = customer.metadata?.organization_id
  if (!organizationId) return

  const paymentMethodData = {
    organization_id: organizationId,
    stripe_customer_id: paymentMethod.customer,
    stripe_payment_method_id: paymentMethod.id,
    type: paymentMethod.type,
    is_default: false,
  }

  if (paymentMethod.type === 'card' && paymentMethod.card) {
    paymentMethodData.card_brand = paymentMethod.card.brand
    paymentMethodData.card_last4 = paymentMethod.card.last4
    paymentMethodData.card_exp_month = paymentMethod.card.exp_month
    paymentMethodData.card_exp_year = paymentMethod.card.exp_year
  } else if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
    paymentMethodData.bank_name = paymentMethod.us_bank_account.bank_name
    paymentMethodData.bank_last4 = paymentMethod.us_bank_account.last4
  }

  const cols = Object.keys(paymentMethodData)
  const vals = Object.values(paymentMethodData)
  const placeholders = vals.map((_, i) => `$${i + 1}`)
  const setClause = cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')

  await sql.unsafe(`
    INSERT INTO stripe_payment_methods (${cols.join(',')}) VALUES (${placeholders.join(',')})
    ON CONFLICT (stripe_payment_method_id) DO UPDATE SET ${setClause}
  `, vals)

  await writeAudit(sql, 'organizations', organizationId, 'payment_method_added', { payment_method_id: paymentMethod.id })
}

function extractPlanFromPriceId(priceId) {
  if (priceId.includes('pro')) return 'pro'
  if (priceId.includes('business')) return 'business'
  if (priceId.includes('enterprise')) return 'enterprise'
  return 'free'
}

async function writeAudit(sql, table, resourceId, action, metadata) {
  const eventTypeMap = {
    organizations: 'USER_ACTION',
    subscriptions: 'SUBSCRIPTION_UPDATED',
    campaigns: 'CAMPAIGN_EXECUTED',
    reports: 'REPORT_GENERATED'
  }

  await sql`
    INSERT INTO audit_logs (event_type, resource_type, resource_id, action, status, metadata, created_at)
    VALUES (${eventTypeMap[table] || 'USER_ACTION'}, ${table}, ${resourceId}, ${action}, 'success', ${JSON.stringify(metadata)}, NOW())
  `
}

async function writeAuditError(sql, table, resourceId, errorData) {
  await sql`
    INSERT INTO audit_logs (event_type, resource_type, resource_id, action, status, metadata, created_at)
    VALUES ('USER_ACTION', ${table}, ${resourceId}, 'error', 'error', ${JSON.stringify(errorData)}, NOW())
  `
}