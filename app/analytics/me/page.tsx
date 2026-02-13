'use client'

/**
 * /analytics/me — Personal agent scorecard
 *
 * Shows the logged-in agent's own performance metrics:
 * calls made, collections, compliance score, handle time, etc.
 */

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy, Phone, DollarSign, Clock, ShieldCheck,
  TrendingUp, TrendingDown, Target, Loader2,
} from 'lucide-react'

interface MyStats {
  calls_today: number
  calls_this_week: number
  collections_today: number
  collections_this_week: number
  avg_handle_time: number
  compliance_score: number
  conversion_rate: number
  rank: number
  total_agents: number
}

export default function MyPerformancePage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<MyStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return

    apiGet(`/api/analytics/agent/${userId}`)
      .then((data: any) => {
        setStats({
          calls_today: data.calls_today || 0,
          calls_this_week: data.calls_this_week || 0,
          collections_today: data.collections_today || 0,
          collections_this_week: data.collections_this_week || 0,
          avg_handle_time: data.avg_handle_time || 0,
          compliance_score: data.compliance_score || 100,
          conversion_rate: data.conversion_rate || 0,
          rank: data.rank || 0,
          total_agents: data.total_agents || 0,
        })
      })
      .catch((err: any) => {
        logger.warn('Agent stats not available', { error: err?.message })
      })
      .finally(() => setLoading(false))
  }, [session])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Performance</h1>
        </div>
        <p className="text-sm text-gray-500">
          Your personal scorecard
          {stats?.rank ? ` — Rank #${stats.rank} of ${stats.total_agents}` : ''}
        </p>
      </div>

      {/* Today's KPIs */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Today</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4 text-blue-500" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Calls</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.calls_today || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Collected</p>
            </div>
            <p className="text-2xl font-bold text-green-600">${(stats?.collections_today || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-500" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Avg Handle</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDuration(stats?.avg_handle_time || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-amber-500" />
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Conversion</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.conversion_rate || 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* This Week */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">This Week</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Calls</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.calls_this_week || 0}</p>
              </div>
              <Phone className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Collected</p>
                <p className="text-3xl font-bold text-green-600">${(stats?.collections_this_week || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Compliance</h2>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              (stats?.compliance_score || 0) >= 90
                ? 'bg-green-100 dark:bg-green-900/30'
                : (stats?.compliance_score || 0) >= 70
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              <span className={`text-xl font-bold ${
                (stats?.compliance_score || 0) >= 90 ? 'text-green-700' :
                (stats?.compliance_score || 0) >= 70 ? 'text-amber-700' : 'text-red-700'
              }`}>
                {stats?.compliance_score || 0}%
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Compliance Score</p>
              <p className="text-xs text-gray-500">Based on call recordings, disposition accuracy, and regulation adherence</p>
              {(stats?.compliance_score || 0) >= 95 && (
                <Badge className="mt-1 bg-green-50 text-green-700 text-[10px]">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Exemplary
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
