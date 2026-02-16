'use client'

/**
 * /payments/failed — Failed payment tracker
 *
 * Shows declined, bounced, and errored payment attempts
 * with retry options and account escalation actions.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  XCircle, RefreshCw, CreditCard, AlertTriangle,
  Phone, DollarSign, Search,
} from 'lucide-react'

interface FailedPayment {
  id: string
  account_id: string
  account_name: string
  amount: number
  reason: string
  payment_method: string
  attempts: number
  last_attempt: string
  status: 'failed' | 'retrying' | 'abandoned'
}

export default function FailedPaymentsPage() {
  const [payments, setPayments] = useState<FailedPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchFailed = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/payments?status=failed&limit=100')
      const data = res.data || res.payments || []
      setPayments(data.map((p: any) => ({
        id: p.id,
        account_id: p.account_id,
        account_name: p.account_name || 'Unknown',
        amount: parseFloat(p.amount || 0),
        reason: p.reason || p.failure_reason || p.decline_reason || 'Unknown',
        payment_method: p.payment_method || p.method || 'card',
        attempts: p.attempts || p.retry_count || 1,
        last_attempt: p.last_attempt || p.updated_at || p.created_at,
        status: p.status || 'failed',
      })))
    } catch (err: any) {
      logger.warn('Failed payments endpoint not available', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFailed() }, [fetchFailed])

  const filtered = search
    ? payments.filter((p) => p.account_name.toLowerCase().includes(search.toLowerCase()) || p.reason.toLowerCase().includes(search.toLowerCase()))
    : payments

  const totalLost = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-5 h-5 text-red-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Failed Payments</h1>
          </div>
          <p className="text-sm text-gray-500">Declined, bounced, and errored transactions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFailed} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Failed</p>
          <p className="text-2xl font-bold text-red-600">{payments.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Revenue at Risk</p>
          <p className="text-2xl font-bold text-red-600">${totalLost.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Retrying</p>
          <p className="text-2xl font-bold text-amber-600">{payments.filter((p) => p.status === 'retrying').length}</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by account or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 outline-none"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">{payments.length === 0 ? 'No failed payments' : 'No matches'}</p>
          </div>
        ) : (
          filtered.map((p) => (
            <Card key={p.id} className={p.attempts >= 3 ? 'border-red-200 dark:border-red-800' : ''}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-50 dark:bg-red-900/20 text-red-600">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/accounts/${p.account_id}`}
                        prefetch={false}
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600"
                      >
                        {p.account_name}
                      </Link>
                      <Badge variant="secondary" className="text-[10px]">{p.payment_method}</Badge>
                    </div>
                    <p className="text-xs text-red-600">{p.reason}</p>
                    <p className="text-[10px] text-gray-400">
                      {p.attempts} attempt{p.attempts > 1 ? 's' : ''} • Last: {new Date(p.last_attempt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <p className="text-sm font-bold text-red-600">${p.amount.toLocaleString()}</p>
                    <Link href={`/work/call?account=${p.account_id}`}>
                      <Button variant="outline" size="sm" className="gap-1 text-[10px] h-6">
                        <Phone className="w-3 h-3" />
                        Call
                      </Button>
                    </Link>
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
