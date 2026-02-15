/**
 * Outbound Webhook / Zapier Integration Routes
 *
 * Allows customers to subscribe to platform events and receive webhook
 * deliveries to external URLs (Zapier, Make.com, custom endpoints).
 *
 * Endpoints:
 *   GET    /subscriptions            — List webhook subscriptions (paginated)
 *   POST   /subscriptions            — Create webhook subscription
 *   GET    /subscriptions/:id        — Get subscription details
 *   PUT    /subscriptions/:id        — Update subscription
 *   DELETE /subscriptions/:id        — Delete subscription
 *   POST   /subscriptions/:id/test   — Send a test event to webhook URL
 *   GET    /deliveries               — List recent deliveries (last 100)
 *   GET    /deliveries/:id           — Get delivery details
 *
 * Exported utility:
 *   fanoutWebhookEvent(env, orgId, eventType, payload) — fire-and-forget fan-out
 *
 * @see ARCH_DOCS/02-FEATURES — Webhook & integration architecture
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv, Env } from '../index'
import { getDb, type DbClient } from '../lib/db'
import { requireAuth, requireRole } from '../lib/auth'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { logger } from '../lib/logger'
import { rateLimit } from '../lib/rate-limit'

// ─── Rate Limiter ────────────────────────────────────────────────────────────

/** Outbound webhook management: 30 requests per 5 minutes per IP */
const outboundWebhookRateLimit = rateLimit({
  limit: 30,
  windowSeconds: 5 * 60,
  prefix: 'rl:webhook-outbound',
})

// ─── Supported Event Types ──────────────────────────────────────────────────

const SUPPORTED_EVENTS = [
  'call.completed',
  'call.started',
  'recording.ready',
  'transcription.completed',
  'sentiment.analyzed',
  'scorecard.completed',
  'campaign.completed',
  'compliance.violation',
  'agent.alert',
] as const

type WebhookEventType = (typeof SUPPORTED_EVENTS)[number]

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const CreateSubscriptionSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  target_url: z
    .string()
    .url('Must be a valid URL')
    .max(2048, 'URL must be 2048 characters or fewer'),
  events: z
    .array(z.enum(SUPPORTED_EVENTS))
    .min(1, 'At least one event type is required')
    .max(SUPPORTED_EVENTS.length),
  secret: z
    .string()
    .min(16, 'Secret must be at least 16 characters')
    .max(256)
    .optional(),
  headers: z.record(z.string(), z.string().max(1024)).optional(),
})

const UpdateSubscriptionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  target_url: z.string().url().max(2048).optional(),
  events: z
    .array(z.enum(SUPPORTED_EVENTS))
    .min(1)
    .max(SUPPORTED_EVENTS.length)
    .optional(),
  secret: z.string().min(16).max(256).optional(),
  headers: z.record(z.string(), z.string().max(1024)).optional(),
  is_active: z.boolean().optional(),
})

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ─── HMAC Signing ───────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256 signature for a webhook payload.
 *
 * @param payload - JSON string to sign
 * @param secret  - HMAC secret key
 * @returns hex-encoded signature
 */
async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a cryptographically random HMAC secret (hex string).
 */
function generateSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a unique event ID prefixed with `evt_`.
 */
function generateEventId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `evt_${hex}`
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const webhooksOutboundRoutes = new Hono<AppEnv>()

// ─── GET /subscriptions — List webhook subscriptions (paginated) ────────────

/**
 * List all outbound webhook subscriptions for the authenticated organization.
 *
 * @query page  - Page number (default 1)
 * @query limit - Items per page (default 20, max 100)
 * @returns { subscriptions, total, page, limit }
 */
