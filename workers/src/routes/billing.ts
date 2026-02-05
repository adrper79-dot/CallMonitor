/**
 * Billing Routes - Billing and subscription management
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const billingRoutes = new Hono<{ Bindings: Env }>()

// Get billing information
billingRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      success: true,
      billing: {
        plan: 'pro',
        status: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 99.00,
        currency: 'USD',
      },
    })
  } catch (err: any) {
    console.error('GET /api/billing error:', err)
    return c.json({ error: 'Failed to get billing info' }, 500)
  }
})

// Get payment methods
billingRoutes.get('/payment-methods', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      success: true,
      methods: [],
    })
  } catch (err: any) {
    console.error('GET /api/billing/payment-methods error:', err)
    return c.json({ error: 'Failed to get payment methods' }, 500)
  }
})

// Get invoices
billingRoutes.get('/invoices', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      success: true,
      invoices: [],
    })
  } catch (err: any) {
    console.error('GET /api/billing/invoices error:', err)
    return c.json({ error: 'Failed to get invoices' }, 500)
  }
})
