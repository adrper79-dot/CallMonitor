'use client'

/**
 * AgentLeaderboard — Gamified agent performance ranking
 *
 * Shows ranked agents by collections, calls, efficiency with
 * streak indicators, trend arrows, and achievement badges.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Trophy, Medal, TrendingUp, Flame, Star,
  DollarSign, Phone, Target, RefreshCw, Crown,
} from 'lucide-react'

interface AgentRank {
  id: string
  name: string
  rank: number
  collections_total: number
  calls_total: number
  contact_rate: number
  avg_handle_time: number
  streak_days: number
  trend: 'up' | 'down' | 'stable'
  badges: string[]
}

type SortBy = 'collections' | 'calls' | 'contact_rate'

const rankIcons = [
  <Crown key="1" className="w-5 h-5 text-yellow-500" />,
  <Medal key="2" className="w-5 h-5 text-gray-400" />,
  <Medal key="3" className="w-5 h-5 text-amber-700" />,
]

const badgeConfig: Record<string, { label: string; color: string }> = {
  top_collector: { label: '💰 Top Collector', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  most_calls: { label: '📞 Call King', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  best_contact: { label: '🎯 Contact Pro', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
  hot_streak: { label: '🔥 On Fire', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  perfect_compliance: { label: '🛡️ Compliant', color: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400' },
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function AgentLeaderboard() {
  const [agents, setAgents] = useState<AgentRank[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('collections')
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet(`/api/analytics/agents?period=${period}`)
      const data = res.data || res.agents || []
      setAgents(
        data.map((a: any, i: number) => ({
          id: a.id || a.agent_id,
          name: a.name || a.agent_name || 'Agent',
          rank: i + 1,
          collections_total: parseFloat(a.collections_total || a.total_collected || 0),
          calls_total: a.calls_total || a.total_calls || 0,
          contact_rate: parseFloat(a.contact_rate || 0),
          avg_handle_time: a.avg_handle_time || 0,
          streak_days: a.streak_days || 0,
          trend: a.trend || 'stable',
          badges: a.badges || [],
        }))
      )
    } catch (err: any) {
      logger.error('Failed to fetch leaderboard', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  const sorted = [...agents].sort((a, b) => {
    if (sortBy === 'collections') return b.collections_total - a.collections_total
    if (sortBy === 'calls') return b.calls_total - a.calls_total
    return b.contact_rate - a.contact_rate
  }).map((a, i) => ({ ...a, rank: i + 1 }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Leaderboard
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Period */}
            <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
              {(['today', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-[10px] font-medium ${
                    period === p ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100' : 'text-gray-500'
                  }`}
                >
                  {p === 'today' ? 'Today' : p === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
            {/* Sort */}
            <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
              {([
                { key: 'collections' as SortBy, icon: <DollarSign className="w-3 h-3" /> },
                { key: 'calls' as SortBy, icon: <Phone className="w-3 h-3" /> },
                { key: 'contact_rate' as SortBy, icon: <Target className="w-3 h-3" /> },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-2 py-1 ${
                    sortBy === s.key ? 'bg-gray-100 dark:bg-gray-800' : 'text-gray-400'
                  }`}
                  title={`Sort by ${s.key}`}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No agent data for this period</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sorted.map((agent) => (
              <div
                key={agent.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  agent.rank <= 3
                    ? 'bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                {/* Rank */}
                <div className="w-8 flex-shrink-0 text-center">
                  {agent.rank <= 3 ? (
                    rankIcons[agent.rank - 1]
                  ) : (
                    <span className="text-sm font-bold text-gray-400">#{agent.rank}</span>
                  )}
                </div>

                {/* Agent info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{agent.name}</span>
                    {agent.streak_days >= 3 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-orange-600">
                        <Flame className="w-3 h-3" />
                        {agent.streak_days}d
                      </span>
                    )}
                    {agent.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
                    {agent.trend === 'down' && <TrendingUp className="w-3.5 h-3.5 text-red-500 rotate-180" />}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {agent.badges.slice(0, 3).map((b) => {
                      const cfg = badgeConfig[b]
                      if (!cfg) return null
                      return (
                        <Badge key={b} className={`text-[9px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                      )
                    })}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 flex-shrink-0 text-right">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase">Collected</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(agent.collections_total)}</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-[10px] text-gray-400 uppercase">Calls</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{agent.calls_total}</p>
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-[10px] text-gray-400 uppercase">Contact</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{agent.contact_rate}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
