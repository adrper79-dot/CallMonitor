import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/app/services/emailService'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

/**
 * POST /api/team/invite - Send team invitation email
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole(['owner', 'admin'])
  if (ctx instanceof NextResponse) return ctx

  try {
    const body = await req.json()
    const { email, role } = body

    if (!email || !role) {
      return Errors.badRequest('Email and role required')
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return Errors.badRequest('Invalid email format')
    }

    const validRoles = ['admin', 'operator', 'analyst', 'viewer']
    if (!validRoles.includes(role)) {
      return Errors.badRequest(`Role must be one of: ${validRoles.join(', ')}`)
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (existingUsers?.[0]) {
      const { data: existingMember } = await supabaseAdmin
        .from('org_members')
        .select('id')
        .eq('organization_id', ctx.orgId)
        .eq('user_id', existingUsers[0].id)
        .limit(1)

      if (existingMember?.[0]) {
        return Errors.badRequest('User is already a member of this organization')
      }
    }

    // Check for pending invite
    const { data: pendingInvites } = await supabaseAdmin
      .from('team_invites')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .eq('email', email)
      .eq('status', 'pending')
      .limit(1)

    if (pendingInvites?.[0]) {
      return Errors.badRequest('An invitation is already pending for this email')
    }

    // Create invite
    const inviteId = uuidv4()
    const token = uuidv4()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { error: insertErr } = await supabaseAdmin
      .from('team_invites')
      .insert({
        id: inviteId,
        organization_id: ctx.orgId,
        email,
        role,
        token,
        status: 'pending',
        invited_by: ctx.userId,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      })

    if (insertErr) {
      logger.error('Failed to create invite', insertErr)
      return Errors.internal(insertErr)
    }

    // Get org name
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', ctx.orgId)
      .limit(1)

    const orgName = orgRows?.[0]?.name || 'Your organization'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.callmonitor.com'
    const inviteUrl = `${appUrl}/invite/${token}`

    // Send invitation email
    const emailResult = await sendEmail({
      to: email,
      subject: `You're invited to join ${orgName} on Word Is Bond`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">You're Invited! 🎉</h2>
          <p>You've been invited to join <strong>${orgName}</strong> as a <strong>${role}</strong>.</p>
          <p>Click the button below to accept your invitation:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${inviteUrl}" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">This invitation expires in 7 days.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 12px;">
            If you didn't expect this invitation, you can ignore this email.
          </p>
        </div>
      `
    })

    if (!emailResult.success) {
      logger.warn('Failed to send invite email', { email, error: emailResult.error })
    }

    logger.info('Team invite created', { inviteId, email, role, orgId: ctx.orgId })

    return success({ 
      message: 'Invitation sent',
      invite_id: inviteId,
      email_sent: emailResult.success
    })

  } catch (err: any) {
    logger.error('Team invite error', err)
    return Errors.internal(err)
  }
}

/**
 * DELETE /api/team/invite - Cancel pending invitation
 */
export async function DELETE(req: NextRequest) {
  const ctx = await requireRole(['owner', 'admin'])
  if (ctx instanceof NextResponse) return ctx

  const { searchParams } = new URL(req.url)
  const inviteId = searchParams.get('invite_id')

  if (!inviteId) {
    return Errors.badRequest('Invite ID required')
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('team_invites')
    .update({ status: 'cancelled' })
    .eq('id', inviteId)
    .eq('organization_id', ctx.orgId)
    .eq('status', 'pending')

  if (deleteErr) {
    return Errors.internal(deleteErr)
  }

  return success({ message: 'Invitation cancelled' })
}
