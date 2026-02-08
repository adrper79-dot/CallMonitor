/**
 * Retention Routes - Data retention policies and legal holds
 *
 * Endpoints:
 *   GET  /              - Get retention policy
 *   PUT  /              - Update retention policy
 *   GET  /legal-holds   - List legal holds
 *   POST /legal-holds   - Create legal hold
 *   DELETE /legal-holds/:id - Release (delete) legal hold
 *
 * P2-2: Uses centralized getDb() — no inline neon imports
 * H1: Zod-validated request bodies via validateBody()
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { UpdateRetentionSchema, CreateLegalHoldSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const retentionRoutes = new Hono<AppEnv>()

// GET / — Get retention policy
retentionRoutes.get('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const result = await db.query(
      `SELECT * FROM retention_policies
       WHERE organization_id = $1
       LIMIT 1`,
      [session.organization_id]
    )

    const policy = result.rows[0] || {
      recording_retention_days: 365,
      transcript_retention_days: 365,
      call_log_retention_days: 730,
      auto_delete_enabled: false,
      gdpr_mode: false,
    }

    return c.json({ success: true, policy })
  } catch (err: any) {
    logger.error('GET /api/retention error', { error: err?.message })
    return c.json({ error: 'Failed to get retention policy' }, 500)
  } finally {
    await db.end()
  }
})

// PUT / — Update retention policy
retentionRoutes.put('/', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, UpdateRetentionSchema)
    if (!parsed.success) return parsed.response
    const {
      recording_retention_days,
      transcript_retention_days,
      call_log_retention_days,
      auto_delete_enabled,
      gdpr_mode,
    } = parsed.data

    const result = await db.query(
      `INSERT INTO retention_policies (
         organization_id, recording_retention_days, transcript_retention_days,
         call_log_retention_days, auto_delete_enabled, gdpr_mode
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id)
       DO UPDATE SET
         recording_retention_days = EXCLUDED.recording_retention_days,
         transcript_retention_days = EXCLUDED.transcript_retention_days,
         call_log_retention_days = EXCLUDED.call_log_retention_days,
         auto_delete_enabled = EXCLUDED.auto_delete_enabled,
         gdpr_mode = EXCLUDED.gdpr_mode,
         updated_at = NOW()
       RETURNING *`,
      [
        session.organization_id,
        recording_retention_days ?? 365,
        transcript_retention_days ?? 365,
        call_log_retention_days ?? 730,
        auto_delete_enabled ?? false,
        gdpr_mode ?? false,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'retention_policies',
      resourceId: result.rows[0].id,
      action: AuditAction.RETENTION_POLICY_UPDATED,
      before: null,
      after: result.rows[0],
    })

    return c.json({ success: true, policy: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/retention error', { error: err?.message })
    return c.json({ error: 'Failed to update retention policy' }, 500)
  } finally {
    await db.end()
  }
})

// GET /legal-holds — List legal holds
retentionRoutes.get('/legal-holds', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const result = await db.query(
      `SELECT * FROM legal_holds
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, legalHolds: result.rows })
  } catch (err: any) {
    logger.error('GET /api/retention/legal-holds error', { error: err?.message })
    return c.json({ error: 'Failed to list legal holds' }, 500)
  } finally {
    await db.end()
  }
})

// POST /legal-holds — Create legal hold
retentionRoutes.post('/legal-holds', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, CreateLegalHoldSchema)
    if (!parsed.success) return parsed.response
    const { name, matter_reference, applies_to_all } = parsed.data

    const result = await db.query(
      `INSERT INTO legal_holds (organization_id, name, matter_reference, applies_to_all, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        session.organization_id,
        name,
        matter_reference || null,
        applies_to_all ?? false,
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'legal_holds',
      resourceId: result.rows[0].id,
      action: AuditAction.LEGAL_HOLD_CREATED,
      before: null,
      after: result.rows[0],
    })

    return c.json({ success: true, legalHold: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/retention/legal-holds error', { error: err?.message })
    return c.json({ error: 'Failed to create legal hold' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /legal-holds/:id — Release legal hold
retentionRoutes.delete('/legal-holds/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const holdId = c.req.param('id')

    const result = await db.query(
      `UPDATE legal_holds
       SET status = 'released', released_at = NOW()
       WHERE id = $1::uuid AND organization_id = $2
       RETURNING id`,
      [holdId, session.organization_id]
    )

    if (result.rows.length === 0) return c.json({ error: 'Legal hold not found' }, 404)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'legal_holds',
      resourceId: holdId,
      action: AuditAction.LEGAL_HOLD_RELEASED,
      before: { id: holdId },
      after: null,
    })

    return c.json({ success: true, message: 'Legal hold released' })
  } catch (err: any) {
    logger.error('DELETE /api/retention/legal-holds/:id error', { error: err?.message })
    return c.json({ error: 'Failed to release legal hold' }, 500)
  } finally {
    await db.end()
  }
})
