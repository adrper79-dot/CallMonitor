/**
 * AI Router Routes — Chat + TTS provider routing
 *
 * Chat: Grok primary, OpenAI fallback (GPT-4o-mini)
 * TTS: Grok Voice primary, ElevenLabs fallback with global cap of 5 concurrent jobs
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { authMiddleware, requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { aiLlmRateLimit, aiTtsRateLimit, complianceRateLimit } from '../lib/rate-limit'
import { validateBody } from '../lib/validate'
import { AiLlmChatSchema, TTSGenerateSchema } from '../lib/schemas'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { getFeatureFlag } from '../lib/feature-flags'
import { createGrokVoiceClient, getVoiceForLanguage } from '../lib/grok-voice-client'
import { buildComplianceGuidePayload } from '../lib/compliance-guides'

export const aiRouterRoutes = new Hono<AppEnv>()

const GROK_CHAT_MODEL = 'grok-2-latest'
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini'
const ELEVENLABS_MODEL = 'eleven_multilingual_v2'
const ELEVENLABS_CONCURRENCY_KEY = 'elevenlabs-tts-concurrency'
const ELEVENLABS_MAX_CONCURRENCY = 5

async function callGrokChat(apiKey: string, body: any) {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: body.model || GROK_CHAT_MODEL,
      messages: body.messages,
      // H-2 fix: Server-side cap prevents cost explosion from user-supplied values
      max_tokens: Math.min(body.max_tokens || 4096, 4096),
      temperature: body.temperature ?? 0.3,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Grok chat failed: ${response.status} ${errText}`)
  }

  return response.json<{
    choices: Array<{ message: { role: string; content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    model: string
  }>()
}

async function callOpenAIChat(apiKey: string, body: any) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: body.model || OPENAI_FALLBACK_MODEL,
      messages: body.messages,
      // H-2 fix: Server-side cap prevents cost explosion from user-supplied values
      max_tokens: Math.min(body.max_tokens || 4096, 4096),
      temperature: body.temperature ?? 0.3,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI chat failed: ${response.status} ${errText}`)
  }

  return response.json<{
    choices: Array<{ message: { role: string; content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    model: string
  }>()
}

async function acquireElevenLabsSlot(kv: KVNamespace) {
  // Use a lock key to prevent race conditions on concurrent requests.
  // KV doesn't have atomic CAS, so we use a short-lived lock pattern.
  const lockKey = `${ELEVENLABS_CONCURRENCY_KEY}:lock`

  // Try to acquire lock (5s TTL as safety net)
  const existingLock = await kv.get(lockKey)
  if (existingLock) {
    // Another request is modifying the counter — fail fast
    return false
  }

  await kv.put(lockKey, '1', { expirationTtl: 5 })

  try {
    const currentRaw = await kv.get(ELEVENLABS_CONCURRENCY_KEY)
    const current = currentRaw ? parseInt(currentRaw, 10) || 0 : 0

    if (current >= ELEVENLABS_MAX_CONCURRENCY) {
      return false
    }

    await kv.put(ELEVENLABS_CONCURRENCY_KEY, String(current + 1), { expirationTtl: 30 })
    return true
  } finally {
    await kv.delete(lockKey)
  }
}

async function releaseElevenLabsSlot(kv: KVNamespace) {
  try {
    const currentRaw = await kv.get(ELEVENLABS_CONCURRENCY_KEY)
    const current = currentRaw ? parseInt(currentRaw, 10) || 0 : 0
    const next = Math.max(current - 1, 0)
    await kv.put(ELEVENLABS_CONCURRENCY_KEY, String(next), { expirationTtl: 30 })
  } catch {
    // best-effort
  }
}

// POST /chat — Grok primary, OpenAI fallback
aiRouterRoutes.post('/chat', aiLlmRateLimit, authMiddleware, async (c) => {
  const session = c.get('session') as any
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const startedAt = Date.now()
  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, AiLlmChatSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const grokKey = c.env.GROK_API_KEY
    const openaiKey = c.env.OPENAI_API_KEY

    // Check feature flags
    const grokChatEnabled = await getFeatureFlag(db, 'grok_chat_enabled', session.organization_id)
    const openaiChatEnabled = await getFeatureFlag(db, 'openai_chat_enabled', session.organization_id)

    if ((!grokChatEnabled || !grokKey) && (!openaiChatEnabled || !openaiKey)) {
      return c.json({ error: 'No chat provider enabled' }, 503)
    }

    let result: any = null
    let provider = 'grok'
    try {
      if (grokChatEnabled && grokKey) {
        result = await callGrokChat(grokKey, body)
      } else {
        throw new Error('Grok chat not enabled')
      }
    } catch (err: any) {
      logger.warn('Grok chat failed or not enabled, falling back', { error: err?.message })
      provider = 'openai'
      if (openaiChatEnabled && openaiKey) {
        result = await callOpenAIChat(openaiKey, body)
      } else {
        return c.json({ error: 'No available chat provider' }, 503)
      }
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'ai_router_chat',
      resourceId: session.organization_id,
      action: AuditAction.AI_CHAT_COMPLETED,
      oldValue: null,
      newValue: {
        provider,
        model: result?.model || (provider === 'grok' ? GROK_CHAT_MODEL : OPENAI_FALLBACK_MODEL),
        total_tokens: result?.usage?.total_tokens,
      },
    })

    const latencyMs = Date.now() - startedAt

    return c.json({
      provider,
      model: result?.model || (provider === 'grok' ? GROK_CHAT_MODEL : OPENAI_FALLBACK_MODEL),
      content: result?.choices?.[0]?.message?.content || '',
      usage: result?.usage,
      latency_ms: latencyMs,
    })
  } catch (err: any) {
    logger.error('POST /api/ai/router/chat error', { error: err?.message })
    return c.json({ error: 'Chat failed' }, 500)
  } finally {
    await db.end()
  }
})

// POST /tts — Grok Voice primary, ElevenLabs fallback (concurrency-capped)
aiRouterRoutes.post('/tts', aiTtsRateLimit, async (c) => {
  let elevenLabsSlotAcquired = false
  let db: ReturnType<typeof getDb> | null = null
  const startedAt = Date.now()
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, TTSGenerateSchema)
    if (!parsed.success) return parsed.response
    const { text, voice_id, language, organization_id } = parsed.data

    if (organization_id && organization_id !== session.organization_id) {
      return c.json({ error: 'Invalid organization' }, 400)
    }

    db = getDb(c.env, session.organization_id)

    const grokKey = c.env.GROK_API_KEY
    const elevenLabsKey = c.env.ELEVENLABS_API_KEY

    // Check feature flags
    const grokTtsEnabled = await getFeatureFlag(db, 'grok_tts_enabled', session.organization_id)
    const elevenLabsTtsEnabled = await getFeatureFlag(db, 'elevenlabs_tts_enabled', session.organization_id)

    if ((!grokTtsEnabled || !grokKey) && (!elevenLabsTtsEnabled || !elevenLabsKey)) {
      return c.json({ error: 'No TTS provider enabled' }, 503)
    }

    // Try Grok Voice first
    try {
      if (grokTtsEnabled && grokKey) {
        const grokClient = createGrokVoiceClient(c.env)
        const voice = getVoiceForLanguage(language || 'en')
        const grokStart = Date.now()
        const grokResult = await grokClient.textToSpeech(text, {
        voice,
        model: 'grok-voice-1',
        response_format: 'mp3',
      })
      const grokLatency = Date.now() - grokStart

      const fileName = `tts/${session.organization_id}/${Date.now()}-grok.mp3`
      if (c.env.R2) {
        await c.env.R2.put(fileName, grokResult.audio, {
          httpMetadata: { contentType: 'audio/mpeg' },
        })

        await db.query(
          `INSERT INTO tts_audio (organization_id, text, voice_id, language, file_key, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            session.organization_id,
            text.substring(0, 500),
            voice,
            language || 'en',
            fileName,
            session.user_id,
          ]
        )

        writeAuditLog(db, {
          organizationId: session.organization_id,
          userId: session.user_id,
          resourceType: 'ai_router_tts',
          resourceId: session.organization_id,
          action: AuditAction.AI_TTS_GENERATED,
          oldValue: null,
          newValue: { provider: 'grok', voice },
        })

        return c.json({
          provider: 'grok',
          audio_url: `/api/audio/files/${fileName}`,
          file_key: fileName,
          duration_seconds: grokResult.duration_seconds,
          latency_ms: grokLatency,
        })
      }

      // No R2 available — return raw audio
      return new Response(grokResult.audio, { headers: { 'Content-Type': 'audio/mpeg' } })
      } else {
        throw new Error('Grok TTS not enabled')
      }
    } catch (err: any) {
      logger.warn('Grok TTS failed or not enabled, falling back', { error: err?.message })
    }

    // ElevenLabs fallback with global concurrency cap
    if (!elevenLabsTtsEnabled || !elevenLabsKey) {
      return c.json({ error: 'All TTS providers unavailable' }, 503)
    }

    if (!(await acquireElevenLabsSlot(c.env.KV))) {
      return c.json({ error: 'TTS capacity temporarily limited', code: 'TTS_OVER_CAPACITY' }, 503)
    }
    elevenLabsSlotAcquired = true

    const voiceIdResolved = voice_id || '21m00Tcm4TlvDq8ikWAM'

    const ttsStart = Date.now()
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceIdResolved}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    )

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text()
      logger.error('ElevenLabs TTS error', { status: ttsResponse.status, body: errText })
      return c.json({ error: 'TTS generation failed', status: ttsResponse.status }, 500)
    }

    const audioBuffer = await ttsResponse.arrayBuffer()
    const fileName = `tts/${session.organization_id}/${Date.now()}-11labs.mp3`
    const latencyMs = Date.now() - ttsStart

    if (c.env.R2) {
      await c.env.R2.put(fileName, audioBuffer, {
        httpMetadata: { contentType: 'audio/mpeg' },
      })

      await db.query(
        `INSERT INTO tts_audio (organization_id, text, voice_id, language, file_key, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          session.organization_id,
          text.substring(0, 500),
          voiceIdResolved,
          language || 'en',
          fileName,
          session.user_id,
        ]
      )

      writeAuditLog(db, {
        organizationId: session.organization_id,
        userId: session.user_id,
        resourceType: 'ai_router_tts',
        resourceId: session.organization_id,
        action: AuditAction.AI_TTS_GENERATED,
        oldValue: null,
        newValue: { provider: 'elevenlabs', voice: voiceIdResolved },
      })

      return c.json({
        provider: 'elevenlabs',
        audio_url: `/api/audio/files/${fileName}`,
        file_key: fileName,
        duration_seconds: Math.ceil(audioBuffer.byteLength / 16000),
        latency_ms: latencyMs,
      })
    }

    return new Response(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err: any) {
    logger.error('POST /api/ai/router/tts error', { error: err?.message })
    return c.json({ error: 'Failed to generate TTS' }, 500)
  } finally {
    if (elevenLabsSlotAcquired) {
      await releaseElevenLabsSlot(c.env.KV)
    }
    if (db) {
      await db.end()
    }
  }
})

// GET /compliance-guide — Static compliance rules, checklists, and modes
aiRouterRoutes.get('/compliance-guide', complianceRateLimit, authMiddleware, async (c) => {
  const session = c.get('session') as any
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const payload = buildComplianceGuidePayload()

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'ai_router_compliance',
      resourceId: session.organization_id,
      action: AuditAction.COMPLIANCE_GUIDE_VIEWED,
      oldValue: null,
      newValue: { rules: payload.rules.length, checklist: payload.checklist.length },
    })

    return c.json({
      organization_id: session.organization_id,
      modes: payload.modes,
      rules: payload.rules,
      checklist: payload.checklist,
    })
  } catch (err: any) {
    logger.error('GET /api/ai/router/compliance-guide error', { error: err?.message })
    return c.json({ error: 'Failed to load compliance guide' }, 500)
  } finally {
    await db.end()
  }
})
