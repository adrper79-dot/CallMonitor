'use client'

/**
 * /work — Agent daily planner landing page
 *
 * Shows today's queue stats, daily targets, scheduled callbacks,
 * and quick-launch into the Cockpit.
 */

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Phone, Target, TrendingUp, Clock, CalendarClock,
  Zap, ArrowRight, ListTodo, CreditCard, AlertTriangle,
  CheckCircle, Flame,
} from 'lucide-react'

interface DailyStats {
  queue_count: number
  calls_today: number
  target_calls: number
  collected_today: number
  target_amount: number
  callbacks_due: number
  critical_accounts: number
  avg_score: number
}

export default function WorkPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DailyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [callbacks, setCallbacks] = useState<any[]>([])

  useEffect(() => {
    if (!session?.user?.organization_id) return

    const loadData = async () => {
      try {
        const [statsData, cbData] = await Promise.all([
          apiGet('/api/collections/daily-stats').catch(() => null),
          apiGet('/api/collections/callbacks?today=true&limit=5').catch(() => null),
        ])

        setStats(statsData?.data || {
          queue_count: 0,
          calls_today: 0,
          target_calls: 40,
          collected_today: 0,
          target_amount: 5000,
          callbacks_due: 0,
          critical_accounts: 0,
          avg_score: 0,
        })

        setCallbacks(cbData?.data || cbData?.callbacks || [])
      } catch (err: any) {
        logger.error('Failed to load daily stats', { error: err?.message })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [session?.user?.organization_id])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const callProgress = stats ? Math.min(100, Math.round((stats.calls_today / (stats.target_calls || 40)) * 100)) : 0
  const collectProgress = stats ? Math.min(100, Math.round((stats.collected_today / (stats.target_amount || 5000)) * 100)) : 0

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {greeting()}, {session?.user?.name?.split(' ')[0] || 'Agent'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/work/call">
          <Button className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
            <Phone className="w-4 h-4" />
            Launch Cockpit
          </Button>
        </Link>
      </div>

      {/* Daily Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Queue</p>
              <ListTodo className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.queue_count || 0}</p>
            <p className="text-[10px] text-gray-500">accounts to work</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Calls</p>
              <Phone className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats?.calls_today || 0}
              <span className="text-sm text-gray-400 font-normal">/{stats?.target_calls || 40}</span>
            </p>
            <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${callProgress >= 100 ? 'bg-green-500' : callProgress >= 75 ? 'bg-blue-500' : 'bg-amber-500'}`}
                style={{ width: `${callProgress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Collected</p>
              <CreditCard className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${(stats?.collected_today || 0).toLocaleString()}
            </p>
            <div className="mt-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${collectProgress >= 100 ? 'bg-green-500' : 'bg-emerald-500'}`}
                style={{ width: `${collectProgress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Critical</p>
              <Flame className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{stats?.critical_accounts || 0}</p>
            <p className="text-[10px] text-gray-500">high-priority accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Callbacks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/work/call" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Start Calling</p>
                  <p className="text-xs text-gray-500">Launch the Cockpit workspace</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>

            <Link href="/work/queue" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <ListTodo className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">View Full Queue</p>
                  <p className="text-xs text-gray-500">Browse & filter all accounts</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>

            <Link href="/work/payments" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Payments Today</p>
                  <p className="text-xs text-gray-500">Track promises & payments</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Upcoming Callbacks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-blue-500" />
              Callbacks Due Today
              {callbacks.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px]">{callbacks.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callbacks.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm font-medium">No callbacks due</p>
                <p className="text-xs">You&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {callbacks.slice(0, 5).map((cb: any) => (
                  <div
                    key={cb.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {cb.account_name || cb.name || 'Account'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {cb.scheduled_time
                          ? new Date(cb.scheduled_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          : 'Anytime today'}
                      </p>
                    </div>
                    <Link href={`/work/call?account=${cb.account_id || cb.id}`}>
                      <Button variant="outline" size="sm" className="text-xs gap-1">
                        <Phone className="w-3 h-3" />
                        Call
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
