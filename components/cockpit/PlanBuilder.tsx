'use client'

/**
 * PlanBuilder — Payment arrangement wizard
 *
 * Extends PaymentCalculator with actual plan creation.
 * Lets agents build installment plans during calls and submit them for approval.
 */

import React, { useState, useMemo, useCallback } from 'react'
import { apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calculator, CreditCard, Calendar, CheckCircle, X,
  DollarSign, ChevronDown, ChevronUp, Loader2, AlertTriangle,
} from 'lucide-react'

interface PlanBuilderProps {
  accountId: string
  accountName: string
  balanceDue: number
  onClose: () => void
  onCreated?: (planId: string) => void
}

interface PlanOption {
  months: number
  downPayment: number
  monthlyPayment: number
  totalCost: number
}

export default function PlanBuilder({
  accountId,
  accountName,
  balanceDue,
  onClose,
  onCreated,
}: PlanBuilderProps) {
  const [selectedMonths, setSelectedMonths] = useState(6)
  const [downPaymentPct, setDownPaymentPct] = useState(10)
  const [customAmount, setCustomAmount] = useState('')
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const monthOptions = [3, 6, 9, 12, 18, 24]

  const plan = useMemo((): PlanOption => {
    const useCustom = customAmount && parseFloat(customAmount) > 0
    const down = useCustom ? parseFloat(customAmount) : Math.round(balanceDue * (downPaymentPct / 100))
    const remaining = balanceDue - down
    const periods = frequency === 'monthly' ? selectedMonths
      : frequency === 'biweekly' ? selectedMonths * 2
      : selectedMonths * 4
    const payment = Math.ceil((remaining / periods) * 100) / 100
    return {
      months: selectedMonths,
      downPayment: down,
      monthlyPayment: payment,
      totalCost: down + payment * periods,
    }
  }, [balanceDue, selectedMonths, downPaymentPct, customAmount, frequency])

  // Generate payment schedule
  const schedule = useMemo(() => {
    const payments: { date: string; amount: number; label: string }[] = []
    const start = new Date(startDate)

    // Down payment
    payments.push({
      date: start.toISOString().split('T')[0],
      amount: plan.downPayment,
      label: 'Down Payment',
    })

    // Installments
    const periods = frequency === 'monthly' ? plan.months
      : frequency === 'biweekly' ? plan.months * 2
      : plan.months * 4

    for (let i = 1; i <= periods; i++) {
      const d = new Date(start)
      if (frequency === 'monthly') d.setMonth(d.getMonth() + i)
      else if (frequency === 'biweekly') d.setDate(d.getDate() + i * 14)
      else d.setDate(d.getDate() + i * 7)

      payments.push({
        date: d.toISOString().split('T')[0],
        amount: plan.monthlyPayment,
        label: `Installment ${i}`,
      })
    }

    return payments
  }, [plan, startDate, frequency])

  const handleCreate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/api/payments/plans', {
        account_id: accountId,
        total_amount: balanceDue,
        down_payment: plan.downPayment,
        installment_amount: plan.monthlyPayment,
        frequency,
        num_payments: frequency === 'monthly' ? plan.months : frequency === 'biweekly' ? plan.months * 2 : plan.months * 4,
        start_date: startDate,
        schedule: schedule.map((s) => ({ date: s.date, amount: s.amount })),
      })

      setCreated(true)
      onCreated?.(data.id || data.data?.id)
      logger.info('Payment plan created', { accountId, months: plan.months })
    } catch (err: any) {
      logger.error('Failed to create payment plan', { error: err?.message })
      setError(err?.message || 'Failed to create plan')
    } finally {
      setLoading(false)
    }
  }, [accountId, balanceDue, plan, frequency, startDate, schedule, onCreated])

  if (created) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Plan Created</h3>
            <p className="text-sm text-gray-500 mt-1">
              {plan.months}-month plan for {accountName}: ${plan.downPayment} down + ${plan.monthlyPayment}/{frequency === 'monthly' ? 'mo' : frequency === 'biweekly' ? '2wk' : 'wk'}
            </p>
            <Button onClick={onClose} className="mt-4">Done</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-500" />
            Build Payment Plan
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account summary */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{accountName}</p>
            <p className="text-xs text-gray-500">Balance: ${balanceDue.toLocaleString()}</p>
          </div>

          {/* Term selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Length</label>
            <div className="grid grid-cols-6 gap-1.5 mt-1">
              {monthOptions.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMonths(m)}
                  className={`py-2 px-1 text-xs font-medium rounded-md border transition-colors ${
                    selectedMonths === m
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {m}mo
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Frequency</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {(['monthly', 'biweekly', 'weekly'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`py-2 text-xs font-medium rounded-md border transition-colors ${
                    frequency === f
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {f === 'monthly' ? 'Monthly' : f === 'biweekly' ? 'Bi-weekly' : 'Weekly'}
                </button>
              ))}
            </div>
          </div>

          {/* Down payment */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Down Payment</label>
            <div className="flex gap-1.5 mt-1">
              {[0, 10, 20, 25, 50].map((pct) => (
                <button
                  key={pct}
                  onClick={() => { setDownPaymentPct(pct); setCustomAmount('') }}
                  className={`flex-1 py-2 text-xs font-medium rounded-md border transition-colors ${
                    downPaymentPct === pct && !customAmount
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <div className="relative mt-2">
              <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                placeholder="Custom down payment..."
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-primary-500"
                min="0"
                max={balanceDue}
              />
            </div>
          </div>

          {/* Start date */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Plan Summary */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">Plan Summary</span>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-blue-600 flex items-center gap-0.5"
              >
                {showDetails ? 'Hide' : 'Show'} Schedule
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">${plan.downPayment}</p>
                <p className="text-[10px] text-gray-500">Down Payment</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">${plan.monthlyPayment}</p>
                <p className="text-[10px] text-gray-500">
                  per {frequency === 'monthly' ? 'month' : frequency === 'biweekly' ? '2 weeks' : 'week'}
                </p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">${plan.totalCost.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500">Total</p>
              </div>
            </div>

            {showDetails && (
              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 max-h-40 overflow-y-auto">
                {schedule.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-gray-500">{s.label}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">${s.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleCreate}
            disabled={loading || plan.downPayment >= balanceDue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Create Payment Plan
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
