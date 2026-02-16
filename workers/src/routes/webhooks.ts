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
import { requireAuth, requireRole } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateWebhookSchema, UpdateWebhookSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { webhookRateLimit, externalWebhookRateLimit } from '../lib/rate-limit'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { translateAndStore, getTranslationConfig } from '../lib/translation-processor'
import { handleSentimentAnalysis } from '../lib/sentiment-processor'
import { handleGatherResult } from '../lib/ivr-flow-engine'
import { handleAICallEvent } from '../lib/ai-call-engine'
import { handleDialerAMD } from '../lib/dialer-engine'
import { deliverWithRetry } from '../lib/webhook-retry'
import { processCompletedTranscript } from '../lib/post-transcription-processor'
import { enqueueTranscriptionJob } from '../lib/queue-consumer'
import { logDisclosureEvent } from '../lib/compliance-checker'
import { getNextOutboundNumber } from '../lib/phone-provisioning'

export const webhooksRoutes = new Hono<AppEnv>()

// ─── PII Sanitizer for DLQ Payloads ──────────────────────────────────────

/**
 * H-5: Strip PII from webhook payloads before storing in KV DLQ.
 * Retains event structure + IDs for replay, redacts phone numbers,
 * transcripts, billing details, and personal info.
 * @see ARCH_DOCS/FORENSIC_DEEP_DIVE_REPORT.md — H-5
 */
function sanitizeDLQPayload(payload: any, source: string): Record<string, any> {
  if (!payload || typeof payload !== 'object') return { _redacted: true }

  // PII field patterns to redact
  const piiKeys = /phone|number|email|name|address|transcript|text|body|card|bank|account_number|ssn|dob|billing|audio_url|recording_url/i

  function redactObject(obj: any, depth = 0): any {
    if (depth > 5) return '[nested]'
    if (obj === null || obj === undefined) return obj
    if (typeof obj === 'string') return obj
    if (Array.isArray(obj)) return obj.map((item) => redactObject(item, depth + 1))
    if (typeof obj !== 'object') return obj

    const clean: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (piiKeys.test(key)) {
        clean[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = redactObject(value, depth + 1)
      } else {
        clean[key] = value
      }
    }
    return clean
  }

  const sanitized = redactObject(payload)
  sanitized._dlq_source = source
  sanitized._pii_redacted = true
  return sanitized
}

// ─── Dead Letter Queue (DLQ) Helper ───────────────────────────────────────

/**
 * Store failed webhook processing attempt in KV Dead Letter Queue
 * 
 * Purpose: Preserve failed webhooks for manual inspection and replay
 * Retention: 7 days (604800 seconds)
 * 
 * @param env - Workers environment with KV binding
 * @param source - Webhook source (telnyx, stripe, assemblyai)
 * @param eventType - Event type for categorization
 * @param payload - Original webhook payload
 * @param error - Error that caused the failure
 */
