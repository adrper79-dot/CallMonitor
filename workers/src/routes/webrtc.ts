/**
 * WebRTC Routes - Telnyx WebRTC integration
 *
 * Provides WebRTC credentials and call management for browser-based calling
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const webrtcRoutes = new Hono<{ Bindings: Env }>()

// Get WebRTC credentials from Telnyx
webrtcRoutes.get('/token', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!c.env.TELNYX_API_KEY) {
      return c.json({ error: 'Telnyx API key not configured' }, 500)
    }

    // Create WebRTC token via Telnyx API
    const response = await fetch('https://api.telnyx.com/v2/telephony_credentials', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: c.env.TELNYX_CONNECTION_ID,
        name: `user-${session.userId}`,
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Telnyx WebRTC token error:', error)
      return c.json({ error: 'Failed to create WebRTC token' }, 500)
    }

    const tokenData = await response.json()

    return c.json({
      success: true,
      token: tokenData.data.token,
      username: tokenData.data.username,
      expires: tokenData.data.expires_at,
      rtcConfig: {
        iceServers: [
          { urls: 'stun:stun.telnyx.com:3478' },
          {
            urls: 'turn:turn.telnyx.com:3478',
            username: tokenData.data.username,
            credential: tokenData.data.password,
          },
        ],
      },
    })
  } catch (err: any) {
    console.error('GET /api/webrtc/token error:', err)
    return c.json({ error: 'Failed to get WebRTC token' }, 500)
  }
})

// Initiate outbound call via Telnyx Call Control API
webrtcRoutes.post('/dial', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { phoneNumber } = body as { phoneNumber?: string }

    if (!phoneNumber) {
      return c.json({ error: 'Phone number required' }, 400)
    }

    if (!c.env.TELNYX_API_KEY || !c.env.TELNYX_CONNECTION_ID || !c.env.TELNYX_NUMBER) {
      return c.json({ error: 'Telnyx configuration incomplete' }, 500)
    }

    // Use neon client to create call record
    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    // Create call record
    const callResult = await sql`
      INSERT INTO calls (id, organization_id, user_id, direction, phone_number, status, created_at, updated_at)
      VALUES (gen_random_uuid(), ${session.organizationId}, ${session.userId}, 'outbound', ${phoneNumber}, 'initiated', NOW(), NOW())
      RETURNING id
    `

    const callId = callResult[0].id

    // Initiate call via Telnyx Call Control API
    const telnyxResponse = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: c.env.TELNYX_CONNECTION_ID,
        to: phoneNumber,
        from: c.env.TELNYX_NUMBER,
        webhook_url: `${c.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'}/api/webhooks/telnyx?callId=${callId}&orgId=${session.organizationId}`,
        record: 'record-from-answer',
        timeout_secs: 30,
      }),
    })

    if (!telnyxResponse.ok) {
      const error = await telnyxResponse.text()
      console.error('Telnyx call initiation error:', error)

      // Update call status to failed
      await sql`
        UPDATE calls SET status = 'failed', updated_at = NOW() WHERE id = ${callId}
      `

      return c.json({ error: 'Failed to initiate call' }, 500)
    }

    const telnyxData = await telnyxResponse.json()
    const callSid = telnyxData.data.call_control_id

    // Update call record with Telnyx call SID
    await sql`
      UPDATE calls SET external_id = ${callSid}, status = 'ringing', updated_at = NOW() WHERE id = ${callId}
    `

    return c.json({
      success: true,
      callId,
      callSid,
      status: 'ringing',
    })
  } catch (err: any) {
    console.error('POST /api/webrtc/dial error:', err)
    return c.json({ error: 'Failed to initiate call' }, 500)
  }
})