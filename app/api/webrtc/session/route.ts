
import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

import pgClient from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rateLimit'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * POST /api/webrtc/session
 * Create a new WebRTC session using SIP over WebSockets
 * 
 * ARCHITECTURE COMPLIANCE:
 * - Rate limited (30 sessions/hour per user)
 * - Audit logged (session creation)
 * - RBAC enforced (owner/admin/operator only)
 * - RLS compliant (organization scoped)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      logger.error('[webrtc] No userId found in session', { session });
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required', details: { session } } },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitKey = `webrtc:session:${userId}`
    const rateLimitCheck = await checkRateLimit(rateLimitKey, 30, 60 * 60 * 1000)

    if (!rateLimitCheck.allowed) {
      logger.warn('[webrtc] WebRTC session rate limit exceeded', { userId, rateLimitCheck });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many session requests. Try again in ${Math.ceil(rateLimitCheck.resetIn / 1000)}s.`,
            details: { rateLimitCheck }
          }
        },
        { status: 429 }
      )
    }

    // Get user's organization
    const memberRes = await pgClient.query(`SELECT organization_id, role FROM org_members WHERE user_id = $1 LIMIT 1`, [userId])
    const member = memberRes?.rows && memberRes.rows.length ? memberRes.rows[0] : null
    if (!member) {
      logger.error('[webrtc] Organization membership not found', { userId, member });
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found', details: { member } } },
        { status: 403 }
      )
    }

    // RBAC: Owner, Admin, Operator can use WebRTC
    if (!['owner', 'admin', 'operator'].includes(member.role)) {
      logger.error('[webrtc] Insufficient permissions', { userId, role: member.role });
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions', details: { role: member.role } } },
        { status: 403 }
      )
    }

    // Check feature flag
    const flagRes = await pgClient.query(`SELECT enabled FROM org_feature_flags WHERE organization_id = $1 AND feature = $2 LIMIT 1`, [member.organization_id, 'voice_operations'])
    const featureFlag = flagRes?.rows && flagRes.rows.length ? flagRes.rows[0] : null
    if (featureFlag?.enabled === false) {
      logger.error('[webrtc] Voice operations feature flag disabled', { userId, featureFlag });
      return NextResponse.json(
        { success: false, error: { code: 'FEATURE_DISABLED', message: 'Voice operations disabled', details: { featureFlag } } },
        { status: 403 }
      )
    }

    // Cleanup stale sessions
    const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const staleRes = await pgClient.query(`SELECT id, created_at FROM webrtc_sessions WHERE user_id = $1 AND status = ANY($2)`, [userId, ['initializing', 'connecting', 'connected', 'on_call']])
    const staleSessions = staleRes?.rows || []
    if (staleSessions && staleSessions.length > 0) {
      for (const staleSession of staleSessions) {
        const createdAt = new Date(staleSession.created_at)
        if (createdAt.toISOString() < ONE_HOUR_AGO) {
          await pgClient.query(`UPDATE webrtc_sessions SET status = $1 WHERE id = $2`, ['disconnected', staleSession.id])

          await pgClient.query(`INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [member.organization_id, userId, 'webrtc_session', staleSession.id, 'webrtc:session.auto_cleanup', 'system', 'webrtc-session-cleanup', new Date().toISOString()])
        }
      }
    }


    // Generate secure session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Create session record (let Supabase auto-generate UUID)
    const insertRes = await pgClient.query(`INSERT INTO webrtc_sessions (user_id, organization_id, session_token, status, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [userId, member.organization_id, sessionToken, 'initializing', new Date().toISOString()])
    const sessionRecord = insertRes?.rows && insertRes.rows.length ? insertRes.rows[0] : null
    if (!sessionRecord) {
      logger.error('[webrtc] Failed to create session', { insertError: true });
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Session creation failed', details: { insertError: true } } },
        { status: 500 }
      )
    }
    const sessionId = sessionRecord.id;


    // Get SIP credentials from environment
    const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME
    const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN
    const websocketUrl = process.env.SIGNALWIRE_WEBSOCKET_URL
    const sipPassword = process.env.SIGNALWIRE_SIP_PASSWORD

    if (!sipUsername || !sipDomain || !websocketUrl || !sipPassword) {
      logger.error('[webrtc] SIP credentials not configured', { sipUsername, sipDomain, websocketUrl, sipPassword });
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'WebRTC not configured', details: { sipUsername, sipDomain, websocketUrl, sipPassword } } },
        { status: 500 }
      )
    }

    // Audit log
    await pgClient.query(`INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [member.organization_id, userId, 'webrtc_session', sessionId, 'webrtc:session.created', 'human', userId, { session_id: sessionId, sip_username: sipUsername }, new Date().toISOString()])

    logger.info('[webrtc] SIP session created', { sessionId, userId })

    // Return SIP configuration

    return NextResponse.json({
      success: true,
      session: {
        id: sessionId,
        token: sessionToken,
        sip_username: sipUsername,
        sip_password: sipPassword,
        sip_domain: sipDomain,
        websocket_url: websocketUrl,
        // ICE servers for peer connection
        ice_servers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    })

  } catch (err: any) {
    logger.error('[webrtc] Session creation error', { error: err, stack: err?.stack });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Internal error', details: { error: String(err), stack: err?.stack } } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webrtc/session
 * Get current WebRTC session status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ success: false, session: null })
    }

    const res = await pgClient.query(`SELECT * FROM webrtc_sessions WHERE user_id = $1 AND status = ANY($2) ORDER BY created_at DESC LIMIT 1`, [userId, ['initializing', 'connecting', 'connected', 'on_call']])
    const sessionData = res?.rows && res.rows.length ? res.rows[0] : null
    return NextResponse.json({ success: true, session: sessionData || null })
  } catch (err) {
    return NextResponse.json({ success: false, session: null })
  }
}

/**
 * DELETE /api/webrtc/session
 * End WebRTC session
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ success: true })
    }

    await pgClient.query(`UPDATE webrtc_sessions SET status = $1, updated_at = $2 WHERE user_id = $3 AND status = ANY($4)`, ['disconnected', new Date().toISOString(), userId, ['initializing', 'connecting', 'connected', 'on_call']])

    logger.info('[webrtc] Session disconnected', { userId })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[webrtc] Session disconnect error', err)
    return NextResponse.json({ success: true }) // Always succeed for cleanup
  }
}
