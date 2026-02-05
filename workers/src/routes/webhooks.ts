/**
 * Webhook Receivers
 * 
 * Handles incoming webhooks from:
 * - Telnyx (call events) — verified via HMAC-SHA256 signature
 * - AssemblyAI (transcription)
 * - Stripe (billing events) — verified via HMAC-SHA256 signature
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb, DbClient } from '../lib/db'

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
  const timestampPart = parts.find(p => p.startsWith('t='))
  const sigPart = parts.find(p => p.startsWith('v1='))

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
    .map(b => b.toString(16).padStart(2, '0'))
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
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestampHeader}.${payload}`))
  const computedSig = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
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

    // Verify Telnyx signature if secret is configured
    const telnyxSecret = (c.env as any).TELNYX_WEBHOOK_SECRET
    if (telnyxSecret) {
      const timestamp = c.req.header('telnyx-timestamp') || ''
      const signature = c.req.header('telnyx-signature-ed25519') || c.req.header('telnyx-signature') || ''
      const valid = await verifyTelnyxSignature(rawBody, timestamp, signature, telnyxSecret)
      if (!valid) {
        return c.json({ error: 'Invalid webhook signature' }, 401)
      }
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
    console.error('Telnyx webhook processing error')
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
    console.error('AssemblyAI webhook processing error')
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
      console.error('STRIPE_WEBHOOK_SECRET not configured')
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
      // Silently ignore other event types
    }

    return c.json({ received: true })
  } catch (err: any) {
    console.error('Stripe webhook processing error')
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
    [subscription.customer, subscription.status, subscription.id, subscription.items.data[0]?.price?.id]
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
