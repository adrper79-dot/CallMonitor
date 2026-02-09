/**
 * Webhook Delivery with Auto-Retry — Exponential Backoff
 *
 * Wraps outgoing webhook deliveries with retry logic.
 * On failure, records to webhook_failures with backoff scheduling.
 * Uses waitUntil() for non-blocking retries within the same request lifecycle.
 *
 * Architecture:
 *   - Immediate first attempt (synchronous)
 *   - Up to 3 retries with exponential backoff (1s, 4s, 16s)
 *   - Final failure → INSERT into webhook_failures for manual review
 *   - All attempts logged to webhook_deliveries
 *
 * Usage:
 *   import { deliverWithRetry, fanOutToSubscribers } from '../lib/webhook-retry'
 *
 *   // Single delivery
 *   await deliverWithRetry({ db, env, url, payload, orgId, event, secret })
 *
 *   // Fan-out to all matching subscribers
 *   await fanOutToSubscribers({ db, env, orgId, event, payload })
 */

import { logger } from './logger'
import type { DbClient } from './db'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeliveryOptions {
  db: DbClient
  env: { waitUntil?: (promise: Promise<unknown>) => void }
  url: string
  payload: Record<string, unknown>
  orgId: string
  event: string
  secret?: string
  webhookId?: string
  maxRetries?: number
}

interface FanOutOptions {
  db: DbClient
  env: { waitUntil?: (promise: Promise<unknown>) => void }
  orgId: string
  event: string
  payload: Record<string, unknown>
}

interface DeliveryResult {
  success: boolean
  status: number
  duration_ms: number
  error?: string
  attempts: number
}

// ─── HMAC Signing ───────────────────────────────────────────────────────────

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Single Delivery Attempt ────────────────────────────────────────────────

async function attemptDelivery(
  url: string,
  payload: Record<string, unknown>,
  event: string,
  secret?: string
): Promise<{ success: boolean; status: number; body: string; duration_ms: number }> {
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-Timestamp': new Date().toISOString(),
  }

  if (secret) {
    headers['X-Webhook-Signature'] = await signPayload(body, secret)
  }

  const startTime = Date.now()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout per attempt
    })

    const duration_ms = Date.now() - startTime
    const responseBody = (await response.text()).slice(0, 1000)

    return {
      success: response.ok,
      status: response.status,
      body: responseBody,
      duration_ms,
    }
  } catch (err: unknown) {
    const duration_ms = Date.now() - startTime
    const message = err instanceof Error ? err.message : 'Connection failed'
    return {
      success: false,
      status: 0,
      body: message,
      duration_ms,
    }
  }
}

// ─── Deliver with Retry ─────────────────────────────────────────────────────

/**
 * Deliver a webhook payload with exponential backoff retries.
 *
 * - First attempt is synchronous
 * - Subsequent retries use waitUntil() so they don't block the response
 * - Logs each attempt to webhook_deliveries
 * - On final failure, records to webhook_failures
 */
