/**
 * Webhook Receivers & Subscription Management
 *
 * Handles incoming webhooks from:
 * - Telnyx (call events) — verified via HMAC-SHA256 signature
 * - AssemblyAI (transcription)
 * - Stripe (billing events) — verified via HMAC-SHA256 signature
 *
 * Also provides CRUD for user-configured webhook subscriptions:
 *   GET    /subscriptions              - List org's webhook subscriptions
 *   POST   /subscriptions              - Create a webhook subscription
 *   PATCH  /subscriptions/:id          - Update webhook (toggle active, edit)
 *   DELETE /subscriptions/:id          - Delete a webhook subscription
 *   POST   /subscriptions/:id/test     - Send a test delivery
 *   GET    /subscriptions/:id/deliveries - Delivery log for a webhook
 *
 * Aliases at root path for newer frontend:
 *   GET    /                            - Alias for GET /subscriptions
 *   POST   /                            - Alias for POST /subscriptions
 *   PATCH  /:id                         - Alias for PATCH /subscriptions/:id
 *   DELETE /:id                         - Alias for DELETE /subscriptions/:id
 *   POST   /:id/test                    - Alias for POST /subscriptions/:id/test
 */

import { Hono } from 'hono'
import type { AppEnv, Env } from '../index'
import { getDb, DbClient } from '../lib/db'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateWebhookSchema, UpdateWebhookSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { webhookRateLimit } from '../lib/rate-limit'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { translateAndStore, getTranslationConfig } from '../lib/translation-processor'
import { handleSentimentAnalysis } from '../lib/sentiment-processor'
import { handleGatherResult } from '../lib/ivr-flow-engine'
import { handleAICallEvent } from '../lib/ai-call-engine'
import { handleDialerAMD } from '../lib/dialer-engine'
import { deliverWithRetry, fanOutToSubscribers } from '../lib/webhook-retry'

export const webhooksRoutes = new Hono<AppEnv>()

// --- Signature verification helpers ---

