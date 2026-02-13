'use client'

/**
 * /payments/reconciliation — Payment reconciliation
 *
 * Compare payments received via Stripe with amounts posted to accounts.
 * Flags mismatches, orphan payments, and unmatched transactions.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeftRight, RefreshCw, CheckCircle, AlertTriangle,
  DollarSign, Search, XCircle,
} from 'lucide-react'

interface ReconciliationItem {
  id: string
  stripe_id: string
  account_id: string
  account_name: string
  stripe_amount: number
  posted_amount: number
  status: 'matched' | 'mismatch' | 'orphan' | 'pending'
  created_at: string
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  matched: { color: 'bg-green-50 text-green-700 dark:bg-green-900/20', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  mismatch: { color: 'bg-red-50 text-red-700 dark:bg-red-900/20', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  orphan: { color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20', icon: <XCircle className="w-3.5 h-3.5" /> },
  pending: { color: 'bg-gray-50 text-gray-600 dark:bg-gray-800', icon: <DollarSign className="w-3.5 h-3.5" /> },
}

export default function ReconciliationPage() {
  const [items, setItems] = useState<ReconciliationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/payments/reconciliation?limit=100')
      const data = res.data || res.items || []
      setItems(data.map((r: any) => ({
        id: r.id,
        stripe_id: r.stripe_id || r.payment_intent_id || '',
        account_id: r.account_id || '',
        account_name: r.account_name || 'Unknown',
        stripe_amount: parseFloat(r.stripe_amount || r.amount || 0),
        posted_amount: parseFloat(r.posted_amount || r.applied_amount || 0),
        status: r.status || 'pending',
        created_at: r.created_at,
      })))
    } catch (err: any) {
      logger.warn('Reconciliation endpoint not available', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)
  const mismatches = items.filter((i) => i.status === 'mismatch').length
  const orphans = items.filter((i) => i.status === 'orphan').length

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reconciliation</h1>
          </div>
          <p className="text-sm text-gray-500">Stripe payments vs. account postings</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{items.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Matched</p>
          <p className="text-2xl font-bold text-green-600">{items.filter((i) => i.status === 'matched').length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Mismatches</p>
          <p className="text-2xl font-bold text-red-600">{mismatches}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Orphans</p>
          <p className="text-2xl font-bold text-amber-600">{orphans}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4">
        {['all', 'matched', 'mismatch', 'orphan', 'pending'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              filter === f
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Account</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Stripe</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Posted</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Diff</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="py-2.5 px-4">
                      <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-500 text-sm">
                    <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    No reconciliation data
                  </td></tr>
                ) : (
                  filtered.map((item) => {
                    const diff = item.stripe_amount - item.posted_amount
                    const cfg = statusConfig[item.status]
                    return (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 px-4">
                          <Badge className={`text-[10px] gap-1 ${cfg.color}`}>
                            {cfg.icon} {item.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-700 dark:text-gray-300">{item.account_name}</td>
                        <td className="py-2 px-4 text-xs text-right font-mono">${item.stripe_amount.toFixed(2)}</td>
                        <td className="py-2 px-4 text-xs text-right font-mono">${item.posted_amount.toFixed(2)}</td>
                        <td className={`py-2 px-4 text-xs text-right font-mono font-medium ${
                          Math.abs(diff) > 0.01 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {diff === 0 ? '—' : `$${diff.toFixed(2)}`}
                        </td>
                        <td className="py-2 px-4 text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
