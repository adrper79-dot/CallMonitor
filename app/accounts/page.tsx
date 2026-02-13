'use client'

/**
 * /accounts — Account portfolio page
 *
 * Lists all collection accounts with search, filters, and stats.
 * Reuses existing AccountsPage component from voice-operations.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from '@/components/AuthProvider'
import { apiGet, apiPost, apiDelete } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Search, Plus, Phone, DollarSign, CheckCircle, Clock,
  AlertTriangle, ArrowRight, Filter, Upload, RefreshCw,
  Users, TrendingUp,
} from 'lucide-react'

interface CollectionAccount {
  id: string
  external_id: string | null
  name: string
  balance_due: string
  primary_phone: string
  status: 'active' | 'paid' | 'partial' | 'disputed' | 'archived'
  last_contacted_at: string | null
  promise_date: string | null
  promise_amount: string | null
  created_at: string
}

interface PortfolioStats {
  total_accounts: number
  total_balance_due: string
  active_accounts: number
  paid_accounts: number
  recovery_rate: number
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  disputed: { label: 'Disputed', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
}

export default function AccountsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<CollectionAccount[]>([])
  const [stats, setStats] = useState<PortfolioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')

  const orgId = session?.user?.organization_id

  const fetchData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [acctData, statsData] = await Promise.all([
        apiGet(`/api/collections?limit=100&status=${statusFilter !== 'all' ? statusFilter : ''}&search=${encodeURIComponent(search)}`),
        apiGet('/api/collections/stats').catch(() => null),
      ])
      setAccounts(acctData.data || acctData.accounts || [])
      setStats(statsData?.data || statsData || null)
    } catch (err: any) {
      logger.error('Failed to load accounts', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [orgId, search, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Portfolio of {stats?.total_accounts || accounts.length} accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Active</p>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.active_accounts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Balance</p>
                <DollarSign className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                ${parseFloat(stats.total_balance_due || '0').toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Paid</p>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.paid_accounts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Recovery</p>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.recovery_rate || 0}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, or ID..."
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
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="disputed">Disputed</option>
          <option value="archived">Archived</option>
        </select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchData}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No accounts found</p>
            <p className="text-xs">Try adjusting your filters or import accounts</p>
          </div>
        ) : (
          accounts.map((account) => (
            <Link key={account.id} href={`/accounts/${account.id}`} className="block">
              <Card className="hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {account.name}
                        </p>
                        <Badge className={`text-[10px] ${statusConfig[account.status]?.color || 'bg-gray-100'}`}>
                          {statusConfig[account.status]?.label || account.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{account.primary_phone}</span>
                        {account.last_contacted_at && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            Last: {new Date(account.last_contacted_at).toLocaleDateString()}
                          </span>
                        )}
                        {account.promise_date && (
                          <span className="flex items-center gap-0.5 text-blue-600">
                            <AlertTriangle className="w-3 h-3" />
                            Promise: {new Date(account.promise_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        ${parseFloat(account.balance_due || '0').toLocaleString()}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
