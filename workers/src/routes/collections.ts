/**
 * Collections CRM Routes - Debt collection account management
 *
 * Endpoints:
 *   GET    /              - List collection accounts
 *   POST   /              - Create collection account
 *   GET    /stats         - Aggregate portfolio stats
 *   GET    /imports        - List CSV import history
 *   POST   /import         - CSV bulk import
 *   GET    /:id           - Get single account
 *   PUT    /:id           - Update account
 *   DELETE /:id           - Soft-delete account
 *   GET    /:id/payments  - List payments for account
 *   POST   /:id/payments  - Record payment
 *   GET    /:id/tasks     - List tasks for account
 *   POST   /:id/tasks     - Create task
 *   PUT    /:id/tasks/:taskId  - Update task
 *   DELETE /:id/tasks/:taskId  - Delete task
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { validateBody } from '../lib/validate'
import {
  CreateCollectionAccountSchema,
  UpdateCollectionAccountSchema,
  CreateCollectionPaymentSchema,
  CreateCollectionTaskSchema,
  UpdateCollectionTaskSchema,
  CollectionCsvImportSchema,
} from '../lib/schemas'
import { getDb, withTransaction } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { collectionsRateLimit, collectionsImportRateLimit } from '../lib/rate-limit'

export const collectionsRoutes = new Hono<AppEnv>()

// ─── List collection accounts ────────────────────────────────────────────────
collectionsRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    if (!session.organization_id) {
      return c.json({ success: true, accounts: [] })
    }

    const status = c.req.query('status')
    const search = c.req.query('search')
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const offset = parseInt(c.req.query('offset') || '0', 10)

    let query = `SELECT * FROM collection_accounts
      WHERE organization_id = $1 AND is_deleted = false`
    const params: any[] = [session.organization_id]
    let paramIndex = 2

    if (status) {
      query += ` AND status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR external_id ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    query += ` ORDER BY balance_due DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    return c.json({ success: true, accounts: result.rows })
  } catch (err: any) {
    logger.error('GET /api/collections error', { error: err?.message })
    return c.json({ error: 'Failed to get collection accounts' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Portfolio stats ─────────────────────────────────────────────────────────
collectionsRoutes.get('/stats', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT
        COUNT(*)::int AS total_accounts,
        COALESCE(SUM(balance_due), 0)::numeric AS total_balance_due,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_accounts,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_accounts,
        COUNT(*) FILTER (WHERE status = 'partial')::int AS partial_accounts,
        COUNT(*) FILTER (WHERE status = 'disputed')::int AS disputed_accounts,
        COUNT(*) FILTER (WHERE status = 'archived')::int AS archived_accounts,
        COALESCE(SUM(balance_due) FILTER (WHERE status = 'paid'), 0)::numeric AS total_recovered
      FROM collection_accounts
      WHERE organization_id = $1 AND is_deleted = false`,
      [session.organization_id]
    )

    const stats = result.rows[0]
    const totalDue = parseFloat(stats.total_balance_due) || 0

    // Get total payments
    const paymentsResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total_payments
      FROM collection_payments
      WHERE organization_id = $1`,
      [session.organization_id]
    )
    const totalPayments = parseFloat(paymentsResult.rows[0].total_payments) || 0

    // Pending tasks count
    const tasksResult = await db.query(
      `SELECT COUNT(*)::int AS pending_tasks
      FROM collection_tasks
      WHERE organization_id = $1 AND status IN ('pending', 'in_progress')`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      stats: {
        ...stats,
        total_payments: totalPayments,
        recovery_rate:
          totalDue > 0 ? Math.round((totalPayments / (totalDue + totalPayments)) * 100) : 0,
        pending_tasks: tasksResult.rows[0].pending_tasks,
      },
    })
  } catch (err: any) {
    logger.error('GET /api/collections/stats error', { error: err?.message })
    return c.json({ error: 'Failed to get collection stats' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Import history ──────────────────────────────────────────────────────────
collectionsRoutes.get('/imports', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT * FROM collection_csv_imports
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
      [session.organization_id]
    )

    return c.json({ success: true, imports: result.rows })
  } catch (err: any) {
    logger.error('GET /api/collections/imports error', { error: err?.message })
    return c.json({ error: 'Failed to get import history' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Create collection account ───────────────────────────────────────────────
collectionsRoutes.post('/', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, CreateCollectionAccountSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    const result = await db.query(
      `INSERT INTO collection_accounts
        (organization_id, external_id, source, name, balance_due, primary_phone,
         secondary_phone, email, address, custom_fields, status, notes,
         promise_date, promise_amount, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        session.organization_id,
        data.external_id || null,
        data.source || 'manual',
        data.name,
        data.balance_due,
        data.primary_phone,
        data.secondary_phone || null,
        data.email || null,
        data.address || null,
        data.custom_fields ? JSON.stringify(data.custom_fields) : null,
        data.status || 'active',
        data.notes || null,
        data.promise_date || null,
        data.promise_amount || null,
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'collection_accounts',
      resourceId: result.rows[0].id,
      action: AuditAction.COLLECTION_ACCOUNT_CREATED,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ success: true, account: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/collections error', { error: err?.message })
    return c.json({ error: 'Failed to create collection account' }, 500)
  } finally {
    await db.end()
  }
})

// ─── CSV bulk import ─────────────────────────────────────────────────────────
collectionsRoutes.post('/import', collectionsImportRateLimit, async (c) => {
  const session = await requireRole(c, 'operator')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, CollectionCsvImportSchema)
    if (!parsed.success) return parsed.response
    const { file_name, accounts, column_mapping } = parsed.data

    // Create import record
    const importResult = await db.query(
      `INSERT INTO collection_csv_imports
        (organization_id, file_name, rows_total, rows_imported, rows_skipped,
         column_mapping, status, created_by)
      VALUES ($1, $2, $3, 0, 0, $4, 'processing', $5)
      RETURNING *`,
      [
        session.organization_id,
        file_name,
        accounts.length,
        column_mapping ? JSON.stringify(column_mapping) : null,
        session.user_id,
      ]
    )
    const importId = importResult.rows[0].id

    let imported = 0
    let skipped = 0
    const errors: Array<{ row: number; error: string }> = []

    // Batch INSERT via VALUES list to avoid N+1 queries on large CSV imports
    const BATCH_SIZE = 50
    for (let batchStart = 0; batchStart < accounts.length; batchStart += BATCH_SIZE) {
      const batch = accounts.slice(batchStart, batchStart + BATCH_SIZE)
      const values: any[] = []
      const placeholders: string[] = []

      for (let i = 0; i < batch.length; i++) {
        const acct = batch[i]
        const offset = i * 14
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, 'csv_import', $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`
        )
        values.push(
          session.organization_id,
          acct.external_id || null,
          acct.name,
          acct.balance_due,
          acct.primary_phone,
          acct.secondary_phone || null,
          acct.email || null,
          acct.address || null,
          acct.custom_fields ? JSON.stringify(acct.custom_fields) : null,
          acct.status || 'active',
          acct.notes || null,
          acct.promise_date || null,
          acct.promise_amount || null,
          session.user_id
        )
      }

      try {
        const result = await db.query(
          `INSERT INTO collection_accounts
            (organization_id, external_id, source, name, balance_due, primary_phone,
             secondary_phone, email, address, custom_fields, status, notes,
             promise_date, promise_amount, created_by)
          VALUES ${placeholders.join(', ')}`,
          values
        )
        imported += result.rowCount || batch.length
      } catch (batchErr: any) {
        // Fallback: insert individually to identify which rows failed
        for (let i = 0; i < batch.length; i++) {
          const acct = batch[i]
          try {
            await db.query(
              `INSERT INTO collection_accounts
                (organization_id, external_id, source, name, balance_due, primary_phone,
                 secondary_phone, email, address, custom_fields, status, notes,
                 promise_date, promise_amount, created_by)
              VALUES ($1, $2, 'csv_import', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [
                session.organization_id,
                acct.external_id || null,
                acct.name,
                acct.balance_due,
                acct.primary_phone,
                acct.secondary_phone || null,
                acct.email || null,
                acct.address || null,
                acct.custom_fields ? JSON.stringify(acct.custom_fields) : null,
                acct.status || 'active',
                acct.notes || null,
                acct.promise_date || null,
                acct.promise_amount || null,
                session.user_id,
              ]
            )
            imported++
          } catch (rowErr: any) {
            skipped++
            errors.push({ row: batchStart + i + 1, error: rowErr?.message || 'Unknown error' })
          }
        }
      }
    }

    // Update import record
    await db.query(
      `UPDATE collection_csv_imports
      SET rows_imported = $1, rows_skipped = $2, errors = $3,
          status = $4, completed_at = NOW()
      WHERE id = $5`,
      [
        imported,
        skipped,
        errors.length > 0 ? JSON.stringify(errors) : null,
        skipped === accounts.length ? 'failed' : 'completed',
        importId,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'collection_csv_imports',
      resourceId: importId,
      action: AuditAction.COLLECTION_CSV_IMPORTED,
      oldValue: null,
      newValue: { file_name, imported, skipped, total: accounts.length },
    })

    return c.json(
      {
        success: true,
        import: {
          id: importId,
          file_name,
          rows_total: accounts.length,
          rows_imported: imported,
          rows_skipped: skipped,
          errors: errors.length > 0 ? errors : null,
        },
      },
      201
    )
  } catch (err: any) {
    logger.error('POST /api/collections/import error', { error: err?.message })
    return c.json({ error: 'Failed to import accounts' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Get daily stats (collections dashboard) ──────────────────────────────────
collectionsRoutes.get('/daily-stats', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountsResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS queue_count,
        COUNT(*) FILTER (WHERE last_contacted_at::date = CURRENT_DATE)::int AS calls_today,
        COUNT(*) FILTER (WHERE promise_date = CURRENT_DATE)::int AS callbacks_due,
        COUNT(*) FILTER (
          WHERE status = 'disputed' OR (status = 'active' AND balance_due >= 5000)
        )::int AS critical_accounts
      FROM collection_accounts
      WHERE organization_id = $1 AND is_deleted = false`,
      [session.organization_id]
    )

    const paymentsTableResult = await db.query(
      `SELECT to_regclass('public.collection_payments') IS NOT NULL AS exists`
    )

    let collectedToday = 0
    if (paymentsTableResult.rows[0]?.exists) {
      const paymentsResult = await db.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS collected_today
         FROM collection_payments
         WHERE organization_id = $1
           AND created_at::date = CURRENT_DATE`,
        [session.organization_id]
      )
      collectedToday = parseFloat(paymentsResult.rows[0]?.collected_today || '0') || 0
    }

    const callbacksTableResult = await db.query(
      `SELECT to_regclass('public.collection_callbacks') IS NOT NULL AS exists`
    )

    let scheduledCallbacksDue = 0
    if (callbacksTableResult.rows[0]?.exists) {
      const callbacksCountResult = await db.query(
        `SELECT COUNT(*)::int AS callbacks_due
         FROM collection_callbacks
         WHERE organization_id = $1
           AND status = 'pending'
           AND scheduled_for::date = CURRENT_DATE`,
        [session.organization_id]
      )
      scheduledCallbacksDue = parseInt(callbacksCountResult.rows[0]?.callbacks_due || '0', 10) || 0
    }

    const stats = accountsResult.rows[0] || {}
    const totalCallbacksDue = (parseInt(stats.callbacks_due) || 0) + scheduledCallbacksDue

    return c.json({
      data: {
        queue_count: parseInt(stats.queue_count) || 0,
        calls_today: parseInt(stats.calls_today) || 0,
        target_calls: 40,
        collected_today: collectedToday,
        target_amount: 5000,
        callbacks_due: totalCallbacksDue,
        critical_accounts: parseInt(stats.critical_accounts) || 0,
        avg_score: 0,
      },
    })
  } catch (err: any) {
    logger.error('GET /api/collections/daily-stats error', { error: err?.message })
    return c.json({ error: 'Failed to fetch daily stats' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Get callbacks (due today or upcoming) ────────────────────────────────────
collectionsRoutes.get('/callbacks', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const today = c.req.query('today') === 'true'
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '10', 10) || 10, 1), 100)

  const db = getDb(c.env, session.organization_id)
  try {
    const callbacksTableResult = await db.query(
      `SELECT to_regclass('public.collection_callbacks') IS NOT NULL AS exists`
    )

    if (callbacksTableResult.rows[0]?.exists) {
      const callbackWhereClause = today
        ? 'AND cb.scheduled_for::date = CURRENT_DATE'
        : 'AND cb.scheduled_for::date >= CURRENT_DATE'

      const callbackResult = await db.query(
        `SELECT
          cb.id,
          cb.account_id,
          ca.name AS account_name,
          cb.scheduled_for AS scheduled_time,
          ca.balance_due,
          cb.notes
        FROM collection_callbacks cb
        JOIN collection_accounts ca ON ca.id = cb.account_id
        WHERE cb.organization_id = $1
          AND ca.organization_id = $1
          AND ca.is_deleted = false
          AND cb.status = 'pending'
          ${callbackWhereClause}
        ORDER BY cb.scheduled_for ASC
        LIMIT $2`,
        [session.organization_id, limit]
      )

      if (callbackResult.rows.length > 0) {
        return c.json({ data: callbackResult.rows, callbacks: callbackResult.rows })
      }
    }

    const whereClause = today
      ? 'AND promise_date = CURRENT_DATE'
      : 'AND promise_date >= CURRENT_DATE'

    const promiseResult = await db.query(
      `SELECT
        id,
        id AS account_id,
        name,
        name AS account_name,
        promise_date::timestamptz AS scheduled_time,
        balance_due,
        notes
      FROM collection_accounts
      WHERE organization_id = $1
        AND is_deleted = false
        AND promise_date IS NOT NULL
        ${whereClause}
      ORDER BY promise_date ASC, created_at ASC
      LIMIT $2`,
      [session.organization_id, limit]
    )

    return c.json({ data: promiseResult.rows, callbacks: promiseResult.rows })
  } catch (err: any) {
    logger.error('GET /api/collections/callbacks error', { error: err?.message })
    return c.json({ error: 'Failed to fetch callbacks' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Get promises to pay ─────────────────────────────────────────────────────
collectionsRoutes.get('/promises', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = parseInt(c.req.query('limit') || '100')
    const offset = parseInt(c.req.query('offset') || '0')

    const result = await db.query(
      `SELECT
        ca.id,
        ca.name,
        ca.balance_due,
        ca.promise_date,
        ca.promise_amount,
        ca.status,
        ca.last_contacted_at,
        ca.created_at,
        ca.updated_at,
        u.name AS created_by_name
      FROM collection_accounts ca
      LEFT JOIN users u ON ca.created_by = u.id
      WHERE ca.organization_id = $1
        AND ca.promise_date IS NOT NULL
        AND ca.promise_amount IS NOT NULL
        AND ca.is_deleted = false
        AND ca.status IN ('active', 'partial', 'disputed')
      ORDER BY ca.promise_date ASC
      LIMIT $2 OFFSET $3`,
      [session.organization_id, limit, offset]
    )

    return c.json({ success: true, promises: result.rows })
  } catch (err: any) {
    logger.error('GET /api/collections/promises error', { error: err?.message })
    return c.json({ error: 'Failed to get promises' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Get single account ──────────────────────────────────────────────────────
collectionsRoutes.get('/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    // Skip static routes that are handled above
    if (['stats', 'imports', 'import', 'promises', 'daily-stats', 'callbacks'].includes(accountId)) {
      return c.json({ error: 'Not found' }, 404)
    }

    const result = await db.query(
      `SELECT * FROM collection_accounts
      WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
      [accountId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    return c.json({ success: true, account: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/collections/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get collection account' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Update account ──────────────────────────────────────────────────────────
collectionsRoutes.put('/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')
    const parsed = await validateBody(c, UpdateCollectionAccountSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    // Fetch existing record for audit trail
    const existing = await db.query(
      `SELECT * FROM collection_accounts WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
      [accountId, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }
    const oldRecord = existing.rows[0]

    const result = await db.query(
      `UPDATE collection_accounts
      SET name = COALESCE($1, name),
          balance_due = COALESCE($2, balance_due),
          primary_phone = COALESCE($3, primary_phone),
          secondary_phone = COALESCE($4, secondary_phone),
          email = COALESCE($5, email),
          address = COALESCE($6, address),
          custom_fields = COALESCE($7, custom_fields),
          status = COALESCE($8, status),
          notes = COALESCE($9, notes),
          promise_date = COALESCE($10, promise_date),
          promise_amount = COALESCE($11, promise_amount),
          last_contacted_at = COALESCE($12, last_contacted_at),
          updated_at = NOW()
      WHERE id = $13 AND organization_id = $14 AND is_deleted = false
      RETURNING *`,
      [
        data.name || null,
        data.balance_due ?? null,
        data.primary_phone || null,
        data.secondary_phone ?? null,
        data.email ?? null,
        data.address ?? null,
        data.custom_fields ? JSON.stringify(data.custom_fields) : null,
        data.status || null,
        data.notes ?? null,
        data.promise_date ?? null,
        data.promise_amount ?? null,
        data.last_contacted_at || null,
        accountId,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'collection_accounts',
      resourceId: accountId,
      action: AuditAction.COLLECTION_ACCOUNT_UPDATED,
      oldValue: oldRecord,
      newValue: result.rows[0],
    })

    return c.json({ success: true, account: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/collections/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update collection account' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Soft-delete account ─────────────────────────────────────────────────────
collectionsRoutes.delete('/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'operator')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    const result = await db.query(
      `UPDATE collection_accounts
      SET is_deleted = true, deleted_at = NOW(), deleted_by = $1, updated_at = NOW()
      WHERE id = $2 AND organization_id = $3 AND is_deleted = false
      RETURNING id`,
      [session.user_id, accountId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'collection_accounts',
      resourceId: accountId,
      action: AuditAction.COLLECTION_ACCOUNT_DELETED,
      oldValue: { id: accountId },
      newValue: null,
    })

    return c.json({ success: true, message: 'Account deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/collections/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete collection account' }, 500)
  } finally {
    await db.end()
  }
})

// ─── List payments for account ───────────────────────────────────────────────
collectionsRoutes.get('/:id/payments', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    const result = await db.query(
      `SELECT * FROM collection_payments
      WHERE account_id = $1 AND organization_id = $2
      ORDER BY created_at DESC`,
      [accountId, session.organization_id]
    )

    return c.json({ success: true, payments: result.rows })
  } catch (err: any) {
    logger.error('GET /api/collections/:id/payments error', { error: err?.message })
    return c.json({ error: 'Failed to get payments' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Record payment ──────────────────────────────────────────────────────────
collectionsRoutes.post('/:id/payments', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    // Verify account exists and belongs to org
    const accountCheck = await db.query(
      `SELECT id, balance_due FROM collection_accounts
      WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
      [accountId, session.organization_id]
    )

    if (accountCheck.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const parsed = await validateBody(c, CreateCollectionPaymentSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    // Ensure account_id from URL matches
    const paymentAccountId = accountId
    const currentBalance = parseFloat(accountCheck.rows[0].balance_due)
    const newBalance = Math.max(0, currentBalance - data.amount)
    const newStatus = newBalance === 0 ? 'paid' : newBalance < currentBalance ? 'partial' : 'active'

    // Insert payment + update balance atomically
    const result = await withTransaction(db, async (tx) => {
      const paymentResult = await tx.query(
        `INSERT INTO collection_payments
          (organization_id, account_id, amount, method, stripe_payment_id,
           reference_number, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          session.organization_id,
          paymentAccountId,
          data.amount,
          data.method || 'other',
          data.stripe_payment_id || null,
          data.reference_number || null,
          data.notes || null,
          session.user_id,
        ]
      )

      // Update account balance
      await tx.query(
        `UPDATE collection_accounts
        SET balance_due = $1, status = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4`,
        [newBalance, newStatus, paymentAccountId, session.organization_id]
      )

      return paymentResult
    })

    // Audit log: fire-and-forget, outside transaction
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'collection_payments',
      resourceId: result.rows[0].id,
      action: AuditAction.COLLECTION_PAYMENT_CREATED,
      oldValue: { balance_due: currentBalance },
      newValue: { ...result.rows[0], new_balance: newBalance },
    })

    return c.json({ success: true, payment: result.rows[0], new_balance: newBalance }, 201)
  } catch (err: any) {
    logger.error('POST /api/collections/:id/payments error', { error: err?.message })
    return c.json({ error: 'Failed to record payment' }, 500)
  } finally {
    await db.end()
  }
})

// ─── List tasks for account ──────────────────────────────────────────────────
collectionsRoutes.get('/:id/tasks', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    const result = await db.query(
      `SELECT * FROM collection_tasks
      WHERE account_id = $1 AND organization_id = $2
      ORDER BY due_date ASC NULLS LAST, created_at DESC`,
      [accountId, session.organization_id]
    )

    return c.json({ success: true, tasks: result.rows })
  } catch (err: any) {
    logger.error('GET /api/collections/:id/tasks error', { error: err?.message })
    return c.json({ error: 'Failed to get tasks' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Create task ─────────────────────────────────────────────────────────────
collectionsRoutes.post('/:id/tasks', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    // Verify account exists
    const accountCheck = await db.query(
      `SELECT id FROM collection_accounts
      WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
      [accountId, session.organization_id]
    )

    if (accountCheck.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const parsed = await validateBody(c, CreateCollectionTaskSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    const result = await db.query(
      `INSERT INTO collection_tasks
        (organization_id, account_id, type, title, notes, due_date,
         assigned_to, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        session.organization_id,
        accountId,
        data.type || 'followup',
        data.title,
        data.notes || null,
        data.due_date || null,
        data.assigned_to || null,
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'collection_tasks',
      resourceId: result.rows[0].id,
      action: AuditAction.COLLECTION_TASK_CREATED,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ success: true, task: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/collections/:id/tasks error', { error: err?.message })
    return c.json({ error: 'Failed to create task' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Update task ─────────────────────────────────────────────────────────────
collectionsRoutes.put('/:id/tasks/:taskId', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')
    const taskId = c.req.param('taskId')

    const parsed = await validateBody(c, UpdateCollectionTaskSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    const result = await db.query(
      `UPDATE collection_tasks
      SET title = COALESCE($1, title),
          notes = COALESCE($2, notes),
          due_date = COALESCE($3, due_date),
          status = COALESCE($4, status),
          assigned_to = COALESCE($5, assigned_to),
          completed_at = CASE WHEN $4 = 'completed' THEN NOW() ELSE completed_at END,
          updated_at = NOW()
      WHERE id = $6 AND account_id = $7 AND organization_id = $8
      RETURNING *`,
      [
        data.title || null,
        data.notes ?? null,
        data.due_date ?? null,
        data.status || null,
        data.assigned_to ?? null,
        taskId,
        accountId,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Task not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'collection_tasks',
      resourceId: taskId,
      action: AuditAction.COLLECTION_TASK_UPDATED,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ success: true, task: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/collections/:id/tasks/:taskId error', { error: err?.message })
    return c.json({ error: 'Failed to update task' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Delete task ─────────────────────────────────────────────────────────────
collectionsRoutes.delete('/:id/tasks/:taskId', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')
    const taskId = c.req.param('taskId')

    const result = await db.query(
      `DELETE FROM collection_tasks
      WHERE id = $1 AND account_id = $2 AND organization_id = $3
      RETURNING id`,
      [taskId, accountId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Task not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'collection_tasks',
      resourceId: taskId,
      action: AuditAction.COLLECTION_TASK_DELETED,
      oldValue: { id: taskId },
      newValue: null,
    })

    return c.json({ success: true, message: 'Task deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/collections/:id/tasks/:taskId error', { error: err?.message })
    return c.json({ error: 'Failed to delete task' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Get notes for account ───────────────────────────────────────────────────
collectionsRoutes.get('/:id/notes', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    const result = await db.query(
      `SELECT cn.*, u.name AS author_name, u.email AS author_email
       FROM collection_notes cn
       LEFT JOIN users u ON cn.user_id = u.id
       WHERE cn.account_id = $1 AND cn.organization_id = $2
       ORDER BY cn.created_at DESC
       LIMIT 100`,
      [accountId, session.organization_id]
    )

    return c.json({ success: true, notes: result.rows })
  } catch (err: any) {
    logger.error('GET /api/collections/:id/notes error', { error: err?.message })
    return c.json({ success: true, notes: [] })
  } finally {
    await db.end()
  }
})

// ─── Add note to account ─────────────────────────────────────────────────────
collectionsRoutes.post('/:id/notes', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')
    const body = await c.req.json()
    const { content } = body

    if (!content?.trim()) {
      return c.json({ error: 'content is required' }, 400)
    }

    // Verify account belongs to org
    const acctCheck = await db.query(
      `SELECT id FROM collection_accounts WHERE id = $1 AND organization_id = $2`,
      [accountId, session.organization_id]
    )
    if (acctCheck.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const result = await db.query(
      `INSERT INTO collection_notes (organization_id, account_id, created_by, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [session.organization_id, accountId, session.user_id, content.trim()]
    )

    return c.json({ success: true, note: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/collections/:id/notes error', { error: err?.message })
    return c.json({ error: 'Failed to add note' }, 500)
  } finally {
    await db.end()
  }
})

// NOTE: Duplicate /import, /imports, /promises handlers removed 2026-02-13
// Canonical handlers are at lines ~148 (/imports), ~228 (/import), ~537 (/promises)
// See ARCH_DOCS/06-REFERENCE/ENGINEERING_GUIDE.md Appendix A, Issue #2

// ─── Get unified communications timeline for account ────────────────────────
collectionsRoutes.get('/:id/communications', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    const offset = parseInt(c.req.query('offset') || '0', 10)
    const channelFilter = c.req.query('channel') // all|calls|sms|email|payments|notes
    const searchQuery = c.req.query('search')

    // Verify account belongs to org
    const acctCheck = await db.query(
      `SELECT id, primary_phone, email FROM collection_accounts 
       WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
      [accountId, session.organization_id]
    )
    if (acctCheck.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const account = acctCheck.rows[0]
    const communications: any[] = []

    // Build unified timeline from multiple sources
    // 1. Phone Calls (from calls table)
    if (!channelFilter || channelFilter === 'all' || channelFilter === 'calls') {
      const callsQuery = `
        SELECT 
          id,
          'call' AS channel_type,
          started_at AS timestamp,
          ended_at,
          status,
          disposition,
          disposition_notes AS content,
          EXTRACT(EPOCH FROM (ended_at - started_at))::int AS duration_seconds,
          created_by
        FROM calls
        WHERE organization_id = $1
          AND (call_sid LIKE $2 OR call_sid LIKE $3)
          AND is_deleted = false
        ORDER BY started_at DESC
        LIMIT 50
      `
      const callsResult = await db.query(callsQuery, [
        session.organization_id,
        `%${account.primary_phone}%`,
        account.email ? `%${account.email}%` : '%NOEMAIL%'
      ])
      communications.push(...callsResult.rows)
    }

    // 2. SMS Messages (from sms_logs table if exists)
    // Note: SMS logs table may not exist - skip silently
    if (!channelFilter || channelFilter === 'all' || channelFilter === 'sms') {
      try {
        const smsQuery = `
          SELECT 
            id,
            'sms' AS channel_type,
            created_at AS timestamp,
            direction,
            message_body AS content,
            status,
            to_number,
            from_number
          FROM sms_logs
          WHERE organization_id = $1
            AND (to_number = $2 OR from_number = $2)
          ORDER BY created_at DESC
          LIMIT 50
        `
        const smsResult = await db.query(smsQuery, [
          session.organization_id,
          account.primary_phone
        ])
        communications.push(...smsResult.rows)
      } catch (err) {
        // Table may not exist - skip
        logger.error('SMS logs query failed (table may not exist)', { error: err })
      }
    }

    // 3. Email Logs (from email_logs table if exists)
    if (!channelFilter || channelFilter === 'all' || channelFilter === 'email') {
      if (account.email) {
        try {
          const emailQuery = `
            SELECT 
              id,
              'email' AS channel_type,
              created_at AS timestamp,
              subject,
              status,
              opened_at,
              clicked_at,
              to_email,
              from_email
            FROM email_logs
            WHERE organization_id = $1
              AND to_email = $2
            ORDER BY created_at DESC
            LIMIT 50
          `
          const emailResult = await db.query(emailQuery, [
            session.organization_id,
            account.email
          ])
          communications.push(...emailResult.rows)
        } catch (err) {
          // Table may not exist - skip
          logger.error('Email logs query failed (table may not exist)', { error: err })
        }
      }
    }

    // 4. Payment Links (from payment_links table if exists)
    if (!channelFilter || channelFilter === 'all' || channelFilter === 'payments') {
      try {
        const paymentLinksQuery = `
          SELECT 
            id,
            'payment_link' AS channel_type,
            created_at AS timestamp,
            amount,
            status,
            sent_at,
            clicked_at,
            paid_at,
            link_url
          FROM payment_links
          WHERE organization_id = $1
            AND account_id = $2
          ORDER BY created_at DESC
          LIMIT 50
        `
        const paymentLinksResult = await db.query(paymentLinksQuery, [
          session.organization_id,
          accountId
        ])
        communications.push(...paymentLinksResult.rows)
      } catch (err) {
        // Table may not exist - skip
        logger.error('Payment links query failed (table may not exist)', { error: err })
      }
    }

    // 5. Notes & Dispositions (from collection_tasks table)
    if (!channelFilter || channelFilter === 'all' || channelFilter === 'notes') {
      const notesQuery = `
        SELECT 
          id,
          'note' AS channel_type,
          created_at AS timestamp,
          title,
          notes AS content,
          type,
          status,
          created_by
        FROM collection_tasks
        WHERE organization_id = $1
          AND account_id = $2
        ORDER BY created_at DESC
        LIMIT 50
      `
      const notesResult = await db.query(notesQuery, [
        session.organization_id,
        accountId
      ])
      communications.push(...notesResult.rows)
    }

    // Sort all communications by timestamp (newest first)
    communications.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeB - timeA
    })

    // Apply search filter if provided
    let filtered = communications
    if (searchQuery) {
      const search = searchQuery.toLowerCase()
      filtered = communications.filter((comm) => {
        const content = (comm.content || comm.subject || comm.title || '').toLowerCase()
        const disposition = (comm.disposition || '').toLowerCase()
        return content.includes(search) || disposition.includes(search)
      })
    }

    // Apply pagination
    const total = filtered.length
    const paginatedComms = filtered.slice(offset, offset + limit)

    return c.json({
      success: true,
      communications: paginatedComms,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (err: any) {
    logger.error('GET /api/collections/:id/communications error', { error: err?.message })
    return c.json({ error: 'Failed to get communications' }, 500)
  } finally {
    await db.end()
  }
})

