/**
 * RBAC Routes — Real permission-based access control
 *
 * Replaces the stub with actual DB-backed permission lookups.
 * Uses rbac_permissions table + role hierarchy for inheritance.
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { rbacRateLimit } from '../lib/rate-limit'

export const rbacRoutes = new Hono<AppEnv>()

// Role hierarchy — higher roles inherit all lower-role permissions
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  user: 2,
  agent: 2,
  manager: 3,
  compliance: 3, // Same level as manager, different permission set
  admin: 4,
  owner: 5,
}

// Roles that a given role inherits from (ordered)
const ROLE_INHERITANCE: Record<string, string[]> = {
  viewer: ['viewer'],
  user: ['viewer', 'user'],
  agent: ['viewer', 'user', 'agent'],
  manager: ['viewer', 'user', 'agent', 'manager'],
  compliance: ['viewer', 'user', 'compliance'],
  admin: ['viewer', 'user', 'agent', 'manager', 'compliance', 'admin'],
  owner: ['viewer', 'user', 'agent', 'manager', 'compliance', 'admin', 'owner'],
}

// Get permissions context for current user
rbacRoutes.get('/context', rbacRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const orgId = c.req.query('orgId') || session.organization_id
    const userRole = session.role || 'viewer'

    // Get inherited roles
    const inheritedRoles = ROLE_INHERITANCE[userRole] || ['viewer']

    // Fetch all permissions for the user's role chain
    const placeholders = inheritedRoles.map((_, i) => `$${i + 1}`).join(',')
    const result = await db.query(
      `SELECT role, resource, action, conditions
       FROM rbac_permissions
       WHERE role IN (${placeholders})
       ORDER BY role, resource, action`,
      inheritedRoles
    )

    // Fetch organization plan
    let plan = 'base'
    if (orgId) {
      const planResult = await db.query(`SELECT plan FROM organizations WHERE id = $1 LIMIT 1`, [
        orgId,
      ])
      if (planResult.rows[0]?.plan) {
        plan = planResult.rows[0].plan
      }
    }

    // Group permissions by resource
    const permissionsByResource: Record<string, string[]> = {}
    const permissionsList: string[] = []

    for (const row of result.rows) {
      const key = `${row.resource}:${row.action}`
      if (!permissionsList.includes(key)) {
        permissionsList.push(key)
      }
      if (!permissionsByResource[row.resource]) {
        permissionsByResource[row.resource] = []
      }
      if (!permissionsByResource[row.resource].includes(row.action)) {
        permissionsByResource[row.resource].push(row.action)
      }
    }

    return c.json({
      success: true,
      role: userRole,
      plan,
      role_level: ROLE_HIERARCHY[userRole] || 0,
      inherited_roles: inheritedRoles,
      permissions: permissionsList,
      permissions_by_resource: permissionsByResource,
      orgId,
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to get RBAC context' }, 500)
  } finally {
    await db.end()
  }
})

// Check if user has a specific permission
rbacRoutes.get('/check', rbacRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const resource = c.req.query('resource')
    const action = c.req.query('action')

    if (!resource || !action) {
      return c.json({ error: 'resource and action query params required' }, 400)
    }

    const userRole = session.role || 'viewer'
    const inheritedRoles = ROLE_INHERITANCE[userRole] || ['viewer']

    const placeholders = inheritedRoles.map((_, i) => `$${i + 3}`).join(',')
    const result = await db.query(
      `SELECT id FROM rbac_permissions
       WHERE resource = $1 AND action = $2 AND role IN (${placeholders})
       LIMIT 1`,
      [resource, action, ...inheritedRoles]
    )

    return c.json({
      allowed: result.rows.length > 0,
      resource,
      action,
      role: userRole,
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to check permission' }, 500)
  } finally {
    await db.end()
  }
})

// List all available roles and their permissions (admin+)
rbacRoutes.get('/roles', rbacRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel = ROLE_HIERARCHY[session.role] || 0
    if (roleLevel < 4) {
      return c.json({ error: 'Admin role required' }, 403)
    }

    const result = await db.query(
      `SELECT role, resource, action FROM rbac_permissions ORDER BY role, resource, action`,
      []
    )

    // Group by role
    const roleMap: Record<string, { resource: string; action: string }[]> = {}
    for (const row of result.rows) {
      if (!roleMap[row.role]) roleMap[row.role] = []
      roleMap[row.role].push({ resource: row.resource, action: row.action })
    }

    return c.json({
      success: true,
      roles: Object.entries(ROLE_HIERARCHY).map(([name, level]) => ({
        name,
        level,
        inherits: ROLE_INHERITANCE[name] || [],
        permissions: roleMap[name] || [],
      })),
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to list roles' }, 500)
  } finally {
    await db.end()
  }
})

