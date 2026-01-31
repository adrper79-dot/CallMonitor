/**
 * Stripe Service Layer
 * 
 * Purpose: Centralized Stripe integration for subscription management
 * Architecture: Call-routed design with audit logging and error handling
 * 
 * Features:
 * - Customer creation and management
 * - Subscription lifecycle (create, update, cancel)
 * - Payment method management
 * - Checkout session creation
 * - Billing portal access
 * - Usage-based billing integration
 */

import Stripe from 'stripe'
import { query } from '@/lib/pgClient'
import { AppError } from '@/types/app-error'
import { logger } from '@/lib/logger'
import { writeAuditLegacy as writeAudit, writeAuditErrorLegacy as writeAuditError } from '@/lib/audit/auditLogger'

// Initialize Stripe lazily
let stripeInstance: Stripe | null = null

export function getStripe() {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2025-12-15.clover' as any, // Type cast for newer version
      typescript: true,
      httpClient: Stripe.createFetchHttpClient()
    })
  }
  return stripeInstance
}

// Export a proxy for backward compatibility if needed, or update usages
// Since we are updating the file, let's export the getter and update internal usages
// But exporting 'stripe' as a const that is a Proxy is safer for existing external imports
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    const client = getStripe()
    return Reflect.get(client, prop)
  }
})

// Price IDs from Stripe Dashboard (set these as env vars)
export const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_month',
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_year',
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || 'price_business_month',
  business_yearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || 'price_business_year',
  enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_month',
  enterprise_yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || 'price_enterprise_year',
}

interface CreateCheckoutSessionParams {
  organizationId: string
  organizationName: string
  userEmail: string
  priceId: string
  successUrl: string
  cancelUrl: string
}

interface CreateCustomerParams {
  organizationId: string
  organizationName: string
  email: string
}

/**
 * Create or retrieve Stripe customer for organization
 */
export async function getOrCreateCustomer(params: CreateCustomerParams): Promise<string> {
  const { organizationId, organizationName, email } = params

  try {
    // Check if customer already exists in our database
    const { rows } = await query(
      `SELECT stripe_customer_id FROM stripe_subscriptions 
       WHERE organization_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId],
      { organizationId }
    )
    const existingSub = rows[0]

    if (existingSub?.stripe_customer_id) {
      logger.info('getOrCreateCustomer: existing customer found', { organizationId, customerId: existingSub.stripe_customer_id })
      return existingSub.stripe_customer_id
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: organizationName,
      metadata: {
        organization_id: organizationId,
      },
    })

    logger.info('getOrCreateCustomer: new customer created', { organizationId, customerId: customer.id })
    await writeAudit('organizations', organizationId, 'stripe_customer_created', { customer_id: customer.id })

    return customer.id
  } catch (error: any) {
    logger.error('getOrCreateCustomer: failed', error, { organizationId })
    await writeAuditError('organizations', organizationId, { message: 'Failed to create Stripe customer', error: error.message })
    throw new AppError('Failed to create billing customer', 500, 'STRIPE_CUSTOMER_ERROR', error)
  }
}

/**
 * Create Stripe Checkout session for subscription
 */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<string> {
  const { organizationId, organizationName, userEmail, priceId, successUrl, cancelUrl } = params

  try {
    // Get or create customer
    const customerId = await getOrCreateCustomer({
      organizationId,
      organizationName,
      email: userEmail,
    })

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organization_id: organizationId,
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    })

    logger.info('createCheckoutSession: session created', { organizationId, sessionId: session.id })
    await writeAudit('organizations', organizationId, 'stripe_checkout_created', {
      session_id: session.id,
      price_id: priceId
    })

    return session.url!
  } catch (error: any) {
    logger.error('createCheckoutSession: failed', error, { organizationId, priceId })
    await writeAuditError('organizations', organizationId, { message: 'Failed to create checkout session', error: error.message })
    throw new AppError('Failed to create checkout session', 500, 'STRIPE_CHECKOUT_ERROR', error)
  }
}

/**
 * Create Stripe billing portal session
 */
export async function createBillingPortalSession(organizationId: string, returnUrl: string): Promise<string> {
  try {
    // Get customer ID from database
    const { rows } = await query(
      `SELECT stripe_customer_id FROM stripe_subscriptions 
       WHERE organization_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId],
      { organizationId }
    )
    const sub = rows[0]

    if (!sub?.stripe_customer_id) {
      throw new AppError('No active subscription found', 404, 'NO_SUBSCRIPTION')
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
    })

    logger.info('createBillingPortalSession: session created', { organizationId, sessionId: session.id })
    await writeAudit('organizations', organizationId, 'stripe_portal_accessed', { session_id: session.id })

    return session.url
  } catch (error: any) {
    logger.error('createBillingPortalSession: failed', error, { organizationId })
    await writeAuditError('organizations', organizationId, { message: 'Failed to create billing portal session', error: error.message })

    if (error instanceof AppError) throw error
    throw new AppError('Failed to access billing portal', 500, 'STRIPE_PORTAL_ERROR', error)
  }
}

/**
 * Get subscription details for organization
 */
