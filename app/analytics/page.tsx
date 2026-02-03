'use client'

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
import { logger } from '@/lib/logger'

/**
 * Analytics Page - Professional Design System v3.0
 * 
 * Comprehensive analytics dashboard with tabbed navigation
 * Clean, data-first design following architectural standards
 * 
 * Architecture Compliance:
 * - Uses getSession() for authentication
 * - Fetches from /api/analytics/* endpoints
 * - RBAC enforced server-side (owner/admin/analyst)
 * - Follows Professional Design System v3.0 patterns
 */

type TabId = 'overview' | 'calls' | 'sentiment' | 'performance' | 'surveys'

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

interface PerformanceMetrics {
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

export default function AnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { data: session, status } = useSession()
  
  // Date range state (default: last 30 days)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString()
  })
  const [endDate, setEndDate] = useState(new Date().toISOString())

  // Data state
  const [callMetrics, setCallMetrics] = useState<CallMetrics | null>(null)
  const [sentimentTrends, setSentimentTrends] = useState<SentimentTrends | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Authentication check
  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      router.push('/signin?callbackUrl=/analytics')
      return
    }

    async function fetchOrg() {
      try {
        // Get organization
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
        const response = await fetch(`${API_BASE}/api/organizations/current`, { credentials: 'include' })
        const data = await response.json()
        
        if (!data.organization?.id) {
          setError('No organization found')
          setLoading(false)
          return
        }
        
        setOrganizationId(data.organization.id)
        setLoading(false)
      } catch (err) {
        logger.error('Failed to check authentication', err)
        setError('Authentication failed')
        setLoading(false)
      }
    }
    fetchOrg()
  }, [router, status])

  // Fetch analytics data
  useEffect(() => {
    if (!organizationId) return

    async function fetchData() {
      setLoading(true)
      setError(null)
      
      try {
        const [callsRes, sentimentRes, perfRes] = await Promise.all([
          fetch(`/api/analytics/calls?startDate=${startDate}&endDate=${endDate}`, { credentials: 'include' }),
          fetch(`/api/analytics/sentiment-trends?startDate=${startDate}&endDate=${endDate}`, { credentials: 'include' }),
          fetch(`/api/analytics/performance`, { credentials: 'include' })
        ])

        const [callsData, sentimentData, perfData] = await Promise.all([
          callsRes.json(),
          sentimentRes.json(),
          perfRes.json()
        ])

        if (callsData.success) {
          setCallMetrics(callsData.metrics)
        }
        
        if (sentimentData.success) {
          setSentimentTrends(sentimentData.trends)
        }
        
        if (perfData.success) {
          setPerformanceMetrics(perfData.metrics)
        }
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="h-80 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-error-light border border-error text-error rounded-md p-4">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Insights and performance metrics</p>
      </div>

      {/* Date Range Picker */}
      <div className="mb-6">
        <DateRangePicker 
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start)
            setEndDate(end)
          }}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6" role="tablist">
          {[
            { id: 'overview' as TabId, label: 'Overview' },
            { id: 'calls' as TabId, label: 'Calls' },
            { id: 'sentiment' as TabId, label: 'Sentiment' },
            { id: 'performance' as TabId, label: 'Performance' },
            { id: 'surveys' as TabId, label: 'Surveys' }
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
          {/* Top Metrics */}
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
            <MetricCard 
              label="Total Minutes"
              value={callMetrics.total_duration_minutes}
            />
          </div>

          {/* Charts */}
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
            <h2 className="text-xl font-semibold text-gray-900">Call Analytics</h2>
            <ExportButton type="calls" startDate={startDate} endDate={endDate} />
          </div>
          <CallVolumeChart data={callMetrics.time_series} />
          <DurationChart data={callMetrics.time_series} />
        </div>
      )}

      {activeTab === 'sentiment' && sentimentTrends && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Sentiment Analysis</h2>
            <ExportButton type="sentiment" startDate={startDate} endDate={endDate} />
          </div>
          {sentimentTrends.time_series.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <MetricCard 
                  label="Positive Rate"
                  value={`${sentimentTrends.overall_positive_rate}%`}
                  trend="up"
                />
                <MetricCard 
                  label="Neutral Rate"
                  value={`${sentimentTrends.overall_neutral_rate}%`}
                />
                <MetricCard 
                  label="Negative Rate"
                  value={`${sentimentTrends.overall_negative_rate}%`}
                  trend={sentimentTrends.overall_negative_rate < 20 ? 'up' : sentimentTrends.overall_negative_rate < 40 ? 'neutral' : 'down'}
                />
              </div>
              <SentimentChart data={sentimentTrends.time_series} />
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
              <p className="text-gray-500">No sentiment data available for this time period</p>
              <p className="text-sm text-gray-400 mt-1">Enable transcription to unlock sentiment analysis</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'performance' && performanceMetrics && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Performance Metrics</h2>
          <PerformanceMetrics metrics={performanceMetrics} />
        </div>
      )}

      {activeTab === 'surveys' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Survey Analytics</h2>
            <ExportButton type="surveys" startDate={startDate} endDate={endDate} />
          </div>
          <SurveyAnalyticsWidget organizationId={organizationId} />
        </div>
      )}
    </div>
  )
}
