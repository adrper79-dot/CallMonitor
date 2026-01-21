/**
 * WebRTC Session API
 * 
 * POST /api/webrtc/session - Create a new WebRTC session for browser calling
 * GET /api/webrtc/session - Get current session status
 * DELETE /api/webrtc/session - End WebRTC session
 * 
 * Per MASTER_ARCHITECTURE: SignalWire-first execution
 * WebRTC enables browser-based calling without phone
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import crypto from 'crypto'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// SignalWire credentials
const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID
const SIGNALWIRE_TOKEN = process.env.SIGNALWIRE_TOKEN
const SIGNALWIRE_SPACE = process.env.SIGNALWIRE_SPACE

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  return `wrtc_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * Normalize SIGNALWIRE_SPACE to get the correct domain
 */
function getSignalWireDomain(): string | null {
  if (!SIGNALWIRE_SPACE) return null

  const rawSpace = String(SIGNALWIRE_SPACE)
  const spaceName = rawSpace
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/\.signalwire\.com$/i, '')
    .trim()
  return `${spaceName}.signalwire.com`
}

/**
 * Get SignalWire WebRTC token
 * 
 * Creates a Subscriber Access Token (SAT) for browser-based WebRTC calls.
 * Uses SignalWire Fabric API for token generation.
 * 
 * @see https://developer.signalwire.com/sdks/reference/browser-sdk/
 */
