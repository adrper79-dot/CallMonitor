/**
 * Scorecards Routes - QA scorecard management
 * 
 * Endpoints:
 *   GET  /        - List scorecards for org
 *   POST /        - Create a scorecard
 *   GET  /alerts  - Scorecard alerts/notifications
 *   GET  /:id     - Get single scorecard
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateScorecardSchema } from '../lib/schemas'

export const scorecardsRoutes = new Hono<{ Bindings: Env }>()

/** Helper: get neon sql client */
async function getNeon(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

// GET / — list scorecards
scorecardsRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getNeon(c)

    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'scorecards'
      ) as exists
    `

    if (!tableCheck[0].exists) {
      return c.json({ success: true, scorecards: [] })
    }

    const result = await sql`
      SELECT * FROM scorecards
      WHERE organization_id = ${session.organization_id}
      ORDER BY created_at DESC
    `

    return c.json({ success: true, scorecards: result })
  } catch (err: any) {
    console.error('GET /api/scorecards error:', err?.message)
    return c.json({ error: 'Failed to get scorecards' }, 500)
  }
})

// POST / — create scorecard
scorecardsRoutes.post('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, CreateScorecardSchema)
    if (!parsed.success) return parsed.response
    const { call_id, template_id, scores, notes, overall_score } = parsed.data

    const sql = await getNeon(c)

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS scorecards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        call_id UUID,
        template_id TEXT,
        scores JSONB DEFAULT '{}',
        notes TEXT,
        overall_score NUMERIC(5,2),
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    const result = await sql`
      INSERT INTO scorecards (organization_id, call_id, template_id, scores, notes, overall_score, created_by)
      VALUES (
        ${session.organization_id},
        ${call_id || null},
        ${template_id || null},
        ${JSON.stringify(scores || {})},
        ${notes || ''},
        ${overall_score || null},
        ${session.user_id}
      )
      RETURNING *
    `

    return c.json({ success: true, scorecard: result[0], scorecardId: result[0].id }, 201)
  } catch (err: any) {
    console.error('POST /api/scorecards error:', err?.message)
    return c.json({ error: 'Failed to create scorecard' }, 500)
  }
})

// GET /alerts — scorecard alerts/notifications
scorecardsRoutes.get('/alerts', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getNeon(c)

    // Check if alerts table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'scorecard_alerts'
      ) as exists
    `

    if (!tableCheck[0].exists) {
      return c.json({ success: true, alerts: [] })
    }

    const alerts = await sql`
      SELECT * FROM scorecard_alerts
      WHERE organization_id = ${session.organization_id}
      ORDER BY created_at DESC
      LIMIT 20
    `

    return c.json({ success: true, alerts })
  } catch (err: any) {
    console.error('GET /api/scorecards/alerts error:', err?.message)
    return c.json({ alerts: [] })
  }
})

// GET /:id — single scorecard
scorecardsRoutes.get('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const scorecardId = c.req.param('id')
    const sql = await getNeon(c)

    const result = await sql`
      SELECT * FROM scorecards
      WHERE id = ${scorecardId} AND organization_id = ${session.organization_id}
    `

    if (result.length === 0) {
      return c.json({ error: 'Scorecard not found' }, 404)
    }

    return c.json({ success: true, scorecard: result[0] })
  } catch (err: any) {
    console.error('GET /api/scorecards/:id error:', err?.message)
    return c.json({ error: 'Failed to get scorecard' }, 500)
  }
})