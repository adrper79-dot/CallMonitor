/**
 * Webhook Receivers
 * 
 * Handles incoming webhooks from:
 * - Telnyx (call events)
 * - AssemblyAI (transcription)
 * - Stripe (billing events)
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'

export const webhooksRoutes = new Hono<{ Bindings: Env }>()

// Telnyx call events
webhooksRoutes.post('/telnyx', async (c) => {
  try {
    const body = await c.req.json()
    const eventType = body.data?.event_type

    // Log event type only (no sensitive payload data)
    console.log('Telnyx webhook:', eventType)

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
      default:
        console.log('Unhandled Telnyx event:', eventType)
    }

    return c.json({ received: true })
  } catch (err: any) {
    console.error('Telnyx webhook error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// AssemblyAI transcription webhook
webhooksRoutes.post('/assemblyai', async (c) => {
  try {
    const body = await c.req.json()
    const { transcript_id, status, text } = body

    console.log('AssemblyAI webhook:', status, transcript_id)

    if (status === 'completed' && text) {
      const db = getDb(c.env)

      // Update call with transcript
      await db.query(
        `UPDATE calls 
         SET transcript = $1, transcript_status = 'completed'
         WHERE transcript_id = $2`,
        [text, transcript_id]
      )
    }

    return c.json({ received: true })
  } catch (err: any) {
    console.error('AssemblyAI webhook error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// Stripe billing webhook
webhooksRoutes.post('/stripe', async (c) => {
  try {
    const signature = c.req.header('stripe-signature')
    const body = await c.req.text()

    // TODO: Verify Stripe signature
    // const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    const event = JSON.parse(body)
    console.log('Stripe webhook:', event.type)

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
      default:
        console.log('Unhandled Stripe event:', event.type)
    }

    return c.json({ received: true })
  } catch (err: any) {
    console.error('Stripe webhook error:', err)
    return c.json({ error: err.message }, 500)
  }
})

// --- Telnyx Handlers ---

async function handleCallInitiated(db: any, payload: any) {
  const { call_control_id, call_session_id, from, to } = payload
  
  await db.query(
    `UPDATE calls 
     SET call_sid = $1, status = 'initiated'
     WHERE call_control_id = $2 OR phone_number = $3`,
    [call_session_id, call_control_id, to]
  )
}

async function handleCallAnswered(db: any, payload: any) {
  const { call_control_id, call_session_id } = payload
  
  await db.query(
    `UPDATE calls 
     SET status = 'in_progress', answered_at = NOW()
     WHERE call_sid = $1 OR call_control_id = $2`,
    [call_session_id, call_control_id]
  )
}

async function handleCallHangup(db: any, payload: any) {
  const { call_control_id, call_session_id, hangup_cause } = payload
  
  await db.query(
    `UPDATE calls 
     SET status = 'completed', ended_at = NOW(), hangup_cause = $3
     WHERE call_sid = $1 OR call_control_id = $2`,
    [call_session_id, call_control_id, hangup_cause]
  )
}

async function handleRecordingSaved(env: Env, db: any, payload: any) {
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

async function handleSubscriptionUpdate(db: any, subscription: any) {
  await db.query(
    `UPDATE organizations 
     SET subscription_status = $2, subscription_id = $3, plan_id = $4
     WHERE stripe_customer_id = $1`,
    [subscription.customer, subscription.status, subscription.id, subscription.items.data[0]?.price?.id]
  )
}

async function handleSubscriptionCanceled(db: any, subscription: any) {
  await db.query(
    `UPDATE organizations 
     SET subscription_status = 'canceled'
     WHERE stripe_customer_id = $1`,
    [subscription.customer]
  )
}

async function handleInvoicePaid(db: any, invoice: any) {
  await db.query(
    `INSERT INTO billing_events (organization_id, event_type, amount, invoice_id, created_at)
     SELECT id, 'invoice_paid', $2, $3, NOW()
     FROM organizations WHERE stripe_customer_id = $1`,
    [invoice.customer, invoice.amount_paid, invoice.id]
  )
}
