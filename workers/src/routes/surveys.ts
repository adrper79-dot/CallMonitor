/**
 * Surveys Routes - Survey management
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const surveysRoutes = new Hono<{ Bindings: Env }>()

// Get surveys
surveysRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    return c.json({
      success: true,
      surveys: [],
      total: 0,
    })
  } catch (err: any) {
    console.error('GET /api/surveys error:', err)
    return c.json({ error: 'Failed to get surveys' }, 500)
  }
})

// Create survey
surveysRoutes.post('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()

    return c.json({
      success: true,
      survey: {
        id: 'survey-1',
        ...body,
      },
    })
  } catch (err: any) {
    console.error('POST /api/surveys error:', err)
    return c.json({ error: 'Failed to create survey' }, 500)
  }
})
