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
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { CheckoutSchema, ChangePlanSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { idempotent } from '../lib/idempotency'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { billingRateLimit } from '../lib/rate-limit'

export const billingRoutes = new Hono<AppEnv>()

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
  const db = getDb(c.env, session.organization_id)
  try {
    // Safe query: only select columns guaranteed to exist (id, name)
    // 'plan' column may not exist — use COALESCE/fallback pattern
    let org: any = null
    try {
      const result = await db.query(
        'SELECT o.id, o.name, o.plan FROM organizations o WHERE o.id = $1',
        [session.organization_id]
      )
      org = result.rows?.[0]
    } catch {
      // 'plan' column might not exist — fall back to minimal query
      const result = await db.query('SELECT o.id, o.name FROM organizations o WHERE o.id = $1', [
        session.organization_id,
      ])
      org = result.rows?.[0]
    }

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
      const subResult = await db.query(
        'SELECT subscription_status, subscription_id, plan_id, stripe_customer_id, plan_started_at, plan_ends_at FROM organizations WHERE id = $1',
        [session.organization_id]
      )
      subscriptionData = subResult.rows?.[0]
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
    const planName = subscriptionData.plan_id?.includes('pro')
      ? 'pro'
      : subscriptionData.plan_id?.includes('enterprise')
        ? 'enterprise'
        : subscriptionData.plan_id?.includes('starter')
          ? 'starter'
          : org.plan || 'free'

    // Fetch subscription details from Stripe API if we have a subscription_id and API key
    // Cache in KV for 5 minutes to avoid rate limiting (BL-007 fix)
    let nextBillingDate = null
    let amount = 0
    let cancelAtPeriodEnd = false
    let currentPeriodEnd = null

    if (c.env.STRIPE_SECRET_KEY && subscriptionData.subscription_id) {
      const cacheKey = `stripe:sub:${subscriptionData.subscription_id}`

      // Try cache first
      let subscription: any = null
      try {
        const cached = await c.env.KV.get(cacheKey, 'json')
        if (cached) {
          subscription = cached
          logger.info('Stripe subscription fetched from cache', {
            subscription_id: subscriptionData.subscription_id,
          })
        }
      } catch (err) {
        logger.warn('KV cache read failed for Stripe subscription', { error: String(err) })
      }

      // Fetch from Stripe if not cached
      if (!subscription) {
        try {
          const stripeRes = await fetch(
            `https://api.stripe.com/v1/subscriptions/${subscriptionData.subscription_id}`,
            {
              headers: { Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}` },
            }
          )
          if (stripeRes.ok) {
            subscription = (await stripeRes.json()) as any
            // Cache for 5 minutes (300 seconds)
            c.env.KV.put(cacheKey, JSON.stringify(subscription), { expirationTtl: 300 }).catch(
              () => {
                logger.warn('Failed to cache Stripe subscription in KV')
              }
            )
          }
        } catch (err) {
          logger.warn('Failed to fetch Stripe subscription details', {
            subscription_id: subscriptionData.subscription_id,
          })
        }
      }

      if (subscription) {
        nextBillingDate = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null
        currentPeriodEnd = nextBillingDate
        amount = subscription.items?.data?.[0]?.price?.unit_amount || 0
        cancelAtPeriodEnd = subscription.cancel_at_period_end || false
      }
    }

    return c.json({
      success: true,
      billing: {
        plan: planName,
        status: subscriptionData.subscription_status || 'inactive',
        subscriptionId: subscriptionData.subscription_id,
        planId: subscriptionData.plan_id,
        stripeCustomerId: subscriptionData.stripe_customer_id,
        nextBillingDate: nextBillingDate,
        currentPeriodEnd: currentPeriodEnd,
        amount: amount,
        currency: 'USD',
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        planStartedAt: subscriptionData.plan_started_at,
        planEndsAt: subscriptionData.plan_ends_at,
      },
    })
  } finally {
    await db.end()
  }
}

// Get billing information — queries real subscription data
billingRoutes.get('/', async (c) => {
  try {
    return await getBillingInfo(c)
  } catch (err: any) {
    logger.error('GET /api/billing error', { error: err?.message })
    return c.json({ error: 'Failed to get billing info' }, 500)
  }
})

// Alias: GET /subscription — frontend calls this path
billingRoutes.get('/subscription', async (c) => {
  try {
    return await getBillingInfo(c)
  } catch (err: any) {
    logger.error('GET /api/billing/subscription error', { error: err?.message })
    return c.json({ error: 'Failed to get billing info' }, 500)
  }
})

// Get payment methods — queries Stripe API if customer exists
billingRoutes.get('/payment-methods', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!session.organization_id) {
    return c.json({ success: true, methods: [] })
  }

  // Look up stripe_customer_id for this org
  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [
      session.organization_id,
    ])
    const customerId = result.rows?.[0]?.stripe_customer_id

    if (!customerId) {
      return c.json({
        success: true,
        methods: [],
        note: 'No Stripe customer linked',
      })
    }

    // First try to get payment methods from mirror table
    let methods: any = null
    try {
      const mirrorResult = await db.query(
        `SELECT 
          stripe_payment_method_id as id,
          card_brand,
          card_last4,
          card_exp_month,
          card_exp_year,
          is_default
        FROM stripe_payment_methods
        WHERE organization_id = $1
        ORDER BY created_at DESC`,
        [session.organization_id]
      )
      methods = mirrorResult.rows.map((row: any) => ({
        id: row.id,
        card: {
          brand: row.card_brand,
          last4: row.card_last4,
          exp_month: row.card_exp_month,
          exp_year: row.card_exp_year,
        },
        is_default: row.is_default,
      }))
    } catch (err) {
      logger.warn('Failed to query stripe_payment_methods mirror table', { error: String(err) })
    }

    // If mirror table is empty or unavailable, fallback to Stripe API
    if (!methods || methods.length === 0) {
      if (!c.env.STRIPE_SECRET_KEY) {
        return c.json({
          success: true,
          methods: [],
          note: 'Stripe not configured',
        })
      }

      // Fetch payment methods from Stripe API
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/payment_methods?customer=${customerId}&type=card&limit=10`,
        {
          headers: { Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}` },
        }
      )

      if (!stripeRes.ok) {
        logger.error('Stripe payment methods fetch failed', { status: stripeRes.status })
        return c.json({ success: true, methods: [] })
      }

      const stripeData = (await stripeRes.json()) as any

      methods = (stripeData.data || []).map((pm: any) => ({
        id: pm.id,
        card: {
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          exp_month: pm.card?.exp_month,
          exp_year: pm.card?.exp_year,
        },
        is_default: false, // Would need to check default_payment_method on customer
      }))

      // Cache in mirror table for future requests
      for (const pm of methods) {
        try {
          await db.query(
            `INSERT INTO stripe_payment_methods (
              organization_id, stripe_customer_id, stripe_payment_method_id,
              type, is_default, card_brand, card_last4, card_exp_month, card_exp_year
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (stripe_payment_method_id) DO UPDATE SET
              is_default = EXCLUDED.is_default,
              card_brand = EXCLUDED.card_brand,
              card_last4 = EXCLUDED.card_last4,
              card_exp_month = EXCLUDED.card_exp_month,
              card_exp_year = EXCLUDED.card_exp_year,
              updated_at = NOW()`,
            [
              session.organization_id,
              customerId,
              pm.id,
              'card',
              pm.is_default,
              pm.card.brand,
              pm.card.last4,
              pm.card.exp_month,
              pm.card.exp_year,
            ]
          )
        } catch (cacheErr) {
          logger.warn('Failed to cache payment method in mirror table', { error: String(cacheErr) })
        }
      }
    }

    return c.json({ success: true, methods })
  } catch (err: any) {
    logger.error('GET /api/billing/payment-methods error', { error: err?.message })
    return c.json({ error: 'Failed to get payment methods' }, 500)
  } finally {
    await db.end()
  }
})

// Delete a payment method
billingRoutes.delete('/payment-methods/:id', billingRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const db = getDb(c.env, session.organization_id)
  try {

    const pmId = c.req.param('id')

    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'Stripe not configured' }, 503)
    }

    // Verify the payment method belongs to this org's Stripe customer
    const orgResult = await db.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [
      session.organization_id,
    ])
    const stripeCustomerId = orgResult.rows[0]?.stripe_customer_id
    if (stripeCustomerId) {
      const pmRes = await fetch(`https://api.stripe.com/v1/payment_methods/${pmId}`, {
        headers: { Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}` },
      })
      if (pmRes.ok) {
        const pmData = (await pmRes.json()) as any
        if (pmData.customer !== stripeCustomerId) {
          return c.json({ error: 'Payment method does not belong to this organization' }, 403)
        }
      }
    }

    // Detach the payment method via Stripe API
    const stripeRes = await fetch(`https://api.stripe.com/v1/payment_methods/${pmId}/detach`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}` },
    })

    if (!stripeRes.ok) {
      const errorText = await stripeRes.text()
      logger.error('Stripe detach payment method failed', { status: stripeRes.status })
      return c.json({ error: 'Failed to remove payment method' }, 500)
    }

    // Audit log: payment method removed
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'billing',
      resourceId: pmId,
      action: AuditAction.PAYMENT_METHOD_REMOVED,
      oldValue: null,
      newValue: { payment_method_id: pmId },
    })

    return c.json({ success: true, message: 'Payment method removed' })
  } catch (err: any) {
    logger.error('DELETE /api/billing/payment-methods error', { error: err?.message })
    return c.json({ error: 'Failed to remove payment method' }, 500)
  } finally {
    await db.end()
  }
})

// Get invoices — queries stripe_invoices mirror table with Stripe API fallback
billingRoutes.get('/invoices', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!session.organization_id) {
    return c.json({ success: true, invoices: [] })
  }

  const db = getDb(c.env, session.organization_id)
  try {
    const page = Math.max(1, parseInt(c.req.query('page') || '1'))
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    const offset = (page - 1) * limit

    // First try to get invoices from mirror table
    let invoices: any = null
    try {
      const result = await db.query(
        `SELECT 
          id,
          stripe_invoice_id as number,
          amount_paid_cents / 100.0 as amount_paid,
          currency,
          status,
          invoice_date as created,
          hosted_invoice_url,
          invoice_pdf_url as invoice_pdf
        FROM stripe_invoices
        WHERE organization_id = $1
        ORDER BY invoice_date DESC
        LIMIT $2
        OFFSET $3`,
        [session.organization_id, limit, offset]
      )
      invoices = result.rows
    } catch (err) {
      logger.warn('Failed to query stripe_invoices mirror table', { error: String(err) })
    }

    // If mirror table is empty or unavailable, fallback to Stripe API
    if (!invoices || invoices.length === 0) {
      if (!c.env.STRIPE_SECRET_KEY) {
        return c.json({ success: true, invoices: [] })
      }

      // Get customer ID
      const customerResult = await db.query(
        'SELECT stripe_customer_id FROM organizations WHERE id = $1',
        [session.organization_id]
      )
      const customerId = customerResult.rows?.[0]?.stripe_customer_id

      if (!customerId) {
        return c.json({ success: true, invoices: [] })
      }

      // Fetch from Stripe API
      const stripeRes = await fetch(
        `https://api.stripe.com/v1/invoices?customer=${customerId}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}` },
        }
      )

      if (stripeRes.ok) {
        const stripeData = (await stripeRes.json()) as any
        invoices = (stripeData.data || []).map((inv: any) => ({
          id: inv.id,
          number: inv.number,
          amount_paid: inv.amount_paid / 100,
          currency: inv.currency,
          status: inv.status,
          created: inv.created,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf: inv.invoice_pdf,
        }))

        // Cache in mirror table for future requests
        for (const inv of invoices) {
          try {
            await db.query(
              `INSERT INTO stripe_invoices (
                organization_id, stripe_invoice_id, stripe_customer_id,
                status, amount_due_cents, amount_paid_cents, currency,
                invoice_date, hosted_invoice_url, invoice_pdf_url
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (stripe_invoice_id) DO UPDATE SET
                status = EXCLUDED.status,
                amount_paid_cents = EXCLUDED.amount_paid_cents,
                hosted_invoice_url = EXCLUDED.hosted_invoice_url,
                invoice_pdf_url = EXCLUDED.invoice_pdf_url,
                updated_at = NOW()`,
              [
                session.organization_id,
                inv.id,
                customerId,
                inv.status,
                0, // amount_due_cents - not available in list
                Math.round(inv.amount_paid * 100),
                inv.currency,
                new Date(inv.created * 1000).toISOString(),
                inv.hosted_invoice_url,
                inv.invoice_pdf,
              ]
            )
          } catch (cacheErr) {
            logger.warn('Failed to cache invoice in mirror table', { error: String(cacheErr) })
          }
        }
      }
    }

    return c.json({
      success: true,
      invoices: invoices || [],
      page,
      limit,
    })
  } catch (err: any) {
    logger.error('GET /api/billing/invoices error', { error: err?.message })
    return c.json({ error: 'Failed to get invoices' }, 500)
  } finally {
    await db.end()
  }
})

