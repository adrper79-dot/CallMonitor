import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'
import { AppError } from '@/types/app-error'

export const dynamic = 'force-dynamic'

function errorResponse(code: string, message: string, userMessage: string, status: number) {
  const err = new AppError({ code, message, user_message: userMessage, severity: 'HIGH' })
  return NextResponse.json({ 
    success: false, 
    error: { id: err.id, code: err.code, message: err.user_message } 
  }, { status })
}

/**
 * POST /api/team/invite
 * 
 * Send an invitation email to join the team
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return errorResponse('AUTH_REQUIRED', 'Auth required', 'Please sign in', 401)
    }

    const body = await req.json()
    const { email, role = 'operator' } = body

    if (!email) {
      return errorResponse('INVALID_INPUT', 'Email required', 'Email address is required', 400)
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('INVALID_EMAIL', 'Invalid email', 'Please enter a valid email address', 400)
    }

    // Validate role
    const validRoles = ['admin', 'operator', 'analyst', 'viewer']
    if (!validRoles.includes(role)) {
      return errorResponse('INVALID_ROLE', 'Invalid role', `Role must be one of: ${validRoles.join(', ')}`, 400)
    }

    // Get user's org and check permissions
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
      return errorResponse('UNAUTHORIZED', 'Not authorized', 'Only owners and admins can invite members', 403)
    }

    // Check if user already exists in org
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('organization_id', orgId)
      .limit(1)

    if (existingUser?.[0]) {
      return errorResponse('ALREADY_MEMBER', 'Already a member', 'This user is already a team member', 400)
    }

    // Check for pending invite
    const { data: existingInvite } = await supabaseAdmin
      .from('team_invites')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .limit(1)

    if (existingInvite?.[0]) {
      return errorResponse('INVITE_EXISTS', 'Invite pending', 'An invitation has already been sent to this email', 400)
    }

    // Get org name for email
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .limit(1)

    const orgName = orgRows?.[0]?.name || 'Your Team'

    // Create invite token
    const inviteToken = uuidv4()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    // Create invite record
    const { error: insertErr } = await supabaseAdmin
      .from('team_invites')
      .insert({
        id: uuidv4(),
        organization_id: orgId,
        email: email.toLowerCase(),
        role,
        token: inviteToken,
        status: 'pending',
        invited_by: userId,
        expires_at: expiresAt.toISOString()
      })

    if (insertErr) {
      console.error('Failed to create invite:', insertErr)
      return errorResponse('DB_ERROR', insertErr.message, 'Failed to create invitation', 500)
    }

    // Send invite email via Resend
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`
    
    if (process.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'VoxSouth <onboarding@resend.dev>',
            to: [email],
            subject: `You're invited to join ${orgName} on VoxSouth`,
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #00CED1; margin-bottom: 24px;">You're Invited! 🎉</h1>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  You've been invited to join <strong>${orgName}</strong> on VoxSouth, 
                  the voice intelligence platform for modern teams.
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                  Your role: <strong style="color: #C5A045;">${role.charAt(0).toUpperCase() + role.slice(1)}</strong>
                </p>
                <div style="margin: 32px 0;">
                  <a href="${inviteUrl}" 
                     style="display: inline-block; background: linear-gradient(135deg, #00CED1, #40E0D0); 
                            color: #0A0A1A; padding: 14px 32px; border-radius: 50px; 
                            text-decoration: none; font-weight: bold; font-size: 16px;">
                    Accept Invitation
                  </a>
                </div>
                <p style="font-size: 14px; color: #666;">
                  This invitation expires in 7 days.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                <p style="font-size: 12px; color: #999;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>
            `
          })
        })

        if (!res.ok) {
          console.error('Failed to send invite email:', await res.text())
        }
      } catch (emailErr) {
        console.error('Email send error:', emailErr)
        // Don't fail the request - invite is created
      }
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      invite_url: inviteUrl // For testing without email
    })
  } catch (err: any) {
    console.error('Invite error:', err)
    return errorResponse('INTERNAL_ERROR', err?.message, 'Failed to send invitation', 500)
  }
}

/**
 * DELETE /api/team/invite
 * 
 * Cancel a pending invitation
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return errorResponse('AUTH_REQUIRED', 'Auth required', 'Please sign in', 401)
    }

    const { searchParams } = new URL(req.url)
    const inviteId = searchParams.get('invite_id')

    if (!inviteId) {
      return errorResponse('INVALID_INPUT', 'Missing invite_id', 'Invite ID required', 400)
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
      return errorResponse('UNAUTHORIZED', 'Not authorized', 'Only owners and admins can cancel invitations', 403)
    }

    // Update invite status
    const { error: updateErr } = await supabaseAdmin
      .from('team_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId)
      .eq('organization_id', orgId)

    if (updateErr) {
      return errorResponse('DB_ERROR', updateErr.message, 'Failed to cancel invitation', 500)
    }

    return NextResponse.json({ success: true, message: 'Invitation cancelled' })
  } catch (err: any) {
    console.error('Cancel invite error:', err)
    return errorResponse('INTERNAL_ERROR', err?.message, 'Failed to cancel invitation', 500)
  }
}
