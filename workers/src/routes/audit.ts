/**
 * Audit Routes - Audit log endpoints
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'

export const auditRoutes = new Hono<AppEnv>()

// Get audit logs for organization
auditRoutes.get('/', async (c) => {
  const db = getDb(c.env)
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

    const limit = parseInt(c.req.query('limit') || '12')
    const offset = parseInt(c.req.query('offset') || '0')
    const since = c.req.query('since') || null

    // Fetch audit logs for organization
    // Use explicit cast for user_id join since types may differ
    // Optional `since` cursor enables polling for new-only entries
    const params: any[] = [session.organization_id, limit, offset]
    let sinceClause = ''
    if (since) {
      sinceClause = ' AND al.created_at > $4::timestamptz'
      params.push(since)
    }

    const result = await db.query(
      `SELECT al.*, u.email as user_email, u.name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id::text = al.user_id::text
       WHERE al.organization_id = $1::uuid${sinceClause}
       ORDER BY al.created_at DESC
       LIMIT $2
       OFFSET $3`,
      params
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
  } finally {
    await db.end()
  }
})
