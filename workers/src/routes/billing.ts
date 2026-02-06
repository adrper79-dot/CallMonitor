/**
 * Billing Routes - Billing and subscription management
 * 
 * Queries real subscription data from organizations table
 * (populated by Stripe webhook handlers in webhooks.ts)
 * 
 * Endpoints:
 *   GET  /              - Billing overview (subscription data)
 *   GET  /subscription  - Alias for GET / (frontend compatibility)
 *   GET  /payment-methods - List payment methods
 *   DELETE /payment-methods/:id - Remove a payment method
 *   GET  /invoices       - Invoice history
 *   POST /checkout       - Create Stripe Checkout session
 *   POST /portal         - Create Stripe Customer Portal session
 *   POST /cancel         - Cancel subscription
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CheckoutSchema } from '../lib/schemas'

export const billingRoutes = new Hono<{ Bindings: Env }>()

/** Shared handler: fetch subscription data from organizations table */
async function getBillingInfo(c: any) {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!session.organization_id) {
    return c.json({
      success: true,
      billing: {
        plan: 'free',
        status: 'no_organization',
        nextBillingDate: null,
        amount: 0,
        currency: 'USD',
      },
    })
  }

  // Query real subscription data from organizations table
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  const sql = neon(connectionString)

  // Use a safe column query — only select columns that exist
  const result = await sql`
    SELECT 
      o.id,
      o.name,
      o.plan
    FROM organizations o
    WHERE o.id = ${session.organization_id}
  `

  const org = result?.[0]

  if (!org) {
    return c.json({
      success: true,
      billing: {
        plan: 'free',
        status: 'no_subscription',
        nextBillingDate: null,
        amount: 0,
        currency: 'USD',
      },
    })
  }

  // Check if subscription columns exist and query them separately
  let subscriptionData: any = null
  try {
    const subResult = await sql`
      SELECT subscription_status, subscription_id, plan_id, stripe_customer_id
      FROM organizations
      WHERE id = ${session.organization_id}
    `
    subscriptionData = subResult?.[0]
  } catch {
    // subscription columns don't exist yet — that's OK
  }

  if (!subscriptionData?.subscription_id) {
    return c.json({
      success: true,
      billing: {
        plan: org.plan || 'free',
        status: 'no_subscription',
        nextBillingDate: null,
        amount: 0,
        currency: 'USD',
      },
    })
  }

  // Map plan_id to human-readable name
  const planName = subscriptionData.plan_id?.includes('pro') ? 'pro'
    : subscriptionData.plan_id?.includes('enterprise') ? 'enterprise'
    : subscriptionData.plan_id?.includes('starter') ? 'starter'
    : org.plan || 'free'

  return c.json({
    success: true,
    billing: {
      plan: planName,
      status: subscriptionData.subscription_status || 'inactive',
      subscriptionId: subscriptionData.subscription_id,
      planId: subscriptionData.plan_id,
      stripeCustomerId: subscriptionData.stripe_customer_id,
      nextBillingDate: null, // Would need Stripe API call for exact date
      currency: 'USD',
    },
  })
}

// Get billing information — queries real subscription data
billingRoutes.get('/', async (c) => {
  try {
    return await getBillingInfo(c)
  } catch (err: any) {
    console.error('GET /api/billing error:', err?.message)
    return c.json({ error: 'Failed to get billing info' }, 500)
  }
})

// Alias: GET /subscription — frontend calls this path
billingRoutes.get('/subscription', async (c) => {
  try {
    return await getBillingInfo(c)
  } catch (err: any) {
    console.error('GET /api/billing/subscription error:', err?.message)
    return c.json({ error: 'Failed to get billing info' }, 500)
  }
})

// Get payment methods — queries Stripe API if customer exists
billingRoutes.get('/payment-methods', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!session.organization_id) {
      return c.json({ success: true, methods: [] })
    }

    // Look up stripe_customer_id for this org
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      SELECT stripe_customer_id FROM organizations WHERE id = ${session.organization_id}
    `
    const customerId = result?.[0]?.stripe_customer_id

    if (!customerId || !c.env.STRIPE_SECRET_KEY) {
      return c.json({
        success: true,
        methods: [],
        note: 'No Stripe customer linked or Stripe not configured',
      })
    }

    // Fetch payment methods from Stripe API
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/payment_methods?customer=${customerId}&type=card&limit=10`,
      {
        headers: { 'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}` },
      }
    )

    if (!stripeRes.ok) {
      console.error('Stripe payment methods fetch failed:', stripeRes.status)
      return c.json({ success: true, methods: [] })
    }

    const stripeData = await stripeRes.json() as any

    const methods = (stripeData.data || []).map((pm: any) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
      is_default: false, // Would need to check default_payment_method on customer
    }))

    return c.json({ success: true, methods })
  } catch (err: any) {
    console.error('GET /api/billing/payment-methods error:', err?.message)
    return c.json({ error: 'Failed to get payment methods' }, 500)
  }
})

