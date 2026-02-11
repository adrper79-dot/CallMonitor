'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface Payment {
  id: string
  account_id: string
  amount: string
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0)
}

/**
 * PaymentHistoryChart — Payment timeline for a collection account
 *
 * Displays payment records as a timeline with running total.
 * Fetches data from GET /api/collections/:id/payments.
 */
export default function PaymentHistoryChart({ accountId }: { accountId: string }) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId) return

    apiGet<{ payments: Payment[] }>(`/api/collections/${accountId}/payments`)
      .then((data) => setPayments(data.payments || []))
      .catch((err) => {
        logger.error('Failed to fetch payment history', { error: err, accountId })
        setError(err?.message || 'Failed to load payments')
      })
      .finally(() => setLoading(false))
  }, [accountId])

  if (loading) {
    return (
      <div className="rounded-lg bg-white border border-gray-200 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-16 bg-gray-100 rounded" />
          <div className="h-16 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-white border border-gray-200 p-4 text-center">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-lg bg-white border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment History</h4>
        <p className="text-sm text-gray-400">No payments recorded for this account.</p>
      </div>
    )
  }

  // Calculate running total
  const paymentsWithTotal = [...payments].reverse().reduce<(Payment & { runningTotal: number })[]>(
    (acc, payment) => {
      const prevTotal = acc.length > 0 ? acc[acc.length - 1].runningTotal : 0
      acc.push({ ...payment, runningTotal: prevTotal + (parseFloat(payment.amount) || 0) })
      return acc
    },
    []
  )

  const totalCollected = paymentsWithTotal.length > 0
    ? paymentsWithTotal[paymentsWithTotal.length - 1].runningTotal
    : 0

  // Simple bar chart data — group by month
  const monthlyData: Record<string, number> = {}
  for (const p of payments) {
    const month = new Date(p.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    monthlyData[month] = (monthlyData[month] || 0) + (parseFloat(p.amount) || 0)
  }
  const months = Object.entries(monthlyData)
  const maxMonthly = Math.max(...months.map(([, v]) => v), 1)

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Payment History</h4>
        <span className="text-sm font-medium text-green-600">
          Total: {formatCurrency(totalCollected)}
        </span>
      </div>

      {/* Monthly Bar Chart */}
      {months.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Collections</p>
          <div className="space-y-1.5">
            {months.map(([month, amount]) => (
              <div key={month} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">{month}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all"
                    style={{ width: `${(amount / maxMonthly) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-20 text-right">
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Timeline */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Payments</p>
        <div className="divide-y divide-gray-100">
          {payments.slice(0, 10).map((payment) => (
            <div key={payment.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {formatCurrency(payment.amount)}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(payment.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {payment.payment_method && ` — ${payment.payment_method}`}
                </p>
              </div>
              {payment.reference && (
                <span className="text-xs text-gray-400 font-mono">{payment.reference}</span>
              )}
            </div>
          ))}
        </div>
        {payments.length > 10 && (
          <p className="text-xs text-gray-400 text-center">
            + {payments.length - 10} more payments
          </p>
        )}
      </div>
    </div>
  )
}