// Create Stripe Checkout session for plan upgrade
billingRoutes.post('/checkout', billingRateLimit, idempotent(), async (c) => {
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
    const db = getDb(c.env, session.organization_id)
    try {
      const orgResult = await db.query(
        'SELECT stripe_customer_id FROM organizations WHERE id = $1',
        [session.organization_id]
      )
      let customerId = orgResult.rows?.[0]?.stripe_customer_id

      // If no Stripe customer yet, create one
      if (!customerId) {
        const userResult = await db.query('SELECT email FROM users WHERE id = $1', [
          session.user_id,
        ])
        const email = userResult.rows?.[0]?.email || ''

        const createRes = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
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

        const customer = (await createRes.json()) as any
        customerId = customer.id

        // Save the stripe_customer_id
        await db.query('UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2', [
          customerId,
          session.organization_id,
        ])
      }

      // Create Checkout Session
      const appUrl = c.env.NEXT_PUBLIC_APP_URL || 'https://wordis-bond.com'
      const checkoutRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer: customerId,
          mode: 'subscription',
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          success_url: `${appUrl}/settings?billing=success`,
          cancel_url: `${appUrl}/settings?billing=cancelled`,
          'metadata[organization_id]': session.organization_id,
          'metadata[plan_id]': planId || '',
        }),
      })

      if (!checkoutRes.ok) {
        const errorText = await checkoutRes.text()
        logger.error('Stripe checkout session creation failed', { status: checkoutRes.status })
        return c.json({ error: 'Failed to create checkout session' }, 500)
      }

      const checkoutData = (await checkoutRes.json()) as any

      return c.json({
        success: true,
        url: checkoutData.url,
        sessionId: checkoutData.id,
      })
    } finally {
      await db.end()
    }
  } catch (err: any) {
    logger.error('POST /api/billing/checkout error', { error: err?.message })
    return c.json({ error: 'Failed to create checkout session' }, 500)
  }
})