async function storeDLQ(
  env: Env,
  source: 'telnyx' | 'stripe' | 'assemblyai',
  eventType: string,
  payload: any,
  error: string
): Promise<void> {
  try {
    const timestamp = Date.now()
    const key = `webhook-dlq:${source}:${timestamp}`

    // H-5: Strip PII from DLQ payloads — store only metadata + event type
    // @see ARCH_DOCS/FORENSIC_DEEP_DIVE_REPORT.md — H-5: Full PII in KV DLQ
    const sanitizedPayload = sanitizeDLQPayload(payload, source)

    const dlqEntry = {
      source,
      event_type: eventType,
      payload: sanitizedPayload,
      error,
      timestamp: new Date(timestamp).toISOString(),
      replay_url: `/api/internal/webhook-dlq/replay/${source}/${timestamp}`,
    }

    await env.KV.put(key, JSON.stringify(dlqEntry), {
      expirationTtl: 604800, // 7 days
    })

    logger.info('Webhook stored in DLQ', { source, event_type: eventType, key })
  } catch (dlqError) {
    // Don't throw - DLQ failure shouldn't block webhook response
    logger.error('Failed to store webhook in DLQ', {
      error: (dlqError as Error)?.message,
      source,
      event_type: eventType,
    })
  }
}

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
webhooksRoutes.post('/telnyx', externalWebhookRateLimit, async (c) => {
  try {
    const rawBody = await c.req.text()

    // Validate body is not empty
    if (!rawBody || rawBody.trim() === '') {
      logger.warn('Telnyx webhook received empty body')
      return c.json({ error: 'Empty body not allowed' }, 400)
    }

    // BL-133: MANDATORY Telnyx Ed25519 signature verification (fail-closed)
    const telnyxPublicKey = c.env.TELNYX_PUBLIC_KEY
    if (!telnyxPublicKey) {
      logger.error('TELNYX_PUBLIC_KEY not configured - rejecting webhook')
      return c.json({ error: 'Webhook verification not configured' }, 500)
    }

    const timestamp = c.req.header('telnyx-timestamp') || c.req.header('webhook-timestamp') || ''
    const signature =
      c.req.header('telnyx-signature-ed25519') || c.req.header('webhook-signature') || ''

    if (!timestamp || !signature) {
      logger.warn('Telnyx webhook missing timestamp or signature headers', {
        ip: c.req.header('cf-connecting-ip'),
      })
      return c.json({ error: 'Missing signature headers' }, 401)
    }

    const valid = await verifyTelnyxSignature(rawBody, timestamp, signature, telnyxPublicKey)
    if (!valid) {
      logger.warn('Invalid Telnyx webhook signature', {
        ip: c.req.header('cf-connecting-ip'),
        timestamp,
        signatureLength: signature.length,
      })
      return c.json({ error: 'Invalid signature' }, 401)
    }
    logger.info('Telnyx webhook signature verified successfully')

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch (parseErr) {
      logger.warn('Telnyx webhook received invalid JSON', { error: (parseErr as Error).message })
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    // Validate required structure
    if (!body || typeof body !== 'object' || !body.data || !body.data.event_type) {
      logger.warn('Telnyx webhook received invalid body structure', {
        hasData: !!body?.data,
        eventType: body?.data?.event_type,
      })
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

        // Voice-to-voice translation: Audio playback events
        case 'call.playback.started':
          await handlePlaybackStarted(db, body.data.payload)
          break
        case 'call.playback.ended':
          await handlePlaybackEnded(c.env, db, body.data.payload)
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

        // SMS/Messaging events (Omnichannel)
        case 'message.received':
          await handleMessageReceived(c.env, db, body.data.payload)
          break
        case 'message.sent':
          await handleMessageSent(db, body.data.payload)
          break
        case 'message.delivered':
          await handleMessageDelivered(db, body.data.payload)
          break
        case 'message.failed':
          await handleMessageFailed(db, body.data.payload)
          break

        // Silently ignore other event types
      }
    } finally {
      await db.end()
    }

    return c.json({ received: true })
  } catch (err: any) {
    logger.error('Telnyx webhook processing error', { error: err?.message, stack: err?.stack })
    
    // Store in DLQ for manual inspection
    const body = await c.req.json().catch(() => ({}))
    await storeDLQ(
      c.env,
      'telnyx',
      body?.data?.event_type || 'unknown',
      body,
      err?.message || 'Unknown error'
    )
    
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// AssemblyAI transcription webhook
// BL-005: Verify webhook auth header (shared secret set during transcription submission)
// BL-006: Scoped UPDATE by organization_id via JOIN to prevent cross-tenant injection
webhooksRoutes.post('/assemblyai', externalWebhookRateLimit, async (c) => {
  try {
    // BL-005: Verify webhook authentication token (MANDATORY)
    const webhookSecret = c.env.ASSEMBLYAI_WEBHOOK_SECRET
    if (!webhookSecret) {
      logger.error('ASSEMBLYAI_WEBHOOK_SECRET not configured - rejecting webhook')
      return c.json({ error: 'Webhook verification not configured' }, 500)
    }

    const authHeader =
      c.req.header('Authorization') || c.req.header('X-AssemblyAI-Webhook-Secret') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

    // BL-SEC: Constant-time comparison to prevent timing side-channel attacks
    const encoder = new TextEncoder()
    const a = encoder.encode(token)
    const b = encoder.encode(webhookSecret)
    if (a.byteLength !== b.byteLength) {
      logger.error('AssemblyAI webhook signature verification failed')
      return c.json({ error: 'Invalid webhook authentication' }, 401)
    }
    const aKey = await crypto.subtle.importKey('raw', a, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const aSig = new Uint8Array(await crypto.subtle.sign('HMAC', aKey, b))
    const bKey = await crypto.subtle.importKey('raw', b, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const bSig = new Uint8Array(await crypto.subtle.sign('HMAC', bKey, b))
    let mismatch = 0
    for (let i = 0; i < aSig.length; i++) {
      mismatch |= aSig[i] ^ bSig[i]
    }
    if (mismatch !== 0) {
      logger.error('AssemblyAI webhook signature verification failed')
      return c.json({ error: 'Invalid webhook authentication' }, 401)
    }

    const body = await c.req.json()
    const { transcript_id, status, text } = body

    if (status === 'completed' && text) {
      const db = getDb(c.env)
      try {
        // BL-006: Organization-scoped update to prevent cross-tenant transcript injection
        // Prefer to scope updates to a concrete organization_id to avoid cross-tenant updates.
        const callOrgLookup = await db.query(
          `SELECT id, organization_id FROM calls WHERE transcript_id = $1 LIMIT 1`,
          [transcript_id]
        )

        let callId: string | null = null
        let orgId: string | null = null

        if (callOrgLookup.rows.length > 0) {
          callId = callOrgLookup.rows[0].id
          orgId = callOrgLookup.rows[0].organization_id
          const result = await db.query(
            `UPDATE calls 
             SET transcript = $1, transcript_status = 'completed', updated_at = NOW()
             WHERE transcript_id = $2 AND organization_id = $3`,
            [text, transcript_id, orgId]
          )
          if (result.rowCount === 0) {
            logger.warn('AssemblyAI webhook: no matching call found for transcript_id scoped to org', {
              transcript_id,
              organization_id: orgId,
            })
          }
        } else {
          // Fallback: attempt best-effort update (legacy behavior) if we couldn't resolve org
          const result = await db.query(
            `UPDATE calls 
             SET transcript = $1, transcript_status = 'completed', updated_at = NOW()
             WHERE transcript_id = $2 AND organization_id IS NOT NULL
             RETURNING id, organization_id`,
            [text, transcript_id]
          )
          if (result.rowCount === 0) {
            logger.warn('AssemblyAI webhook: no matching call found for transcript_id', { transcript_id })
          } else {
            callId = result.rows[0].id
            orgId = result.rows[0].organization_id
          }
        }

        // Post-transcription enrichment pipeline (fire-and-forget)
        // Extracts: speaker utterances, auto-highlights, sentiment, AI summary
        if (callId && orgId) {
          processCompletedTranscript(c.env, db, {
            callId,
            organizationId: orgId,
            transcriptText: text,
            payload: body,
          }).catch((err) => {
            logger.warn('Post-transcription processing failed (non-fatal)', {
              callId,
              error: (err as Error)?.message,
            })
          })
        }
      } finally {
        await db.end()
      }
    }

    return c.json({ received: true })
  } catch (err: any) {
    logger.error('AssemblyAI webhook processing error')
    
    // Store in DLQ for manual inspection
    const body = await c.req.json().catch(() => ({}))
    await storeDLQ(
      c.env,
      'assemblyai',
      body?.status || 'unknown',
      body,
      err?.message || 'Unknown error'
    )
    
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// Stripe billing webhook — verified via HMAC-SHA256 signature
webhooksRoutes.post('/stripe', externalWebhookRateLimit, async (c) => {
  // M-4 fix: Verify signature BEFORE opening DB connection.
  // Unsigned webhook spam no longer exhausts the connection pool.
  const signature = c.req.header('stripe-signature')
  const body = await c.req.text()

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

  const db = getDb(c.env)
  try {

    const event = JSON.parse(body)

    // Stripe event deduplication — use existing stripe_events table
    // Prevents duplicate processing from Stripe webhook retries
    if (event.id) {
      const dupeCheck = await db.query(
        `SELECT id FROM stripe_events WHERE stripe_event_id = $1 AND processed = true LIMIT 1`,
        [event.id]
      )
      if (dupeCheck.rows.length > 0) {
        logger.info('Stripe webhook duplicate skipped', { eventId: event.id, type: event.type })
        return c.json({ received: true, duplicate: true })
      }

      // Record event as being processed
      const orgLookup = await db.query(
        `SELECT id FROM organizations WHERE stripe_customer_id = $1 LIMIT 1`,
        [event.data?.object?.customer || '']
      )
      await db.query(
        `INSERT INTO stripe_events (stripe_event_id, event_type, organization_id, data, processed, created_at)
         VALUES ($1, $2, $3, $4::jsonb, false, NOW())
         ON CONFLICT (stripe_event_id) DO NOTHING`,
        [event.id, event.type, orgLookup.rows[0]?.id || null, JSON.stringify(event.data || {})]
      ).catch((err) => logger.warn('stripe_events insert failed (non-fatal)', { error: (err as Error)?.message }))
    }

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
      case 'payment_method.attached':
        await handlePaymentMethodAttached(db, event.data.object)
        break
      case 'payment_method.detached':
        await handlePaymentMethodDetached(db, event.data.object)
        break
      // Silently ignore other event types
    }

    // Mark event as processed for dedup
    if (event.id) {
      await db.query(
        `UPDATE stripe_events SET processed = true, processed_at = NOW() WHERE stripe_event_id = $1`,
        [event.id]
      ).catch(() => { /* non-fatal */ })
    }

    return c.json({ received: true })
  } catch (err: any) {
    logger.error('Stripe webhook processing error')
    
    // Store in DLQ for manual inspection
    const event = JSON.parse(await c.req.text()).catch(() => ({}))
    await storeDLQ(
      c.env,
      'stripe',
      event?.type || 'unknown',
      event,
      err?.message || 'Unknown error'
    )
    
    return c.json({ error: 'Webhook processing failed' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /resend — Resend Email Delivery Events ────────────────────────────

/**
 * Resend webhook handler for email deliverability tracking.
 * Events: email.sent, email.delivered, email.delivery_failed,
 *         email.complained, email.opened, email.clicked
 * 
 * @see https://resend.com/docs/dashboard/webhooks/event-types
 */
webhooksRoutes.post('/resend', externalWebhookRateLimit, async (c) => {
  try {
    const body = await c.req.json()
    const { type, data } = body

    if (!type || !data) {
      logger.warn('Resend webhook: missing type or data', { body })
      return c.json({ error: 'Invalid webhook payload' }, 400)
    }

    const db = getDb(c.env)

    try {
      const { emailId, messageId, from, to, subject, createdAt } = data

      // Find message in DB by external_message_id (Resend email ID)
      const messageResult = await db.query(
        `SELECT id, organization_id, account_id, campaign_id FROM messages
         WHERE external_message_id = $1
         LIMIT 1`,
        [emailId || messageId]
      )

      if (messageResult.rows.length === 0) {
        logger.warn('Resend webhook: message not found', { emailId, messageId, type })
        // Still return 200 to prevent Resend retries
        return c.json({ received: true, warning: 'Message not found' })
      }

      const message = messageResult.rows[0]

      // Update message status based on event type
      switch (type) {
        case 'email.sent':
          await db.query(
            `UPDATE messages
             SET status = 'sent', sent_at = $1, updated_at = NOW()
             WHERE id = $2 AND organization_id = $3`,
            [createdAt || new Date().toISOString(), message.id, message.organization_id]
          )

          // Audit log
          writeAuditLog(db, {
            organizationId: message.organization_id,
            userId: 'system',
            resourceType: 'messages',
            resourceId: message.id,
            action: AuditAction.EMAIL_SENT,
            newValue: { status: 'sent', external_message_id: emailId },
          }, c.env.KV)
          break

        case 'email.delivered':
          await db.query(
            `UPDATE messages
             SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND organization_id = $2`,
            [message.id, message.organization_id]
          )

          // Audit log
          writeAuditLog(db, {
            organizationId: message.organization_id,
            userId: 'system',
            resourceType: 'messages',
            resourceId: message.id,
            action: AuditAction.EMAIL_DELIVERED,
            newValue: { status: 'delivered' },
          }, c.env.KV)
          break

        case 'email.delivery_failed':
        case 'email.bounced':
          const bounceType = data.bounceType || 'unknown' // hard, soft, transient
          await db.query(
            `UPDATE messages
             SET status = 'bounced',
                 metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
                 updated_at = NOW()
             WHERE id = $2 AND organization_id = $3`,
            [JSON.stringify({ bounce_type: bounceType, bounce_reason: data.reason || 'unknown' }), message.id, message.organization_id]
          )

          // Add to email suppression list if hard bounce
          if (bounceType === 'hard' && message.account_id) {
            await db.query(
              `INSERT INTO opt_out_requests
               (account_id, request_type, channel, reason, source, created_at)
               VALUES ($1, 'suppression', 'email', 'hard_bounce', 'resend_webhook', NOW())
               ON CONFLICT (account_id, channel) DO NOTHING`,
              [message.account_id]
            )
          }

          // Audit log
          writeAuditLog(db, {
            organizationId: message.organization_id,
            userId: 'system',
            resourceType: 'messages',
            resourceId: message.id,
            action: AuditAction.EMAIL_BOUNCED,
            newValue: { status: 'bounced', bounce_type: bounceType },
          }, c.env.KV)
          break

        case 'email.complained':
          // Spam complaint — auto-unsubscribe
          await db.query(
            `UPDATE messages
             SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"spam_complaint": true}'::jsonb,
                 updated_at = NOW()
             WHERE id = $1 AND organization_id = $2`,
            [message.id, message.organization_id]
          )

          // Unsubscribe account from all email
          if (message.account_id) {
            await db.query(
              `UPDATE collection_accounts
               SET email_consent = false,
                   updated_at = NOW()
               WHERE id = $1 AND organization_id = $2`,
              [message.account_id, message.organization_id]
            )

            // Record opt-out
            await db.query(
              `INSERT INTO opt_out_requests
               (account_id, request_type, channel, reason, source, created_at)
               VALUES ($1, 'opt_out', 'email', 'spam_complaint', 'resend_webhook', NOW())
               ON CONFLICT (account_id, channel) DO UPDATE SET created_at = NOW()`,
              [message.account_id]
            )
          }

          // Audit log
          writeAuditLog(db, {
            organizationId: message.organization_id,
            userId: 'system',
            resourceType: 'messages',
            resourceId: message.id,
            action: AuditAction.EMAIL_SPAM_COMPLAINT,
            newValue: { spam_complaint: true, account_id: message.account_id },
          }, c.env.KV)
          break

        case 'email.opened':
          await db.query(
            `UPDATE messages
             SET opened_at = $1,
                 metadata = COALESCE(metadata, '{}'::jsonb) || '{"opened": true}'::jsonb,
                 updated_at = NOW()
             WHERE id = $2 AND organization_id = $3`,
            [createdAt || new Date().toISOString(), message.id, message.organization_id]
          )

          // Audit log
          writeAuditLog(db, {
            organizationId: message.organization_id,
            userId: 'system',
            resourceType: 'messages',
            resourceId: message.id,
            action: AuditAction.EMAIL_OPENED,
            newValue: { opened_at: createdAt },
          }, c.env.KV)
          break

        case 'email.clicked':
          const clickedUrl = data.link || 'unknown'
          await db.query(
            `UPDATE messages
             SET clicked_at = $1,
                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                 updated_at = NOW()
             WHERE id = $3 AND organization_id = $4`,
            [
              createdAt || new Date().toISOString(),
              JSON.stringify({ clicked: true, clicked_url: clickedUrl }),
              message.id,
              message.organization_id
            ]
          )

          // Audit log
          writeAuditLog(db, {
            organizationId: message.organization_id,
            userId: 'system',
            resourceType: 'messages',
            resourceId: message.id,
            action: AuditAction.EMAIL_CLICKED,
            newValue: { clicked_at: createdAt, clicked_url: clickedUrl },
          }, c.env.KV)
          break

        default:
          logger.info('Resend webhook: unhandled event type', { type })
      }

      logger.info('Resend webhook processed', { type, emailId, messageId })
      return c.json({ received: true })
    } catch (err) {
      logger.error('Resend webhook processing error', { error: (err as Error)?.message, type })
      return c.json({ error: 'Webhook processing failed' }, 500)
    } finally {
      await db.end()
    }
  } catch (err) {
    logger.error('Resend webhook parse error', { error: (err as Error)?.message })
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }
})

// --- Telnyx Handlers ---

async function handleCallInitiated(db: DbClient, payload: any) {
  const { call_control_id, call_session_id, from, to } = payload

  // First try to update existing call. Prefer scoping by organization when possible.
  const callOrg = await db.query(
    `SELECT organization_id FROM calls WHERE call_control_id = $1 OR call_sid = $2 LIMIT 1`,
    [call_control_id, call_session_id]
  )

  if (callOrg.rows.length > 0) {
    const orgId = callOrg.rows[0].organization_id
    const updateResult = await db.query(
      `UPDATE calls
       SET call_sid = $1, status = 'initiated'
       WHERE call_control_id = $2 AND organization_id = $3`,
      [call_session_id, call_control_id, orgId]
    )

    if (updateResult.rowCount && updateResult.rowCount > 0) {
      // Successfully updated existing call
      return
    }
  }

  // Fallback: attempt legacy best-effort update if no org was resolvable
  const updateResult = await db.query(
    `UPDATE calls
     SET call_sid = $1, status = 'initiated'
     WHERE call_control_id = $2 AND organization_id IS NOT NULL`,
    [call_session_id, call_control_id]
  )

  if (updateResult.rowCount && updateResult.rowCount > 0) {
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
      to,
    })
  } else {
    // No bridge match — check if this is an inbound call to a configured DID
    const inboundResult = await db.query(
      `SELECT ipn.organization_id, ipn.auto_record, ipn.auto_transcribe, ipn.greeting_text,
              ipn.routing_type, ipn.routing_target_id, ipn.label
       FROM inbound_phone_numbers ipn
       WHERE ipn.phone_number = $1 AND ipn.is_active = true
       LIMIT 1`,
      [to]
    )

    if (inboundResult.rows.length > 0) {
      const inboundConfig = inboundResult.rows[0]

      // Create inbound call record with org from DID mapping
      await db.query(
        `INSERT INTO calls (
          organization_id,
          call_sid,
          call_control_id,
          status,
          from_number,
          to_number,
          flow_type,
          direction,
          created_at
        ) VALUES ($1, $2, $3, 'initiated', $4, $5, 'inbound', 'inbound', NOW())`,
        [inboundConfig.organization_id, call_session_id, call_control_id, from, to]
      )

      logger.info('Created database record for inbound call via DID mapping', {
        call_control_id,
        from,
        to,
        organization_id: inboundConfig.organization_id,
        routing_type: inboundConfig.routing_type,
        did_label: inboundConfig.label,
      })
    } else {
      // No DID mapping found — try to match caller (from) to an existing account
      const accountMatch = await db.query(
        `SELECT a.organization_id
         FROM collection_accounts a
         WHERE (a.primary_phone = $1 OR a.secondary_phone = $1)
         AND a.organization_id IS NOT NULL
         AND a.is_deleted = false
         LIMIT 1`,
        [from]
      )

      if (accountMatch.rows.length > 0) {
        await db.query(
          `INSERT INTO calls (
            organization_id,
            call_sid,
            call_control_id,
            status,
            from_number,
            to_number,
            flow_type,
            direction,
            created_at
          ) VALUES ($1, $2, $3, 'initiated', $4, $5, 'inbound', 'inbound', NOW())`,
          [accountMatch.rows[0].organization_id, call_session_id, call_control_id, from, to]
        )

        logger.info('Created inbound call record via account phone match', {
          call_control_id,
          from,
          to,
          organization_id: accountMatch.rows[0].organization_id,
        })
      } else {
        logger.warn('webhook-update-no-match: no bridge, DID, or account match found', {
          call_control_id,
          from,
          to,
        })
      }
    }
  }
}

async function handleCallAnswered(env: Env, db: DbClient, payload: any) {
  const { call_control_id, call_session_id, client_state, from, to } = payload

  // Decode client_state to check for test-call flag
  let callClientState: any = {}
  if (client_state) {
    try {
      callClientState = JSON.parse(atob(client_state))
    } catch {
      callClientState = {}
    }
  }

  logger.info('Telnyx webhook: call.answered', {
    call_control_id,
    call_session_id,
    is_test: !!callClientState.is_test,
    flow: callClientState.flow,
    from,
    to,
  })

  const result = await db.query(
    `UPDATE calls 
     SET status = 'in_progress', answered_at = NOW(), updated_at = NOW()
     WHERE (call_sid = $1 OR call_control_id = $2) AND organization_id IS NOT NULL
     RETURNING id, flow_type, to_number, from_number, organization_id, campaign_id`,
    [call_session_id, call_control_id]
  )
  if (result.rowCount === 0) {
    logger.warn('webhook-update-no-match', { call_control_id, handler: 'handleCallAnswered' })
    return
  }

  const call = result.rows[0]

  // Audit log call answered
  writeAuditLog(db, {
    organizationId: call.organization_id,
    userId: 'system',
    action: AuditAction.CALL_ANSWERED,
    resourceType: 'call',
    resourceId: call.id,
    oldValue: { status: 'initiated' },
    newValue: { status: 'in_progress', answered_at: new Date().toISOString() },
  })

  // ──── TEST CALL TTS ────────────────────────────────────────────────────────
  // If this call was flagged as a test, play the announcement and hang up.
  if (callClientState.is_test && env.TELNYX_API_KEY) {
    logger.info('Test call answered — playing TTS announcement', { call_control_id })
    fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/speak`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: 'WORD IS BOND TEST CALL. THANKS.',
        voice: 'female',
        language: 'en-US',
        client_state: btoa(JSON.stringify({ flow: 'test_call_hangup' })),
      }),
    }).catch((err) => {
      logger.warn('Test call TTS speak failed (non-fatal)', {
        error: (err as Error)?.message,
      })
    })
    return // Skip all other call-answered logic for test calls
  }

  // Handle bridge calls: when agent answers, create customer call and bridge
  if (call.flow_type === 'bridge' && call.to_number && env.TELNYX_API_KEY) {
    logger.info('Bridge call: agent answered, creating customer call', {
      callControlId: call_control_id,
      customerNumber: call.to_number,
      agentNumber: call.from_number,
      hasApiKey: !!env.TELNYX_API_KEY,
      telnyxConnectionId: !!env.TELNYX_CONNECTION_ID,
      telnyxAppId: !!env.TELNYX_CALL_CONTROL_APP_ID,
      telnyxNumber: !!env.TELNYX_NUMBER,
    })
    try {
      // Check org voice config to determine if transcription should be enabled
      const bridgeVoiceConfig = call.organization_id
        ? (
            await db.query(
              `SELECT live_translate, voice_to_voice, transcribe FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
              [call.organization_id]
            )
          ).rows[0]
        : null
      const enableBridgeTranscription =
        bridgeVoiceConfig?.live_translate ||
        bridgeVoiceConfig?.voice_to_voice ||
        bridgeVoiceConfig?.transcribe

      // Create a new call to the customer
      // IMPORTANT: `from` MUST be a Telnyx-owned number, not the agent's personal phone.
      // call.from_number is the agent's phone (the first leg destination), so use org pool or global TELNYX_NUMBER.
      const bridgeFrom = call.organization_id
        ? await getNextOutboundNumber(db, call.organization_id, env.TELNYX_NUMBER)
        : env.TELNYX_NUMBER
      const customerCallPayload: Record<string, unknown> = {
        to: call.to_number,
        from: bridgeFrom,
        connection_id: env.TELNYX_CALL_CONTROL_APP_ID, // Use Call Control App ID for programmatic calls
        timeout_secs: 30,
        webhook_url: `${env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/webhooks/telnyx`,
        webhook_url_method: 'POST',
      }

      // Only enable transcription if org has translation/transcription features enabled
      if (enableBridgeTranscription) {
        customerCallPayload.transcription = true
        customerCallPayload.transcription_config = {
          transcription_engine: 'B',
          transcription_tracks: 'both',
        }
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
        const customerCallData = (await createCallResponse.json()) as {
          data: { call_control_id: string }
        }
        const customerCallControlId = customerCallData.data.call_control_id
        logger.info('Customer call created successfully, deferring bridge until customer answers', {
          customerCallControlId,
          agentCallControlId: call_control_id,
        })

        // Store the pending bridge relationship on the AGENT's call record (which already exists).
        // When the customer call fires call.answered as a bridge_customer, we look up
        // the agent call by bridge_partner_id to execute the bridge.
        // Scope the bridge_partner update to the call's organization when possible
        const partnerOrg = await db.query(
          `SELECT organization_id FROM calls WHERE call_control_id = $1 LIMIT 1`,
          [call_control_id]
        )
        if (partnerOrg.rows.length > 0) {
          await db.query(
            `UPDATE calls
             SET bridge_partner_id = $1
             WHERE call_control_id = $2 AND organization_id = $3`,
            [customerCallControlId, call_control_id, partnerOrg.rows[0].organization_id]
          )
        } else {
          await db.query(
            `UPDATE calls
             SET bridge_partner_id = $1
             WHERE call_control_id = $2 AND organization_id IS NOT NULL`,
            [customerCallControlId, call_control_id]
          )
        }
      } else {
        const errorText = await createCallResponse.text()
        logger.error('Customer call creation failed', {
          status: createCallResponse.status,
          response: errorText.slice(0, 500),
        })
      }
    } catch (err) {
      logger.error('Bridge call failed with exception', {
        error: (err as Error)?.message,
        stack: (err as Error)?.stack,
      })
    }
  } else if (call.flow_type === 'bridge_customer') {
    // This is the customer leg answering — now bridge the two calls!
    logger.info('Bridge: customer answered, executing bridge action', {
      customerCallControlId: call_control_id,
    })

    try {
      // Find the agent's call by looking for bridge_partner_id = this customer's call_control_id
      // The agent's call record has bridge_partner_id set to the customer's call_control_id
      const partnerResult = await db.query(
        `SELECT call_control_id FROM calls
         WHERE bridge_partner_id = $1 AND organization_id IS NOT NULL`,
        [call_control_id]
      )

      const agentCallControlId = partnerResult.rows[0]?.call_control_id
      if (!agentCallControlId) {
        logger.error('Bridge: no agent partner found for customer call', {
          customerCallControlId: call_control_id,
        })
        return
      }

      // Bridge the agent call to the customer call
      const bridgeResponse = await fetch(
        `https://api.telnyx.com/v2/calls/${agentCallControlId}/actions/bridge`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            call_control_id: call_control_id,
          }),
        }
      )

        if (bridgeResponse.ok) {
        logger.info('Bridge executed successfully', {
          agentCallControlId,
          customerCallControlId: call_control_id,
        })

        // Update both calls to 'bridged' scoped to the organization we resolved earlier (if any)
        const orgLookup = await db.query(
          `SELECT organization_id FROM calls WHERE call_control_id = $1 OR call_control_id = $2 LIMIT 1`,
          [agentCallControlId, call_control_id]
        )
        if (orgLookup.rows.length > 0) {
          const orgId = orgLookup.rows[0].organization_id
          await db.query(
            `UPDATE calls SET status = 'bridged', updated_at = NOW()` +
              ` WHERE call_control_id IN ($1, $2) AND organization_id = $3`,
            [agentCallControlId, call_control_id, orgId]
          )
        } else {
          await db.query(
            `UPDATE calls SET status = 'bridged', updated_at = NOW()` +
              ` WHERE call_control_id IN ($1, $2) AND organization_id IS NOT NULL`,
            [agentCallControlId, call_control_id]
          )
        }
      } else {
        const bridgeErrorText = await bridgeResponse.text()
        logger.error('Bridge action failed', {
          status: bridgeResponse.status,
          response: bridgeErrorText.slice(0, 500),
          agentCallControlId,
          customerCallControlId: call_control_id,
        })
      }
    } catch (err) {
      logger.error('Bridge execution failed with exception', {
        error: (err as Error)?.message,
        stack: (err as Error)?.stack,
      })
    }
  } else if (call.flow_type === 'inbound') {
    // Inbound call answered — start recording and play disclosure if configured
    logger.info('Inbound call answered', {
      call_control_id,
      from: call.from_number,
      to: call.to_number,
      organization_id: call.organization_id,
    })

    try {
      // Lookup DID config for recording + greeting
      const didConfig = await db.query(
        `SELECT auto_record, auto_transcribe, greeting_text
         FROM inbound_phone_numbers
         WHERE phone_number = $1 AND organization_id = $2 AND is_active = true
         LIMIT 1`,
        [call.to_number, call.organization_id]
      )

      const config = didConfig.rows[0]

      // Start recording if configured (or default to org voice_config)
      if (config?.auto_record !== false && env.TELNYX_API_KEY) {
        fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/record_start`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            format: 'mp3',
            channels: 'dual',
          }),
        }).catch((err) => {
          logger.warn('Inbound call record_start failed (non-fatal)', {
            error: (err as Error)?.message,
          })
        })
      }

      // Play greeting text if configured
      if (config?.greeting_text && env.TELNYX_API_KEY) {
        fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/speak`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payload: config.greeting_text,
            voice: 'female',
            language: 'en-US',
          }),
        }).catch((err) => {
          logger.warn('Inbound greeting speak failed (non-fatal)', {
            error: (err as Error)?.message,
          })
        })
      }
    } catch (err) {
      logger.warn('Inbound call post-answer setup failed (non-fatal)', {
        error: (err as Error)?.message,
      })
    }
  } else if ((call.flow_type === 'direct' || call.campaign_id) && env.TELNYX_API_KEY) {
    // Outbound collections call — play Mini-Miranda disclosure (FDCPA §1692e(11))
    const miniMirandaText =
      'This is an attempt to collect a debt and any information obtained will be used for that purpose. This call may be recorded for quality assurance.'

    logger.info('Mini-Miranda disclosure playing on outbound collections call', {
      call_control_id,
      flow_type: call.flow_type,
      campaign_id: call.campaign_id,
    })

    fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/speak`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: miniMirandaText,
        voice: 'female',
        language: 'en-US',
      }),
    }).catch((err) => {
      logger.warn('Mini-Miranda speak failed (non-fatal)', { error: (err as Error)?.message })
    })

    // Log Mini-Miranda disclosure to compliance audit trail
    logDisclosureEvent(db, {
      organizationId: call.organization_id,
      callId: call.id,
      accountId: null,
      disclosureType: 'mini_miranda',
      disclosureText: miniMirandaText,
    }).catch(() => {
      /* non-fatal */
    })
  } else {
    logger.warn('Unhandled call flow type at answer', {
      flowType: call.flow_type,
      hasToNumber: !!call.to_number,
      hasApiKey: !!env.TELNYX_API_KEY,
    })
  }

  // AI Role Policy: Disclose AI-assisted features at call start
  // If live translation is enabled for this call's org, play a brief disclosure
  try {
    const callResult = await db.query(
      `SELECT c.id, c.organization_id, c.account_id FROM calls c
       WHERE (c.call_sid = $1 OR c.call_control_id = $2) AND c.organization_id IS NOT NULL
       LIMIT 1`,
      [call_session_id, call_control_id]
    )
    if (callResult.rows.length > 0) {
      const translationConfig = await getTranslationConfig(db, callResult.rows[0].organization_id)
      if (translationConfig?.live_translate && env.TELNYX_API_KEY) {
        const disclosureText = 'This call is using AI-assisted live translation for quality and accessibility purposes.'
        // Non-blocking: Play AI disclosure via Telnyx speak command
        fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/speak`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payload: disclosureText,
            voice: 'female',
            language: 'en-US',
          }),
        }).catch((err) => {
          logger.warn('AI disclosure speak failed (non-fatal)', { error: (err as Error)?.message })
        })

        // Log disclosure to compliance_events + disclosure_logs + calls columns
        logDisclosureEvent(db, {
          organizationId: callResult.rows[0].organization_id,
          callId: callResult.rows[0].id,
          accountId: callResult.rows[0].account_id || null,
          disclosureType: 'ai_translation',
          disclosureText,
        }).catch(() => { /* non-fatal */ })
      }
    }
  } catch {
    // Non-fatal — disclosure failure should never block call
  }
}

