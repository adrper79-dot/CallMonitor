
/**
 * Scheduled Reports Cron Job
 * 
 * GET /api/cron/scheduled-reports
 * 
 * Purpose: Execute scheduled report generation
 * Triggered by: Vercel Cron (runs every hour)
 * 
 * Architecture:
 * - Queries scheduled_reports for due reports
 * - Generates reports using report generator
 * - Sends via email if configured
 * - Updates next_run_at timestamp
 * 
 * @module api/cron/scheduled-reports
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { generateCallVolumeReport, generateCampaignPerformanceReport } from '@/lib/reports/generator'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cron/scheduled-reports
 * Process scheduled reports
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('scheduled-reports cron: unauthorized access attempt')
      return ApiErrors.unauthorized()
    }

    logger.info('scheduled-reports cron: starting')

    const now = new Date().toISOString()

    // Get scheduled reports that are due
    // Join report_templates manually since we don't have supabase nested select
    const { rows: dueReports } = await query(
      `SELECT sr.*, 
              rt.id as rt_id, rt.name as rt_name, rt.report_type as rt_type,
              rt.filters as rt_filters, rt.metrics as rt_metrics, rt.dimensions as rt_dimensions
       FROM scheduled_reports sr
       LEFT JOIN report_templates rt ON sr.template_id = rt.id
       WHERE sr.is_active = true 
         AND sr.next_run_at <= $1
       ORDER BY sr.next_run_at ASC`,
      [now]
    )

    if (!dueReports || dueReports.length === 0) {
      logger.info('scheduled-reports cron: no due reports')
      return NextResponse.json({
        success: true,
        message: 'No reports due',
        processed: 0
      })
    }

    logger.info('scheduled-reports cron: processing reports', { count: dueReports.length })

    let processed = 0
    let failed = 0

    // Process each due report
    for (const row of dueReports) {
      // Reconstruct object structure for helper
      const scheduledReport = {
        ...row,
        report_templates: {
          id: row.rt_id,
          name: row.rt_name,
          report_type: row.rt_type,
          filters: row.rt_filters,
          metrics: row.rt_metrics,
          dimensions: row.rt_dimensions
        }
      }

      try {
        await processScheduledReport(scheduledReport)
        processed++
      } catch (error: any) {
        logger.error('scheduled-reports cron: failed to process report', error, {
          scheduledReportId: row.id,
        })
        failed++
      }
    }

    logger.info('scheduled-reports cron: completed', { processed, failed })

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: dueReports.length
    })
  } catch (error: any) {
    logger.error('scheduled-reports cron: unexpected error', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}

/**
 * Process a single scheduled report
 */
async function processScheduledReport(scheduledReport: any): Promise<void> {
  const { id, organization_id, template_id, report_templates, delivery_config, schedule_pattern } = scheduledReport

  logger.info('processScheduledReport: starting', { scheduledReportId: id })

  try {
    // Get date range based on frequency
    const { start_date, end_date } = getDateRangeForScheduledReport(scheduledReport)

    // Generate report based on type
    let reportData: any
    let reportType = report_templates.report_type

    // Create filters from date range
    const filters = {
      date_range: {
        start: start_date,
        end: end_date
      }
    }

    if (reportType === 'call_volume') {
      reportData = await generateCallVolumeReport(organization_id, filters, [])
    } else if (reportType === 'campaign_performance') {
      reportData = await generateCampaignPerformanceReport(organization_id, filters)
    } else {
      throw new Error(`Unsupported report type: ${reportType}`)
    }

    // Create generated report record
    // Note: generated_reports schema requires 'name' and 'parameters' fields
    const { rows: reportRows } = await query(
      `INSERT INTO generated_reports (
         organization_id, template_id, name, report_data, parameters, 
         file_format, status, generated_by, generation_duration_ms, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        organization_id,
        template_id,
        `${report_templates.name} - ${start_date.split('T')[0]}`,
        JSON.stringify(reportData),
        JSON.stringify({ date_range: { start: start_date, end: end_date } }),
        'json',
        'completed',
        scheduledReport.created_by,
        0
      ]
    )

    const generatedReport = reportRows[0]

    logger.info('processScheduledReport: report generated', {
      reportId: generatedReport.id
    })

    // Send email if configured
    if (delivery_config?.email_to) {
      await sendReportEmail(generatedReport, delivery_config.email_to, report_templates.name)
    }

    // Calculate next run time based on cron pattern
    const nextRun = calculateNextRun(schedule_pattern)

    // Update scheduled report
    await query(
      `UPDATE scheduled_reports 
       SET last_run_at = NOW(), next_run_at = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextRun, id]
    )

    logger.info('processScheduledReport: completed', {
      scheduledReportId: id,
      reportId: generatedReport.id,
      nextRun,
    })
  } catch (error: any) {
    logger.error('processScheduledReport: failed', error, { scheduledReportId: id })

    // Update with error timestamp only (last_error column doesn't exist in schema)
    // Calculate next run even on failure to prevent infinite retry loops
    const nextRun = calculateNextRun(schedule_pattern)

    await query(
      `UPDATE scheduled_reports 
       SET last_run_at = NOW(), next_run_at = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextRun, id]
    )

    throw error
  }
}

/**
 * Get date range for scheduled report based on frequency
 */
function getDateRangeForScheduledReport(scheduledReport: any): { start_date: string, end_date: string } {
  const now = new Date()
  const endDate = now.toISOString()
  let startDate: Date

  // Parse cron pattern to determine frequency
  // Simple detection: daily, weekly, monthly
  const pattern = scheduledReport.schedule_pattern || ''

  if (pattern.includes('0 0 * * *')) {
    // Daily - last 24 hours
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  } else if (pattern.includes('0 0 * * 0')) {
    // Weekly - last 7 days
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (pattern.includes('0 0 1 * *')) {
    // Monthly - last 30 days
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  } else {
    // Default to last 24 hours
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }

  return {
    start_date: startDate.toISOString(),
    end_date: endDate,
  }
}

/**
 * Calculate next run time based on cron pattern
 */
function calculateNextRun(cronPattern: string): string {
  // Simple implementation - runs hourly by default
  // In production, use a cron parser library like 'cron-parser'

  const now = new Date()

  // Parse basic patterns
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

/**
 * Send report via email
 */
async function sendReportEmail(report: any, emailTo: string, reportName: string): Promise<void> {
  try {
    // Use Resend email service
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      logger.warn('sendReportEmail: RESEND_API_KEY not configured')
      return
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    const reportUrl = `${appUrl}/reports?id=${report.id}`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'reports@wordisbond.app',
        to: emailTo,
        subject: `Scheduled Report: ${reportName}`,
        html: `
          <h2>Your Scheduled Report is Ready</h2>
          <p><strong>Report:</strong> ${reportName}</p>
          <p><strong>Generated:</strong> ${new Date(report.created_at).toLocaleString()}</p>
          <p><strong>Date Range:</strong> ${new Date(JSON.parse(report.parameters).date_range.start).toLocaleDateString()} - ${new Date(JSON.parse(report.parameters).date_range.end).toLocaleDateString()}</p>
          
          <p><a href="${reportUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Report</a></p>
          
          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            This is an automated email from your scheduled report. You can manage your scheduled reports in the Reports section.
          </p>
        `,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Email send failed: ${JSON.stringify(error)}`)
    }

    logger.info('sendReportEmail: sent', { reportId: report.id, emailTo })
  } catch (error: any) {
    logger.error('sendReportEmail: failed', error, { reportId: report.id })
    throw error
  }
}
