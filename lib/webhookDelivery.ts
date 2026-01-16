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

import supabaseAdmin from '@/lib/supabaseAdmin'
import { WebhookEventType, WebhookPayload, WebhookSubscription } from '@/types/tier1-features'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

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
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .contains('events', [eventType])
    
    if (fetchError) {
      logger.error('webhookDelivery: failed to fetch subscriptions', fetchError, {
        organizationId,
        eventType
      })
      return
    }
    
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
    const deliveries = subscriptions.map(sub => ({
      subscription_id: sub.id,
      event_type: eventType,
      event_id: eventId,
      payload,
      status: 'pending',
      max_attempts: sub.max_retries + 1
    }))
    
    const { error: insertError } = await supabaseAdmin
      .from('webhook_deliveries')
      .insert(deliveries)
    
    if (insertError) {
      // Ignore duplicate errors (idempotency)
      if (insertError.code !== '23505') {
        logger.error('webhookDelivery: failed to queue deliveries', insertError, {
          organizationId,
          eventType,
          eventId
        })
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
    const { data: delivery, error: fetchError } = await supabaseAdmin
      .from('webhook_deliveries')
      .select(`
        *,
        subscription:webhook_subscriptions (
          url,
          secret,
          headers,
          timeout_ms,
          retry_policy
        )
      `)
      .eq('id', deliveryId)
      .single()
    
    if (fetchError || !delivery || !delivery.subscription) {
      logger.error('webhookDelivery: delivery not found', fetchError, {
        deliveryId
      })
      return false
    }
    
    // Mark as processing
    await supabaseAdmin
      .from('webhook_deliveries')
      .update({ status: 'processing' })
      .eq('id', deliveryId)
    
    const { subscription } = delivery
    const payloadString = JSON.stringify(delivery.payload)
    const signature = generateSignature(payloadString, subscription.secret)
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': delivery.event_type,
      'X-Webhook-Delivery-Id': deliveryId,
      ...subscription.headers
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
      
      await supabaseAdmin
        .from('webhook_deliveries')
        .update({
          status: shouldRetry ? 'retrying' : 'failed',
          attempts: newAttempts,
          last_error: fetchError.message,
          response_time_ms: responseTime,
          next_retry_at: shouldRetry ? calculateNextRetry(newAttempts) : null
        })
        .eq('id', deliveryId)
      
      return false
    }
    
    const responseTime = Date.now() - startTime
    const responseBody = await response.text().catch(() => '')
    
    // Check if successful (2xx status)
    if (response.ok) {
      await supabaseAdmin
        .from('webhook_deliveries')
        .update({
          status: 'delivered',
          attempts: delivery.attempts + 1,
          response_status: response.status,
          response_body: responseBody.slice(0, 1000),  // Truncate
          response_time_ms: responseTime,
          delivered_at: new Date().toISOString()
        })
        .eq('id', deliveryId)
      
      return true
    }
    
    // Failed - check if we should retry
    const newAttempts = delivery.attempts + 1
    const shouldRetry = 
      subscription.retry_policy !== 'none' && 
      newAttempts < delivery.max_attempts &&
      response.status >= 500  // Only retry on server errors
    
    await supabaseAdmin
      .from('webhook_deliveries')
      .update({
        status: shouldRetry ? 'retrying' : 'failed',
        attempts: newAttempts,
        response_status: response.status,
        response_body: responseBody.slice(0, 1000),
        response_time_ms: responseTime,
        last_error: `HTTP ${response.status}`,
        next_retry_at: shouldRetry ? calculateNextRetry(newAttempts) : null
      })
      .eq('id', deliveryId)
    
    return false
  } catch (error: any) {
    logger.error('webhookDelivery: error delivering webhook', error, {
      deliveryId
    })
    
    // Mark as failed
    await supabaseAdmin
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        last_error: error.message
      })
      .eq('id', deliveryId)
    
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
    const { data: deliveries, error: fetchError } = await supabaseAdmin
      .from('webhook_deliveries')
      .select('id')
      .or('status.eq.pending,and(status.eq.retrying,next_retry_at.lte.now())')
      .order('created_at', { ascending: true })
      .limit(batchSize)
    
    if (fetchError || !deliveries) {
      logger.error('webhookDelivery: failed to fetch queue', fetchError)
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
  await queueWebhookEvent(params.organizationId, params.eventType, resolvedEventId, params.data)
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
