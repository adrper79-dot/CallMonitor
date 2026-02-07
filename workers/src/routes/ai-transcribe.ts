/**
 * AI Transcription Routes — AssemblyAI Edge Proxy
 *
 * Proxies transcription requests through Cloudflare Workers to:
 * 1. Authenticate via session (requireAuth)
 * 2. Gate by plan tier (requirePlan 'starter'+)
 * 3. Rate limit per IP (aiTranscriptionRateLimit)
 * 4. Log usage for billing metering
 * 5. Store results in ai_summaries for usage tracking
 *
 * Endpoints:
 *   POST /transcribe     - Submit audio URL for transcription
 *   GET  /status/:id     - Check transcription job status
 *   GET  /result/:id     - Get completed transcription
 *
 * @see ARCH_DOCS/01-CORE/COMPREHENSIVE_ARCHITECTURE_WITH_VISUALS.md
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { aiTranscriptionRateLimit } from '../lib/rate-limit'
import { requirePlan } from '../lib/plan-gating'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { logger } from '../lib/logger'

export const aiTranscribeRoutes = new Hono<{ Bindings: Env }>()

const ASSEMBLYAI_BASE = 'https://api.assemblyai.com/v2'

// POST /transcribe — Submit audio for transcription via AssemblyAI
aiTranscribeRoutes.post(
  '/transcribe',
  aiTranscriptionRateLimit,
  requirePlan('starter'),
  async (c) => {
    const session = c.get('session') as any
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const apiKey = c.env.ASSEMBLYAI_API_KEY
    if (!apiKey) {
      return c.json({ error: 'Transcription service not configured' }, 503)
    }

    const db = getDb(c.env)
    try {
      const body = await c.req.json<{
        audio_url?: string
        call_id?: string
        language_code?: string
        speaker_labels?: boolean
      }>()

      if (!body.audio_url) {
        return c.json({ error: 'audio_url is required' }, 400)
      }

      // Submit to AssemblyAI
      const aaiResponse = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: body.audio_url,
          language_code: body.language_code || 'en',
          speaker_labels: body.speaker_labels ?? true,
          auto_highlights: true,
          sentiment_analysis: true,
        }),
      })

      if (!aaiResponse.ok) {
        const errText = await aaiResponse.text()
        logger.error('AssemblyAI submission failed', { status: aaiResponse.status, error: errText })
        return c.json({ error: 'Transcription service error' }, 502)
      }

      const aaiResult = await aaiResponse.json<{ id: string; status: string }>()

      // Store job reference in DB for usage tracking
      await db.query(
        `INSERT INTO ai_summaries (org_id, call_id, provider, external_id, status, created_at)
       VALUES ($1, $2, 'assemblyai', $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
        [session.organization_id, body.call_id || null, aaiResult.id, aaiResult.status]
      )

      writeAuditLog(db, {
        userId: session.user_id,
        orgId: session.organization_id,
        action: AuditAction.CALL_RECORDED,
        resourceType: 'transcription',
        resourceId: aaiResult.id,
        oldValue: null,
        newValue: { audio_url: body.audio_url, call_id: body.call_id },
      }).catch(() => {})

      return c.json(
        {
          id: aaiResult.id,
          status: aaiResult.status,
        },
        201
      )
    } catch (err: any) {
      logger.error('POST /api/ai/transcribe error', { error: err?.message })
      return c.json({ error: 'Transcription submission failed' }, 500)
    } finally {
      await db.end()
    }
  }
)

// GET /status/:id — Check transcription job status
aiTranscribeRoutes.get('/status/:id', aiTranscriptionRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const apiKey = c.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return c.json({ error: 'Transcription service not configured' }, 503)
  }

  const transcriptId = c.req.param('id')

  try {
    const aaiResponse = await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcriptId}`, {
      headers: { Authorization: apiKey },
    })

    if (!aaiResponse.ok) {
      return c.json({ error: 'Transcription not found' }, 404)
    }

    const aaiResult = await aaiResponse.json<{ id: string; status: string; error?: string }>()

    return c.json({
      id: aaiResult.id,
      status: aaiResult.status,
      error: aaiResult.error || null,
    })
  } catch (err: any) {
    logger.error('GET /api/ai/transcribe/status error', { error: err?.message })
    return c.json({ error: 'Status check failed' }, 500)
  }
})

// GET /result/:id — Get completed transcription result
aiTranscribeRoutes.get('/result/:id', aiTranscriptionRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const apiKey = c.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return c.json({ error: 'Transcription service not configured' }, 503)
  }

  const transcriptId = c.req.param('id')
  const db = getDb(c.env)

  try {
    const aaiResponse = await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcriptId}`, {
      headers: { Authorization: apiKey },
    })

    if (!aaiResponse.ok) {
      return c.json({ error: 'Transcription not found' }, 404)
    }

    const aaiResult = await aaiResponse.json<{
      id: string
      status: string
      text?: string
      utterances?: Array<{ speaker: string; text: string; start: number; end: number }>
      sentiment_analysis_results?: any[]
      auto_highlights_result?: any
      error?: string
    }>()

    if (aaiResult.status !== 'completed') {
      return c.json({
        id: aaiResult.id,
        status: aaiResult.status,
        error: aaiResult.error || null,
      })
    }

    // Update DB record with completion
    await db.query(
      `UPDATE ai_summaries SET status = 'completed', summary_text = $1, updated_at = NOW()
       WHERE external_id = $2 AND org_id = $3`,
      [aaiResult.text?.substring(0, 5000), transcriptId, session.organization_id]
    )

    return c.json({
      id: aaiResult.id,
      status: aaiResult.status,
      text: aaiResult.text,
      utterances: aaiResult.utterances,
      sentiment: aaiResult.sentiment_analysis_results,
      highlights: aaiResult.auto_highlights_result,
    })
  } catch (err: any) {
    logger.error('GET /api/ai/transcribe/result error', { error: err?.message })
    return c.json({ error: 'Result fetch failed' }, 500)
  } finally {
    await db.end()
  }
})
