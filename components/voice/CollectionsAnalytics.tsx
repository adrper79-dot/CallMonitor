'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface PortfolioStats {
  total_accounts: number
  total_balance_due: string
  active_accounts: number
  paid_accounts: number
  partial_accounts: number
  disputed_accounts: number
  archived_accounts: number
  total_payments: number
  recovery_rate: number
  pending_tasks: number
  total_recovered: string
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0)
}

/**
 * CollectionsAnalytics — Portfolio performance dashboard
 *
 * Displays aggregate stats, status distribution bar, and recovery metrics.
 * Fetches data from GET /api/collections/stats.
 */
export default function CollectionsAnalytics() {
  const [stats, setStats] = useState<PortfolioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<{ stats: PortfolioStats }>('/api/collections/stats')
      .then((data) => setStats(data.stats || null))
      .catch((err) => {
        logger.error('Failed to fetch collections analytics', { error: err })
        setError(err?.message || 'Failed to load analytics')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg bg-white border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-100 rounded" />
            <div className="h-20 bg-gray-100 rounded" />
            <div className="h-20 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg bg-white border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">{error || 'No data available'}</p>
      </div>
    )
  }

  const totalDue = parseFloat(stats.total_balance_due) || 0
  const totalRecovered = parseFloat(stats.total_recovered) || 0
  const totalPayments = stats.total_payments || 0
  const totalAccounts = stats.total_accounts || 0

  // Status distribution for bar chart
  const statusSegments = [
    { label: 'Active', count: stats.active_accounts, color: 'bg-blue-500' },
    { label: 'Partial', count: stats.partial_accounts, color: 'bg-yellow-500' },
    { label: 'Paid', count: stats.paid_accounts, color: 'bg-green-500' },
    { label: 'Disputed', count: stats.disputed_accounts, color: 'bg-red-500' },
    { label: 'Archived', count: stats.archived_accounts, color: 'bg-gray-400' },
  ].filter((s) => s.count > 0)

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-base font-semibold text-gray-900">Executive Insights</h3>
        <p className="text-sm text-gray-500">Real-time performance metrics and recovery analytics</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding Balance</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalDue)}</p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Recovered</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalPayments)}</p>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recovery Rate</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.recovery_rate}%</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(stats.recovery_rate, 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Tasks</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{stats.pending_tasks}</p>
        </div>
      </div>

      {/* Status Distribution Bar */}
      {totalAccounts > 0 && (
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Account Status Distribution ({totalAccounts} total)
          </p>
          <div className="flex w-full h-6 rounded-full overflow-hidden">
            {statusSegments.map((seg) => (
              <div
                key={seg.label}
                className={`${seg.color} transition-all`}
                style={{ width: `${(seg.count / totalAccounts) * 100}%` }}
                title={`${seg.label}: ${seg.count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            {statusSegments.map((seg) => (
              <div key={seg.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${seg.color}`} />
                {seg.label}: {seg.count} ({Math.round((seg.count / totalAccounts) * 100)}%)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
