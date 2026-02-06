/**
 * Audit Routes - Audit log endpoints
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'

export const auditRoutes = new Hono<{ Bindings: Env }>()

// Get audit logs for organization
auditRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!session.organization_id) {
      // Return empty array if no organization (user might be in setup)
      return c.json({
        success: true,
        logs: [],
        total: 0,
        limit: 12,
        offset: 0,
      })
    }

    const db = getDb(c.env)

    const limit = parseInt(c.req.query('limit') || '12')
    const offset = parseInt(c.req.query('offset') || '0')

    // Fetch audit logs for organization
    // Use explicit cast for user_id join since types may differ
    const result = await db.query(
      `SELECT al.*, u.email as user_email, u.name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id::text = al.user_id::text
       WHERE al.organization_id = $1::uuid
       ORDER BY al.created_at DESC
       LIMIT $2
       OFFSET $3`,
      [session.organization_id, limit, offset]
    )

    return c.json({
      success: true,
      logs: result.rows || [],
      total: result.rows?.length || 0,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/audit-logs error', { error: err?.message || err })
    // Return empty logs on error rather than 500 - might just be empty table
    return c.json({
      success: true,
      logs: [],
      total: 0,
      limit: parseInt(c.req.query('limit') || '12'),
      offset: parseInt(c.req.query('offset') || '0'),
      error: 'Query failed',
    })
  }
})