async function handleCallHangup(db: DbClient, payload: any) {
  const { call_control_id, call_session_id, hangup_cause, client_state } = payload

  // Decode client_state
  let callMetadata: any = {}
  if (client_state) {
    try {
      callMetadata = JSON.parse(atob(client_state))
    } catch {
      callMetadata = {}
    }
  }

  logger.info('Telnyx webhook: call.hangup', {
    call_control_id,
    call_session_id,
    hangup_cause,
    flow: callMetadata.flow,
  })

  const result = await db.query(
    `UPDATE calls 
     SET status = 'completed', ended_at = NOW(), hangup_cause = $3, updated_at = NOW()
     WHERE (call_sid = $1 OR call_control_id = $2) AND organization_id IS NOT NULL
     RETURNING id, organization_id, campaign_id, duration`,
    [call_session_id, call_control_id, hangup_cause]
  )
  if (result.rowCount === 0) {
    logger.warn('webhook-update-no-match', { call_control_id, handler: 'handleCallHangup' })
    return
  }

  const call = result.rows[0]

  // Audit log call hangup
  writeAuditLog(db, {
    organizationId: call.organization_id,
    userId: 'system',
    action: AuditAction.CALL_ENDED,
    resourceType: 'call',
    resourceId: call.id,
    oldValue: { status: 'in_progress' },
    newValue: { status: 'completed', hangup_cause, ended_at: new Date().toISOString() },
  })

  // Update campaign_call if this was a dialer call
  if (call.campaign_id && callMetadata.campaign_call_id) {
    await db.query(
      `UPDATE campaign_calls
       SET status = 'completed', updated_at = NOW()
       WHERE id = $1 AND campaign_id IN (SELECT id FROM campaigns WHERE organization_id = $2)`,
      [callMetadata.campaign_call_id, call.organization_id]
    ).catch((err) => {
      logger.warn('Failed to update campaign_call on hangup', {
        error: err?.message,
        campaign_call_id: callMetadata.campaign_call_id,
      })
    })
  }

  // Release agent from dialer queue if applicable
  if (callMetadata.flow === 'dialer' && callMetadata.agent_user_id) {
    await db.query(
      `UPDATE dialer_agent_status
       SET status = 'wrap_up', current_call_id = NULL, last_call_ended_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND organization_id = $2`,
      [callMetadata.agent_user_id, call.organization_id]
    ).catch((err) => {
      logger.warn('Failed to update agent status on hangup', {
        error: err?.message,
        agent_user_id: callMetadata.agent_user_id,
      })
    })
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
       WHERE call_sid = $1 AND organization_id IS NOT NULL
       RETURNING id, organization_id`,
      [call_session_id, key]
    )
    
    if (result.rowCount === 0) {
      logger.warn('webhook-update-no-match', { call_session_id, handler: 'handleRecordingSaved' })
      return
    }

    const call = result.rows[0]
    const callId = call.id
    const orgId = call.organization_id

    // Check if organization has transcription enabled
    const configResult = await db.query(
      `SELECT transcribe FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
      [orgId]
    )

    const shouldTranscribe = configResult.rows[0]?.transcribe === true
    
    if (shouldTranscribe && env.ASSEMBLYAI_API_KEY) {
      // Try queue-based processing first (resilient, async)
      // Falls back to inline submission if queue is unavailable
      const enqueued = await enqueueTranscriptionJob(env, {
        type: 'submit_transcription',
        callId,
        organizationId: orgId,
        recordingR2Key: key,
      })

      if (enqueued) {
        // Job enqueued — update status to 'queued' and return
        await db.query(
          `UPDATE calls SET transcript_status = 'queued', updated_at = NOW() WHERE id = $1`,
          [callId]
        )
        logger.info('Transcription job enqueued', { callId, organization_id: orgId })
      } else {
        // Queue unavailable — fall back to inline submission
        try {
          const recordingUrl = env.R2_PUBLIC_URL 
            ? `${env.R2_PUBLIC_URL}/${key}`
            : `${env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/recordings/stream/${callId}`

          const webhookUrl = `${env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/webhooks/assemblyai`

          const assemblyRes = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
              Authorization: env.ASSEMBLYAI_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audio_url: recordingUrl,
              webhook_url: webhookUrl,
              speaker_labels: true,
              speakers_expected: 2,
              auto_highlights: true,
              sentiment_analysis: true,
              entity_detection: true,
              content_safety: true,
              dual_channel: true,
              ...(env.ASSEMBLYAI_WEBHOOK_SECRET
                ? {
                    webhook_auth_header_name: 'Authorization',
                    webhook_auth_header_value: env.ASSEMBLYAI_WEBHOOK_SECRET,
                  }
                : {}),
            }),
          })

          if (assemblyRes.ok) {
            const assemblyData = await assemblyRes.json<{ id: string }>()
            
            await db.query(
              `UPDATE calls 
               SET transcript_status = 'pending', transcript_id = $1, updated_at = NOW()
               WHERE id = $2`,
              [assemblyData.id, callId]
            )

            logger.info('Auto-submitted recording for transcription (inline fallback)', {
              callId,
              transcriptId: assemblyData.id,
              organization_id: orgId,
            })
          } else {
            const errText = await assemblyRes.text()
            logger.error('AssemblyAI auto-submission failed', {
              callId,
              status: assemblyRes.status,
              error: errText,
            })
            
            await db.query(
              `UPDATE calls SET transcript_status = 'failed', updated_at = NOW() WHERE id = $1`,
              [callId]
            )
          }
        } catch (err) {
          logger.error('Transcription submission exception', {
            callId,
            error: (err as Error)?.message,
          })
          
          await db.query(
            `UPDATE calls SET transcript_status = 'failed', updated_at = NOW() WHERE id = $1`,
            [callId]
          )
        }
      }
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

  // Store raw transcript segment for Cockpit live-transcript polling
  try {
    const segCountResult = await db.query(
      `SELECT COALESCE(MAX(segment_index), -1) + 1 AS next_index
       FROM call_transcript_segments
       WHERE call_id = $1 AND organization_id = $2`,
      [callId, orgId]
    )
    const nextSegIndex = segCountResult.rows[0]?.next_index ?? 0
    const speaker = transcription_data?.channel === 'inbound' ? 'customer' : 'agent'
    await db.query(
      `INSERT INTO call_transcript_segments (call_id, organization_id, speaker, content, confidence, segment_index)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [callId, orgId, speaker, transcript, confidence, nextSegIndex]
    )
  } catch (segErr) {
    logger.warn('Failed to store transcript segment', { callId, error: (segErr as Error)?.message })
  }

  // If this is a bridge customer call, associate transcription with the main bridge call
  if (flow_type === 'bridge_customer') {
    const bridgeCallResult = await db.query(
      `SELECT id FROM calls
       WHERE flow_type = 'bridge'
       AND status IN ('in_progress', 'answered', 'completed', 'bridged')
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
        mainCallId: callId,
      })
    } else {
      logger.warn('Bridge customer transcription: no main bridge call found', {
        customerCallId: callResult.rows[0].id,
        from: callResult.rows[0].from_number,
        to: callResult.rows[0].to_number,
      })
    }
  }

  // Get translation config for this org
  const translationConfig = await getTranslationConfig(db, orgId)
  if (!translationConfig || !translationConfig.live_translate) {
    // Translation not enabled — skip (transcription may still be stored for post-call use)
    return
  }

  // Check if voice-to-voice translation is enabled
  const voiceConfigResult = await db.query(
    `SELECT voice_to_voice, elevenlabs_api_key FROM voice_configs
     WHERE organization_id = $1
     LIMIT 1`,
    [orgId]
  )
  const voiceConfig = voiceConfigResult.rows[0]
  const voiceToVoiceEnabled = voiceConfig?.voice_to_voice === true
  const elevenlabsKey = voiceConfig?.elevenlabs_api_key

  // Determine segment index — get current max for this call
  const indexResult = await db.query(
    `SELECT COALESCE(MAX(segment_index), -1) + 1 AS next_index
     FROM call_translations
     WHERE call_id = $1 AND organization_id = $2`,
    [callId, orgId]
  )
  const segmentIndex = indexResult.rows[0]?.next_index ?? 0

  // For voice-to-voice, we need to determine which call leg this transcription came from
  // and which leg should receive the translated audio
  let targetCallControlId: string | undefined
  if (voiceToVoiceEnabled) {
    // Find the other call leg in a bridge scenario
    // Uses call_session_id for precise matching when available, falls back to number pair matching
    const otherLegResult = await db.query(
      `SELECT call_control_id FROM calls
       WHERE flow_type IN ('bridge', 'bridge_customer')
       AND status IN ('in_progress', 'answered')
       AND id != $1
       AND organization_id = $4
       AND (
         call_session_id = $5
         OR ((from_number = $2 AND to_number = $3) OR (from_number = $3 AND to_number = $2))
       )
       ORDER BY
         CASE WHEN call_session_id = $5 THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 1`,
      [callId, callResult.rows[0].from_number, callResult.rows[0].to_number, orgId, call_session_id]
    )

    if (otherLegResult.rows.length > 0) {
      targetCallControlId = otherLegResult.rows[0].call_control_id
      logger.info('Voice-to-voice target leg found', {
        callId,
        targetCallControlId,
        sourceCallControlId: call_control_id,
      })
    } else {
      // For direct (non-bridge) calls, inject back into the same call
      // This allows the caller to hear the translated audio of the other party
      targetCallControlId = call_control_id
      logger.info('Voice-to-voice: using same call leg for direct call', {
        callId,
        callControlId: call_control_id,
      })
    }
  }

  // Translate and store — this calls OpenAI and optionally TTS + audio injection
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
    voiceToVoice: voiceToVoiceEnabled && !!targetCallControlId,
    elevenlabsKey: elevenlabsKey || undefined,
    telnyxKey: env.TELNYX_API_KEY,
    targetCallControlId,
    r2Client: env.R2,
    r2PublicUrl: env.R2_PUBLIC_URL,
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

  // Fetch call details for audit logging (BL-VOICE-002)
  const callResult = await db.query(
    `SELECT id, organization_id FROM calls WHERE call_control_id = $1`,
    [call_control_id]
  )
  const callRecord = callResult.rows[0]

  if (flowContext.flow === 'ivr_payment') {
    await handleGatherResult(db, call_control_id, gatherResult, status, env, flowContext)

    // Audit log IVR DTMF collection (BL-VOICE-002)
    if (callRecord) {
      writeAuditLog(db, {
        organizationId: callRecord.organization_id,
        userId: 'system',
        action: AuditAction.IVR_DTMF_COLLECTED,
        resourceType: 'call',
        resourceId: callRecord.id,
        oldValue: null,
        newValue: { flow: 'ivr_payment', status, hasDigits: !!digits, hasSpeech: !!speech },
      })
    }
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
  } else if (flowContext.flow === 'voicemail_hangup') {
    // C-3 FIX: Voicemail message finished playing — hang up the call.
    // This replaces the unreliable setTimeout pattern in dialer-engine.
    logger.info('Voicemail speak ended — hanging up', { call_control_id })
    try {
      await fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/hangup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    } catch (hangupErr) {
      logger.warn('Voicemail hangup failed (call may already be ended)', {
        call_control_id,
        error: (hangupErr as Error)?.message,
      })
    }
  } else if (flowContext.flow === 'test_call_hangup') {
    // Test call TTS finished — hang up automatically.
    logger.info('Test call TTS ended — hanging up', { call_control_id })
    try {
      await fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/hangup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    } catch (hangupErr) {
      logger.warn('Test call hangup failed (call may already be ended)', {
        call_control_id,
        error: (hangupErr as Error)?.message,
      })
    }
  } else if (flowContext.flow === 'dialer_hold') {
    // Agent hold message finished — re-check for available agent or replay hold
    logger.info('Hold message ended for dialer call', { call_control_id })
  }
}

