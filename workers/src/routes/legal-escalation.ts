/**
 * Legal Escalation Routes
 *
 * Manages the lifecycle of accounts escalated to legal/litigation.
 * Implements FDCPA pre-litigation checklist and attorney referral tracking.
 *
 * Endpoints:
 *   GET    /               - List escalations for organization
 *   POST   /               - Create a new legal escalation
 *   GET    /:id            - Get single escalation with full details
 *   PATCH  /:id            - Update escalation (status, checklist, attorney info)
 *   PATCH  /:id/checklist  - Update checklist items
 *   POST   /:id/approve    - Approve escalation (supervisor/compliance)
 *   DELETE /:id            - Withdraw/cancel escalation
 *
 * @see ARCH_DOCS/08-COMPLIANCE/FDCPA_COMPLIANCE.md
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { collectionsRateLimit } from '../lib/rate-limit'

export const legalEscalationRoutes = new Hono<AppEnv>()

// ─── GET / ─── List legal escalations ─────────────────────────────────────────
legalEscalationRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const offset = parseInt(c.req.query('offset') || '0')
    const status = c.req.query('status')
    const priority = c.req.query('priority')

    let query = `
      SELECT le.*,
        ca.debtor_name, ca.account_number, ca.current_balance,
        u.name as escalated_by_name, u.email as escalated_by_email
      FROM legal_escalations le
      LEFT JOIN collection_accounts ca ON le.account_id = ca.id
      LEFT JOIN users u ON le.escalated_by::uuid = u.id
      WHERE le.organization_id = $1`
    const params: any[] = [session.organization_id]

    if (status) {
      params.push(status)
      query += ` AND le.status = $${params.length}`
    }
    if (priority) {
      params.push(priority)
      query += ` AND le.priority = $${params.length}`
    }

    query += ` ORDER BY
      CASE le.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
      le.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    const countResult = await db.query(
      `SELECT COUNT(*)::int as total FROM legal_escalations WHERE organization_id = $1${status ? ` AND status = '${status}'` : ''}`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      escalations: result.rows,
      total: countResult.rows[0]?.total || 0,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/legal-escalation error', { error: err?.message })
    return c.json({ success: true, escalations: [], total: 0 })
  } finally {
    await db.end()
  }
})

// ─── POST / ─── Create legal escalation ────────────────────────────────────────
legalEscalationRoutes.post('/', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    account_id: string
    reason: string
    priority?: string
    attorney_name?: string
    attorney_email?: string
    attorney_phone?: string
    law_firm?: string
    notes?: string
  }>()

  if (!body.account_id || !body.reason?.trim()) {
    return c.json({ error: 'account_id and reason are required' }, 400)
  }

  const validPriorities = ['low', 'normal', 'high', 'urgent']
  const priority = validPriorities.includes(body.priority || '') ? body.priority : 'normal'

  const db = getDb(c.env, session.organization_id)
  try {
    // Verify account exists and belongs to org
    const acctCheck = await db.query(
      `SELECT id, debtor_name, current_balance FROM collection_accounts WHERE id = $1 AND organization_id = $2`,
      [body.account_id, session.organization_id]
    )
    if (acctCheck.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Check for existing active escalation
    const existing = await db.query(
      `SELECT id FROM legal_escalations
       WHERE account_id = $1 AND organization_id = $2
         AND status NOT IN ('dismissed', 'settled', 'withdrawn')`,
      [body.account_id, session.organization_id]
    )
    if (existing.rows.length > 0) {
      return c.json({ error: 'Account already has an active legal escalation', existing_id: existing.rows[0].id }, 409)
    }

    const result = await db.query(
      `INSERT INTO legal_escalations (
        organization_id, account_id, reason, priority,
        attorney_name, attorney_email, attorney_phone, law_firm,
        notes, escalated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        session.organization_id,
        body.account_id,
        body.reason.trim(),
        priority,
        body.attorney_name || null,
        body.attorney_email || null,
        body.attorney_phone || null,
        body.law_firm || null,
        body.notes?.trim() || null,
        session.user_id,
      ]
    )

    const escalation = result.rows[0]

    // Create a legal hold on the account
    try {
      await db.query(
        `INSERT INTO legal_holds (id, organization_id, account_id, hold_name, matter_reference, description, status, effective_from, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'active', NOW(), $6)`,
        [
          session.organization_id,
          body.account_id,
          `Legal Escalation Hold`,
          `LEGAL-${escalation.id.substring(0, 8).toUpperCase()}`,
          `Legal escalation: ${body.reason.trim().substring(0, 200)}`,
          session.user_id,
        ]
      )
    } catch (holdErr: any) {
      logger.warn('Failed to create legal hold for escalation', { error: holdErr.message })
    }

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.LEGAL_ESCALATION_CREATED,
      resourceType: 'legal_escalation',
      resourceId: escalation.id,
      oldValue: null,
      newValue: escalation,
    }).catch(() => {})

    logger.info('Legal escalation created', {
      escalationId: escalation.id,
      accountId: body.account_id,
      priority,
      userId: session.user_id,
    })

    return c.json({ success: true, escalation }, 201)
  } catch (err: any) {
    logger.error('POST /api/legal-escalation error', { error: err.message })
    return c.json({ error: 'Failed to create legal escalation' }, 500)
  } finally {
    await db.end()
  }
})

// ─── GET /:id ─── Get escalation detail ────────────────────────────────────────
legalEscalationRoutes.get('/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')

    const result = await db.query(
      `SELECT le.*,
        ca.debtor_name, ca.account_number, ca.current_balance, ca.status as account_status,
        u.name as escalated_by_name, u.email as escalated_by_email,
        a.name as approved_by_name
      FROM legal_escalations le
      LEFT JOIN collection_accounts ca ON le.account_id = ca.id
      LEFT JOIN users u ON le.escalated_by::uuid = u.id
      LEFT JOIN users a ON le.approved_by::uuid = a.id
      WHERE le.id = $1 AND le.organization_id = $2`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Escalation not found' }, 404)
    }

    return c.json({ success: true, escalation: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/legal-escalation/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get escalation' }, 500)
  } finally {
    await db.end()
  }
})

// ─── PATCH /:id ─── Update escalation ──────────────────────────────────────────
legalEscalationRoutes.patch('/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    // Fetch existing
    const existing = await db.query(
      `SELECT * FROM legal_escalations WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Escalation not found' }, 404)
    }
    const old = existing.rows[0]

    // Build dynamic update
    const updates: string[] = ['updated_at = NOW()']
    const params: any[] = []
    let paramIdx = 1

    const allowedFields = [
      'status', 'priority', 'reason', 'attorney_name', 'attorney_email',
      'attorney_phone', 'law_firm', 'case_number', 'court_name',
      'filing_date', 'hearing_date', 'judgment_amount', 'notes', 'resolution',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx}`)
        params.push(body[field])
        paramIdx++
      }
    }

    // Handle resolution timestamps
    if (body.status === 'dismissed' || body.status === 'settled' || body.status === 'withdrawn') {
      updates.push(`resolved_at = NOW()`)
    }

    params.push(id, session.organization_id)
    const result = await db.query(
      `UPDATE legal_escalations SET ${updates.join(', ')}
       WHERE id = $${paramIdx} AND organization_id = $${paramIdx + 1}
       RETURNING *`,
      params
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.LEGAL_ESCALATION_UPDATED,
      resourceType: 'legal_escalation',
      resourceId: id,
      oldValue: old,
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, escalation: result.rows[0] })
  } catch (err: any) {
    logger.error('PATCH /api/legal-escalation/:id error', { error: err.message })
    return c.json({ error: 'Failed to update escalation' }, 500)
  } finally {
    await db.end()
  }
})

// ─── PATCH /:id/checklist ─── Update pre-litigation checklist ──────────────────
legalEscalationRoutes.patch('/:id/checklist', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'compliance')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const existing = await db.query(
      `SELECT * FROM legal_escalations WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Escalation not found' }, 404)
    }

    const updates: string[] = ['updated_at = NOW()']
    const params: any[] = []
    let paramIdx = 1

    const checklistFields = [
      'checklist_demand_letter_sent', 'checklist_demand_letter_date',
      'checklist_validation_completed', 'checklist_dispute_period_expired',
      'checklist_statute_of_limitations_checked', 'checklist_sol_expiry_date',
      'checklist_documentation_complete', 'checklist_compliance_review_passed',
      'checklist_supervisor_approved',
    ]

    for (const field of checklistFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx}`)
        params.push(body[field])
        paramIdx++
      }
    }

    // If supervisor approving, record who and when
    if (body.checklist_supervisor_approved === true) {
      updates.push(`checklist_supervisor_id = $${paramIdx}::uuid`)
      params.push(session.user_id)
      paramIdx++
      updates.push(`checklist_supervisor_approved_at = NOW()`)
    }

    params.push(id, session.organization_id)
    const result = await db.query(
      `UPDATE legal_escalations SET ${updates.join(', ')}
       WHERE id = $${paramIdx} AND organization_id = $${paramIdx + 1}
       RETURNING *`,
      params
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.LEGAL_ESCALATION_UPDATED,
      resourceType: 'legal_escalation',
      resourceId: id,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, escalation: result.rows[0] })
  } catch (err: any) {
    logger.error('PATCH /api/legal-escalation/:id/checklist error', { error: err.message })
    return c.json({ error: 'Failed to update checklist' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /:id/approve ─── Approve escalation (supervisor/compliance) ──────────
legalEscalationRoutes.post('/:id/approve', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'compliance')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')

    const existing = await db.query(
      `SELECT * FROM legal_escalations WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Escalation not found' }, 404)
    }

    if (existing.rows[0].status !== 'pending' && existing.rows[0].status !== 'review') {
      return c.json({ error: `Cannot approve escalation in '${existing.rows[0].status}' status` }, 400)
    }

    const result = await db.query(
      `UPDATE legal_escalations
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [session.user_id, id, session.organization_id]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.LEGAL_ESCALATION_APPROVED,
      resourceType: 'legal_escalation',
      resourceId: id,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    }).catch(() => {})

    logger.info('Legal escalation approved', {
      escalationId: id,
      approvedBy: session.user_id,
    })

    return c.json({ success: true, escalation: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/legal-escalation/:id/approve error', { error: err.message })
    return c.json({ error: 'Failed to approve escalation' }, 500)
  } finally {
    await db.end()
  }
})

// ─── DELETE /:id ─── Withdraw/cancel escalation ────────────────────────────────
legalEscalationRoutes.delete('/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'manager')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const id = c.req.param('id')

    const existing = await db.query(
      `SELECT * FROM legal_escalations WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Escalation not found' }, 404)
    }

    // Soft delete — mark as withdrawn
    const result = await db.query(
      `UPDATE legal_escalations
       SET status = 'withdrawn', resolved_at = NOW(), resolution = 'Withdrawn by manager', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [id, session.organization_id]
    )

    // Release associated legal hold
    try {
      await db.query(
        `UPDATE legal_holds
         SET status = 'released', released_at = NOW(), released_by = $1::uuid, release_reason = 'Legal escalation withdrawn'
         WHERE account_id = $2 AND organization_id = $3 AND status = 'active'
           AND matter_reference LIKE 'LEGAL-%'`,
        [session.user_id, existing.rows[0].account_id, session.organization_id]
      )
    } catch {
      // best-effort
    }

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.LEGAL_ESCALATION_WITHDRAWN,
      resourceType: 'legal_escalation',
      resourceId: id,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, escalation: result.rows[0] })
  } catch (err: any) {
    logger.error('DELETE /api/legal-escalation/:id error', { error: err.message })
    return c.json({ error: 'Failed to withdraw escalation' }, 500)
  } finally {
    await db.end()
  }
})
