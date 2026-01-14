'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRBAC } from '@/hooks/useRBAC'

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
 * DashboardHome - Command Center Overview
 * 
 * Feng Shui Layout:
 * - Top: Key metrics (commanding position)
 * - Left: Quick actions (energy flow)
 * - Center: Activity feed (focal point)
 * - Right: Upcoming/scheduled (future orientation)
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
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hero Metrics - Commanding Position */}
      <section aria-label="Key Metrics" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon="📞"
          label="Total Calls"
          value={stats?.totalCalls || 0}
          trend={stats?.callsToday ? `+${stats.callsToday} today` : undefined}
          color="teal"
        />
        <MetricCard
          icon="😊"
          label="Avg Sentiment"
          value={`${stats?.avgSentiment || 50}%`}
          trend={stats?.avgSentiment && stats.avgSentiment >= 60 ? 'Positive' : 'Neutral'}
          color={stats?.avgSentiment && stats.avgSentiment >= 60 ? 'green' : 'amber'}
        />
        <MetricCard
          icon="🎙️"
          label="Recordings"
          value={stats?.recordingsCount || 0}
          color="coral"
        />
        <MetricCard
          icon="📅"
          label="Scheduled"
          value={stats?.scheduledCalls || 0}
          trend="upcoming"
          color="gold"
        />
      </section>

      {/* Main Grid - Energy Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions - Left (Initiative) */}
        <section aria-label="Quick Actions" className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-2xl">🚀</span> Quick Actions
          </h2>
          
          <div className="space-y-3">
            <ActionCard
              href="/voice"
              icon="📞"
              title="Make a Call"
              description="Start a new outbound call"
              color="teal"
            />
            <ActionCard
              href="/voice?tab=settings"
              icon="📅"
              title="Schedule Call"
              description="Book a future call"
              color="gold"
            />
            <ActionCard
              href="/voice?tab=settings"
              icon="⚙️"
              title="Configure"
              description="Recording, transcription, translation"
              color="slate"
            />
            {(plan === 'business' || plan === 'enterprise') && (
              <ActionCard
                href="/voice?tab=settings&section=shopper"
                icon="🕵️"
                title="Secret Shopper"
                description="Create evaluation scripts"
                color="coral"
              />
            )}
          </div>
        </section>

        {/* Activity Feed - Center (Focal Point) */}
        <section aria-label="Recent Activity" className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-2xl">📊</span> Recent Calls
          </h2>
          
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {recentCalls.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-4xl mb-2">📭</p>
                <p>No calls yet</p>
                <Link href="/voice" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
                  Make your first call →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-700">
                {recentCalls.map(call => (
                  <li key={call.id}>
                    <Link 
                      href={`/voice?callId=${call.id}`}
                      className="flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon status={call.status} />
                        <div>
                          <p className="text-sm text-slate-200">
                            {new Date(call.created_at).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-400">
                            {call.duration_seconds ? `${Math.round(call.duration_seconds / 60)}min` : 'Pending'}
                          </p>
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
            className="block text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all calls →
          </Link>
        </section>

        {/* Intelligence Panel - Right (Insight) */}
        <section aria-label="Intelligence" className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-2xl">🧠</span> Intelligence
          </h2>
          
          <div className="space-y-4">
            {/* Sentiment Overview */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Sentiment Trend</h3>
              <SentimentGauge value={stats?.avgSentiment || 50} />
              <p className="text-xs text-slate-400 mt-2 text-center">
                Based on recent call analysis
              </p>
            </div>
            
            {/* Feature Status */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Active Features</h3>
              <div className="space-y-2">
                <FeatureStatus label="Recording" enabled={true} />
                <FeatureStatus label="Transcription" enabled={true} />
                <FeatureStatus label="Sentiment Analysis" enabled={true} />
                <FeatureStatus label="Translation" enabled={plan === 'global' || plan === 'business' || plan === 'enterprise'} />
                <FeatureStatus label="Secret Shopper" enabled={plan === 'business' || plan === 'enterprise'} />
              </div>
            </div>
            
            {/* Plan Info */}
            <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/20 rounded-xl border border-amber-700/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-400 uppercase tracking-wide">Current Plan</p>
                  <p className="text-lg font-semibold text-amber-200 capitalize">{plan || 'Free'}</p>
                </div>
                <Link 
                  href="/settings?tab=billing"
                  className="text-xs text-amber-400 hover:text-amber-300"
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

function MetricCard({ icon, label, value, trend, color }: {
  icon: string
  label: string
  value: number | string
  trend?: string
  color: 'teal' | 'gold' | 'coral' | 'green' | 'amber' | 'slate'
}) {
  const colorMap = {
    teal: 'from-teal-900/50 to-teal-800/30 border-teal-700/50',
    gold: 'from-amber-900/50 to-amber-800/30 border-amber-700/50',
    coral: 'from-rose-900/50 to-rose-800/30 border-rose-700/50',
    green: 'from-green-900/50 to-green-800/30 border-green-700/50',
    amber: 'from-amber-900/50 to-amber-800/30 border-amber-700/50',
    slate: 'from-slate-800/50 to-slate-700/30 border-slate-600/50'
  }
  
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} rounded-xl border p-4 hover:scale-[1.02] transition-transform`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {trend && <p className="text-xs text-slate-400 mt-1">{trend}</p>}
    </div>
  )
}

function ActionCard({ href, icon, title, description, color }: {
  href: string
  icon: string
  title: string
  description: string
  color: 'teal' | 'gold' | 'coral' | 'slate'
}) {
  const colorMap = {
    teal: 'hover:border-teal-500 hover:bg-teal-900/20',
    gold: 'hover:border-amber-500 hover:bg-amber-900/20',
    coral: 'hover:border-rose-500 hover:bg-rose-900/20',
    slate: 'hover:border-slate-500 hover:bg-slate-700/20'
  }
  
  return (
    <Link 
      href={href}
      className={`flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 ${colorMap[color]} transition-all group`}
    >
      <span className="text-3xl group-hover:scale-110 transition-transform">{icon}</span>
      <div>
        <p className="font-medium text-slate-100">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </Link>
  )
}

function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, string> = {
    completed: '✅',
    in_progress: '🔵',
    failed: '❌',
    pending: '⏳',
    queued: '📋'
  }
  return <span className="text-xl">{icons[status] || '📞'}</span>
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    POSITIVE: { bg: 'bg-green-900/50', text: 'text-green-400', icon: '😊' },
    NEGATIVE: { bg: 'bg-red-900/50', text: 'text-red-400', icon: '😟' },
    NEUTRAL: { bg: 'bg-slate-700/50', text: 'text-slate-400', icon: '😐' }
  }
  const c = config[sentiment] || config.NEUTRAL
  
  return (
    <span className={`${c.bg} ${c.text} px-2 py-1 rounded-full text-xs flex items-center gap-1`}>
      <span>{c.icon}</span>
      <span className="capitalize">{sentiment.toLowerCase()}</span>
    </span>
  )
}

function SentimentGauge({ value }: { value: number }) {
  const getColor = (v: number) => {
    if (v >= 70) return 'bg-green-500'
    if (v >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }
  
  return (
    <div className="relative">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>😟</span>
        <span>😐</span>
        <span>😊</span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(value)} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-center text-2xl font-bold text-white mt-2">{value}%</p>
    </div>
  )
}

function FeatureStatus({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-300">{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${
        enabled 
          ? 'bg-green-900/50 text-green-400' 
          : 'bg-slate-700/50 text-slate-500'
      }`}>
        {enabled ? '✓ Active' : 'Upgrade'}
      </span>
    </div>
  )
}
