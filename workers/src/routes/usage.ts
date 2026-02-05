/**
 * Usage Routes - Track API usage and metrics
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const usageRoutes = new Hono<{ Bindings: Env }>()

// Get usage metrics
usageRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      success: true,
      usage: {
        calls: 0,
        minutes: 0,
        recordings: 0,
        apiRequests: 0,
      },
      limits: {
        callsPerMonth: 1000,
        minutesPerMonth: 5000,
      },
    })
  } catch (err: any) {
    console.error('GET /api/usage error:', err)
    return c.json({ error: 'Failed to get usage' }, 500)
  }
})
