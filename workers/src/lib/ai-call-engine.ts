/**
 * AI Call Engine — Hybrid AI Toggle state machine
 *
 * Manages the AI-driven call dialog loop via Telnyx Call Control v2.
 * State machine: IDLE → AI_GREETING → AI_LISTENING → AI_THINKING → AI_SPEAKING → loop
 *
 * State is stored in KV with key `AI_CALL_STATE:{call_control_id}`.
 * The gather → OpenAI → speak loop continues until:
 *   1. Caller says a handoff keyword → bridge to human agent
 *   2. Max turns reached → bridge to human agent
 *   3. Call hangs up
 *
 * @see ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md — Phase 3
 */

import type { Env } from '../index'
import type { DbClient } from './db'
import { logger } from './logger'

const OPENAI_BASE = 'https://api.openai.com/v1'
const TELNYX_BASE = 'https://api.telnyx.com/v2'
const MAX_TURNS = 20
const GATHER_TIMEOUT_SECS = 8
const STATE_TTL_SECS = 3600 // 1 hour

/** AI Call States */
type AICallState =
  | 'IDLE'
  | 'AI_GREETING'
  | 'AI_LISTENING'
  | 'AI_THINKING'
  | 'AI_SPEAKING'
  | 'HANDOFF'
  | 'COMPLETED'

interface AICallContext {
  state: AICallState
  callControlId: string
  callId: string
  organizationId: string
  turn: number
  conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  prompt: string
  model: string
  temperature: number
  handoffKeywords: string[]
  agentNumber?: string
}

const KV_PREFIX = 'AI_CALL_STATE'