// Create Stripe Customer Portal session
billingRoutes.post('/portal', billingRateLimit, idempotent(), async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'Stripe not configured' }, 503)
    }

    // Look up Stripe customer
    const db = getDb(c.env, session.organization_id)
    try {
      const orgResult = await db.query(
        'SELECT stripe_customer_id FROM organizations WHERE id = $1',
        [session.organization_id]
      )
      const customerId = orgResult.rows?.[0]?.stripe_customer_id

      if (!customerId) {
        return c.json({ error: 'No Stripe customer found. Subscribe to a plan first.' }, 400)
      }

      const appUrl = c.env.NEXT_PUBLIC_APP_URL || 'https://wordis-bond.com'
      const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer: customerId,
          return_url: `${appUrl}/settings`,
        }),
      })

      if (!portalRes.ok) {
        const errorText = await portalRes.text()
        logger.error('Stripe portal session creation failed', { status: portalRes.status })
        return c.json({ error: 'Failed to create portal session' }, 500)
      }

      const portalData = (await portalRes.json()) as any

      return c.json({
        success: true,
        url: portalData.url,
      })
    } finally {
      await db.end()
    }
  } catch (err: any) {
    logger.error('POST /api/billing/portal error', { error: err?.message })
    return c.json({ error: 'Failed to create portal session' }, 500)
  }
})