async function handleMachineDetectionEnded(env: Env, db: DbClient, payload: any) {
  const { call_control_id, call_session_id, result: amdResult, client_state } = payload

  // Decode client_state
  let callMetadata: any = {}
  if (client_state) {
    try {
      callMetadata = JSON.parse(atob(client_state))
    } catch {
      callMetadata = {}
    }
  }

  logger.info('Telnyx webhook: call.machine_detection.ended', {
    callControlId: call_control_id,
    callSessionId: call_session_id,
    result: amdResult,
    flow: callMetadata.flow,
    campaignId: callMetadata.campaign_id,
  })

  // Update amd_status on the call record
  const updateResult = await db.query(
    `UPDATE calls SET amd_status = $1, updated_at = NOW()
     WHERE (call_control_id = $2 OR call_sid = $3) AND organization_id IS NOT NULL
     RETURNING id, organization_id, campaign_id`,
    [amdResult, call_control_id, call_session_id]
  )

  if (updateResult.rowCount === 0) {
    logger.warn('AMD webhook: no call record found to update amd_status', {
      call_control_id,
      call_session_id,
      amdResult,
    })
    return
  }

  const call = updateResult.rows[0]

  logger.info('AMD status updated on call record', {
    callId: call.id,
    amdResult,
    campaignId: call.campaign_id,
  })

  // Audit log AMD result
  writeAuditLog(db, {
    organizationId: call.organization_id,
    userId: 'system',
    action: AuditAction.DIALER_AMD_DETECTED,
    resourceType: 'call',
    resourceId: call.id,
    oldValue: null,
    newValue: { amd_result: amdResult, call_control_id },
  })

  // Handle AMD result for dialer calls
  await handleDialerAMD(env, db, call_control_id, call_session_id, amdResult)
}

