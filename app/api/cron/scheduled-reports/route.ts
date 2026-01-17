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
 * - Updates next_run timestamp
 * 
 * @module api/cron/scheduled-reports
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { generateCallVolumeReport, generateCampaignPerformanceReport } from '@/lib/reports/generator'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('scheduled-reports cron: starting')

    const now = new Date().toISOString()

    // Get scheduled reports that are due
    const { data: dueReports, error: queryError } = await supabaseAdmin
      .from('scheduled_reports')
      .select(`
        *,
        report_templates (
          id,
          name,
          report_type,
          filters,
          metrics,
          dimensions
        )
      `)
      .eq('is_active', true)
      .lte('next_run', now)
      .order('next_run', { ascending: true })

    if (queryError) {
      logger.error('scheduled-reports cron: query error', queryError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

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
    for (const scheduledReport of dueReports) {
      try {
        await processScheduledReport(scheduledReport)
        processed++
      } catch (error: any) {
        logger.error('scheduled-reports cron: failed to process report', error, {
          scheduledReportId: scheduledReport.id,
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
  const { id, organization_id, template_id, report_templates, delivery_config, cron_pattern } = scheduledReport

  logger.info('processScheduledReport: starting', { scheduledReportId: id })

  try {
    // Get date range based on frequency
    const { start_date, end_date } = getDateRangeForScheduledReport(scheduledReport)

    // Generate report based on type
    let reportData: any
    let reportType = report_templates.report_type

    if (reportType === 'call_volume') {
      reportData = await generateCallVolumeReport(organization_id, start_date, end_date)
    } else if (reportType === 'campaign_performance') {
      reportData = await generateCampaignPerformanceReport(organization_id, start_date, end_date)
    } else {
      throw new Error(`Unsupported report type: ${reportType}`)
    }

    // Create generated report record
    const { data: generatedReport, error: insertError } = await supabaseAdmin
      .from('generated_reports')
      .insert({
        organization_id,
        template_id,
        report_type: reportType,
        report_data: reportData,
        date_range_start: start_date,
        date_range_end: end_date,
        file_format: 'json',
        status: 'completed',
        generated_by: null, // System generated
        generation_duration_ms: 0, // Not tracking for scheduled
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    logger.info('processScheduledReport: report generated', { 
      reportId: generatedReport.id 
    })

    // Send email if configured
    if (delivery_config?.email_to) {
      await sendReportEmail(generatedReport, delivery_config.email_to, report_templates.name)
    }

    // Calculate next run time based on cron pattern
    const nextRun = calculateNextRun(cron_pattern)

    // Update scheduled report
    await supabaseAdmin
      .from('scheduled_reports')
      .update({
        last_run: new Date().toISOString(),
        next_run: nextRun,
        last_report_id: generatedReport.id,
      })
      .eq('id', id)

    logger.info('processScheduledReport: completed', { 
      scheduledReportId: id,
      reportId: generatedReport.id,
      nextRun,
    })
  } catch (error: any) {
    logger.error('processScheduledReport: failed', error, { scheduledReportId: id })

    // Update with error
    await supabaseAdmin
      .from('scheduled_reports')
      .update({
        last_run: new Date().toISOString(),
        last_error: error.message,
      })
      .eq('id', id)

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
  const pattern = scheduledReport.cron_pattern || ''

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
          <p><strong>Date Range:</strong> ${new Date(report.date_range_start).toLocaleDateString()} - ${new Date(report.date_range_end).toLocaleDateString()}</p>
          
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
