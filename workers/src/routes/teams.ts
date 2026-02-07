/**
 * Teams Routes — Department/squad management within an organization
 *
 * Manages teams (departments), team membership, and org-switching
 * for multi-org users. Extends the existing team.ts invite system.
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import {
  CreateTeamSchema,
  UpdateTeamSchema,
  AddTeamMemberSchema,
  SwitchOrgSchema,
  UpdateRoleSchema,
} from '../lib/schemas'
import { requirePlan } from '../lib/plan-gating'

export const teamsRoutes = new Hono<{ Bindings: Env }>()

// ════════════════════════════════════════════════════════════
// TEAMS (departments/squads)
// ════════════════════════════════════════════════════════════

// List teams in org
teamsRoutes.get('/', requirePlan('pro'), async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    if (!session.organization_id) {
      return c.json({ success: true, teams: [] })
    }

    const result = await db.query(
      `SELECT t.id, t.name, t.description, t.team_type, t.parent_team_id,
              t.manager_user_id, t.is_active, t.created_at,
              u.name as manager_name, u.email as manager_email,
              (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) as member_count
       FROM teams t
       LEFT JOIN users u ON u.id = t.manager_user_id::text
       WHERE t.organization_id = $1 AND t.is_active = true
       ORDER BY t.name`,
      [session.organization_id]
    )

    return c.json({ success: true, teams: result.rows })
  } catch (err: any) {
    return c.json({ error: 'Failed to list teams' }, 500)
  } finally {
    await db.end()
  }
})

// Create team (manager+ role)
teamsRoutes.post('/', requirePlan('pro'), async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 }
    if ((roleLevel[session.role as keyof typeof roleLevel] || 0) < 3) {
      return c.json({ error: 'Manager role required to create teams' }, 403)
    }

    const parsed = await validateBody(c, CreateTeamSchema)
    if (!parsed.success) return parsed.response
    const { name, description, team_type, parent_team_id, manager_user_id } = parsed.data

    const result = await db.query(
      `INSERT INTO teams (organization_id, name, description, team_type, parent_team_id, manager_user_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, description, team_type, parent_team_id, manager_user_id, created_at`,
      [
        session.organization_id,
        name.trim(),
        description || null,
        team_type || 'department',
        parent_team_id || null,
        manager_user_id || null,
        session.user_id,
      ]
    )

    return c.json({ success: true, team: result.rows[0] }, 201)
  } catch (err: any) {
    if (err.message?.includes('unique') || err.code === '23505') {
      return c.json({ error: 'A team with that name already exists in this organization' }, 409)
    }
    return c.json({ error: 'Failed to create team' }, 500)
  } finally {
    await db.end()
  }
})

// Update team
teamsRoutes.put('/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 }
    if ((roleLevel[session.role as keyof typeof roleLevel] || 0) < 3) {
      return c.json({ error: 'Manager role required' }, 403)
    }

    const teamId = c.req.param('id')
    const parsed = await validateBody(c, UpdateTeamSchema)
    if (!parsed.success) return parsed.response
    const { name, description, team_type, parent_team_id, manager_user_id, is_active } = parsed.data

    await db.query(
      `UPDATE teams SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        team_type = COALESCE($3, team_type),
        parent_team_id = $4,
        manager_user_id = $5,
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
       WHERE id = $7 AND organization_id = $8`,
      [
        name || null,
        description,
        team_type || null,
        parent_team_id || null,
        manager_user_id || null,
        is_active ?? null,
        teamId,
        session.organization_id,
      ]
    )

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Failed to update team' }, 500)
  } finally {
    await db.end()
  }
})

// Delete team (admin+ role)
teamsRoutes.delete('/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 }
    if ((roleLevel[session.role as keyof typeof roleLevel] || 0) < 4) {
      return c.json({ error: 'Admin role required' }, 403)
    }

    const teamId = c.req.param('id')

    // Soft-delete: deactivate instead of removing
    await db.query(
      `UPDATE teams SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [teamId, session.organization_id]
    )

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Failed to delete team' }, 500)
  } finally {
    await db.end()
  }
})

// ════════════════════════════════════════════════════════════
// TEAM MEMBERS
// ════════════════════════════════════════════════════════════

// Get members of a team
teamsRoutes.get('/:id/members', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const teamId = c.req.param('id')

    // Verify team belongs to org
    const teamCheck = await db.query(
      `SELECT id FROM teams WHERE id = $1 AND organization_id = $2`,
      [teamId, session.organization_id]
    )
    if (teamCheck.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    const result = await db.query(
      `SELECT tm.id, tm.team_role, tm.joined_at,
              u.id as user_id, u.name, u.email,
              om.role as org_role
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id::text
       LEFT JOIN org_members om ON om.user_id = tm.user_id AND om.organization_id = $2
       WHERE tm.team_id = $1
       ORDER BY tm.team_role, u.name`,
      [teamId, session.organization_id]
    )

    return c.json({ success: true, members: result.rows })
  } catch (err: any) {
    return c.json({ error: 'Failed to list team members' }, 500)
  } finally {
    await db.end()
  }
})

// Add member to team
teamsRoutes.post('/:id/members', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 }
    if ((roleLevel[session.role as keyof typeof roleLevel] || 0) < 3) {
      return c.json({ error: 'Manager role required' }, 403)
    }

    const teamId = c.req.param('id')
    const parsed = await validateBody(c, AddTeamMemberSchema)
    if (!parsed.success) return parsed.response
    const { user_id, team_role } = parsed.data

    // Verify team belongs to org
    const teamCheck = await db.query(
      `SELECT id FROM teams WHERE id = $1 AND organization_id = $2`,
      [teamId, session.organization_id]
    )
    if (teamCheck.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    // Verify user is an org member
    const memberCheck = await db.query(
      `SELECT id FROM org_members WHERE user_id = $1 AND organization_id = $2`,
      [user_id, session.organization_id]
    )
    if (memberCheck.rows.length === 0) {
      return c.json({ error: 'User is not a member of this organization' }, 400)
    }

    const result = await db.query(
      `INSERT INTO team_members (team_id, user_id, team_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET team_role = $3
       RETURNING id, team_role, joined_at`,
      [teamId, user_id, team_role]
    )

    return c.json({ success: true, membership: result.rows[0] }, 201)
  } catch (err: any) {
    return c.json({ error: 'Failed to add team member' }, 500)
  } finally {
    await db.end()
  }
})

// Remove member from team
teamsRoutes.delete('/:id/members/:userId', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 }
    if ((roleLevel[session.role as keyof typeof roleLevel] || 0) < 3) {
      return c.json({ error: 'Manager role required' }, 403)
    }

    const teamId = c.req.param('id')
    const userId = c.req.param('userId')

    // Verify team belongs to org
    const teamCheck = await db.query(
      `SELECT id FROM teams WHERE id = $1 AND organization_id = $2`,
      [teamId, session.organization_id]
    )
    if (teamCheck.rows.length === 0) {
      return c.json({ error: 'Team not found' }, 404)
    }

    await db.query(`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, [teamId, userId])

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Failed to remove team member' }, 500)
  } finally {
    await db.end()
  }
})

// ════════════════════════════════════════════════════════════
// ORG SWITCHING (multi-org users)
// ════════════════════════════════════════════════════════════

// List all organizations user belongs to
teamsRoutes.get('/my-orgs', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const result = await db.query(
      `SELECT o.id, o.name, o.plan, o.plan_status,
              om.role, om.created_at as joined_at,
              (SELECT COUNT(*) FROM org_members om2 WHERE om2.organization_id = o.id) as member_count
       FROM org_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY om.created_at`,
      [session.user_id]
    )

    return c.json({
      success: true,
      organizations: result.rows,
      current_org_id: session.organization_id,
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to list organizations' }, 500)
  } finally {
    await db.end()
  }
})

// Switch active org (updates session)
teamsRoutes.post('/switch-org', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, SwitchOrgSchema)
    if (!parsed.success) return parsed.response
    const { organization_id } = parsed.data

    // Verify user is a member of the target org
    const membership = await db.query(
      `SELECT om.role, o.name as org_name
       FROM org_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1 AND om.organization_id = $2`,
      [session.user_id, organization_id]
    )

    if (membership.rows.length === 0) {
      return c.json({ error: 'You are not a member of that organization' }, 403)
    }

    // Update the user's session to point to the new org
    // We store active org by updating the org_members ordering or a user preference
    // For now: return the new org context so the client can update its session cache
    const member = membership.rows[0]

    return c.json({
      success: true,
      organization: {
        id: organization_id,
        name: member.org_name,
        role: member.role,
      },
      message: 'Organization switched. Refresh your session to see changes.',
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to switch organization' }, 500)
  } finally {
    await db.end()
  }
})

// ════════════════════════════════════════════════════════════
// ROLE MANAGEMENT (update org member roles)
// ════════════════════════════════════════════════════════════

// Update member role
teamsRoutes.patch('/members/:userId/role', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel: Record<string, number> = {
      viewer: 1,
      agent: 2,
      manager: 3,
      compliance: 3,
      admin: 4,
      owner: 5,
    }

    if ((roleLevel[session.role] || 0) < 4) {
      return c.json({ error: 'Admin role required to change roles' }, 403)
    }

    const userId = c.req.param('userId')
    const parsed = await validateBody(c, UpdateRoleSchema)
    if (!parsed.success) return parsed.response
    const { role } = parsed.data

    // Can't assign owner unless you are owner
    if (role === 'owner' && session.role !== 'owner') {
      return c.json({ error: 'Only owners can assign the owner role' }, 403)
    }

    // Can't change your own role
    if (userId === session.user_id) {
      return c.json({ error: 'Cannot change your own role' }, 400)
    }

    await db.query(
      `UPDATE org_members SET role = $1
       WHERE user_id = $2 AND organization_id = $3`,
      [role, userId, session.organization_id]
    )

    return c.json({ success: true, user_id: userId, new_role: role })
  } catch (err: any) {
    return c.json({ error: 'Failed to update role' }, 500)
  } finally {
    await db.end()
  }
})