/**
 * Handle call.bridged — Call successfully bridged (human takeover).
 */
async function handleCallBridged(env: Env, db: DbClient, payload: any) {
  const { call_control_id, call_session_id } = payload

  logger.info('Call bridged', { callControlId: call_control_id })

  // Update call status and capture details for audit logging (BL-VOICE-002)
  const updateResult = await db.query(
    `UPDATE calls SET status = 'bridged', updated_at = NOW()
     WHERE (call_sid = $1 OR call_control_id = $2) AND organization_id IS NOT NULL
     RETURNING id, organization_id`,
    [call_session_id, call_control_id]
  )

  const callRecord = updateResult.rows[0]
  if (callRecord) {
    // Audit log call bridging event (BL-VOICE-002)
    writeAuditLog(db, {
      organizationId: callRecord.organization_id,
      userId: 'system',
      action: AuditAction.CALL_BRIDGED,
      resourceType: 'call',
      resourceId: callRecord.id,
      oldValue: null,
      newValue: { call_control_id, call_session_id },
    })
  }

  // Notify AI engine of bridge completion
  await handleAICallEvent(env, db, 'bridged', call_control_id, {})
}

// --- Stripe Handlers ---

/**
 * Handle checkout.session.completed event
 * Fired when a customer completes checkout and creates a subscription
 */