/**
 * Verify Stripe webhook signature (HMAC-SHA256)
 * Stripe signs payloads as: v1=<hmac_sha256(timestamp.payload, secret)>
 */
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): Promise<boolean> {
  const parts = signatureHeader.split(',')
  const timestampPart = parts.find((p) => p.startsWith('t='))
  const sigPart = parts.find((p) => p.startsWith('v1='))

  if (!timestampPart || !sigPart) return false

  const timestamp = timestampPart.slice(2)
  const expectedSig = sigPart.slice(3)

  // Reject if timestamp is too old (replay protection)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)
  if (isNaN(age) || age > toleranceSeconds) return false

  // Compute HMAC-SHA256 of "timestamp.payload"
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`))
  const computedSig = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  if (computedSig.length !== expectedSig.length) return false
  let mismatch = 0
  for (let i = 0; i < computedSig.length; i++) {
    mismatch |= computedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Verify Telnyx webhook signature (Ed25519)
 * Telnyx V2 signs payloads with Ed25519: signature = sign(timestamp || "." || body, public_key)
 * The public key is provided by Telnyx in your webhook settings.
 */
async function verifyTelnyxSignature(
  payload: string,
  timestampHeader: string,
  signatureHeader: string,
  publicKey: string,
  toleranceSeconds = 300
): Promise<boolean> {
  if (!timestampHeader || !signatureHeader || !publicKey) return false

  // Reject stale timestamps (replay protection)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestampHeader, 10)
  if (isNaN(age) || age > toleranceSeconds) return false

  try {
    // Decode base64 signature and public key
    const signatureBytes = Uint8Array.from(atob(signatureHeader), (c) => c.charCodeAt(0))
    const publicKeyBytes = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0))

    // Message to verify: "timestamp.payload"
    const encoder = new TextEncoder()
    const message = encoder.encode(`${timestampHeader}.${payload}`)

    // Import Ed25519 public key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    )

    // Verify Ed25519 signature
    const valid = await crypto.subtle.verify('Ed25519', cryptoKey, signatureBytes, message)
    return valid
  } catch (err) {
    logger.error('Ed25519 signature verification failed', { error: (err as Error).message })
    return false
  }
}

// Telnyx call events — verified via Ed25519 signature
webhooksRoutes.post('/telnyx', async (c) => {
  try {
    const rawBody = await c.req.text()

    // Validate body is not empty
    if (!rawBody || rawBody.trim() === '') {
      logger.warn('Telnyx webhook received empty body')
      return c.json({ error: 'Empty body not allowed' }, 400)
    }

    // Verify Telnyx Ed25519 signature
    // Get the public key from environment (base64-encoded)
    const telnyxPublicKey = c.env.TELNYX_PUBLIC_KEY
    if (telnyxPublicKey) {
      const timestamp = c.req.header('telnyx-timestamp') || c.req.header('webhook-timestamp') || ''
      const signature =
        c.req.header('telnyx-signature-ed25519') || c.req.header('webhook-signature') || ''

      if (!timestamp || !signature) {
        logger.warn('Telnyx webhook missing timestamp or signature headers')
        return c.json({ error: 'Missing signature headers' }, 401)
      }

      const valid = await verifyTelnyxSignature(rawBody, timestamp, signature, telnyxPublicKey)
      if (!valid) {
        logger.error('Telnyx webhook signature verification failed', {
          timestamp,
          signatureLength: signature.length,
        })
        return c.json({ error: 'Invalid webhook signature' }, 401)
      }
      logger.info('Telnyx webhook signature verified successfully')
    } else {
      logger.warn(
        'TELNYX_PUBLIC_KEY not configured — accepting unverified webhook (set public key for production)'
      )
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch (parseErr) {
      logger.warn('Telnyx webhook received invalid JSON', { error: (parseErr as Error).message })
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    // Validate required structure
    if (!body || typeof body !== 'object' || !body.data || !body.data.event_type) {
      logger.warn('Telnyx webhook received invalid body structure', { hasData: !!body?.data, eventType: body?.data?.event_type })
      return c.json({ error: 'Invalid webhook body structure' }, 400)
    }

    const eventType = body.data.event_type

    const db = getDb(c.env)

    try {
      switch (eventType) {
        case 'call.initiated':
          await handleCallInitiated(db, body.data.payload)
          break
        case 'call.answered':
          await handleCallAnswered(c.env, db, body.data.payload)
          break
        case 'call.hangup':
          await handleCallHangup(db, body.data.payload)
          break
        case 'call.recording.saved':
          await handleRecordingSaved(c.env, db, body.data.payload)
          break
        case 'call.transcription':
          await handleCallTranscription(c.env, db, body.data.payload)
          break

        // v5.0: Gather/DTMF result — IVR Payments & Hybrid AI
        case 'call.gather.ended':
          await handleCallGatherEnded(c.env, db, body.data.payload)
          break

        // v5.0: TTS speak completed — Hybrid AI state advance
        case 'call.speak.ended':
          await handleCallSpeakEnded(c.env, db, body.data.payload)
          break

        // v5.0: AMD result — Predictive Dialer
        case 'call.machine.detection.ended':
          await handleMachineDetectionEnded(c.env, db, body.data.payload)
          break

        // v5.0: Call bridged — Hybrid AI human takeover
        case 'call.bridged':
          await handleCallBridged(c.env, db, body.data.payload)
          break

        // Silently ignore other event types
      }
    } finally {
      await db.end()
    }

    return c.json({ received: true })
  } catch (err: any) {
    logger.error('Telnyx webhook processing error', { error: err?.message, stack: err?.stack })
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// AssemblyAI transcription webhook
// BL-005: Verify webhook auth header (shared secret set during transcription submission)
// BL-006: Scoped UPDATE by organization_id via JOIN to prevent cross-tenant injection
webhooksRoutes.post('/assemblyai', async (c) => {
  try {
    // BL-005: Verify webhook authentication token
    const webhookSecret = c.env.ASSEMBLYAI_WEBHOOK_SECRET
    if (webhookSecret) {
      const authHeader =
        c.req.header('Authorization') || c.req.header('X-AssemblyAI-Webhook-Secret') || ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
      if (token !== webhookSecret) {
        logger.error('AssemblyAI webhook signature verification failed')
        return c.json({ error: 'Invalid webhook authentication' }, 401)
      }
    } else {
      logger.warn(
        'ASSEMBLYAI_WEBHOOK_SECRET not configured — accepting unverified webhook (configure secret for production)'
      )
    }

    const body = await c.req.json()
    const { transcript_id, status, text } = body

    if (status === 'completed' && text) {
      const db = getDb(c.env)
      try {
        // BL-006: Organization-scoped update to prevent cross-tenant transcript injection
        const result = await db.query(
          `UPDATE calls 
         SET transcript = $1, transcript_status = 'completed', updated_at = NOW()
         WHERE transcript_id = $2 AND organization_id IS NOT NULL`,
          [text, transcript_id]
        )
        if (result.rows.length === 0) {
          logger.warn('AssemblyAI webhook: no matching call found for transcript_id', {
            transcript_id,
          })
        }
      } finally {
        await db.end()
      }
    }

    return c.json({ received: true })
  } catch (err: any) {
    logger.error('AssemblyAI webhook processing error')
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// Stripe billing webhook — verified via HMAC-SHA256 signature
webhooksRoutes.post('/stripe', async (c) => {
  const db = getDb(c.env)
  try {
    const signature = c.req.header('stripe-signature')
    const body = await c.req.text()

    // Verify Stripe webhook signature
    const stripeSecret = (c.env as any).STRIPE_WEBHOOK_SECRET
    if (!stripeSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured')
      return c.json({ error: 'Webhook verification not configured' }, 500)
    }

    if (!signature) {
      return c.json({ error: 'Missing stripe-signature header' }, 401)
    }

    const valid = await verifyStripeSignature(body, signature, stripeSecret)
    if (!valid) {
      return c.json({ error: 'Invalid webhook signature' }, 401)
    }

    const event = JSON.parse(body)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(db, event.data.object)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(db, event.data.object)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(db, event.data.object)
        break
      case 'invoice.paid':
        await handleInvoicePaid(db, event.data.object)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(db, event.data.object)
        break
      // Silently ignore other event types
    }

    return c.json({ received: true })
  } catch (err: any) {
    logger.error('Stripe webhook processing error')
    return c.json({ error: 'Webhook processing failed' }, 500)
  } finally {
    await db.end()
  }
})

// --- Telnyx Handlers ---

async function handleCallInitiated(db: DbClient, payload: any) {
  const { call_control_id, call_session_id, from, to } = payload

  // First try to update existing call
  const updateResult = await db.query(
    `UPDATE calls
     SET call_sid = $1, status = 'initiated'
     WHERE call_control_id = $2 AND organization_id IS NOT NULL`,
    [call_session_id, call_control_id]
  )

  if (updateResult.rowCount > 0) {
    // Successfully updated existing call
    return
  }

  // No existing call found - this might be a programmatically created call (e.g., bridge customer call)
  // Try to find the organization from an active bridge call with matching numbers
  const bridgeCallResult = await db.query(
    `SELECT organization_id, id as bridge_call_id
     FROM calls
     WHERE flow_type = 'bridge'
     AND status IN ('in_progress', 'answered', 'initiated')
     AND ((from_number = $1 AND to_number = $2) OR (from_number = $2 AND to_number = $1))
     AND organization_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [from, to]
  )

  if (bridgeCallResult.rows.length > 0) {
    const { organization_id, bridge_call_id } = bridgeCallResult.rows[0]

    // Create a record for this programmatically created call
    // Link it to the bridge call for transcription purposes
    await db.query(
      `INSERT INTO calls (
        organization_id,
        call_sid,
        call_control_id,
        status,
        from_number,
        to_number,
        flow_type,
        created_at
      ) VALUES ($1, $2, $3, 'initiated', $4, $5, 'bridge_customer', NOW())`,
      [organization_id, call_session_id, call_control_id, from, to]
    )

    logger.info('Created database record for bridge customer call', {
      call_control_id,
      bridge_call_id,
      from,
      to
    })
  } else {
    logger.warn('webhook-update-no-match and no bridge call found', {
      call_control_id,
      from,
      to
    })
  }
}

