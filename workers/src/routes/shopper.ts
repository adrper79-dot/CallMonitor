/**
 * Shopper Routes - Shopper script management
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const shopperRoutes = new Hono<{ Bindings: Env }>()

// Get shopper scripts
shopperRoutes.get('/scripts', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      success: true,
      scripts: [],
      total: 0,
    })
  } catch (err: any) {
    console.error('GET /api/shopper/scripts error:', err)
    return c.json({ error: 'Failed to get scripts' }, 500)
  }
})

// Create shopper script
shopperRoutes.post('/scripts', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()

    return c.json({
      success: true,
      script: {
        id: 'script-1',
        ...body,
      },
    })
  } catch (err: any) {
    console.error('POST /api/shopper/scripts error:', err)
    return c.json({ error: 'Failed to create script' }, 500)
  }
})
