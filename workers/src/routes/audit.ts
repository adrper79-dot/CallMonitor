/**
 * Audit Routes - Audit log endpoints
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const auditRoutes = new Hono<{ Bindings: Env }>()

// Get audit logs for organization
auditRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!session.organizationId) {
      // Return empty array if no organization (user might be in setup)
      return c.json({
        success: true,
        logs: [],
        total: 0,
        limit: 12,
        offset: 0
      })
    }

    // Use neon client
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const limit = parseInt(c.req.query('limit') || '12')
    const offset = parseInt(c.req.query('offset') || '0')

    // Fetch audit logs for organization
    const result = await sql`
      SELECT al.*, u.email as user_email, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.organization_id = ${session.organizationId}
      ORDER BY al.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    return c.json({
      success: true,
      logs: result,
      total: result.length,
      limit,
      offset
    })
  } catch (err: any) {
    console.error('GET /api/audit-logs error:', err)
    return c.json({ error: 'Failed to get audit logs' }, 500)
  }
})
