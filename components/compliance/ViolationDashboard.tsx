'use client'

/**
 * ViolationDashboard — Compliance violations viewer
 *
 * Fetches from /api/compliance (existing endpoint), shows violations
 * by severity, type, agent, with trend cards and filterable list.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle, ShieldAlert, ShieldCheck, Clock,
  RefreshCw, ChevronDown, Search, Filter,
} from 'lucide-react'

interface Violation {
  id: string
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  agent_id?: string
  agent_name?: string
  account_id?: string
  call_id?: string
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive'
  created_at: string
  regulation: string
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
}

const statusColors: Record<string, string> = {
  open: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  acknowledged: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  resolved: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  false_positive: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export default function ViolationDashboard() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchViolations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/compliance?limit=200')
      const data = res.data || res.violations || []
      setViolations(
        data.map((v: any) => ({
          id: v.id,
          type: v.type || v.violation_type || 'Unknown',
          severity: v.severity || 'medium',
          description: v.description || '',
          agent_id: v.agent_id,
          agent_name: v.agent_name,
          account_id: v.account_id,
          call_id: v.call_id,
          status: v.status || 'open',
          created_at: v.created_at,
          regulation: v.regulation || v.rule || 'FDCPA',
        }))
      )
    } catch (err: any) {
      logger.error('Failed to fetch violations', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchViolations() }, [fetchViolations])

  const filtered = violations.filter((v) => {
    if (severityFilter !== 'all' && v.severity !== severityFilter) return false
    if (statusFilter !== 'all' && v.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        v.description.toLowerCase().includes(q) ||
        v.type.toLowerCase().includes(q) ||
        v.agent_name?.toLowerCase().includes(q) ||
        v.regulation.toLowerCase().includes(q)
      )
    }
    return true
  })

  const stats = {
    total: violations.length,
    open: violations.filter((v) => v.status === 'open').length,
    critical: violations.filter((v) => v.severity === 'critical').length,
    thisWeek: violations.filter((v) => {
      const d = new Date(v.created_at)
      const now = new Date()
      return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000
    }).length,
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Open</p>
            <p className="text-2xl font-bold text-red-600">{stats.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Critical</p>
            <p className="text-2xl font-bold text-red-700">{stats.critical}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">This Week</p>
            <p className="text-2xl font-bold text-amber-600">{stats.thisWeek}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search violations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="false_positive">False Positive</option>
        </select>
        <Button variant="outline" size="sm" onClick={fetchViolations} className="gap-1 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-300" />
            <p className="text-sm font-medium">No violations match your filters</p>
          </div>
        ) : (
          filtered.map((v) => (
            <Card key={v.id} className={v.severity === 'critical' ? 'border-red-200 dark:border-red-800' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${severityColors[v.severity]}`}>
                    {v.severity === 'critical' ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{v.type}</span>
                      <Badge className={`text-[10px] ${severityColors[v.severity]}`}>{v.severity}</Badge>
                      <Badge className={`text-[10px] ${statusColors[v.status]}`}>{v.status.replace('_', ' ')}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{v.regulation}</Badge>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5 line-clamp-1">{v.description}</p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(v.created_at).toLocaleDateString()}
                      {v.agent_name && ` • ${v.agent_name}`}
                      {v.account_id && (
                        <>
                          {' • '}
                          <Link href={`/accounts/${v.account_id}`} prefetch={false} className="text-primary-600 hover:underline">
                            Account
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
