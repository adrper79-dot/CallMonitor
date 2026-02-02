/**
 * Stripe Webhook Handler
 * 
 * Purpose: Process Stripe webhook events for subscription lifecycle
 * Architecture: Event-driven with idempotency and audit logging
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/services/stripeService'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import {
  writeAuditLegacy,
  writeAuditErrorLegacy
} from '@/lib/audit/auditLogger'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

async function handleStripeWebhook(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed', err)
    return ApiErrors.badRequest('Invalid signature')
  }

  try {
    logger.info('Stripe webhook received', { type: event.type, id: event.id })

    // Idempotency Check
    const existingRes = await query(`SELECT id, processed FROM stripe_events WHERE stripe_event_id = $1 LIMIT 1`, [event.id])
    if (existingRes.rows.length > 0 && existingRes.rows[0].processed) {
      logger.info('Stripe webhook already processed', { eventId: event.id })
      return NextResponse.json({ received: true, status: 'already_processed' })
    }

    // Upsert Event
    await query(
      `INSERT INTO stripe_events (stripe_event_id, event_type, data, processed) 
       VALUES ($1, $2, $3, false)
       ON CONFLICT (stripe_event_id) DO UPDATE SET data = EXCLUDED.data`,
      [event.id, event.type, JSON.stringify(event.data)]
    )

    // Process
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod)
        break
      default:
        logger.info('Stripe webhook event not handled', { type: event.type })
    }

    // Mark Processed
    await query(
      `UPDATE stripe_events SET processed = true, processed_at = NOW() WHERE stripe_event_id = $1`,
      [event.id]
    )

    return NextResponse.json({ received: true })
  } catch (error: any) {
    logger.error('Stripe webhook processing failed', error, { eventType: event.type, eventId: event.id })
    await query(
      `UPDATE stripe_events SET processed = false, error_message = $1, processed_at = NOW() WHERE stripe_event_id = $2`,
      [error.message, event.id]
    )
    return ApiErrors.internal('Webhook processing failed')
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organization_id
  if (!organizationId) return

  if (session.mode !== 'subscription' || !session.subscription) return

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  await handleSubscriptionUpdated(subscription)
  await writeAuditLegacy('organizations', organizationId, 'subscription_checkout_completed', {
    session_id: session.id, subscription_id: subscription.id
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organization_id
  if (!organizationId) return

  const priceId = subscription.items.data[0]?.price.id || ''
  const plan = extractPlanFromPriceId(priceId)

  const subscriptionData = {
    organization_id: organizationId,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan,
    status: subscription.status,
    current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
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
  const params = vals.map((_, i) => `$${i + 1}`)
  const setClause = cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')

  await query(
    `INSERT INTO stripe_subscriptions (${cols.join(',')}) VALUES (${params.join(',')})
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET ${setClause}`,
    vals
  )

  await writeAuditLegacy('organizations', organizationId, 'subscription_updated', {
    subscription_id: subscription.id, status: subscription.status, plan
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organization_id
  if (!organizationId) return

  await query(
    `UPDATE stripe_subscriptions SET status = 'canceled', canceled_at = NOW() WHERE stripe_subscription_id = $1`,
    [subscription.id]
  )
  await writeAuditLegacy('organizations', organizationId, 'subscription_deleted', { subscription_id: subscription.id })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const organizationId = (invoice as any).subscription_details?.metadata?.organization_id || invoice.metadata?.organization_id
  if (!organizationId) return

  const invoiceData = {
    organization_id: organizationId,
    stripe_invoice_id: invoice.id,
    stripe_customer_id: invoice.customer as string,
    stripe_subscription_id: (invoice as any).subscription as string | null,
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
  const params = vals.map((_, i) => `$${i + 1}`)
  const setClause = cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')

  await query(
    `INSERT INTO stripe_invoices (${cols.join(',')}) VALUES (${params.join(',')})
     ON CONFLICT (stripe_invoice_id) DO UPDATE SET ${setClause}`,
    vals
  )

  await writeAuditLegacy('organizations', organizationId, 'invoice_paid', {
    invoice_id: invoice.id, amount_cents: invoice.amount_paid
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const organizationId = (invoice as any).subscription_details?.metadata?.organization_id || invoice.metadata?.organization_id
  if (!organizationId) return

  const invoiceData = {
    organization_id: organizationId,
    stripe_invoice_id: invoice.id,
    stripe_customer_id: invoice.customer as string,
    stripe_subscription_id: (invoice as any).subscription as string | null,
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
  const params = vals.map((_, i) => `$${i + 1}`)
  const setClause = cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')

  await query(
    `INSERT INTO stripe_invoices (${cols.join(',')}) VALUES (${params.join(',')})
     ON CONFLICT (stripe_invoice_id) DO UPDATE SET ${setClause}`,
    vals
  )

  await writeAuditErrorLegacy('organizations', organizationId, {
    message: 'Invoice payment failed', invoice_id: invoice.id, amount_due_cents: invoice.amount_due
  })
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  if (!paymentMethod.customer) return

  const customer = await stripe.customers.retrieve(paymentMethod.customer as string)
  const organizationId = (customer as Stripe.Customer).metadata?.organization_id
  if (!organizationId) return

  const paymentMethodData: any = {
    organization_id: organizationId,
    stripe_customer_id: paymentMethod.customer as string,
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
  const params = vals.map((_, i) => `$${i + 1}`)
  const setClause = cols.map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')

  await query(
    `INSERT INTO stripe_payment_methods (${cols.join(',')}) VALUES (${params.join(',')})
     ON CONFLICT (stripe_payment_method_id) DO UPDATE SET ${setClause}`,
    vals
  )

  await writeAuditLegacy('organizations', organizationId, 'payment_method_added', { payment_method_id: paymentMethod.id })
}

function extractPlanFromPriceId(priceId: string): string {
  if (priceId.includes('pro')) return 'pro'
  if (priceId.includes('business')) return 'business'
  if (priceId.includes('enterprise')) return 'enterprise'
  return 'free'
}

export const POST = withRateLimit(handleStripeWebhook, {
  identifier: (req) => `webhook-stripe-${getClientIP(req)}`,
  config: { maxAttempts: 1000, windowMs: 60 * 1000, blockMs: 5 * 60 * 1000 }
})
