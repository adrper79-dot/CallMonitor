/**
 * Report Export API
 * 
 * GET /api/reports/[id]/export - Download report as file
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { exportToCSV, exportToJSON } from '@/lib/reports/generator'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('generated_reports')
      .select('*')
      .eq('id', reportId)
      .eq('organization_id', user.organization_id)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
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
    console.error('Error in GET /api/reports/[id]/export:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
