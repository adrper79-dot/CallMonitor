/**
 * Usage Routes - Track API usage and metrics
 * 
 * Endpoints:
 *   GET /       - Usage overview
 *   GET /stats  - Alias for GET / (frontend compat)
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

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
      usage: { calls: 0, minutes: 0, recordings: 0, apiRequests: 0 },
      limits: { callsPerMonth: 1000, minutesPerMonth: 5000 },
    })
  }

  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  const sql = neon(connectionString)

  // Get this month's usage from actual tables
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Count calls this month
  const callsResult = await sql`
    SELECT 
      COUNT(*)::int as total_calls,
      COALESCE(SUM(
        CASE WHEN ended_at IS NOT NULL AND started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
          ELSE 0
        END
      ), 0)::numeric(10,1) as total_minutes
    FROM calls
    WHERE organization_id = ${session.organization_id}
      AND created_at >= ${monthStart}::timestamptz
  `

  // Count recordings this month
  const recordingsResult = await sql`
    SELECT COUNT(*)::int as total_recordings
    FROM recordings
    WHERE organization_id = ${session.organization_id}
      AND created_at >= ${monthStart}::timestamptz
  `

  const calls = callsResult?.[0]?.total_calls || 0
  const minutes = parseFloat(callsResult?.[0]?.total_minutes || '0')
  const recordings = recordingsResult?.[0]?.total_recordings || 0

  // Get plan limits from organization
  let planId = 'free'
  try {
    const orgResult = await sql`
      SELECT plan FROM organizations WHERE id = ${session.organization_id}
    `
    planId = orgResult?.[0]?.plan || 'free'
  } catch {
    // plan column might not exist — default to free
  }

  // Plan-based limits
  const planLimits: Record<string, { calls: number; minutes: number }> = {
    free: { calls: 100, minutes: 500 },
    starter: { calls: 500, minutes: 2500 },
    pro: { calls: 2000, minutes: 10000 },
    enterprise: { calls: 10000, minutes: 50000 },
  }

  const plan = planId.includes('enterprise') ? 'enterprise'
    : planId.includes('pro') ? 'pro'
    : planId.includes('starter') ? 'starter'
    : 'free'

  const limits = planLimits[plan] || planLimits.free

  return c.json({
    success: true,
    usage: {
      calls,
      minutes,
      recordings,
      apiRequests: 0, // Would need request counter middleware
    },
    limits: {
      callsPerMonth: limits.calls,
      minutesPerMonth: limits.minutes,
    },
    period: {
      start: monthStart,
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
    },
  })
}

// GET /
usageRoutes.get('/', async (c) => {
  try {
    return await getUsageData(c)
  } catch (err: any) {
    console.error('GET /api/usage error:', err?.message)
    return c.json({ error: 'Failed to get usage' }, 500)
  }
})

// GET /stats — frontend alias
usageRoutes.get('/stats', async (c) => {
  try {
    return await getUsageData(c)
  } catch (err: any) {
    console.error('GET /api/usage/stats error:', err?.message)
    return c.json({ error: 'Failed to get usage stats' }, 500)
  }
})