// Delete a payment method
billingRoutes.delete('/payment-methods/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const pmId = c.req.param('id')

    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'Stripe not configured' }, 503)
    }

    // Detach the payment method via Stripe API
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/payment_methods/${pmId}/detach`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}` },
      }
    )

    if (!stripeRes.ok) {
      const errorText = await stripeRes.text()
      console.error('Stripe detach payment method failed:', stripeRes.status)
      return c.json({ error: 'Failed to remove payment method' }, 500)
    }

    return c.json({ success: true, message: 'Payment method removed' })
  } catch (err: any) {
    console.error('DELETE /api/billing/payment-methods error:', err?.message)
    return c.json({ error: 'Failed to remove payment method' }, 500)
  }
})

// Get invoices — queries real billing_events from database
billingRoutes.get('/invoices', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!session.organization_id) {
      return c.json({ success: true, invoices: [] })
    }

    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const invoices = await sql`
      SELECT 
        id,
        event_type,
        amount,
        invoice_id,
        created_at
      FROM billing_events
      WHERE organization_id = ${session.organization_id}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    return c.json({
      success: true,
      invoices: invoices || [],
      page,
      limit,
    })
  } catch (err: any) {
    console.error('GET /api/billing/invoices error:', err?.message)
    return c.json({ error: 'Failed to get invoices' }, 500)
  }
})

// Create Stripe Checkout session for plan upgrade
billingRoutes.post('/checkout', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'Stripe not configured' }, 503)
    }

    const parsed = await validateBody(c, CheckoutSchema)
    if (!parsed.success) return parsed.response
    const { priceId, planId } = parsed.data

    // Look up or create Stripe customer
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const orgResult = await sql`
      SELECT stripe_customer_id FROM organizations WHERE id = ${session.organization_id}
    `
    let customerId = orgResult?.[0]?.stripe_customer_id

    // If no Stripe customer yet, create one
    if (!customerId) {
      const userResult = await sql`SELECT email FROM users WHERE id = ${session.user_id}`
      const email = userResult?.[0]?.email || ''

      const createRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email,
          'metadata[organization_id]': session.organization_id,
        }),
      })

      if (!createRes.ok) {
        return c.json({ error: 'Failed to create Stripe customer' }, 500)
      }

      const customer = await createRes.json() as any
      customerId = customer.id

      // Save the stripe_customer_id
      await sql`
        UPDATE organizations SET stripe_customer_id = ${customerId} WHERE id = ${session.organization_id}
      `
    }

    // Create Checkout Session
    const appUrl = c.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
    const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': customerId,
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': `${appUrl}/settings?billing=success`,
        'cancel_url': `${appUrl}/settings?billing=cancelled`,
        'metadata[organization_id]': session.organization_id,
        'metadata[plan_id]': planId || '',
      }),
    })

    if (!checkoutRes.ok) {
      const errorText = await checkoutRes.text()
      console.error('Stripe checkout session creation failed:', checkoutRes.status)
      return c.json({ error: 'Failed to create checkout session' }, 500)
    }

    const checkoutData = await checkoutRes.json() as any

    return c.json({
      success: true,
      url: checkoutData.url,
      sessionId: checkoutData.id,
    })
  } catch (err: any) {
    console.error('POST /api/billing/checkout error:', err?.message)
    return c.json({ error: 'Failed to create checkout session' }, 500)
  }
})

// Create Stripe Customer Portal session
billingRoutes.post('/portal', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'Stripe not configured' }, 503)
    }

    // Look up Stripe customer
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const orgResult = await sql`
      SELECT stripe_customer_id FROM organizations WHERE id = ${session.organization_id}
    `
    const customerId = orgResult?.[0]?.stripe_customer_id

    if (!customerId) {
      return c.json({ error: 'No Stripe customer found. Subscribe to a plan first.' }, 400)
    }

    const appUrl = c.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'customer': customerId,
        'return_url': `${appUrl}/settings`,
      }),
    })

    if (!portalRes.ok) {
      const errorText = await portalRes.text()
      console.error('Stripe portal session creation failed:', portalRes.status)
      return c.json({ error: 'Failed to create portal session' }, 500)
    }

    const portalData = await portalRes.json() as any

    return c.json({
      success: true,
      url: portalData.url,
    })
  } catch (err: any) {
    console.error('POST /api/billing/portal error:', err?.message)
    return c.json({ error: 'Failed to create portal session' }, 500)
  }
})

// Cancel subscription
billingRoutes.post('/cancel', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'Stripe not configured' }, 503)
    }

    // Look up subscription ID
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const orgResult = await sql`
      SELECT subscription_id FROM organizations WHERE id = ${session.organization_id}
    `
    const subscriptionId = orgResult?.[0]?.subscription_id

    if (!subscriptionId) {
      return c.json({ error: 'No active subscription found' }, 400)
    }

    // Cancel at period end (graceful cancellation)
    const cancelRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'cancel_at_period_end': 'true',
        }),
      }
    )

    if (!cancelRes.ok) {
      const errorText = await cancelRes.text()
      console.error('Stripe subscription cancel failed:', cancelRes.status)
      return c.json({ error: 'Failed to cancel subscription' }, 500)
    }

    // Update local status
    await sql`
      UPDATE organizations 
      SET subscription_status = 'cancelling' 
      WHERE id = ${session.organization_id}
    `

    return c.json({
      success: true,
      message: 'Subscription will be cancelled at end of billing period',
    })
  } catch (err: any) {
    console.error('POST /api/billing/cancel error:', err?.message)
    return c.json({ error: 'Failed to cancel subscription' }, 500)
  }
})
