'use client'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/tableau/MetricCard'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import { apiGet } from '@/lib/apiClient'

type SurveyMetrics = {
  total_surveys: number
  avg_score: number | null
  response_rate: number | null
  trend_7d: Array<{ date: string; count: number }>
}

export function SurveyAnalyticsWidget({ organizationId }: { organizationId: string | null }) {
  const [metrics, setMetrics] = useState<SurveyMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    apiGet<{ success?: boolean; error?: { message?: string }; metrics?: SurveyMetrics }>('/api/analytics/surveys')
      .then((data) => {
        if (!active) return
        if (data?.success === false) {
          setError(data?.error?.message || 'Unable to load survey analytics')
          setMetrics(null)
          return
        }
        setMetrics(data.metrics || null)
      })
      .catch((err) => {
        if (!active) return
        logger.error('SurveyAnalyticsWidget: fetch failed', err)
        setError('Unable to load survey analytics')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [organizationId])

  if (loading) {
    return (
      <section className="bg-white border border-gray-200 rounded-md p-4">
        <div className="h-4 w-32 bg-gray-100 rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="bg-white border border-gray-200 rounded-md p-4">
        <p className="text-sm text-gray-500">{error}</p>
      </section>
    )
  }

  const totalSurveys = metrics?.total_surveys ?? 0
  const avgScore = metrics?.avg_score !== null && metrics?.avg_score !== undefined
    ? metrics.avg_score.toFixed(1)
    : '—'
  const responseRate = metrics?.response_rate !== null && metrics?.response_rate !== undefined
    ? `${metrics.response_rate.toFixed(1)}%`
    : '—'
  const last7dTotal = metrics?.trend_7d?.reduce((acc, day) => acc + day.count, 0) || 0

  return (
    <section className="bg-white border border-gray-200 rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Survey Analytics</h3>
        <Badge variant={totalSurveys > 0 ? 'success' : 'default'}>
          {totalSurveys > 0 ? 'Active' : 'No data'}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Surveys" value={totalSurveys} />
        <MetricCard label="Avg Score" value={avgScore} />
        <MetricCard label="Response Rate" value={responseRate} />
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Last 7 days: {last7dTotal} completed survey{last7dTotal === 1 ? '' : 's'}
      </p>
    </section>
  )
}

export default SurveyAnalyticsWidget