// Cancel subscription
billingRoutes.post('/cancel', billingRateLimit, idempotent(), async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'Stripe not configured' }, 503)
    }

    // Look up subscription ID
    const db = getDb(c.env, session.organization_id)
    try {
      const orgResult = await db.query('SELECT subscription_id FROM organizations WHERE id = $1', [
        session.organization_id,
      ])
      const subscriptionId = orgResult.rows?.[0]?.subscription_id

      if (!subscriptionId) {
        return c.json({ error: 'No active subscription found' }, 400)
      }

      // Cancel at period end (graceful cancellation)
      const cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          cancel_at_period_end: 'true',
        }),
      })

      if (!cancelRes.ok) {
        const errorText = await cancelRes.text()
        logger.error('Stripe subscription cancel failed', { status: cancelRes.status })
        return c.json({ error: 'Failed to cancel subscription' }, 500)
      }

      // Capture old state for audit trail (BL-SEC-004)
      const oldStatusResult = await db.query(
        `SELECT subscription_status FROM organizations WHERE id = $1`,
        [session.organization_id]
      )
      const oldStatus = oldStatusResult.rows[0]?.subscription_status

      // Update local status
      await db.query(`UPDATE organizations SET subscription_status = 'cancelling' WHERE id = $1`, [
        session.organization_id,
      ])

      // Audit log: subscription cancelled
      writeAuditLog(db, {
        organizationId: session.organization_id,
        userId: session.user_id,
        resourceType: 'billing',
        resourceId: subscriptionId,
        action: AuditAction.SUBSCRIPTION_CANCELLED,
        oldValue: { subscription_status: oldStatus },
        newValue: {
          subscription_id: subscriptionId,
          subscription_status: 'cancelling',
          cancel_at_period_end: true,
        },
      })

      return c.json({
        success: true,
        message: 'Subscription will be cancelled at end of billing period',
      })
    } finally {
      await db.end()
    }
  } catch (err: any) {
    logger.error('POST /api/billing/cancel error', { error: err?.message })
    return c.json({ error: 'Failed to cancel subscription' }, 500)
  }
})

