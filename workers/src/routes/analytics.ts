/**
 * Analytics Routes - Real DB-backed analytics queries
 *
 * Endpoints:
 *   GET /calls       - Call analytics (volume, duration, etc.)
 *   GET /sentiment    - Sentiment breakdown
 *   GET /performance  - Agent/queue performance metrics
 *   GET /surveys      - Survey/CSAT analytics
 *   GET /export       - CSV export of analytics data
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const analyticsRoutes = new Hono<{ Bindings: Env }>()

async function getSQL(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

function parseDateRange(c: any) {
  const now = new Date()
  const start = c.req.query('start') || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const end = c.req.query('end') || now.toISOString()
  return { start, end }
}

// GET /calls — Call volume & duration analytics
analyticsRoutes.get('/calls', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    const { start, end } = parseDateRange(c)

    const metrics = await sql`
      SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'missed')::int AS missed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COALESCE(AVG(duration), 0)::int AS avg_duration_seconds,
        COALESCE(SUM(duration), 0)::int AS total_duration_seconds
      FROM calls
      WHERE organization_id = ${session.organization_id}
        AND created_at >= ${start}::timestamptz
        AND created_at <= ${end}::timestamptz
    `

    // Daily breakdown
    const daily = await sql`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)::int AS calls,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
      FROM calls
      WHERE organization_id = ${session.organization_id}
        AND created_at >= ${start}::timestamptz
        AND created_at <= ${end}::timestamptz
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `

    return c.json({
      success: true,
      data: metrics[0] || {},
      daily,
      period: { start, end },
    })
  } catch (err: any) {
    console.error('GET /api/analytics/calls error:', err?.message)
    // If calls table doesn't exist, return empty
    return c.json({ success: true, data: { total_calls: 0, completed: 0, missed: 0, failed: 0, avg_duration_seconds: 0, total_duration_seconds: 0 }, daily: [], period: parseDateRange(c) })
  }
})

// GET /sentiment — Sentiment breakdown
analyticsRoutes.get('/sentiment', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    const { start, end } = parseDateRange(c)

    // Try to get sentiment data from recordings or calls
    let sentimentData: any[] = []
    try {
      sentimentData = await sql`
        SELECT
          COALESCE(sentiment, 'unknown') AS sentiment,
          COUNT(*)::int AS count
        FROM recordings
        WHERE organization_id = ${session.organization_id}
          AND created_at >= ${start}::timestamptz
          AND created_at <= ${end}::timestamptz
        GROUP BY sentiment
        ORDER BY count DESC
      `
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
    console.error('GET /api/analytics/sentiment error:', err?.message)
    return c.json({ success: true, data: [], total: 0, period: parseDateRange(c) })
  }
})

// GET /performance — Agent/queue performance
analyticsRoutes.get('/performance', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    const { start, end } = parseDateRange(c)

    let agentPerf: any[] = []
    try {
      agentPerf = await sql`
        SELECT
          c.user_id AS agent_id,
          u.name AS agent_name,
          COUNT(*)::int AS total_calls,
          COALESCE(AVG(c.duration), 0)::int AS avg_duration,
          COUNT(*) FILTER (WHERE c.status = 'completed')::int AS completed
        FROM calls c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.organization_id = ${session.organization_id}
          AND c.created_at >= ${start}::timestamptz
          AND c.created_at <= ${end}::timestamptz
          AND c.user_id IS NOT NULL
        GROUP BY c.user_id, u.name
        ORDER BY total_calls DESC
        LIMIT 20
      `
    } catch {
      // user_id column may not exist on calls
    }

    return c.json({
      success: true,
      data: agentPerf,
      period: { start, end },
    })
  } catch (err: any) {
    console.error('GET /api/analytics/performance error:', err?.message)
    return c.json({ success: true, data: [], period: parseDateRange(c) })
  }
})

// GET /surveys — Survey/CSAT analytics
analyticsRoutes.get('/surveys', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    const { start, end } = parseDateRange(c)

    let surveyMetrics: any = { total_responses: 0, avg_score: 0 }
    try {
      const rows = await sql`
        SELECT
          COUNT(*)::int AS total_responses,
          COALESCE(AVG(score), 0) AS avg_score
        FROM survey_responses
        WHERE organization_id = ${session.organization_id}
          AND created_at >= ${start}::timestamptz
          AND created_at <= ${end}::timestamptz
      `
      if (rows.length > 0) surveyMetrics = rows[0]
    } catch {
      // survey_responses table may not exist
    }

    return c.json({
      success: true,
      data: surveyMetrics,
      period: { start, end },
    })
  } catch (err: any) {
    console.error('GET /api/analytics/surveys error:', err?.message)
    return c.json({ success: true, data: { total_responses: 0, avg_score: 0 }, period: parseDateRange(c) })
  }
})

// GET /export — CSV export
analyticsRoutes.get('/export', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    const { start, end } = parseDateRange(c)
    const type = c.req.query('type') || 'calls'

    let rows: any[] = []
    try {
      if (type === 'calls') {
        rows = await sql`
          SELECT id, direction, status, from_number, to_number, duration, created_at
          FROM calls
          WHERE organization_id = ${session.organization_id}
            AND created_at >= ${start}::timestamptz
            AND created_at <= ${end}::timestamptz
          ORDER BY created_at DESC
          LIMIT 10000
        `
      } else if (type === 'recordings') {
        rows = await sql`
          SELECT id, call_id, status, duration, created_at
          FROM recordings
          WHERE organization_id = ${session.organization_id}
            AND created_at >= ${start}::timestamptz
            AND created_at <= ${end}::timestamptz
          ORDER BY created_at DESC
          LIMIT 10000
        `
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
      ...rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))
    ].join('\n')

    return c.json({ success: true, csv, rows: rows.length })
  } catch (err: any) {
    console.error('GET /api/analytics/export error:', err?.message)
    return c.json({ error: 'Export failed' }, 500)
  }
})