/**
 * Usage Routes - Track API usage and metrics
 *
 * Endpoints:
 *   GET /       - Usage overview (calls, minutes, recordings, transcriptions)
 *   GET /stats  - Alias for GET / (frontend compat)
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { analyticsRateLimit } from '../lib/rate-limit'

export const usageRoutes = new Hono<{ Bindings: Env }>()

/** Shared: get real usage data from DB */
async function getUsageData(c: any) {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!session.organization_id) {
    return c.json({
      success: true,
      usage: { calls: 0, minutes: 0, recordings: 0, transcriptions: 0, apiRequests: 0 },
      limits: { callsPerMonth: 1000, minutesPerMonth: 5000 },
    })
  }

  const db = getDb(c.env)
  try {
    // Get this month's usage from actual tables
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Count calls this month
    const callsResult = await db.query(
      `SELECT 
      COUNT(*)::int as total_calls,
      COALESCE(SUM(
        CASE WHEN ended_at IS NOT NULL AND started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
          ELSE 0
        END
      ), 0)::numeric(10,1) as total_minutes
    FROM calls
    WHERE organization_id = $1
      AND created_at >= $2::timestamptz`,
      [session.organization_id, monthStart]
    )

    // Count recordings this month
    const recordingsResult = await db.query(
      `SELECT COUNT(*)::int as total_recordings
    FROM recordings
    WHERE organization_id = $1
      AND created_at >= $2::timestamptz`,
      [session.organization_id, monthStart]
    )

    // Count transcriptions this month (if table exists)
    let transcriptions = 0
    try {
      const transcriptResult = await db.query(
        `SELECT COUNT(*)::int as total_transcriptions
      FROM ai_summaries
      WHERE organization_id = $1
        AND created_at >= $2::timestamptz`,
        [session.organization_id, monthStart]
      )
      transcriptions = transcriptResult.rows?.[0]?.total_transcriptions || 0
    } catch {
      // ai_summaries table might not exist yet
    }

    const calls = callsResult.rows?.[0]?.total_calls || 0
    const minutes = parseFloat(callsResult.rows?.[0]?.total_minutes || '0')
    const recordings = recordingsResult.rows?.[0]?.total_recordings || 0

    // Get plan limits from organization
    let planId = 'free'
    try {
      const orgResult = await db.query('SELECT plan FROM organizations WHERE id = $1', [
        session.organization_id,
      ])
      planId = orgResult.rows?.[0]?.plan || 'free'
    } catch {
      // plan column might not exist — default to free
    }

    // Plan-based limits
    const planLimits: Record<string, { calls: number; minutes: number; transcriptions: number }> = {
      free: { calls: 100, minutes: 500, transcriptions: 50 },
      starter: { calls: 500, minutes: 2500, transcriptions: 250 },
      pro: { calls: 2000, minutes: 10000, transcriptions: 1000 },
      enterprise: { calls: 10000, minutes: 50000, transcriptions: 5000 },
    }

    const plan = planId.includes('enterprise')
      ? 'enterprise'
      : planId.includes('pro')
        ? 'pro'
        : planId.includes('starter')
          ? 'starter'
          : 'free'

    const limits = planLimits[plan] || planLimits.free

    return c.json({
      success: true,
      usage: {
        calls,
        minutes,
        recordings,
        transcriptions,
        apiRequests: 0,
      },
      limits: {
        callsPerMonth: limits.calls,
        minutesPerMonth: limits.minutes,
        transcriptionsPerMonth: limits.transcriptions,
      },
      period: {
        start: monthStart,
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
      },
    })
  } finally {
    await db.end()
  }
}

// GET /
usageRoutes.get('/', analyticsRateLimit, async (c) => {
  try {
    return await getUsageData(c)
  } catch (err: any) {
    logger.error('GET /api/usage error', { error: err?.message })
    return c.json({ error: 'Failed to get usage' }, 500)
  }
})

// GET /stats — frontend alias
usageRoutes.get('/stats', analyticsRateLimit, async (c) => {
  try {
    return await getUsageData(c)
  } catch (err: any) {
    logger.error('GET /api/usage/stats error', { error: err?.message })
    return c.json({ error: 'Failed to get usage stats' }, 500)
  }
})