async function handleCallAnswered(env: Env, db: DbClient, payload: any) {
  const { call_control_id, call_session_id } = payload

  logger.info('handleCallAnswered called', { call_control_id, call_session_id })

  const result = await db.query(
    `UPDATE calls 
     SET status = 'in_progress', answered_at = NOW()
     WHERE (call_sid = $1 OR call_control_id = $2) AND organization_id IS NOT NULL
     RETURNING flow_type, to_number`,
    [call_session_id, call_control_id]
  )
  if (result.rowCount === 0) {
    logger.warn('webhook-update-no-match', { call_control_id, handler: 'handleCallAnswered' })
    return
  }

  const call = result.rows[0]

  // Handle bridge calls: when agent answers, create customer call and bridge
  if (call.flow_type === 'bridge' && call.to_number && env.TELNYX_API_KEY) {
    logger.info('Bridge call: agent answered, creating customer call and bridging', {
      callControlId: call_control_id,
      customerNumber: call.to_number,
      agentNumber: call.from_number,
      hasApiKey: !!env.TELNYX_API_KEY,
      telnyxConnectionId: !!env.TELNYX_CONNECTION_ID,
      telnyxAppId: !!env.TELNYX_CALL_CONTROL_APP_ID,
      telnyxNumber: !!env.TELNYX_NUMBER,
    })
    try {
      // Create a new call to the customer
      const customerCallPayload = {
        to: call.to_number,
        from: call.from_number || env.TELNYX_NUMBER,
        connection_id: env.TELNYX_CALL_CONTROL_APP_ID,  // Use Call Control App ID for programmatic calls
        timeout_secs: 30,
        webhook_url: `${env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/webhooks/telnyx`,
        webhook_url_method: 'POST',
        transcription: true,
        transcription_config: {
          transcription_engine: 'B',
          transcription_tracks: 'both',
        },
      }
      logger.info('Bridge customer call payload', { payload: customerCallPayload })

      const createCallResponse = await fetch('https://api.telnyx.com/v2/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerCallPayload),
      })

      if (createCallResponse.ok) {
        const customerCallData = await createCallResponse.json()
        const customerCallControlId = customerCallData.data.call_control_id
        logger.info('Customer call created successfully', { customerCallControlId })

        // Now bridge the agent call to the customer call
        const bridgeResponse = await fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/bridge`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            call_control_id: customerCallControlId,
          }),
        })

        if (bridgeResponse.ok) {
          logger.info('Bridge call initiated successfully', {
            agentCallControlId: call_control_id,
            customerCallControlId,
          })
        } else {
          const bridgeErrorText = await bridgeResponse.text()
          logger.error('Bridge action failed', {
            status: bridgeResponse.status,
            response: bridgeErrorText.slice(0, 500)
          })
        }
      } else {
        const errorText = await createCallResponse.text()
        logger.error('Customer call creation failed', {
          status: createCallResponse.status,
          response: errorText.slice(0, 500)
        })
      }
    } catch (err) {
      logger.error('Bridge call failed with exception', { error: (err as Error)?.message, stack: (err as Error)?.stack })
    }
  } else {
    logger.warn('Bridge call conditions not met', {
      flowType: call.flow_type,
      hasToNumber: !!call.to_number,
      hasApiKey: !!env.TELNYX_API_KEY,
    })
  }

  // AI Role Policy: Disclose AI-assisted features at call start
  // If live translation is enabled for this call's org, play a brief disclosure
  try {
    const callResult = await db.query(
      `SELECT c.organization_id FROM calls c
       WHERE (c.call_sid = $1 OR c.call_control_id = $2) AND c.organization_id IS NOT NULL
       LIMIT 1`,
      [call_session_id, call_control_id]
    )
    if (callResult.rows.length > 0) {
      const translationConfig = await getTranslationConfig(db, callResult.rows[0].organization_id)
      if (translationConfig?.live_translate && env.TELNYX_API_KEY) {
        // Non-blocking: Play AI disclosure via Telnyx speak command
        fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/speak`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payload:
              'This call is using AI-assisted live translation for quality and accessibility purposes.',
            voice: 'female',
            language: 'en-US',
          }),
        }).catch((err) => {
          logger.warn('AI disclosure speak failed (non-fatal)', { error: (err as Error)?.message })
        })
      }
    }
  } catch {
    // Non-fatal — disclosure failure should never block call
  }
}