export async function handleCheckoutCompleted(db: DbClient, session: any) {
  const customerId = session.customer
  const subscriptionId = session.subscription
  const orgId = session.metadata?.organization_id

  // BL-134: Verify customer ownership before mutations
  let verifiedOrgId: string

  if (orgId) {
    // Verify the org_id from metadata actually exists and matches customer
    const orgCheck = await db.query(
      `SELECT id FROM organizations WHERE id = $1 AND stripe_customer_id = $2`,
      [orgId, customerId]
    )
    if (!orgCheck.rows[0]) {
      logger.warn('Stripe checkout: org_id mismatch or not found', {
        metadata_org_id: orgId,
        customer_id: customerId,
      })
      return
    }
    verifiedOrgId = orgId
  } else {
    // Fallback: look up by customer_id with verification
    const orgResult = await db.query(
      `SELECT id FROM organizations WHERE stripe_customer_id = $1`,
      [customerId]
    )
    if (!orgResult.rows[0]) {
      logger.warn('Stripe checkout for unknown customer', {
        customer_id: customerId,
      })
      return
    }
    verifiedOrgId = orgResult.rows[0].id
  }

  // Update using verified org ID with additional WHERE clause safety
  await db.query(
    `UPDATE organizations
     SET stripe_customer_id = $1,
         subscription_id = $2,
         subscription_status = 'active',
         plan_started_at = NOW()
     WHERE id = $3`,
    [customerId, subscriptionId, verifiedOrgId]
  )

  // Log the checkout completion using verified orgId
  await db.query(
    `INSERT INTO billing_events (organization_id, event_type, amount, metadata, created_at)
     VALUES ($1, 'checkout_completed', $2, $3::jsonb, NOW())`,
    [
      verifiedOrgId,
      session.amount_total || 0,
      JSON.stringify({ session_id: session.id, subscription_id: subscriptionId }),
    ]
  )
}

export async function handleSubscriptionUpdate(db: DbClient, subscription: any) {
  // BL-134: Verify customer ownership before mutations
  const orgResult = await db.query(
    `SELECT id, organization_id FROM organizations WHERE stripe_customer_id = $1`,
    [subscription.customer]
  )

  if (!orgResult.rows[0]) {
    logger.warn('Stripe webhook for unknown customer', {
      customer_id: subscription.customer,
      event_type: 'subscription.updated',
    })
    return
  }

  const orgId = orgResult.rows[0].id
  const planId = subscription.items.data[0]?.price?.id

  // Use verified org ID for update with additional WHERE clause safety
  await db.query(
    `UPDATE organizations
     SET subscription_status = $1, subscription_id = $2, plan_id = $3
     WHERE id = $4 AND stripe_customer_id = $5`,
    [subscription.status, subscription.id, planId, orgId, subscription.customer]
  )

  // Also populate stripe_subscriptions mirror table
  try {
    const price = subscription.items.data[0]?.price
    await db.query(
      `INSERT INTO stripe_subscriptions (
        organization_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        plan, status, current_period_start, current_period_end, cancel_at_period_end,
        canceled_at, amount_cents, currency, interval, trial_start, trial_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = EXCLUDED.canceled_at,
        updated_at = NOW()`,
      [
        orgId,
        subscription.customer,
        subscription.id,
        price?.id,
        price?.metadata?.plan || 'free', // Map price to plan name
        subscription.status,
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString(),
        subscription.cancel_at_period_end,
        subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        price?.unit_amount || 0,
        price?.currency || 'usd',
        price?.recurring?.interval || 'month',
        subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      ]
    )
  } catch (err) {
    logger.warn('Failed to update stripe_subscriptions mirror table', { error: String(err) })
  }

  writeAuditLog(db, {
    organizationId: orgId,
    userId: 'system',
    action: AuditAction.SUBSCRIPTION_UPDATED,
    resourceType: 'subscription',
    resourceId: subscription.id,
    oldValue: null,
    newValue: { status: subscription.status, plan_id: planId },
  })
}

async function handleSubscriptionCanceled(db: DbClient, subscription: any) {
  // BL-134: Verify customer ownership before mutations
  const orgResult = await db.query(
    `SELECT id, organization_id FROM organizations WHERE stripe_customer_id = $1`,
    [subscription.customer]
  )

  if (!orgResult.rows[0]) {
    logger.warn('Stripe webhook for unknown customer', {
      customer_id: subscription.customer,
      event_type: 'subscription.deleted',
    })
    return
  }

  const orgId = orgResult.rows[0].id

  // Use verified org ID for update with additional WHERE clause safety
  await db.query(
    `UPDATE organizations 
     SET subscription_status = 'canceled'
     WHERE id = $1 AND stripe_customer_id = $2`,
    [orgId, subscription.customer]
  )

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
    // Also populate stripe_invoices mirror table
    try {
      await db.query(
        `INSERT INTO stripe_invoices (
          organization_id, stripe_invoice_id, stripe_customer_id, stripe_subscription_id,
          status, amount_due_cents, amount_paid_cents, currency,
          invoice_date, due_date, paid_at, hosted_invoice_url, invoice_pdf_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (stripe_invoice_id) DO UPDATE SET
          status = EXCLUDED.status,
          amount_paid_cents = EXCLUDED.amount_paid_cents,
          paid_at = EXCLUDED.paid_at,
          hosted_invoice_url = EXCLUDED.hosted_invoice_url,
          invoice_pdf_url = EXCLUDED.invoice_pdf_url,
          updated_at = NOW()`,
        [
          orgId,
          invoice.id,
          invoice.customer,
          invoice.subscription,
          invoice.status,
          invoice.amount_due,
          invoice.amount_paid,
          invoice.currency,
          invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
          invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
          invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
          invoice.hosted_invoice_url,
          invoice.invoice_pdf,
        ]
      )
    } catch (err) {
      logger.warn('Failed to update stripe_invoices mirror table', { error: String(err) })
    }

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

export async function handleInvoiceFailed(db: DbClient, invoice: any) {
  // BL-134: Verify customer ownership before mutations
  const orgResult = await db.query(
    `SELECT id, organization_id FROM organizations WHERE stripe_customer_id = $1`,
    [invoice.customer]
  )

  const orgId = orgResult.rows[0]?.organization_id
  if (!orgId) {
    logger.warn('Invoice failed for unknown customer', { customer_id: invoice.customer })
    return
  }

  // Mirror to stripe_invoices
  try {
    await db.query(
      `INSERT INTO stripe_invoices (
        organization_id, stripe_invoice_id, stripe_customer_id, stripe_subscription_id,
        status, amount_due_cents, amount_paid_cents, currency,
        invoice_date, due_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (stripe_invoice_id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()`,
      [
        orgId,
        invoice.id,
        invoice.customer,
        invoice.subscription,
        invoice.status || 'open',
        invoice.amount_due,
        invoice.amount_paid || 0,
        invoice.currency,
        invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
        invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      ]
    )
  } catch (err) {
    logger.warn('Failed to mirror failed invoice', { error: String(err) })
  }

  writeAuditLog(db, {
    organizationId: orgId,
    userId: 'system',
    action: AuditAction.PAYMENT_FAILED,
    resourceType: 'invoice',
    resourceId: invoice.id,
    oldValue: null,
    newValue: { amount: invoice.amount_due, status: 'failed' },
  })
}

async function handlePaymentMethodAttached(db: DbClient, paymentMethod: any) {
  // Find organization by customer ID
  const orgResult = await db.query(
    `SELECT id FROM organizations WHERE stripe_customer_id = $1`,
    [paymentMethod.customer]
  )

  if (!orgResult.rows[0]) {
    logger.warn('Stripe webhook for unknown customer', {
      customer_id: paymentMethod.customer,
      event_type: 'payment_method.attached',
    })
    return
  }

  const orgId = orgResult.rows[0].id

  // Insert/update payment method in mirror table
  try {
    await db.query(
      `INSERT INTO stripe_payment_methods (
        organization_id, stripe_customer_id, stripe_payment_method_id,
        type, card_brand, card_last4, card_exp_month, card_exp_year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (stripe_payment_method_id) DO UPDATE SET
        card_brand = EXCLUDED.card_brand,
        card_last4 = EXCLUDED.card_last4,
        card_exp_month = EXCLUDED.card_exp_month,
        card_exp_year = EXCLUDED.card_exp_year,
        updated_at = NOW()`,
      [
        orgId,
        paymentMethod.customer,
        paymentMethod.id,
        paymentMethod.type,
        paymentMethod.card?.brand,
        paymentMethod.card?.last4,
        paymentMethod.card?.exp_month,
        paymentMethod.card?.exp_year,
      ]
    )
  } catch (err) {
    logger.warn('Failed to update stripe_payment_methods mirror table', { error: String(err) })
  }

  writeAuditLog(db, {
    organizationId: orgId,
    userId: 'system',
    action: AuditAction.PAYMENT_METHOD_ADDED,
    resourceType: 'payment_method',
    resourceId: paymentMethod.id,
    oldValue: null,
    newValue: { type: paymentMethod.type, brand: paymentMethod.card?.brand },
  })
}

async function handlePaymentMethodDetached(db: DbClient, paymentMethod: any) {
  // Find organization by customer ID
  const orgResult = await db.query(
    `SELECT id FROM organizations WHERE stripe_customer_id = $1`,
    [paymentMethod.customer]
  )

  if (!orgResult.rows[0]) {
    logger.warn('Stripe webhook for unknown customer', {
      customer_id: paymentMethod.customer,
      event_type: 'payment_method.detached',
    })
    return
  }

  const orgId = orgResult.rows[0].id

  // Remove payment method from mirror table
  try {
    await db.query(
      `DELETE FROM stripe_payment_methods WHERE stripe_payment_method_id = $1 AND organization_id = $2`,
      [paymentMethod.id, orgId]
    )
  } catch (err) {
    logger.warn('Failed to delete from stripe_payment_methods mirror table', { error: String(err) })
  }

  writeAuditLog(db, {
    organizationId: orgId,
    userId: 'system',
    action: AuditAction.PAYMENT_METHOD_REMOVED,
    resourceType: 'payment_method',
    resourceId: paymentMethod.id,
    oldValue: { type: paymentMethod.type, brand: paymentMethod.card?.brand },
    newValue: null,
  })
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

    return c.json({ success: true, webhooks: result.rows, subscriptions: result.rows })
  } finally {
    await db.end()
  }
}

