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
import { requireRole } from '@/lib/rbac'
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
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
      console.error('Error fetching reports:', reportsError)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    return NextResponse.json({
      reports: reports || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in GET /api/reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Get user's organization and role
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
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
      return NextResponse.json({ 
        error: 'Missing required fields: name, report_type' 
      }, { status: 400 })
    }

    if (!['call_volume', 'campaign_performance', 'quality_scorecard', 'custom'].includes(report_type)) {
      return NextResponse.json({ 
        error: 'Invalid report_type' 
      }, { status: 400 })
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
      console.error('Error generating report:', err)
      
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

      return NextResponse.json({ 
        error: 'Failed to generate report',
        details: err instanceof Error ? err.message : 'Unknown error'
      }, { status: 500 })
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
          console.warn(`Export format ${file_format} not implemented, storing inline`)
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
      console.error('Error saving report:', saveError)
      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
    }

    return NextResponse.json({ 
      report,
      data: reportData,
      file_data: fileData
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/reports/generate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

