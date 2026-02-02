/**
 * Report Export API
 * 
 * GET /api/reports/[id]/export - Download report as file
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole } from '@/lib/rbac-server'
import { exportToCSV, exportToJSON } from '@/lib/reports/generator'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/reports/[id]/export
 * Export report to downloadable file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole('viewer')
    if (session instanceof NextResponse) return session
    const userId = session.user.id
    const organizationId = session.user.organizationId
    const reportId = params.id
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'

    // Get report and verify ownership
    const { rows: reports } = await query(
      `SELECT name, report_data 
       FROM generated_reports 
       WHERE id = $1 AND organization_id = $2`,
      [reportId, organizationId]
    )

    if (reports.length === 0) {
      return ApiErrors.notFound('Report')
    }

    const report = reports[0]

    // Log access
    try {
      await query(
        `INSERT INTO report_access_log (report_id, user_id, action, created_at)
         VALUES ($1, $2, 'downloaded', NOW())`,
        [reportId, userId]
      )
    } catch (e) {
      // Ignore log error
      logger.warn('Failed to log report access', e)
    }

    // Export report data
    let content: string
    let contentType: string
    let filename: string

    switch (format) {
      case 'csv':
        content = exportToCSV(report.report_data)
        contentType = 'text/csv'
        filename = `${report.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`
        break
      case 'json':
      default:
        content = exportToJSON(report.report_data)
        contentType = 'application/json'
        filename = `${report.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
        break
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(content, 'utf8').toString()
      }
    })
  } catch (error) {
    logger.error('Error in GET /api/reports/[id]/export', error)
    return ApiErrors.internal('Internal server error')
  }
}