/** Shared: create webhook subscription */
async function createWebhookSubscription(c: any) {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

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

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.WEBHOOK_CREATED,
      resourceType: 'webhook_subscriptions',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: { url, events, description },
    })

    return c.json({ success: true, webhook: result.rows[0], subscription: result.rows[0] }, 201)
  } finally {
    await db.end()
  }
}

/** Shared: update webhook subscription */
async function updateWebhookSubscription(c: any, webhookId: string) {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

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

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.WEBHOOK_UPDATED,
      resourceType: 'webhook_subscriptions',
      resourceId: webhookId,
      oldValue: null,
      newValue: { url, events, is_active, description },
    })

    return c.json({ success: true, webhook: result.rows[0], subscription: result.rows[0] })
  } finally {
    await db.end()
  }
}

/** Shared: delete webhook subscription */
async function deleteWebhookSubscription(c: any, webhookId: string) {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

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

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.WEBHOOK_DELETED,
      resourceType: 'webhook_subscriptions',
      resourceId: webhookId,
      oldValue: { id: webhookId },
      newValue: null,
    })

    return c.json({ success: true, message: 'Webhook deleted' })
  } finally {
    await db.end()
  }
}

/** Shared: send test delivery (with auto-retry) */
async function testWebhookDelivery(c: any, webhookId: string) {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Forbidden' }, 403)

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
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {

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

import { handlePlaybackComplete } from '../lib/audio-injector'

/**
 * Handle call.playback.started — Audio injection began.
 * Logs the start of voice-to-voice translation playback.
 */
async function handlePlaybackStarted(db: DbClient, payload: any) {
  const { call_control_id, playback_id, status } = payload

  logger.info('Audio injection started', {
    callControlId: call_control_id,
    playbackId: playback_id,
    status,
  })

  // Could update injection status to 'confirmed_playing' if needed
  // For now, we mainly care about completion
}

/**
 * Handle call.playback.ended — Audio injection completed.
 * Updates the audio_injections table with completion status.
 */
async function handlePlaybackEnded(env: Env, db: DbClient, payload: any) {
  const { call_control_id, playback_id, status } = payload

  const success = status === 'completed'
  await handlePlaybackComplete(db, call_control_id, playback_id, success)

  logger.info('Audio injection completed', {
    callControlId: call_control_id,
    playbackId: playback_id,
    success,
  })
}

// ─── SMS/Messaging Webhook Handlers ─────────────────────────────────────────

/**
 * SCHEMA REQUIREMENT: messages table
 * 
 * The following handlers require a messages table with this structure:
 * 
 * CREATE TABLE public.messages (
 *   id uuid NOT NULL DEFAULT gen_random_uuid(),
 *   organization_id uuid NOT NULL,
 *   account_id uuid,  -- Link to collection_accounts
 *   campaign_id uuid,  -- Optional link to campaigns
 *   direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
 *   channel text NOT NULL CHECK (channel IN ('sms', 'email', 'call')),
 *   from_number text,  -- E.164 format
 *   to_number text,    -- E.164 format
 *   message_body text,
 *   subject text,      -- For email, null for SMS
 *   status text NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'received')),
 *   external_message_id text,  -- Telnyx message ID
 *   error_message text,
 *   sent_at timestamp with time zone,
 *   delivered_at timestamp with time zone,
 *   read_at timestamp with time zone,
 *   created_at timestamp with time zone NOT NULL DEFAULT now(),
 *   updated_at timestamp with time zone NOT NULL DEFAULT now(),
 *   CONSTRAINT messages_pkey PRIMARY KEY (id),
 *   CONSTRAINT messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
 *   CONSTRAINT messages_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.collection_accounts(id)
 * );
 * 
 * CREATE INDEX messages_organization_id_idx ON public.messages(organization_id);
 * CREATE INDEX messages_account_id_idx ON public.messages(account_id);
 * CREATE INDEX messages_external_message_id_idx ON public.messages(external_message_id);
 * CREATE INDEX messages_created_at_idx ON public.messages(created_at DESC);
 * 
 * If this table does not exist, the handlers will fail gracefully and log errors.
 */

/**
 * Opt-out keywords (case-insensitive)
 */
const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'QUIT', 'CANCEL', 'END', 'OPTOUT', 'REMOVE']
const OPT_IN_KEYWORDS = ['START', 'UNSTOP', 'YES', 'SUBSCRIBE']

/**
 * Normalize phone number to E.164 format (basic implementation)
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // If doesn't start with +, assume US/Canada (+1)
  if (digits.length === 10) {
    return `+1${digits}`
  } else if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`
  } else if (phone.startsWith('+')) {
    return phone
  }
  
  return `+${digits}`
}

/**
 * Check if message contains opt-out keyword
 */
function isOptOutMessage(text: string): boolean {
  const upperText = text.trim().toUpperCase()
  return OPT_OUT_KEYWORDS.some(keyword => upperText === keyword || upperText.startsWith(keyword + ' '))
}

/**
 * Check if message contains opt-in keyword  
 */
function isOptInMessage(text: string): boolean {
  const upperText = text.trim().toUpperCase()
  return OPT_IN_KEYWORDS.some(keyword => upperText === keyword || upperText.startsWith(keyword + ' '))
}

/**
 * Send auto-reply SMS via Telnyx
 */
async function sendAutoReply(
  env: Env,
  fromNumber: string,
  toNumber: string,
  message: string
): Promise<boolean> {
  if (!env.TELNYX_API_KEY || !fromNumber) {
    logger.warn('Cannot send auto-reply: missing TELNYX_API_KEY or from number')
    return false
  }

  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to: toNumber,
        text: message,
        type: 'SMS',
      }),
    })

    if (response.ok) {
      logger.info('Auto-reply sent successfully', { to: toNumber, from: fromNumber })
      return true
    } else {
      const errorText = await response.text().catch(() => 'Unknown error')
      logger.error('Auto-reply failed', {
        status: response.status,
        error: errorText.substring(0, 200),
        to: toNumber,
      })
      return false
    }
  } catch (err) {
    logger.error('Auto-reply exception', {
      error: (err as Error)?.message,
      to: toNumber,
    })
    return false
  }
}

/**
 * Handle message.received — Inbound SMS received
 */
