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
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { GenerateReportSchema, ScheduleReportSchema, UpdateScheduleSchema } from '../lib/schemas'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { requirePlan } from '../lib/plan-gating'

export const reportsRoutes = new Hono<{ Bindings: Env }>()

// GET / — List reports
reportsRoutes.get('/', requirePlan('business'), async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const db = getDb(c.env)
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    await db.query(
      `CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'call_volume',
        status TEXT NOT NULL DEFAULT 'pending',
        filters JSONB DEFAULT '{}',
        metrics JSONB DEFAULT '[]',
        format TEXT DEFAULT 'pdf',
        result_url TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`
    )

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
  }
})

// POST / — Generate a new report
reportsRoutes.post('/', requirePlan('business'), async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, GenerateReportSchema)
    if (!parsed.success) return parsed.response
    const { name, type, filters, metrics, format } = parsed.data

    const db = getDb(c.env)

    await db.query(
      `CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'call_volume',
        status TEXT NOT NULL DEFAULT 'pending',
        filters JSONB DEFAULT '{}',
        metrics JSONB DEFAULT '[]',
        format TEXT DEFAULT 'pdf',
        result_url TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`
    )

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

    return c.json({ success: true, report: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/reports error', { error: err?.message })
    return c.json({ error: 'Failed to generate report' }, 500)
  }
})

// GET /:id/export — Export/download report
reportsRoutes.get('/:id/export', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const reportId = c.req.param('id')
    const db = getDb(c.env)

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
  }
})

// GET /schedules — List report schedules
reportsRoutes.get('/schedules', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const db = getDb(c.env)

    await db.query(
      `CREATE TABLE IF NOT EXISTS report_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        report_type TEXT NOT NULL DEFAULT 'call_volume',
        cron_pattern TEXT NOT NULL DEFAULT '0 8 * * 1',
        is_active BOOLEAN DEFAULT true,
        delivery_emails TEXT[],
        filters JSONB DEFAULT '{}',
        format TEXT DEFAULT 'pdf',
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    )

    const rowsResult = await db.query(
      `SELECT * FROM report_schedules
      WHERE organization_id = $1
      ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, schedules: rowsResult.rows })
  } catch (err: any) {
    logger.error('GET /api/reports/schedules error', { error: err?.message })
    return c.json({ error: 'Failed to list schedules' }, 500)
  }
})

// POST /schedules — Create report schedule
reportsRoutes.post('/schedules', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, ScheduleReportSchema)
    if (!parsed.success) return parsed.response
    const { name, report_type, cron_pattern, delivery_emails, filters, format } = parsed.data

    const db = getDb(c.env)

    await db.query(
      `CREATE TABLE IF NOT EXISTS report_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        report_type TEXT NOT NULL DEFAULT 'call_volume',
        cron_pattern TEXT NOT NULL DEFAULT '0 8 * * 1',
        is_active BOOLEAN DEFAULT true,
        delivery_emails TEXT[],
        filters JSONB DEFAULT '{}',
        format TEXT DEFAULT 'pdf',
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    )

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

    return c.json({ success: true, schedule: result.rows[0] })
  } catch (err: any) {
    logger.error('POST /api/reports/schedules error', { error: err?.message })
    return c.json({ error: 'Failed to create schedule' }, 500)
  }
})

// PATCH /schedules/:id — Update report schedule (toggle active, etc.)
reportsRoutes.patch('/schedules/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const scheduleId = c.req.param('id')
    const parsed = await validateBody(c, UpdateScheduleSchema)
    if (!parsed.success) return parsed.response
    const { is_active, name, cron_pattern, delivery_emails } = parsed.data

    const db = getDb(c.env)

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

    return c.json({ success: true, schedule: result.rows[0] })
  } catch (err: any) {
    logger.error('PATCH /api/reports/schedules/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update schedule' }, 500)
  }
})

// DELETE /schedules/:id — Delete report schedule
reportsRoutes.delete('/schedules/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const scheduleId = c.req.param('id')
    const db = getDb(c.env)

    const result = await db.query(
      `DELETE FROM report_schedules
      WHERE id = $1::uuid AND organization_id = $2
      RETURNING id`,
      [scheduleId, session.organization_id]
    )

    if (result.rows.length === 0) return c.json({ error: 'Schedule not found' }, 404)

    return c.json({ success: true, message: 'Schedule deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/reports/schedules/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete schedule' }, 500)
  }
})
