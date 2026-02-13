'use client'

/**
 * FollowUpTracker — Promise-to-pay tracking board
 *
 * Shows all pending promises with due dates, amounts, and auto-escalation indicators.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock, AlertTriangle, CheckCircle, Phone, DollarSign,
  ArrowRight, RefreshCw, CalendarClock, TrendingDown,
} from 'lucide-react'

interface FollowUp {
  id: string
  account_id: string
  account_name: string
  phone: string
  promise_amount: number
  promise_date: string
  status: 'pending' | 'fulfilled' | 'broken' | 'overdue'
  created_at: string
  days_until_due: number
}

export default function FollowUpTracker() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'overdue' | 'due_today' | 'upcoming'>('all')

  const fetchFollowUps = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet('/api/collections/promises?limit=100')
      const items: FollowUp[] = (data.data || data.promises || []).map((p: any) => {
        const dueDate = new Date(p.promise_date)
        const now = new Date()
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return {
          ...p,
          promise_amount: parseFloat(p.promise_amount || 0),
          days_until_due: diffDays,
          status: p.status || (diffDays < 0 ? 'overdue' : diffDays === 0 ? 'pending' : 'pending'),
        }
      })
      setFollowUps(items)
    } catch (err: any) {
      logger.error('Failed to load follow-ups', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFollowUps() }, [fetchFollowUps])

  const filtered = followUps.filter((f) => {
    if (filter === 'overdue') return f.days_until_due < 0 || f.status === 'overdue'
    if (filter === 'due_today') return f.days_until_due === 0
    if (filter === 'upcoming') return f.days_until_due > 0 && f.days_until_due <= 7
    return true
  })

  const stats = {
    total: followUps.length,
    overdue: followUps.filter((f) => f.days_until_due < 0).length,
    dueToday: followUps.filter((f) => f.days_until_due === 0).length,
    totalAmount: followUps.reduce((s, f) => s + f.promise_amount, 0),
  }

  const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', icon: <Clock className="w-3.5 h-3.5" /> },
    overdue: { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    fulfilled: { color: 'text-green-600 bg-green-50 dark:bg-green-900/20', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    broken: { color: 'text-red-600 bg-red-50 dark:bg-red-900/20', icon: <TrendingDown className="w-3.5 h-3.5" /> },
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Follow-Ups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Promise-to-pay tracking</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFollowUps} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Overdue</p>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Due Today</p>
            <p className="text-2xl font-bold text-amber-600">{stats.dueToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Value</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${stats.totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4">
        {(['all', 'overdue', 'due_today', 'upcoming'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              filter === f
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
            }`}
          >
            {f === 'all' ? 'All' : f === 'overdue' ? 'Overdue' : f === 'due_today' ? 'Due Today' : 'This Week'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CalendarClock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No follow-ups match your filter</p>
          </div>
        ) : (
          filtered.map((fu) => {
            const cfg = statusConfig[fu.status] || statusConfig.pending
            return (
              <Card key={fu.id} className={fu.days_until_due < 0 ? 'border-red-200 dark:border-red-800' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/accounts/${fu.account_id}`}
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate"
                        >
                          {fu.account_name}
                        </Link>
                        <Badge className={`text-[10px] ${cfg.color}`}>{fu.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        Due {new Date(fu.promise_date).toLocaleDateString()}
                        {fu.days_until_due < 0 && (
                          <span className="text-red-600 font-medium"> ({Math.abs(fu.days_until_due)}d overdue)</span>
                        )}
                        {fu.days_until_due === 0 && (
                          <span className="text-amber-600 font-medium"> (today)</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">${fu.promise_amount.toLocaleString()}</p>
                    </div>
                    <Link href={`/work/call?account=${fu.account_id}`}>
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <Phone className="w-3 h-3" />
                        Call
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
