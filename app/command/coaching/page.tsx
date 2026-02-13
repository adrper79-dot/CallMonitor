'use client'

/**
 * /command/coaching — Live coaching queue
 *
 * Shows agents flagged for coaching with call playback, annotation tools.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Headphones, Play, MessageSquare, AlertTriangle,
  CheckCircle, Clock, User, RefreshCw, ArrowRight,
} from 'lucide-react'

interface CoachingItem {
  id: string
  agent_id: string
  agent_name: string
  call_id: string
  call_date: string
  reason: string
  severity: 'critical' | 'warning' | 'suggestion'
  status: 'pending' | 'reviewed' | 'acknowledged'
  notes?: string
  score?: number
}

const severityConfig = {
  critical: { color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  warning: { color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400', icon: <Clock className="w-3.5 h-3.5" /> },
  suggestion: { color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', icon: <MessageSquare className="w-3.5 h-3.5" /> },
}

export default function CoachingPage() {
  const [items, setItems] = useState<CoachingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'pending'>('all')

  const fetchCoaching = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/scorecards?include=coaching')
      const data = res.data || res.coaching || []
      setItems(
        data.map((c: any) => ({
          id: c.id,
          agent_id: c.agent_id,
          agent_name: c.agent_name || 'Agent',
          call_id: c.call_id,
          call_date: c.call_date || c.created_at,
          reason: c.reason || c.description || 'Review needed',
          severity: c.severity || 'suggestion',
          status: c.status || 'pending',
          notes: c.notes,
          score: c.score,
        }))
      )
    } catch (err: any) {
      logger.error('Failed to fetch coaching queue', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCoaching() }, [fetchCoaching])

  const filtered = items.filter((i) => {
    if (filter === 'critical') return i.severity === 'critical'
    if (filter === 'pending') return i.status === 'pending'
    return true
  })

  const stats = {
    total: items.length,
    critical: items.filter((i) => i.severity === 'critical').length,
    pending: items.filter((i) => i.status === 'pending').length,
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Coaching Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review flagged calls and coach agents</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCoaching} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Critical</p>
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(['all', 'critical', 'pending'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              filter === f
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
            }`}
          >
            {f === 'all' ? 'All' : f === 'critical' ? 'Critical Only' : 'Pending'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
            <p className="text-sm font-medium">No coaching items match your filter</p>
          </div>
        ) : (
          filtered.map((item) => {
            const sev = severityConfig[item.severity]
            return (
              <Card key={item.id} className={item.severity === 'critical' ? 'border-red-200 dark:border-red-800' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${sev.color}`}>
                      {sev.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.agent_name}</span>
                        <Badge className={`text-[10px] ${sev.color}`}>{item.severity}</Badge>
                        {item.status === 'pending' && <Badge className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-900/20">Pending</Badge>}
                        {item.status === 'reviewed' && <Badge className="text-[10px] bg-green-50 text-green-700 dark:bg-green-900/20">Reviewed</Badge>}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{item.reason}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(item.call_date).toLocaleDateString()} • Call #{item.call_id?.slice(0, 8)}
                        {item.score !== undefined && ` • Score: ${item.score}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <Play className="w-3 h-3" />
                        Play
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                        <Headphones className="w-3 h-3" />
                        Review
                      </Button>
                    </div>
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
