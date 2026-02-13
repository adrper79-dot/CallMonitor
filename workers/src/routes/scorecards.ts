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
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateScorecardSchema } from '../lib/schemas'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { scorecardsRateLimit } from '../lib/rate-limit'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const scorecardsRoutes = new Hono<AppEnv>()

// GET / — list scorecards
scorecardsRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
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
      `SELECT id, organization_id, name, description, structure,
              is_template, tool_id, created_by, created_at, updated_at
      FROM scorecards
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
scorecardsRoutes.post('/', scorecardsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, CreateScorecardSchema)
    if (!parsed.success) return parsed.response
    const { call_id, template_id, scores, notes, overall_score } = parsed.data

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

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'scorecards',
      resourceId: result.rows[0].id,
      action: AuditAction.SCORECARD_CREATED,
      newValue: result.rows[0],
    })

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
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
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
      `SELECT id, organization_id, scorecard_id, call_id, trigger_type,
              severity, message, acknowledged, acknowledged_by, created_at
      FROM scorecard_alerts
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
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const scorecardId = c.req.param('id')

    const result = await db.query(
      `SELECT id, organization_id, name, description, structure,
              is_template, tool_id, created_by, created_at, updated_at
      FROM scorecards
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

