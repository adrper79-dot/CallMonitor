/**
 * TTS Routes - Text-to-speech generation
 *
 * Endpoints:
 *   POST /generate - Generate TTS audio from text
 *
 * P2-2: Uses centralized getDb() — no inline neon imports
 * H1: Zod-validated request bodies via validateBody()
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { TTSGenerateSchema } from '../lib/schemas'
import { logger } from '../lib/logger'

export const ttsRoutes = new Hono<{ Bindings: Env }>()

async function ensureTable(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tts_audio (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      text TEXT NOT NULL,
      voice_id TEXT,
      language TEXT DEFAULT 'en',
      file_key TEXT NOT NULL,
      duration_seconds INTEGER,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// POST /generate — Generate TTS audio
ttsRoutes.post('/generate', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, TTSGenerateSchema)
    if (!parsed.success) return parsed.response
    const { text, voice_id, language, organization_id } = parsed.data

    // Validate org if provided
    if (organization_id && organization_id !== session.organization_id) {
      return c.json({ error: 'Invalid organization' }, 400)
    }

    // Use ElevenLabs API if configured, otherwise return stub
    const elevenLabsKey = c.env.ELEVENLABS_API_KEY
    if (!elevenLabsKey) {
      return c.json({
        success: true,
        audio_url: null,
        message: 'TTS not configured — set ELEVENLABS_API_KEY secret',
        duration_seconds: 0,
      })
    }

    const voiceIdResolved = voice_id || '21m00Tcm4TlvDq8ikWAM' // Default: Rachel
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
      const db = getDb(c.env)
      await ensureTable(db)

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
  }
})