export async function deliverWithRetry(options: DeliveryOptions): Promise<DeliveryResult> {
  const { db, env, url, payload, orgId, event, secret, webhookId, maxRetries = 3 } = options
  const BACKOFF_DELAYS = [0, 1000, 4000, 16000] // immediate, 1s, 4s, 16s

  let lastResult: DeliveryResult = {
    success: false,
    status: 0,
    duration_ms: 0,
    attempts: 0,
  }

  // First attempt — synchronous
  const firstAttempt = await attemptDelivery(url, payload, event, secret)
  lastResult = {
    success: firstAttempt.success,
    status: firstAttempt.status,
    duration_ms: firstAttempt.duration_ms,
    attempts: 1,
  }

  // Log the delivery attempt
  logDelivery(db, {
    webhookId,
    event,
    payload,
    status: firstAttempt.status,
    body: firstAttempt.body,
    success: firstAttempt.success,
    duration_ms: firstAttempt.duration_ms,
  }).catch(() => {})

  if (firstAttempt.success) {
    return lastResult
  }

  // Schedule retries via waitUntil (non-blocking)
  const retryPromise = (async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const delay = BACKOFF_DELAYS[attempt] || 16000
      await sleep(delay)

      logger.info('Webhook retry attempt', {
        url: url.slice(0, 50),
        event,
        attempt,
        maxRetries,
        delay_ms: delay,
      })

      const result = await attemptDelivery(url, payload, event, secret)

      logDelivery(db, {
        webhookId,
        event,
        payload,
        status: result.status,
        body: result.body,
        success: result.success,
        duration_ms: result.duration_ms,
      }).catch(() => {})

      if (result.success) {
        logger.info('Webhook retry succeeded', {
          url: url.slice(0, 50),
          event,
          attempt,
        })
        return
      }

      // If last attempt and still failed → record failure
      if (attempt === maxRetries) {
        await recordFailure(db, {
          orgId,
          url,
          payload,
          event,
          error: `Failed after ${attempt + 1} attempts. Last: HTTP ${result.status} — ${result.body.slice(0, 200)}`,
          httpStatus: result.status,
          attemptCount: attempt + 1,
          maxAttempts: maxRetries + 1,
        }).catch((err) => {
          logger.error('Failed to record webhook failure', { error: (err as Error)?.message })
        })
      }
    }
  })()

  // Use waitUntil if available (Cloudflare Workers)
  if (env.waitUntil) {
    env.waitUntil(retryPromise)
  } else {
    // BL-074: No waitUntil (e.g., tests) — fire and forget with error boundary
    void retryPromise.catch((err) => {
      logger.error('Unhandled webhook retry error', { error: (err as Error)?.message })
    })
  }

  return lastResult
}

// ─── Fan-Out to Matching Subscribers ────────────────────────────────────────

/**
 * Fan out an event to all active webhook subscriptions that match the event type.
 * Each delivery gets retry protection.
 *
 * Call this when platform events occur (e.g., call.ended, campaign.completed).
 */
export async function fanOutToSubscribers(options: FanOutOptions): Promise<number> {
  const { db, env, orgId, event, payload } = options

  try {
    const result = await db.query(
      `SELECT id, url, secret, events
       FROM webhook_subscriptions
       WHERE organization_id = $1
         AND is_active = true
         AND (events @> $2::jsonb OR events @> '"*"'::jsonb)
       LIMIT 50`,
      [orgId, JSON.stringify([event])]
    )

    if (result.rows.length === 0) return 0

    const deliveries = result.rows.map((sub: Record<string, unknown>) =>
      deliverWithRetry({
        db,
        env,
        url: sub.url as string,
        payload: { event, timestamp: new Date().toISOString(), data: payload },
        orgId,
        event,
        secret: sub.secret as string,
        webhookId: sub.id as string,
        maxRetries: 3,
      })
    )

    // Fan out in parallel (all use waitUntil for retries)
    await Promise.allSettled(deliveries)

    return result.rows.length
  } catch (err: unknown) {
    logger.error('Fan-out to subscribers failed', {
      event,
      orgId: orgId.slice(0, 8),
      error: (err as Error)?.message,
    })
    return 0
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Log a delivery attempt to webhook_deliveries table */
async function logDelivery(
  db: DbClient,
  opts: {
    webhookId?: string
    event: string
    payload: Record<string, unknown>
    status: number
    body: string
    success: boolean
    duration_ms: number
  }
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO webhook_deliveries
        (webhook_id, event, payload, response_status, response_body, success, duration_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.webhookId || null,
        opts.event,
        JSON.stringify(opts.payload),
        opts.status,
        opts.body.slice(0, 1000),
        opts.success,
        opts.duration_ms,
      ]
    )
  } catch {
    // Delivery logging is best-effort — don't fail the main request
  }
}

/** Record a final webhook failure for manual review */
async function recordFailure(
  db: DbClient,
  opts: {
    orgId: string
    url: string
    payload: Record<string, unknown>
    event: string
    error: string
    httpStatus: number
    attemptCount: number
    maxAttempts: number
  }
): Promise<void> {
  await db.query(
    `INSERT INTO webhook_failures
      (organization_id, source, endpoint, payload, error_message, http_status,
       attempt_count, max_attempts, status, resource_type)
    VALUES ($1, 'internal', $2, $3, $4, $5, $6, $7, 'failed', $8)`,
    [
      opts.orgId,
      opts.url,
      JSON.stringify(opts.payload),
      opts.error,
      opts.httpStatus || null,
      opts.attemptCount,
      opts.maxAttempts,
      opts.event,
    ]
  )
}
