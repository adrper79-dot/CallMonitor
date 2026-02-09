/**
 * Sentiment Routes — Real-time sentiment analysis configuration and data
 *
 * Routes:
 *   GET  /config                  — Get org sentiment alert config
 *   PUT  /config                  — Update org sentiment alert config
 *   GET  /live/:callId            — Get live sentiment scores for a call
 *   GET  /summary/:callId         — Get sentiment summary for a call
 *   GET  /history                 — Get sentiment history for recent calls
 *
 * @see ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md — Phase 2
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { SentimentConfigSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { sentimentRateLimit } from '../lib/rate-limit'

export const sentimentRoutes = new Hono<AppEnv>()

// Get sentiment alert configuration
sentimentRoutes.get('/config', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT id, enabled, alert_threshold, objection_keywords, alert_channels, webhook_url,
              created_at, updated_at
       FROM sentiment_alert_configs
       WHERE organization_id = $1
       LIMIT 1`,
      [session.organization_id]
    )

    const config = result.rows[0] || {
      enabled: false,
      alert_threshold: -0.5,
      objection_keywords: ['cancel', 'lawsuit', 'attorney', 'complaint', 'supervisor'],
      alert_channels: ['dashboard'],
      webhook_url: null,
    }

    return c.json({ success: true, config })
  } catch (err: any) {
    logger.error('GET /api/sentiment/config error', { error: err?.message })
    return c.json({ error: 'Failed to get sentiment config' }, 500)
  } finally {
    await db.end()
  }
})

// Update sentiment alert configuration
sentimentRoutes.put('/config', sentimentRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, SentimentConfigSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env)
  try {
    const { enabled, alert_threshold, objection_keywords, alert_channels, webhook_url } =
      parsed.data

    const result = await db.query(
      `INSERT INTO sentiment_alert_configs
        (organization_id, enabled, alert_threshold, objection_keywords, alert_channels, webhook_url, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET
         enabled = $2,
         alert_threshold = $3,
         objection_keywords = COALESCE($4, sentiment_alert_configs.objection_keywords),
         alert_channels = $5,
         webhook_url = $6,
         updated_at = NOW()
       RETURNING *`,
      [
        session.organization_id,
        enabled,
        alert_threshold,
        objection_keywords ? JSON.stringify(objection_keywords) : null,
        JSON.stringify(alert_channels),
        webhook_url,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.SENTIMENT_ALERT_TRIGGERED,
      resourceType: 'sentiment_alert_configs',
      resourceId: result.rows[0]?.id || session.organization_id,
      before: null,
      after: parsed.data,
    })

    return c.json({ success: true, config: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/sentiment/config error', { error: err?.message })
    return c.json({ error: 'Failed to update sentiment config' }, 500)
  } finally {
    await db.end()
  }
})

// Get live sentiment scores for a call (polling endpoint)
sentimentRoutes.get('/live/:callId', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const callId = c.req.param('callId')
  const after = c.req.query('after') // segment_index to fetch after

  const db = getDb(c.env)
  try {
    const query = after
      ? `SELECT segment_index, score, objections, escalation_recommended, created_at
         FROM call_sentiment_scores
         WHERE call_id = $1 AND organization_id = $2 AND segment_index > $3
         ORDER BY segment_index ASC
         LIMIT 50`
      : `SELECT segment_index, score, objections, escalation_recommended, created_at
         FROM call_sentiment_scores
         WHERE call_id = $1 AND organization_id = $2
         ORDER BY segment_index ASC
         LIMIT 50`

    const params = after
      ? [callId, session.organization_id, parseInt(after)]
      : [callId, session.organization_id]

    const result = await db.query(query, params)

    return c.json({
      success: true,
      scores: result.rows,
      count: result.rows.length,
    })
  } catch (err: any) {
    logger.error('GET /api/sentiment/live error', { error: err?.message, callId })
    return c.json({ error: 'Failed to get sentiment scores' }, 500)
  } finally {
    await db.end()
  }
})

// Get sentiment summary for a call
sentimentRoutes.get('/summary/:callId', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const callId = c.req.param('callId')

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT avg_score, min_score, max_score, total_segments,
              objection_count, escalation_triggered, escalation_triggered_at, updated_at
       FROM call_sentiment_summary
       WHERE call_id = $1 AND organization_id = $2`,
      [callId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ success: true, summary: null })
    }

    return c.json({ success: true, summary: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/sentiment/summary error', { error: err?.message, callId })
    return c.json({ error: 'Failed to get sentiment summary' }, 500)
  } finally {
    await db.end()
  }
})

// Get sentiment history across recent calls
sentimentRoutes.get('/history', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
  const offset = parseInt(c.req.query('offset') || '0')

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT s.call_id, s.avg_score, s.min_score, s.max_score,
              s.total_segments, s.objection_count, s.escalation_triggered,
              s.updated_at,
              c.from_number, c.to_number, c.status AS call_status, c.created_at AS call_started
       FROM call_sentiment_summary s
       JOIN calls c ON c.id = s.call_id
       WHERE s.organization_id = $1
       ORDER BY s.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [session.organization_id, limit, offset]
    )

    return c.json({
      success: true,
      history: result.rows,
      count: result.rows.length,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/sentiment/history error', { error: err?.message })
    return c.json({ error: 'Failed to get sentiment history' }, 500)
  } finally {
    await db.end()
  }
})