/** Get state from KV */
async function getState(kv: KVNamespace, callControlId: string): Promise<AICallContext | null> {
  const raw = await kv.get(`${KV_PREFIX}:${callControlId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Save state to KV */
async function saveState(
  kv: KVNamespace,
  callControlId: string,
  ctx: AICallContext
): Promise<void> {
  await kv.put(`${KV_PREFIX}:${callControlId}`, JSON.stringify(ctx), {
    expirationTtl: STATE_TTL_SECS,
  })
}

/** Delete state from KV */
async function clearState(kv: KVNamespace, callControlId: string): Promise<void> {
  await kv.delete(`${KV_PREFIX}:${callControlId}`)
}

/**
 * Initialize an AI call dialog.
 * Called from the AI toggle route when an agent activates AI mode on a live call.
 */
export async function startAICall(
  env: Env,
  db: DbClient,
  callControlId: string,
  callId: string,
  organizationId: string,
  config: {
    prompt: string
    model?: string
    temperature?: number
    handoffKeywords?: string[]
    agentNumber?: string
  }
): Promise<void> {
  const ctx: AICallContext = {
    state: 'AI_GREETING',
    callControlId,
    callId,
    organizationId,
    turn: 0,
    conversationHistory: [{ role: 'system', content: config.prompt }],
    prompt: config.prompt,
    model: config.model || 'gpt-4o-mini',
    temperature: config.temperature ?? 0.3,
    handoffKeywords: config.handoffKeywords || [
      'agent',
      'human',
      'person',
      'representative',
      'transfer',
      'operator',
    ],
    agentNumber: config.agentNumber,
  }

  await saveState(env.KV, callControlId, ctx)

  // Generate initial greeting via OpenAI
  const greeting = await generateResponse(
    env.OPENAI_API_KEY,
    ctx,
    'Begin the conversation with a brief greeting.'
  )

  ctx.conversationHistory.push({ role: 'assistant', content: greeting })
  ctx.state = 'AI_SPEAKING'
  await saveState(env.KV, callControlId, ctx)

  // Speak the greeting
  await telnyxSpeak(env.TELNYX_API_KEY, callControlId, greeting, ctx.turn)

  logger.info('AI call started', { callControlId, callId, organizationId })
}

/**
 * Handle an event in the AI call state machine.
 * Called from webhook handlers for gather_ended, speak_ended, and bridged events.
 */
export async function handleAICallEvent(
  env: Env,
  db: DbClient,
  eventType: string,
  callControlId: string,
  data: any
): Promise<void> {
  const ctx = await getState(env.KV, callControlId)
  if (!ctx) {
    logger.info('AI call event for unknown state', { callControlId, eventType })
    return
  }

  switch (eventType) {
    case 'speak_ended':
      await onSpeakEnded(env, db, ctx)
      break
    case 'gather_ended':
      await onGatherEnded(env, db, ctx, data.transcript, data.status)
      break
    case 'bridged':
      await onBridged(env, ctx)
      break
    default:
      logger.info('Unknown AI call event', { eventType, callControlId })
  }
}

/**
 * After AI finishes speaking → start listening for caller input.
 */
async function onSpeakEnded(env: Env, db: DbClient, ctx: AICallContext): Promise<void> {
  if (ctx.state === 'COMPLETED' || ctx.state === 'HANDOFF') return

  ctx.state = 'AI_LISTENING'
  ctx.turn++
  await saveState(env.KV, ctx.callControlId, ctx)

  if (ctx.turn >= MAX_TURNS) {
    logger.info('AI call max turns reached, handing off', { callControlId: ctx.callControlId })
    await initiateHandoff(env, db, ctx, 'Max conversation turns reached')
    return
  }

  // Start gathering caller speech
  await telnyxGather(env.TELNYX_API_KEY, ctx.callControlId, ctx.turn)
}

/**
 * After gather completes → process caller's response, check for handoff, generate reply.
 */
async function onGatherEnded(
  env: Env,
  db: DbClient,
  ctx: AICallContext,
  transcript: string,
  status: string
): Promise<void> {
  if (ctx.state === 'COMPLETED' || ctx.state === 'HANDOFF') return

  // If gather timed out with no speech, prompt again
  if (status === 'call_hangup') {
    ctx.state = 'COMPLETED'
    await clearState(env.KV, ctx.callControlId)
    return
  }

  if (!transcript || transcript.trim().length === 0) {
    // No speech detected — ask if caller is still there
    ctx.state = 'AI_SPEAKING'
    await saveState(env.KV, ctx.callControlId, ctx)
    await telnyxSpeak(
      env.TELNYX_API_KEY,
      ctx.callControlId,
      "Are you still there? I'm here to help.",
      ctx.turn
    )
    return
  }

  // Check for handoff keywords
  const lowerTranscript = transcript.toLowerCase()
  const handoffTriggered = ctx.handoffKeywords.some((kw) =>
    lowerTranscript.includes(kw.toLowerCase())
  )

  if (handoffTriggered) {
    await initiateHandoff(env, db, ctx, `Caller requested: "${transcript}"`)
    return
  }

  // Add caller message to history
  ctx.conversationHistory.push({ role: 'user', content: transcript })
  ctx.state = 'AI_THINKING'
  await saveState(env.KV, ctx.callControlId, ctx)

  // Generate AI response
  const response = await generateResponse(env.OPENAI_API_KEY, ctx, transcript)

  ctx.conversationHistory.push({ role: 'assistant', content: response })
  ctx.state = 'AI_SPEAKING'
  await saveState(env.KV, ctx.callControlId, ctx)

  // Speak the response
  await telnyxSpeak(env.TELNYX_API_KEY, ctx.callControlId, response, ctx.turn)

  // Record the turn in DB (non-blocking)
  db.query(
    `INSERT INTO call_notes (organization_id, call_id, note, note_type, created_by, created_at)
     VALUES ($1, $2, $3, 'ai_dialog', 'ai-agent', NOW())`,
    [ctx.organizationId, ctx.callId, `[Turn ${ctx.turn}] Caller: ${transcript}\nAI: ${response}`]
  ).catch(() => {})
}

/**
 * After call is bridged → clean up AI state.
 */
async function onBridged(env: Env, ctx: AICallContext): Promise<void> {
  ctx.state = 'COMPLETED'
  await clearState(env.KV, ctx.callControlId)
  logger.info('AI call bridged to human, state cleared', { callControlId: ctx.callControlId })
}

/**
 * Hand off from AI to human agent.
 */
async function initiateHandoff(
  env: Env,
  db: DbClient,
  ctx: AICallContext,
  reason: string
): Promise<void> {
  ctx.state = 'HANDOFF'
  await saveState(env.KV, ctx.callControlId, ctx)

  logger.info('AI handoff initiated', {
    callControlId: ctx.callControlId,
    reason,
    turn: ctx.turn,
  })

  // Notify caller of transfer
  await telnyxSpeak(
    env.TELNYX_API_KEY,
    ctx.callControlId,
    "I'll connect you with a team member now. Please hold.",
    ctx.turn
  )

  // If we have an agent number, bridge the call
  if (ctx.agentNumber) {
    try {
      await fetch(`${TELNYX_BASE}/calls/${ctx.callControlId}/actions/bridge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          call_control_id: ctx.callControlId,
        }),
      })
    } catch (err) {
      logger.warn('Bridge call failed', { error: (err as Error)?.message })
    }
  }

  // Update call status
  db.query(
    `UPDATE calls SET status = 'transferring', updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [ctx.callId, ctx.organizationId]
  ).catch(() => {})
}

/**
 * Stop AI mode on a call (human takeover).
 * Called from the toggle API route.
 */
export async function stopAICall(env: Env, callControlId: string): Promise<void> {
  await clearState(env.KV, callControlId)
  logger.info('AI call stopped by agent', { callControlId })
}

// --- Telnyx Call Control Helpers ---

/**
 * Issue a Telnyx speak command (TTS).
 */
async function telnyxSpeak(
  apiKey: string,
  callControlId: string,
  text: string,
  turn: number
): Promise<void> {
  const clientState = btoa(JSON.stringify({ flow: 'ai_dialog', turn }))

  const res = await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/speak`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payload: text,
      voice: 'female',
      language: 'en-US',
      client_state: clientState,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    logger.warn('Telnyx speak failed', {
      callControlId,
      status: res.status,
      body: errText.substring(0, 200),
    })
  }
}

/**
 * Issue a Telnyx gather command (collect speech input).
 */
async function telnyxGather(apiKey: string, callControlId: string, turn: number): Promise<void> {
  const clientState = btoa(JSON.stringify({ flow: 'ai_dialog', turn }))

  const res = await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/gather`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_type: 'speech',
      language: 'en-US',
      timeout_millis: GATHER_TIMEOUT_SECS * 1000,
      inter_digit_timeout_millis: 3000,
      client_state: clientState,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    logger.warn('Telnyx gather failed', {
      callControlId,
      status: res.status,
      body: errText.substring(0, 200),
    })
  }
}

/**
 * Generate an AI response via OpenAI Chat Completions.
 */
async function generateResponse(
  openaiKey: string,
  ctx: AICallContext,
  latestInput: string
): Promise<string> {
  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ctx.model,
      messages: ctx.conversationHistory,
      max_tokens: 200,
      temperature: ctx.temperature,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`OpenAI chat API error: ${response.status}`)
  }

  const data = await response.json<{
    choices: Array<{ message: { content: string } }>
  }>()

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    return "I apologize, but I'm having trouble processing your request. Let me connect you with a team member."
  }

  return content
}

