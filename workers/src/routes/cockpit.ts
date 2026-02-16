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
    const result = await db.query(
      `INSERT INTO collection_disputes (organization_id, account_id, call_id, type, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        session.organization_id,
        body.account_id,
        body.call_id || null,
        body.type,
        body.reason.trim(),
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.COLLECTION_DISPUTE_FILED,
      resourceType: 'collection_dispute',
      resourceId: result.rows[0].id,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {})

    logger.info('Dispute filed', {
      disputeId: result.rows[0].id,
      accountId: body.account_id,
      type: body.type,
      userId: session.user_id,
    })

    return c.json({ success: true, dispute: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('Failed to file dispute', { error: err.message })
    return c.json({ error: 'Failed to file dispute' }, 500)
  } finally {
    await db.end()
  }
})
