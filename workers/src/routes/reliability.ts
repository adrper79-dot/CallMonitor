/**
 * Reliability Routes - Webhook failure management and monitoring
 *
 * Endpoints:
 *   GET /webhooks  - List webhook failures/metrics
 *   PUT /webhooks  - Action on a webhook failure (retry, discard, manual_review)
 *
 * P2-2: Uses centralized getDb() — no inline neon imports
 * H1: Zod-validated request bodies via validateBody()
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { WebhookActionSchema } from '../lib/schemas'
import { logger } from '../lib/logger'

export const reliabilityRoutes = new Hono<{ Bindings: Env }>()

async function ensureTable(db: ReturnType<typeof getDb>) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS webhook_failures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      webhook_url TEXT NOT NULL,
      event_type TEXT,
      payload JSONB,
      status_code INTEGER,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      status TEXT DEFAULT 'failed',
      resolution_notes TEXT,
      resolved_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `)
}

// GET /webhooks — List webhook failures and metrics
reliabilityRoutes.get('/webhooks', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const db = getDb(c.env)
    const status = c.req.query('status') || 'all'
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
    const offset = parseInt(c.req.query('offset') || '0')

    let failures: any[] = []
    let metrics: any = { active_failures: 0, resolved: 0, discarded: 0, total: 0 }

    try {
      if (status === 'all') {
        const result = await db.query(
          `SELECT * FROM webhook_failures
           WHERE organization_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [session.organization_id, limit, offset]
        )
        failures = result.rows
      } else {
        const result = await db.query(
          `SELECT * FROM webhook_failures
           WHERE organization_id = $1 AND status = $2
           ORDER BY created_at DESC
           LIMIT $3 OFFSET $4`,
          [session.organization_id, status, limit, offset]
        )
        failures = result.rows
      }

      const metricsResult = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'failed')::int AS active_failures,
           COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
           COUNT(*) FILTER (WHERE status = 'discarded')::int AS discarded,
           COUNT(*)::int AS total
         FROM webhook_failures
         WHERE organization_id = $1`,
        [session.organization_id]
      )
      if (metricsResult.rows.length > 0) metrics = metricsResult.rows[0]
    } catch {
      // Table may not exist or have different schema — create it
      await ensureTable(db)
    }

    return c.json({
      success: true,
      failures,
      metrics,
      pagination: { limit, offset },
    })
  } catch (err: any) {
    logger.error('GET /api/reliability/webhooks error', { error: err?.message })
    return c.json({ error: 'Failed to fetch webhook failures' }, 500)
  }
})

// PUT /webhooks — Take action on a webhook failure
reliabilityRoutes.put('/webhooks', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const db = getDb(c.env)
    await ensureTable(db)

    const parsed = await validateBody(c, WebhookActionSchema)
    if (!parsed.success) return parsed.response
    const { failure_id, action, resolution_notes } = parsed.data

    // Check failure belongs to org
    const existing = await db.query(
      `SELECT id, webhook_url, payload, retry_count, max_retries
       FROM webhook_failures
       WHERE id = $1 AND organization_id = $2`,
      [failure_id, session.organization_id]
    )
    if (existing.rows.length === 0) return c.json({ error: 'Failure not found' }, 404)

    if (action === 'retry') {
      const fail = existing.rows[0]
      // Attempt re-delivery
      try {
        const resp = await fetch(fail.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fail.payload),
        })
        if (resp.ok) {
          await db.query(
            `UPDATE webhook_failures
             SET status = 'resolved', retry_count = retry_count + 1,
                 resolution_notes = $1,
                 resolved_by = $2, resolved_at = NOW()
             WHERE id = $3`,
            ['Retried successfully — HTTP ' + resp.status, session.user_id, failure_id]
          )
          return c.json({ success: true, status: 'resolved', message: 'Retry succeeded' })
        } else {
          await db.query(
            `UPDATE webhook_failures
             SET retry_count = retry_count + 1,
                 error_message = $1
             WHERE id = $2`,
            ['Retry failed — HTTP ' + resp.status, failure_id]
          )
          return c.json({
            success: false,
            status: 'failed',
            message: 'Retry failed with HTTP ' + resp.status,
          })
        }
      } catch (retryErr: any) {
        await db.query(
          `UPDATE webhook_failures
           SET retry_count = retry_count + 1,
               error_message = $1
           WHERE id = $2`,
          [retryErr?.message || 'Retry fetch error', failure_id]
        )
        return c.json({
          success: false,
          status: 'failed',
          message: 'Retry error: ' + retryErr?.message,
        })
      }
    }

    if (action === 'discard') {
      await db.query(
        `UPDATE webhook_failures
         SET status = 'discarded',
             resolution_notes = $1,
             resolved_by = $2, resolved_at = NOW()
         WHERE id = $3`,
        [resolution_notes || 'Discarded by user', session.user_id, failure_id]
      )
      return c.json({ success: true, status: 'discarded' })
    }

    if (action === 'manual_review') {
      await db.query(
        `UPDATE webhook_failures
         SET status = 'under_review',
             resolution_notes = $1,
             resolved_by = $2
         WHERE id = $3`,
        [resolution_notes || 'Marked for manual review', session.user_id, failure_id]
      )
      return c.json({ success: true, status: 'under_review' })
    }

    return c.json({ error: 'Unknown action' }, 400)
  } catch (err: any) {
    logger.error('PUT /api/reliability/webhooks error', { error: err?.message })
    return c.json({ error: 'Failed to process webhook action' }, 500)
  }
})
