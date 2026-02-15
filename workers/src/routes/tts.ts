/**
 * TTS Routes - Text-to-speech generation with KV caching
 *
 * Endpoints:
 *   POST /generate - Generate TTS audio from text (KV-cached by content hash)
 *
 * P2-2: Uses centralized getDb() — no inline neon imports
 * H1: Zod-validated request bodies via validateBody()
 *
 * Caching: SHA-256 hash of (text + voice_id + model) → R2 file key in KV
 * Same text + voice produces identical audio — KV lookup avoids duplicate API calls
 * TTL: 7 days (re-generates after expiry)
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { TTSGenerateSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { elevenLabsTtsRateLimit } from '../lib/rate-limit'

export const ttsRoutes = new Hono<AppEnv>()

const TTS_CACHE_TTL = 7 * 24 * 60 * 60 // 7 days in seconds
const TTS_MODEL = 'eleven_multilingual_v2'

/**
 * Generate a deterministic cache key from TTS input parameters.
 * Same text + voice + model always produces the same hash.
 */
async function ttsCacheKey(text: string, voiceId: string): Promise<string> {
  const raw = `tts:${voiceId}:${TTS_MODEL}:${text}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hash = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `tts-cache:${hash}`
}

// POST /generate — Generate TTS audio
ttsRoutes.post('/generate', elevenLabsTtsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  const db = getDb(c.env, session.organization_id)
  try {

    const parsed = await validateBody(c, TTSGenerateSchema)
    if (!parsed.success) return parsed.response
    const { text, voice_id, language, organization_id } = parsed.data

    // Validate org if provided
    if (organization_id && organization_id !== session.organization_id) {
      return c.json({ error: 'Invalid organization' }, 400)
    }

    // Use ElevenLabs API if configured, otherwise return 503
    const elevenLabsKey = c.env.ELEVENLABS_API_KEY
    if (!elevenLabsKey) {
      // BL-016: Return proper 503 instead of misleading 200 success
      return c.json({
        success: false,
        error: 'Text-to-speech service is not configured',
        code: 'TTS_NOT_CONFIGURED',
      }, 503)
    }

    const voiceIdResolved = voice_id || '21m00Tcm4TlvDq8ikWAM' // Default: Rachel

    // KV cache lookup — same text + voice produces identical audio
    let cacheKey: string | null = null
    try {
      cacheKey = await ttsCacheKey(text, voiceIdResolved)
      const cachedFileKey = await c.env.KV.get(cacheKey)
      if (cachedFileKey) {
        logger.info('TTS cache hit', { voiceId: voiceIdResolved, cacheKey })
        return c.json({
          success: true,
          audio_url: `/api/audio/files/${cachedFileKey}`,
          file_key: cachedFileKey,
          cached: true,
          duration_seconds: 0,
        })
      }
    } catch {
      // KV failure is non-fatal — proceed to generate
    }

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
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    )

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text()
      logger.error('ElevenLabs TTS error', { status: ttsResponse.status, body: errText })
      return c.json({ error: 'TTS generation failed', status: ttsResponse.status }, 500)
    }

    // Upload the audio to R2 if available
    const audioBuffer = await ttsResponse.arrayBuffer()
    const fileName = `tts/${session.organization_id}/${Date.now()}.mp3`

    if (c.env.R2) {
      await c.env.R2.put(fileName, audioBuffer, {
        httpMetadata: { contentType: 'audio/mpeg' },
      })

      // Store record in DB
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

      // Store in KV cache — same text + voice skips ElevenLabs API next time
      if (cacheKey) {
        c.env.KV.put(cacheKey, fileName, { expirationTtl: TTS_CACHE_TTL }).catch(() => {})
      }

      return c.json({
        success: true,
        audio_url: `/api/audio/files/${fileName}`,
        file_key: fileName,
        duration_seconds: Math.ceil(audioBuffer.byteLength / 16000), // rough estimate
      })
    }

    // No R2 — return raw audio
    return new Response(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err: any) {
    logger.error('POST /api/tts/generate error', { error: err?.message })
    return c.json({ error: 'Failed to generate TTS' }, 500)
  } finally {
    await db.end()
  }
})

