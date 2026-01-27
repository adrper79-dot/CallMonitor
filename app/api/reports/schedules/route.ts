/**
 * Report Schedules API
 * 
 * GET /api/reports/schedules - List schedules
 * POST /api/reports/schedules - Create schedule
 * 
 * @module api/reports/schedules
 */

import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/rbac-server'
import { logger } from '@/lib/logger'
import { AppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/reports/schedules
 * List scheduled reports for organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole('viewer')
    const { id: userId, organizationId } = session.user

    // Get org from query - use session org if not provided
    const searchParams = req.nextUrl.searchParams
    const orgId = searchParams.get('orgId') || organizationId

    // Verify access - user can only access their own org
    if (orgId !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    const { data: schedules, error } = await supabaseAdmin
      .from('scheduled_reports')
      .select(`
        *,
        report_templates (
          id,
          name,
          report_type
        )
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new AppError('Failed to fetch schedules', 500, error.message)
    }

    return NextResponse.json({ schedules })
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
    const { id: userId, organizationId, role } = session.user

    const body = await req.json()
    const { templateId, cronPattern, deliveryConfig } = body

    if (!templateId || !cronPattern) {
      throw new AppError('Missing required fields', 400)
    }

    // Verify template exists and belongs to org
    const { data: template, error: templateError } = await supabaseAdmin
      .from('report_templates')
      .select('id, organization_id, name')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      throw new AppError('Template not found', 404)
    }

    if (template.organization_id !== organizationId) {
      throw new AppError('Unauthorized', 403)
    }

    // Calculate next run time
    const nextRun = calculateNextRun(cronPattern)

    // Create schedule
    const { data: schedule, error: insertError } = await supabaseAdmin
      .from('scheduled_reports')
      .insert({
        organization_id: organizationId,
        template_id: templateId,
        name: template.name || 'Scheduled Report', // Required field
        schedule_pattern: cronPattern, // Fixed: was cron_pattern
        delivery_config: deliveryConfig || {},
        is_active: true,
        next_run_at: nextRun, // Fixed: was next_run
        created_by: userId,
      })
      .select()
      .single()

    if (insertError) {
      throw new AppError('Failed to create schedule', 500, insertError.message)
    }

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

