/**
 * WebRPC API
 * 
 * POST /api/webrpc - Execute real-time procedure calls
 * 
 * Per MASTER_ARCHITECTURE: UI never orchestrates
 * WebRPC provides a clean interface for real-time call control
 * 
 * Methods:
 * - call.place - Place a call
 * - call.hangup - Hang up current call
 * - call.mute - Mute microphone
 * - call.unmute - Unmute microphone
 * - call.hold - Put call on hold
 * - call.resume - Resume held call
 * - call.dtmf - Send DTMF tones
 * - session.ping - Heartbeat
 * - session.end - End session
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { WebRPCMethod, WebRPCRequest, WebRPCResponse } from '@/types/tier1-features'
import { emitCallStarted, emitCallCompleted } from '@/lib/webhookDelivery'

export const dynamic = 'force-dynamic'

// Valid WebRPC methods
const VALID_METHODS: WebRPCMethod[] = [
  'call.place',
  'call.hangup',
  'call.mute',
  'call.unmute',
  'call.hold',
  'call.resume',
  'call.transfer',
  'call.dtmf',
  'session.ping',
  'session.end'
]

// SignalWire credentials
const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID
const SIGNALWIRE_TOKEN = process.env.SIGNALWIRE_TOKEN
const SIGNALWIRE_SPACE = process.env.SIGNALWIRE_SPACE

/**
 * Make SignalWire API call
 */
