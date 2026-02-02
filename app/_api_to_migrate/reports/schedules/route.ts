/**
 * Report Schedules API
 * 
 * GET /api/reports/schedules - List schedules
 * POST /api/reports/schedules - Create schedule
 * 
 * @module api/reports/schedules
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { AppError } from '@/types/app-error'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/reports/schedules
 * List scheduled reports for organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole('viewer')
    if (session instanceof NextResponse) return session
    const { organizationId } = session.user

    const searchParams = req.nextUrl.searchParams
    const orgIdArg = searchParams.get('orgId') || organizationId

    if (orgIdArg !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Fetch schedules with template info using JOIN
    const { rows: schedules } = await query(
      `SELECT sr.*,
              rt.id as template_id,
              rt.name as template_name,
              rt.report_type as template_report_type
       FROM scheduled_reports sr
       LEFT JOIN report_templates rt ON sr.template_id = rt.id
       WHERE sr.organization_id = $1
       ORDER BY sr.created_at DESC`,
      [organizationId]
    )

    // Map to expected structure
    const mappedSchedules = schedules.map((s: any) => ({
      ...s,
      report_templates: s.template_id ? {
        id: s.template_id,
        name: s.template_name,
        report_type: s.template_report_type
      } : null,
      // Cleanup flattened fields
      template_id: undefined, // Keep id as template_id is likely expected in root too? Supabase returns foreign table as nested object.
      // Actually sr.template_id is already in sr.*, so we keep it. Use alias for flattened ones.
      template_name: undefined,
      template_report_type: undefined
    }))

    return NextResponse.json({ schedules: mappedSchedules })
  } catch (error: any) {
    logger.error('GET /api/reports/schedules error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

/**
 * POST /api/reports/schedules
 * Create scheduled report
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(['owner', 'admin'])
    if (session instanceof NextResponse) return session
    const { id: userId, organizationId } = session.user

    const body = await req.json()
    const { templateId, cronPattern, deliveryConfig } = body

    if (!templateId || !cronPattern) {
      throw new AppError('Missing required fields', 400)
    }

    // Verify template exists and belongs to org
    const { rows: templates } = await query(
      `SELECT id, organization_id, name FROM report_templates WHERE id = $1`,
      [templateId]
    )

    if (templates.length === 0) {
      throw new AppError('Template not found', 404)
    }

    const template = templates[0]

    if (template.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Calculate next run time
    const nextRun = calculateNextRun(cronPattern)

    // Create schedule
    const scheduleId = uuidv4()
    const { rows: schedules } = await query(
      `INSERT INTO scheduled_reports (
         id, organization_id, template_id, name, schedule_pattern, delivery_config, 
         is_active, next_run_at, created_by, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        scheduleId,
        organizationId,
        templateId,
        template.name || 'Scheduled Report',
        cronPattern,
        JSON.stringify(deliveryConfig || {}),
        true,
        nextRun,
        userId
      ]
    )

    const schedule = schedules[0]

    logger.info('Scheduled report created', {
      scheduleId: schedule.id,
      templateId,
      userId,
      organizationId,
    })

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error: any) {
    logger.error('POST /api/reports/schedules error', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

/**
 * Calculate next run time based on cron pattern
 */
function calculateNextRun(cronPattern: string): string {
  const now = new Date()

  if (cronPattern.includes('0 0 * * *')) {
    // Daily at midnight
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow.toISOString()
  } else if (cronPattern.includes('0 0 * * 0')) {
    // Weekly on Sunday at midnight
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7
    const nextSunday = new Date(now)
    nextSunday.setDate(nextSunday.getDate() + daysUntilSunday)
    nextSunday.setHours(0, 0, 0, 0)
    return nextSunday.toISOString()
  } else if (cronPattern.includes('0 0 1 * *')) {
    // Monthly on 1st at midnight
    const nextMonth = new Date(now)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(1)
    nextMonth.setHours(0, 0, 0, 0)
    return nextMonth.toISOString()
  }

  // Default: next hour
  const nextHour = new Date(now)
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
  return nextHour.toISOString()
}