async function handleMessageReceived(env: Env, db: DbClient, payload: any) {
  const {
    id: external_message_id,
    from: { phone_number: from },
    to: to_array,
    received_at,
    text,
  } = payload

  // Telnyx sends 'to' as an array, take first element
  const to = to_array && to_array.length > 0 ? to_array[0]?.phone_number : null

  if (!from || !to || !text) {
    logger.warn('Inbound SMS missing required fields', { from, to, hasText: !!text })
    return
  }

  const normalizedFrom = normalizePhone(from)
  const normalizedTo = normalizePhone(to)

  logger.info('Inbound SMS received', {
    from: normalizedFrom,
    to: normalizedTo,
    external_id: external_message_id,
    preview: text.substring(0, 50),
  })

  try {
    // 1. Resolve organization from receiving DID first (tenant-safe)
    let accountId: string | null = null
    let organizationId: string | null = null
    let campaignId: string | null = null
    let currentSmsConsent = false

    const didResult = await db.query(
      `SELECT organization_id FROM inbound_phone_numbers
       WHERE phone_number = $1 AND is_active = true
       LIMIT 1`,
      [normalizedTo]
    )

    if (didResult.rows.length > 0) {
      organizationId = didResult.rows[0].organization_id
      logger.info('Matched inbound SMS to org via inbound DID', { organizationId, to: normalizedTo })
    }

    if (!organizationId) {
      const orgPhoneResult = await db.query(
        `SELECT organization_id FROM org_phone_numbers
         WHERE phone_number = $1 AND is_active = true
         LIMIT 1`,
        [normalizedTo]
      )
      if (orgPhoneResult.rows.length > 0) {
        organizationId = orgPhoneResult.rows[0].organization_id
        logger.info('Matched inbound SMS to org via org phone pool', {
          organizationId,
          to: normalizedTo,
        })
      }
    }

    if (!organizationId) {
      // Last-resort fallback: only accept account match when sender maps to exactly one org
      const uniqueOrgResult = await db.query(
        `SELECT organization_id, COUNT(*) OVER() AS org_count
         FROM (
           SELECT DISTINCT organization_id
           FROM collection_accounts
           WHERE (primary_phone = $1 OR secondary_phone = $1)
             AND is_deleted = false
         ) orgs
         LIMIT 1`,
        [normalizedFrom]
      )

      if (uniqueOrgResult.rows.length > 0 && Number(uniqueOrgResult.rows[0].org_count) === 1) {
        organizationId = uniqueOrgResult.rows[0].organization_id
        logger.warn('Inbound SMS tenant resolved by unique sender phone fallback', {
          organizationId,
          from: normalizedFrom,
        })
      }
    }

    // 2. Find matching account scoped to resolved organization
    if (organizationId) {
      const accountResult = await db.query(
        `SELECT id, organization_id, campaign_id, primary_phone, secondary_phone, sms_consent
         FROM collection_accounts
         WHERE organization_id = $1
           AND (primary_phone = $2 OR secondary_phone = $2)
           AND is_deleted = false
         LIMIT 1`,
        [organizationId, normalizedFrom]
      )

      if (accountResult.rows.length > 0) {
        const account = accountResult.rows[0]
        accountId = account.id
        campaignId = account.campaign_id
        currentSmsConsent = account.sms_consent || false

        logger.info('Matched inbound SMS to account', {
          accountId,
          organizationId,
          from: normalizedFrom,
        })

        await db.query(
          `UPDATE collection_accounts
           SET last_contact_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND organization_id = $2`,
          [accountId, organizationId]
        )
      } else {
        logger.warn('No account match for inbound SMS in resolved organization', {
          from: normalizedFrom,
          to: normalizedTo,
          organizationId,
        })
      }
    } else {
      logger.warn('Inbound SMS organization could not be resolved; storing as orphan skipped', {
        from: normalizedFrom,
        to: normalizedTo,
      })
    }

    // 2. Check for opt-out/opt-in keywords
    const isOptOut = isOptOutMessage(text)
    const isOptIn = isOptInMessage(text)

    if (isOptOut && accountId && organizationId) {
      logger.info('Opt-out keyword detected', { accountId, from: normalizedFrom })

      // Update sms_consent = false
      await db.query(
        `UPDATE collection_accounts
         SET sms_consent = false, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [accountId, organizationId]
      )

      // Fire audit log
      writeAuditLog(db, {
        organizationId,
        userId: 'system',
        action: AuditAction.OPT_OUT_REQUESTED,
        resourceType: 'collection_account',
        resourceId: accountId,
        oldValue: { sms_consent: currentSmsConsent },
        newValue: { sms_consent: false, opt_out_at: new Date().toISOString() },
      })

      // Send auto-reply confirmation
      await sendAutoReply(
        env,
        normalizedTo,
        normalizedFrom,
        'You have been unsubscribed from SMS messages. Reply START to opt back in.'
      )

      // Log auto-reply
      writeAuditLog(db, {
        organizationId,
        userId: 'system',
        action: AuditAction.AUTO_REPLY_SENT,
        resourceType: 'message',
        resourceId: external_message_id || 'unknown',
        newValue: { type: 'opt_out_confirmation', to: normalizedFrom },
      })
    } else if (isOptIn && accountId && organizationId) {
      logger.info('Opt-in keyword detected', { accountId, from: normalizedFrom })

      // Update sms_consent = true
      await db.query(
        `UPDATE collection_accounts
         SET sms_consent = true, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [accountId, organizationId]
      )

      // Fire audit log
      writeAuditLog(db, {
        organizationId,
        userId: 'system',
        action: AuditAction.OPT_IN_CONFIRMED,
        resourceType: 'collection_account',
        resourceId: accountId,
        oldValue: { sms_consent: currentSmsConsent },
        newValue: { sms_consent: true, opt_in_at: new Date().toISOString() },
      })

      // Send auto-reply confirmation
      await sendAutoReply(
        env,
        normalizedTo,
        normalizedFrom,
        'You have been subscribed to SMS updates. Reply STOP to unsubscribe.'
      )

      // Log auto-reply
      writeAuditLog(db, {
        organizationId,
        userId: 'system',
        action: AuditAction.AUTO_REPLY_SENT,
        resourceType: 'message',
        resourceId: external_message_id || 'unknown',
        newValue: { type: 'opt_in_confirmation', to: normalizedFrom },
      })
    }

    // 3. Store message in database (if messages table exists)
    // Only store if we have an organization (either from account or DID)
    if (organizationId) {
      try {
        await db.query(
          `INSERT INTO messages (
            organization_id,
            account_id,
            campaign_id,
            direction,
            channel,
            from_number,
            to_number,
            message_body,
            status,
            external_message_id,
            created_at
          ) VALUES ($1, $2, $3, 'inbound', 'sms', $4, $5, $6, 'received', $7, $8)`,
          [
            organizationId,
            accountId,
            campaignId,
            normalizedFrom,
            normalizedTo,
            text,
            external_message_id,
            received_at || new Date().toISOString(),
          ]
        )

        // Fire audit log for message received
        writeAuditLog(db, {
          organizationId,
          userId: 'system',
          action: AuditAction.MESSAGE_RECEIVED,
          resourceType: 'message',
          resourceId: external_message_id || 'unknown',
          newValue: {
            from: normalizedFrom,
            to: normalizedTo,
            channel: 'sms',
            direction: 'inbound',
            account_id: accountId,
            is_opt_out: isOptOut,
            is_opt_in: isOptIn,
          },
        })

        logger.info('Inbound SMS stored successfully', {
          external_id: external_message_id,
          organization_id: organizationId,
          account_id: accountId,
        })
      } catch (dbErr) {
        // Table might not exist yet - log warning but don't fail
        logger.warn('Failed to store inbound SMS (messages table may not exist)', {
          error: (dbErr as Error)?.message,
          external_id: external_message_id,
        })
      }
    }
  } catch (err) {
    logger.error('Failed to process inbound SMS', {
      error: (err as Error)?.message,
      external_id: external_message_id,
      from,
      to,
    })
  }
}

/**
 * Handle message.sent — Outbound SMS sent confirmation
 */
async function handleMessageSent(db: DbClient, payload: any) {
  const { id: external_message_id, sent_at } = payload

  if (!external_message_id) {
    logger.warn('message.sent missing message ID')
    return
  }

  logger.info('Outbound SMS sent', { external_id: external_message_id })

  try {
    // Update message status to 'sent'
    const result = await db.query(
      `UPDATE messages
       SET status = 'sent', sent_at = $1, updated_at = NOW()
       WHERE external_message_id = $2
       RETURNING organization_id`,
      [sent_at || new Date().toISOString(), external_message_id]
    )

    if (result.rows.length > 0) {
      const organizationId = result.rows[0].organization_id

      writeAuditLog(db, {
        organizationId,
        userId: 'system',
        action: AuditAction.MESSAGE_SENT,
        resourceType: 'message',
        resourceId: external_message_id,
        newValue: { status: 'sent', sent_at: sent_at || new Date().toISOString() },
      })
    }
  } catch (err) {
    logger.warn('Failed to update SMS sent status (table may not exist)', {
      error: (err as Error)?.message,
      external_id: external_message_id,
    })
  }
}

/**
 * Handle message.delivered — SMS delivered to recipient
 */
async function handleMessageDelivered(db: DbClient, payload: any) {
  const { id: external_message_id, completed_at } = payload

  if (!external_message_id) {
    logger.warn('message.delivered missing message ID')
    return
  }

  logger.info('SMS delivered', { external_id: external_message_id })

  try {
    const result = await db.query(
      `UPDATE messages
       SET status = 'delivered', delivered_at = $1, updated_at = NOW()
       WHERE external_message_id = $2
       RETURNING organization_id`,
      [completed_at || new Date().toISOString(), external_message_id]
    )

    if (result.rows.length > 0) {
      const organizationId = result.rows[0].organization_id

      writeAuditLog(db, {
        organizationId,
        userId: 'system',
        action: AuditAction.MESSAGE_DELIVERED,
        resourceType: 'message',
        resourceId: external_message_id,
        newValue: { status: 'delivered', delivered_at: completed_at || new Date().toISOString() },
      })
    }
  } catch (err) {
    logger.warn('Failed to update SMS delivered status (table may not exist)', {
      error: (err as Error)?.message,
      external_id: external_message_id,
    })
  }
}

/**
 * Handle message.failed — SMS delivery failed
 */
async function handleMessageFailed(db: DbClient, payload: any) {
  const { id: external_message_id, errors } = payload

  if (!external_message_id) {
    logger.warn('message.failed missing message ID')
    return
  }

  const errorMessage = errors && errors.length > 0 ? errors[0].detail : 'Unknown error'

  logger.error('SMS delivery failed', {
    external_id: external_message_id,
    error: errorMessage,
  })

  try {
    const result = await db.query(
      `UPDATE messages
       SET status = 'failed', error_message = $1, updated_at = NOW()
       WHERE external_message_id = $2
       RETURNING organization_id`,
      [errorMessage, external_message_id]
    )

    if (result.rows.length > 0) {
      const organizationId = result.rows[0].organization_id

      writeAuditLog(db, {
        organizationId,
        userId: 'system',
        action: AuditAction.MESSAGE_DELIVERY_FAILED,
        resourceType: 'message',
        resourceId: external_message_id,
        newValue: { status: 'failed', error: errorMessage },
      })
    }
  } catch (err) {
    logger.warn('Failed to update SMS failed status (table may not exist)', {
      error: (err as Error)?.message,
      external_id: external_message_id,
    })
  }
}

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