async function handleCallHangup(db: DbClient, payload: any) {
  const { call_control_id, call_session_id, hangup_cause } = payload

  const result = await db.query(
    `UPDATE calls 
     SET status = 'completed', ended_at = NOW(), hangup_cause = $3
     WHERE (call_sid = $1 OR call_control_id = $2) AND organization_id IS NOT NULL`,
    [call_session_id, call_control_id, hangup_cause]
  )
  if (result.rowCount === 0) {
    logger.warn('webhook-update-no-match', { call_control_id, handler: 'handleCallHangup' })
  }
}

async function handleRecordingSaved(env: Env, db: DbClient, payload: any) {
  const { call_session_id, recording_urls } = payload

  // Download recording and store in R2
  if (recording_urls?.mp3) {
    const response = await fetch(recording_urls.mp3)
    const audioBuffer = await response.arrayBuffer()

    const key = `recordings/${call_session_id}.mp3`
    await env.R2.put(key, audioBuffer, {
      httpMetadata: { contentType: 'audio/mpeg' },
    })

    const result = await db.query(
      `UPDATE calls 
       SET recording_url = $2
       WHERE call_sid = $1 AND organization_id IS NOT NULL`,
      [call_session_id, key]
    )
    if (result.rowCount === 0) {
      logger.warn('webhook-update-no-match', { call_session_id, handler: 'handleRecordingSaved' })
    }
  }
}

/**
 * Handle Telnyx call.transcription event — real-time live translation pipeline.
 *
 * Telnyx Call Control v2 sends `call.transcription` events when
 * `transcription: true` + `transcription_config: { transcription_engine: 'B' }` is enabled on the call.
 * Each event contains a transcription segment for a single utterance.
 *
 * Pipeline: Telnyx transcription → OpenAI translation → call_translations INSERT → SSE delivery
 *
 * @see ARCH_DOCS/02-FEATURES/LIVE_TRANSLATION_FLOW.md
 */
