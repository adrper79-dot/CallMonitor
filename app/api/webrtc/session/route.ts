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
 * Get SignalWire WebRTC token
 * 
 * Creates a JWT token for browser-based WebRTC calls.
 * Uses SignalWire Relay REST API for token generation.
 * 
 * @see https://developer.signalwire.com/sdks/reference/browser-sdk/
 */
async function getSignalWireWebRTCToken(sessionId: string): Promise<{
  token: string
  iceServers: RTCIceServer[]
} | null> {
  if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_TOKEN || !SIGNALWIRE_SPACE) {
    console.error('[webrtc] SignalWire credentials not configured')
    return null
  }
  
  const authHeader = `Basic ${Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_TOKEN}`).toString('base64')}`
  
  try {
    // Try Relay REST JWT endpoint first (for Relay SDK v3)
    const jwtResponse = await fetch(
      `https://${SIGNALWIRE_SPACE}/api/relay/rest/jwt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          resource: sessionId,
          expires_in: 3600  // 1 hour
        })
      }
    )
    
    if (jwtResponse.ok) {
      const data = await jwtResponse.json()
      console.log('[webrtc] Got SignalWire JWT token')
      
      return {
        token: data.jwt_token,
        iceServers: [
          // SignalWire STUN/TURN servers
          { urls: `stun:${SIGNALWIRE_SPACE}:3478` },
          // Google STUN as fallback
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          // Include any SignalWire-provided ICE servers
          ...(data.ice_servers || [])
        ]
      }
    }
    
    // Log the error but continue - we can still return a session without pre-fetched token
    const errorText = await jwtResponse.text()
    console.warn('[webrtc] SignalWire JWT endpoint returned non-OK:', jwtResponse.status, errorText)
    
    // Return null token but provide ICE servers for fallback WebRTC
    // The client can authenticate directly with project/token
    return {
      token: '', // Empty - client will use project credentials directly
      iceServers: [
        { urls: `stun:${SIGNALWIRE_SPACE}:3478` },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    }
  } catch (error) {
    console.error('[webrtc] Error getting SignalWire token:', error)
    // Return fallback ICE servers even if token fails
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
    
    // Check for existing active session
    const { data: existingSession } = await supabaseAdmin
      .from('webrtc_sessions')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['initializing', 'connecting', 'connected', 'on_call'])
      .single()
    
    if (existingSession) {
      return NextResponse.json(
        { success: false, error: { code: 'SESSION_EXISTS', message: 'Active WebRTC session already exists. End it first.' } },
        { status: 409 }
      )
    }
    
    // Generate session token
    const sessionToken = generateSessionToken()
    const sessionId = crypto.randomUUID()
    
    // Get SignalWire credentials
    const signalWireCredentials = await getSignalWireWebRTCToken(sessionId)
    
    // Get user agent from request
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0] || 'unknown'
    
    // Create session record (direct DB write acceptable for session management)
    const { data: newSession, error: insertError } = await supabaseAdmin
      .from('webrtc_sessions')
      .insert({
        id: sessionId,
        organization_id: member.organization_id,
        user_id: userId,
        session_token: sessionToken,
        status: 'initializing',
        ice_servers: signalWireCredentials?.iceServers || null,
        user_agent: userAgent,
        ip_address: ipAddress
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
        signalwire_space: SIGNALWIRE_SPACE,
        signalwire_token: signalWireCredentials?.token || null
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error('[webrtc POST] Error:', error)
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
    
    return NextResponse.json({
      success: true,
      session: {
        id: webrtcSession.id,
        status: webrtcSession.status,
        call_id: webrtcSession.call_id,
        created_at: webrtcSession.created_at,
        connected_at: webrtcSession.connected_at,
        quality: webrtcSession.audio_bitrate ? {
          audio_bitrate: webrtcSession.audio_bitrate,
          packet_loss_percent: webrtcSession.packet_loss_percent,
          jitter_ms: webrtcSession.jitter_ms,
          round_trip_time_ms: webrtcSession.round_trip_time_ms
        } : null
      }
    })
  } catch (error: any) {
    console.error('[webrtc GET] Error:', error)
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
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from('webrtc_sessions')
      .update({
        status: 'disconnected',
        disconnected_at: new Date().toISOString()
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
    console.error('[webrtc DELETE] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
