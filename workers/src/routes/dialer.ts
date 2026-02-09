/**
 * Dialer Routes — Predictive dialer queue management
 *
 * Routes:
 *   POST /start              — Start dialing a campaign queue
 *   POST /pause              — Pause a dialer queue
 *   POST /stop               — Stop and close a dialer queue
 *   GET  /stats/:campaignId  — Get dialer stats for a campaign
 *   PUT  /agent-status       — Update agent availability status
 *   GET  /agents             — List agents and their statuses
 *
 * @see ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md — Phase 4
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { DialerQueueSchema, DialerAgentStatusSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { predictiveDialerRateLimit } from '../lib/rate-limit'
import { startDialerQueue, pauseDialerQueue, getDialerStats } from '../lib/dialer-engine'

export const dialerRoutes = new Hono<AppEnv>()

// Start dialing a campaign queue
dialerRoutes.post('/start', predictiveDialerRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, DialerQueueSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env)
  try {
    // Verify campaign belongs to org
    const campResult = await db.query(
      `SELECT id, name, status FROM campaigns
       WHERE id = $1 AND organization_id = $2`,
      [parsed.data.campaign_id, session.organization_id]
    )
    if (campResult.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const result = await startDialerQueue(
      c.env,
      db,
      parsed.data.campaign_id,
      session.organization_id,
      session.user_id
    )

    return c.json({ success: true, ...result })
  } catch (err: any) {
    logger.error('POST /api/dialer/start error', { error: err?.message })
    return c.json({ error: 'Failed to start dialer queue' }, 500)
  } finally {
    await db.end()
  }
})

// Pause a dialer queue
dialerRoutes.post('/pause', predictiveDialerRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const campaignId = body?.campaign_id

  if (!campaignId) {
    return c.json({ error: 'campaign_id is required' }, 400)
  }

  const db = getDb(c.env)
  try {
    await pauseDialerQueue(db, campaignId, session.organization_id, session.user_id)
    return c.json({ success: true, status: 'paused' })
  } catch (err: any) {
    logger.error('POST /api/dialer/pause error', { error: err?.message })
    return c.json({ error: 'Failed to pause dialer queue' }, 500)
  } finally {
    await db.end()
  }
})

// Stop a dialer queue entirely
dialerRoutes.post('/stop', predictiveDialerRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const campaignId = body?.campaign_id

  if (!campaignId) {
    return c.json({ error: 'campaign_id is required' }, 400)
  }

  const db = getDb(c.env)
  try {
    await db.query(
      `UPDATE campaigns SET status = 'completed', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [campaignId, session.organization_id]
    )

    // Cancel all pending calls
    await db.query(
      `UPDATE campaign_calls SET status = 'canceled', updated_at = NOW()
       WHERE campaign_id = $1 AND organization_id = $2 AND status IN ('pending', 'calling')`,
      [campaignId, session.organization_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      action: AuditAction.DIALER_QUEUE_PAUSED,
      resourceType: 'campaign',
      resourceId: campaignId,
      before: null,
      after: { status: 'completed' },
    })

    return c.json({ success: true, status: 'stopped' })
  } catch (err: any) {
    logger.error('POST /api/dialer/stop error', { error: err?.message })
    return c.json({ error: 'Failed to stop dialer queue' }, 500)
  } finally {
    await db.end()
  }
})

// Get dialer stats for a campaign
dialerRoutes.get('/stats/:campaignId', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const campaignId = c.req.param('campaignId')

  const db = getDb(c.env)
  try {
    // Verify campaign belongs to org
    const campResult = await db.query(
      `SELECT id, name, status FROM campaigns
       WHERE id = $1 AND organization_id = $2`,
      [campaignId, session.organization_id]
    )
    if (campResult.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const stats = await getDialerStats(db, campaignId, session.organization_id)

    return c.json({
      success: true,
      campaign: campResult.rows[0],
      stats,
    })
  } catch (err: any) {
    logger.error('GET /api/dialer/stats error', { error: err?.message })
    return c.json({ error: 'Failed to get dialer stats' }, 500)
  } finally {
    await db.end()
  }
})

// Update agent availability status
dialerRoutes.put('/agent-status', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, DialerAgentStatusSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `INSERT INTO dialer_agent_status
        (organization_id, user_id, status, campaign_id, shift_started_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET
         status = $3,
         campaign_id = COALESCE($4, dialer_agent_status.campaign_id),
         shift_started_at = CASE
           WHEN dialer_agent_status.status = 'offline' AND $3 != 'offline' THEN NOW()
           ELSE dialer_agent_status.shift_started_at
         END,
         updated_at = NOW()
       RETURNING *`,
      [session.organization_id, session.user_id, parsed.data.status, parsed.data.campaign_id]
    )

    return c.json({ success: true, agent_status: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/dialer/agent-status error', { error: err?.message })
    return c.json({ error: 'Failed to update agent status' }, 500)
  } finally {
    await db.end()
  }
})

// List agent statuses
dialerRoutes.get('/agents', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const campaignId = c.req.query('campaign_id')

  const db = getDb(c.env)
  try {
    const params: any[] = [session.organization_id]
    let query = `
      SELECT das.*, u.full_name, u.email
      FROM dialer_agent_status das
      JOIN users u ON u.id = das.user_id
      WHERE das.organization_id = $1`

    if (campaignId) {
      query += ` AND (das.campaign_id = $2 OR das.campaign_id IS NULL)`
      params.push(campaignId)
    }

    query += ` ORDER BY das.status ASC, das.updated_at DESC`

    const result = await db.query(query, params)

    return c.json({
      success: true,
      agents: result.rows,
      count: result.rows.length,
    })
  } catch (err: any) {
    logger.error('GET /api/dialer/agents error', { error: err?.message })
    return c.json({ error: 'Failed to get agent list' }, 500)
  } finally {
    await db.end()
  }
})
