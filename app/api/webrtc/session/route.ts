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
 * This creates a temporary token for the browser to connect
 */
async function getSignalWireWebRTCToken(sessionId: string): Promise<{
  token: string
  iceServers: RTCIceServer[]
} | null> {
  if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_TOKEN || !SIGNALWIRE_SPACE) {
    console.error('[webrtc] SignalWire credentials not configured')
    return null
  }
  
  try {
    // Create a SignalWire WebRTC resource
    // Note: This is a simplified example - actual implementation depends on SignalWire API
    const response = await fetch(
      `https://${SIGNALWIRE_SPACE}/api/relay/rest/jwt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_TOKEN}`).toString('base64')}`
        },
        body: JSON.stringify({
          resource: sessionId,
          expires_in: 3600  // 1 hour
        })
      }
    )
    
    if (!response.ok) {
      console.error('[webrtc] SignalWire token request failed:', await response.text())
      return null
    }
    
    const data = await response.json()
    
    return {
      token: data.jwt_token,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // SignalWire TURN servers if provided
        ...(data.ice_servers || [])
      ]
    }
  } catch (error) {
    console.error('[webrtc] Error getting SignalWire token:', error)
    return null
  }
}

/**
 * POST /api/webrtc/session
 * Create a new WebRTC session for browser calling
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
    
    // Create session record
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
      console.error('[webrtc POST] Insert error:', insertError)
      return NextResponse.json(
        { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create WebRTC session' } },
        { status: 500 }
      )
    }
    
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
      console.error('[webrtc DELETE] Update error:', updateError)
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to end session' } },
        { status: 500 }
      )
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
