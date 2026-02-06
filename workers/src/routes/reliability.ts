/**
 * Reliability Routes - Webhook failure management and monitoring
 *
 * Endpoints:
 *   GET /webhooks  - List webhook failures/metrics
 *   PUT /webhooks  - Action on a webhook failure (retry, discard, manual_review)
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const reliabilityRoutes = new Hono<{ Bindings: Env }>()

async function getSQL(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

async function ensureTable(sql: any) {
  await sql`
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
  `
}

// GET /webhooks — List webhook failures and metrics
reliabilityRoutes.get('/webhooks', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    const status = c.req.query('status') || 'all'
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
    const offset = parseInt(c.req.query('offset') || '0')

    let failures: any[] = []
    let metrics: any = { active_failures: 0, resolved: 0, discarded: 0, total: 0 }

    try {
      if (status === 'all') {
        failures = await sql`
          SELECT * FROM webhook_failures
          WHERE organization_id = ${session.organization_id}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      } else {
        failures = await sql`
          SELECT * FROM webhook_failures
          WHERE organization_id = ${session.organization_id} AND status = ${status}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      }

      const metricsRows = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'failed')::int AS active_failures,
          COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
          COUNT(*) FILTER (WHERE status = 'discarded')::int AS discarded,
          COUNT(*)::int AS total
        FROM webhook_failures
        WHERE organization_id = ${session.organization_id}
      `
      if (metricsRows.length > 0) metrics = metricsRows[0]
    } catch {
      // Table may not exist or have different schema — create it
      await ensureTable(sql)
    }

    return c.json({
      success: true,
      failures,
      metrics,
      pagination: { limit, offset },
    })
  } catch (err: any) {
    console.error('GET /api/reliability/webhooks error:', err?.message)
    return c.json({ error: 'Failed to fetch webhook failures' }, 500)
  }
})

// PUT /webhooks — Take action on a webhook failure
reliabilityRoutes.put('/webhooks', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getSQL(c)
    await ensureTable(sql)

    const body = await c.req.json()
    const { failure_id, action, resolution_notes } = body

    if (!failure_id) return c.json({ error: 'failure_id is required' }, 400)
    if (!action || !['retry', 'discard', 'manual_review'].includes(action)) {
      return c.json({ error: 'action must be retry, discard, or manual_review' }, 400)
    }

    // Check failure belongs to org
    const existing = await sql`
      SELECT id, webhook_url, payload, retry_count, max_retries
      FROM webhook_failures
      WHERE id = ${failure_id} AND organization_id = ${session.organization_id}
    `
    if (existing.length === 0) return c.json({ error: 'Failure not found' }, 404)

    if (action === 'retry') {
      const fail = existing[0]
      // Attempt re-delivery
      try {
        const resp = await fetch(fail.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fail.payload),
        })
        if (resp.ok) {
          await sql`
            UPDATE webhook_failures
            SET status = 'resolved', retry_count = retry_count + 1,
                resolution_notes = ${'Retried successfully — HTTP ' + resp.status},
                resolved_by = ${session.user_id}, resolved_at = NOW()
            WHERE id = ${failure_id}
          `
          return c.json({ success: true, status: 'resolved', message: 'Retry succeeded' })
        } else {
          await sql`
            UPDATE webhook_failures
            SET retry_count = retry_count + 1,
                error_message = ${'Retry failed — HTTP ' + resp.status}
            WHERE id = ${failure_id}
          `
          return c.json({ success: false, status: 'failed', message: 'Retry failed with HTTP ' + resp.status })
        }
      } catch (retryErr: any) {
        await sql`
          UPDATE webhook_failures
          SET retry_count = retry_count + 1,
              error_message = ${retryErr?.message || 'Retry fetch error'}
          WHERE id = ${failure_id}
        `
        return c.json({ success: false, status: 'failed', message: 'Retry error: ' + retryErr?.message })
      }
    }

    if (action === 'discard') {
      await sql`
        UPDATE webhook_failures
        SET status = 'discarded',
            resolution_notes = ${resolution_notes || 'Discarded by user'},
            resolved_by = ${session.user_id}, resolved_at = NOW()
        WHERE id = ${failure_id}
      `
      return c.json({ success: true, status: 'discarded' })
    }

    if (action === 'manual_review') {
      await sql`
        UPDATE webhook_failures
        SET status = 'under_review',
            resolution_notes = ${resolution_notes || 'Marked for manual review'},
            resolved_by = ${session.user_id}
        WHERE id = ${failure_id}
      `
      return c.json({ success: true, status: 'under_review' })
    }

    return c.json({ error: 'Unknown action' }, 400)
  } catch (err: any) {
    console.error('PUT /api/reliability/webhooks error:', err?.message)
    return c.json({ error: 'Failed to process webhook action' }, 500)
  }
})
