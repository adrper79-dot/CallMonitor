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
import type { Env } from '../index'
import { getDb, DbClient } from '../lib/db'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateWebhookSchema, UpdateWebhookSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { webhookRateLimit } from '../lib/rate-limit'

export const webhooksRoutes = new Hono<{ Bindings: Env }>()

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
 * Verify Telnyx webhook signature (HMAC-SHA256)
 * Telnyx V2 signs payloads with telnyx-signature-ed25519 header
 * For simplicity, we verify using a shared signing secret (TELNYX_WEBHOOK_SECRET)
 */
async function verifyTelnyxSignature(
  payload: string,
  timestampHeader: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): Promise<boolean> {
  if (!timestampHeader || !signatureHeader || !secret) return false

  // Reject stale timestamps
  const age = Math.floor(Date.now() / 1000) - parseInt(timestampHeader, 10)
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
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestampHeader}.${payload}`)
  )
  const computedSig = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  if (computedSig.length !== signatureHeader.length) return false
  let mismatch = 0
  for (let i = 0; i < computedSig.length; i++) {
    mismatch |= computedSig.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  }
  return mismatch === 0
}

// Telnyx call events — verified via HMAC signature
webhooksRoutes.post('/telnyx', async (c) => {
  try {
    const rawBody = await c.req.text()

    // Verify Telnyx signature — fail-closed (reject if secret not configured)
    const telnyxSecret = (c.env as any).TELNYX_WEBHOOK_SECRET
    if (!telnyxSecret) {
      logger.error('TELNYX_WEBHOOK_SECRET not configured — rejecting unverified webhook')
      return c.json({ error: 'Webhook verification not configured' }, 500)
    }
    const timestamp = c.req.header('telnyx-timestamp') || ''
    const signature =
      c.req.header('telnyx-signature-ed25519') || c.req.header('telnyx-signature') || ''
    const valid = await verifyTelnyxSignature(rawBody, timestamp, signature, telnyxSecret)
    if (!valid) {
      return c.json({ error: 'Invalid webhook signature' }, 401)
    }

    const body = JSON.parse(rawBody)
    const eventType = body.data?.event_type

    const db = getDb(c.env)

    switch (eventType) {
      case 'call.initiated':
        await handleCallInitiated(db, body.data.payload)
        break
      case 'call.answered':
        await handleCallAnswered(db, body.data.payload)
        break
      case 'call.hangup':
        await handleCallHangup(db, body.data.payload)
        break
      case 'call.recording.saved':
        await handleRecordingSaved(c.env, db, body.data.payload)
        break
      // Silently ignore other event types
    }

    return c.json({ received: true })
  } catch (err: any) {
    logger.error('Telnyx webhook processing error')
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// AssemblyAI transcription webhook
webhooksRoutes.post('/assemblyai', async (c) => {
  try {
    const body = await c.req.json()
    const { transcript_id, status, text } = body

    if (status === 'completed' && text) {
      const db = getDb(c.env)

      await db.query(
        `UPDATE calls 
         SET transcript = $1, transcript_status = 'completed'
         WHERE transcript_id = $2`,
        [text, transcript_id]
      )
    }

    return c.json({ received: true })
  } catch (err: any) {
    logger.error('AssemblyAI webhook processing error')
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

// Stripe billing webhook — verified via HMAC-SHA256 signature
webhooksRoutes.post('/stripe', async (c) => {
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

    const db = getDb(c.env)

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
  }
})

// --- Telnyx Handlers ---

async function handleCallInitiated(db: DbClient, payload: any) {
  const { call_control_id, call_session_id, from, to } = payload

  await db.query(
    `UPDATE calls 
     SET call_sid = $1, status = 'initiated'
     WHERE call_control_id = $2 OR phone_number = $3`,
    [call_session_id, call_control_id, to]
  )
}

async function handleCallAnswered(db: DbClient, payload: any) {
  const { call_control_id, call_session_id } = payload

  await db.query(
    `UPDATE calls 
     SET status = 'in_progress', answered_at = NOW()
     WHERE call_sid = $1 OR call_control_id = $2`,
    [call_session_id, call_control_id]
  )
}

async function handleCallHangup(db: DbClient, payload: any) {
  const { call_control_id, call_session_id, hangup_cause } = payload

  await db.query(
    `UPDATE calls 
     SET status = 'completed', ended_at = NOW(), hangup_cause = $3
     WHERE call_sid = $1 OR call_control_id = $2`,
    [call_session_id, call_control_id, hangup_cause]
  )
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

    await db.query(
      `UPDATE calls 
       SET recording_url = $2
       WHERE call_sid = $1`,
      [call_session_id, key]
    )
  }
}

// --- Stripe Handlers ---

async function handleSubscriptionUpdate(db: DbClient, subscription: any) {
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
}

async function handleSubscriptionCanceled(db: DbClient, subscription: any) {
  await db.query(
    `UPDATE organizations 
     SET subscription_status = 'canceled'
     WHERE stripe_customer_id = $1`,
    [subscription.customer]
  )
}

async function handleInvoicePaid(db: DbClient, invoice: any) {
  await db.query(
    `INSERT INTO billing_events (organization_id, event_type, amount, invoice_id, created_at)
     SELECT id, 'invoice_paid', $2, $3, NOW()
     FROM organizations WHERE stripe_customer_id = $1`,
    [invoice.customer, invoice.amount_paid, invoice.id]
  )
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

  // Ensure table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      url TEXT NOT NULL,
      events TEXT[] NOT NULL DEFAULT '{}',
      secret TEXT,
      is_active BOOLEAN DEFAULT true,
      description TEXT,
      created_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `)

  const result = await db.query(
    `SELECT * FROM webhook_subscriptions
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [session.organization_id]
  )

  return c.json({ success: true, webhooks: result.rows })
}

/** Shared: create webhook subscription */
async function createWebhookSubscription(c: any) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, CreateWebhookSchema)
  if (!parsed.success) return parsed.response
  const { url, events, secret, description } = parsed.data

  const db = getDb(c.env)

  // Generate a signing secret if not provided
  const signingSecret = secret || crypto.randomUUID()

  const result = await db.query(
    `INSERT INTO webhook_subscriptions (organization_id, url, events, secret, description, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [session.organization_id, url, events, signingSecret, description || '', session.user_id]
  )

  return c.json({ success: true, webhook: result.rows[0] }, 201)
}

