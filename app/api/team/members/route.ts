import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireAuth, requireRole, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/team/members
 * List all team members in the organization
 */
export async function GET() {
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
 */
export async function PUT(req: NextRequest) {
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

  // Admin can't change owner
  if (ctx.role === 'admin') {
    const { data: targetRows } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('id', member_id)
      .limit(1)
    
    if (targetRows?.[0]?.role === 'owner') {
      return Errors.unauthorized('Admins cannot change owner role')
    }
  }

  // Update org_members
  const { error: updateErr } = await supabaseAdmin
    .from('org_members')
    .update({ role })
    .eq('id', member_id)
    .eq('organization_id', ctx.orgId)

  if (updateErr) {
    return Errors.internal(updateErr)
  }

  // Sync to users table
  const { data: memberData } = await supabaseAdmin
    .from('org_members')
    .select('user_id')
    .eq('id', member_id)
    .limit(1)

  if (memberData?.[0]?.user_id) {
    await supabaseAdmin
      .from('users')
      .update({ role, is_admin: role === 'owner' || role === 'admin' })
      .eq('id', memberData[0].user_id)
  }

  return success({ message: 'Role updated' })
}

/**
 * DELETE /api/team/members
 * Remove a team member
 */
export async function DELETE(req: NextRequest) {
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

  if (target?.role === 'owner') {
    return Errors.badRequest('Cannot remove organization owner')
  }

  if (target?.user_id === ctx.userId) {
    return Errors.badRequest('Cannot remove yourself')
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('org_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', ctx.orgId)

  if (deleteErr) {
    return Errors.internal(deleteErr)
  }

  return success({ message: 'Member removed' })
}
