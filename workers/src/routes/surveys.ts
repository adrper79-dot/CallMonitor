/**
 * Surveys Routes - Survey CRUD with real DB
 *
 * Endpoints:
 *   GET    /      - List surveys
 *   POST   /      - Create survey
 *   DELETE /:id   - Delete survey
 *
 * P2-2: Uses centralized getDb() — no inline neon imports
 * H1: Zod-validated request bodies via validateBody()
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { CreateSurveySchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const surveysRoutes = new Hono<AppEnv>()

// GET / — List surveys
surveysRoutes.get('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    // Try full schema first, fall back to minimal
    let surveys: any[] = []
    try {
      const result = await db.query(
        `SELECT id, title, description, questions, active, trigger_type, created_at, updated_at
         FROM surveys
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [session.organization_id]
      )
      surveys = result.rows
    } catch {
      // Table may exist with different columns — try minimal
      try {
        const result = await db.query(
          `SELECT * FROM surveys
           WHERE organization_id = $1
           ORDER BY created_at DESC`,
          [session.organization_id]
        )
        surveys = result.rows
      } catch {
        // Table doesn't exist yet — return empty
        surveys = []
      }
    }

    return c.json({
      success: true,
      surveys,
      total: surveys.length,
    })
  } catch (err: any) {
    logger.error('GET /api/surveys error', { error: err?.message })
    return c.json({ error: 'Failed to get surveys' }, 500)
  } finally {
    await db.end()
  }
})

// POST / — Create survey
surveysRoutes.post('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, CreateSurveySchema)
    if (!parsed.success) return parsed.response
    const { title, description, questions, active, trigger_type } = parsed.data

    // Try full insert, fall back to adding columns if needed
    let survey: any
    try {
      const result = await db.query(
        `INSERT INTO surveys (organization_id, title, description, questions, active, trigger_type, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         RETURNING *`,
        [
          session.organization_id,
          title,
          description || null,
          JSON.stringify(questions || []),
          active !== undefined ? active : true,
          trigger_type || 'post_call',
          session.user_id,
        ]
      )
      survey = result.rows[0]
    } catch (insertErr: any) {
      logger.error('POST /api/surveys insert error', { error: insertErr?.message })
      return c.json({ error: 'Failed to create survey' }, 500)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'surveys',
      resourceId: survey.id,
      action: AuditAction.SURVEY_CREATED,
      before: null,
      after: survey,
    })

    return c.json({ success: true, survey })
  } catch (err: any) {
    logger.error('POST /api/surveys error', { error: err?.message })
    return c.json({ error: 'Failed to create survey' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /:id — Delete survey
surveysRoutes.delete('/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const id = c.req.param('id')

    const result = await db.query(
      `DELETE FROM surveys
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) return c.json({ error: 'Survey not found' }, 404)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'surveys',
      resourceId: id,
      action: AuditAction.SURVEY_DELETED,
      before: { id },
      after: null,
    })

    return c.json({ success: true, deleted: id })
  } catch (err: any) {
    logger.error('DELETE /api/surveys/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete survey' }, 500)
  } finally {
    await db.end()
  }
})