// Resume a cancelled subscription (undo cancel_at_period_end)
billingRoutes.post('/resume', billingRateLimit, idempotent(), async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe not configured' }, 503)
  }

  const db = getDb(c.env, session.organization_id)
  try {
    const orgResult = await db.query(
      'SELECT subscription_id, subscription_status FROM organizations WHERE id = $1',
      [session.organization_id]
    )
    const subscriptionId = orgResult.rows?.[0]?.subscription_id

    if (!subscriptionId) {
      return c.json({ error: 'No subscription found' }, 400)
    }

    // Resume: set cancel_at_period_end back to false
    const resumeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        cancel_at_period_end: 'false',
      }),
    })

    if (!resumeRes.ok) {
      logger.error('Stripe subscription resume failed', { status: resumeRes.status })
      return c.json({ error: 'Failed to resume subscription' }, 500)
    }

    await db.query(`UPDATE organizations SET subscription_status = 'active' WHERE id = $1`, [
      session.organization_id,
    ])

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'billing',
      resourceId: subscriptionId,
      action: AuditAction.SUBSCRIPTION_UPDATED,
      oldValue: { status: 'cancelling' },
      newValue: { status: 'active', cancel_at_period_end: false },
    })

    return c.json({ success: true, message: 'Subscription resumed' })
  } catch (err: any) {
    logger.error('POST /api/billing/resume error', { error: err?.message })
    return c.json({ error: 'Failed to resume subscription' }, 500)
  } finally {
    await db.end()
  }
})

