import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { requireRole, success, Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * Sentiment Trends Analytics API
 * 
 * GET /api/analytics/sentiment-trends - Sentiment distribution over time
 * 
 * Architecture Compliance:
 * - Uses requireRole() for RBAC (owner/admin/analyst)
 * - Joins calls with recordings table for sentiment data
 * - Returns structured success() responses
 * - Follows Professional Design System v3.0 patterns
 * 
 * Query Parameters:
 * - startDate: ISO string (default: 30 days ago)
 * - endDate: ISO string (default: now)
 */

interface SentimentRow {
  call_id: string
  created_at: string
  sentiment_summary: {
    overall: string
    positive_percent: number
    negative_percent: number
    neutral_percent: number
  } | null
}

interface SentimentTimeSeriesPoint {
  date: string
  positive_rate: number
  negative_rate: number
  neutral_rate: number
  sample_size: number
}

interface SentimentTrends {
  overall_positive_rate: number
  overall_negative_rate: number
  overall_neutral_rate: number
  time_series: SentimentTimeSeriesPoint[]
}

export async function GET(req: NextRequest) {
  try {
    // RBAC: Only owner/admin/analyst can access analytics
    const ctx = await requireRole(['owner', 'admin', 'analyst'])
    if (ctx instanceof NextResponse) return ctx

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()

    // Query recordings with sentiment data
    // Note: Using recordings.organization_id directly (not via calls join)
    const { data: recordings, error } = await supabaseAdmin
      .from('recordings')
      .select(`
        call_id,
        created_at,
        transcript_json
      `)
      .eq('organization_id', ctx.orgId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('transcript_json', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) {
      logger.error('Failed to fetch recordings for sentiment analytics', { error, orgId: ctx.orgId })
      throw error
    }

    // Extract sentiment data from transcript_json
    const sentimentData: SentimentRow[] = (recordings || [])
      .map(r => ({
        call_id: r.call_id,
        created_at: r.created_at,
        sentiment_summary: (r.transcript_json as any)?.sentiment_summary || null
      }))
      .filter(r => r.sentiment_summary !== null)

    // Compute sentiment trends
    const trends = computeSentimentTrends(sentimentData)

    return success({ trends })
  } catch (err: any) {
    logger.error('Sentiment trends analytics API error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Failed to compute sentiment trends'))
  }
}

/**
 * Compute sentiment trends from recordings data
 */
function computeSentimentTrends(data: SentimentRow[]): SentimentTrends {
  if (data.length === 0) {
    return {
      overall_positive_rate: 0,
      overall_negative_rate: 0,
      overall_neutral_rate: 0,
      time_series: []
    }
  }

  // Calculate overall rates
  let totalPositive = 0
  let totalNegative = 0
  let totalNeutral = 0

  data.forEach(row => {
    if (row.sentiment_summary) {
      totalPositive += row.sentiment_summary.positive_percent
      totalNegative += row.sentiment_summary.negative_percent
      totalNeutral += row.sentiment_summary.neutral_percent
    }
  })

  const overall_positive_rate = Math.round(totalPositive / data.length)
  const overall_negative_rate = Math.round(totalNegative / data.length)
  const overall_neutral_rate = Math.round(totalNeutral / data.length)

  // Group by date
  const grouped: Record<string, SentimentRow[]> = {}
  data.forEach(row => {
    const date = new Date(row.created_at).toISOString().slice(0, 10)
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(row)
  })

  // Generate time series
  const time_series = Object.entries(grouped)
    .map(([date, rows]) => {
      let dayPositive = 0
      let dayNegative = 0
      let dayNeutral = 0

      rows.forEach(row => {
        if (row.sentiment_summary) {
          dayPositive += row.sentiment_summary.positive_percent
          dayNegative += row.sentiment_summary.negative_percent
          dayNeutral += row.sentiment_summary.neutral_percent
        }
      })

      return {
        date,
        positive_rate: Math.round(dayPositive / rows.length),
        negative_rate: Math.round(dayNegative / rows.length),
        neutral_rate: Math.round(dayNeutral / rows.length),
        sample_size: rows.length
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    overall_positive_rate,
    overall_negative_rate,
    overall_neutral_rate,
    time_series
  }
}
