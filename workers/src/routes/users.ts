/**
 * Users Routes
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireRole } from '../lib/auth'
import { v4 as uuidv4 } from 'uuid'

export const usersRoutes = new Hono<{ Bindings: Env }>()

// GET /api/users/[userId]/organization
usersRoutes.get('/:userId/organization', async (c) => {
  try {
    const session = await requireRole(c, 'viewer')
    const userId = c.req.param('userId')

    if (!session || session.userId !== userId) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    const db = getDb(c.env)

    let organizationId: string | null = null

    const memRes = await db.query('SELECT organization_id FROM org_members WHERE user_id = $1 LIMIT 1', [userId])
    const membership = memRes.rows?.[0]
    if (membership?.organization_id) {
      organizationId = membership.organization_id
    } else {
      const userRes = await db.query('SELECT organization_id FROM users WHERE id = $1 LIMIT 1', [userId])
      const user = userRes.rows?.[0]
      if (user?.organization_id) {
        organizationId = user.organization_id
        try {
          await db.query('INSERT INTO org_members (id, organization_id, user_id, role, created_at) VALUES ($1,$2,$3,$4,$5)', [
            uuidv4(), user.organization_id, userId, 'member', new Date().toISOString()
          ])
        } catch (e: any) {
          if (!String(e?.message || '').includes('duplicate')) {
            console.error('Failed to create org_members record', e)
          }
        }
      }
    }

    if (!organizationId) {
      return c.json({ success: false, error: 'Organization not found' }, 404)
    }

    return c.json({ success: true, organization_id: organizationId })
  } catch (err: any) {
    console.error('GET /api/users/[userId]/organization error:', err)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})