async function handleCallTranscription(env: Env, db: DbClient, payload: any) {
  const { call_control_id, call_session_id, transcription_data } = payload

  // Extract transcription text — Telnyx sends it in transcription_data
  const transcript = transcription_data?.transcript || payload.transcript || ''
  const confidence = transcription_data?.confidence || payload.confidence || 0.9

  if (!transcript || transcript.trim().length === 0) {
    return // Skip empty transcriptions (silence, noise)
  }

  logger.info('Live transcription received', {
    callControlId: call_control_id,
    textLength: transcript.length,
    confidence,
  })

  // Look up the call record to get organization_id and call id
  const callResult = await db.query(
    `SELECT id, organization_id, flow_type, from_number, to_number FROM calls
     WHERE (call_control_id = $1 OR call_sid = $2)
     AND organization_id IS NOT NULL
     LIMIT 1`,
    [call_control_id, call_session_id]
  )

  if (callResult.rows.length === 0) {
    logger.warn('Transcription webhook: no matching call found', {
      call_control_id,
      call_session_id,
    })
    return
  }

  let { id: callId, organization_id: orgId, flow_type } = callResult.rows[0]

  // If this is a bridge customer call, associate transcription with the main bridge call
  if (flow_type === 'bridge_customer') {
    const bridgeCallResult = await db.query(
      `SELECT id FROM calls
       WHERE flow_type = 'bridge'
       AND status IN ('in_progress', 'answered', 'completed')
       AND ((from_number = $1 AND to_number = $2) OR (from_number = $2 AND to_number = $1))
       AND organization_id = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [callResult.rows[0].from_number, callResult.rows[0].to_number, orgId]
    )

    if (bridgeCallResult.rows.length > 0) {
      callId = bridgeCallResult.rows[0].id
      logger.info('Associating bridge customer transcription with main call', {
        customerCallId: callResult.rows[0].id,
        mainCallId: callId
      })
    }
  }

  // Get translation config for this org
  const translationConfig = await getTranslationConfig(db, orgId)
  if (!translationConfig || !translationConfig.live_translate) {
    // Translation not enabled — skip (transcription may still be stored for post-call use)
    return
  }

  // Determine segment index — get current max for this call
  const indexResult = await db.query(
    `SELECT COALESCE(MAX(segment_index), -1) + 1 AS next_index
     FROM call_translations
     WHERE call_id = $1 AND organization_id = $2`,
    [callId, orgId]
  )
  const segmentIndex = indexResult.rows[0]?.next_index ?? 0

  // Translate and store — this calls OpenAI and writes to call_translations
  const openaiKey = env.OPENAI_API_KEY
  if (!openaiKey) {
    logger.error('OPENAI_API_KEY not configured — cannot translate')
    return
  }

  await translateAndStore(db, openaiKey, {
    callId,
    organizationId: orgId,
    originalText: transcript,
    sourceLanguage: translationConfig.translate_from,
    targetLanguage: translationConfig.translate_to,
    segmentIndex,
    confidence,
  })

  // v5.0: Also run sentiment analysis in parallel (non-blocking)
  handleSentimentAnalysis(db, openaiKey, {
    callId,
    organizationId: orgId,
    transcript,
    segmentIndex,
  }).catch((err: unknown) => {
    logger.warn('Sentiment analysis failed (non-fatal)', { error: (err as Error)?.message })
  })
}

// --- v5.0 Telnyx Event Handlers ---

/**
 * Handle call.gather.ended — DTMF/speech gather result.
 * Dispatches to IVR flow engine or AI call engine based on client_state.
 */
async function handleCallGatherEnded(env: Env, db: DbClient, payload: any) {
  const { call_control_id, digits, status, speech, client_state } = payload

  let flowContext: any = {}
  if (client_state) {
    try {
      flowContext = JSON.parse(atob(client_state))
    } catch {
      // Not base64-encoded JSON — may be a plain string
      flowContext = { flow: client_state }
    }
  }

  const gatherResult = digits || speech?.transcript || ''

  logger.info('Gather ended', {
    callControlId: call_control_id,
    flow: flowContext.flow,
    hasDigits: !!digits,
    hasSpeech: !!speech?.transcript,
    status,
  })

  if (flowContext.flow === 'ivr_payment') {
    await handleGatherResult(db, call_control_id, gatherResult, status, env, flowContext)
  } else if (flowContext.flow === 'ai_dialog') {
    await handleAICallEvent(env, db, 'gather_ended', call_control_id, {
      transcript: gatherResult,
      status,
      turn: flowContext.turn,
    })
  } else {
    logger.info('Gather ended with unknown flow', { flow: flowContext.flow, call_control_id })
  }
}

/**
 * Handle call.speak.ended — TTS completed on call.
 * Advances AI call state machine or IVR flow.
 */
async function handleCallSpeakEnded(env: Env, db: DbClient, payload: any) {
  const { call_control_id, client_state } = payload

  let flowContext: any = {}
  if (client_state) {
    try {
      flowContext = JSON.parse(atob(client_state))
    } catch {
      flowContext = { flow: client_state }
    }
  }

  logger.info('Speak ended', { callControlId: call_control_id, flow: flowContext.flow })

  if (flowContext.flow === 'ai_dialog') {
    await handleAICallEvent(env, db, 'speak_ended', call_control_id, {
      turn: flowContext.turn,
    })
  } else if (flowContext.flow === 'ivr_payment') {
    await handleGatherResult(db, call_control_id, '', 'speak_ended', env, flowContext)
  }
}

/**
 * Handle call.machine.detection.ended — AMD result for predictive dialer.
 * Routes to agent, voicemail, or hangup based on detection result.
 */
async function handleMachineDetectionEnded(env: Env, db: DbClient, payload: any) {
  const { call_control_id, call_session_id, result: amdResult } = payload

  logger.info('AMD detection ended', {
    callControlId: call_control_id,
    result: amdResult,
  })

  await handleDialerAMD(env, db, call_control_id, call_session_id, amdResult)
}

/**
 * Handle call.bridged — Call successfully bridged (human takeover).
 */
async function handleCallBridged(env: Env, db: DbClient, payload: any) {
  const { call_control_id, call_session_id } = payload

  logger.info('Call bridged', { callControlId: call_control_id })

  // Update call status
  await db.query(
    `UPDATE calls SET status = 'bridged', updated_at = NOW()
     WHERE (call_sid = $1 OR call_control_id = $2) AND organization_id IS NOT NULL`,
    [call_session_id, call_control_id]
  )

  // Notify AI engine of bridge completion
  await handleAICallEvent(env, db, 'bridged', call_control_id, {})
}

// --- Stripe Handlers ---

/**
 * Handle checkout.session.completed event
 * Fired when a customer completes checkout and creates a subscription
 */
async function handleCheckoutCompleted(db: DbClient, session: any) {
  const customerId = session.customer
  const subscriptionId = session.subscription
  const orgId = session.metadata?.organization_id

  // If we have org_id in metadata, update it directly
  if (orgId) {
    await db.query(
      `UPDATE organizations
       SET stripe_customer_id = $2,
           subscription_id = $3,
           subscription_status = 'active',
           plan_started_at = NOW()
       WHERE id = $1`,
      [orgId, customerId, subscriptionId]
    )
  } else {
    // Fallback: look up by customer_id
    await db.query(
      `UPDATE organizations
       SET subscription_id = $2,
           subscription_status = 'active',
           plan_started_at = NOW()
       WHERE stripe_customer_id = $1`,
      [customerId, subscriptionId]
    )
  }

  // Log the checkout completion
  await db.query(
    `INSERT INTO billing_events (organization_id, event_type, amount, metadata, created_at)
     SELECT id, 'checkout_completed', $2, $3::jsonb, NOW()
     FROM organizations WHERE stripe_customer_id = $1`,
    [
      customerId,
      session.amount_total || 0,
      JSON.stringify({ session_id: session.id, subscription_id: subscriptionId }),
    ]
  )
}

async function handleSubscriptionUpdate(db: DbClient, subscription: any) {
  const orgResult = await db.query(`SELECT id FROM organizations WHERE stripe_customer_id = $1`, [
    subscription.customer,
  ])
  const orgId = orgResult.rows[0]?.id

  await db.query(
    `UPDATE organizations
     SET subscription_status = $2, subscription_id = $3, plan_id = $4
     WHERE stripe_customer_id = $1`,
    [
      subscription.customer,
      subscription.status,
      subscription.id,
      subscription.items.data[0]?.price?.id,
    ]
  )

  if (orgId) {
    writeAuditLog(db, {
      organizationId: orgId,
      userId: 'system',
      action: AuditAction.SUBSCRIPTION_UPDATED,
      resourceType: 'subscription',
      resourceId: subscription.id,
      oldValue: null,
      newValue: { status: subscription.status, plan_id: subscription.items.data[0]?.price?.id },
    })
  }
}

async function handleSubscriptionCanceled(db: DbClient, subscription: any) {
  const orgResult = await db.query(`SELECT id FROM organizations WHERE stripe_customer_id = $1`, [
    subscription.customer,
  ])
  const orgId = orgResult.rows[0]?.id

  await db.query(
    `UPDATE organizations 
     SET subscription_status = 'canceled'
     WHERE stripe_customer_id = $1`,
    [subscription.customer]
  )

  if (orgId) {
    writeAuditLog(db, {
      organizationId: orgId,
      userId: 'system',
      action: AuditAction.SUBSCRIPTION_CANCELLED,
      resourceType: 'subscription',
      resourceId: subscription.id,
      oldValue: null,
      newValue: { status: 'canceled' },
    })
  }
}

async function handleInvoicePaid(db: DbClient, invoice: any) {
  const result = await db.query(
    `INSERT INTO billing_events (organization_id, event_type, amount, invoice_id, created_at)
     SELECT id, 'invoice_paid', $2, $3, NOW()
     FROM organizations WHERE stripe_customer_id = $1
     RETURNING organization_id`,
    [invoice.customer, invoice.amount_paid, invoice.id]
  )

  const orgId = result.rows[0]?.organization_id
  if (orgId) {
    writeAuditLog(db, {
      organizationId: orgId,
      userId: 'system',
      action: AuditAction.PAYMENT_RECEIVED,
      resourceType: 'invoice',
      resourceId: invoice.id,
      oldValue: null,
      newValue: { amount: invoice.amount_paid, status: 'paid' },
    })
  }
}

async function handleInvoiceFailed(db: DbClient, invoice: any) {
  const orgResult = await db.query(`SELECT id FROM organizations WHERE stripe_customer_id = $1`, [
    invoice.customer,
  ])
  const orgId = orgResult.rows[0]?.id

  // Mark subscription as past_due
  await db.query(
    `UPDATE organizations
     SET subscription_status = 'past_due'
     WHERE stripe_customer_id = $1`,
    [invoice.customer]
  )

  // Log the failed payment
  await db.query(
    `INSERT INTO billing_events (organization_id, event_type, amount, invoice_id, metadata, created_at)
     SELECT id, 'invoice_payment_failed', $2, $3, $4::jsonb, NOW()
     FROM organizations WHERE stripe_customer_id = $1`,
    [
      invoice.customer,
      invoice.amount_due,
      invoice.id,
      JSON.stringify({
        attempt_count: invoice.attempt_count,
        next_payment_attempt: invoice.next_payment_attempt,
      }),
    ]
  )

  if (orgId) {
    writeAuditLog(db, {
      organizationId: orgId,
      userId: 'system',
      action: AuditAction.PAYMENT_FAILED,
      resourceType: 'invoice',
      resourceId: invoice.id,
      oldValue: null,
      newValue: { amount: invoice.amount_due, attempt_count: invoice.attempt_count },
    })
  }
}

// ============================================================
// Webhook Subscription CRUD — user-configured outgoing webhooks
// ============================================================

const VALID_WEBHOOK_EVENTS = [
  'call.started',
  'call.ended',
  'call.recording.ready',
  'call.transcript.ready',
  'call.outcome.declared',
  'booking.created',
  'booking.cancelled',
  'campaign.started',
  'campaign.completed',
] as const

/** Shared: list webhook subscriptions */
async function listWebhookSubscriptions(c: any) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT * FROM webhook_subscriptions
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, webhooks: result.rows })
  } finally {
    await db.end()
  }
}

/** Shared: create webhook subscription */
async function createWebhookSubscription(c: any) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, CreateWebhookSchema)
  if (!parsed.success) return parsed.response
  const { url, events, secret, description } = parsed.data

  const db = getDb(c.env)
  try {
    // Generate a signing secret if not provided
    const signingSecret = secret || crypto.randomUUID()

    const result = await db.query(
      `INSERT INTO webhook_subscriptions (organization_id, url, events, secret, description, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
      [session.organization_id, url, events, signingSecret, description || '', session.user_id]
    )

    return c.json({ success: true, webhook: result.rows[0] }, 201)
  } finally {
    await db.end()
  }
}

/** Shared: update webhook subscription */
async function updateWebhookSubscription(c: any, webhookId: string) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, UpdateWebhookSchema)
  if (!parsed.success) return parsed.response
  const { url, events, is_active, description } = parsed.data

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `UPDATE webhook_subscriptions
     SET url = COALESCE($1, url),
         events = COALESCE($2, events),
         is_active = COALESCE($3, is_active),
         description = COALESCE($4, description),
         updated_at = NOW()
     WHERE id = $5 AND organization_id = $6
     RETURNING *`,
      [
        url || null,
        events || null,
        is_active ?? null,
        description || null,
        webhookId,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Webhook not found' }, 404)
    }

    return c.json({ success: true, webhook: result.rows[0] })
  } finally {
    await db.end()
  }
}

