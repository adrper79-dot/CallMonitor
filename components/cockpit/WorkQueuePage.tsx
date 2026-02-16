'use client'

/**
 * WorkQueuePage — Full-screen AI-prioritized account queue
 *
 * Shows all accounts sorted by AI likelihood score and urgency.
 * This is the standalone queue view (vs. the slim rail in the Cockpit).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Search, Filter, SortAsc, SortDesc, Phone, Zap,
  ArrowRight, AlertTriangle, Clock, RefreshCw,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import type { QueueAccount } from '@/components/cockpit/Cockpit'

interface WorkQueuePageProps {
  organizationId: string | null
}

type SortField = 'priority' | 'balance' | 'days_overdue' | 'likelihood' | 'last_contact'
type SortDir = 'asc' | 'desc'

export default function WorkQueuePage({ organizationId }: WorkQueuePageProps) {
  const [accounts, setAccounts] = useState<QueueAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('priority')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchAccounts = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const data = await apiGet(`/api/collections?limit=100&sort=priority`)
      const mapped: QueueAccount[] = (data.data || data.accounts || []).map((a: any) => ({
        id: a.id,
        name: a.name || a.account_name || 'Unknown',
        primary_phone: a.primary_phone || a.phone || '',
        balance_due: parseFloat(a.balance_due || a.balance || 0),
        days_past_due: a.days_past_due || a.overdue_days || 0,
        status: a.status || 'active',
        likelihood_score: a.likelihood_score ?? null,
        last_contacted_at: a.last_contacted_at || null,
        contact_count_7day: a.contact_count_7day || 0,
        priority: a.likelihood_score >= 70 ? 'critical'
          : a.likelihood_score >= 50 ? 'high'
          : a.likelihood_score >= 30 ? 'medium'
          : 'low',
      }))
      setAccounts(mapped)
    } catch (err: any) {
      logger.error('Failed to load accounts', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  // Filter and sort
  const filtered = useMemo(() => {
    let result = accounts

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.primary_phone.includes(q)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter)
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'priority':
          const pMap = { critical: 4, high: 3, medium: 2, low: 1 }
          cmp = (pMap[a.priority] || 0) - (pMap[b.priority] || 0)
          break
        case 'balance':
          cmp = a.balance_due - b.balance_due
          break
        case 'days_overdue':
          cmp = a.days_past_due - b.days_past_due
          break
        case 'likelihood':
          cmp = (a.likelihood_score || 0) - (b.likelihood_score || 0)
          break
        case 'last_contact':
          cmp = new Date(a.last_contacted_at || 0).getTime() - new Date(b.last_contacted_at || 0).getTime()
          break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [accounts, search, statusFilter, sortField, sortDir])

  const stats = useMemo(() => ({
    total: accounts.length,
    critical: accounts.filter((a) => a.priority === 'critical').length,
    totalBalance: accounts.reduce((sum, a) => sum + a.balance_due, 0),
    avgScore: accounts.length > 0
      ? Math.round(accounts.reduce((sum, a) => sum + (a.likelihood_score || 0), 0) / accounts.length)
      : 0,
  }), [accounts])

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Work Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-prioritized accounts ready to work</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAccounts} className="gap-1.5">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Link href="/work/call">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
              <Phone className="w-4 h-4" />
              Start Calling
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500 font-medium">Total Accounts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500 font-medium">Critical Priority</p>
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500 font-medium">Total Balance</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${stats.totalBalance.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500 font-medium">Avg AI Score</p>
            <p className="text-2xl font-bold text-amber-600">{stats.avgScore}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="disputed">Disputed</option>
          <option value="payment_plan">Payment Plan</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-2.5 text-left">
                  <button onClick={() => toggleSort('priority')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700">
                    Priority <SortIcon field="priority" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-4 py-2.5 text-right">
                  <button onClick={() => toggleSort('balance')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto">
                    Balance <SortIcon field="balance" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right">
                  <button onClick={() => toggleSort('days_overdue')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto">
                    Overdue <SortIcon field="days_overdue" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-center">
                  <button onClick={() => toggleSort('likelihood')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 mx-auto">
                    AI Score <SortIcon field="likelihood" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">7-Day</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <p className="font-medium">No accounts match your filters</p>
                  </td>
                </tr>
              ) : (
                filtered.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Badge className={`text-[10px] ${priorityColors[account.priority]}`}>
                        {account.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>
                        <Link
                          href={`/accounts/${account.id}`}
                          prefetch={false}
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {account.name}
                        </Link>
                        <p className="text-xs text-gray-500">{account.primary_phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        ${account.balance_due.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={account.days_past_due > 60 ? 'text-red-600 font-medium' : 'text-gray-700 dark:text-gray-300'}>
                        {account.days_past_due}d
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {account.likelihood_score !== null ? (
                        <span className="flex items-center justify-center gap-0.5">
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span className={`font-medium ${
                            account.likelihood_score >= 70 ? 'text-green-600' :
                            account.likelihood_score >= 40 ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {account.likelihood_score}%
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs ${account.contact_count_7day >= 6 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        {account.contact_count_7day}/7
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/work/call?account=${account.id}`}>
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <Phone className="w-3 h-3" />
                          Call
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
