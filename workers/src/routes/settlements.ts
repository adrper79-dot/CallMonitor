/**
 * Settlement Offers Routes
 *
 * Backend API for settlement negotiation workflow.
 * Replaces the frontend-only SettlementCalculator with server-persisted offers.
 *
 * Endpoints:
 *   GET    /               - List settlement offers for org
 *   POST   /               - Create a settlement offer
 *   GET    /:id            - Get single offer
 *   PATCH  /:id            - Update offer (counter, accept, reject)
 *   POST   /:id/approve    - Supervisor approval for offers exceeding agent authority
 *   POST   /:id/accept     - Consumer accepts the offer
 *   POST   /:id/reject     - Consumer rejects the offer
 *   GET    /account/:id    - All offers for a specific account
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { collectionsRateLimit } from '../lib/rate-limit'

export const settlementRoutes = new Hono<AppEnv>()

// ─── GET / ─── List settlement offers ──────────────────────────────────────────
settlementRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const offset = parseInt(c.req.query('offset') || '0')
    const status = c.req.query('status')

    let query = `
      SELECT so.*,
        ca.debtor_name, ca.account_number, ca.current_balance as live_balance,
        u.name as proposed_by_name
      FROM settlement_offers so
      LEFT JOIN collection_accounts ca ON so.account_id = ca.id
      LEFT JOIN users u ON so.proposed_by::uuid = u.id
      WHERE so.organization_id = $1`
    const params: any[] = [session.organization_id]

    if (status) {
      params.push(status)
      query += ` AND so.status = $${params.length}`
    }

    query += ` ORDER BY so.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    const countResult = await db.query(
      `SELECT COUNT(*)::int as total FROM settlement_offers WHERE organization_id = $1${status ? ` AND status = '${status}'` : ''}`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      offers: result.rows,
      total: countResult.rows[0]?.total || 0,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/settlements error', { error: err?.message })
    return c.json({ success: true, offers: [], total: 0 })
  } finally {
    await db.end()
  }
})

// ─── POST / ─── Create settlement offer ────────────────────────────────────────
settlementRoutes.post('/', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    account_id: string
    call_id?: string
    proposed_amount: number
    payment_terms?: string
    installment_count?: number
    first_payment_due?: string
    valid_until?: string
    notes?: string
  }>()

  if (!body.account_id || !body.proposed_amount || body.proposed_amount <= 0) {
    return c.json({ error: 'account_id and positive proposed_amount are required' }, 400)
  }

  const validTerms = ['lump_sum', 'installment_2', 'installment_3', 'installment_6', 'installment_12', 'custom']
  const paymentTerms = validTerms.includes(body.payment_terms || '') ? body.payment_terms : 'lump_sum'

  const db = getDb(c.env, session.organization_id)
  try {
    // Get account balance
    const acctResult = await db.query(
      `SELECT id, current_balance FROM collection_accounts WHERE id = $1 AND organization_id = $2`,
      [body.account_id, session.organization_id]
    )
    if (acctResult.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const originalBalance = parseFloat(acctResult.rows[0].current_balance) || 0
    if (body.proposed_amount > originalBalance) {
      return c.json({ error: 'Proposed amount cannot exceed current balance' }, 400)
    }

    const discountPercent = originalBalance > 0
      ? ((originalBalance - body.proposed_amount) / originalBalance * 100)
      : 0

    // Check if agent needs supervisor approval (discount > 30%)
    const requiresApproval = discountPercent > 30

    // Default valid_until to 30 days from now
    const validUntil = body.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const result = await db.query(
      `INSERT INTO settlement_offers (
        organization_id, account_id, call_id, status,
        original_balance, proposed_amount, discount_percent,
        payment_terms, installment_count, first_payment_due,
        requires_approval, authority_limit, valid_until,
        proposed_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        session.organization_id,
        body.account_id,
        body.call_id || null,
        requiresApproval ? 'proposed' : 'proposed',
        originalBalance,
        body.proposed_amount,
        Math.round(discountPercent * 100) / 100,
        paymentTerms,
        body.installment_count || null,
        body.first_payment_due || null,
        requiresApproval,
        originalBalance * 0.7, // 30% authority limit
        validUntil,
        session.user_id,
        body.notes?.trim() || null,
      ]
    )

    const offer = result.rows[0]

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.SETTLEMENT_OFFER_CREATED,
      resourceType: 'settlement_offer',
      resourceId: offer.id,
      oldValue: null,
      newValue: offer,
    }).catch(() => {})

    logger.info('Settlement offer created', {
      offerId: offer.id,
      accountId: body.account_id,
      amount: body.proposed_amount,
      discount: `${discountPercent.toFixed(1)}%`,
      requiresApproval,
    })

    return c.json({
      success: true,
      offer,
      requires_approval: requiresApproval,
    }, 201)
  } catch (err: any) {
    logger.error('POST /api/settlements error', { error: err.message })
    return c.json({ error: 'Failed to create settlement offer' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /:id ─── Get offer detail ─────────────────────────────────────────────
settlementRoutes.get('/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')

    const result = await db.query(
      `SELECT so.*,
        ca.debtor_name, ca.account_number, ca.current_balance as live_balance,
        u.name as proposed_by_name, a.name as approved_by_name
      FROM settlement_offers so
      LEFT JOIN collection_accounts ca ON so.account_id = ca.id
      LEFT JOIN users u ON so.proposed_by::uuid = u.id
      LEFT JOIN users a ON so.approved_by::uuid = a.id
      WHERE so.id = $1 AND so.organization_id = $2`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404)
    }

    return c.json({ success: true, offer: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/settlements/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get offer' }, 500)
  } finally {
    await db.end()
  }
})

// ─── PATCH /:id ─── Update offer (counter-offer, notes) ───────────────────────
settlementRoutes.patch('/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')
    const body = await c.req.json<{
      counter_amount?: number
      payment_terms?: string
      valid_until?: string
      notes?: string
    }>()

    const existing = await db.query(
      `SELECT * FROM settlement_offers WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404)
    }
    const old = existing.rows[0]

    if (!['proposed', 'counter_offered'].includes(old.status)) {
      return c.json({ error: `Cannot modify offer in '${old.status}' status` }, 400)
    }

    const updates: string[] = ['updated_at = NOW()']
    const params: any[] = []
    let idx = 1

    if (body.counter_amount !== undefined && body.counter_amount > 0) {
      updates.push(`counter_amount = $${idx}`)
      params.push(body.counter_amount)
      idx++
      updates.push(`status = 'counter_offered'`)
    }
    if (body.payment_terms) {
      updates.push(`payment_terms = $${idx}`)
      params.push(body.payment_terms)
      idx++
    }
    if (body.valid_until) {
      updates.push(`valid_until = $${idx}`)
      params.push(body.valid_until)
      idx++
    }
    if (body.notes) {
      updates.push(`notes = $${idx}`)
      params.push(body.notes.trim())
      idx++
    }

    params.push(id, session.organization_id)
    const result = await db.query(
      `UPDATE settlement_offers SET ${updates.join(', ')}
       WHERE id = $${idx} AND organization_id = $${idx + 1}
       RETURNING *`,
      params
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.SETTLEMENT_OFFER_UPDATED,
      resourceType: 'settlement_offer',
      resourceId: id,
      oldValue: old,
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, offer: result.rows[0] })
  } catch (err: any) {
    logger.error('PATCH /api/settlements/:id error', { error: err.message })
    return c.json({ error: 'Failed to update offer' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /:id/approve ─── Supervisor approval ────────────────────────────────
settlementRoutes.post('/:id/approve', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'manager')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')

    const existing = await db.query(
      `SELECT * FROM settlement_offers WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404)
    }
    if (!existing.rows[0].requires_approval) {
      return c.json({ error: 'Offer does not require approval' }, 400)
    }

    const result = await db.query(
      `UPDATE settlement_offers
       SET approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [session.user_id, id, session.organization_id]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.SETTLEMENT_OFFER_APPROVED,
      resourceType: 'settlement_offer',
      resourceId: id,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, offer: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/settlements/:id/approve error', { error: err.message })
    return c.json({ error: 'Failed to approve offer' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /:id/accept ─── Consumer accepts ────────────────────────────────────
settlementRoutes.post('/:id/accept', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')

    const existing = await db.query(
      `SELECT * FROM settlement_offers WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404)
    }

    const offer = existing.rows[0]
    if (!['proposed', 'counter_offered'].includes(offer.status)) {
      return c.json({ error: `Cannot accept offer in '${offer.status}' status` }, 400)
    }
    if (offer.requires_approval && !offer.approved_at) {
      return c.json({ error: 'Offer requires supervisor approval before acceptance' }, 400)
    }

    // Check expiry
    if (offer.valid_until && new Date(offer.valid_until) < new Date()) {
      await db.query(
        `UPDATE settlement_offers SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [id]
      )
      return c.json({ error: 'Offer has expired' }, 400)
    }

    const acceptedAmount = offer.counter_amount || offer.proposed_amount

    const result = await db.query(
      `UPDATE settlement_offers
       SET status = 'accepted', accepted_amount = $1, accepted_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [acceptedAmount, id, session.organization_id]
    )

    // Update account balance to accepted settlement amount
    try {
      await db.query(
        `UPDATE collection_accounts SET current_balance = $1, status = 'partial', updated_at = NOW()
         WHERE id = $2 AND organization_id = $3`,
        [acceptedAmount, offer.account_id, session.organization_id]
      )
    } catch { /* best-effort */ }

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.SETTLEMENT_OFFER_ACCEPTED,
      resourceType: 'settlement_offer',
      resourceId: id,
      oldValue: offer,
      newValue: result.rows[0],
    }).catch(() => {})

    logger.info('Settlement accepted', {
      offerId: id,
      accountId: offer.account_id,
      originalBalance: offer.original_balance,
      acceptedAmount,
    })

    return c.json({ success: true, offer: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/settlements/:id/accept error', { error: err.message })
    return c.json({ error: 'Failed to accept offer' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /:id/reject ─── Consumer rejects ────────────────────────────────────
settlementRoutes.post('/:id/reject', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }))

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')

    const existing = await db.query(
      `SELECT * FROM settlement_offers WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404)
    }

    const result = await db.query(
      `UPDATE settlement_offers
       SET status = 'rejected', rejected_at = NOW(), rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [body.reason || null, id, session.organization_id]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.SETTLEMENT_OFFER_REJECTED,
      resourceType: 'settlement_offer',
      resourceId: id,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, offer: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/settlements/:id/reject error', { error: err.message })
    return c.json({ error: 'Failed to reject offer' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /account/:id ─── All offers for an account ───────────────────────────
settlementRoutes.get('/account/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const accountId = c.req.param('id')

    const result = await db.query(
      `SELECT so.*, u.name as proposed_by_name
       FROM settlement_offers so
       LEFT JOIN users u ON so.proposed_by::uuid = u.id
       WHERE so.account_id = $1 AND so.organization_id = $2
       ORDER BY so.created_at DESC`,
      [accountId, session.organization_id]
    )

    return c.json({
      success: true,
      offers: result.rows,
      total: result.rows.length,
    })
  } catch (err: any) {
    logger.error('GET /api/settlements/account/:id error', { error: err?.message })
    return c.json({ success: true, offers: [], total: 0 })
  } finally {
    await db.end()
  }
})