// Change subscription plan (upgrade/downgrade)
billingRoutes.post('/change-plan', billingRateLimit, idempotent(), async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe not configured' }, 503)
  }

  const parsed = await validateBody(c, ChangePlanSchema)
  if (!parsed.success) return parsed.response
  const { priceId, planId } = parsed.data

  const db = getDb(c.env, session.organization_id)
  try {
    const orgResult = await db.query(
      'SELECT subscription_id, plan_id FROM organizations WHERE id = $1',
      [session.organization_id]
    )
    const subscriptionId = orgResult.rows?.[0]?.subscription_id
    const oldPlanId = orgResult.rows?.[0]?.plan_id

    if (!subscriptionId) {
      return c.json({ error: 'No active subscription. Use /checkout to subscribe first.' }, 400)
    }

    // Get current subscription items from Stripe
    const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}` },
    })

    if (!subRes.ok) {
      return c.json({ error: 'Failed to fetch current subscription' }, 500)
    }

    const subscription = (await subRes.json()) as any
    const itemId = subscription.items?.data?.[0]?.id

    if (!itemId) {
      return c.json({ error: 'No subscription item found' }, 500)
    }

    // Update the subscription item to the new price
    const updateRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        [`items[0][id]`]: itemId,
        [`items[0][price]`]: priceId,
        proration_behavior: 'create_prorations',
      }),
    })

    if (!updateRes.ok) {
      const errorText = await updateRes.text()
      logger.error('Stripe plan change failed', { status: updateRes.status })
      return c.json({ error: 'Failed to change plan' }, 500)
    }

    // Update local plan_id
    if (planId) {
      await db.query('UPDATE organizations SET plan_id = $1 WHERE id = $2', [
        planId,
        session.organization_id,
      ])
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'billing',
      resourceId: subscriptionId,
      action: AuditAction.SUBSCRIPTION_UPDATED,
      oldValue: { plan_id: oldPlanId },
      newValue: { plan_id: planId, price_id: priceId },
    })

    return c.json({ success: true, message: 'Plan changed successfully' })
  } catch (err: any) {
    logger.error('POST /api/billing/change-plan error', { error: err?.message })
    return c.json({ error: 'Failed to change plan' }, 500)
  } finally {
    await db.end()
  }
})

// Sync Stripe data into mirror tables (admin only)
billingRoutes.post('/sync-stripe-data', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Only allow owner/admin
  if (!session.role || !['owner', 'admin'].includes(session.role)) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  try {
    const { syncStripeData } = await import('../lib/stripe-sync')
    const result = await syncStripeData({
      organizationId: session.organization_id,
      force: true,
      limit: 50
    })

    writeAuditLog(await getDb(c.env, session.organization_id), {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.BILLING_DATA_SYNC,
      resourceType: 'billing',
      resourceId: 'stripe_sync',
      oldValue: null,
      newValue: { result },
    })

    return c.json(result)
  } catch (err: any) {
    logger.error('POST /api/billing/sync-stripe-data error', { error: err?.message })
    return c.json({ error: 'Failed to sync Stripe data' }, 500)
  }
})
