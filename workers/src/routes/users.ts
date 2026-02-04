/**
 * User Routes - User-specific endpoints
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const userRoutes = new Hono<{ Bindings: Env }>()

// Get user's organization info
userRoutes.get('/:id/organization', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = c.req.param('id')

    // Users can only access their own organization info
    if (session.userId !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    // Use neon client directly
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      SELECT o.id, o.name, o.plan, om.role
      FROM organizations o
      JOIN org_members om ON om.organization_id = o.id
      WHERE om.user_id = ${userId}
      LIMIT 1
    `

    if (result.length === 0) {
      return c.json({ error: 'Organization not found' }, 404)
    }

    const org = result[0]

    return c.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        plan: org.plan || 'free',
        plan_status: 'active'
      },
      role: org.role || 'viewer'
    })
  } catch (err: any) {
    console.error('GET /api/users/:id/organization error:', err)
    return c.json({ error: 'Failed to get organization info' }, 500)
  }
})