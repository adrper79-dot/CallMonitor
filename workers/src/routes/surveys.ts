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
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { CreateSurveySchema } from '../lib/schemas'

export const surveysRoutes = new Hono<{ Bindings: Env }>()

async function ensureTable(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS surveys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      questions JSONB DEFAULT '[]'::jsonb,
      active BOOLEAN DEFAULT true,
      trigger_type TEXT DEFAULT 'post_call',
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// GET / — List surveys
surveysRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const db = getDb(c.env)

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
        // Table doesn't exist — create it
        await ensureTable(db)
        surveys = []
      }
    }

    return c.json({
      success: true,
      surveys,
      total: surveys.length,
    })
  } catch (err: any) {
    console.error('GET /api/surveys error:', err?.message)
    return c.json({ error: 'Failed to get surveys' }, 500)
  }
})

// POST / — Create survey
surveysRoutes.post('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const db = getDb(c.env)
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
    } catch {
      // Columns may not exist — try adding them
      try {
        await db.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS title TEXT`)
        await db.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS description TEXT`)
        await db.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb`)
        await db.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`)
        await db.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'post_call'`)
        await db.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS created_by UUID`)
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
      } catch (addErr: any) {
        console.error('POST /api/surveys column-add error:', addErr?.message)
        return c.json({ error: 'Failed to create survey' }, 500)
      }
    }

    return c.json({ success: true, survey })
  } catch (err: any) {
    console.error('POST /api/surveys error:', err?.message)
    return c.json({ error: 'Failed to create survey' }, 500)
  }
})

// DELETE /:id — Delete survey
surveysRoutes.delete('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const db = getDb(c.env)
    const id = c.req.param('id')

    const result = await db.query(
      `DELETE FROM surveys
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) return c.json({ error: 'Survey not found' }, 404)

    return c.json({ success: true, deleted: id })
  } catch (err: any) {
    console.error('DELETE /api/surveys/:id error:', err?.message)
    return c.json({ error: 'Failed to delete survey' }, 500)
  }
})
