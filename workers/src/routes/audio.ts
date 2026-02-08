/**
 * Audio Routes - Upload, transcription, and audio file management
 *
 * Endpoints:
 *   POST /upload        - Upload audio file to R2
 *   POST /transcribe    - Start transcription job
 *   GET  /transcriptions/:id - Get transcription status/result
 *
 * P2-2: Uses centralized getDb() — no inline neon imports
 * H1: Zod-validated request bodies via validateBody()
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { TranscribeSchema } from '../lib/schemas'
import { logger } from '../lib/logger'

export const audioRoutes = new Hono<{ Bindings: Env }>()

// POST /upload — Upload audio file
audioRoutes.post('/upload', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'No file provided' }, 400)

    const fileName = `audio/${session.organization_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const arrayBuffer = await file.arrayBuffer()

    if (c.env.R2) {
      await c.env.R2.put(fileName, arrayBuffer, {
        httpMetadata: { contentType: file.type || 'audio/mpeg' },
      })
    }

    const result = await db.query(
      `INSERT INTO audio_files (organization_id, file_key, original_name, content_type, size_bytes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, file_key, original_name, content_type, size_bytes, created_at`,
      [
        session.organization_id,
        fileName,
        file.name,
        file.type || 'audio/mpeg',
        arrayBuffer.byteLength,
        session.user_id,
      ]
    )

    return c.json({ success: true, file: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/audio/upload error', { error: err?.message })
    return c.json({ error: 'Upload failed' }, 500)
  } finally {
    await db.end()
  }
})

// POST /transcribe — Start transcription job
audioRoutes.post('/transcribe', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, TranscribeSchema)
    if (!parsed.success) return parsed.response
    const { audio_file_id, file_key, language } = parsed.data

    // Create transcription record
    const insertResult = await db.query(
      `INSERT INTO transcriptions (organization_id, audio_file_id, file_key, language, status, created_by)
       VALUES ($1, $2, $3, $4, 'processing', $5)
       RETURNING id, status, language, created_at`,
      [
        session.organization_id,
        audio_file_id || null,
        file_key || null,
        language || 'en',
        session.user_id,
      ]
    )
    const transcription = insertResult.rows[0]

    // In production, this would queue a Deepgram/Whisper job via a durable object or queue.
    // For now, mark as completed with a placeholder.
    await db.query(
      `UPDATE transcriptions
       SET status = 'completed',
           transcript = 'Transcription processing is configured but no speech-to-text provider is set.',
           confidence = 0,
           completed_at = NOW()
       WHERE id = $1`,
      [transcription.id]
    )

    return c.json({
      success: true,
      transcription: {
        id: transcription.id,
        status: 'processing',
        language: transcription.language,
        created_at: transcription.created_at,
      },
    })
  } catch (err: any) {
    logger.error('POST /api/audio/transcribe error', { error: err?.message })
    return c.json({ error: 'Transcription failed' }, 500)
  } finally {
    await db.end()
  }
})

// GET /transcriptions/:id — Get transcription status & result
audioRoutes.get('/transcriptions/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const id = c.req.param('id')

    const result = await db.query(
      `SELECT id, audio_file_id, file_key, status, language, transcript, confidence, word_count, error, created_at, completed_at
       FROM transcriptions
       WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Transcription not found' }, 404)
    }

    return c.json({ success: true, transcription: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/audio/transcriptions/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get transcription' }, 500)
  } finally {
    await db.end()
  }
})
