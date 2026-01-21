import { NextResponse, NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitKey = `webrtc:session:${userId}`
    const rateLimitCheck = await checkRateLimit(rateLimitKey, 30, 60 * 60 * 1000)

    if (!rateLimitCheck.allowed) {
      logger.warn('WebRTC session rate limit exceeded', { userId })
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many session requests. Try again in ${Math.ceil(rateLimitCheck.resetIn / 1000)}s.`
          }
        },
        { status: 429 }
      )
    }

    // Get user's organization
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }

    // RBAC: Owner, Admin, Operator can use WebRTC
    if (!['owner', 'admin', 'operator'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' } },
        { status: 403 }
      )
    }

    // Check feature flag
    const { data: featureFlag } = await supabaseAdmin
      .from('org_feature_flags')
      .select('enabled')
      .eq('organization_id', member.organization_id)
      .eq('feature', 'voice_operations')
      .single()

    if (featureFlag?.enabled === false) {
      return NextResponse.json(
        { success: false, error: { code: 'FEATURE_DISABLED', message: 'Voice operations disabled' } },
        { status: 403 }
      )
    }

    // Cleanup stale sessions
    const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: staleSessions } = await supabaseAdmin
      .from('webrtc_sessions')
      .select('id, created_at')
      .eq('user_id', userId)
      .in('status', ['initializing', 'connecting', 'connected', 'on_call'])

    if (staleSessions && staleSessions.length > 0) {
      for (const staleSession of staleSessions) {
        const createdAt = new Date(staleSession.created_at)
        if (createdAt.toISOString() < ONE_HOUR_AGO) {
          await supabaseAdmin
            .from('webrtc_sessions')
            .update({ status: 'disconnected' })
            .eq('id', staleSession.id)

          await supabaseAdmin.from('audit_logs').insert({
            organization_id: member.organization_id,
            user_id: userId,
            resource_type: 'webrtc_session',
            resource_id: staleSession.id,
            action: 'webrtc:session.auto_cleanup',
            actor_type: 'system',
            actor_label: 'webrtc-session-cleanup'
          })
        }
      }
    }

    // Generate session ID (must be UUID format for database)
    const { v4: uuidv4 } = await import('uuid')
    const sessionId = uuidv4()

    const sessionToken = uuidv4()

    // Create session record
    const { data: sessionRecord, error: insertError } = await supabaseAdmin
      .from('webrtc_sessions')
      .insert({
        id: sessionId,
        organization_id: member.organization_id,
        user_id: userId,
        session_token: sessionToken,
        status: 'initializing',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      logger.error('[webrtc] Failed to create session', insertError)
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Session creation failed' } },
        { status: 500 }
      )
    }

    // Get SIP credentials from environment
    const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME
    const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN
    const websocketUrl = process.env.SIGNALWIRE_WEBSOCKET_URL

    if (!sipUsername || !sipDomain || !websocketUrl) {
      logger.error('[webrtc] SIP credentials not configured', undefined, {
        hasSipUsername: !!sipUsername,
        hasSipDomain: !!sipDomain,
        hasWebsocketUrl: !!websocketUrl
      })
      return NextResponse.json(
        { success: false, error: { code: 'CONFIG_ERROR', message: 'WebRTC not configured' } },
        { status: 500 }
      )
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      organization_id: member.organization_id,
      user_id: userId,
      resource_type: 'webrtc_session',
      resource_id: sessionId,
      action: 'webrtc:session.created',
      actor_type: 'human',
      actor_label: userId,
      after: { session_id: sessionId, sip_username: sipUsername }
    })

    logger.info('[webrtc] SIP session created', { sessionId, userId })

    // Return SIP configuration
    return NextResponse.json({
      success: true,
      session: {
        id: sessionId,
        sip_username: sipUsername,
        sip_password: process.env.SIGNALWIRE_SIP_PASSWORD, // Required for SIP.js registration
        sip_domain: sipDomain,
        websocket_url: websocketUrl,
        // ICE servers for peer connection
        ice_servers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    })

  } catch (err) {
    logger.error('[webrtc] Session creation error', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } },
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

    const { data } = await supabaseAdmin
      .from('webrtc_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['initializing', 'connecting', 'connected', 'on_call'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({ success: true, session: data || null })
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

    await supabaseAdmin
      .from('webrtc_sessions')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('status', ['initializing', 'connecting', 'connected', 'on_call'])

    logger.info('[webrtc] Session disconnected', { userId })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[webrtc] Session disconnect error', err)
    return NextResponse.json({ success: true }) // Always succeed for cleanup
  }
}
