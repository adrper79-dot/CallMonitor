import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { CreateOrgSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { orgRateLimit } from '../lib/rate-limit'

export const organizationsRoutes = new Hono<AppEnv>()

// Create a new organization
organizationsRoutes.post('/', orgRateLimit, async (c) => {
  // Authenticate
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { user_id } = session

  // Use centralized DB client
  const db = getDb(c.env, session.organization_id)
  try {
    // Check if user already has an organization
    const existingOrg = await db.query(
      'SELECT organization_id FROM org_members WHERE user_id = $1',
      [user_id]
    )

    if (existingOrg.rows.length > 0) {
      return c.json({ error: 'User is already part of an organization' }, 400)
    }

    // Parse request body
    const parsed = await validateBody(c, CreateOrgSchema)
    if (!parsed.success) return parsed.response
    const { name } = parsed.data

    // Create organization
    let orgResult
    try {
      orgResult = await db.query(
        `INSERT INTO organizations (name, created_by)
         VALUES ($1, $2)
         RETURNING id, name, created_at`,
        [name.trim(), user_id]
      )
    } catch (insertError: any) {
      logger.error('POST /api/organizations insert error', { error: insertError?.message })
      throw insertError
    }

    const org = orgResult.rows[0]

    // Add user as admin member
    await db.query(
      `INSERT INTO org_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [org.id, user_id]
    )

    writeAuditLog(db, {
      organizationId: org.id,
      userId: user_id,
      resourceType: 'organizations',
      resourceId: org.id,
      action: AuditAction.ORG_CREATED,
      newValue: org,
    })

    return c.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        plan: 'free',
        plan_status: 'active',
        member_count: 1,
        created_at: org.created_at,
      },
      role: 'admin',
      message: 'Organization created successfully',
    })
  } catch (err: any) {
    logger.error('POST /api/organizations error', { error: err?.message })
    return c.json({ error: 'Failed to create organization' }, 500)
  } finally {
    await db.end()
  }
})

organizationsRoutes.get('/current', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Use centralized DB client
  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT o.id, o.name, o.plan, om.role
       FROM organizations o
       JOIN org_members om ON om.organization_id = o.id
       WHERE om.user_id = $1
       LIMIT 1`,
      [session.user_id]
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
    logger.error('GET /api/organizations/current error', { error: err?.message })
    return c.json({ error: 'Failed to fetch organization' }, 500)
  } finally {
    await db.end()
  }
})

// GET /:id — Get organization by ID (admin/owner only)
organizationsRoutes.get('/:id', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const orgId = c.req.param('id')
  const db = getDb(c.env, session.organization_id)
  try {
    // Verify membership
    const result = await db.query(
      `SELECT o.id, o.name, o.plan, o.created_at, om.role,
              (SELECT COUNT(*)::int FROM org_members WHERE organization_id = o.id) AS member_count
       FROM organizations o
       JOIN org_members om ON om.organization_id = o.id AND om.user_id = $1
       WHERE o.id = $2`,
      [session.user_id, orgId]
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
        member_count: org.member_count,
        created_at: org.created_at,
      },
      role: org.role,
    })
  } catch (err: any) {
    logger.error('GET /api/organizations/:id error', { error: err?.message })
    return c.json({ error: 'Failed to fetch organization' }, 500)
  } finally {
    await db.end()
  }
})

