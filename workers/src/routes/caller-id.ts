/**
 * Caller ID Routes - Manage caller ID settings
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const callerIdRoutes = new Hono<{ Bindings: Env }>()

// Get caller IDs
callerIdRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      success: true,
      callerIds: [],
    })
  } catch (err: any) {
    console.error('GET /api/caller-id error:', err)
    return c.json({ error: 'Failed to get caller IDs' }, 500)
  }
})

// Add caller ID
callerIdRoutes.post('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()

    return c.json({
      success: true,
      callerId: {
        id: 'caller-id-1',
        ...body,
      },
    })
  } catch (err: any) {
    console.error('POST /api/caller-id error:', err)
    return c.json({ error: 'Failed to add caller ID' }, 500)
  }
})
