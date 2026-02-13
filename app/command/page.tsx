'use client'

/**
 * /command — Manager Command Center
 *
 * Real-time team overview with LiveBoard, stats, and coaching access.
 * Replaces old /manager with role-shell-aware layout.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users, Phone, DollarSign, TrendingUp, Activity, RefreshCw,
  Headphones, BarChart3, Clock, Target, ShieldCheck,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const LiveBoard = dynamic(() => import('@/components/manager/LiveBoard'), { ssr: false })

interface TeamStats {
  total_members: number
  active_callers: number
  total_calls_today: number
  total_collections_today: number
  avg_call_duration: number
  team_efficiency: number
}

export default function CommandPage() {
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiGet('/api/manager/team-stats')
      if (res.success) setStats(res.stats)
    } catch (err: any) {
      logger.error('Failed to fetch team stats', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time team performance & monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">Auto-refresh 30s</span>
          <Button variant="outline" size="sm" onClick={fetchStats} className="gap-1.5">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-14 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></CardContent></Card>
          ))
        ) : stats ? (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Callers</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {stats.active_callers}<span className="text-sm text-gray-400">/{stats.total_members}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Calls Today</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total_calls_today}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Collected</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(stats.total_collections_today)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Efficiency</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.team_efficiency}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* LiveBoard */}
      <LiveBoard />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/command/scorecards">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Scorecards</p>
                <p className="text-xs text-gray-500">Review agent compliance scores</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/command/coaching">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                <Headphones className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Coaching</p>
                <p className="text-xs text-gray-500">Listen in & coach agents live</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/compliance">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Compliance</p>
                <p className="text-xs text-gray-500">Violations, disputes, DNC</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
