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
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'

export const scorecardsRoutes = new Hono<{ Bindings: Env }>()

// GET / — list scorecards
scorecardsRoutes.get('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const tableCheck = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'scorecards'
      ) as exists`
    )

    if (!tableCheck.rows[0].exists) {
      return c.json({ success: true, scorecards: [] })
    }

    const result = await db.query(
      `SELECT * FROM scorecards
      WHERE organization_id = $1
      ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, scorecards: result.rows })
  } catch (err: any) {
    logger.error('GET /api/scorecards error', { error: err?.message })
    return c.json({ error: 'Failed to get scorecards' }, 500)
  } finally {
    await db.end()
  }
})

// POST / — create scorecard
scorecardsRoutes.post('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, CreateScorecardSchema)
    if (!parsed.success) return parsed.response
    const { call_id, template_id, scores, notes, overall_score } = parsed.data

    // Ensure table exists
    await db.query(
      `CREATE TABLE IF NOT EXISTS scorecards (
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
      )`
    )

    const result = await db.query(
      `INSERT INTO scorecards (organization_id, call_id, template_id, scores, notes, overall_score, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        session.organization_id,
        call_id || null,
        template_id || null,
        JSON.stringify(scores || {}),
        notes || '',
        overall_score || null,
        session.user_id,
      ]
    )

    return c.json({ success: true, scorecard: result.rows[0], scorecardId: result.rows[0].id }, 201)
  } catch (err: any) {
    logger.error('POST /api/scorecards error', { error: err?.message })
    return c.json({ error: 'Failed to create scorecard' }, 500)
  } finally {
    await db.end()
  }
})

// GET /alerts — scorecard alerts/notifications
scorecardsRoutes.get('/alerts', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    // Check if alerts table exists
    const tableCheck = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'scorecard_alerts'
      ) as exists`
    )

    if (!tableCheck.rows[0].exists) {
      return c.json({ success: true, alerts: [] })
    }

    const alertsResult = await db.query(
      `SELECT * FROM scorecard_alerts
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
      [session.organization_id]
    )

    return c.json({ success: true, alerts: alertsResult.rows })
  } catch (err: any) {
    logger.error('GET /api/scorecards/alerts error', { error: err?.message })
    return c.json({ alerts: [] })
  } finally {
    await db.end()
  }
})

// GET /:id — single scorecard
scorecardsRoutes.get('/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const scorecardId = c.req.param('id')

    const result = await db.query(
      `SELECT * FROM scorecards
      WHERE id = $1 AND organization_id = $2`,
      [scorecardId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Scorecard not found' }, 404)
    }

    return c.json({ success: true, scorecard: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/scorecards/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get scorecard' }, 500)
  } finally {
    await db.end()
  }
})
