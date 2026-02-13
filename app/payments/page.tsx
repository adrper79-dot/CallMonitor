'use client'

/**
 * /payments — Payment management hub
 *
 * Tabs: Plans | History | Reconciliation | Links
 * Reuses PaymentCalculator, PaymentHistoryChart, IVRPaymentPanel.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign, CreditCard, Calendar, TrendingUp,
  RefreshCw, CheckCircle, Clock, AlertTriangle,
  Link as LinkIcon, BarChart3,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const PaymentCalculator = dynamic(() => import('@/components/voice/PaymentCalculator'), { ssr: false })
const PaymentHistoryChart = dynamic(() => import('@/components/voice/PaymentHistoryChart'), { ssr: false })

type Tab = 'plans' | 'history' | 'links'

interface PaymentPlan {
  id: string
  account_id: string
  account_name: string
  total_amount: number
  monthly_amount: number
  frequency: string
  status: 'active' | 'completed' | 'defaulted' | 'cancelled'
  next_payment_date: string
  payments_made: number
  payments_total: number
  created_at: string
}

interface PaymentLink {
  id: string
  account_id: string
  account_name: string
  amount: number
  status: 'pending' | 'paid' | 'expired'
  url: string
  created_at: string
  expires_at: string
}

const planStatusColors: Record<string, string> = {
  active: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  completed: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  defaulted: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const linkStatusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  paid: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('plans')
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [links, setLinks] = useState<PaymentLink[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [plansRes, linksRes] = await Promise.all([
        apiGet('/api/payments/plans?limit=100').catch(() => ({ data: [] })),
        apiGet('/api/payments/links?limit=100').catch(() => ({ data: [] })),
      ])
      setPlans(
        (plansRes.data || plansRes.plans || []).map((p: any) => ({
          id: p.id,
          account_id: p.account_id,
          account_name: p.account_name || 'Account',
          total_amount: parseFloat(p.total_amount || 0),
          monthly_amount: parseFloat(p.monthly_amount || p.installment_amount || 0),
          frequency: p.frequency || 'monthly',
          status: p.status || 'active',
          next_payment_date: p.next_payment_date || '',
          payments_made: p.payments_made || 0,
          payments_total: p.payments_total || p.total_installments || 0,
          created_at: p.created_at,
        }))
      )
      setLinks(
        (linksRes.data || linksRes.links || []).map((l: any) => ({
          id: l.id,
          account_id: l.account_id,
          account_name: l.account_name || 'Account',
          amount: parseFloat(l.amount || 0),
          status: l.status || 'pending',
          url: l.url || l.payment_url || '',
          created_at: l.created_at,
          expires_at: l.expires_at || '',
        }))
      )
    } catch (err: any) {
      logger.error('Failed to fetch payment data', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  const planStats = {
    active: plans.filter((p) => p.status === 'active').length,
    totalValue: plans.filter((p) => p.status === 'active').reduce((s, p) => s + p.total_amount, 0),
    collected: plans.filter((p) => p.status === 'completed').length,
    defaulted: plans.filter((p) => p.status === 'defaulted').length,
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'plans', label: 'Payment Plans', icon: <Calendar className="w-4 h-4" /> },
    { key: 'history', label: 'History & Trends', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'links', label: 'Payment Links', icon: <LinkIcon className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plans, history & payment links</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Active Plans</p>
            <p className="text-2xl font-bold text-green-600">{planStats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Value</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(planStats.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Completed</p>
            <p className="text-2xl font-bold text-blue-600">{planStats.collected}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Defaulted</p>
            <p className="text-2xl font-bold text-red-600">{planStats.defaulted}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{plans.length} plans</p>
            <PaymentCalculator />
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Account</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Total</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Payment</th>
                      <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500">Progress</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Next Due</th>
                      <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}><td colSpan={6} className="py-2.5 px-4"><div className="h-5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td></tr>
                      ))
                    ) : plans.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-500 text-sm">No payment plans</td></tr>
                    ) : (
                      plans.map((plan) => (
                        <tr key={plan.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-4 font-medium text-gray-900 dark:text-gray-100">{plan.account_name}</td>
                          <td className="py-2 px-4 text-right">{formatCurrency(plan.total_amount)}</td>
                          <td className="py-2 px-4 text-right text-xs">{formatCurrency(plan.monthly_amount)}/{plan.frequency.replace('ly', '')}</td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full"
                                  style={{ width: `${plan.payments_total > 0 ? (plan.payments_made / plan.payments_total) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500">{plan.payments_made}/{plan.payments_total}</span>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-xs text-gray-500">
                            {plan.next_payment_date ? new Date(plan.next_payment_date).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <Badge className={`text-[10px] ${planStatusColors[plan.status]}`}>{plan.status}</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-4">
          <PaymentHistoryChart accountId="" />
        </div>
      )}

      {/* Links Tab */}
      {tab === 'links' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Account</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500">Amount</th>
                      <th className="text-center py-2.5 px-4 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Created</th>
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}><td colSpan={5} className="py-2.5 px-4"><div className="h-5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td></tr>
                      ))
                    ) : links.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-gray-500 text-sm">No payment links</td></tr>
                    ) : (
                      links.map((link) => (
                        <tr key={link.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-2 px-4 font-medium text-gray-900 dark:text-gray-100">{link.account_name}</td>
                          <td className="py-2 px-4 text-right">{formatCurrency(link.amount)}</td>
                          <td className="py-2 px-4 text-center">
                            <Badge className={`text-[10px] ${linkStatusColors[link.status]}`}>{link.status}</Badge>
                          </td>
                          <td className="py-2 px-4 text-xs text-gray-500">{new Date(link.created_at).toLocaleDateString()}</td>
                          <td className="py-2 px-4 text-xs text-gray-500">
                            {link.expires_at ? new Date(link.expires_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
