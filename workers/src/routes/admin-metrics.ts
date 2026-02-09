/**
 * Platform Admin Metrics Dashboard API
 * GET /admin/metrics — Realtime key metrics for super-admins
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { adminRateLimit } from '../lib/rate-limit'

export const adminMetricsRoutes = new Hono<AppEnv>()

adminMetricsRoutes.get('/', adminRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (session.platform_role !== 'platform-admin')
    return c.json({ error: 'Platform-admin access required' }, 403)

  const db = getDb(c.env)
  try {
    // Active concurrent calls
    const activeCalls = await db.query(
      `SELECT COUNT(*)::integer as count FROM calls WHERE status IN ('active', 'ringing', 'answered') AND organization_id = $1`,
      [session.organization_id]
    )

    // Total orgs/users (platform-wide for owner)
    const platformStats = await db.query(`
      SELECT 
        (SELECT COUNT(*)::integer FROM organizations) as total_orgs,
        (SELECT COUNT(*)::integer FROM users) as total_users
    `)

    // Monthly revenue (platform-wide)
    const revenue = await db.query(`
      SELECT COALESCE(SUM(amount)::numeric / 100, 0) as mrr
      FROM billing_events 
      WHERE event_type IN ('invoice.paid', 'invoice.payment_succeeded')
        AND created_at >= NOW() - INTERVAL '30 days'
    `)

    // Concurrent sessions
    const sessions = await db.query(
      `SELECT COUNT(*)::integer as count FROM sessions WHERE expires > NOW()`
    )

    // Usage metrics
    const usage = await db.query(`
      SELECT 
        COALESCE(SUM(duration_seconds)::numeric / 3600, 0) as total_hours,
        COUNT(*)::integer as total_calls
      FROM recordings 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `)

    return c.json({
      timestamp: new Date().toISOString(),
      active_calls: activeCalls.rows[0].count,
      total_orgs: platformStats.rows[0].total_orgs,
      total_users: platformStats.rows[0].total_users,
      mrr: Number(revenue.rows[0].mrr),
      concurrent_sessions: sessions.rows[0].count,
      total_hours_30d: Number(usage.rows[0].total_hours),
      total_calls_30d: usage.rows[0].total_calls,
    })
  } catch (err: any) {
    logger.error('GET /admin/metrics error', { error: err.message })
    return c.json({ error: 'Metrics fetch failed' }, 500)
  } finally {
    await db.end()
  }
})

