import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole, Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Analytics Export API
 * 
 * GET /api/analytics/export - Export analytics data to CSV or JSON
 * 
 * Architecture Compliance:
 * - Uses requireRole() for RBAC (owner/admin/analyst)
 * - Supports multiple export formats (CSV, JSON)
 * - Returns file downloads with proper headers
 * - Follows Professional Design System v3.0 patterns
 * 
 * Query Parameters:
 * - type: 'calls' | 'surveys' | 'sentiment' (required)
 * - format: 'csv' | 'json' (default: csv)
 * - startDate: ISO string (default: 30 days ago)
 * - endDate: ISO string (default: now)
 */

export async function GET(req: NextRequest) {
  try {
    // RBAC: Only owner/admin/analyst can export analytics
    const ctx = await requireRole(['owner', 'admin', 'analyst'])
    if (ctx instanceof NextResponse) return ctx

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const format = searchParams.get('format') || 'csv'
    const startDate = searchParams.get('startDate') || 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()

    // Validate parameters
    if (!type || !['calls', 'surveys', 'sentiment'].includes(type)) {
      return Errors.badRequest('type parameter required (calls|surveys|sentiment)')
    }

    if (!['csv', 'json'].includes(format)) {
      return Errors.badRequest('format must be csv or json')
    }

    // Fetch data based on type
    let data: any[] = []
    let filename = ''

    if (type === 'calls') {
      const { data: calls, error } = await supabaseAdmin
        .from('calls')
        .select('id, status, created_at, ended_at, duration_seconds, to_number, from_number')
        .eq('organization_id', ctx.orgId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(10000)

      if (error) throw error
      data = calls || []
      filename = `calls-export-${new Date().toISOString().slice(0, 10)}`
    } else if (type === 'surveys') {
      const { data: surveys, error } = await supabaseAdmin
        .from('ai_runs')
        .select('call_id, output, created_at, status')
        .eq('calls.organization_id', ctx.orgId)
        .in('model', ['laml-dtmf-survey', 'signalwire-ai-survey'])
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(10000)

      if (error) throw error
      
      // Flatten survey responses
      data = (surveys || []).map((s: any) => ({
        call_id: s.call_id,
        created_at: s.created_at,
        status: s.status,
        responses: JSON.stringify(s.output?.responses || []),
        score: extractSurveyScore(s.output)
      }))
      filename = `surveys-export-${new Date().toISOString().slice(0, 10)}`
    } else if (type === 'sentiment') {
      const { data: recordings, error } = await supabaseAdmin
        .from('recordings')
        .select('call_id, created_at, transcript_json')
        .eq('calls.organization_id', ctx.orgId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('transcript_json', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10000)

      if (error) throw error

      // Extract sentiment data
      data = (recordings || [])
        .filter((r: any) => (r.transcript_json as any)?.sentiment_summary)
        .map((r: any) => {
          const sentiment = (r.transcript_json as any)?.sentiment_summary
          return {
            call_id: r.call_id,
            created_at: r.created_at,
            overall_sentiment: sentiment.overall,
            positive_percent: sentiment.positive_percent,
            negative_percent: sentiment.negative_percent,
            neutral_percent: sentiment.neutral_percent,
            segment_count: sentiment.segment_count
          }
        })
      filename = `sentiment-export-${new Date().toISOString().slice(0, 10)}`
    }

    // Generate response based on format
    if (format === 'json') {
      return new NextResponse(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`
        }
      })
    } else {
      // CSV format
      const csv = convertToCSV(data)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
      })
    }
  } catch (err: any) {
    logger.error('Analytics export API error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Failed to export analytics'))
  }
}

/**
 * Convert array of objects to CSV format
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) {
    return ''
  }

  // Get headers from first object
  const headers = Object.keys(data[0])
  
  // Create CSV rows
  const rows = data.map(obj => 
    headers.map(header => {
      const value = obj[header]
      // Escape quotes and wrap in quotes if contains comma or newline
      if (value === null || value === undefined) return ''
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  )

  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n')
}

/**
 * Extract numeric score from survey output
 */
function extractSurveyScore(output: any): number | null {
  if (!output?.responses || !Array.isArray(output.responses)) {
    return null
  }

  for (const response of output.responses) {
    const value = response.digit ?? response.value
    if (typeof value === 'number' && value >= 1 && value <= 5) {
      return value
    }
    if (typeof value === 'string') {
      const match = value.match(/\d+/)
      if (match) {
        const num = parseInt(match[0], 10)
        if (num >= 1 && num <= 5) return num
      }
    }
  }

  return null
}
