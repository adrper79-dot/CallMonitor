/**
 * Payments Routes - Collection payment plans, links, and reconciliation
 *
 * NOTE: These are COLLECTION payments (debtor payment plans/links),
 * NOT SaaS subscription billing (which lives at /api/billing).
 *
 * Endpoints:
 *   GET    /               - List payments (supports ?status=, ?today=, ?account_id=)
 *   GET    /plans          - List payment plans
 *   POST   /plans          - Create payment plan
 *   GET    /links          - List payment links
 *   POST   /links          - Create payment link
 *   GET    /reconciliation - Reconciliation report
 *
 * Tables: payment_plans, scheduled_payments, payment_links (if they exist)
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { collectionsRateLimit } from '../lib/rate-limit'

export const paymentsRoutes = new Hono<AppEnv>()

// ─── GET / — List payments ─────────────────────────────────────────────────
// Supports: ?status=failed, ?today=true, ?account_id=UUID, ?limit=N
paymentsRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const status = c.req.query('status')
    const today = c.req.query('today')
    const accountId = c.req.query('account_id')
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const offset = parseInt(c.req.query('offset') || '0', 10)

    let query = `
      SELECT sp.*, pp.account_id, pp.total_amount, pp.frequency,
             ca.debtor_name, ca.account_number
      FROM scheduled_payments sp
      JOIN payment_plans pp ON sp.plan_id = pp.id
      LEFT JOIN collection_accounts ca ON pp.account_id = ca.id
      WHERE pp.organization_id = $1`
    const params: any[] = [session.organization_id]

    if (status) {
      params.push(status)
      query += ` AND sp.status = $${params.length}`
    }

    if (today === 'true') {
      query += ` AND sp.due_date::date = CURRENT_DATE`
    }

    if (accountId) {
      params.push(accountId)
      query += ` AND pp.account_id = $${params.length}`
    }

    query += ` ORDER BY sp.due_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    return c.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/payments error', { error: err?.message })
    // Graceful degradation — table may not exist yet
    return c.json({ success: true, data: [], total: 0 })
  } finally {
    await db.end()
  }
})

// ─── GET /plans — List payment plans ───────────────────────────────────────
paymentsRoutes.get('/plans', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const offset = parseInt(c.req.query('offset') || '0', 10)

    const result = await db.query(
      `SELECT pp.*, ca.debtor_name, ca.account_number, ca.balance_due,
              COUNT(sp.id)::int AS payment_count,
              COUNT(sp.id) FILTER (WHERE sp.status = 'completed')::int AS completed_count
       FROM payment_plans pp
       LEFT JOIN collection_accounts ca ON pp.account_id = ca.id
       LEFT JOIN scheduled_payments sp ON sp.plan_id = pp.id
       WHERE pp.organization_id = $1
       GROUP BY pp.id, ca.debtor_name, ca.account_number, ca.balance_due
       ORDER BY pp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [session.organization_id, limit, offset]
    )

    return c.json({ success: true, data: result.rows, limit, offset })
  } catch (err: any) {
    logger.error('GET /api/payments/plans error', { error: err?.message })
    return c.json({ success: true, data: [] })
  } finally {
    await db.end()
  }
})

// ─── POST /plans — Create a payment plan ───────────────────────────────────
paymentsRoutes.post('/plans', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const body = await c.req.json()
    const {
      account_id,
      total_amount,
      down_payment,
      installment_amount,
      frequency,
      num_payments,
      start_date,
      schedule,
    } = body

    if (!account_id || !total_amount) {
      return c.json({ error: 'account_id and total_amount are required' }, 400)
    }

    // Verify account belongs to this org
    const acctCheck = await db.query(
      `SELECT id FROM collection_accounts WHERE id = $1 AND organization_id = $2`,
      [account_id, session.organization_id]
    )
    if (acctCheck.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Create plan
    const planResult = await db.query(
      `INSERT INTO payment_plans
        (organization_id, account_id, total_amount, down_payment, installment_amount,
         frequency, num_payments, start_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        session.organization_id,
        account_id,
        total_amount,
        down_payment || 0,
        installment_amount || 0,
        frequency || 'monthly',
        num_payments || 1,
        start_date || new Date().toISOString(),
        session.user_id,
      ]
    )

    const plan = planResult.rows[0]

    // Create scheduled payments from schedule array if provided
    if (schedule && Array.isArray(schedule)) {
      for (const entry of schedule) {
        await db.query(
          `INSERT INTO scheduled_payments (plan_id, due_date, amount, status)
           VALUES ($1, $2, $3, 'pending')`,
          [plan.id, entry.date, entry.amount]
        )
      }
    }

    return c.json({ success: true, data: plan }, 201)
  } catch (err: any) {
    logger.error('POST /api/payments/plans error', { error: err?.message })
    return c.json({ error: 'Failed to create payment plan' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /links — List payment links ───────────────────────────────────────
paymentsRoutes.get('/links', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)

    const result = await db.query(
      `SELECT pl.*, ca.debtor_name, ca.account_number
       FROM payment_links pl
       LEFT JOIN collection_accounts ca ON pl.account_id = ca.id
       WHERE pl.organization_id = $1
       ORDER BY pl.created_at DESC
       LIMIT $2`,
      [session.organization_id, limit]
    )

    return c.json({ success: true, data: result.rows })
  } catch (err: any) {
    logger.error('GET /api/payments/links error', { error: err?.message })
    return c.json({ success: true, data: [] })
  } finally {
    await db.end()
  }
})

// ─── POST /links — Create a payment link ───────────────────────────────────
paymentsRoutes.post('/links', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const body = await c.req.json()
    const { account_id, amount, description, currency } = body

    if (!account_id || !amount) {
      return c.json({ error: 'account_id and amount are required' }, 400)
    }

    // Verify account belongs to this org
    const acctCheck = await db.query(
      `SELECT id FROM collection_accounts WHERE id = $1 AND organization_id = $2`,
      [account_id, session.organization_id]
    )
    if (acctCheck.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Generate a unique link token
    const linkToken = crypto.randomUUID()

    const result = await db.query(
      `INSERT INTO payment_links
        (organization_id, account_id, amount, description, currency, link_token, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        session.organization_id,
        account_id,
        amount,
        description || null,
        currency || 'usd',
        linkToken,
        session.user_id,
      ]
    )

    return c.json({ success: true, data: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/payments/links error', { error: err?.message })
    return c.json({ error: 'Failed to create payment link' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /reconciliation — Reconciliation report ───────────────────────────
paymentsRoutes.get('/reconciliation', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)

    // Aggregate reconciliation data: expected vs received
    const result = await db.query(
      `SELECT
        pp.id AS plan_id,
        ca.debtor_name,
        ca.account_number,
        pp.total_amount AS expected_total,
        COALESCE(SUM(sp.amount) FILTER (WHERE sp.status = 'completed'), 0) AS received_total,
        pp.total_amount - COALESCE(SUM(sp.amount) FILTER (WHERE sp.status = 'completed'), 0) AS outstanding,
        COUNT(sp.id)::int AS total_installments,
        COUNT(sp.id) FILTER (WHERE sp.status = 'completed')::int AS paid_installments,
        COUNT(sp.id) FILTER (WHERE sp.status = 'failed')::int AS failed_installments,
        pp.created_at
       FROM payment_plans pp
       LEFT JOIN collection_accounts ca ON pp.account_id = ca.id
       LEFT JOIN scheduled_payments sp ON sp.plan_id = pp.id
       WHERE pp.organization_id = $1
       GROUP BY pp.id, ca.debtor_name, ca.account_number
       ORDER BY pp.created_at DESC
       LIMIT $2`,
      [session.organization_id, limit]
    )

    return c.json({ success: true, data: result.rows })
  } catch (err: any) {
    logger.error('GET /api/payments/reconciliation error', { error: err?.message })
    return c.json({ success: true, data: [] })
  } finally {
    await db.end()
  }
})
