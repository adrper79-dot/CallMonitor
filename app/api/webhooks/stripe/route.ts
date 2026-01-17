/**
 * Stripe Webhook Handler
 * 
 * Purpose: Process Stripe webhook events for subscription lifecycle
 * Architecture: Event-driven with idempotency and audit logging
 * 
 * Events handled:
 * - checkout.session.completed: New subscription created
 * - customer.subscription.updated: Subscription status changed
 * - customer.subscription.deleted: Subscription cancelled
 * - invoice.paid: Payment successful
 * - invoice.payment_failed: Payment failed
 * - payment_method.attached: New payment method added
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/services/stripeService'
import { supabaseAdmin } from '@/lib/supabase/supabaseAdmin'
import { logger } from '@/lib/logger'
import { writeAudit, writeAuditError } from '@/lib/audit/auditLogger'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    // Log event receipt
    logger.info('Stripe webhook received', { type: event.type, id: event.id })

    // Check if event already processed (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from('stripe_events')
      .select('id, processed')
      .eq('stripe_event_id', event.id)
      .single()

    if (existingEvent?.processed) {
      logger.info('Stripe webhook already processed', { eventId: event.id })
      return NextResponse.json({ received: true, status: 'already_processed' })
    }

    // Store event
    await supabaseAdmin.from('stripe_events').upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      data: event.data as any,
      processed: false,
    }, {
      onConflict: 'stripe_event_id'
    })

    // Process event based on type
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

    // Mark event as processed
    await supabaseAdmin
      .from('stripe_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id)

    return NextResponse.json({ received: true })
  } catch (error: any) {
    logger.error('Stripe webhook processing failed', error, { eventType: event.type, eventId: event.id })
    
    // Mark event as failed
    await supabaseAdmin
      .from('stripe_events')
      .update({ 
        processed: false, 
        error_message: error.message,
        processed_at: new Date().toISOString() 
      })
      .eq('stripe_event_id', event.id)

    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

/**
 * Handle checkout.session.completed
 * Creates subscription record when customer completes checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organization_id
  
  if (!organizationId) {
    logger.error('handleCheckoutCompleted: no organization_id in metadata', { sessionId: session.id })
    return
  }

  if (session.mode !== 'subscription' || !session.subscription) {
    logger.warn('handleCheckoutCompleted: session is not a subscription', { sessionId: session.id })
    return
  }

  // Fetch full subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  
  await handleSubscriptionUpdated(subscription)
  await writeAudit('organizations', organizationId, 'subscription_checkout_completed', { 
    session_id: session.id,
    subscription_id: subscription.id 
  })
}

/**
 * Handle customer.subscription.created/updated
 * Syncs subscription state to database
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organization_id
  
  if (!organizationId) {
    logger.error('handleSubscriptionUpdated: no organization_id in metadata', { subscriptionId: subscription.id })
    return
  }

  // Extract plan from price ID
  const priceId = subscription.items.data[0]?.price.id || ''
  const plan = extractPlanFromPriceId(priceId)

  // Prepare subscription data
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

  // Upsert subscription
  const { error } = await supabaseAdmin
    .from('stripe_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id'
    })

  if (error) {
    logger.error('handleSubscriptionUpdated: failed to upsert subscription', error, { subscriptionId: subscription.id })
    throw error
  }

  logger.info('handleSubscriptionUpdated: subscription synced', { 
    organizationId, 
    subscriptionId: subscription.id,
    status: subscription.status,
    plan 
  })

  await writeAudit('organizations', organizationId, 'subscription_updated', { 
    subscription_id: subscription.id,
    status: subscription.status,
    plan 
  })
}

/**
 * Handle customer.subscription.deleted
 * Marks subscription as cancelled
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organization_id
  
  if (!organizationId) {
    logger.error('handleSubscriptionDeleted: no organization_id in metadata', { subscriptionId: subscription.id })
    return
  }

  // Update subscription status
  const { error } = await supabaseAdmin
    .from('stripe_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    logger.error('handleSubscriptionDeleted: failed to update subscription', error, { subscriptionId: subscription.id })
    throw error
  }

  logger.info('handleSubscriptionDeleted: subscription cancelled', { organizationId, subscriptionId: subscription.id })
  await writeAudit('organizations', organizationId, 'subscription_deleted', { subscription_id: subscription.id })
}

/**
 * Handle invoice.paid
 * Records successful payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const organizationId = (invoice as any).subscription_details?.metadata?.organization_id || 
                         invoice.metadata?.organization_id
  
  if (!organizationId) {
    logger.warn('handleInvoicePaid: no organization_id in metadata', { invoiceId: invoice.id })
    return
  }

  // Store invoice record
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

  const { error } = await supabaseAdmin
    .from('stripe_invoices')
    .upsert(invoiceData, {
      onConflict: 'stripe_invoice_id'
    })

  if (error) {
    logger.error('handleInvoicePaid: failed to store invoice', error, { invoiceId: invoice.id })
    throw error
  }

  logger.info('handleInvoicePaid: invoice recorded', { organizationId, invoiceId: invoice.id })
  await writeAudit('organizations', organizationId, 'invoice_paid', { 
    invoice_id: invoice.id,
    amount_cents: invoice.amount_paid 
  })
}

/**
 * Handle invoice.payment_failed
 * Records failed payment and triggers alerts
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const organizationId = (invoice as any).subscription_details?.metadata?.organization_id || 
                         invoice.metadata?.organization_id
  
  if (!organizationId) {
    logger.warn('handleInvoicePaymentFailed: no organization_id in metadata', { invoiceId: invoice.id })
    return
  }

  // Store invoice record
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

  const { error } = await supabaseAdmin
    .from('stripe_invoices')
    .upsert(invoiceData, {
      onConflict: 'stripe_invoice_id'
    })

  if (error) {
    logger.error('handleInvoicePaymentFailed: failed to store invoice', error, { invoiceId: invoice.id })
    throw error
  }

  logger.error('handleInvoicePaymentFailed: payment failed', undefined, { organizationId, invoiceId: invoice.id })
  await writeAuditError('organizations', organizationId, { 
    message: 'Invoice payment failed',
    invoice_id: invoice.id,
    amount_due_cents: invoice.amount_due 
  })
}

/**
 * Handle payment_method.attached
 * Stores payment method details
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  if (!paymentMethod.customer) {
    logger.warn('handlePaymentMethodAttached: no customer', { paymentMethodId: paymentMethod.id })
    return
  }

  // Get organization ID from customer
  const customer = await stripe.customers.retrieve(paymentMethod.customer as string)
  const organizationId = (customer as Stripe.Customer).metadata?.organization_id
  
  if (!organizationId) {
    logger.warn('handlePaymentMethodAttached: no organization_id in customer metadata', { 
      customerId: paymentMethod.customer,
      paymentMethodId: paymentMethod.id 
    })
    return
  }

  // Prepare payment method data
  const paymentMethodData: any = {
    organization_id: organizationId,
    stripe_customer_id: paymentMethod.customer as string,
    stripe_payment_method_id: paymentMethod.id,
    type: paymentMethod.type,
    is_default: false, // Will be updated if this becomes the default
  }

  // Add type-specific details
  if (paymentMethod.type === 'card' && paymentMethod.card) {
    paymentMethodData.card_brand = paymentMethod.card.brand
    paymentMethodData.card_last4 = paymentMethod.card.last4
    paymentMethodData.card_exp_month = paymentMethod.card.exp_month
    paymentMethodData.card_exp_year = paymentMethod.card.exp_year
  } else if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
    paymentMethodData.bank_name = paymentMethod.us_bank_account.bank_name
    paymentMethodData.bank_last4 = paymentMethod.us_bank_account.last4
  }

  const { error } = await supabaseAdmin
    .from('stripe_payment_methods')
    .upsert(paymentMethodData, {
      onConflict: 'stripe_payment_method_id'
    })

  if (error) {
    logger.error('handlePaymentMethodAttached: failed to store payment method', error, { paymentMethodId: paymentMethod.id })
    throw error
  }

  logger.info('handlePaymentMethodAttached: payment method stored', { organizationId, paymentMethodId: paymentMethod.id })
  await writeAudit('organizations', organizationId, 'payment_method_added', { payment_method_id: paymentMethod.id })
}

/**
 * Extract plan name from Stripe price ID
 */
function extractPlanFromPriceId(priceId: string): string {
  if (priceId.includes('pro')) return 'pro'
  if (priceId.includes('business')) return 'business'
  if (priceId.includes('enterprise')) return 'enterprise'
  return 'free'
}
