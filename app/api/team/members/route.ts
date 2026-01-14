import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { AppError } from '@/types/app-error'

export const dynamic = 'force-dynamic'

// Helper for structured errors
function errorResponse(code: string, message: string, userMessage: string, status: number) {
  const err = new AppError({ code, message, user_message: userMessage, severity: 'HIGH' })
  return NextResponse.json({ 
    success: false, 
    error: { id: err.id, code: err.code, message: err.user_message } 
  }, { status })
}

/**
 * GET /api/team/members
 * 
 * List all team members in the organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return errorResponse('AUTH_REQUIRED', 'Auth required', 'Please sign in', 401)
    }

    // Get user's org
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return errorResponse('ORG_NOT_FOUND', 'No org', 'Organization not found', 404)
    }

    // Get all members with user details
    const { data: members, error } = await supabaseAdmin
      .from('org_members')
      .select(`
        id,
        role,
        created_at,
        user:users!org_members_user_id_fkey (
          id,
          email,
          phone,
          created_at
        )
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch members:', error)
      return errorResponse('DB_ERROR', error.message, 'Failed to load team', 500)
    }

    // Get pending invites
    const { data: invites } = await supabaseAdmin
      .from('team_invites')
      .select('id, email, role, status, created_at, expires_at')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      members: members || [],
      pending_invites: invites || [],
      current_user_id: userId
    })
  } catch (err: any) {
    console.error('Team members error:', err)
    return errorResponse('INTERNAL_ERROR', err?.message, 'Failed to load team', 500)
  }
}

/**
 * PUT /api/team/members
 * 
 * Update a team member's role
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return errorResponse('AUTH_REQUIRED', 'Auth required', 'Please sign in', 401)
    }

    const body = await req.json()
    const { member_id, role } = body

    if (!member_id || !role) {
      return errorResponse('INVALID_INPUT', 'Missing fields', 'Member ID and role required', 400)
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'operator', 'analyst', 'viewer']
    if (!validRoles.includes(role)) {
      return errorResponse('INVALID_ROLE', 'Invalid role', `Role must be one of: ${validRoles.join(', ')}`, 400)
    }

    // Get user's org and role
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return errorResponse('ORG_NOT_FOUND', 'No org', 'Organization not found', 404)
    }

    // Check if user is owner or admin
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .limit(1)

    const userRole = memberRows?.[0]?.role
    if (userRole !== 'owner' && userRole !== 'admin') {
      return errorResponse('UNAUTHORIZED', 'Not authorized', 'Only owners and admins can change roles', 403)
    }

    // Can't change owner if you're admin
    if (userRole === 'admin') {
      const { data: targetRows } = await supabaseAdmin
        .from('org_members')
        .select('role')
        .eq('id', member_id)
        .limit(1)
      
      if (targetRows?.[0]?.role === 'owner') {
        return errorResponse('UNAUTHORIZED', 'Cannot change owner', 'Admins cannot change owner role', 403)
      }
    }

    // Update the role
    const { error: updateErr } = await supabaseAdmin
      .from('org_members')
      .update({ role })
      .eq('id', member_id)
      .eq('organization_id', orgId)

    if (updateErr) {
      return errorResponse('DB_ERROR', updateErr.message, 'Failed to update role', 500)
    }

    // Also update users table role
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

    return NextResponse.json({ success: true, message: 'Role updated' })
  } catch (err: any) {
    console.error('Update member error:', err)
    return errorResponse('INTERNAL_ERROR', err?.message, 'Failed to update member', 500)
  }
}

/**
 * DELETE /api/team/members
 * 
 * Remove a team member
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return errorResponse('AUTH_REQUIRED', 'Auth required', 'Please sign in', 401)
    }

    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('member_id')

    if (!memberId) {
      return errorResponse('INVALID_INPUT', 'Missing member_id', 'Member ID required', 400)
    }

    // Get user's org
    const { data: userRows } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .limit(1)

    const orgId = userRows?.[0]?.organization_id
    if (!orgId) {
      return errorResponse('ORG_NOT_FOUND', 'No org', 'Organization not found', 404)
    }

    // Check if user is owner or admin
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .limit(1)

    const userRole = memberRows?.[0]?.role
    if (userRole !== 'owner' && userRole !== 'admin') {
      return errorResponse('UNAUTHORIZED', 'Not authorized', 'Only owners and admins can remove members', 403)
    }

    // Can't remove owner
    const { data: targetRows } = await supabaseAdmin
      .from('org_members')
      .select('role, user_id')
      .eq('id', memberId)
      .limit(1)

    if (targetRows?.[0]?.role === 'owner') {
      return errorResponse('CANNOT_REMOVE_OWNER', 'Cannot remove owner', 'The organization owner cannot be removed', 400)
    }

    // Can't remove yourself
    if (targetRows?.[0]?.user_id === userId) {
      return errorResponse('CANNOT_REMOVE_SELF', 'Cannot remove self', 'You cannot remove yourself from the team', 400)
    }

    // Remove membership
    const { error: deleteErr } = await supabaseAdmin
      .from('org_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', orgId)

    if (deleteErr) {
      return errorResponse('DB_ERROR', deleteErr.message, 'Failed to remove member', 500)
    }

    return NextResponse.json({ success: true, message: 'Member removed' })
  } catch (err: any) {
    console.error('Remove member error:', err)
    return errorResponse('INTERNAL_ERROR', err?.message, 'Failed to remove member', 500)
  }
}
