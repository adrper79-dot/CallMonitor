import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, requireRole, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/team/members
 * List all team members in the organization
 * Rate limited: 60 requests per minute (DoS protection)
 */
async function handleGET() {
  const ctx = await requireAuth()
  if (ctx instanceof NextResponse) return ctx

  const { data: members, error } = await supabaseAdmin
    .from('org_members')
    .select(`
      id, role, created_at,
      user:users!org_members_user_id_fkey (id, email, phone, created_at)
    `)
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('Failed to fetch members', error)
    return Errors.internal(error)
  }

  const { data: invites } = await supabaseAdmin
    .from('team_invites')
    .select('id, email, role, status, created_at, expires_at')
    .eq('organization_id', ctx.orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return success({ 
    members: members || [], 
    pending_invites: invites || [],
    current_user_id: ctx.userId 
  })
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

  const body = await req.json()
  const { member_id, role } = body

  if (!member_id || !role) {
    return Errors.badRequest('Member ID and role required')
  }

  const validRoles = ['owner', 'admin', 'operator', 'analyst', 'viewer']
  if (!validRoles.includes(role)) {
    return Errors.badRequest(`Role must be one of: ${validRoles.join(', ')}`)
  }

  // Get current role for audit logging
  const { data: targetRows } = await supabaseAdmin
    .from('org_members')
    .select('role, user_id')
    .eq('id', member_id)
    .limit(1)
  
  const targetMember = targetRows?.[0]
  
  if (!targetMember) {
    return Errors.notFound('Member not found')
  }

  // Admin can't change owner
  if (ctx.role === 'admin' && targetMember.role === 'owner') {
    return Errors.unauthorized('Admins cannot change owner role')
  }

  const oldRole = targetMember.role

  // Update org_members
  const { error: updateErr } = await supabaseAdmin
    .from('org_members')
    .update({ role })
    .eq('id', member_id)
    .eq('organization_id', ctx.orgId)

  if (updateErr) {
    logger.error('Failed to update member role', updateErr, { member_id, role })
    return Errors.internal(updateErr)
  }

  // Sync to users table
  if (targetMember.user_id) {
    await supabaseAdmin
      .from('users')
      .update({ role, is_admin: role === 'owner' || role === 'admin' })
      .eq('id', targetMember.user_id)
  }

  // CORRECT: Audit log for role change
  await supabaseAdmin.from('audit_logs').insert({
    organization_id: ctx.orgId,
    user_id: ctx.userId,
    resource_type: 'org_member',
    resource_id: member_id,
    action: 'team:role.update',
    actor_type: 'human',
    actor_label: ctx.userId,
    before: { role: oldRole },
    after: { role },
    created_at: new Date().toISOString()
  })

  logger.info('Team member role updated', {
    member_id,
    target_user_id: targetMember.user_id,
    old_role: oldRole,
    new_role: role,
    actor_id: ctx.userId,
    organization_id: ctx.orgId
  })

  return success({ message: 'Role updated' })
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

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')

  if (!memberId) {
    return Errors.badRequest('Member ID required')
  }

  // Get target member
  const { data: targetRows } = await supabaseAdmin
    .from('org_members')
    .select('role, user_id')
    .eq('id', memberId)
    .limit(1)

  const target = targetRows?.[0]

  if (!target) {
    return Errors.notFound('Member not found')
  }

  if (target.role === 'owner') {
    return Errors.badRequest('Cannot remove organization owner')
  }

  if (target.user_id === ctx.userId) {
    return Errors.badRequest('Cannot remove yourself')
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('org_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', ctx.orgId)

  if (deleteErr) {
    logger.error('Failed to remove team member', deleteErr, { memberId })
    return Errors.internal(deleteErr)
  }

  // CORRECT: Audit log for member removal
  await supabaseAdmin.from('audit_logs').insert({
    organization_id: ctx.orgId,
    user_id: ctx.userId,
    resource_type: 'org_member',
    resource_id: memberId,
    action: 'team:member.remove',
    actor_type: 'human',
    actor_label: ctx.userId,
    before: { 
      role: target.role,
      user_id: target.user_id
    },
    after: null,
    created_at: new Date().toISOString()
  })

  logger.info('Team member removed', {
    member_id: memberId,
    removed_user_id: target.user_id,
    removed_role: target.role,
    actor_id: ctx.userId,
    organization_id: ctx.orgId
  })

  return success({ message: 'Member removed' })
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
