/**
 * Team Routes - Team member management & invites
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { InviteMemberSchema, AddMemberSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { teamRateLimit } from '../lib/rate-limit'
import { sendEmail, teamInviteEmailHtml, getEmailDefaults } from '../lib/email'

export const teamRoutes = new Hono<AppEnv>()

// Get team members
teamRoutes.get('/members', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const db = getDb(c.env, session.organization_id)
  try {

    if (!session.organization_id) {
      return c.json({ success: true, members: [], total: 0 })
    }

    const result = await db.query(
      `SELECT om.id, om.role, om.created_at,
              u.id as user_id, u.email, u.name
       FROM org_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.created_at`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      members: result.rows,
      total: result.rows.length,
    })
  } catch (err: any) {
    logger.error('GET /api/team/members error', { error: err?.message })
    return c.json({ error: 'Failed to get team members' }, 500)
  } finally {
    await db.end()
  }
})

// ===== INVITE SYSTEM =====

// Get pending invites for organization
teamRoutes.get('/invites', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const db = getDb(c.env, session.organization_id)
  try {

    if (!session.organization_id) {
      return c.json({ success: true, invites: [] })
    }

    const result = await db.query(
      `SELECT ti.id, ti.email, ti.role, ti.status, ti.created_at, ti.expires_at,
              u.name as invited_by_name, u.email as invited_by_email
       FROM team_invites ti
       LEFT JOIN users u ON u.id = ti.invited_by
       WHERE ti.organization_id = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()
       ORDER BY ti.created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, invites: result.rows })
  } catch (err: any) {
    logger.error('GET /api/team/invites error', { error: err?.message })
    return c.json({ error: 'Failed to get invites' }, 500)
  } finally {
    await db.end()
  }
})

// Create invite
teamRoutes.post('/invites', teamRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const db = getDb(c.env, session.organization_id)
  try {

    if (!session.organization_id) {
      return c.json({ error: 'You must belong to an organization to invite members' }, 400)
    }

    // Check if user has admin role
    if (session.role !== 'admin' && session.role !== 'owner') {
      return c.json({ error: 'Only admins can invite team members' }, 403)
    }

    const parsed = await validateBody(c, InviteMemberSchema)
    if (!parsed.success) return parsed.response
    const { email, role } = parsed.data

    // Check if user already exists and is member
    const existingMember = await db.query(
      `SELECT u.id FROM users u
       JOIN org_members om ON om.user_id = u.id
       WHERE u.email = $1 AND om.organization_id = $2`,
      [email.toLowerCase(), session.organization_id]
    )

    if (existingMember.rows.length > 0) {
      return c.json({ error: 'User is already a member of this organization' }, 409)
    }

    // Check for existing pending invite
    const existingInvite = await db.query(
      `SELECT id FROM team_invites
       WHERE email = $1 AND organization_id = $2 AND status = 'pending' AND expires_at > NOW()`,
      [email.toLowerCase(), session.organization_id]
    )

    if (existingInvite.rows.length > 0) {
      return c.json({ error: 'An invite is already pending for this email' }, 409)
    }

    // Create invite token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await db.query(
      `INSERT INTO team_invites (id, organization_id, email, role, token, invited_by, expires_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [session.organization_id, email.toLowerCase(), role, token, session.user_id, expiresAt]
    )

    // Get org name for the invite link
    const orgResult = await db.query(`SELECT name FROM organizations WHERE id = $1`, [
      session.organization_id,
    ])
    const orgName = orgResult.rows[0]?.name || 'Unknown'

    // Construct invite URL
    const appUrl = c.env.NEXT_PUBLIC_APP_URL || 'https://wordis-bond.com'
    const inviteUrl = `${appUrl}/signup?invite=${token}`

    // Audit log: invite created
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'team_invites',
      resourceId: token,
      action: AuditAction.MEMBER_INVITED,
      newValue: { email: email.toLowerCase(), role, expires_at: expiresAt.toISOString() },
    })

    // Send invite email via Resend (fire-and-forget — don't block response)
    const emailDefaults = getEmailDefaults(c.env)
    sendEmail(c.env.RESEND_API_KEY, {
      ...emailDefaults,
      to: email.toLowerCase(),
      subject: `You're invited to join ${orgName} on Word Is Bond`,
      html: teamInviteEmailHtml(inviteUrl, orgName, session.name || 'A team member', role),
    }).catch(() => {})

    logger.info('Invite created and email sent', { email: email.toLowerCase(), orgName })

    return c.json({
      success: true,
      invite: {
        email,
        role,
        expires_at: expiresAt.toISOString(),
        invite_url: inviteUrl,
        organization_name: orgName,
      },
    })
  } catch (err: any) {
    logger.error('POST /api/team/invites error', { error: err?.message })
    return c.json({ error: 'Failed to create invite' }, 500)
  } finally {
    await db.end()
  }
})

// Validate invite token (public - used during signup)
teamRoutes.get('/invites/validate/:token', async (c) => {
  const db = getDb(c.env)
  try {
    const token = c.req.param('token')

    const result = await db.query(
      `SELECT ti.id, ti.email, ti.role, ti.expires_at,
              o.id as organization_id, o.name as organization_name
       FROM team_invites ti
       JOIN organizations o ON o.id = ti.organization_id
       WHERE ti.token = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()`,
      [token]
    )

    if (result.rows.length === 0) {
      return c.json({ valid: false, error: 'Invalid or expired invite' }, 404)
    }

    const invite = result.rows[0]
    return c.json({
      valid: true,
      invite: {
        email: invite.email,
        role: invite.role,
        organization_id: invite.organization_id,
        organization_name: invite.organization_name,
        expires_at: invite.expires_at,
      },
    })
  } catch (err: any) {
    logger.error('GET /api/team/invites/validate/:token error', { error: err?.message })
    return c.json({ valid: false, error: 'Validation failed' }, 500)
  } finally {
    await db.end()
  }
})

// Accept invite (called after signup or by existing user)
teamRoutes.post('/invites/accept/:token', teamRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized - please sign in first' }, 401)
  }
  const db = getDb(c.env, session.organization_id)
  try {

    const token = c.req.param('token')

    // Get and validate invite
    const inviteResult = await db.query(
      `SELECT ti.id, ti.email, ti.role, ti.organization_id,
              o.name as organization_name
       FROM team_invites ti
       JOIN organizations o ON o.id = ti.organization_id
       WHERE ti.token = $1 AND ti.status = 'pending' AND ti.expires_at > NOW()`,
      [token]
    )

    if (inviteResult.rows.length === 0) {
      return c.json({ error: 'Invalid or expired invite' }, 404)
    }

    const invite = inviteResult.rows[0]

    // Verify email matches (optional security check)
    if (invite.email.toLowerCase() !== session.email?.toLowerCase()) {
      return c.json(
        {
          error: 'This invite was sent to a different email address',
          expected_email: invite.email,
        },
        403
      )
    }

    // Check if already a member
    const existingMember = await db.query(
      `SELECT id FROM org_members WHERE user_id = $1 AND organization_id = $2`,
      [session.user_id, invite.organization_id]
    )

    if (existingMember.rows.length > 0) {
      // Already a member, just mark invite as accepted
      await db.query(
        `UPDATE team_invites SET status = 'accepted', accepted_by = $1, accepted_at = NOW() WHERE id = $2`,
        [session.user_id, invite.id]
      )
      return c.json({ success: true, message: 'You are already a member of this organization' })
    }

    // Add user to organization
    await db.query(
      `INSERT INTO org_members (id, user_id, organization_id, role, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [session.user_id, invite.organization_id, invite.role]
    )

    // Mark invite as accepted
    await db.query(
      `UPDATE team_invites SET status = 'accepted', accepted_by = $1, accepted_at = NOW() WHERE id = $2`,
      [session.user_id, invite.id]
    )

    logger.info('User accepted invite')

    return c.json({
      success: true,
      organization_id: invite.organization_id,
      organization_name: invite.organization_name,
      role: invite.role,
    })
  } catch (err: any) {
    logger.error('POST /api/team/invites/accept/:token error', { error: err?.message })
    return c.json({ error: 'Failed to accept invite' }, 500)
  } finally {
    await db.end()
  }
})

// Cancel/revoke invite
teamRoutes.delete('/invites/:id', teamRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const db = getDb(c.env, session.organization_id)
  try {

    if (session.role !== 'admin' && session.role !== 'owner') {
      return c.json({ error: 'Only admins can cancel invites' }, 403)
    }

    const inviteId = c.req.param('id')

    await db.query(
      `UPDATE team_invites SET status = 'cancelled' 
       WHERE id = $1 AND organization_id = $2 AND status = 'pending'`,
      [inviteId, session.organization_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'team_invites',
      resourceId: inviteId,
      action: AuditAction.MEMBER_REMOVED,
      newValue: { status: 'cancelled' },
    })

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('DELETE /api/team/invites/:id error', { error: err?.message })
    return c.json({ error: 'Failed to cancel invite' }, 500)
  } finally {
    await db.end()
  }
})

// Add team member (direct add - for admins only)
teamRoutes.post('/members', teamRateLimit, async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const parsed = await validateBody(c, AddMemberSchema)
    if (!parsed.success) return parsed.response
    const { email, role } = parsed.data

    // For now, redirect to invite flow
    return c.json(
      {
        error: 'Please use the invite system to add team members',
        action: 'POST /api/team/invites',
      },
      400
    )
  } catch (err: any) {
    logger.error('POST /api/team/members error', { error: err?.message })
    return c.json({ error: 'Failed to add team member' }, 500)
  }
})

// Remove team member
teamRoutes.delete('/members/:id', teamRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const db = getDb(c.env, session.organization_id)
  try {

    if (session.role !== 'admin' && session.role !== 'owner') {
      return c.json({ error: 'Only admins can remove team members' }, 403)
    }

    const memberId = c.req.param('id')

    // Prevent removing self
    if (memberId === session.user_id) {
      return c.json({ error: 'Cannot remove yourself from the organization' }, 400)
    }

    await db.query(`DELETE FROM org_members WHERE user_id = $1 AND organization_id = $2`, [
      memberId,
      session.organization_id,
    ])

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'org_members',
      resourceId: memberId,
      action: AuditAction.MEMBER_REMOVED,
    })

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('DELETE /api/team/members/:id error', { error: err?.message })
    return c.json({ error: 'Failed to remove team member' }, 500)
  } finally {
    await db.end()
  }
})
