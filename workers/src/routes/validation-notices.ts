/**
 * Validation Notice Routes
 *
 * CFPB Regulation F §1006.34 — Validation Information
 * Must provide validation notice (Model Form B-1) within 5 days of initial communication.
 *
 * Endpoints:
 *   GET    /                - List validation notices (paginated, filterable)
 *   POST   /                - Generate new validation notice from account data
 *   GET    /:id             - Get single notice by ID
 *   PATCH  /:id/sent        - Mark notice as sent with delivery reference
 *   PATCH  /:id/disputed    - Mark notice as disputed (consumer responded)
 *   GET    /pending-alerts  - Get notices approaching 5-day deadline (for cron/dashboard)
 *
 * @see ARCH_DOCS/08-COMPLIANCE/REG_F_ENGINEERING_SPEC.md — TASK-011
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { getDb } from '../lib/db'
import { requireAuth, requireRole } from '../lib/auth'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { logger } from '../lib/logger'
import { complianceRateLimit } from '../lib/rate-limit'

type AppEnv = { Bindings: Env; Variables: { session: any } }

export const validationNoticeRoutes = new Hono<AppEnv>()

/**
 * GET / — List validation notices for the organization
 * Supports pagination and filtering by status, account_id
 */
validationNoticeRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Authentication required' }, 401)

  const db = getDb(c.env, session.organization_id)

  try {
    const url = new URL(c.req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
    const offset = (page - 1) * limit
    const status = url.searchParams.get('status')
    const accountId = url.searchParams.get('account_id')

    let whereClause = 'WHERE vn.organization_id = $1'
    const params: any[] = [session.organization_id]
    let paramIdx = 2

    if (status) {
      whereClause += ` AND vn.status = $${paramIdx}`
      params.push(status)
      paramIdx++
    }

    if (accountId) {
      whereClause += ` AND vn.account_id = $${paramIdx}`
      params.push(accountId)
      paramIdx++
    }

    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM validation_notices vn ${whereClause}`,
      params
    )

    const result = await db.query(
      `SELECT vn.*, ca.debtor_name AS consumer_display_name
       FROM validation_notices vn
       LEFT JOIN collection_accounts ca ON ca.id = vn.account_id
       ${whereClause}
       ORDER BY vn.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    )

    return c.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0]?.total || '0', 10),
        totalPages: Math.ceil(parseInt(countResult.rows[0]?.total || '0', 10) / limit),
      },
    })
  } catch (error) {
    logger.error('Failed to list validation notices', {
      error: (error as Error)?.message,
      organizationId: session.organization_id,
    })
    return c.json({ error: 'Failed to list validation notices' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * POST / — Generate a new validation notice from account data
 * Auto-populates Model Form B-1 fields from the collection account + org profile.
 */
validationNoticeRoutes.post('/', complianceRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Insufficient permissions' }, 403)

  const db = getDb(c.env, session.organization_id)

  try {
    const body = await c.req.json()
    const { account_id, delivery_method, spanish_translation_offered } = body

    if (!account_id) {
      return c.json({ error: 'account_id is required' }, 400)
    }

    // Validate delivery method
    const validMethods = ['email', 'mail', 'in_app', 'initial_communication']
    const method = validMethods.includes(delivery_method) ? delivery_method : 'mail'

    // Fetch account data to auto-populate notice fields
    const accountResult = await db.query(
      `SELECT ca.*, o.name AS org_name, o.address AS org_address
       FROM collection_accounts ca
       JOIN organizations o ON o.id = ca.organization_id
       WHERE ca.id = $1 AND ca.organization_id = $2`,
      [account_id, session.organization_id]
    )

    if (accountResult.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const acct = accountResult.rows[0]

    // Check if a notice already exists for this account
    const existingNotice = await db.query(
      `SELECT id, status FROM validation_notices
       WHERE account_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [account_id, session.organization_id]
    )

    if (existingNotice.rows.length > 0 && existingNotice.rows[0].status !== 'expired') {
      return c.json({
        error: 'Active validation notice already exists for this account',
        existing_notice_id: existingNotice.rows[0].id,
        existing_status: existingNotice.rows[0].status,
      }, 409)
    }

    // Calculate validation period end: 30 days from assumed receipt (today + 5 mail days + 30)
    const validationEnd = new Date()
    validationEnd.setDate(validationEnd.getDate() + 35) // 5 days mail + 30 days dispute period

    // Build Model Form B-1 data
    const noticeResult = await db.query(
      `INSERT INTO validation_notices (
        organization_id, account_id,
        collector_name, collector_mailing_address,
        consumer_name, consumer_mailing_address,
        creditor_on_itemization_date, account_number_truncated,
        current_creditor, itemization_date,
        amount_on_itemization_date, itemization_details, current_amount,
        validation_period_end, dispute_response_prompts,
        spanish_translation_offered,
        delivery_method, status, created_by
      ) VALUES (
        $1, $2,
        $3, $4,
        $5, $6,
        $7, $8,
        $9, $10,
        $11, $12::jsonb, $13,
        $14, $15::jsonb,
        $16,
        $17, 'pending', $18
      ) RETURNING *`,
      [
        session.organization_id,
        account_id,
        acct.org_name || 'Unknown Collector',
        acct.org_address || '',
        acct.debtor_name || acct.consumer_name || 'Unknown Consumer',
        acct.address || '',
        acct.original_creditor || acct.creditor_name || '',
        acct.account_number ? acct.account_number.slice(-4).padStart(acct.account_number.length, '*') : '',
        acct.current_creditor || acct.creditor_name || acct.org_name || '',
        acct.charge_off_date || acct.open_date || new Date().toISOString().split('T')[0],
        acct.original_balance || acct.balance || 0,
        JSON.stringify({
          interest_since_itemization: 0,
          fees_since_itemization: 0,
          payments_since_itemization: 0,
          credits_since_itemization: 0,
        }),
        acct.balance || acct.original_balance || 0,
        validationEnd.toISOString().split('T')[0],
        JSON.stringify({
          dispute_options: [
            'I want to dispute the debt because I think the amount is wrong.',
            'I want to dispute the debt because this is not my debt.',
            'I want to dispute the debt for another reason.',
          ],
          original_creditor_request: 'I want the name and address of the original creditor.',
          cfpb_reference: 'www.cfpb.gov/debt-collection',
        }),
        spanish_translation_offered || false,
        method,
        session.user_id,
      ]
    )

    const notice = noticeResult.rows[0]

    // Audit log — Reg F specific action
    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.VALIDATION_NOTICE_CREATED,
      resourceType: 'validation_notice',
      resourceId: notice.id,
      oldValue: null,
      newValue: { id: notice.id, account_id, status: 'pending', delivery_method: method },
    }).catch(() => {})

    // Log compliance event
    await db.query(
      `INSERT INTO compliance_events
       (organization_id, account_id, event_type, severity, passed, details)
       VALUES ($1, $2, 'validation_notice_created', 'info', true, $3::jsonb)`,
      [
        session.organization_id,
        account_id,
        JSON.stringify({
          notice_id: notice.id,
          delivery_method: method,
          validation_period_end: notice.validation_period_end,
          created_by: session.user_id,
        }),
      ]
    ).catch((err) =>
      logger.warn('Failed to log validation notice compliance event (non-fatal)', {
        error: (err as Error)?.message,
      })
    )

    return c.json({ data: notice }, 201)
  } catch (error) {
    logger.error('Failed to create validation notice', {
      error: (error as Error)?.message,
      organizationId: session.organization_id,
    })
    return c.json({ error: 'Failed to create validation notice' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * GET /:id — Get a single validation notice
 */
validationNoticeRoutes.get('/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Authentication required' }, 401)

  const db = getDb(c.env, session.organization_id)

  try {
    const noticeId = c.req.param('id')
    const result = await db.query(
      `SELECT vn.*, ca.debtor_name AS consumer_display_name
       FROM validation_notices vn
       LEFT JOIN collection_accounts ca ON ca.id = vn.account_id
       WHERE vn.id = $1 AND vn.organization_id = $2`,
      [noticeId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Validation notice not found' }, 404)
    }

    return c.json({ data: result.rows[0] })
  } catch (error) {
    logger.error('Failed to get validation notice', {
      error: (error as Error)?.message,
    })
    return c.json({ error: 'Failed to get validation notice' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * PATCH /:id/sent — Mark validation notice as sent with delivery tracking
 */
validationNoticeRoutes.patch('/:id/sent', complianceRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Insufficient permissions' }, 403)

  const db = getDb(c.env, session.organization_id)

  try {
    const noticeId = c.req.param('id')
    const body = await c.req.json()
    const { delivery_reference } = body

    // Verify notice exists and is in pending state
    const existing = await db.query(
      `SELECT id, status FROM validation_notices
       WHERE id = $1 AND organization_id = $2`,
      [noticeId, session.organization_id]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'Validation notice not found' }, 404)
    }

    if (existing.rows[0].status !== 'pending') {
      return c.json({ error: `Cannot mark as sent — current status is '${existing.rows[0].status}'` }, 400)
    }

    const result = await db.query(
      `UPDATE validation_notices
       SET status = 'sent',
           sent_at = NOW(),
           delivery_reference = $1,
           updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [delivery_reference || null, noticeId, session.organization_id]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.VALIDATION_NOTICE_SENT,
      resourceType: 'validation_notice',
      resourceId: noticeId,
      oldValue: { status: 'pending' },
      newValue: { status: 'sent', delivery_reference },
    }).catch(() => {})

    return c.json({ data: result.rows[0] })
  } catch (error) {
    logger.error('Failed to mark validation notice as sent', {
      error: (error as Error)?.message,
    })
    return c.json({ error: 'Failed to update validation notice' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * PATCH /:id/disputed — Mark notice as disputed when consumer responds
 * Triggers: freeze collection activity per §1006.34(c)(3)
 */
validationNoticeRoutes.patch('/:id/disputed', complianceRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Insufficient permissions' }, 403)

  const db = getDb(c.env, session.organization_id)

  try {
    const noticeId = c.req.param('id')
    const body = await c.req.json()
    const { dispute_reason } = body

    // Verify notice exists
    const existing = await db.query(
      `SELECT id, status, account_id FROM validation_notices
       WHERE id = $1 AND organization_id = $2`,
      [noticeId, session.organization_id]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'Validation notice not found' }, 404)
    }

    const accountId = existing.rows[0].account_id

    // Update notice status
    const result = await db.query(
      `UPDATE validation_notices
       SET status = 'disputed', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [noticeId, session.organization_id]
    )

    // Auto-create legal hold to freeze collection on disputed account (§1006.34(c)(3))
    await db.query(
      `INSERT INTO legal_holds (organization_id, account_id, hold_type, reason, status, created_by)
       VALUES ($1, $2, 'validation_dispute', $3, 'active', $4)
       ON CONFLICT DO NOTHING`,
      [
        session.organization_id,
        accountId,
        `Validation notice disputed: ${dispute_reason || 'Consumer exercised dispute rights per §1006.34(c)(3)'}`,
        session.user_id,
      ]
    ).catch((err) =>
      logger.warn('Failed to create auto legal hold for validation dispute (non-fatal)', {
        error: (err as Error)?.message,
      })
    )

    // Log compliance event
    await db.query(
      `INSERT INTO compliance_events
       (organization_id, account_id, event_type, severity, passed, details)
       VALUES ($1, $2, 'validation_notice_disputed', 'warning', true, $3::jsonb)`,
      [
        session.organization_id,
        accountId,
        JSON.stringify({
          notice_id: noticeId,
          dispute_reason: dispute_reason || null,
          legal_hold_created: true,
        }),
      ]
    ).catch((err) =>
      logger.warn('Failed to log validation dispute event (non-fatal)', {
        error: (err as Error)?.message,
      })
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.VALIDATION_NOTICE_DISPUTED,
      resourceType: 'validation_notice',
      resourceId: noticeId,
      oldValue: { status: existing.rows[0].status },
      newValue: { status: 'disputed', dispute_reason },
    }).catch(() => {})

    return c.json({ data: result.rows[0] })
  } catch (error) {
    logger.error('Failed to mark validation notice as disputed', {
      error: (error as Error)?.message,
    })
    return c.json({ error: 'Failed to update validation notice' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * GET /pending-alerts — Get notices approaching the 5-day send deadline
 * Used by dashboard widget and cron job alerts.
 * Returns pending notices created more than 3 days ago (2-day warning).
 */
validationNoticeRoutes.get('/pending-alerts', async (c) => {
  const session = await requireRole(c, 'compliance')
  if (!session) return c.json({ error: 'Insufficient permissions' }, 403)

  const db = getDb(c.env, session.organization_id)

  try {
    const result = await db.query(
      `SELECT vn.*, ca.debtor_name AS consumer_display_name,
              EXTRACT(DAY FROM NOW() - vn.created_at) AS days_since_created
       FROM validation_notices vn
       LEFT JOIN collection_accounts ca ON ca.id = vn.account_id
       WHERE vn.organization_id = $1
         AND vn.status = 'pending'
         AND vn.created_at < NOW() - INTERVAL '3 days'
       ORDER BY vn.created_at ASC`,
      [session.organization_id]
    )

    return c.json({
      data: result.rows,
      alert_count: result.rows.length,
      message: result.rows.length > 0
        ? `${result.rows.length} validation notice(s) approaching 5-day deadline`
        : 'No pending validation notice alerts',
    })
  } catch (error) {
    logger.error('Failed to get validation notice alerts', {
      error: (error as Error)?.message,
    })
    return c.json({ error: 'Failed to get alerts' }, 500)
  } finally {
    await db.end()
  }
})
