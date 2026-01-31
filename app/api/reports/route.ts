/**
 * Reports API
 * 
 * POST /api/reports/generate - Generate a new report
 * GET /api/reports - List generated reports
 * 
 * RBAC: All can view, Owner/Admin can generate
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { ApiErrors, apiSuccess } from '@/lib/errors/apiHandler'
import { logger } from '@/lib/logger'
import {
  generateCallVolumeReport,
  generateCampaignPerformanceReport,
  exportToCSV,
  exportToJSON,
} from '@/lib/reports/generator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/reports - List generated reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['owner', 'admin', 'analyst', 'viewer'])
    if (session instanceof NextResponse) return session
    const organizationId = session.user.organizationId

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Fetch generated reports with pagination and user info
    const { rows: reports } = await query(
      `SELECT gr.*,
              u.id as user_id, u.name as user_name, u.email as user_email
       FROM generated_reports gr
       LEFT JOIN users u ON gr.generated_by = u.id
       WHERE gr.organization_id = $1
       ORDER BY gr.generated_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    )

    // Map user info to expected structure
    const mappedReports = reports.map((r: any) => ({
      ...r,
      generated_by: r.user_id ? {
        id: r.user_id,
        name: r.user_name,
        email: r.user_email
      } : null,
      // Remove flattened fields
      user_id: undefined,
      user_name: undefined,
      user_email: undefined
    }))

    // Get count
    const { rows: countRows } = await query(
      `SELECT COUNT(*) as total FROM generated_reports WHERE organization_id = $1`,
      [organizationId]
    )
    const count = parseInt(countRows[0]?.total || '0', 10)

    return apiSuccess({
      reports: mappedReports || [],
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
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
    const session = await requireRole(['owner', 'admin'])
    if (session instanceof NextResponse) return session
    const organizationId = session.user.organizationId
    const userId = session.user.id

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
            organizationId,
            filters || {},
            metrics || []
          )
          break
        case 'campaign_performance':
          reportData = await generateCampaignPerformanceReport(
            organizationId,
            filters || {}
          )
          break
        default:
          throw new Error(`Report type ${report_type} not implemented yet`)
      }
    } catch (err: any) {
      logger.error('Error generating report', err, { report_type, filters })

      // Save failed report record
      await query(
        `INSERT INTO generated_reports (
           organization_id, name, status, error_message, parameters, generated_by, generation_duration_ms, generated_at
         ) VALUES ($1, $2, 'failed', $3, $4, $5, $6, NOW())`,
        [
          organizationId,
          name,
          err instanceof Error ? err.message : 'Report generation failed',
          JSON.stringify({ report_type, filters, metrics }),
          userId,
          Date.now() - startTime
        ]
      )

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
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    const { rows: savedReports } = await query(
      `INSERT INTO generated_reports (
         organization_id, name, file_format, file_size_bytes, report_data, parameters, 
         generated_by, status, generation_duration_ms, expires_at, generated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9, NOW())
       RETURNING *`,
      [
        organizationId,
        name,
        file_format || 'json',
        fileData ? Buffer.byteLength(fileData, 'utf8') : 0,
        JSON.stringify(reportData),
        JSON.stringify({ report_type, filters, metrics }),
        userId,
        Date.now() - startTime,
        expiresAt
      ]
    )

    const report = savedReports[0]

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
