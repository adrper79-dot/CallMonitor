import { NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireAuth, requireRole, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/team/members
 * List all team members in the organization
 * Rate limited: 60 requests per minute (DoS protection)
 */
async function handleGET() {
  const ctx = await requireAuth()
  if (ctx instanceof NextResponse) return ctx
  const organizationId = ctx.user.organizationId
  const userId = ctx.user.id

  try {
    // Fetch members with user details via JOIN
    const { rows: membersData } = await query(
      `SELECT om.id, om.role, om.created_at,
              u.id as user_id, u.email, u.phone, u.created_at as user_created_at
       FROM org_members om
       JOIN users u ON om.user_id = u.id
       WHERE om.organization_id = $1
       ORDER BY om.created_at ASC`,
      [organizationId]
    )

    // Map to expected structure
    const members = membersData.map((row: any) => ({
      id: row.id,
      role: row.role,
      created_at: row.created_at,
      user: {
        id: row.user_id,
        email: row.email,
        phone: row.phone,
        created_at: row.user_created_at
      }
    }))

    // Fetch pending invites
    const { rows: invites } = await query(
      `SELECT id, email, role, status, created_at, expires_at 
       FROM team_invites
       WHERE organization_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [organizationId]
    )

    return success({
      members: members || [],
      pending_invites: invites || [],
      current_user_id: userId
    })
  } catch (error: any) {
    logger.error('Failed to fetch members', error)
    return Errors.internal(error)
  }
}

/**
 * PUT /api/team/members
 * Update a team member's role
 * 
 * ARCHITECTURE COMPLIANCE:
 * - Audit logged (role changes tracked)
 * - RBAC enforced (owner/admin only)
 */
async function handlePUT(req: Request) {
  const ctx = await requireRole(['owner', 'admin'])
  if (ctx instanceof NextResponse) return ctx
  const organizationId = ctx.user.organizationId
  const userId = ctx.user.id
  const userRole = ctx.user.role

  const body = await req.json()
  const { member_id, role } = body

  if (!member_id || !role) {
    return Errors.badRequest('Member ID and role required')
  }

  const validRoles = ['owner', 'admin', 'operator', 'analyst', 'viewer']
  if (!validRoles.includes(role)) {
    return Errors.badRequest(`Role must be one of: ${validRoles.join(', ')}`)
  }

  try {
    // Get current role for audit logging and validation
    const { rows: targetRows } = await query(
      `SELECT role, user_id FROM org_members WHERE id = $1 LIMIT 1`,
      [member_id]
    )

    const targetMember = targetRows[0]

    if (!targetMember) {
      return Errors.notFound('Member not found')
    }

    // Admin can't change owner
    if (userRole === 'admin' && targetMember.role === 'owner') {
      return Errors.unauthorized('Admins cannot change owner role')
    }

    const oldRole = targetMember.role

    // Update org_members
    await query(
      `UPDATE org_members SET role = $1 WHERE id = $2 AND organization_id = $3`,
      [role, member_id, organizationId]
    )

    // Sync to users table
    if (targetMember.user_id) {
      await query(
        `UPDATE users SET role = $1, is_admin = $2 WHERE id = $3`,
        [role, (role === 'owner' || role === 'admin'), targetMember.user_id]
      )
    }

    // Audit log for role change
    await query(
      `INSERT INTO audit_logs (
         organization_id, user_id, resource_type, resource_id, action,
         actor_type, actor_label, before, after, created_at
       ) VALUES ($1, $2, 'org_member', $3, 'team:role.update', 'human', $4, $5, $6, NOW())`,
      [
        organizationId,
        userId,
        member_id,
        userId,
        JSON.stringify({ role: oldRole }),
        JSON.stringify({ role })
      ]
    )

    logger.info('Team member role updated', {
      member_id,
      target_user_id: targetMember.user_id,
      old_role: oldRole,
      new_role: role,
      actor_id: userId,
      organization_id: organizationId
    })

    return success({ message: 'Role updated' })

  } catch (error: any) {
    logger.error('Failed to update member role', error, { member_id, role })
    return Errors.internal(error)
  }
}

/**
 * DELETE /api/team/members
 * Remove a team member
 * 
 * ARCHITECTURE COMPLIANCE:
 * - Audit logged (member removal tracked)
 * - RBAC enforced (owner/admin only)
 */
async function handleDELETE(req: Request) {
  const ctx = await requireRole(['owner', 'admin'])
  if (ctx instanceof NextResponse) return ctx
  const organizationId = ctx.user.organizationId
  const userId = ctx.user.id

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')

  if (!memberId) {
    return Errors.badRequest('Member ID required')
  }

  try {
    // Get target member
    const { rows: targetRows } = await query(
      `SELECT role, user_id FROM org_members WHERE id = $1 LIMIT 1`,
      [memberId]
    )

    const target = targetRows[0]

    if (!target) {
      return Errors.notFound('Member not found')
    }

    if (target.role === 'owner') {
      return Errors.badRequest('Cannot remove organization owner')
    }

    if (target.user_id === userId) {
      return Errors.badRequest('Cannot remove yourself')
    }

    await query(
      `DELETE FROM org_members WHERE id = $1 AND organization_id = $2`,
      [memberId, organizationId]
    )

    // Audit log for member removal
    await query(
      `INSERT INTO audit_logs (
         organization_id, user_id, resource_type, resource_id, action,
         actor_type, actor_label, before, after, created_at
       ) VALUES ($1, $2, 'org_member', $3, 'team:member.remove', 'human', $4, $5, NULL, NOW())`,
      [
        organizationId,
        userId,
        memberId,
        userId,
        JSON.stringify({
          role: target.role,
          user_id: target.user_id
        })
      ]
    )

    logger.info('Team member removed', {
      member_id: memberId,
      removed_user_id: target.user_id,
      removed_role: target.role,
      actor_id: userId,
      organization_id: organizationId
    })

    return success({ message: 'Member removed' })

  } catch (error: any) {
    logger.error('Failed to remove team member', error, { memberId })
    return Errors.internal(error)
  }
}

// Rate limiting configuration for team member operations
const readRateLimitConfig = {
  identifier: (req: Request) => getClientIP(req),
  config: {
    maxAttempts: 60,         // 60 reads
    windowMs: 60 * 1000,     // per minute
    blockMs: 60 * 1000       // 1 minute block on abuse
  }
}

const writeRateLimitConfig = {
  identifier: (req: Request) => getClientIP(req),
  config: {
    maxAttempts: 20,         // 20 writes
    windowMs: 60 * 60 * 1000, // per hour
    blockMs: 60 * 60 * 1000   // 1 hour block on abuse
  }
}

export const GET = withRateLimit(handleGET, readRateLimitConfig)
export const PUT = withRateLimit(handlePUT, writeRateLimitConfig)
export const DELETE = withRateLimit(handleDELETE, writeRateLimitConfig)
