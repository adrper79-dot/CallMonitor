import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole, success, Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Sentiment Trends Analytics API
 * 
 * GET /api/analytics/sentiment-trends - Sentiment distribution over time
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
    const ctx = await requireRole(['owner', 'admin', 'analyst'])
    if (ctx instanceof NextResponse) return ctx

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()

    // Query recordings with sentiment data using pgClient
    const { rows: recordings } = await query(
      `SELECT call_id, created_at, transcript_json
       FROM recordings 
       WHERE organization_id = $1 
         AND created_at >= $2 
         AND created_at <= $3 
         AND transcript_json IS NOT NULL
       ORDER BY created_at DESC 
       LIMIT 10000`,
      [ctx.orgId, startDate, endDate]
    )

    // Extract sentiment data
    const sentimentData: SentimentRow[] = (recordings || [])
      .map((r: any) => ({
        call_id: r.call_id,
        created_at: r.created_at,
        sentiment_summary: (r.transcript_json as any)?.sentiment_summary || null
      }))
      .filter(r => r.sentiment_summary !== null)

    const trends = computeSentimentTrends(sentimentData)

    return success({ trends })
  } catch (err: any) {
    logger.error('Sentiment trends analytics API error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Failed to compute sentiment trends'))
  }
}

function computeSentimentTrends(data: SentimentRow[]): SentimentTrends {
  if (data.length === 0) {
    return {
      overall_positive_rate: 0,
      overall_negative_rate: 0,
      overall_neutral_rate: 0,
      time_series: []
    }
  }

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

  const grouped: Record<string, SentimentRow[]> = {}
  data.forEach(row => {
    const date = new Date(row.created_at).toISOString().slice(0, 10)
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(row)
  })

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
