/**
 * Analytics Routes - Real DB-backed analytics queries
 *
 * Endpoints:
 *   GET /kpis         - Top-level KPIs (calls, duration, success rate)
 *   GET /calls        - Call analytics (volume, duration, etc.)
 *   GET /sentiment    - Sentiment breakdown
 *   GET /performance  - Agent/queue performance metrics
 *   GET /surveys      - Survey/CSAT analytics
 *   GET /scorecards   - Scorecard trends and results
 *   GET /usage        - Feature usage statistics
 *   GET /export       - CSV export of analytics data
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { analyticsRateLimit, analyticsExportRateLimit } from '../lib/rate-limit'

export const analyticsRoutes = new Hono<AppEnv>()

function parseDateRange(c: any) {
  const now = new Date()
  const start =
    c.req.query('start') || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const end = c.req.query('end') || now.toISOString()
  return { start, end }
}

// GET /kpis — Top-level KPIs dashboard
analyticsRoutes.get('/kpis', analyticsRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const { start, end } = parseDateRange(c)

    // Aggregate call metrics
    const callMetrics = await db.query(
      `SELECT
        COUNT(*)::int AS total_calls,
        COALESCE(AVG(duration), 0)::int AS avg_duration_seconds,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS successful_calls,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_calls
      FROM calls
      WHERE organization_id = $1
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz`,
      [session.organization_id, start, end]
    )

    // Transcription success rate
    let transcriptionRate = 0
    try {
      const transcriptionMetrics = await db.query(
        `SELECT
          COUNT(*)::int AS total_recordings,
          COUNT(*) FILTER (WHERE transcription IS NOT NULL AND transcription != '')::int AS transcribed
        FROM recordings
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      const rec = transcriptionMetrics.rows[0]
      if (rec && rec.total_recordings > 0) {
        transcriptionRate = Math.round((rec.transcribed / rec.total_recordings) * 100)
      }
    } catch {
      // recordings table may not exist
    }

    // Survey response rate
    let surveyResponseRate = 0
    let avgSurveyScore = 0
    try {
      const surveyMetrics = await db.query(
        `SELECT
          COUNT(*)::int AS total_responses,
          COALESCE(AVG(score), 0) AS avg_score
        FROM survey_responses
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      if (surveyMetrics.rows.length > 0) {
        avgSurveyScore = Math.round(surveyMetrics.rows[0].avg_score * 10) / 10
      }
    } catch {
      // survey_responses table may not exist
    }

    // Scorecard average score
    let avgScorecardScore = 0
    try {
      const scorecardMetrics = await db.query(
        `SELECT
          COALESCE(AVG(score), 0) AS avg_score
        FROM scored_recordings
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      if (scorecardMetrics.rows.length > 0) {
        avgScorecardScore = Math.round(scorecardMetrics.rows[0].avg_score * 10) / 10
      }
    } catch {
      // scored_recordings table may not exist
    }

    const metrics = callMetrics.rows[0] || {
      total_calls: 0,
      avg_duration_seconds: 0,
      successful_calls: 0,
      failed_calls: 0,
    }

    const successRate =
      metrics.total_calls > 0
        ? Math.round((metrics.successful_calls / metrics.total_calls) * 100)
        : 0

    return c.json({
      success: true,
      kpis: {
        total_calls: metrics.total_calls,
        avg_duration_seconds: metrics.avg_duration_seconds,
        success_rate: successRate,
        transcription_rate: transcriptionRate,
        survey_response_rate: surveyResponseRate,
        avg_survey_score: avgSurveyScore,
        avg_scorecard_score: avgScorecardScore,
      },
      period: { start, end },
    })
  } catch (err: any) {
    logger.error('GET /api/analytics/kpis error', { error: err?.message })
    return c.json({
      success: true,
      kpis: {
        total_calls: 0,
        avg_duration_seconds: 0,
        success_rate: 0,
        transcription_rate: 0,
        survey_response_rate: 0,
        avg_survey_score: 0,
        avg_scorecard_score: 0,
      },
      period: parseDateRange(c),
    })
  } finally {
    await db.end()
  }
})

// GET /trends — Lightweight placeholder returning empty datasets
// Provides a stable 200 response for clients expecting this endpoint while
// longer-running trend computations are implemented.
analyticsRoutes.get('/trends', analyticsRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const { start, end } = parseDateRange(c)

    return c.json({
      success: true,
      trends: [],
      period: { start, end },
    })
  } catch (err: any) {
    logger.error('GET /api/analytics/trends error', { error: err?.message })
    return c.json({ success: true, trends: [], period: parseDateRange(c) })
  } finally {
    await db.end()
  }
})

// GET /calls — Call volume & duration analytics
analyticsRoutes.get('/calls', analyticsRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const { start, end } = parseDateRange(c)

    const metrics = await db.query(
      `SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'missed')::int AS missed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COALESCE(AVG(duration), 0)::int AS avg_duration_seconds,
        COALESCE(SUM(duration), 0)::int AS total_duration_seconds
      FROM calls
      WHERE organization_id = $1
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz`,
      [session.organization_id, start, end]
    )

    // Daily breakdown
    const daily = await db.query(
      `SELECT
        DATE(created_at) AS date,
        COUNT(*)::int AS calls,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
      FROM calls
      WHERE organization_id = $1
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,
      [session.organization_id, start, end]
    )

    return c.json({
      success: true,
      data: metrics.rows[0] || {},
      daily: daily.rows,
      period: { start, end },
    })
  } catch (err: any) {
    logger.error('GET /api/analytics/calls error', { error: err?.message })
    // If calls table doesn't exist, return empty
    return c.json({
      success: true,
      data: {
        total_calls: 0,
        completed: 0,
        missed: 0,
        failed: 0,
        avg_duration_seconds: 0,
        total_duration_seconds: 0,
      },
      daily: [],
      period: parseDateRange(c),
    })
  } finally {
    await db.end()
  }
})

// GET /sentiment — Sentiment breakdown
analyticsRoutes.get('/sentiment', analyticsRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const { start, end } = parseDateRange(c)

    // Try to get sentiment data from recordings or calls
    let sentimentData: any[] = []
    try {
      const sentimentResult = await db.query(
        `SELECT
          COALESCE(sentiment, 'unknown') AS sentiment,
          COUNT(*)::int AS count
        FROM recordings
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz
        GROUP BY sentiment
        ORDER BY count DESC`,
        [session.organization_id, start, end]
      )
      sentimentData = sentimentResult.rows
    } catch {
      // recordings table may not have sentiment column
    }

    const total = sentimentData.reduce((sum: number, s: any) => sum + s.count, 0)

    return c.json({
      success: true,
      data: sentimentData,
      total,
      period: { start, end },
    })
  } catch (err: any) {
    logger.error('GET /api/analytics/sentiment error', { error: err?.message })
    return c.json({ success: true, data: [], total: 0, period: parseDateRange(c) })
  } finally {
    await db.end()
  }
})

// GET /performance — Agent/queue performance
analyticsRoutes.get('/performance', analyticsRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const { start, end } = parseDateRange(c)

    let agentPerf: any[] = []
    try {
      const perfResult = await db.query(
        `SELECT
          c.user_id AS agent_id,
          u.name AS agent_name,
          COUNT(*)::int AS total_calls,
          COALESCE(AVG(c.duration), 0)::int AS avg_duration,
          COUNT(*) FILTER (WHERE c.status = 'completed')::int AS completed
        FROM calls c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.organization_id = $1
          AND c.created_at >= $2::timestamptz
          AND c.created_at <= $3::timestamptz
          AND c.user_id IS NOT NULL
        GROUP BY c.user_id, u.name
        ORDER BY total_calls DESC
        LIMIT 20`,
        [session.organization_id, start, end]
      )
      agentPerf = perfResult.rows
    } catch {
      // user_id column may not exist on calls
    }

    return c.json({
      success: true,
      data: agentPerf,
      period: { start, end },
    })
  } catch (err: any) {
    logger.error('GET /api/analytics/performance error', { error: err?.message })
    return c.json({ success: true, data: [], period: parseDateRange(c) })
  } finally {
    await db.end()
  }
})

// GET /surveys — Survey/CSAT analytics
analyticsRoutes.get('/surveys', analyticsRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const { start, end } = parseDateRange(c)

    let surveyMetrics: any = { total_responses: 0, avg_score: 0 }
    try {
      const surveyResult = await db.query(
        `SELECT
          COUNT(*)::int AS total_responses,
          COALESCE(AVG(score), 0) AS avg_score
        FROM survey_responses
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      if (surveyResult.rows.length > 0) surveyMetrics = surveyResult.rows[0]
    } catch {
      // survey_responses table may not exist
    }

    return c.json({
      success: true,
      data: surveyMetrics,
      period: { start, end },
    })
  } catch (err: any) {
    logger.error('GET /api/analytics/surveys error', { error: err?.message })
    return c.json({
      success: true,
      data: { total_responses: 0, avg_score: 0 },
      period: parseDateRange(c),
    })
  } finally {
    await db.end()
  }
})

// GET /scorecards — Scorecard trends and results
analyticsRoutes.get('/scorecards', analyticsRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const { start, end } = parseDateRange(c)

    let scorecardMetrics: any = {
      total_scores: 0,
      avg_score: 0,
      pass_rate: 0,
    }
    let scorecardTrends: any[] = []

    try {
      // Aggregate metrics
      const aggregateResult = await db.query(
        `SELECT
          COUNT(*)::int AS total_scores,
          COALESCE(AVG(score), 0) AS avg_score,
          COUNT(*) FILTER (WHERE score >= 80)::int AS passed
        FROM scored_recordings
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      if (aggregateResult.rows.length > 0) {
        const agg = aggregateResult.rows[0]
        scorecardMetrics = {
          total_scores: agg.total_scores,
          avg_score: Math.round(agg.avg_score * 10) / 10,
          pass_rate:
            agg.total_scores > 0 ? Math.round((agg.passed / agg.total_scores) * 100) : 0,
        }
      }

      // Daily trends
      const trendsResult = await db.query(
        `SELECT
          DATE(created_at) AS date,
          COUNT(*)::int AS count,
          COALESCE(AVG(score), 0) AS avg_score
        FROM scored_recordings
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz
        GROUP BY DATE(created_at)
        ORDER BY date ASC`,
        [session.organization_id, start, end]
      )
      scorecardTrends = trendsResult.rows
    } catch {
      // scored_recordings table may not exist
    }

    return c.json({
      success: true,
      metrics: scorecardMetrics,
      trends: scorecardTrends,
      period: { start, end },
    })
  } catch (err: any) {
    logger.error('GET /api/analytics/scorecards error', { error: err?.message })
    return c.json({
      success: true,
      metrics: { total_scores: 0, avg_score: 0, pass_rate: 0 },
      trends: [],
      period: parseDateRange(c),
    })
  } finally {
    await db.end()
  }
})

// GET /usage — Feature usage statistics
analyticsRoutes.get('/usage', analyticsRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const { start, end } = parseDateRange(c)

    const usageStats: any = {
      calls: 0,
      recordings: 0,
      transcriptions: 0,
      translations: 0,
      voice_cloning: 0,
      surveys: 0,
      scorecards: 0,
      webhooks_sent: 0,
    }

    // Calls
    try {
      const callsResult = await db.query(
        `SELECT COUNT(*)::int AS count
        FROM calls
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      usageStats.calls = callsResult.rows[0]?.count || 0
    } catch {}

    // Recordings
    try {
      const recordingsResult = await db.query(
        `SELECT COUNT(*)::int AS count
        FROM recordings
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      usageStats.recordings = recordingsResult.rows[0]?.count || 0
    } catch {}

    // Transcriptions
    try {
      const transcriptionsResult = await db.query(
        `SELECT COUNT(*)::int AS count
        FROM recordings
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz
          AND transcription IS NOT NULL
          AND transcription != ''`,
        [session.organization_id, start, end]
      )
      usageStats.transcriptions = transcriptionsResult.rows[0]?.count || 0
    } catch {}

    // Translations (from ai_runs table)
    try {
      const translationsResult = await db.query(
        `SELECT COUNT(*)::int AS count
        FROM ai_runs
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz
          AND model_type = 'translation'`,
        [session.organization_id, start, end]
      )
      usageStats.translations = translationsResult.rows[0]?.count || 0
    } catch {}

    // Voice cloning
    try {
      const voiceResult = await db.query(
        `SELECT COUNT(*)::int AS count
        FROM ai_runs
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz
          AND model_type = 'voice_cloning'`,
        [session.organization_id, start, end]
      )
      usageStats.voice_cloning = voiceResult.rows[0]?.count || 0
    } catch {}

    // Surveys
    try {
      const surveysResult = await db.query(
        `SELECT COUNT(*)::int AS count
        FROM survey_responses
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      usageStats.surveys = surveysResult.rows[0]?.count || 0
    } catch {}

    // Scorecards
    try {
      const scorecardsResult = await db.query(
        `SELECT COUNT(*)::int AS count
        FROM scored_recordings
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz`,
        [session.organization_id, start, end]
      )
      usageStats.scorecards = scorecardsResult.rows[0]?.count || 0
    } catch {}

    // Webhooks (from audit logs)
    try {
      const webhooksResult = await db.query(
        `SELECT COUNT(*)::int AS count
        FROM audit_logs
        WHERE organization_id = $1
          AND created_at >= $2::timestamptz
          AND created_at <= $3::timestamptz
          AND action = 'webhook_sent'`,
        [session.organization_id, start, end]
      )
      usageStats.webhooks_sent = webhooksResult.rows[0]?.count || 0
    } catch {}

    return c.json({
      success: true,
      usage: usageStats,
      period: { start, end },
    })
  } catch (err: any) {
    logger.error('GET /api/analytics/usage error', { error: err?.message })
    return c.json({
      success: true,
      usage: {
        calls: 0,
        recordings: 0,
        transcriptions: 0,
        translations: 0,
        voice_cloning: 0,
        surveys: 0,
        scorecards: 0,
        webhooks_sent: 0,
      },
      period: parseDateRange(c),
    })
  } finally {
    await db.end()
  }
})

// GET /export — CSV export (strict rate limit — heavy operation)
analyticsRoutes.get('/export', analyticsExportRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    const { start, end } = parseDateRange(c)
    const type = c.req.query('type') || 'calls'

    let rows: any[] = []
    try {
      if (type === 'calls') {
        const callsResult = await db.query(
          `SELECT id, direction, status, from_number, to_number, duration, created_at
          FROM calls
          WHERE organization_id = $1
            AND created_at >= $2::timestamptz
            AND created_at <= $3::timestamptz
          ORDER BY created_at DESC
          LIMIT 5000`,
          [session.organization_id, start, end]
        )
        rows = callsResult.rows
      } else if (type === 'recordings') {
        const recResult = await db.query(
          `SELECT id, call_id, status, duration, created_at
          FROM recordings
          WHERE organization_id = $1
            AND created_at >= $2::timestamptz
            AND created_at <= $3::timestamptz
          ORDER BY created_at DESC
          LIMIT 5000`,
          [session.organization_id, start, end]
        )
        rows = recResult.rows
      }
    } catch {
      // table may not exist
    }

    if (rows.length === 0) {
      return c.json({ success: true, csv: '', rows: 0, message: 'No data for the selected period' })
    }

    // Build CSV
    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n')

    return c.json({ success: true, csv, rows: rows.length })
  } catch (err: any) {
    logger.error('GET /api/analytics/export error', { error: err?.message })
    return c.json({ error: 'Export failed' }, 500)
  } finally {
    await db.end()
  }
})

