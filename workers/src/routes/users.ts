/**
 * User Routes - User-specific endpoints
 *
 * Endpoints:
 *   GET /me                - Get current user profile
 *   GET /:id/organization  - Get user's organization info
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'

export const userRoutes = new Hono<AppEnv>()

// Get current authenticated user profile
userRoutes.get('/me', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.created_at,
             om.role, om.organization_id,
             o.name as organization_name, o.plan as organization_plan
      FROM users u
      LEFT JOIN org_members om ON om.user_id = u.id
      LEFT JOIN organizations o ON o.id = om.organization_id
      WHERE u.id = $1
      LIMIT 1`,
      [session.user_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404)
    }

    const user = result.rows[0]

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        role: user.role || 'viewer',
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        organization_plan: user.organization_plan || 'free',
      },
    })
  } catch (err: any) {
    logger.error('GET /api/users/me error', { error: err?.message })
    return c.json({ error: 'Failed to get user profile' }, 500)
  } finally {
    await db.end()
  }
})

// Get user's organization info
userRoutes.get('/:id/organization', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userId = c.req.param('id')

    // Users can only access their own organization info
    if (session.user_id !== userId) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const result = await db.query(
      `SELECT o.id, o.name, o.plan, om.role
       FROM organizations o
       JOIN org_members om ON om.organization_id = o.id
       WHERE om.user_id = $1
       LIMIT 1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Organization not found' }, 404)
    }

    const org = result.rows[0]

    return c.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        plan: org.plan || 'free',
        plan_status: 'active',
      },
      role: org.role || 'viewer',
    })
  } catch (err: any) {
    logger.error('GET /api/users/:id/organization error', { error: err?.message })
    return c.json({ error: 'Failed to get organization info' }, 500)
  } finally {
    await db.end()
  }
})