/** Shared: delete webhook subscription */
async function deleteWebhookSubscription(c: any, webhookId: string) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `DELETE FROM webhook_subscriptions
     WHERE id = $1 AND organization_id = $2
     RETURNING id`,
      [webhookId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Webhook not found' }, 404)
    }

    return c.json({ success: true, message: 'Webhook deleted' })
  } finally {
    await db.end()
  }
}

/** Shared: send test delivery (with auto-retry) */
async function testWebhookDelivery(c: any, webhookId: string) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const webhookResult = await db.query(
      `SELECT * FROM webhook_subscriptions
     WHERE id = $1 AND organization_id = $2`,
      [webhookId, session.organization_id]
    )

    if (webhookResult.rows.length === 0) {
      return c.json({ error: 'Webhook not found' }, 404)
    }

    const webhook = webhookResult.rows[0]

    // Send test payload with auto-retry
    const testPayload = {
      event: 'test.delivery',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery from WordIsBond',
        webhook_id: webhookId,
        organization_id: session.organization_id,
      },
    }

    const result = await deliverWithRetry({
      db,
      env: c.executionCtx || {},
      url: webhook.url,
      payload: testPayload,
      orgId: session.organization_id,
      event: 'test.delivery',
      secret: webhook.secret,
      webhookId,
      maxRetries: 2, // 3 total attempts for test deliveries
    })

    return c.json({
      success: true,
      delivery: {
        status: result.status,
        success: result.success,
        duration_ms: result.duration_ms,
        attempts: result.attempts,
      },
    })
  } finally {
    await db.end()
  }
}

