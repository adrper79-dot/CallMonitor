/**
 * Live Translation Routes — Real-time translation via SSE
 *
 * Provides Server-Sent Events streaming for live call translation.
 * Plan gating: requires 'business' plan (live_translation feature).
 *
 * Architecture:
 *   Client opens SSE → Worker polls call_translations table → pushes deltas
 *   Translation records are inserted by the Telnyx streaming-media webhook
 *   handler once transcription + translation complete for each utterance.
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { voiceRateLimit } from '../lib/rate-limit'

export const liveTranslationRoutes = new Hono<{ Bindings: Env }>()

/**
 * GET /api/voice/translate/stream?callId=...
 *
 * Opens an SSE connection that pushes live translation segments
 * for the given call. Polls every 1 second while the call is active.
 *
 * Events:
 *   translation  — { id, original_text, translated_text, source_language, target_language, timestamp }
 *   status       — { status: 'active' | 'ended' }
 *   error        — { message }
 *   done         — stream close
 */
liveTranslationRoutes.get('/stream', voiceRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const callId = c.req.query('callId')
    if (!callId) return c.json({ error: 'callId query parameter required' }, 400)

    // Verify the call belongs to this org
    const callCheck = await db.query(
      'SELECT id, status FROM calls WHERE id = $1 AND organization_id = $2 LIMIT 1',
      [callId, session.organization_id]
    )
    if (callCheck.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    // Ensure call_translations table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS call_translations (
        id SERIAL PRIMARY KEY,
        call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL,
        source_language TEXT NOT NULL DEFAULT 'en',
        target_language TEXT NOT NULL DEFAULT 'es',
        original_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        segment_index INTEGER NOT NULL DEFAULT 0,
        confidence REAL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    // Create index if not exists (idempotent)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_call_translations_call_id
        ON call_translations (call_id, segment_index)
    `)

    // Audit the stream start
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'call_translations',
      resourceId: callId,
      action: AuditAction.LIVE_TRANSLATION_STARTED,
      after: { call_id: callId },
    }).catch(() => {})

    logger.info('Live translation stream opened', {
      callId,
      orgId: session.organization_id,
    })

    // Stream SSE
    return streamSSE(c, async (stream) => {
      let lastSegmentIndex = -1
      let heartbeatCount = 0
      const MAX_HEARTBEATS = 1800 // 30 minutes max at 1/s

      while (heartbeatCount < MAX_HEARTBEATS) {
        try {
          // Check call status
          const statusResult = await db.query(
            'SELECT status FROM calls WHERE id = $1 AND organization_id = $2 LIMIT 1',
            [callId, session.organization_id]
          )

          if (statusResult.rows.length === 0) {
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({ message: 'Call not found' }),
            })
            break
          }

          const callStatus = statusResult.rows[0].status
          const isActive = ['initiating', 'ringing', 'in_progress'].includes(callStatus)

          // Fetch new translation segments
          const newSegments = await db.query(
            `SELECT id, original_text, translated_text, source_language, target_language,
                    segment_index, confidence, created_at
             FROM call_translations
             WHERE call_id = $1 AND organization_id = $2 AND segment_index > $3
             ORDER BY segment_index ASC
             LIMIT 50`,
            [callId, session.organization_id, lastSegmentIndex]
          )

          // Push each new segment
          for (const seg of newSegments.rows) {
            await stream.writeSSE({
              event: 'translation',
              data: JSON.stringify({
                id: seg.id,
                original_text: seg.original_text,
                translated_text: seg.translated_text,
                source_language: seg.source_language,
                target_language: seg.target_language,
                segment_index: seg.segment_index,
                confidence: seg.confidence,
                timestamp: seg.created_at,
              }),
              id: String(seg.segment_index),
            })
            lastSegmentIndex = seg.segment_index
          }

          // Push status event
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({ status: isActive ? 'active' : 'ended' }),
          })

          // If call ended, send final batch then close
          if (!isActive) {
            await stream.writeSSE({ event: 'done', data: '{}' })
            break
          }

          heartbeatCount++
          await stream.sleep(1000)
        } catch (pollErr: any) {
          logger.error('Live translation poll error', { error: pollErr?.message, callId })
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ message: 'Internal error' }),
          })
          break
        }
      }

      // Audit stream end
      writeAuditLog(db, {
        organizationId: session.organization_id,
        userId: session.user_id,
        resourceType: 'call_translations',
        resourceId: callId,
        action: AuditAction.LIVE_TRANSLATION_COMPLETED,
        after: { call_id: callId, segments_delivered: lastSegmentIndex + 1 },
      }).catch(() => {})
    })
  } catch (err: any) {
    logger.error('Live translation stream error', { error: err?.message })
    return c.json({ error: 'Failed to start live translation stream' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * GET /api/voice/translate/history?callId=...
 *
 * Returns all translation segments for a completed call.
 * Useful for post-call review of live-translated content.
 */
liveTranslationRoutes.get('/history', voiceRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const callId = c.req.query('callId')
    if (!callId) return c.json({ error: 'callId query parameter required' }, 400)

    const result = await db.query(
      `SELECT id, original_text, translated_text, source_language, target_language,
              segment_index, confidence, created_at
       FROM call_translations
       WHERE call_id = $1 AND organization_id = $2
       ORDER BY segment_index ASC`,
      [callId, session.organization_id]
    )

    return c.json({
      success: true,
      call_id: callId,
      segments: result.rows,
      count: result.rows.length,
    })
  } catch (err: any) {
    logger.error('GET /api/voice/translate/history error', { error: err?.message })
    return c.json({ error: 'Failed to get translation history' }, 500)
  } finally {
    await db.end()
  }
})
