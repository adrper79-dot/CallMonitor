/**
 * Reports API
 * 
 * POST /api/reports/generate - Generate a new report
 * GET /api/reports - List generated reports
 * 
 * RBAC: All can view, Owner/Admin can generate
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole } from '@/lib/rbac-server'
import { ApiErrors, apiSuccess } from '@/lib/errors/apiHandler'
import { logger } from '@/lib/logger'
import {
  generateCallVolumeReport,
  generateCampaignPerformanceReport,
  exportToCSV,
  exportToJSON,
  type ReportFilters
} from '@/lib/reports/generator'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reports - List generated reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return ApiErrors.unauthorized()
    }

    const userId = (session.user as any).id
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Get user's organization
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return ApiErrors.notFound('Organization')
    }

    // Fetch generated reports
    const { data: reports, error: reportsError, count } = await supabaseAdmin
      .from('generated_reports')
      .select('*, generated_by:users!generated_reports_generated_by_fkey(id, name, email)', {
        count: 'exact'
      })
      .eq('organization_id', user.organization_id)
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (reportsError) {
      logger.error('Error fetching reports', reportsError)
      return ApiErrors.dbError('Failed to fetch reports')
    }

    return apiSuccess({
      reports: reports || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    logger.error('GET /api/reports failed', error)
    return ApiErrors.internal('Failed to fetch reports')
  }
}

/**
 * POST /api/reports/generate - Generate a new report
 * RBAC: Owner/Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return ApiErrors.unauthorized()
    }

    const userId = (session.user as any).id

    // Get user's organization and role
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return ApiErrors.notFound('Organization')
    }

    // Check RBAC
    // Role already checked

    const body = await request.json()
    const {
      name,
      report_type,
      filters,
      metrics,
      file_format
    } = body

    // Validation
    if (!name || !report_type) {
      return ApiErrors.validationError('Missing required fields: name, report_type')
    }

    if (!['call_volume', 'campaign_performance', 'quality_scorecard', 'custom'].includes(report_type)) {
      return ApiErrors.validationError('Invalid report_type')
    }

    const startTime = Date.now()

    // Generate report based on type
    let reportData
    try {
      switch (report_type) {
        case 'call_volume':
          reportData = await generateCallVolumeReport(
            user.organization_id,
            filters || {},
            metrics || []
          )
          break
        case 'campaign_performance':
          reportData = await generateCampaignPerformanceReport(
            user.organization_id,
            filters || {}
          )
          break
        default:
          throw new Error(`Report type ${report_type} not implemented yet`)
      }
    } catch (err) {
      logger.error('Error generating report', err, { report_type, filters })
      
      // Save failed report record
      await supabaseAdmin.from('generated_reports').insert({
        organization_id: user.organization_id,
        name,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Report generation failed',
        parameters: { report_type, filters, metrics },
        generated_by: userId,
        generation_duration_ms: Date.now() - startTime
      })

      return ApiErrors.internal('Failed to generate report')
    }

    // Export if requested
    let fileData: string | null = null
    if (file_format) {
      switch (file_format) {
        case 'csv':
          fileData = exportToCSV(reportData)
          break
        case 'json':
          fileData = exportToJSON(reportData)
          break
        default:
          logger.warn('Export format not implemented, storing inline', { file_format })
      }
    }

    // Save generated report
    const { data: report, error: saveError } = await supabaseAdmin
      .from('generated_reports')
      .insert({
        organization_id: user.organization_id,
        name,
        file_format: file_format || 'json',
        file_size_bytes: fileData ? Buffer.byteLength(fileData, 'utf8') : 0,
        report_data: reportData,
        parameters: { report_type, filters, metrics },
        generated_by: userId,
        status: 'completed',
        generation_duration_ms: Date.now() - startTime,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .select()
      .single()

    if (saveError) {
      logger.error('Error saving report', saveError)
      return ApiErrors.dbError('Failed to save report')
    }

    return NextResponse.json({ 
      success: true,
      report,
      data: reportData,
      file_data: fileData
    }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/reports failed', error)
    return ApiErrors.internal('Failed to generate report')
  }
}

