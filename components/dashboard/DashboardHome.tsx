'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRBAC } from '@/hooks/useRBAC'
import { MetricCard } from '@/components/tableau/MetricCard'
import { ProgressBar } from '@/components/tableau/ProgressBar'
import { ClientDate } from '@/components/ui/ClientDate'
import { Badge } from '@/components/ui/badge'
import ActivityFeedEmbed from '@/components/voice/ActivityFeedEmbed'
import ScorecardAlerts from '@/components/voice/ScorecardAlerts'
import SurveyAnalyticsWidget from '@/components/dashboard/SurveyAnalyticsWidget'

interface DashboardStats {
  totalCalls: number
  callsToday: number
  avgSentiment: number
  scheduledCalls: number
  recordingsCount: number
  translationsCount: number
}

interface RecentCall {
  id: string
  status: string
  created_at: string
  duration_seconds?: number
  to_number?: string
  sentiment_summary?: {
    overall: string
    positive_percent: number
  }
}

/**
 * DashboardHome - Professional Design System v3.0
 * 
 * Data-first dashboard with clear hierarchy.
 * Light theme, navy primary, no emojis.
 */
export default function DashboardHome({ organizationId }: { organizationId: string | null }) {
  const { plan, role } = useRBAC(organizationId)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([])
  const [loading, setLoading] = useState(true)
  const hasSurveyAnalytics = plan && ['insights', 'global', 'business', 'enterprise'].includes(plan)

  useEffect(() => {
    if (!organizationId) return
    
    // Fetch dashboard stats
    Promise.all([
      fetch(`/api/calls?orgId=${organizationId}&limit=5`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/bookings?status=pending&limit=3`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ bookings: [] }))
    ]).then(([callsData, bookingsData]) => {
      const calls = callsData.calls || []
      const bookings = bookingsData.bookings || []
      
      // Calculate stats
      const today = new Date().toDateString()
      const callsToday = calls.filter((c: any) => 
        new Date(c.created_at).toDateString() === today
      ).length
      
      // Calculate average sentiment from recent calls
      const sentimentCalls = calls.filter((c: any) => c.sentiment_summary?.positive_percent)
      const avgSentiment = sentimentCalls.length > 0
        ? Math.round(sentimentCalls.reduce((acc: number, c: any) => 
            acc + (c.sentiment_summary?.positive_percent || 50), 0) / sentimentCalls.length)
        : 50

      setStats({
        totalCalls: callsData.total || calls.length,
        callsToday,
        avgSentiment,
        scheduledCalls: bookings.length,
        recordingsCount: calls.filter((c: any) => c.recording_url).length,
        translationsCount: calls.filter((c: any) => c.translation).length
      })
      
      setRecentCalls(calls.slice(0, 5))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [organizationId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <section aria-label="Key Metrics" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Calls"
          value={stats?.totalCalls || 0}
          change={stats?.callsToday ? `+${stats.callsToday} today` : undefined}
          trend={stats?.callsToday ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Avg Sentiment"
          value={`${stats?.avgSentiment || 50}%`}
          change={stats?.avgSentiment && stats.avgSentiment >= 60 ? 'Positive' : 'Neutral'}
          trend={stats?.avgSentiment && stats.avgSentiment >= 60 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Recordings"
          value={stats?.recordingsCount || 0}
        />
        <MetricCard
          label="Scheduled"
          value={stats?.scheduledCalls || 0}
        />
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tour="dashboard-grid">
        {/* Quick Actions */}
        <section aria-label="Quick Actions" className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          
          {/* PRIMARY CTA - Make a Call */}
          <Link
            href="/voice"
            className="block w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white text-center font-semibold rounded-lg shadow-sm transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Make a Call
            </span>
          </Link>
          
          {/* Secondary Actions */}
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-1">
            <ActionLink href="/bookings" title="Schedule Call" description="Book a future call" />
            <ActionLink href="/settings?tab=targets" title="Manage Targets" description="Add or edit call targets" />
            {(plan === 'business' || plan === 'enterprise') && (
              <ActionLink href="/settings?tab=shopper" title="Secret Shopper" description="Create evaluation scripts" />
            )}
          </div>
        </section>

        {/* Recent Calls */}
        <section aria-label="Recent Activity" className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
          
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            {recentCalls.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <p className="text-sm text-gray-500 mb-2">No calls yet</p>
                <Link href="/voice" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  Make your first call
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentCalls.map(call => (
                  <li key={call.id}>
                    <Link 
                      href={`/voice?callId=${call.id}`}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {call.to_number || <ClientDate date={call.created_at} format="short" />}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={call.status} />
                          {call.duration_seconds && (
                            <span className="text-xs text-gray-500">
                              {Math.round(call.duration_seconds / 60)} min
                            </span>
                          )}
                        </div>
                      </div>
                      {call.sentiment_summary && (
                        <SentimentBadge sentiment={call.sentiment_summary.overall} />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {recentCalls.length > 0 && (
            <Link 
              href="/voice" 
              className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all calls
            </Link>
          )}
        </section>

        {/* Intelligence Panel */}
        <section aria-label="Intelligence" className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Intelligence</h2>
          
          <div className="space-y-4">
            {hasSurveyAnalytics && (
              <SurveyAnalyticsWidget organizationId={organizationId} />
            )}
            {/* Sentiment Overview */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Sentiment Trend</h3>
              <ProgressBar 
                value={stats?.avgSentiment || 50} 
                color={stats?.avgSentiment && stats.avgSentiment >= 60 ? 'green' : stats?.avgSentiment && stats.avgSentiment >= 40 ? 'orange' : 'red'}
                showValue={true}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Based on recent call analysis
              </p>
            </div>
            
            {/* Feature Status */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Features</h3>
              <div className="space-y-2">
                <FeatureStatus label="Recording" enabled={true} />
                <FeatureStatus label="Transcription" enabled={true} />
                <FeatureStatus label="Sentiment Analysis" enabled={true} />
                <FeatureStatus label="Translation" enabled={plan === 'global' || plan === 'business' || plan === 'enterprise'} />
                <FeatureStatus label="Secret Shopper" enabled={plan === 'business' || plan === 'enterprise'} />
              </div>
            </div>
            
            {/* Plan Info */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Current Plan</p>
                  <p className="text-lg font-semibold text-gray-900 capitalize mt-1">{plan || 'Free'}</p>
                </div>
                <Link 
                  href="/settings?tab=billing"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Upgrade
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Team Visibility */}
      <section aria-label="Team Visibility" className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tour="activity-feed">
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <ActivityFeedEmbed organizationId={organizationId} limit={12} />
          </div>
        </div>
        <ScorecardAlerts organizationId={organizationId} />
      </section>
    </div>
  )
}

// Sub-components

function ActionLink({ href, title, description }: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link 
      href={href}
      className="block p-3 rounded-md hover:bg-gray-50 transition-colors group"
    >
      <p className="font-medium text-gray-900 text-sm group-hover:text-primary-600">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
    completed: 'success',
    in_progress: 'default',
    failed: 'error',
    pending: 'warning',
    queued: 'default',
  }
  const labels: Record<string, string> = {
    completed: 'Completed',
    in_progress: 'In Progress',
    failed: 'Failed',
    pending: 'Pending',
    queued: 'Queued',
  }
  
  return (
    <Badge variant={variants[status] || 'default'}>
      {labels[status] || status}
    </Badge>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const variants: Record<string, 'success' | 'error' | 'default'> = {
    POSITIVE: 'success',
    NEGATIVE: 'error',
    NEUTRAL: 'default',
  }
  
  return (
    <Badge variant={variants[sentiment] || 'default'}>
      {sentiment.charAt(0) + sentiment.slice(1).toLowerCase()}
    </Badge>
  )
}

function FeatureStatus({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-700">{label}</span>
      <Badge variant={enabled ? 'success' : 'default'}>
        {enabled ? 'Active' : 'Upgrade'}
      </Badge>
    </div>
  )
}
