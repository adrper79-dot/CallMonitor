/**
 * Organizations API Routes
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireAuth } from '../lib/auth'

export const organizationsRoutes = new Hono<{ Bindings: Env }>()

// Get current user's organization
organizationsRoutes.get('/current', async (c) => {
  try {
    // Authenticate
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const { organizationId, userId } = session
    const db = getDb(c.env)

    // Get user's organization from users table
    const userResult = await db.query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [userId]
    )

    const orgId = userResult.rows?.[0]?.organization_id || organizationId

    if (!orgId) {
      return c.json({ 
        success: true, 
        organization: null 
      })
    }

    // Get organization details
    const orgResult = await db.query(
      `SELECT id, name, created_at FROM organizations WHERE id = $1`,
      [orgId]
    )

    if (!orgResult.rows || orgResult.rows.length === 0) {
      return c.json({ 
        success: true, 
        organization: null 
      })
    }

    return c.json({ 
      success: true, 
      organization: orgResult.rows[0] 
    })
  } catch (err: any) {
    console.error('GET /api/organizations/current error:', err)
    return c.json({ error: err.message || 'Failed to fetch organization' }, 500)
  }
})

// Get organization by ID
organizationsRoutes.get('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const orgId = c.req.param('id')
    const db = getDb(c.env)

    // Verify user has access to this organization
    if (session.organizationId !== orgId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    const result = await db.query(
      `SELECT id, name, created_at FROM organizations WHERE id = $1`,
      [orgId]
    )

    if (!result.rows || result.rows.length === 0) {
      return c.json({ error: 'Organization not found' }, 404)
    }

    return c.json({ 
      success: true, 
      organization: result.rows[0] 
    })
  } catch (err: any) {
    console.error('GET /api/organizations/:id error:', err)
    return c.json({ error: err.message || 'Failed to fetch organization' }, 500)
  }
})
