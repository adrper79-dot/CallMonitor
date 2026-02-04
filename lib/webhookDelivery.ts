/**
 * Webhook Delivery Service
 * 
 * Responsible for delivering webhook events to subscribers
 * Per MASTER_ARCHITECTURE: Events are post-execution, non-blocking
 * 
 * Features:
 * - HMAC signature verification
 * - Exponential backoff retry
 * - Delivery tracking
 * - Rate limiting
 */

import { query } from '@/lib/pgClient'
import { WebhookEventType, WebhookPayload, WebhookSubscription } from '@/types/tier1-features'
import crypto from 'node:crypto'
import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

/**
 * Generate HMAC signature for webhook payload
 */
export function generateSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signedPayload = `${timestamp}.${payload}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  return `t=${timestamp},v1=${signature}`
}

/**
 * Verify webhook signature (for testing webhooks)
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = 300  // 5 minutes
): boolean {
  const parts = signature.split(',')
  const timestamp = parseInt(parts.find(p => p.startsWith('t='))?.slice(2) || '0')
  const expectedSig = parts.find(p => p.startsWith('v1='))?.slice(3)

  if (!timestamp || !expectedSig) {
    return false
  }

  // Check timestamp is within tolerance
  const currentTime = Math.floor(Date.now() / 1000)
  if (Math.abs(currentTime - timestamp) > tolerance) {
    return false
  }

  // Verify signature
  const signedPayload = `${timestamp}.${payload}`
  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(expectedSig),
    Buffer.from(computedSig)
  )
}

/**
 * Calculate next retry time using exponential backoff
 */
function calculateNextRetry(attempts: number): Date {
  // Base delay: 1 minute, max: 1 hour
  const baseDelay = 60 * 1000  // 1 minute in ms
  const maxDelay = 60 * 60 * 1000  // 1 hour in ms

  const delay = Math.min(baseDelay * Math.pow(2, attempts), maxDelay)
  const jitter = Math.random() * 0.3 * delay  // Add 0-30% jitter

  return new Date(Date.now() + delay + jitter)
}

/**
 * Queue a webhook event for delivery
 * This is called by other services when events occur
 */
export async function queueWebhookEvent(
  organizationId: string,
  eventType: WebhookEventType,
  eventId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Find all active subscriptions for this event type
    // This query uses the Postgres JSONB containment operator @> to valid json arrays of strings
    // assuming 'events' is a jsonb/json column
    const { rows: subscriptions } = await query(
      `SELECT * FROM webhook_subscriptions 
       WHERE organization_id = $1 
       AND active = true 
       AND events @> $2::jsonb`,
      [organizationId, JSON.stringify([eventType])]
    )

    if (!subscriptions || subscriptions.length === 0) {
      return  // No subscribers for this event
    }

    // Create payload
    const payload: WebhookPayload = {
      event: eventType,
      event_id: eventId,
      timestamp: new Date().toISOString(),
      organization_id: organizationId,
      data
    }

    // Queue delivery for each subscription
    for (const sub of subscriptions) {
      try {
        await query(
          `INSERT INTO webhook_deliveries (
            id, subscription_id, event_type, event_id, payload, status, max_attempts, created_at, attempts
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 0)
          ON CONFLICT DO NOTHING`, // idempotency safely
          [
            uuidv4(),
            sub.id,
            eventType,
            eventId,
            JSON.stringify(payload),
            'pending',
            (sub.max_retries || 3) + 1
          ]
        )
      } catch (insertError: any) {
        logger.error('webhookDelivery: failed to queue delivery', insertError, { subscriptionId: sub.id })
      }
    }

  } catch (error) {
    logger.error('webhookDelivery: queueWebhookEvent failed', error, {
      organizationId,
      eventType,
      eventId
    })
  }
}

/**
 * Deliver a single webhook (called by cron job or worker)
 */
export async function deliverWebhook(deliveryId: string): Promise<boolean> {
  try {
    // Get delivery with subscription details
    const { rows: deliveryRows } = await query(
      `SELECT d.*, 
              s.url as sub_url, 
              s.secret as sub_secret, 
              s.headers as sub_headers, 
              s.timeout_ms as sub_timeout_ms, 
              s.retry_policy as sub_retry_policy
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON d.subscription_id = s.id
       WHERE d.id = $1 LIMIT 1`,
      [deliveryId]
    )

    if (!deliveryRows || deliveryRows.length === 0) {
      logger.error('webhookDelivery: delivery not found', undefined, { deliveryId })
      return false
    }

    const delivery = deliveryRows[0]

    // Construct subscription object from joined fields
    const subscription = {
      url: delivery.sub_url,
      secret: delivery.sub_secret,
      headers: delivery.sub_headers,
      timeout_ms: delivery.sub_timeout_ms,
      retry_policy: delivery.sub_retry_policy
    }

    // Mark as processing
    await query(`UPDATE webhook_deliveries SET status = 'processing' WHERE id = $1`, [deliveryId])

    const payloadString = typeof delivery.payload === 'string' ? delivery.payload : JSON.stringify(delivery.payload)
    const signature = generateSignature(payloadString, subscription.secret)

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': delivery.event_type,
      'X-Webhook-Delivery-Id': deliveryId,
      ...(subscription.headers || {})
    }

    const startTime = Date.now()
    let response: Response

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), subscription.timeout_ms || 30000)

      response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
    } catch (fetchError: any) {
      // Network error or timeout
      const responseTime = Date.now() - startTime

      const newAttempts = delivery.attempts + 1
      const shouldRetry =
        subscription.retry_policy !== 'none' &&
        newAttempts < delivery.max_attempts

      await query(
        `UPDATE webhook_deliveries SET 
           status = $1, 
           attempts = $2, 
           last_error = $3, 
           response_time_ms = $4, 
           next_retry_at = $5
         WHERE id = $6`,
        [
          shouldRetry ? 'retrying' : 'failed',
          newAttempts,
          fetchError.message,
          responseTime,
          shouldRetry ? calculateNextRetry(newAttempts).toISOString() : null,
          deliveryId
        ]
      )

      return false
    }

    const responseTime = Date.now() - startTime
    const responseBody = await response.text().catch(() => '')

    // Check if successful (2xx status)
    if (response.ok) {
      await query(
        `UPDATE webhook_deliveries SET 
           status = 'delivered', 
           attempts = $1, 
           response_status = $2, 
           response_body = $3, 
           response_time_ms = $4, 
           delivered_at = NOW()
         WHERE id = $5`,
        [
          delivery.attempts + 1,
          response.status,
          responseBody.slice(0, 1000), // Truncate
          responseTime,
          deliveryId
        ]
      )

      return true
    }

    // Failed - check if we should retry
    const newAttempts = delivery.attempts + 1
    const shouldRetry =
      subscription.retry_policy !== 'none' &&
      newAttempts < delivery.max_attempts &&
      response.status >= 500  // Only retry on server errors

    await query(
      `UPDATE webhook_deliveries SET 
         status = $1, 
         attempts = $2, 
         response_status = $3, 
         response_body = $4, 
         response_time_ms = $5, 
         last_error = $6,
         next_retry_at = $7
       WHERE id = $8`,
      [
        shouldRetry ? 'retrying' : 'failed',
        newAttempts,
        response.status,
        responseBody.slice(0, 1000),
        responseTime,
        `HTTP ${response.status}`,
        shouldRetry ? calculateNextRetry(newAttempts).toISOString() : null,
        deliveryId
      ]
    )

    return false
  } catch (error: any) {
    logger.error('webhookDelivery: error delivering webhook', error, {
      deliveryId
    })

    // Mark as failed
    await query(
      `UPDATE webhook_deliveries SET status = 'failed', last_error = $1 WHERE id = $2`,
      [error.message, deliveryId]
    )

    return false
  }
}

/**
 * Process pending webhook deliveries (called by cron job)
 */
export async function processWebhookQueue(batchSize: number = 10): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const results = { processed: 0, succeeded: 0, failed: 0 }

  try {
    // Get pending and retrying deliveries
    const { rows: deliveries } = await query(
      `SELECT id FROM webhook_deliveries 
       WHERE status = 'pending' 
       OR (status = 'retrying' AND next_retry_at <= NOW()) 
       ORDER BY created_at ASC 
       LIMIT $1`,
      [batchSize]
    )

    if (!deliveries) {
      return results
    }

    // Process each delivery
    for (const delivery of deliveries) {
      results.processed++
      const success = await deliverWebhook(delivery.id)
      if (success) {
        results.succeeded++
      } else {
        results.failed++
      }
    }
  } catch (error) {
    logger.error('webhookDelivery: error processing queue', error)
  }

  return results
}

// ============================================================================
// Event Helper Functions
// Call these when events occur in your application
// ============================================================================

function createWebhookEventId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `evt_${crypto.randomBytes(16).toString('hex')}`
}

export async function emitWebhookEvent(params: {
  organizationId: string
  eventType: WebhookEventType
  data: Record<string, unknown>
  eventId?: string
}): Promise<string> {
  const resolvedEventId = params.eventId || createWebhookEventId()
  await queueWebhookEvent(params.organization_id, params.eventType, resolvedEventId, params.data)
  return resolvedEventId
}

export async function emitCallStarted(call: {
  id: string
  organization_id: string
  phone_to?: string
  phone_from?: string
  status: string
}) {
  await queueWebhookEvent(
    call.organization_id,
    'call.started',
    call.id,
    {
      call_id: call.id,
      phone_to: call.phone_to,
      phone_from: call.phone_from,
      status: call.status,
      started_at: new Date().toISOString()
    }
  )
}

export async function emitCallCompleted(call: {
  id: string
  organization_id: string
  status: string
  duration_seconds?: number
  disposition?: string
}) {
  await queueWebhookEvent(
    call.organization_id,
    'call.completed',
    call.id,
    {
      call_id: call.id,
      status: call.status,
      duration_seconds: call.duration_seconds,
      disposition: call.disposition,
      completed_at: new Date().toISOString()
    }
  )
}

export async function emitRecordingAvailable(recording: {
  id: string
  organization_id: string
  call_id: string
  recording_url: string
  duration_seconds?: number
}) {
  await queueWebhookEvent(
    recording.organization_id,
    'recording.available',
    recording.id,
    {
      recording_id: recording.id,
      call_id: recording.call_id,
      recording_url: recording.recording_url,
      duration_seconds: recording.duration_seconds,
      available_at: new Date().toISOString()
    }
  )
}

export async function emitTranscriptCompleted(transcript: {
  id: string
  organization_id: string
  call_id: string
  recording_id: string
  language?: string
}) {
  await queueWebhookEvent(
    transcript.organization_id,
    'transcript.completed',
    transcript.id,
    {
      transcript_id: transcript.id,
      call_id: transcript.call_id,
      recording_id: transcript.recording_id,
      language: transcript.language,
      completed_at: new Date().toISOString()
    }
  )
}

export async function emitDispositionSet(call: {
  id: string
  organization_id: string
  disposition: string
  set_by: string
}) {
  await queueWebhookEvent(
    call.organization_id,
    'call.disposition_set',
    call.id,
    {
      call_id: call.id,
      disposition: call.disposition,
      set_by: call.set_by,
      set_at: new Date().toISOString()
    }
  )
}