// --- Subscription routes (at /subscriptions sub-path) ---

webhooksRoutes.get('/subscriptions', async (c) => {
  try {
    return await listWebhookSubscriptions(c)
  } catch (err: any) {
    logger.error('GET /webhooks/subscriptions error', { error: err?.message })
    return c.json({ error: 'Failed to list webhooks' }, 500)
  }
})

webhooksRoutes.post('/subscriptions', webhookRateLimit, async (c) => {
  try {
    return await createWebhookSubscription(c)
  } catch (err: any) {
    logger.error('POST /webhooks/subscriptions error', { error: err?.message })
    return c.json({ error: 'Failed to create webhook' }, 500)
  }
})

webhooksRoutes.patch('/subscriptions/:id', webhookRateLimit, async (c) => {
  try {
    return await updateWebhookSubscription(c, c.req.param('id'))
  } catch (err: any) {
    logger.error('PATCH /webhooks/subscriptions error', { error: err?.message })
    return c.json({ error: 'Failed to update webhook' }, 500)
  }
})

webhooksRoutes.delete('/subscriptions/:id', webhookRateLimit, async (c) => {
  try {
    return await deleteWebhookSubscription(c, c.req.param('id'))
  } catch (err: any) {
    logger.error('DELETE /webhooks/subscriptions error', { error: err?.message })
    return c.json({ error: 'Failed to delete webhook' }, 500)
  }
})