async function signalWireRequest(
  endpoint: string,
  method: string = 'POST',
  body?: Record<string, unknown>
): Promise<Response> {
  const url = `https://${SIGNALWIRE_SPACE}/api/laml/2010-04-01/Accounts/${SIGNALWIRE_PROJECT_ID}${endpoint}`
  
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_TOKEN}`).toString('base64')}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
}

/**
 * Handle call.place
 */
async function handleCallPlace(
  params: Record<string, unknown>,
  userId: string,
  organizationId: string,
  sessionId: string
): Promise<WebRPCResponse['result'] | WebRPCResponse['error']> {
  const { to_number, from_number, modulations } = params
  
  if (!to_number || typeof to_number !== 'string') {
    return { code: 'INVALID_PARAMS', message: 'to_number is required' }
  }
  
  // Validate phone number format (E.164)
  if (!/^\+[1-9]\d{1,14}$/.test(to_number)) {
    return { code: 'INVALID_PHONE', message: 'Phone number must be in E.164 format' }
  }
  
  // Get organization's default from number
  const { data: orgConfig } = await supabaseAdmin
    .from('voice_configs')
    .select('*')
    .eq('organization_id', organizationId)
    .single()
  
  // Create call record
  const callId = crypto.randomUUID()
  const { error: callError } = await supabaseAdmin
    .from('calls')
    .insert({
      id: callId,
      organization_id: organizationId,
      status: 'pending',
      created_by: userId,
      started_at: new Date().toISOString()
    })
  
  if (callError) {
    return { code: 'CALL_CREATE_FAILED', message: 'Failed to create call record' }
  }
  
  // Update WebRTC session with call ID
  await supabaseAdmin
    .from('webrtc_sessions')
    .update({
      call_id: callId,
      status: 'on_call'
    })
    .eq('id', sessionId)
  
  // Emit webhook event
  await emitCallStarted({
    id: callId,
    organization_id: organizationId,
    phone_to: to_number,
    phone_from: from_number as string | undefined,
    status: 'pending'
  })
  
  return {
    call_id: callId,
    status: 'initiating',
    to_number,
    from_number
  }
}

/**
 * Handle call.hangup
 */
async function handleCallHangup(
  params: Record<string, unknown>,
  userId: string,
  sessionId: string
): Promise<WebRPCResponse['result'] | WebRPCResponse['error']> {
  // Get current call from session
  const { data: session } = await supabaseAdmin
    .from('webrtc_sessions')
    .select('call_id, organization_id')
    .eq('id', sessionId)
    .single()
  
  if (!session?.call_id) {
    return { code: 'NO_ACTIVE_CALL', message: 'No active call to hang up' }
  }
  
  // Update call status
  const { error: updateError } = await supabaseAdmin
    .from('calls')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString()
    })
    .eq('id', session.call_id)
  
  if (updateError) {
    return { code: 'UPDATE_FAILED', message: 'Failed to update call status' }
  }
  
  // Update session
  await supabaseAdmin
    .from('webrtc_sessions')
    .update({
      call_id: null,
      status: 'connected'
    })
    .eq('id', sessionId)
  
  // Emit webhook event
  await emitCallCompleted({
    id: session.call_id,
    organization_id: session.organization_id,
    status: 'completed'
  })
  
  return {
    call_id: session.call_id,
    status: 'completed'
  }
}

/**
 * Handle call.mute / call.unmute
 */
async function handleCallMute(
  mute: boolean,
  sessionId: string
): Promise<WebRPCResponse['result'] | WebRPCResponse['error']> {
  // In a real implementation, this would send a command to SignalWire
  // For now, we just acknowledge the request
  return {
    muted: mute,
    message: mute ? 'Microphone muted' : 'Microphone unmuted'
  }
}

/**
 * Handle call.dtmf
 */
async function handleCallDtmf(
  params: Record<string, unknown>,
  sessionId: string
): Promise<WebRPCResponse['result'] | WebRPCResponse['error']> {
  const { digits } = params
  
  if (!digits || typeof digits !== 'string' || !/^[0-9*#]+$/.test(digits)) {
    return { code: 'INVALID_DTMF', message: 'Invalid DTMF digits' }
  }
  
  // In a real implementation, this would send DTMF via SignalWire
  return {
    digits,
    sent: true
  }
}

/**
 * Handle session.ping
 */
async function handleSessionPing(
  sessionId: string
): Promise<WebRPCResponse['result']> {
  // Update session last activity
  await supabaseAdmin
    .from('webrtc_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  
  return {
    pong: true,
    timestamp: new Date().toISOString()
  }
}

/**
 * POST /api/webrpc
 * Execute WebRPC method
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    
    if (!userId) {
      return NextResponse.json({
        id: 'unknown',
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
      } as WebRPCResponse, { status: 401 })
    }
    
    // Parse request
    const body = await request.json() as WebRPCRequest
    const { id, method, params = {} } = body
    
    // Validate request ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json({
        id: 'unknown',
        error: { code: 'INVALID_REQUEST', message: 'Request ID is required' }
      } as WebRPCResponse, { status: 400 })
    }
    
    // Validate method
    if (!method || !VALID_METHODS.includes(method)) {
      return NextResponse.json({
        id,
        error: { code: 'INVALID_METHOD', message: `Invalid method. Must be one of: ${VALID_METHODS.join(', ')}` }
      } as WebRPCResponse, { status: 400 })
    }
    
    // Get user's active WebRTC session
    const { data: webrtcSession } = await supabaseAdmin
      .from('webrtc_sessions')
      .select('id, organization_id, status, call_id')
      .eq('user_id', userId)
      .in('status', ['initializing', 'connecting', 'connected', 'on_call'])
      .single()
    
    if (!webrtcSession && method !== 'session.end') {
      return NextResponse.json({
        id,
        error: { code: 'NO_SESSION', message: 'No active WebRTC session. Create one first.' }
      } as WebRPCResponse, { status: 400 })
    }
    
    // Execute method
    let result: WebRPCResponse['result'] | WebRPCResponse['error']
    
    switch (method) {
      case 'call.place':
        result = await handleCallPlace(params, userId, webrtcSession!.organization_id, webrtcSession!.id)
        break
      
      case 'call.hangup':
        result = await handleCallHangup(params, userId, webrtcSession!.id)
        break
      
      case 'call.mute':
        result = await handleCallMute(true, webrtcSession!.id)
        break
      
      case 'call.unmute':
        result = await handleCallMute(false, webrtcSession!.id)
        break
      
      case 'call.hold':
        result = { held: true, message: 'Call on hold' }
        break
      
      case 'call.resume':
        result = { held: false, message: 'Call resumed' }
        break
      
      case 'call.transfer':
        result = { code: 'NOT_IMPLEMENTED', message: 'Transfer not yet implemented' }
        break
      
      case 'call.dtmf':
        result = await handleCallDtmf(params, webrtcSession!.id)
        break
      
      case 'session.ping':
        result = await handleSessionPing(webrtcSession!.id)
        break
      
      case 'session.end':
        if (webrtcSession) {
          await supabaseAdmin
            .from('webrtc_sessions')
            .update({
              status: 'disconnected',
              disconnected_at: new Date().toISOString()
            })
            .eq('id', webrtcSession.id)
        }
        result = { ended: true }
        break
      
      default:
        result = { code: 'UNKNOWN_METHOD', message: 'Unknown method' }
    }
    
    // Check if result is an error
    if (result && 'code' in result && typeof result.code === 'string') {
      return NextResponse.json({
        id,
        error: result
      } as WebRPCResponse, { status: 400 })
    }
    
    return NextResponse.json({
      id,
      result
    } as WebRPCResponse)
  } catch (error: any) {
    console.error('[webrpc POST] Error:', error)
    return NextResponse.json({
      id: 'unknown',
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    } as WebRPCResponse, { status: 500 })
  }
}
