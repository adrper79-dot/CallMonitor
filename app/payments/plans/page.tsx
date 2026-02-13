'use client'

/**
 * /payments/plans — Payment plan management
 *
 * Shows active payment plans with installment schedules,
 * missed payment alerts, and plan modification options.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarRange, RefreshCw, Search, DollarSign,
  CheckCircle, AlertTriangle, Clock,
} from 'lucide-react'

interface PaymentPlan {
  id: string
  account_id: string
  account_name: string
  total_amount: number
  paid_amount: number
  installments: number
  completed_installments: number
  next_due: string
  status: 'active' | 'completed' | 'defaulted' | 'paused'
}

const statusColors: Record<string, string> = {
  active: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  completed: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  defaulted: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  paused: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export default function PaymentPlansPage() {
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/api/payments/plans?limit=100')
      const data = res.data || res.plans || []
      setPlans(data.map((p: any) => ({
        id: p.id,
        account_id: p.account_id,
        account_name: p.account_name || 'Unknown',
        total_amount: parseFloat(p.total_amount || 0),
        paid_amount: parseFloat(p.paid_amount || 0),
        installments: p.installments || p.total_installments || 0,
        completed_installments: p.completed_installments || 0,
        next_due: p.next_due || p.next_payment_date || '',
        status: p.status || 'active',
      })))
    } catch (err: any) {
      logger.warn('Payment plans endpoint not available', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const filtered = search
    ? plans.filter((p) => p.account_name.toLowerCase().includes(search.toLowerCase()))
    : plans

  const stats = {
    total: plans.length,
    active: plans.filter((p) => p.status === 'active').length,
    totalValue: plans.reduce((s, p) => s + p.total_amount, 0),
    collected: plans.reduce((s, p) => s + p.paid_amount, 0),
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarRange className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Payment Plans</h1>
          </div>
          <p className="text-sm text-gray-500">Active installment plans and schedules</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPlans} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Plans</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Active</p>
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${stats.totalValue.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Collected</p>
          <p className="text-2xl font-bold text-green-600">${stats.collected.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by account..."
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
            <CalendarRange className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">{plans.length === 0 ? 'No payment plans found' : 'No matches'}</p>
          </div>
        ) : (
          filtered.map((plan) => {
            const progress = plan.total_amount > 0 ? Math.round((plan.paid_amount / plan.total_amount) * 100) : 0
            return (
              <Card key={plan.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/accounts/${plan.account_id}`}
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600"
                        >
                          {plan.account_name}
                        </Link>
                        <Badge className={`text-[10px] ${statusColors[plan.status]}`}>{plan.status}</Badge>
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-8">{progress}%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {plan.completed_installments}/{plan.installments} installments
                        {plan.next_due && ` • Next: ${new Date(plan.next_due).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">${plan.total_amount.toLocaleString()}</p>
                      <p className="text-[10px] text-green-600">${plan.paid_amount.toLocaleString()} paid</p>
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
