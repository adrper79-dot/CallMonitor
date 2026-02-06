/**
 * Surveys Routes - Survey CRUD with real DB
 *
 * Endpoints:
 *   GET    /      - List surveys
 *   POST   /      - Create survey
 *   DELETE /:id   - Delete survey
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const surveysRoutes = new Hono<{ Bindings: Env }>()

async function getSQL(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

async function ensureTable(sql: any) {
  await sql`
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
  `
}

// GET / — List surveys
surveysRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)

    // Try full schema first, fall back to minimal
    let surveys: any[] = []
    try {
      surveys = await sql`
        SELECT id, title, description, questions, active, trigger_type, created_at, updated_at
        FROM surveys
        WHERE organization_id = ${session.organization_id}
        ORDER BY created_at DESC
      `
    } catch {
      // Table may exist with different columns — try minimal
      try {
        surveys = await sql`
          SELECT * FROM surveys
          WHERE organization_id = ${session.organization_id}
          ORDER BY created_at DESC
        `
      } catch {
        // Table doesn't exist — create it
        await ensureTable(sql)
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

    const sql = await getSQL(c)
    const body = await c.req.json()
    const { title, description, questions, active, trigger_type } = body

    if (!title) return c.json({ error: 'Title is required' }, 400)

    // Try full insert, fall back to adding columns if needed
    let survey: any
    try {
      ;[survey] = await sql`
        INSERT INTO surveys (organization_id, title, description, questions, active, trigger_type, created_by)
        VALUES (
          ${session.organization_id},
          ${title},
          ${description || null},
          ${JSON.stringify(questions || [])}::jsonb,
          ${active !== undefined ? active : true},
          ${trigger_type || 'post_call'},
          ${session.user_id}
        )
        RETURNING *
      `
    } catch {
      // Columns may not exist — try adding them
      try {
        await sql`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS title TEXT`
        await sql`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS description TEXT`
        await sql`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb`
        await sql`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`
        await sql`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'post_call'`
        await sql`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS created_by UUID`
        ;[survey] = await sql`
          INSERT INTO surveys (organization_id, title, description, questions, active, trigger_type, created_by)
          VALUES (${session.organization_id}, ${title}, ${description || null}, ${JSON.stringify(questions || [])}::jsonb, ${active !== undefined ? active : true}, ${trigger_type || 'post_call'}, ${session.user_id})
          RETURNING *
        `
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

    const sql = await getSQL(c)
    const id = c.req.param('id')

    const deleted = await sql`
      DELETE FROM surveys
      WHERE id = ${id} AND organization_id = ${session.organization_id}
      RETURNING id
    `

    if (deleted.length === 0) return c.json({ error: 'Survey not found' }, 404)

    return c.json({ success: true, deleted: id })
  } catch (err: any) {
    console.error('DELETE /api/surveys/:id error:', err?.message)
    return c.json({ error: 'Failed to delete survey' }, 500)
  }
})