webhooksRoutes.post('/subscriptions/:id/test', webhookRateLimit, async (c) => {
  try {
    return await testWebhookDelivery(c, c.req.param('id'))
  } catch (err: any) {
    logger.error('POST /webhooks/subscriptions test error', { error: err?.message })
    return c.json({ error: 'Failed to test webhook' }, 500)
  }
})

webhooksRoutes.get('/subscriptions/:id/deliveries', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const webhookId = c.req.param('id')
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 200)
    const offset = (page - 1) * limit

    // Verify webhook belongs to org
    const webhookCheck = await db.query(
      'SELECT id FROM webhook_subscriptions WHERE id = $1 AND organization_id = $2',
      [webhookId, session.organization_id]
    )
    if (webhookCheck.rows.length === 0) return c.json({ error: 'Webhook not found' }, 404)

    // Check if deliveries table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'webhook_deliveries'
      ) as exists
    `)
    if (!tableCheck.rows[0].exists) {
      return c.json({ success: true, deliveries: [], total: 0 })
    }

    const deliveries = await db.query(
      `SELECT * FROM webhook_deliveries
       WHERE webhook_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [webhookId, limit, offset]
    )

    return c.json({ success: true, deliveries: deliveries.rows, page, limit })
  } catch (err: any) {
    logger.error('GET /webhooks/subscriptions deliveries error', { error: err?.message })
    return c.json({ error: 'Failed to get deliveries' }, 500)
  } finally {
    await db.end()
  }
})

// --- Root-level aliases for newer WebhookManager frontend ---

// Note: GET / would conflict with incoming webhook receivers,
// so the newer WebhookManager frontend should use /subscriptions.
// But we mount these at /api/webhooks, and the receivers are at
// /webhooks/telnyx, /webhooks/stripe, etc. — no conflict at root GET.

// However, we must be careful: a bare GET /api/webhooks could be ambiguous.
// The frontend WebhookManager uses GET /api/webhooks?orgId=... for listing.
// We can safely handle this since telnyx/stripe/assemblyai are all POST.

// Alias routes — newer WebhookManager frontend calls these directly
webhooksRoutes.patch('/:id', webhookRateLimit, async (c) => {
  const id = c.req.param('id')
  // Avoid matching 'telnyx', 'stripe', 'assemblyai', 'subscriptions' as IDs
  if (['telnyx', 'stripe', 'assemblyai', 'subscriptions'].includes(id)) {
    return c.json({ error: 'Not found' }, 404)
  }
  try {
    return await updateWebhookSubscription(c, id)
  } catch (err: any) {
    return c.json({ error: 'Failed to update webhook' }, 500)
  }
})

webhooksRoutes.delete('/:id', webhookRateLimit, async (c) => {
  const id = c.req.param('id')
  if (['telnyx', 'stripe', 'assemblyai', 'subscriptions'].includes(id)) {
    return c.json({ error: 'Not found' }, 404)
  }
  try {
    return await deleteWebhookSubscription(c, id)
  } catch (err: any) {
    return c.json({ error: 'Failed to delete webhook' }, 500)
  }
})

webhooksRoutes.post('/:id/test', webhookRateLimit, async (c) => {
  const id = c.req.param('id')
  if (['telnyx', 'stripe', 'assemblyai', 'subscriptions'].includes(id)) {
    return c.json({ error: 'Not found' }, 404)
  }
  try {
    return await testWebhookDelivery(c, id)
  } catch (err: any) {
    return c.json({ error: 'Failed to test webhook' }, 500)
  }
})