export async function getSubscription(organizationId: string) {
  try {
    const { rows } = await query(
      `SELECT * FROM stripe_subscriptions 
       WHERE organization_id = $1 
       ORDER BY current_period_end DESC LIMIT 1`,
      [organizationId],
      { organizationId }
    )

    return rows[0] || null
  } catch (error: any) {
    logger.error('getSubscription: failed', error, { organizationId })
    throw new AppError('Failed to fetch subscription', 500, 'SUBSCRIPTION_FETCH_ERROR', error)
  }
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(organizationId: string): Promise<void> {
  try {
    // Get active subscription
    const { rows } = await query(
      `SELECT stripe_subscription_id FROM stripe_subscriptions 
       WHERE organization_id = $1 AND status IN ('active', 'trialing')
       ORDER BY current_period_end DESC LIMIT 1`,
      [organizationId],
      { organizationId }
    )
    const sub = rows[0]

    if (!sub) {
      throw new AppError('No active subscription found', 404, 'NO_ACTIVE_SUBSCRIPTION')
    }

    // Cancel at period end in Stripe
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    logger.info('cancelSubscription: subscription cancelled at period end', { organizationId, subscriptionId: sub.stripe_subscription_id })
    await writeAudit('organizations', organizationId, 'subscription_cancelled', {
      subscription_id: sub.stripe_subscription_id,
      cancel_at_period_end: true
    })
  } catch (error: any) {
    logger.error('cancelSubscription: failed', error, { organizationId })
    await writeAuditError('organizations', organizationId, { message: 'Failed to cancel subscription', error: error.message })

    if (error instanceof AppError) throw error
    throw new AppError('Failed to cancel subscription', 500, 'SUBSCRIPTION_CANCEL_ERROR', error)
  }
}

/**
 * Reactivate cancelled subscription
 */
export async function reactivateSubscription(organizationId: string): Promise<void> {
  try {
    // Get subscription scheduled for cancellation
    const { rows } = await query(
      `SELECT stripe_subscription_id FROM stripe_subscriptions 
       WHERE organization_id = $1 
       AND cancel_at_period_end = true
       AND status IN ('active', 'trialing')
       ORDER BY current_period_end DESC LIMIT 1`,
      [organizationId],
      { organizationId }
    )
    const sub = rows[0]

    if (!sub) {
      throw new AppError('No subscription scheduled for cancellation', 404, 'NO_PENDING_CANCELLATION')
    }

    // Remove cancellation in Stripe
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    })

    logger.info('reactivateSubscription: subscription reactivated', { organizationId, subscriptionId: sub.stripe_subscription_id })
    await writeAudit('organizations', organizationId, 'subscription_reactivated', {
      subscription_id: sub.stripe_subscription_id
    })
  } catch (error: any) {
    logger.error('reactivateSubscription: failed', error, { organizationId })
    await writeAuditError('organizations', organizationId, { message: 'Failed to reactivate subscription', error: error.message })

    if (error instanceof AppError) throw error
    throw new AppError('Failed to reactivate subscription', 500, 'SUBSCRIPTION_REACTIVATE_ERROR', error)
  }
}

/**
 * Update subscription plan
 */
export async function updateSubscription(organizationId: string, newPriceId: string): Promise<void> {
  try {
    // Get active subscription
    const { rows } = await query(
      `SELECT stripe_subscription_id FROM stripe_subscriptions 
       WHERE organization_id = $1 AND status IN ('active', 'trialing')
       ORDER BY current_period_end DESC LIMIT 1`,
      [organizationId],
      { organizationId }
    )
    const sub = rows[0]

    if (!sub) {
      throw new AppError('No active subscription found', 404, 'NO_ACTIVE_SUBSCRIPTION')
    }

    // Get subscription from Stripe to get the subscription item ID
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)

    if (!subscription.items.data[0]) {
      throw new AppError('Invalid subscription structure', 500, 'INVALID_SUBSCRIPTION')
    }

    // Update subscription
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations', // Charge/credit prorated amount
    })

    logger.info('updateSubscription: subscription updated', { organizationId, subscriptionId: sub.stripe_subscription_id, newPriceId })
    await writeAudit('organizations', organizationId, 'subscription_updated', {
      subscription_id: sub.stripe_subscription_id,
      new_price_id: newPriceId
    })
  } catch (error: any) {
    logger.error('updateSubscription: failed', error, { organizationId, newPriceId })
    await writeAuditError('organizations', organizationId, { message: 'Failed to update subscription', error: error.message })

    if (error instanceof AppError) throw error
    throw new AppError('Failed to update subscription', 500, 'SUBSCRIPTION_UPDATE_ERROR', error)
  }
}

/**
 * Get invoices for organization
 */
export async function getInvoices(organizationId: string, limit: number = 10) {
  try {
    const { rows } = await query(
      `SELECT * FROM stripe_invoices 
       WHERE organization_id = $1 
       ORDER BY invoice_date DESC LIMIT $2`,
      [organizationId, limit],
      { organizationId }
    )

    return rows || []
  } catch (error: any) {
    logger.error('getInvoices: failed', error, { organizationId })
    throw new AppError('Failed to fetch invoices', 500, 'INVOICES_FETCH_ERROR', error)
  }
}

/**
 * Get payment methods for organization
 */
export async function getPaymentMethods(organizationId: string) {
  try {
    const { rows } = await query(
      `SELECT * FROM stripe_payment_methods 
       WHERE organization_id = $1 
       ORDER BY is_default DESC`,
      [organizationId],
      { organizationId }
    )

    return rows || []
  } catch (error: any) {
    logger.error('getPaymentMethods: failed', error, { organizationId })
    throw new AppError('Failed to fetch payment methods', 500, 'PAYMENT_METHODS_FETCH_ERROR', error)
  }
}


