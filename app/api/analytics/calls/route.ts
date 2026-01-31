import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { requireRole, success, Errors } from '@/lib/api/utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Call Analytics API
 * 
 * GET /api/analytics/calls - Aggregate call metrics with time-series
 */

interface CallRow {
  id: string
  status: string
  started_at: string | null
  ended_at: string | null
}

interface TimeSeriesPoint {
  date: string
  total: number
  completed: number
  failed: number
  avg_duration: number
}

interface CallMetrics {
  total_calls: number
  completed_calls: number
  failed_calls: number
  avg_duration_seconds: number
  total_duration_minutes: number
  completion_rate: number
  time_series: TimeSeriesPoint[]
}

export async function GET(req: NextRequest) {
  try {
    // RBAC
    const ctx = await requireRole(['owner', 'admin', 'analyst'])
    if (ctx instanceof NextResponse) return ctx

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()
    const groupBy = (searchParams.get('groupBy') || 'day') as 'day' | 'week' | 'month'

    if (!['day', 'week', 'month'].includes(groupBy)) {
      return Errors.badRequest('groupBy must be one of: day, week, month')
    }

    // Query calls using pgClient
    const { rows: calls } = await query(
      `SELECT id, status, started_at::text, ended_at::text 
       FROM calls 
       WHERE organization_id = $1 
         AND started_at >= $2 
         AND started_at <= $3 
       ORDER BY started_at DESC 
       LIMIT 10000`,
      [ctx.orgId, startDate, endDate]
    )

    // Compute aggregated metrics
    const metrics = computeCallMetrics(calls as CallRow[], groupBy)

    return success({ metrics })
  } catch (err: any) {
    logger.error('Call analytics API error', err)
    return Errors.internal(err instanceof Error ? err : new Error('Failed to compute call analytics'))
  }
}

/**
 * Compute call metrics from raw call data
 */
function computeCallMetrics(calls: CallRow[], groupBy: 'day' | 'week' | 'month'): CallMetrics {
  const total_calls = calls.length
  const completed_calls = calls.filter(c => c.status === 'completed').length
  const failed_calls = calls.filter(c =>
    c.status === 'failed' || c.status === 'no-answer' || c.status === 'busy'
  ).length

  const durationsSeconds = calls
    .filter(c => c.started_at && c.ended_at && c.status === 'completed')
    .map(c => {
      const start = new Date(c.started_at!).getTime()
      const end = new Date(c.ended_at!).getTime()
      return Math.round((end - start) / 1000)
    })
    .filter(d => d > 0 && d < 3600)

  const avg_duration_seconds = durationsSeconds.length > 0
    ? Math.round(durationsSeconds.reduce((a, b) => a + b, 0) / durationsSeconds.length)
    : 0

  const total_duration_minutes = Math.round(
    durationsSeconds.reduce((a, b) => a + b, 0) / 60
  )

  const completion_rate = total_calls > 0
    ? Math.round((completed_calls / total_calls) * 100)
    : 0

  // Group calls by time period
  const grouped: Record<string, CallRow[]> = {}
  calls.forEach(call => {
    if (!call.started_at) return
    const key = getGroupKey(call.started_at, groupBy)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(call)
  })

  // Generate time series data
  const time_series = Object.entries(grouped)
    .map(([date, calls]) => {
      const completedInPeriod = calls.filter(c => c.status === 'completed')
      const durationsInPeriod = completedInPeriod
        .filter(c => c.started_at && c.ended_at)
        .map(c => Math.round((new Date(c.ended_at!).getTime() - new Date(c.started_at!).getTime()) / 1000))
        .filter(d => d > 0 && d < 3600)

      return {
        date,
        total: calls.length,
        completed: completedInPeriod.length,
        failed: calls.filter(c =>
          c.status === 'failed' || c.status === 'no-answer' || c.status === 'busy'
        ).length,
        avg_duration: durationsInPeriod.length > 0
          ? Math.round(
            durationsInPeriod.reduce((sum, d) => sum + d, 0) / durationsInPeriod.length
          )
          : 0
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    total_calls,
    completed_calls,
    failed_calls,
    avg_duration_seconds,
    total_duration_minutes,
    completion_rate,
    time_series
  }
}

function getGroupKey(timestamp: string, groupBy: 'day' | 'week' | 'month'): string {
  const date = new Date(timestamp)

  if (groupBy === 'day') {
    return date.toISOString().slice(0, 10)
  } else if (groupBy === 'week') {
    const weekStart = new Date(date)
    const day = weekStart.getDay()
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
    weekStart.setDate(diff)
    return weekStart.toISOString().slice(0, 10)
  } else if (groupBy === 'month') {
    return date.toISOString().slice(0, 7)
  }

  return date.toISOString().slice(0, 10)
}
