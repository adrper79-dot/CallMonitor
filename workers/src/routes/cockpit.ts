/**
 * Cockpit Quick-Action Routes
 *
 * Top-level endpoints consumed by the Cockpit UI's QuickActionModals.
 * These are thin wrappers that insert into the collection_notes,
 * collection_callbacks, and collection_disputes tables.
 *
 * Endpoints:
 *   POST /notes      - Add a note to a collection account
 *   POST /callbacks   - Schedule a callback
 *   POST /disputes    - File a dispute
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const cockpitRoutes = new Hono<AppEnv>()

// ─── POST /notes ─────────────────────────────────────────────────────────────
// Body: { account_id, call_id?, content }
cockpitRoutes.post('/notes', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    account_id: string
    call_id?: string | null
    content: string
  }>()

  if (!body.account_id || !body.content?.trim()) {
    return c.json({ error: 'account_id and content are required' }, 400)
  }

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `INSERT INTO collection_notes (organization_id, account_id, call_id, content, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        session.organization_id,
        body.account_id,
        body.call_id || null,
        body.content.trim(),
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.COLLECTION_NOTE_CREATED,
      resourceType: 'collection_note',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {})

    logger.info('Collection note created', {
      noteId: result.rows[0].id,
      accountId: body.account_id,
      userId: session.user_id,
    })

    return c.json({ success: true, note: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('Failed to create collection note', { error: err.message })
    return c.json({ error: 'Failed to save note' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /callbacks ─────────────────────────────────────────────────────────
// Body: { account_id, scheduled_for, notes? }
cockpitRoutes.post('/callbacks', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    account_id: string
    scheduled_for: string
    notes?: string | null
  }>()

  if (!body.account_id || !body.scheduled_for) {
    return c.json({ error: 'account_id and scheduled_for are required' }, 400)
  }

  const scheduledDate = new Date(body.scheduled_for)
  if (isNaN(scheduledDate.getTime())) {
    return c.json({ error: 'Invalid scheduled_for date' }, 400)
  }

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `INSERT INTO collection_callbacks (organization_id, account_id, scheduled_for, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        session.organization_id,
        body.account_id,
        scheduledDate.toISOString(),
        body.notes?.trim() || null,
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.COLLECTION_CALLBACK_SCHEDULED,
      resourceType: 'collection_callback',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {})

    logger.info('Callback scheduled', {
      callbackId: result.rows[0].id,
      accountId: body.account_id,
      scheduledFor: body.scheduled_for,
      userId: session.user_id,
    })

    return c.json({ success: true, callback: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('Failed to schedule callback', { error: err.message })
    return c.json({ error: 'Failed to schedule callback' }, 500)
  } finally {
    await db.end()
  }
})

// ─── POST /disputes ──────────────────────────────────────────────────────────
// Body: { account_id, call_id?, type, reason }
// FDCPA §809(b): Filing a dispute triggers:
//   1. Account status → 'disputed'
//   2. Legal hold created (blocks all collection activity)
//   3. 30-day validation period starts
//   4. Compliance event logged
cockpitRoutes.post('/disputes', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{
    account_id: string
    call_id?: string | null
    type: 'billing' | 'identity' | 'amount' | 'other'
    reason: string
  }>()

  const validTypes = ['billing', 'identity', 'amount', 'other']
  if (!body.account_id || !body.reason?.trim() || !validTypes.includes(body.type)) {
    return c.json({ error: 'account_id, type (billing|identity|amount|other), and reason are required' }, 400)
  }

  const db = getDb(c.env, session.organization_id)
  try {
    // 1. Insert the dispute record
    const validationDueDate = new Date()
    validationDueDate.setDate(validationDueDate.getDate() + 30) // FDCPA 30-day validation period

    const result = await db.query(
      `INSERT INTO collection_disputes (organization_id, account_id, call_id, type, reason, created_by, validation_due_date, auto_hold_applied)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [
        session.organization_id,
        body.account_id,
        body.call_id || null,
        body.type,
        body.reason.trim(),
        session.user_id,
        validationDueDate.toISOString(),
      ]
    )

    const dispute = result.rows[0]

    // 2. Set account status to 'disputed' — stops all collection activity
    await db.query(
      `UPDATE collection_accounts SET status = 'disputed', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [body.account_id, session.organization_id]
    )

    // 3. Create a legal hold on the account (blocks pre-dial, dialer, sequences)
    let legalHoldId: string | null = null
    try {
      const holdResult = await db.query(
        `INSERT INTO legal_holds (id, organization_id, account_id, hold_name, matter_reference, description, status, effective_from, effective_until, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'active', NOW(), $6, $7)
         RETURNING id`,
        [
          session.organization_id,
          body.account_id,
          `Dispute Hold — ${body.type}`,
          `DISPUTE-${dispute.id.substring(0, 8).toUpperCase()}`,
          `Auto-hold: ${body.type} dispute filed. Reason: ${body.reason.trim().substring(0, 200)}`,
          validationDueDate.toISOString(),
          session.user_id,
        ]
      )
      legalHoldId = holdResult.rows[0]?.id || null

      // Link the legal hold back to the dispute
      if (legalHoldId) {
        await db.query(
          `UPDATE collection_disputes SET legal_hold_id = $1 WHERE id = $2`,
          [legalHoldId, dispute.id]
        )
      }
    } catch (holdErr: any) {
      // Legal hold creation is best-effort — dispute still filed
      logger.warn('Failed to create auto legal hold for dispute', {
        disputeId: dispute.id,
        error: holdErr.message,
      })
    }

    // 4. Log compliance event
    try {
      await db.query(
        `INSERT INTO compliance_events (organization_id, event_type, event_data, created_at)
         VALUES ($1, 'dispute_filed', $2, NOW())`,
        [
          session.organization_id,
          JSON.stringify({
            dispute_id: dispute.id,
            account_id: body.account_id,
            type: body.type,
            legal_hold_id: legalHoldId,
            validation_due_date: validationDueDate.toISOString(),
            auto_hold_applied: true,
          }),
        ]
      )
    } catch {
      // compliance_events table may not exist yet — non-blocking
    }

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.COLLECTION_DISPUTE_FILED,
      resourceType: 'collection_dispute',
      resourceId: dispute.id,
      oldValue: null,
      newValue: { ...dispute, legal_hold_id: legalHoldId, auto_hold_applied: true },
    }).catch(() => {})

    logger.info('Dispute filed with auto-pause', {
      disputeId: dispute.id,
      accountId: body.account_id,
      type: body.type,
      legalHoldId,
      validationDueDate: validationDueDate.toISOString(),
      userId: session.user_id,
    })

    return c.json({
      success: true,
      dispute: { ...dispute, legal_hold_id: legalHoldId },
      auto_hold_applied: true,
      validation_due_date: validationDueDate.toISOString(),
    }, 201)
  } catch (err: any) {
    logger.error('Failed to file dispute', { error: err.message })
    return c.json({ error: 'Failed to file dispute' }, 500)
  } finally {
    await db.end()
  }
})
