'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRBAC } from '@/hooks/useRBAC'
import { MetricCard } from '@/components/tableau/MetricCard'
import { ProgressBar } from '@/components/tableau/ProgressBar'
import { ClientDate } from '@/components/ui/ClientDate'

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
  sentiment_summary?: {
    overall: string
    positive_percent: number
  }
}

/**
 * DashboardHome - Clean Tableau-style dashboard
 * Data-first design with clear hierarchy and minimal styling
 */
export default function DashboardHome({ organizationId }: { organizationId: string | null }) {
  const { plan, role } = useRBAC(organizationId)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return
    
    // Fetch dashboard stats
    Promise.all([
      fetch(`/api/calls?orgId=${organizationId}&limit=5`).then(r => r.json()),
      fetch(`/api/bookings?status=pending&limit=3`).then(r => r.json()).catch(() => ({ bookings: [] }))
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
            <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <section aria-label="Quick Actions" className="space-y-4">
          <h2 className="text-lg font-semibold text-[#333333]">Quick Actions</h2>
          
          <div className="bg-white border border-[#E5E5E5] rounded p-4 space-y-2">
            <ActionLink href="/voice" title="Make a Call" description="Start a new outbound call" />
            <ActionLink href="/voice?tab=settings" title="Schedule Call" description="Book a future call" />
            <ActionLink href="/voice?tab=settings" title="Configure" description="Recording, transcription, translation" />
            {(plan === 'business' || plan === 'enterprise') && (
              <ActionLink href="/voice?tab=settings&section=shopper" title="Secret Shopper" description="Create evaluation scripts" />
            )}
          </div>
        </section>

        {/* Recent Calls */}
        <section aria-label="Recent Activity" className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-[#333333]">Recent Calls</h2>
          
          <div className="bg-white border border-[#E5E5E5] rounded overflow-hidden">
            {recentCalls.length === 0 ? (
              <div className="p-8 text-center text-[#999999]">
                <p className="text-sm mb-2">No calls yet</p>
                <Link href="/voice" className="text-[#4E79A7] hover:text-[#3D6A98] text-sm underline">
                  Make your first call →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-[#F0F0F0]">
                {recentCalls.map(call => (
                  <li key={call.id}>
                    <Link 
                      href={`/voice?callId=${call.id}`}
                      className="flex items-center justify-between p-4 hover:bg-[#F8F8F8] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#333333] truncate">
                          <ClientDate date={call.created_at} format="short" />
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={call.status} />
                          {call.duration_seconds && (
                            <span className="text-xs text-[#666666]">
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
          
          <Link 
            href="/voice" 
            className="block text-center text-sm text-[#4E79A7] hover:text-[#3D6A98] transition-colors"
          >
            View all calls →
          </Link>
        </section>

        {/* Intelligence Panel */}
        <section aria-label="Intelligence" className="space-y-4">
          <h2 className="text-lg font-semibold text-[#333333]">Intelligence</h2>
          
          <div className="space-y-4">
            {/* Sentiment Overview */}
            <div className="bg-white border border-[#E5E5E5] rounded p-4">
              <h3 className="text-sm font-semibold text-[#333333] mb-3">Sentiment Trend</h3>
              <ProgressBar 
                value={stats?.avgSentiment || 50} 
                color={stats?.avgSentiment && stats.avgSentiment >= 60 ? 'green' : stats?.avgSentiment && stats.avgSentiment >= 40 ? 'orange' : 'red'}
                showValue={true}
              />
              <p className="text-xs text-[#666666] mt-2 text-center">
                Based on recent call analysis
              </p>
            </div>
            
            {/* Feature Status */}
            <div className="bg-white border border-[#E5E5E5] rounded p-4">
              <h3 className="text-sm font-semibold text-[#333333] mb-3">Active Features</h3>
              <div className="space-y-2">
                <FeatureStatus label="Recording" enabled={true} />
                <FeatureStatus label="Transcription" enabled={true} />
                <FeatureStatus label="Sentiment Analysis" enabled={true} />
                <FeatureStatus label="Translation" enabled={plan === 'global' || plan === 'business' || plan === 'enterprise'} />
                <FeatureStatus label="Secret Shopper" enabled={plan === 'business' || plan === 'enterprise'} />
              </div>
            </div>
            
            {/* Plan Info */}
            <div className="bg-white border border-[#E5E5E5] rounded p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#666666] uppercase tracking-wide">Current Plan</p>
                  <p className="text-lg font-semibold text-[#333333] capitalize mt-1">{plan || 'Free'}</p>
                </div>
                <Link 
                  href="/settings?tab=billing"
                  className="text-sm text-[#4E79A7] hover:text-[#3D6A98]"
                >
                  Upgrade →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
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
      className="block p-3 rounded border border-transparent hover:border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors group"
    >
      <p className="font-medium text-[#333333] text-sm group-hover:text-[#4E79A7]">{title}</p>
      <p className="text-xs text-[#666666] mt-0.5">{description}</p>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-[#E8F5E9]', text: 'text-[#59A14F]', label: 'Completed' },
    in_progress: { bg: 'bg-[#E3F2FD]', text: 'text-[#4E79A7]', label: 'In Progress' },
    failed: { bg: 'bg-[#FFEBEE]', text: 'text-[#E15759]', label: 'Failed' },
    pending: { bg: 'bg-[#FFF8E1]', text: 'text-[#F57C00]', label: 'Pending' },
    queued: { bg: 'bg-[#F3E5F5]', text: 'text-[#AF7AA1]', label: 'Queued' }
  }
  const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    POSITIVE: { bg: 'bg-[#E8F5E9]', text: 'text-[#59A14F]', label: 'Positive' },
    NEGATIVE: { bg: 'bg-[#FFEBEE]', text: 'text-[#E15759]', label: 'Negative' },
    NEUTRAL: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Neutral' }
  }
  const c = config[sentiment] || config.NEUTRAL
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function FeatureStatus({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-[#333333]">{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
        enabled 
          ? 'bg-[#E8F5E9] text-[#59A14F]' 
          : 'bg-gray-100 text-[#999999]'
      }`}>
        {enabled ? 'Active' : 'Upgrade'}
      </span>
    </div>
  )
}
