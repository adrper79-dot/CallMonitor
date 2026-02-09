/**
 * Reports Routes - Report generation and scheduling
 *
 * Endpoints:
 *   GET  /                   - List reports
 *   POST /                   - Generate a report
 *   GET  /:id/export         - Export/download a report
 *   GET  /schedules          - List report schedules
 *   POST /schedules          - Create report schedule
 *   PATCH /schedules/:id     - Update report schedule
 *   DELETE /schedules/:id    - Delete report schedule
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, authMiddleware } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { GenerateReportSchema, ScheduleReportSchema, UpdateScheduleSchema } from '../lib/schemas'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { requirePlan } from '../lib/plan-gating'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { reportRateLimit } from '../lib/rate-limit'

export const reportsRoutes = new Hono<AppEnv>()

// GET / — List reports
reportsRoutes.get('/', authMiddleware, requirePlan('business'), async (c) => {
  const db = getDb(c.env)
  try {
    const session = c.get('session')
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 200)
    const offset = (page - 1) * limit

    const rowsResult = await db.query(
      `SELECT *, COUNT(*) OVER() as total_count
      FROM reports
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [session.organization_id, limit, offset]
    )

    const rows = rowsResult.rows
    const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0
    const reports = rows.map(({ total_count, ...r }: any) => r)

    return c.json({ success: true, reports, pagination: { page, limit, total } })
  } catch (err: any) {
    logger.error('GET /api/reports error', { error: err?.message })
    return c.json({ error: 'Failed to list reports' }, 500)
  } finally {
    await db.end()
  }
})

// POST / — Generate a new report
reportsRoutes.post('/', authMiddleware, requirePlan('business'), reportRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = c.get('session')
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, GenerateReportSchema)
    if (!parsed.success) return parsed.response
    const { name, type, filters, metrics, format } = parsed.data

    const result = await db.query(
      `INSERT INTO reports (organization_id, name, type, status, filters, metrics, format, created_by)
      VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7)
      RETURNING *`,
      [
        session.organization_id,
        name,
        type || 'call_volume',
        JSON.stringify(filters || {}),
        JSON.stringify(metrics || []),
        format || 'pdf',
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'reports',
      resourceId: result.rows[0].id,
      action: AuditAction.REPORT_CREATED,
      before: null,
      after: result.rows[0],
    })

    return c.json({ success: true, report: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/reports error', { error: err?.message })
    return c.json({ error: 'Failed to generate report' }, 500)
  } finally {
    await db.end()
  }
})

// GET /:id/export — Export/download report
reportsRoutes.get('/:id/export', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const reportId = c.req.param('id')

    const rowsResult = await db.query(
      `SELECT * FROM reports
      WHERE id = $1::uuid AND organization_id = $2
      LIMIT 1`,
      [reportId, session.organization_id]
    )

    if (rowsResult.rows.length === 0) return c.json({ error: 'Report not found' }, 404)

    const report = rowsResult.rows[0]

    // Generate basic export data from calls
    const callData = await db.query(
      `SELECT id, status, started_at, ended_at, created_at
      FROM calls
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 1000`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      report: { id: report.id, name: report.name, type: report.type },
      data: callData.rows,
      exported_at: new Date().toISOString(),
    })
  } catch (err: any) {
    logger.error('GET /api/reports/:id/export error', { error: err?.message })
    return c.json({ error: 'Failed to export report' }, 500)
  } finally {
    await db.end()
  }
})

// GET /schedules — List report schedules
reportsRoutes.get('/schedules', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = Math.min(parseInt(c.req.query('limit') || '25', 10), 200)
    const offset = (page - 1) * limit

    const rowsResult = await db.query(
      `SELECT *, COUNT(*) OVER() as total_count FROM report_schedules
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [session.organization_id, limit, offset]
    )

    const total = rowsResult.rows.length > 0 ? parseInt(rowsResult.rows[0].total_count) : 0
    const schedules = rowsResult.rows.map(({ total_count, ...s }: any) => s)

    return c.json({ success: true, schedules, pagination: { page, limit, total } })
  } catch (err: any) {
    logger.error('GET /api/reports/schedules error', { error: err?.message })
    return c.json({ error: 'Failed to list schedules' }, 500)
  } finally {
    await db.end()
  }
})

// POST /schedules — Create report schedule
reportsRoutes.post('/schedules', reportRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, ScheduleReportSchema)
    if (!parsed.success) return parsed.response
    const { name, report_type, cron_pattern, delivery_emails, filters, format } = parsed.data

    const result = await db.query(
      `INSERT INTO report_schedules (organization_id, name, report_type, cron_pattern, delivery_emails, filters, format, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        session.organization_id,
        name,
        report_type || 'call_volume',
        cron_pattern || '0 8 * * 1',
        delivery_emails || [],
        JSON.stringify(filters || {}),
        format || 'pdf',
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'report_schedules',
      resourceId: result.rows[0].id,
      action: AuditAction.REPORT_SCHEDULE_CREATED,
      before: null,
      after: result.rows[0],
    })

    return c.json({ success: true, schedule: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/reports/schedules error', { error: err?.message })
    return c.json({ error: 'Failed to create schedule' }, 500)
  } finally {
    await db.end()
  }
})

// PATCH /schedules/:id — Update report schedule (toggle active, etc.)
reportsRoutes.patch('/schedules/:id', reportRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const scheduleId = c.req.param('id')
    const parsed = await validateBody(c, UpdateScheduleSchema)
    if (!parsed.success) return parsed.response
    const { is_active, name, cron_pattern, delivery_emails } = parsed.data

    const result = await db.query(
      `UPDATE report_schedules
      SET
        is_active = COALESCE($1::boolean, is_active),
        name = COALESCE($2, name),
        cron_pattern = COALESCE($3, cron_pattern),
        updated_at = NOW()
      WHERE id = $4::uuid AND organization_id = $5
      RETURNING *`,
      [is_active ?? null, name || null, cron_pattern || null, scheduleId, session.organization_id]
    )

    if (result.rows.length === 0) return c.json({ error: 'Schedule not found' }, 404)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'report_schedules',
      resourceId: scheduleId,
      action: AuditAction.REPORT_SCHEDULE_UPDATED,
      before: null,
      after: result.rows[0],
    })

    return c.json({ success: true, schedule: result.rows[0] })
  } catch (err: any) {
    logger.error('PATCH /api/reports/schedules/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update schedule' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /schedules/:id — Delete report schedule
reportsRoutes.delete('/schedules/:id', reportRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const scheduleId = c.req.param('id')

    const result = await db.query(
      `DELETE FROM report_schedules
      WHERE id = $1::uuid AND organization_id = $2
      RETURNING id`,
      [scheduleId, session.organization_id]
    )

    if (result.rows.length === 0) return c.json({ error: 'Schedule not found' }, 404)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'report_schedules',
      resourceId: scheduleId,
      action: AuditAction.REPORT_SCHEDULE_DELETED,
      before: { id: scheduleId },
      after: null,
    })

    return c.json({ success: true, message: 'Schedule deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/reports/schedules/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete schedule' }, 500)
  } finally {
    await db.end()
  }
})