async function getSignalWireWebRTCToken(sessionId: string, userId: string): Promise<{
  token?: string
  iceServers?: RTCIceServer[]
  error?: string
} | null> {
  if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_TOKEN || !SIGNALWIRE_SPACE) {
    logger.error('[webrtc] SignalWire credentials not configured', null)
    return null
  }

  const signalwireDomain = getSignalWireDomain()
  if (!signalwireDomain) return null

  const authHeader = `Basic ${Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_TOKEN}`).toString('base64')}`

  try {
    // Use the Fabric Subscriber Access Token (SAT) endpoint
    const satResponse = await fetch(
      `https://${signalwireDomain}/api/fabric/subscribers/tokens`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          reference: userId, // CRITICAL: Use userId to map 1 User = 1 Subscriber for billing
          expires_in: 3600
        })
      }
    )

    if (satResponse.ok) {
      const data = await satResponse.json()

      // DEBUG: Log what SignalWire actually returns for ICE servers
      logger.info('[webrtc] SAT token response', {
        hasToken: !!data.token,
        hasIceServers: !!data.ice_servers,
        iceServerCount: data.ice_servers?.length || 0,
        iceServers: data.ice_servers
      })

      // Build ICE servers with fallback TURN servers
      const iceServers: RTCIceServer[] = [
        // SignalWire STUN
        { urls: `stun:${signalwireDomain}:3478` },
        // Google STUN servers (public, reliable)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]

      // Add SignalWire's ICE servers if provided
      if (data.ice_servers && Array.isArray(data.ice_servers) && data.ice_servers.length > 0) {
        iceServers.push(...data.ice_servers)
        logger.info('[webrtc] Using SignalWire ICE servers', { count: data.ice_servers.length })
      } else {
        // CRITICAL: If SignalWire doesn't provide TURN servers, add public fallback
        // This is necessary for ICE gathering to complete through firewalls/NAT
        logger.warn('[webrtc] No ICE servers from SignalWire, adding public TURN fallback')
        // @ts-ignore - RTCIceServer type doesn't include username/credential but they're valid
        iceServers.push({
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        })
      }

      return {
        token: data.token,
        iceServers
      }
    }

    // Check for specific errors
    const errorText = await satResponse.text()
    let errorJson: any = {}
    try { errorJson = JSON.parse(errorText) } catch (e) { }

    // Check for insufficient balance
    if (errorJson?.errors?.some((e: any) => e.code === 'insufficient_balance') || errorText.includes('insufficient_balance')) {
      logger.warn('[webrtc] SignalWire insufficient balance', { organization_id: 'system' })
      return { error: 'INSUFFICIENT_FUNDS' }
    }

    logger.warn('[webrtc] SignalWire Fabric SAT endpoint returned non-OK', { status: satResponse.status, errorText })

    // Fallback: Try legacy Relay JWT endpoint (for older SignalWire accounts)
    const jwtResponse = await fetch(
      `https://${signalwireDomain}/api/relay/rest/jwt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          resource: sessionId,
          expires_in: 3600
        })
      }
    )

    if (jwtResponse.ok) {
      const data = await jwtResponse.json()
      logger.info('[webrtc] Got SignalWire JWT token from legacy Relay endpoint')
      return {
        token: data.jwt_token,
        iceServers: [
          { urls: `stun:${signalwireDomain}:3478` },
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      }
    }

    logger.warn('[webrtc] Both SAT and JWT endpoints failed')

    return {
      token: '',
      iceServers: [
        { urls: `stun:${signalwireDomain}:3478` },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    }
  } catch (error) {
    logger.error('[webrtc] Error getting SignalWire token', error)
    return {
      token: '',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    }
  }
}

/**
 * POST /api/webrtc/session
 * Create a new WebRTC session for browser calling
 * 
 * ARCHITECTURE COMPLIANCE:
 * - Rate limited (30 sessions/hour per user)
 * - Audit logged (session creation)
 * - Source attribution (source='webrtc')
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

    // Rate limiting (30 sessions per hour per user - prevents abuse)
    const rateLimitKey = `webrtc:session:${userId}`
    const rateLimitCheck = await checkRateLimit(rateLimitKey, 30, 60 * 60 * 1000) // 30/hour

    if (!rateLimitCheck.allowed) {
      logger.warn('WebRTC session rate limit exceeded', { userId, remaining: rateLimitCheck.remaining })

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many session requests. Please try again in ${Math.ceil(rateLimitCheck.resetIn / 1000)}s.`
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

    // Check RBAC: Owner, Admin, Operator can use WebRTC
    if (!['owner', 'admin', 'operator'].includes(member.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions for WebRTC calling' } },
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
        { success: false, error: { code: 'FEATURE_DISABLED', message: 'Voice operations are disabled' } },
        { status: 403 }
      )
    }

    // Check for and auto-cleanup stale sessions
    // Per ARCH_DOCS: Sessions stuck in 'initializing' for >5 min or any active session >1 hour old should be cleaned up
    const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    // Find stale sessions to clean up
    const { data: staleSessions } = await supabaseAdmin
      .from('webrtc_sessions')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .in('status', ['initializing', 'connecting', 'connected', 'on_call'])

    if (staleSessions && staleSessions.length > 0) {
      for (const session of staleSessions) {
        const createdAt = new Date(session.created_at).toISOString()
        const isStale = createdAt < ONE_HOUR_AGO ||
          (session.status === 'initializing' && createdAt < FIVE_MIN_AGO)

        if (isStale) {
          // Auto-cleanup stale session with audit logging per ARCH_DOCS
          const { error: cleanupError } = await supabaseAdmin
            .from('webrtc_sessions')
            .update({ status: 'disconnected', updated_at: new Date().toISOString() })
            .eq('id', session.id)

          if (!cleanupError) {
            // ARCH_DOCS compliant audit log with source='webrtc' and before/after state
            await supabaseAdmin.from('audit_logs').insert({
              organization_id: member.organization_id,
              user_id: userId,
              resource_type: 'webrtc_session',
              resource_id: session.id,
              action: 'webrtc:session.auto_cleanup',
              actor_type: 'system',
              actor_label: 'webrtc-session-cleanup',
              before: { status: session.status, source: 'webrtc' },
              after: { status: 'disconnected', source: 'webrtc', reason: 'stale_session_cleanup' },
              created_at: new Date().toISOString()
            })

            logger.info('WebRTC stale session auto-cleaned', {
              session_id: session.id,
              user_id: userId,
              old_status: session.status,
              source: 'webrtc',
              age_minutes: Math.round((Date.now() - new Date(session.created_at).getTime()) / 60000)
            })
          }
        } else {
          // Session is not stale - return conflict
          return NextResponse.json(
            { success: false, error: { code: 'SESSION_EXISTS', message: 'Active WebRTC session already exists. End it first or wait for it to expire.' } },
            { status: 409 }
          )
        }
      }
    }

    // Generate session token
    const sessionToken = generateSessionToken()
    const sessionId = crypto.randomUUID()

    // Get SignalWire credentials
    const signalWireCredentials = await getSignalWireWebRTCToken(sessionId, userId)

    if (signalWireCredentials?.error === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_FUNDS', message: 'SignalWire account has insufficient balance. Please add funds to your SignalWire account.' } },
        { status: 402 }
      )
    }

    // Get user agent from request (for logging only - not stored in DB)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0] || 'unknown'

    // Create session record - only columns that exist in production schema
    // Schema: id, organization_id, user_id, session_token, status, created_at
    const { data: newSession, error: insertError } = await supabaseAdmin
      .from('webrtc_sessions')
      .insert({
        id: sessionId,
        organization_id: member.organization_id,
        user_id: userId,
        session_token: sessionToken,
        status: 'initializing'
      })
      .select()
      .single()

    if (insertError) {
      logger.error('WebRTC session creation failed', insertError, { userId, sessionId })
      return NextResponse.json(
        { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create WebRTC session' } },
        { status: 500 }
      )
    }

    // CORRECT: Audit log for WebRTC session creation
    await supabaseAdmin.from('audit_logs').insert({
      organization_id: member.organization_id,
      user_id: userId,
      resource_type: 'webrtc_session',
      resource_id: sessionId,
      action: 'webrtc:session.create',
      actor_type: 'human',
      actor_label: userId,
      after: {
        session_id: sessionId,
        status: 'initializing',
        source: 'webrtc',
        user_agent: userAgent,
        ip_address: ipAddress
      },
      created_at: new Date().toISOString()
    })

    logger.info('WebRTC session created', {
      session_id: sessionId,
      user_id: userId,
      organization_id: member.organization_id,
      source: 'webrtc'
    })

    return NextResponse.json({
      success: true,
      session: {
        id: newSession.id,
        token: sessionToken,
        ice_servers: signalWireCredentials?.iceServers || [],
        signalwire_project: SIGNALWIRE_PROJECT_ID,
        signalwire_space: getSignalWireDomain(),
        signalwire_token: signalWireCredentials?.token || null,
        signalwire_number: process.env.SIGNALWIRE_NUMBER || null
      }
    }, { status: 201 })
  } catch (error: any) {
    logger.error('[webrtc POST] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
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
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Get active session
    const { data: webrtcSession } = await supabaseAdmin
      .from('webrtc_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['initializing', 'connecting', 'connected', 'on_call'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!webrtcSession) {
      return NextResponse.json({
        success: true,
        session: null
      })
    }

    // Return only columns that exist in production schema:
    // id, organization_id, user_id, session_token, status, created_at
    return NextResponse.json({
      success: true,
      session: {
        id: webrtcSession.id,
        session_token: webrtcSession.session_token,
        status: webrtcSession.status,
        created_at: webrtcSession.created_at
        // NOTE: call_id, connected_at, audio_bitrate, packet_loss_percent, 
        // jitter_ms, round_trip_time_ms are NOT in production schema
      }
    })
  } catch (error: any) {
    logger.error('[webrtc GET] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/webrtc/session
 * End WebRTC session
 * 
 * ARCHITECTURE COMPLIANCE:
 * - Audit logged (session termination)
 */
export async function DELETE(request: NextRequest) {
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

    // Get organization for audit logging
    const { data: member } = await supabaseAdmin
      .from('org_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single()

    // Find and update active session
    // NOTE: disconnected_at is NOT in production schema - only update status
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('webrtc_sessions')
      .update({
        status: 'disconnected'
      })
      .eq('user_id', userId)
      .in('status', ['initializing', 'connecting', 'connected', 'on_call'])
      .select()
      .single()

    if (updateError && updateError.code !== 'PGRST116') {
      // Ignore "no rows returned" error
      logger.error('WebRTC session disconnect failed', updateError, { userId })
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to end session' } },
        { status: 500 }
      )
    }

    // CORRECT: Audit log for WebRTC session termination
    if (updatedSession && member?.organization_id) {
      await supabaseAdmin.from('audit_logs').insert({
        organization_id: member.organization_id,
        user_id: userId,
        resource_type: 'webrtc_session',
        resource_id: updatedSession.id,
        action: 'webrtc:session.disconnect',
        actor_type: 'human',
        actor_label: userId,
        before: { status: 'connected' },
        after: { status: 'disconnected', source: 'webrtc' },
        created_at: new Date().toISOString()
      })

      logger.info('WebRTC session disconnected', {
        session_id: updatedSession.id,
        user_id: userId,
        source: 'webrtc'
      })
    }

    return NextResponse.json({
      success: true,
      message: updatedSession ? 'Session ended' : 'No active session'
    })
  } catch (error: any) {
    logger.error('[webrtc DELETE] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
