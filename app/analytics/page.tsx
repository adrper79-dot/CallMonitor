'use client'

/**
 * Analytics Overview — Hub page with date-range-aware charts and metrics.
 * Layout provides ProtectedGate + RoleShell.
 *
 * Sub-routes:
 *  /analytics/collections  — CollectionsKPIs
 *  /analytics/agents       — AgentLeaderboard
 *  /analytics/sentiment    — SentimentDashboard
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/AuthProvider'
import { DateRangePicker } from '@/components/analytics/DateRangePicker'
import { ExportButton } from '@/components/analytics/ExportButton'
import { CallVolumeChart } from '@/components/analytics/CallVolumeChart'
import { SentimentChart } from '@/components/analytics/SentimentChart'
import { DurationChart } from '@/components/analytics/DurationChart'
import { PerformanceMetrics } from '@/components/analytics/PerformanceMetrics'
import { MetricCard } from '@/components/tableau/MetricCard'
import { SurveyAnalyticsWidget } from '@/components/dashboard/SurveyAnalyticsWidget'
import { AdvancedAnalytics } from '@/components/analytics/AdvancedAnalytics'
import { logger } from '@/lib/logger'
import { apiGet } from '@/lib/apiClient'
import Link from 'next/link'
import {
  BarChart3, Users, DollarSign, MessageSquare,
  ArrowRight,
} from 'lucide-react'

type TabId = 'overview' | 'calls' | 'sentiment' | 'performance' | 'surveys' | 'advanced'

interface CallMetrics {
  total_calls: number
  completed_calls: number
  failed_calls: number
  avg_duration_seconds: number
  total_duration_minutes: number
  completion_rate: number
  time_series: Array<{
    date: string
    total: number
    completed: number
    failed: number
    avg_duration: number
  }>
}

interface SentimentTrends {
  overall_positive_rate: number
  overall_negative_rate: number
  overall_neutral_rate: number
  time_series: Array<{
    date: string
    positive_rate: number
    negative_rate: number
    neutral_rate: number
    sample_size: number
  }>
}

interface PerfMetrics {
  transcription_rate: number
  translation_rate: number
  avg_transcription_time_seconds: number
  avg_recording_quality: number
  feature_usage: {
    voice_cloning: number
    surveys: number
    scorecards: number
    webhooks_sent: number
  }
}

const quickLinks = [
  { href: '/analytics/collections', icon: DollarSign, label: 'Collections KPIs', desc: 'Recovery rates, aging, PTP' },
  { href: '/analytics/agents', icon: Users, label: 'Agent Leaderboard', desc: 'Rankings & achievements' },
  { href: '/analytics/sentiment', icon: MessageSquare, label: 'Sentiment Deep Dive', desc: 'Call sentiment trends' },
]

export default function AnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { data: session, status } = useSession()

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString()
  })
  const [endDate, setEndDate] = useState(new Date().toISOString())

  const [callMetrics, setCallMetrics] = useState<CallMetrics | null>(null)
  const [sentimentTrends, setSentimentTrends] = useState<SentimentTrends | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerfMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/analytics')
      return
    }
    async function fetchOrg() {
      try {
        const data = await apiGet<{ organization?: { id: string } }>('/api/organizations/current')
        const orgId = data.organization?.id
        if (orgId) setOrganizationId(orgId)
        else setError('Organization not found')
      } catch (err) {
        logger.error('Failed to fetch organization', err)
        setError('Failed to load organization.')
      } finally {
        setLoading(false)
      }
    }
    fetchOrg()
  }, [router, status])

  useEffect(() => {
    if (!organizationId) return
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [callsData, sentimentData, perfData] = await Promise.all([
          apiGet(`/api/analytics/calls?startDate=${startDate}&endDate=${endDate}`),
          apiGet(`/api/analytics/sentiment?startDate=${startDate}&endDate=${endDate}`),
          apiGet('/api/analytics/performance'),
        ])
        if (callsData.success) setCallMetrics(callsData.metrics)
        if (sentimentData.success) setSentimentTrends(sentimentData.trends)
        if (perfData.success) setPerformanceMetrics(perfData.metrics)
      } catch (err) {
        logger.error('Failed to fetch analytics:', err)
        setError('Failed to load analytics data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [organizationId, startDate, endDate])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded" />
            ))}
          </div>
          <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md p-4">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Page Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">Insights and performance metrics</p>
            </div>
            <div className="flex items-center gap-3">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => { setStartDate(start); setEndDate(end) }}
              />
              <ExportButton type="calls" startDate={startDate} endDate={endDate} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Links to sub-routes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickLinks.map((ql) => (
            <Link
              key={ql.href}
              href={ql.href}
              className="group flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                <ql.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ql.label}</p>
                <p className="text-xs text-gray-500">{ql.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </Link>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <nav className="flex gap-6" role="tablist">
            {[
              { id: 'overview' as TabId, label: 'Summary' },
              { id: 'calls' as TabId, label: 'Calls' },
              { id: 'sentiment' as TabId, label: 'Sentiment' },
              { id: 'performance' as TabId, label: 'Performance' },
              { id: 'surveys' as TabId, label: 'Surveys' },
              { id: 'advanced' as TabId, label: 'Advanced' },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && callMetrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Total Calls"
                value={callMetrics.total_calls}
                change={`${callMetrics.completed_calls} completed`}
                trend={callMetrics.completion_rate >= 80 ? 'up' : 'neutral'}
              />
              <MetricCard
                label="Completion Rate"
                value={`${callMetrics.completion_rate}%`}
                trend={callMetrics.completion_rate >= 80 ? 'up' : callMetrics.completion_rate >= 60 ? 'neutral' : 'down'}
              />
              <MetricCard
                label="Avg Duration"
                value={`${Math.floor(callMetrics.avg_duration_seconds / 60)}m ${callMetrics.avg_duration_seconds % 60}s`}
              />
              <MetricCard label="Total Minutes" value={callMetrics.total_duration_minutes} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CallVolumeChart data={callMetrics.time_series} />
              {sentimentTrends && sentimentTrends.time_series.length > 0 && (
                <SentimentChart data={sentimentTrends.time_series} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'calls' && callMetrics && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Call Analytics</h2>
              <ExportButton type="calls" startDate={startDate} endDate={endDate} />
            </div>
            <CallVolumeChart data={callMetrics.time_series} />
            <DurationChart data={callMetrics.time_series} />
          </div>
        )}

        {activeTab === 'sentiment' && sentimentTrends && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sentiment Analysis</h2>
              <ExportButton type="sentiment" startDate={startDate} endDate={endDate} />
            </div>
            {sentimentTrends.time_series.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <MetricCard label="Positive Rate" value={`${sentimentTrends.overall_positive_rate}%`} trend="up" />
                  <MetricCard label="Neutral Rate" value={`${sentimentTrends.overall_neutral_rate}%`} />
                  <MetricCard
                    label="Negative Rate"
                    value={`${sentimentTrends.overall_negative_rate}%`}
                    trend={sentimentTrends.overall_negative_rate < 20 ? 'up' : sentimentTrends.overall_negative_rate < 40 ? 'neutral' : 'down'}
                  />
                </div>
                <SentimentChart data={sentimentTrends.time_series} />
              </>
            ) : (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-8 text-center">
                <p className="text-gray-500">No sentiment data available for this time period</p>
                <p className="text-sm text-gray-400 mt-1">Enable transcription to unlock sentiment analysis</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && performanceMetrics && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Performance Metrics</h2>
            <PerformanceMetrics metrics={performanceMetrics} />
          </div>
        )}

        {activeTab === 'surveys' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Survey Analytics</h2>
              <ExportButton type="surveys" startDate={startDate} endDate={endDate} />
            </div>
            <SurveyAnalyticsWidget organizationId={organizationId} />
          </div>
        )}

        {activeTab === 'advanced' && organizationId && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Advanced Analytics</h2>
              <div className="text-sm text-gray-500">
                Collections-specific KPIs and Voice AI insights
              </div>
            </div>
            <AdvancedAnalytics
              organizationId={organizationId}
              dateRange={{ start: new Date(startDate), end: new Date(endDate) }}
            />
          </div>
        )}
      </div>
    </>
  )
}
