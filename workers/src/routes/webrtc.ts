/**
 * WebRTC Routes - Telnyx WebRTC integration
 *
 * Provides WebRTC credentials and call management for browser-based calling
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { WebRTCDialSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { getTranslationConfig } from '../lib/translation-processor'
import { telnyxVoiceRateLimit } from '../lib/rate-limit'

export const webrtcRoutes = new Hono<AppEnv>()

// Debug endpoint to check Telnyx configuration
webrtcRoutes.get('/debug', telnyxVoiceRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const connectionId = c.env.TELNYX_CONNECTION_ID
  const hasApiKey = !!c.env.TELNYX_API_KEY
  const hasNumber = !!c.env.TELNYX_NUMBER

  // Test if connection ID is valid by fetching connection details
  let connectionStatus = 'unknown'
  let connectionDetails = null

  if (hasApiKey && connectionId) {
    try {
      // Try to list connections to see what we have
      const resp = await fetch('https://api.telnyx.com/v2/credential_connections', {
        headers: {
          Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (resp.ok) {
        const data = (await resp.json()) as {
          data: Array<{ id: string; active: boolean; connection_name: string }>
        }
        connectionDetails = data.data?.map(
          (conn: { id: string; active: boolean; connection_name: string }) => ({
            id: conn.id,
            active: conn.active,
            name: conn.connection_name,
          })
        )

        const match = data.data?.find((conn: { id: string }) => conn.id === connectionId)
        connectionStatus = match ? (match.active ? 'active' : 'inactive') : 'not_found'
      } else {
        connectionStatus = `api_error_${resp.status}`
      }
    } catch (e: any) {
      connectionStatus = `fetch_error: ${e.message}`
    }
  }

  return c.json({
    config: {
      has_api_key: hasApiKey,
      has_connection_id: !!connectionId,
      connection_id_preview: connectionId ? connectionId.substring(0, 12) + '...' : null,
      has_number: hasNumber,
    },
    connection_status: connectionStatus,
    available_connections: connectionDetails,
    instructions: !connectionId
      ? [
          '1. Go to Telnyx Portal > Voice > Credentials',
          '2. Create a credential connection or use existing',
          '3. Copy the Connection ID (starts with a UUID)',
          '4. Run: wrangler secret put TELNYX_CONNECTION_ID --name wordisbond-api',
        ]
      : null,
  })
})

// Get WebRTC credentials from Telnyx
// TELNYX_CONNECTION_ID should be a Credential Connection ID from Telnyx Portal
// Go to: Voice > Credentials > Create new credential
webrtcRoutes.get('/token', telnyxVoiceRateLimit, async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!c.env.TELNYX_API_KEY) {
      return c.json({ error: 'Telnyx API key not configured' }, 500)
    }

    // TELNYX_CONNECTION_ID should be the Credential Connection ID (starts with "conn_" or is a UUID)
    const credentialConnectionId = c.env.TELNYX_CONNECTION_ID

    if (!credentialConnectionId) {
      logger.info('TELNYX_CONNECTION_ID not configured')
      return c.json(
        {
          success: false,
          error: 'Telnyx WebRTC not configured',
          message:
            'TELNYX_CONNECTION_ID must be set to your Credential Connection ID from Telnyx Portal',
          setup_instructions: [
            '1. Go to Telnyx Portal > Voice > Credentials',
            '2. Create a new credential or use existing',
            '3. Copy the Credential Connection ID',
            '4. Run: wrangler secret put TELNYX_CONNECTION_ID',
          ],
        },
        500
      )
    }

    // M-1: Cache WebRTC credentials in KV to prevent orphaned credentials
    // Each credential lasts 1 hour — cache for 55 minutes to allow 5-min buffer
    // @see ARCH_DOCS/FORENSIC_DEEP_DIVE_REPORT.md — M-1: Credential orphaning
    const cacheKey = `webrtc-cred:${session.user_id}`
    try {
      const cached = await c.env.KV.get(cacheKey, 'json') as {
        token: string
        username: string
        credential_id: string
        expires: string
      } | null
      if (cached && new Date(cached.expires).getTime() > Date.now() + 5 * 60 * 1000) {
        logger.info('Returning cached WebRTC credential', { user_id: session.user_id })
        return c.json({
          success: true,
          token: cached.token,
          username: cached.username,
          credential_id: cached.credential_id,
          caller_id: c.env.TELNYX_NUMBER || '',
          expires: cached.expires,
          rtcConfig: {
            iceServers: [
              { urls: 'stun:stun.telnyx.com:3478' },
              { urls: 'stun:stun.l.google.com:19302' },
            ],
          },
        })
      }
    } catch (kvErr) {
      logger.warn('KV cache read failed, creating new credential', { error: (kvErr as Error)?.message })
    }

    // Step 1: Create a telephony credential for this user session
    logger.info('Creating telephony credential')
    const createCredResponse = await fetch('https://api.telnyx.com/v2/telephony_credentials', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: credentialConnectionId,
        name: `webrtc-user-${session.user_id}-${Date.now()}`,
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      }),
    })

    if (!createCredResponse.ok) {
      const errorText = await createCredResponse.text()
      logger.error('Failed to create credential', { status: createCredResponse.status })

      // Parse error for better feedback
      let errorMessage = 'Failed to create WebRTC credential'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.errors?.[0]?.detail || errorJson.message || errorText
      } catch (e) {
        errorMessage = errorText
      }

      return c.json(
        {
          success: false,
          error: errorMessage,
          status: createCredResponse.status,
          hint:
            createCredResponse.status === 404
              ? 'Invalid TELNYX_CONNECTION_ID - check your Credential Connection ID in Telnyx Portal'
              : createCredResponse.status === 401
                ? 'Invalid TELNYX_API_KEY - check your API key has telephony permissions'
                : 'Check Telnyx dashboard for credential connection configuration',
        },
        500
      )
    }

    const credData = (await createCredResponse.json()) as {
      data: { id: string; sip_username: string; expires_at: string }
    }
    const credentialId = credData.data.id

    // Step 2: Get JWT token for the created credential
    logger.info('Getting token for credential')
    const tokenResponse = await fetch(
      `https://api.telnyx.com/v2/telephony_credentials/${credentialId}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Failed to get token', { status: tokenResponse.status })
      return c.json(
        {
          success: false,
          error: 'Failed to get WebRTC token',
          details: errorText,
        },
        500
      )
    }

    // Telnyx returns the JWT token as plain text, not JSON
    const tokenText = await tokenResponse.text()

    // Try to parse as JSON first (API may return { data: "token" } format)
    let jwtToken: string
    try {
      const parsed = JSON.parse(tokenText)
      jwtToken = parsed.data || parsed.token || tokenText
    } catch {
      // It's a plain JWT string
      jwtToken = tokenText.trim()
    }

    logger.info('Successfully obtained token')

    // M-1: Cache credential in KV (55-min TTL — 5-min buffer before 1-hour expiry)
    try {
      await c.env.KV.put(cacheKey, JSON.stringify({
        token: jwtToken,
        username: credData.data.sip_username,
        credential_id: credentialId,
        expires: credData.data.expires_at,
      }), { expirationTtl: 55 * 60 })
    } catch (kvErr) {
      logger.warn('KV cache write failed', { error: (kvErr as Error)?.message })
    }

    return c.json({
      success: true,
      token: jwtToken,
      username: credData.data.sip_username,
      credential_id: credentialId,
      caller_id: c.env.TELNYX_NUMBER || '', // Include the caller ID for outbound calls
      expires: credData.data.expires_at,
      rtcConfig: {
        iceServers: [
          { urls: 'stun:stun.telnyx.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      },
    })
  } catch (err: any) {
    logger.error('GET /api/webrtc/token error', { error: err?.message })
    return c.json({ error: 'Failed to get WebRTC token' }, 500)
  }
})

// Initiate outbound call via Telnyx Call Control API
webrtcRoutes.post('/dial', telnyxVoiceRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const parsed = await validateBody(c, WebRTCDialSchema)
  if (!parsed.success) return parsed.response
  const { phone_number } = parsed.data

  if (!c.env.TELNYX_API_KEY || !c.env.TELNYX_CONNECTION_ID || !c.env.TELNYX_NUMBER) {
    return c.json({ error: 'Telnyx configuration incomplete' }, 500)
  }

  // Use centralized DB client to create call record
  const db = getDb(c.env, session.organization_id)
  try {
    // Create call record - using actual schema columns
    const callResult = await db.query(
      `INSERT INTO calls (id, organization_id, status, started_at, created_by, phone_number, from_number, direction, flow_type, user_id)
       VALUES (gen_random_uuid(), $1, 'initiated', NOW(), $2, $3, $4, 'outbound', 'webrtc', $2)
       RETURNING id`,
      [session.organization_id, session.user_id, phone_number, c.env.TELNYX_NUMBER]
    )

    const callId = callResult.rows[0].id

    // Initiate call via Telnyx Call Control API
    // Get voice config to determine recording and transcription settings
    const voiceConfigResult = await db.query(
      `SELECT record, transcribe, translate, translate_from, translate_to, live_translate, voice_to_voice
       FROM voice_configs
       WHERE organization_id = $1
       LIMIT 1`,
      [session.organization_id]
    )
    const voiceConfig = voiceConfigResult.rows[0]

    const callPayload: Record<string, unknown> = {
      connection_id: c.env.TELNYX_CONNECTION_ID,
      to: phone_number,
      from: c.env.TELNYX_NUMBER,
      webhook_url: `${c.env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/webhooks/telnyx?call_id=${callId}`,
      timeout_secs: 30,
    }

    // Enable recording if configured
    if (voiceConfig?.record) {
      callPayload.record = 'record-from-answer'
      callPayload.record_channels = 'dual'
      callPayload.record_format = 'mp3'
      logger.info('Call recording enabled for WebRTC call (dual-channel)', { callId })
    }

    // Enable transcription for live translation, voice-to-voice, OR regular transcription
    const enableTranscription =
      voiceConfig?.live_translate || voiceConfig?.voice_to_voice || voiceConfig?.transcribe
    if (enableTranscription) {
      callPayload.transcription = true
      callPayload.transcription_config = {
        transcription_engine: 'B',
        transcription_tracks: 'both',
      }
      logger.info('Transcription enabled for WebRTC call', {
        callId,
        live_translate: voiceConfig?.live_translate,
        voice_to_voice: voiceConfig?.voice_to_voice,
        transcribe: voiceConfig?.transcribe,
      })
    }

    // Create idempotency key for safe retries
    // Uses only callId — Date.now() would make every retry unique, defeating idempotency
    // @see ARCH_DOCS/FORENSIC_DEEP_DIVE_REPORT.md — L-4
    const idempotencyKey = `webrtc_dial_${callId}`

    const telnyxResponse = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(callPayload),
    })

    if (!telnyxResponse.ok) {
      const errorText = await telnyxResponse.text()
      const status = telnyxResponse.status
      let errorMessage = `Telnyx API error: ${status}`

      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.errors?.[0]?.detail || errorData.message || errorMessage
      } catch {
        // Use raw error text if not JSON
        errorMessage = errorText.substring(0, 200)
      }

      // Handle Telnyx rate limiting
      if (status === 429) {
        const retryAfter = telnyxResponse.headers.get('Retry-After') || '60'
        logger.warn('Telnyx WebRTC rate limit exceeded', {
          endpoint: '/v2/calls',
          connectionId: c.env.TELNYX_CONNECTION_ID?.slice(0, 8) + '...',
          retryAfter,
        })
        await db.query('UPDATE calls SET status = $1 WHERE id = $2', ['failed', callId])
        return c.json(
          {
            error: 'Call service rate limit exceeded. Please try again later.',
            code: 'TELNYX_RATE_LIMIT',
            retry_after: parseInt(retryAfter),
          },
          429
        )
      }

      // Handle insufficient balance or account issues
      if (status === 402) {
        logger.error('Telnyx account payment issue (WebRTC)', {
          response: errorMessage,
        })
        await db.query('UPDATE calls SET status = $1 WHERE id = $2', ['failed', callId])
        return c.json(
          {
            error: 'Voice service temporarily unavailable. Please contact support.',
            code: 'TELNYX_PAYMENT_REQUIRED',
          },
          503
        )
      }

      logger.error('Telnyx call initiation error', {
        status,
        error: errorMessage,
        callId,
      })

      // Update call status to failed
      await db.query('UPDATE calls SET status = $1 WHERE id = $2', ['failed', callId])

      return c.json({ error: 'Failed to initiate call' }, 500)
    }

    const telnyxData = (await telnyxResponse.json()) as {
      data: { call_control_id: string; call_session_id?: string }
    }
    const callControlId = telnyxData.data.call_control_id
    const callSessionId = telnyxData.data.call_session_id || telnyxData.data.call_control_id

    // Update call record with Telnyx call IDs
    await db.query(
      'UPDATE calls SET call_sid = $1, call_control_id = $2, status = $3 WHERE id = $4',
      [callSessionId, callControlId, 'ringing', callId]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'calls',
      resourceId: callId,
      action: AuditAction.CALL_STARTED,
      oldValue: null,
      newValue: { call_id: callId, call_sid: callId, phone_number, direction: 'outbound' },
    })

    return c.json({
      success: true,
      call_id: callId,
      call_sid: callId,
      status: 'ringing',
    })
  } catch (err: any) {
    logger.error('POST /api/webrtc/dial error', { error: err?.message })
    return c.json({ error: 'Failed to initiate call' }, 500)
  } finally {
    await db.end()
  }
})
