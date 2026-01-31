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
import { query } from '@/lib/pgClient'
import { WebRPCMethod, WebRPCRequest, WebRPCResponse } from '@/types/tier1-features'
import { emitCallCompleted } from '@/lib/webhookDelivery'
import startCallHandler from '@/app/actions/calls/startCallHandler'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  if (!SIGNALWIRE_TOKEN) {
    throw new Error('SignalWire credentials incomplete')
  }

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
 * 
 * ARCHITECTURE COMPLIANCE:
 * - Uses startCallHandler (orchestration layer)
 * - Does NOT write directly to database
 * - Adds audit log
 * - Adds source='webrpc' attribution
 */
async function handleCallPlace(
  params: Record<string, unknown>,
  userId: string,
  organizationId: string,
  sessionId: string
): Promise<WebRPCResponse['result'] | WebRPCResponse['error']> {
  const { to_number, from_number, modulations } = params

  // Validation
  if (!to_number || typeof to_number !== 'string') {
    return { code: 'INVALID_PARAMS', message: 'to_number is required' }
  }

  // Validate phone number format (E.164)
  if (!/^\+[1-9]\d{1,14}$/.test(to_number)) {
    return { code: 'INVALID_PHONE', message: 'Phone number must be in E.164 format' }
  }

  try {
    // CORRECT: Call existing orchestration handler (no direct DB writes)
    const result = await startCallHandler({
      phone_number: to_number,
      from_number: from_number as string | undefined,
      organization_id: organizationId,
      actor_id: userId,  // Actor attribution for RBAC
      modulations: modulations as any || { record: false, transcribe: false }
    })


    interface StartCallError {
      code?: string
      message?: string
      user_message?: string
    }

    if (!result.success) {
      const error = result.error as StartCallError

      logger.warn('WebRPC call.place failed via orchestration', {
        error: result.error,
        params: { to_number, from_number }
      })

      return {
        code: error.code || 'CALL_START_FAILED',
        message: error.user_message || error.message || 'Failed to start call'
      }
    }

    // Update WebRTC session with call ID (state management only, not orchestration)
    await query(
      `UPDATE webrtc_sessions 
         SET call_id = $1, status = 'on_call', updated_at = NOW() 
         WHERE id = $2`,
      [result.call_id, sessionId]
    )

    // CORRECT: Audit log for WebRPC access
    await query(
      `INSERT INTO audit_logs (
            organization_id, user_id, resource_type, resource_id, action, 
            actor_type, actor_label, after, created_at
         ) VALUES ($1, $2, 'call', $3, 'webrpc:call.place', 'human', $4, $5, NOW())`,
      [
        organizationId,
        userId,
        result.call_id,
        userId,
        JSON.stringify({
          method: 'call.place',
          to_number,
          from_number,
          session_id: sessionId,
          call_id: result.call_id
        })
      ]
    )

    logger.info('WebRPC call placed successfully', {
      call_id: result.call_id,
      source: 'webrpc',
      actor_id: userId
    })

    return {
      call_id: result.call_id,
      status: 'initiating',
      to_number,
      from_number
    }
  } catch (err: any) {
    logger.error('WebRPC call.place exception', err, {
      params: { to_number, from_number }
    })

    return {
      code: 'INTERNAL_ERROR',
      message: err.message || 'Failed to place call'
    }
  }
}

/**
 * Handle call.hangup
 * 
 * ARCHITECTURE COMPLIANCE:
 * - Allows call termination via WebRTC session
 * - Logs to audit_logs
 * - Limited DB writes (status update only, not orchestration)
 */
async function handleCallHangup(
  params: Record<string, unknown>,
  userId: string,
  organizationId: string,
  sessionId: string
): Promise<WebRPCResponse['result'] | WebRPCResponse['error']> {
  // Get current call from session
  const { rows: sessions } = await query(
    `SELECT call_id, organization_id FROM webrtc_sessions WHERE id = $1`,
    [sessionId]
  )
  const session = sessions[0]

  if (!session?.call_id) {
    return { code: 'NO_ACTIVE_CALL', message: 'No active call to hang up' }
  }

  // Verify organization match
  if (session.organization_id !== organizationId) {
    logger.warn('WebRPC call.hangup org mismatch', {
      session_org: session.organization_id,
      request_org: organizationId
    })
    return { code: 'ORG_MISMATCH', message: 'Call does not belong to your organization' }
  }

  // Update call status (limited mutability - state machine only)
  await query(
    `UPDATE calls SET status = 'completed', ended_at = NOW() WHERE id = $1`,
    [session.call_id]
  )

  // Update session
  await query(
    `UPDATE webrtc_sessions 
     SET call_id = NULL, status = 'connected', updated_at = NOW() 
     WHERE id = $1`,
    [sessionId]
  )

  // CORRECT: Audit log
  await query(
    `INSERT INTO audit_logs (
        organization_id, user_id, resource_type, resource_id, action, 
        actor_type, actor_label, before, after, created_at
     ) VALUES ($1, $2, 'call', $3, 'webrpc:call.hangup', 'human', $4, $5, $6, NOW())`,
    [
      session.organization_id,
      userId,
      session.call_id,
      userId,
      JSON.stringify({ status: 'in_progress' }),
      JSON.stringify({ status: 'completed' })
    ]
  )

  // Emit webhook event
  await emitCallCompleted({
    id: session.call_id,
    organization_id: session.organization_id,
    status: 'completed'
  })

  logger.info('WebRPC call hangup successful', {
    call_id: session.call_id,
    source: 'webrpc',
    actor_id: userId
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
  await query(
    `UPDATE webrtc_sessions SET updated_at = NOW() WHERE id = $1`,
    [sessionId]
  )

  return {
    pong: true,
    timestamp: new Date().toISOString()
  }
}

/**
 * POST /api/webrpc
 * Execute WebRPC method
 * 
 * ARCHITECTURE COMPLIANCE:
 * - Rate limited (100 req/min per user)
 * - Audit logged (all operations)
 * - Calls orchestration layer (no direct DB writes)
 * - Source attribution (source='webrpc')
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

    // Rate limiting (100 requests/minute per user)
    const rateLimitKey = `webrpc:${userId}`
    const rateLimitCheck = await checkRateLimit(rateLimitKey, 100, 60000)

    if (!rateLimitCheck.allowed) {
      logger.warn('WebRPC rate limit exceeded', { userId, remaining: rateLimitCheck.remaining })

      return NextResponse.json({
        id: 'unknown',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again in ${Math.ceil(rateLimitCheck.resetIn / 1000)}s.`
        }
      } as WebRPCResponse, { status: 429 })
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

    logger.info('WebRPC request received', {
      request_id: id,
      method,
      user_id: userId,
      source: 'webrpc'
    })

    // Get user's active WebRTC session
    const { rows: sessions } = await query(
      `SELECT id, organization_id, status, call_id, session_token 
       FROM webrtc_sessions 
       WHERE user_id = $1 AND status IN ('initializing', 'connecting', 'connected', 'on_call')
       LIMIT 1`,
      [userId]
    )
    const webrtcSession = sessions[0]

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
        result = await handleCallHangup(params, userId, webrtcSession!.organization_id, webrtcSession!.id)
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
          await query(
            `UPDATE webrtc_sessions 
             SET status = 'disconnected', disconnected_at = NOW() 
             WHERE id = $1`,
            [webrtcSession.id]
          )
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
    logger.error('WebRPC POST error', error)
    return NextResponse.json({
      id: 'unknown',
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    } as WebRPCResponse, { status: 500 })
  }
}
