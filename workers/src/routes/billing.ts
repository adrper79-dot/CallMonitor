/**
 * Billing Routes - Billing and subscription management
 * 
 * Queries real subscription data from organizations table
 * (populated by Stripe webhook handlers in webhooks.ts)
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const billingRoutes = new Hono<{ Bindings: Env }>()

// Get billing information — queries real subscription data
billingRoutes.get('/', async (c) => {
  try {
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

    const result = await sql`
      SELECT 
        subscription_status,
        subscription_id,
        plan_id,
        stripe_customer_id
      FROM organizations
      WHERE id = ${session.organization_id}
    `

    const org = result?.[0]

    if (!org || !org.subscription_id) {
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

    // Map plan_id to human-readable name
    const planName = org.plan_id?.includes('pro') ? 'pro'
      : org.plan_id?.includes('enterprise') ? 'enterprise'
      : org.plan_id?.includes('starter') ? 'starter'
      : 'free'

    return c.json({
      success: true,
      billing: {
        plan: planName,
        status: org.subscription_status || 'inactive',
        subscriptionId: org.subscription_id,
        planId: org.plan_id,
        nextBillingDate: null, // Would need Stripe API call for exact date
        currency: 'USD',
      },
    })
  } catch (err: any) {
    console.error('GET /api/billing error')
    return c.json({ error: 'Failed to get billing info' }, 500)
  }
})

// Get payment methods — placeholder until Stripe API integration
billingRoutes.get('/payment-methods', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // To list real payment methods, we'd need to call Stripe API
    // with the org's stripe_customer_id. For now, return empty
    // but honestly indicate it requires Stripe API integration.
    return c.json({
      success: true,
      methods: [],
      note: 'Payment method management requires Stripe Customer Portal',
    })
  } catch (err: any) {
    console.error('GET /api/billing/payment-methods error')
    return c.json({ error: 'Failed to get payment methods' }, 500)
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
      LIMIT 20
    `

    return c.json({
      success: true,
      invoices: invoices || [],
    })
  } catch (err: any) {
    console.error('GET /api/billing/invoices error')
    return c.json({ error: 'Failed to get invoices' }, 500)
  }
})