/** Shared: update webhook subscription */
async function updateWebhookSubscription(c: any, webhookId: string) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, UpdateWebhookSchema)
  if (!parsed.success) return parsed.response
  const { url, events, is_active, description } = parsed.data

  const db = getDb(c.env)

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
}

/** Shared: delete webhook subscription */
async function deleteWebhookSubscription(c: any, webhookId: string) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)

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
}

/** Shared: send test delivery */
async function testWebhookDelivery(c: any, webhookId: string) {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)

  const webhookResult = await db.query(
    `SELECT * FROM webhook_subscriptions
     WHERE id = $1 AND organization_id = $2`,
    [webhookId, session.organization_id]
  )

  if (webhookResult.rows.length === 0) {
    return c.json({ error: 'Webhook not found' }, 404)
  }

  const webhook = webhookResult.rows[0]

  // Send test payload
  const testPayload = {
    event: 'test.delivery',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery from WordIsBond',
      webhook_id: webhookId,
      organization_id: session.organization_id,
    },
  }

  // Ensure delivery log table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      payload JSONB,
      response_status INT,
      response_body TEXT,
      success BOOLEAN DEFAULT false,
      duration_ms INT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `)

  const startTime = Date.now()
  let responseStatus = 0
  let responseBody = ''
  let success = false

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': webhook.secret || '',
        'X-Webhook-Event': 'test.delivery',
      },
      body: JSON.stringify(testPayload),
    })

    responseStatus = response.status
    responseBody = (await response.text()).slice(0, 1000) // Cap response body
    success = response.ok
  } catch (err: any) {
    responseBody = err.message || 'Connection failed'
  }

  const durationMs = Date.now() - startTime

  // Log delivery
  await db.query(
    `INSERT INTO webhook_deliveries (webhook_id, event, payload, response_status, response_body, success, duration_ms)
     VALUES ($1, 'test.delivery', $2, $3, $4, $5, $6)`,
    [webhookId, JSON.stringify(testPayload), responseStatus, responseBody, success, durationMs]
  )

  return c.json({
    success: true,
    delivery: {
      status: responseStatus,
      success,
      duration_ms: durationMs,
      response_preview: responseBody.slice(0, 200),
    },
  })
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
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const webhookId = c.req.param('id')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const db = getDb(c.env)

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
webhooksRoutes.patch('/:id', async (c) => {
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

webhooksRoutes.delete('/:id', async (c) => {
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

webhooksRoutes.post('/:id/test', async (c) => {
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
