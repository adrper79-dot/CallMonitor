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

    if (!organizationId) {
      return c.json({
        success: true,
        organization: null,
        role: null,
        message: 'User is not part of any organization'
      })
    }

    // Get organization details via JOIN
    const { rows: orgRows } = await db.query(
      `SELECT om.role, om.organization_id,
              o.id, o.name, o.plan, o.plan_status, o.stripe_customer_id, o.stripe_subscription_id, o.created_at
       FROM org_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1 AND om.organization_id = $2
       LIMIT 1`,
      [userId, organizationId]
    )

    if (orgRows.length === 0) {
      return c.json({
        success: true,
        organization: null,
        role: null,
        message: 'Organization not found'
      })
    }

    const orgRow = orgRows[0]

    // Get member count
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) as head_count FROM org_members WHERE organization_id = $1`,
      [organizationId]
    )
    const memberCount = parseInt(countRows[0]?.head_count || '1', 10)

    // Get subscription status
    const { rows: subRows } = await db.query(
      `SELECT status, plan, current_period_end, cancel_at_period_end
       FROM stripe_subscriptions
       WHERE organization_id = $1
       ORDER BY current_period_end DESC
       LIMIT 1`,
      [organizationId]
    )
    const subscription = subRows[0] || null

    // Determine plan values
    const planValue = subscription?.plan ?? orgRow.plan ?? 'free'
    const planStatusValue = subscription?.status ?? orgRow.plan_status ?? 'active'

    return c.json({
      success: true,
      organization: {
        id: orgRow.id,
        name: orgRow.name,
        plan: planValue,
        plan_status: planStatusValue,
        member_count: memberCount,
        created_at: orgRow.created_at,
        subscription: subscription ? {
          status: subscription.status,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end
        } : null
      },
      role: orgRow.role
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
