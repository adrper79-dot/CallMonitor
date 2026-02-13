'use client'

/**
 * /work/payments — Agent payment tracking page
 *
 * Shows today's promises, completed payments, and payment link history.
 * Agents use this to track collection progress throughout the day.
 */

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard, CheckCircle, Clock, AlertTriangle,
  DollarSign, ArrowUpRight, Link2, RefreshCw,
  TrendingUp,
} from 'lucide-react'

interface PaymentRecord {
  id: string
  account_id: string
  account_name: string
  amount: number
  status: 'promised' | 'completed' | 'failed' | 'pending'
  type: 'payment' | 'promise' | 'payment_link'
  created_at: string
  due_date?: string
}

export default function PaymentsPage() {
  const { data: session } = useSession()
  const [records, setRecords] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.organization_id) return

    const load = async () => {
      try {
        const data = await apiGet('/api/payments?today=true&limit=50')
        setRecords(data.data || data.payments || [])
      } catch (err: any) {
        logger.error('Failed to load payments', { error: err?.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session?.user?.organization_id])

  const stats = {
    total_collected: records
      .filter((r) => r.status === 'completed')
      .reduce((s, r) => s + r.amount, 0),
    total_promised: records
      .filter((r) => r.status === 'promised')
      .reduce((s, r) => s + r.amount, 0),
    payment_links: records.filter((r) => r.type === 'payment_link').length,
    completed_count: records.filter((r) => r.status === 'completed').length,
  }

  const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    completed: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
    promised: { icon: <Clock className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
    pending: { icon: <Clock className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
    failed: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Payments Today</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track collections, promises, and payment links</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Collected</p>
              <DollarSign className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">${stats.total_collected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Promised</p>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600">${stats.total_promised.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Payments</p>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.completed_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Links Sent</p>
              <Link2 className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.payment_links}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Today&apos;s Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">No payments yet today</p>
              <p className="text-xs">Start calling to collect payments</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => {
                const cfg = statusConfig[record.status] || statusConfig.pending
                return (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 p-3 rounded-md border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {record.account_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {record.type === 'payment_link' ? 'Payment Link' : record.type === 'promise' ? 'Promise to Pay' : 'Payment'}
                        {' • '}
                        {new Date(record.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        ${record.amount.toLocaleString()}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">{record.status}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
