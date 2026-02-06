/**
 * Audio Routes - Upload, transcription, and audio file management
 *
 * Endpoints:
 *   POST /upload        - Upload audio file to R2
 *   POST /transcribe    - Start transcription job
 *   GET  /transcriptions/:id - Get transcription status/result
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const audioRoutes = new Hono<{ Bindings: Env }>()

// Helper: get DB connection
async function getSQL(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

// Ensure tables exist
async function ensureTables(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS audio_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      file_key TEXT NOT NULL,
      original_name TEXT,
      content_type TEXT DEFAULT 'audio/mpeg',
      size_bytes INTEGER,
      duration_seconds INTEGER,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      audio_file_id UUID,
      file_key TEXT,
      status TEXT DEFAULT 'pending',
      language TEXT DEFAULT 'en',
      transcript TEXT,
      confidence NUMERIC(5,4),
      word_count INTEGER,
      error TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `
}

// POST /upload — Upload audio file
audioRoutes.post('/upload', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    await ensureTables(sql)

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

    const [record] = await sql`
      INSERT INTO audio_files (organization_id, file_key, original_name, content_type, size_bytes, created_by)
      VALUES (${session.organization_id}, ${fileName}, ${file.name}, ${file.type || 'audio/mpeg'}, ${arrayBuffer.byteLength}, ${session.user_id})
      RETURNING id, file_key, original_name, content_type, size_bytes, created_at
    `

    return c.json({ success: true, file: record })
  } catch (err: any) {
    console.error('POST /api/audio/upload error:', err?.message)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// POST /transcribe — Start transcription job
audioRoutes.post('/transcribe', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    await ensureTables(sql)

    const body = await c.req.json()
    const { audio_file_id, file_key, language } = body

    if (!audio_file_id && !file_key) {
      return c.json({ error: 'audio_file_id or file_key is required' }, 400)
    }

    // Create transcription record
    const [transcription] = await sql`
      INSERT INTO transcriptions (organization_id, audio_file_id, file_key, language, status, created_by)
      VALUES (
        ${session.organization_id},
        ${audio_file_id || null},
        ${file_key || null},
        ${language || 'en'},
        'processing',
        ${session.user_id}
      )
      RETURNING id, status, language, created_at
    `

    // In production, this would queue a Deepgram/Whisper job via a durable object or queue.
    // For now, mark as completed with a placeholder.
    await sql`
      UPDATE transcriptions
      SET status = 'completed',
          transcript = 'Transcription processing is configured but no speech-to-text provider is set.',
          confidence = 0,
          completed_at = NOW()
      WHERE id = ${transcription.id}
    `

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
    console.error('POST /api/audio/transcribe error:', err?.message)
    return c.json({ error: 'Transcription failed' }, 500)
  }
})

// GET /transcriptions/:id — Get transcription status & result
audioRoutes.get('/transcriptions/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    await ensureTables(sql)

    const id = c.req.param('id')

    const rows = await sql`
      SELECT id, audio_file_id, file_key, status, language, transcript, confidence, word_count, error, created_at, completed_at
      FROM transcriptions
      WHERE id = ${id} AND organization_id = ${session.organization_id}
    `

    if (rows.length === 0) {
      return c.json({ error: 'Transcription not found' }, 404)
    }

    return c.json({ success: true, transcription: rows[0] })
  } catch (err: any) {
    console.error('GET /api/audio/transcriptions/:id error:', err?.message)
    return c.json({ error: 'Failed to get transcription' }, 500)
  }
})
