/**
 * AI Config Routes - Manage AI agent configuration
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const aiConfigRoutes = new Hono<{ Bindings: Env }>()

// Get AI configuration
aiConfigRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      success: true,
      config: {
        enabled: false,
        model: 'gpt-4',
        temperature: 0.7,
      },
    })
  } catch (err: any) {
    console.error('GET /api/ai-config error:', err)
    return c.json({ error: 'Failed to get AI config' }, 500)
  }
})

// Update AI configuration
aiConfigRoutes.put('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()

    return c.json({
      success: true,
      config: {
        ...body,
      },
    })
  } catch (err: any) {
    console.error('PUT /api/ai-config error:', err)
    return c.json({ error: 'Failed to update AI config' }, 500)
  }
})
