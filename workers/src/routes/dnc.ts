/**
 * DNC (Do Not Call) Routes - DNC list management
 *
 * Endpoints:
 *   GET    /     - List DNC entries for organization
 *   POST   /     - Add a phone number to DNC list
 *   DELETE /:id  - Remove a DNC entry
 *
 * Table: dnc_lists
 * @see migrations/2026-02-11-compliance-and-payment-gaps.sql
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { complianceRateLimit } from '../lib/rate-limit'

export const dncRoutes = new Hono<AppEnv>()

// ─── GET / — List DNC entries ──────────────────────────────────────────────
dncRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const offset = parseInt(c.req.query('offset') || '0', 10)
    const search = c.req.query('search')

    let query = `SELECT * FROM dnc_lists WHERE organization_id = $1`
    const params: any[] = [session.organization_id]

    if (search) {
      params.push(`%${search}%`)
      query += ` AND (phone_number LIKE $${params.length} OR reason ILIKE $${params.length})`
    }

    query += ` ORDER BY added_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = `SELECT COUNT(*)::int AS total FROM dnc_lists WHERE organization_id = $1`
    const countParams: any[] = [session.organization_id]
    if (search) {
      countParams.push(`%${search}%`)
      countQuery += ` AND (phone_number LIKE $${countParams.length} OR reason ILIKE $${countParams.length})`
    }
    const countResult = await db.query(countQuery, countParams)

    return c.json({
      success: true,
      entries: result.rows,
      total: countResult.rows[0]?.total || 0,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/dnc error', { error: err?.message })
    // Graceful degradation — table may not exist
    return c.json({ success: true, entries: [], total: 0 })
  } finally {
    await db.end()
  }
})

// ─── POST / — Add phone to DNC list ───────────────────────────────────────
dncRoutes.post('/', complianceRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const body = await c.req.json()
    const { phone_number, reason, source } = body

    if (!phone_number) {
      return c.json({ error: 'phone_number is required' }, 400)
    }

    // Upsert — ON CONFLICT do nothing (already on DNC)
    const result = await db.query(
      `INSERT INTO dnc_lists (organization_id, phone_number, reason, source, added_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (organization_id, phone_number) DO NOTHING
       RETURNING *`,
      [
        session.organization_id,
        phone_number.trim(),
        reason || null,
        source || 'manual',
        session.user_id,
      ]
    )

    if (result.rows.length === 0) {
      return c.json({ success: true, message: 'Phone number already on DNC list' })
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'dnc_lists',
      resourceId: result.rows[0].id,
      action: AuditAction.DNC_ENTRY_CREATED,
      newValue: result.rows[0],
    })

    return c.json({ success: true, entry: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/dnc error', { error: err?.message })
    return c.json({ error: 'Failed to add DNC entry' }, 500)
  } finally {
    await db.end()
  }
})

// ─── DELETE /:id — Remove from DNC list ────────────────────────────────────
dncRoutes.delete('/:id', complianceRateLimit, async (c) => {
  const session = await requireRole(c, 'compliance')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const entryId = c.req.param('id')

    // Fetch before delete for audit
    const existing = await db.query(
      `SELECT * FROM dnc_lists WHERE id = $1 AND organization_id = $2`,
      [entryId, session.organization_id]
    )

    if (existing.rows.length === 0) {
      return c.json({ error: 'DNC entry not found' }, 404)
    }

    await db.query(`DELETE FROM dnc_lists WHERE id = $1 AND organization_id = $2`, [
      entryId,
      session.organization_id,
    ])

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'dnc_lists',
      resourceId: entryId,
      action: AuditAction.DNC_ENTRY_DELETED,
      oldValue: existing.rows[0],
    })

    return c.json({ success: true, message: 'DNC entry removed' })
  } catch (err: any) {
    logger.error('DELETE /api/dnc/:id error', { error: err?.message })
    return c.json({ error: 'Failed to remove DNC entry' }, 500)
  } finally {
    await db.end()
  }
})
