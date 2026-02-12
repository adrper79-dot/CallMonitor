/**
 * Manager Routes — Real-time team monitoring and analytics
 *
 * Endpoints:
 *   GET /team-members     - List all team members with current status
 *   GET /team-stats       - Aggregate team performance metrics
 *
 * @see ARCH_DOCS/01-CORE/COMPREHENSIVE_ARCHITECTURE_WITH_VISUALS.md
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'

export const managerRoutes = new Hono<AppEnv>()

// GET /team-members — Real-time team member status
managerRoutes.get('/team-members', async (c) => {
  const session = await requireRole(c, 'manager')
  if (!session) return c.json({ error: 'Manager role required' }, 403)

  const db = getDb(c.env)
  try {
    // Get all users in the organization with their current status
    const result = await db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.last_seen_at,
        -- Current call status
        CASE
          WHEN c.id IS NOT NULL AND c.status IN ('initiating', 'ringing', 'in_progress') THEN 'calling'
          WHEN u.last_seen_at > NOW() - INTERVAL '5 minutes' THEN 'online'
          WHEN u.last_seen_at > NOW() - INTERVAL '1 hour' THEN 'idle'
          ELSE 'offline'
        END as status,
        c.id as current_call_id,
        -- Today's stats
        COALESCE(stats.calls_today, 0) as calls_today,
        COALESCE(stats.collections_today, 0) as collections_today,
        u.last_seen_at as last_activity
      FROM users u
      LEFT JOIN calls c ON c.created_by = u.id
        AND c.status IN ('initiating', 'ringing', 'in_progress')
        AND c.created_at > NOW() - INTERVAL '1 hour'
      LEFT JOIN (
        SELECT
          created_by,
          COUNT(*) as calls_today,
          COALESCE(SUM(collections.amount), 0) as collections_today
        FROM calls c
        LEFT JOIN collection_payments collections ON collections.call_id = c.id
        WHERE c.created_at >= CURRENT_DATE
        GROUP BY created_by
      ) stats ON stats.created_by = u.id
      WHERE u.organization_id = $1
        AND u.role IN ('agent', 'manager', 'admin', 'owner')
      ORDER BY
        CASE
          WHEN c.id IS NOT NULL THEN 1
          WHEN u.last_seen_at > NOW() - INTERVAL '5 minutes' THEN 2
          WHEN u.last_seen_at > NOW() - INTERVAL '1 hour' THEN 3
          ELSE 4
        END,
        u.name
    `, [session.organization_id])

    return c.json({ success: true, members: result.rows })
  } catch (err: any) {
    logger.error('GET /api/manager/team-members error', { error: err?.message })
    return c.json({ error: 'Failed to get team members' }, 500)
  } finally {
    await db.end()
  }
})

// GET /team-stats — Aggregate team performance metrics
managerRoutes.get('/team-stats', async (c) => {
  const session = await requireRole(c, 'manager')
  if (!session) return c.json({ error: 'Manager role required' }, 403)

  const db = getDb(c.env)
  try {
    // Get comprehensive team stats
    const statsResult = await db.query(`
      SELECT
        -- Team size
        COUNT(DISTINCT u.id) as total_members,

        -- Active callers (on calls right now)
        COUNT(DISTINCT CASE WHEN c.id IS NOT NULL AND c.status IN ('initiating', 'ringing', 'in_progress') THEN u.id END) as active_callers,

        -- Today's call metrics
        COUNT(CASE WHEN calls.created_at >= CURRENT_DATE THEN 1 END) as total_calls_today,
        COALESCE(AVG(CASE WHEN calls.created_at >= CURRENT_DATE THEN calls.duration_seconds END), 0) as avg_call_duration,

        -- Today's collections
        COALESCE(SUM(CASE WHEN cp.created_at >= CURRENT_DATE THEN cp.amount END), 0) as total_collections_today

      FROM users u
      LEFT JOIN calls c ON c.created_by = u.id
        AND c.status IN ('initiating', 'ringing', 'in_progress')
        AND c.created_at > NOW() - INTERVAL '1 hour'
      LEFT JOIN calls ON calls.created_by = u.id
      LEFT JOIN collection_payments cp ON cp.call_id = calls.id
      WHERE u.organization_id = $1
        AND u.role IN ('agent', 'manager', 'admin', 'owner')
    `, [session.organization_id])

    const stats = statsResult.rows[0]

    // Calculate team efficiency (collections per active caller per hour)
    // This is a simplified metric - in production you'd want more sophisticated calculations
    const teamEfficiency = stats.total_members > 0
      ? Math.round((stats.total_collections_today / Math.max(stats.total_members, 1)) * 100) / 100
      : 0

    return c.json({
      success: true,
      stats: {
        total_members: parseInt(stats.total_members) || 0,
        active_callers: parseInt(stats.active_callers) || 0,
        total_calls_today: parseInt(stats.total_calls_today) || 0,
        total_collections_today: parseFloat(stats.total_collections_today) || 0,
        avg_call_duration: Math.round(parseFloat(stats.avg_call_duration) || 0),
        team_efficiency: teamEfficiency
      }
    })
  } catch (err: any) {
    logger.error('GET /api/manager/team-stats error', { error: err?.message })
    return c.json({ error: 'Failed to get team stats' }, 500)
  } finally {
    await db.end()
  }
})