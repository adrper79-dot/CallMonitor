import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole, Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Analytics Export API
 * 
 * GET /api/analytics/export - Export analytics data to CSV or JSON
 */

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRole(['owner', 'admin', 'analyst'])
    if (ctx instanceof NextResponse) return ctx

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const format = searchParams.get('format') || 'csv'
    const startDate = searchParams.get('startDate') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()

    if (!type || !['calls', 'surveys', 'sentiment'].includes(type)) {
      return Errors.badRequest('type parameter required (calls|surveys|sentiment)')
    }

    if (!['csv', 'json'].includes(format)) {
      return Errors.badRequest('format must be csv or json')
    }

    let data: any[] = []
    let filename = ''

    if (type === 'calls') {
      const { rows } = await query(
        `SELECT id, status, created_at, ended_at, duration_seconds, to_number, from_number
         FROM calls
         WHERE organization_id = $1
           AND created_at >= $2
           AND created_at <= $3
         ORDER BY created_at DESC
         LIMIT 10000`,
        [ctx.orgId, startDate, endDate]
      )

      data = rows || []
      filename = `calls-export-${new Date().toISOString().slice(0, 10)}`
    } else if (type === 'surveys') {
      // Use JOIN to filter by organization
      const { rows } = await query(
        `SELECT ar.call_id, ar.output, ar.created_at, ar.status
         FROM ai_runs ar
         JOIN calls c ON ar.call_id = c.id
         WHERE c.organization_id = $1
           AND ar.model IN ('laml-dtmf-survey', 'signalwire-ai-survey')
           AND ar.status = 'completed'
           AND ar.created_at >= $2
           AND ar.created_at <= $3
         ORDER BY ar.created_at DESC
         LIMIT 10000`,
        [ctx.orgId, startDate, endDate]
      )

      data = (rows || []).map((s: any) => ({
        call_id: s.call_id,
        created_at: s.created_at,
        status: s.status,
        responses: JSON.stringify(s.output?.responses || []),
        score: extractSurveyScore(s.output)
      }))
      filename = `surveys-export-${new Date().toISOString().slice(0, 10)}`
    } else if (type === 'sentiment') {
      // Use JOIN to filter by organization if organization_id on recordings isn't trusted or to consistent with Surveys
      // However previous code used recordings.organization_id directly if possible? 
      // The old code said: .eq('calls.organization_id', ctx.orgId) which implies a join on calls table
      // So in Supabase it was joining. Here we MUST join or use explicit org_id if on recordings.
      // Recordings usually has org_id. Let's use JOIN to be safe and consistent with query patterns.
      const { rows } = await query(
        `SELECT r.call_id, r.created_at, r.transcript_json
         FROM recordings r
         JOIN calls c ON r.call_id = c.id
         WHERE c.organization_id = $1
           AND r.created_at >= $2
           AND r.created_at <= $3
           AND r.transcript_json IS NOT NULL
         ORDER BY r.created_at DESC
         LIMIT 10000`,
        [ctx.orgId, startDate, endDate]
      )

      data = (rows || [])
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

    if (format === 'json') {
      return new NextResponse(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`
        }
      })
    } else {
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

function convertToCSV(data: any[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const rows = data.map(obj =>
    headers.map(header => {
      const value = obj[header]
      if (value === null || value === undefined) return ''
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

function extractSurveyScore(output: any): number | null {
  if (!output?.responses || !Array.isArray(output.responses)) return null
  for (const response of output.responses) {
    const value = response.digit ?? response.value
    if (typeof value === 'number' && value >= 1 && value <= 5) return value
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
