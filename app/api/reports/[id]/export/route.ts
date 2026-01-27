/**
 * Report Export API
 * 
 * GET /api/reports/[id]/export - Download report as file
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
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
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return ApiErrors.unauthorized()
    }

    const userId = (session.user as any).id
    const reportId = params.id
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'

    // Get user's organization
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return ApiErrors.notFound('Organization')
    }

    // Get report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('generated_reports')
      .select('*')
      .eq('id', reportId)
      .eq('organization_id', user.organization_id)
      .single()

    if (reportError || !report) {
      return ApiErrors.notFound('Report')
    }

    // Log access
    await supabaseAdmin.from('report_access_log').insert({
      report_id: reportId,
      user_id: userId,
      action: 'downloaded'
    })

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
