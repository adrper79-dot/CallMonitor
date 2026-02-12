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
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { TranscribeSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { audioRateLimit } from '../lib/rate-limit'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const audioRoutes = new Hono<AppEnv>()

// POST /upload — Upload audio file
audioRoutes.post('/upload', audioRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
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

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'audio_files',
      resourceId: result.rows[0].id,
      action: AuditAction.AUDIO_UPLOADED,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ success: true, file: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/audio/upload error', { error: err?.message })
    return c.json({ error: 'Upload failed' }, 500)
  } finally {
    await db.end()
  }
})

// POST /transcribe — Start transcription job
audioRoutes.post('/transcribe', audioRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
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

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'transcriptions',
      resourceId: transcription.id,
      action: AuditAction.AUDIO_TRANSCRIPTION_STARTED,
      oldValue: null,
      newValue: { id: transcription.id, status: 'processing', language: transcription.language },
    })

    // BL-015: Submit to AssemblyAI for real transcription
    if (c.env.ASSEMBLYAI_API_KEY && file_key) {
      try {
        const audioUrl = `${c.env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/audio/files/${file_key}`
        const webhookUrl = `${c.env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'}/api/webhooks/assemblyai`

        const assemblyRes = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: {
            Authorization: c.env.ASSEMBLYAI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: audioUrl,
            language_code: language || 'en',
            webhook_url: webhookUrl,
            speaker_labels: true,
            speakers_expected: 2,
            auto_highlights: true,
            sentiment_analysis: true,
            entity_detection: true,
            content_safety: true,
            ...(c.env.ASSEMBLYAI_WEBHOOK_SECRET
              ? {
                  webhook_auth_header_name: 'Authorization',
                  webhook_auth_header_value: c.env.ASSEMBLYAI_WEBHOOK_SECRET,
                }
              : {}),
          }),
        })

        if (assemblyRes.ok) {
          const assemblyData = (await assemblyRes.json()) as { id: string }
          // Store the AssemblyAI transcript ID for webhook matching
          await db.query(`UPDATE transcriptions SET external_id = $1 WHERE id = $2`, [
            assemblyData.id,
            transcription.id,
          ])
        } else {
          logger.warn('AssemblyAI submission failed', {
            status: assemblyRes.status,
            transcriptionId: transcription.id,
          })
          await db.query(`UPDATE transcriptions SET status = 'failed' WHERE id = $1`, [
            transcription.id,
          ])
        }
      } catch (assemblyErr: any) {
        logger.error('AssemblyAI submission exception', { error: assemblyErr?.message })
        await db.query(`UPDATE transcriptions SET status = 'failed' WHERE id = $1`, [
          transcription.id,
        ])
      }
    } else if (!c.env.ASSEMBLYAI_API_KEY) {
      // No STT provider configured — mark as failed
      await db.query(
        `UPDATE transcriptions SET status = 'failed', transcript = 'No speech-to-text provider configured' WHERE id = $1`,
        [transcription.id]
      )
    }

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
audioRoutes.get('/transcriptions/:id', audioRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
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

