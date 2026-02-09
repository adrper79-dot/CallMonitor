/**
 * Compliance Routes - Compliance violation logging and management
 *
 * Endpoints:
 *   POST /violations         - Log a compliance violation (fire-and-forget from frontend)
 *   GET  /violations         - List violations for organization
 *   GET  /violations/:id     - Get single violation
 *   PATCH /violations/:id    - Update violation resolution status
 *
 * @see ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md
 * @see lib/compliance/complianceUtils.ts (frontend caller)
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { LogComplianceViolationSchema, ResolveComplianceViolationSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { complianceRateLimit } from '../lib/rate-limit'

export const complianceRoutes = new Hono<AppEnv>()

// POST /violations — Log a compliance violation
// Called by frontend's logComplianceViolation() in complianceUtils.ts
complianceRoutes.post('/violations', complianceRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, LogComplianceViolationSchema)
    if (!parsed.success) return parsed.response
    const { call_id, restriction_code, violation_type, context } = parsed.data

    const result = await db.query(
      `INSERT INTO compliance_violations
        (organization_id, call_id, user_id, restriction_code, violation_type, violation_context)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, restriction_code, violation_type, created_at`,
      [
        session.organization_id,
        call_id || null,
        session.user_id,
        restriction_code,
        violation_type,
        context ? JSON.stringify(context) : null,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'compliance_violations',
      resourceId: result.rows[0].id,
      action: AuditAction.COMPLIANCE_VIOLATION_LOGGED,
      newValue: result.rows[0],
    })

    return c.json(
      {
        success: true,
        violation: result.rows[0],
      },
      201
    )
  } catch (err: any) {
    logger.error('POST /api/compliance/violations error', { error: err?.message })
    return c.json({ error: 'Failed to log violation' }, 500)
  } finally {
    await db.end()
  }
})

// GET /violations — List violations for organization
complianceRoutes.get('/violations', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    if (!session.organization_id) {
      return c.json({ success: true, violations: [], total: 0 })
    }

    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const offset = parseInt(c.req.query('offset') || '0')
    const status = c.req.query('status') // 'open' | 'reviewed' | 'dismissed' | 'confirmed'

    let query = `SELECT cv.*, u.email as user_email, u.name as user_name
      FROM compliance_violations cv
      LEFT JOIN users u ON cv.user_id = u.id
      WHERE cv.organization_id = $1`
    const params: any[] = [session.organization_id]

    if (status) {
      params.push(status)
      query += ` AND cv.resolution_status = $${params.length}`
    }

    query += ` ORDER BY cv.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = `SELECT COUNT(*)::int as total FROM compliance_violations WHERE organization_id = $1`
    const countParams: any[] = [session.organization_id]
    if (status) {
      countParams.push(status)
      countQuery += ` AND resolution_status = $${countParams.length}`
    }
    const countResult = await db.query(countQuery, countParams)

    return c.json({
      success: true,
      violations: result.rows,
      total: countResult.rows[0]?.total || 0,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/compliance/violations error', { error: err?.message })
    // Return empty on error (table may not exist yet)
    return c.json({ success: true, violations: [], total: 0 })
  } finally {
    await db.end()
  }
})

// GET /violations/:id — Get single violation
complianceRoutes.get('/violations/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const violationId = c.req.param('id')

    const result = await db.query(
      `SELECT cv.*, u.email as user_email, u.name as user_name,
              r.email as resolver_email, r.name as resolver_name
      FROM compliance_violations cv
      LEFT JOIN users u ON cv.user_id = u.id
      LEFT JOIN users r ON cv.resolved_by = r.id
      WHERE cv.id = $1 AND cv.organization_id = $2`,
      [violationId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Violation not found' }, 404)
    }

    return c.json({ success: true, violation: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/compliance/violations/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get violation' }, 500)
  } finally {
    await db.end()
  }
})

// PATCH /violations/:id — Update violation resolution
complianceRoutes.patch('/violations/:id', complianceRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const violationId = c.req.param('id')
    const parsed = await validateBody(c, ResolveComplianceViolationSchema)
    if (!parsed.success) return parsed.response
    const { resolution_status, resolution_notes } = parsed.data

    const result = await db.query(
      `UPDATE compliance_violations
      SET resolution_status = $1,
          resolution_notes = $2,
          resolved_by = $3,
          resolved_at = NOW()
      WHERE id = $4 AND organization_id = $5
      RETURNING *`,
      [
        resolution_status,
        resolution_notes || null,
        session.user_id,
        violationId,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Violation not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'compliance_violations',
      resourceId: result.rows[0].id,
      action: AuditAction.COMPLIANCE_VIOLATION_RESOLVED,
      newValue: result.rows[0],
    })

    return c.json({ success: true, violation: result.rows[0] })
  } catch (err: any) {
    logger.error('PATCH /api/compliance/violations/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update violation' }, 500)
  } finally {
    await db.end()
  }
})