webhooksOutboundRoutes.get('/subscriptions', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = PaginationSchema.safeParse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  })
  const { page, limit } = parsed.success
    ? parsed.data
    : { page: 1, limit: 20 }
  const offset = (page - 1) * limit

  const db = getDb(c.env)
  try {
    const [countResult, dataResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM webhook_subscriptions
         WHERE organization_id = $1`,
        [session.organization_id]
      ),
      db.query(
        `SELECT id, name, target_url, events, is_active, created_at, updated_at
         FROM webhook_subscriptions
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [session.organization_id, limit, offset]
      ),
    ])

    return c.json({
      subscriptions: dataResult.rows,
      total: countResult.rows[0]?.total ?? 0,
      page,
      limit,
    })
  } catch (err: any) {
    logger.error('GET /webhooks-outbound/subscriptions error', { error: err?.message })
    return c.json({ error: 'Failed to list webhook subscriptions' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /subscriptions — Create webhook subscription ──────────────────────

/**
 * Create a new outbound webhook subscription.
 *
 * Auto-generates an HMAC-SHA256 secret if one is not provided.
 *
 * @body name       - Display name for the subscription
 * @body target_url - URL to deliver events to
 * @body events     - Array of event types to subscribe to
 * @body secret     - (optional) HMAC signing secret
 * @body headers    - (optional) Extra headers to include in deliveries
 * @returns { subscription }
 */
webhooksOutboundRoutes.post('/subscriptions', outboundWebhookRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = CreateSubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      400
    )
  }

  const { name, target_url, events, secret, headers } = parsed.data
  const hmacSecret = secret ?? generateSecret()

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `INSERT INTO webhook_subscriptions
         (organization_id, name, target_url, secret, events, headers, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, target_url, events, headers, is_active, created_at, updated_at`,
      [
        session.organization_id,
        name,
        target_url,
        hmacSecret,
        events,            // text[] — Postgres driver handles JS array → text[]
        headers ? JSON.stringify(headers) : null,
      ]
    )

    const subscription = result.rows[0]

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'webhook_subscription',
      resourceId: subscription.id,
      action: AuditAction.WEBHOOK_CREATED,
      newValue: { name, target_url, events },
    })

    // Return secret only at creation time so the caller can store it
    return c.json(
      {
        subscription: { ...subscription, secret: hmacSecret },
      },
      201
    )
  } catch (err: any) {
    logger.error('POST /webhooks-outbound/subscriptions error', { error: err?.message })
    return c.json({ error: 'Failed to create webhook subscription' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /subscriptions/:id — Get subscription details ──────────────────────

/**
 * Retrieve a single webhook subscription by ID (org-scoped).
 *
 * @param id - Subscription UUID
 * @returns { subscription }
 */
webhooksOutboundRoutes.get('/subscriptions/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const { id } = c.req.param()

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT id, name, target_url, events, headers, is_active, created_at, updated_at
       FROM webhook_subscriptions
       WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Webhook subscription not found' }, 404)
    }

    return c.json({ subscription: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /webhooks-outbound/subscriptions/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get webhook subscription' }, 500)
  } finally {
    await db.end()
  }
})

// ─── PUT /subscriptions/:id — Update subscription ───────────────────────────

/**
 * Update an existing webhook subscription.
 *
 * Only provided fields are updated (partial update).
 *
 * @param id - Subscription UUID
 * @body name       - (optional) New display name
 * @body target_url - (optional) New delivery URL
 * @body events     - (optional) New event list
 * @body secret     - (optional) New HMAC secret
 * @body headers    - (optional) New extra headers
 * @body is_active  - (optional) Enable/disable
 * @returns { subscription }
 */
webhooksOutboundRoutes.put('/subscriptions/:id', outboundWebhookRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const { id } = c.req.param()

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = UpdateSubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      400
    )
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  const db = getDb(c.env)
  try {
    // Fetch existing to build old_value for audit and verify ownership
    const existing = await db.query(
      `SELECT id, name, target_url, events, headers, is_active
       FROM webhook_subscriptions
       WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'Webhook subscription not found' }, 404)
    }

    const oldValue = existing.rows[0]

    // Build dynamic SET clause
    const setClauses: string[] = ['updated_at = NOW()']
    const values: any[] = []
    let paramIndex = 1

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`)
      values.push(updates.name)
    }
    if (updates.target_url !== undefined) {
      setClauses.push(`target_url = $${paramIndex++}`)
      values.push(updates.target_url)
    }
    if (updates.events !== undefined) {
      setClauses.push(`events = $${paramIndex++}`)
      values.push(updates.events)
    }
    if (updates.secret !== undefined) {
      setClauses.push(`secret = $${paramIndex++}`)
      values.push(updates.secret)
    }
    if (updates.headers !== undefined) {
      setClauses.push(`headers = $${paramIndex++}`)
      values.push(JSON.stringify(updates.headers))
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`)
      values.push(updates.is_active)
    }

    // Add WHERE params
    values.push(id)
    values.push(session.organization_id)

    const result = await db.query(
      `UPDATE webhook_subscriptions
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING id, name, target_url, events, headers, is_active, created_at, updated_at`,
      values
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Webhook subscription not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'webhook_subscription',
      resourceId: id,
      action: AuditAction.WEBHOOK_UPDATED,
      oldValue,
      newValue: result.rows[0],
    })

    return c.json({ subscription: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /webhooks-outbound/subscriptions/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update webhook subscription' }, 500)
  } finally {
    await db.end()
  }
})

// ─── DELETE /subscriptions/:id — Delete subscription ────────────────────────

/**
 * Delete a webhook subscription by ID (org-scoped).
 *
 * @param id - Subscription UUID
 * @returns 204 No Content
 */
webhooksOutboundRoutes.delete('/subscriptions/:id', async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const { id } = c.req.param()

  const db = getDb(c.env)
  try {
    const existing = await db.query(
      `SELECT id, name, target_url, events
       FROM webhook_subscriptions
       WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'Webhook subscription not found' }, 404)
    }

    await db.query(
      `DELETE FROM webhook_subscriptions
       WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'webhook_subscription',
      resourceId: id,
      action: AuditAction.WEBHOOK_DELETED,
      oldValue: existing.rows[0],
    })

    return c.body(null, 204)
  } catch (err: any) {
    logger.error('DELETE /webhooks-outbound/subscriptions/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete webhook subscription' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /subscriptions/:id/test — Send test event ─────────────────────────

/**
 * Send a test webhook event to the subscription's target URL.
 *
 * Delivers a synthetic `test.ping` event and returns the delivery result
 * (status code, response time, response body preview).
 *
 * @param id - Subscription UUID
 * @returns { delivery }
 */
webhooksOutboundRoutes.post('/subscriptions/:id/test', outboundWebhookRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const { id } = c.req.param()

  const db = getDb(c.env)
  try {
    const sub = await db.query(
      `SELECT id, target_url, secret, headers
       FROM webhook_subscriptions
       WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )

    if (sub.rows.length === 0) {
      return c.json({ error: 'Webhook subscription not found' }, 404)
    }

    const { target_url, secret, headers: extraHeaders } = sub.rows[0]

    const testPayload = {
      id: generateEventId(),
      type: 'test.ping',
      created_at: new Date().toISOString(),
      organization_id: session.organization_id,
      data: {
        message: 'This is a test webhook delivery from Word Is Bond.',
        subscription_id: id,
        timestamp: new Date().toISOString(),
      },
    }

    const body = JSON.stringify(testPayload)

    // Build headers
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'WordIsBond-Webhooks/1.0',
      'X-WIB-Event': 'test.ping',
      'X-WIB-Delivery': testPayload.id,
      'X-WIB-Timestamp': testPayload.created_at,
    }

    if (secret) {
      reqHeaders['X-WIB-Signature'] = await hmacSign(body, secret)
    }

    // Merge custom headers (subscription-level)
    if (extraHeaders && typeof extraHeaders === 'object') {
      const parsed =
        typeof extraHeaders === 'string' ? JSON.parse(extraHeaders) : extraHeaders
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') reqHeaders[k] = v
      }
    }

    const startTime = Date.now()
    let statusCode = 0
    let responseBody = ''
    let success = false

    try {
      const resp = await fetch(target_url, {
        method: 'POST',
        headers: reqHeaders,
        body,
        signal: AbortSignal.timeout(15_000),
      })
      statusCode = resp.status
      responseBody = (await resp.text()).slice(0, 2000)
      success = resp.ok
    } catch (err: any) {
      responseBody = err?.message ?? 'Connection failed'
    }

    const responseTimeMs = Date.now() - startTime

    // Record the test delivery
    await db.query(
      `INSERT INTO webhook_deliveries
         (subscription_id, event_type, payload, status_code, response_body, response_time_ms, attempt, success)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
      [
        id,
        'test.ping',
        JSON.stringify(testPayload),
        statusCode,
        responseBody.slice(0, 2000),
        responseTimeMs,
        success,
      ]
    )

    return c.json({
      delivery: {
        event: 'test.ping',
        target_url,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        success,
        response_body: responseBody.slice(0, 500),
      },
    })
  } catch (err: any) {
    logger.error('POST /webhooks-outbound/subscriptions/:id/test error', { error: err?.message })
    return c.json({ error: 'Failed to send test webhook' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /deliveries — List recent deliveries ───────────────────────────────

/**
 * List the most recent webhook deliveries for the organization.
 *
 * Returns the last 100 deliveries across all subscriptions, newest first.
 * Includes subscription name for display purposes.
 *
 * @query subscription_id - (optional) Filter by subscription
 * @query limit           - (optional) Max results (default 100, max 100)
 * @returns { deliveries }
 */
webhooksOutboundRoutes.get('/deliveries', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const subscriptionId = c.req.query('subscription_id')
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '100', 10) || 100, 1), 100)

  const db = getDb(c.env)
  try {
    let sql: string
    let params: any[]

    if (subscriptionId) {
      sql = `
        SELECT d.id, d.subscription_id, d.event_type, d.status_code,
               d.response_time_ms, d.attempt, d.success, d.created_at,
               s.name AS subscription_name, s.target_url
        FROM webhook_deliveries d
        JOIN webhook_subscriptions s ON s.id = d.subscription_id
        WHERE s.organization_id = $1 AND d.subscription_id = $2
        ORDER BY d.created_at DESC
        LIMIT $3`
      params = [session.organization_id, subscriptionId, limit]
    } else {
      sql = `
        SELECT d.id, d.subscription_id, d.event_type, d.status_code,
               d.response_time_ms, d.attempt, d.success, d.created_at,
               s.name AS subscription_name, s.target_url
        FROM webhook_deliveries d
        JOIN webhook_subscriptions s ON s.id = d.subscription_id
        WHERE s.organization_id = $1
        ORDER BY d.created_at DESC
        LIMIT $2`
      params = [session.organization_id, limit]
    }

    const result = await db.query(sql, params)
    return c.json({ deliveries: result.rows })
  } catch (err: any) {
    logger.error('GET /webhooks-outbound/deliveries error', { error: err?.message })
    return c.json({ error: 'Failed to list webhook deliveries' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /deliveries/:id — Get delivery details ─────────────────────────────

/**
 * Get full details of a single webhook delivery, including request payload
 * and response body. Org-scoped via subscription ownership.
 *
 * @param id - Delivery UUID
 * @returns { delivery }
 */
webhooksOutboundRoutes.get('/deliveries/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const { id } = c.req.param()

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT d.id, d.subscription_id, d.event_type, d.payload,
              d.status_code, d.response_body, d.response_time_ms,
              d.attempt, d.success, d.created_at,
              s.name AS subscription_name, s.target_url
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON s.id = d.subscription_id
       WHERE d.id = $1 AND s.organization_id = $2`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Webhook delivery not found' }, 404)
    }

    return c.json({ delivery: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /webhooks-outbound/deliveries/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get webhook delivery' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Fan-Out Utility ────────────────────────────────────────────────────────

/**
 * Fan out a webhook event to all active subscriptions matching the event type
 * for a given organization. Designed to be called from other route modules
 * (calls.ts, recordings.ts, etc.) whenever platform events occur.
 *
 * Behaviour:
 * 1. Queries all active subscriptions whose `events` array contains the event type.
 * 2. For each match, POSTs the payload with HMAC-SHA256 signature in `X-WIB-Signature`.
 * 3. Records each delivery attempt in `webhook_deliveries` (success/failure, status code, timing).
 * 4. Retries once on failure with ~5 s exponential backoff.
 * 5. Runs via fire-and-forget — never blocks the calling request.
 *
 * @param env       - Workers Env bindings (for DB + waitUntil)
 * @param orgId     - Organization UUID that owns the subscriptions
 * @param eventType - Dot-notation event name, e.g. `call.completed`
 * @param payload   - Arbitrary event data (becomes `.data` in the envelope)
 */
export async function fanoutWebhookEvent(
  env: Env,
  orgId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  const db = getDb(env)
  try {
    // Find all active subscriptions that include this event type
    const subs = await db.query(
      `SELECT id, target_url, secret, headers
       FROM webhook_subscriptions
       WHERE organization_id = $1
         AND is_active = true
         AND $2 = ANY(events)
       LIMIT 50`,
      [orgId, eventType]
    )

    if (subs.rows.length === 0) return

    const eventId = generateEventId()
    const createdAt = new Date().toISOString()

    const envelope = {
      id: eventId,
      type: eventType,
      created_at: createdAt,
      organization_id: orgId,
      data: payload,
    }

    const deliveries = subs.rows.map((sub: any) =>
      deliverToSubscription(db, sub, envelope, eventType)
    )

    // Run all deliveries in parallel — each handles its own retry
    await Promise.allSettled(deliveries)
  } catch (err: any) {
    logger.error('fanoutWebhookEvent failed', {
      eventType,
      orgId: orgId.slice(0, 8),
      error: err?.message,
    })
  } finally {
    await db.end()
  }
}

/**
 * Deliver a single webhook event to one subscription, with one retry on failure.
 *
 * @param db         - Database client for logging deliveries
 * @param sub        - Subscription row (id, target_url, secret, headers)
 * @param envelope   - Full event envelope
 * @param eventType  - Event type string
 */
async function deliverToSubscription(
  db: DbClient,
  sub: { id: string; target_url: string; secret?: string; headers?: any },
  envelope: Record<string, any>,
  eventType: string
): Promise<void> {
  const MAX_ATTEMPTS = 2 // initial + 1 retry
  const RETRY_DELAY_MS = 5_000

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      // Exponential backoff: 5s for first retry
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt - 1)))
    }

    const body = JSON.stringify(envelope)
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'WordIsBond-Webhooks/1.0',
      'X-WIB-Event': eventType,
      'X-WIB-Delivery': envelope.id,
      'X-WIB-Timestamp': envelope.created_at,
    }

    // HMAC-SHA256 signature
    if (sub.secret) {
      reqHeaders['X-WIB-Signature'] = await hmacSign(body, sub.secret)
    }

    // Merge subscription-level custom headers
    if (sub.headers) {
      const parsed =
        typeof sub.headers === 'string' ? JSON.parse(sub.headers) : sub.headers
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') reqHeaders[k] = v
      }
    }

    const startTime = Date.now()
    let statusCode = 0
    let responseBody = ''
    let success = false

    try {
      const resp = await fetch(sub.target_url, {
        method: 'POST',
        headers: reqHeaders,
        body,
        signal: AbortSignal.timeout(10_000),
      })
      statusCode = resp.status
      responseBody = (await resp.text()).slice(0, 2000)
      success = resp.ok
    } catch (err: any) {
      responseBody = err?.message ?? 'Connection failed'
    }

    const responseTimeMs = Date.now() - startTime

    // Record delivery attempt
    db.query(
      `INSERT INTO webhook_deliveries
         (subscription_id, event_type, payload, status_code, response_body, response_time_ms, attempt, success)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sub.id,
        eventType,
        JSON.stringify(envelope),
        statusCode,
        responseBody.slice(0, 2000),
        responseTimeMs,
        attempt,
        success,
      ]
    ).catch(() => {
      // Delivery logging is best-effort
    })

    if (success) {
      logger.info('Webhook delivered', {
        subscription_id: sub.id,
        event: eventType,
        status: statusCode,
        attempt,
        duration_ms: responseTimeMs,
      })
      return
    }

    logger.warn('Webhook delivery failed', {
      subscription_id: sub.id,
      event: eventType,
      status: statusCode,
      attempt,
      max_attempts: MAX_ATTEMPTS,
      duration_ms: responseTimeMs,
      error: responseBody.slice(0, 200),
    })
  }
}
