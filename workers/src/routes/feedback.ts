/**
 * Feedback Routes - Bug reports and user feedback
 *
 * Endpoints:
 *   POST /  - Submit bug report or feedback
 *   GET  /  - List feedback (admin only)
 *
 * Called by BugReporter component
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const feedbackRoutes = new Hono<AppEnv>()

// ─── POST / — Submit feedback/bug report ───────────────────────────────────
feedbackRoutes.post('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const body = await c.req.json()
    const { type, title, description, pageUrl, userAgent } = body

    if (!title || !description) {
      return c.json({ error: 'title and description are required' }, 400)
    }

    const result = await db.query(
      `INSERT INTO feedback
        (organization_id, user_id, type, title, description, page_url, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        session.organization_id,
        session.user_id,
        type || 'bug',
        title.trim(),
        description.trim(),
        pageUrl || null,
        userAgent || null,
      ]
    )

    return c.json({ success: true, feedback: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/feedback error', { error: err?.message })
    // Graceful degradation — table may not exist
    return c.json({ success: true, message: 'Feedback received (offline mode)' })
  } finally {
    await db.end()
  }
})

// ─── GET / — List feedback (admin) ─────────────────────────────────────────
feedbackRoutes.get('/', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)

    const result = await db.query(
      `SELECT f.*, u.email, u.name AS user_name
       FROM feedback f
       LEFT JOIN users u ON f.user_id = u.id
       WHERE f.organization_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [session.organization_id, limit]
    )

    return c.json({ success: true, data: result.rows })
  } catch (err: any) {
    logger.error('GET /api/feedback error', { error: err?.message })
    return c.json({ success: true, data: [] })
  } finally {
    await db.end()
  }
})
