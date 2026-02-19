'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from '@/components/AuthProvider'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import CollectionsAnalytics from '@/components/voice/CollectionsAnalytics'
import PaymentHistoryChart from '@/components/voice/PaymentHistoryChart'
import SmartImportWizard from '@/components/voice/SmartImportWizard'
import {
  AlertTriangle,
  Plus,
  Upload,
  Search,
  Phone,
  DollarSign,
  CheckCircle,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'

interface CollectionAccount {
  id: string
  external_id: string | null
  source: string
  name: string
  balance_due: string
  primary_phone: string
  secondary_phone: string | null
  email: string | null
  status: 'active' | 'paid' | 'partial' | 'disputed' | 'archived'
  notes: string | null
  promise_date: string | null
  promise_amount: string | null
  last_contacted_at: string | null
  created_at: string
  updated_at: string
}

interface PortfolioStats {
  total_accounts: number
  total_balance_due: string
  active_accounts: number
  paid_accounts: number
  partial_accounts: number
  disputed_accounts: number
  total_payments: number
  recovery_rate: number
  pending_tasks: number
}

const statusColors: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  disputed: 'bg-red-100 text-red-800',
  archived: 'bg-gray-100 text-gray-800',
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0)
}

export default function CollectionsPage() {
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [accounts, setAccounts] = useState<CollectionAccount[]>([])
  const [stats, setStats] = useState<PortfolioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const tabParam = searchParams.get('tab')
  const historyParam = searchParams.get('history')
  const initialTab: 'accounts' | 'analytics' | 'import' =
    tabParam === 'analytics' || tabParam === 'import' ? tabParam : 'accounts'
  const [activeTab, setActiveTab] = useState<'accounts' | 'analytics' | 'import'>(initialTab)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const query = params.toString() ? `?${params.toString()}` : ''

      const [accountsData, statsData] = await Promise.all([
        apiGet<{ accounts: CollectionAccount[] }>(`/api/collections${query}`),
        apiGet<{ stats: PortfolioStats }>('/api/collections/stats'),
      ])

      setAccounts(accountsData.accounts || [])
      setStats(statsData.stats || null)
    } catch (err: any) {
      logger.error('Failed to fetch collections data', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchData()
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
  }, [session, status, fetchData])

  const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await apiPost('/api/collections', {
        name: form.get('name') as string,
        balance_due: parseFloat(form.get('balance_due') as string),
        primary_phone: form.get('primary_phone') as string,
        email: (form.get('email') as string) || undefined,
        notes: (form.get('notes') as string) || undefined,
      })
      setShowCreateForm(false)
      fetchData()
    } catch (err: any) {
      logger.error('Failed to create account', err)
      setError(err.message)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading collections...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session?.user) {
    return (
      <ProtectedGate
        title="Collections"
        description="Please sign in to access your collections workspace."
        redirectUrl="/voice-operations/accounts"
      />
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Unable to load collections</h2>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
            <p className="text-sm text-gray-500">Manage collection accounts and payments</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab('import')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Import CSV
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Add Account
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-6 border-b border-gray-200">
          {[
            { id: 'accounts' as const, label: 'Accounts' },
            { id: 'analytics' as const, label: 'Analytics' },
            { id: 'import' as const, label: 'Bulk Import' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Analytics Tab */}
        {activeTab === 'analytics' && <CollectionsAnalytics />}

        {/* Bulk Import Tab */}
        {activeTab === 'import' && (
          <SmartImportWizard
            onComplete={fetchData}
          />
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && <>
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-lg bg-white p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <BarChart3 className="h-4 w-4" />
                Total Accounts
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total_accounts}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <DollarSign className="h-4 w-4" />
                Total Due
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.total_balance_due)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle className="h-4 w-4" />
                Payments
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(stats.total_payments)}</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <BarChart3 className="h-4 w-4" />
                Recovery Rate
              </div>
              <p className="text-2xl font-bold mt-1">{stats.recovery_rate}%</p>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-sm border">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                Pending Tasks
              </div>
              <p className="text-2xl font-bold mt-1">{stats.pending_tasks}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="disputed">Disputed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Create Account Form */}
        {showCreateForm && (
          <div className="rounded-lg bg-white p-6 shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Collection Account</h2>
              <button onClick={() => setShowCreateForm(false)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input name="name" required className="w-full rounded border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Balance Due *
                </label>
                <input
                  name="balance_due"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Phone *
                </label>
                <input
                  name="primary_phone"
                  placeholder="+1..."
                  required
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Expanded Account Detail with Payment History */}
        {expandedId && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
            <PaymentHistoryChart accountId={expandedId} />
          </div>
        )}

        {/* Accounts Table */}
        <div className="rounded-lg bg-white shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500"></th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Balance Due</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Last Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No collection accounts found. Click &quot;Add Account&quot; to create one.
                  </td>
                </tr>
              ) : (
                accounts.map((acct) => (
                  <tr
                    key={acct.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === acct.id ? null : acct.id)}
                  >
                    <td className="px-4 py-3">
                      {expandedId === acct.id ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{acct.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {acct.primary_phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(acct.balance_due)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[acct.status] || statusColors.active}`}
                      >
                        {acct.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{acct.source}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {acct.last_contacted_at
                        ? new Date(acct.last_contacted_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </> /* End accounts tab */}
      </div>
    </div>
  )
}
