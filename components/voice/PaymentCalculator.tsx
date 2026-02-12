'use client'

import React, { useState, useMemo } from 'react'

interface PaymentPlan {
  months: number
  monthly: number
  total: number
  label: string
}

interface PaymentCalculatorProps {
  /** Pre-fill with account balance */
  initialBalance?: number
  /** Callback when agent selects a plan to present to debtor */
  onSelectPlan?: (plan: PaymentPlan) => void
}

/**
 * PaymentCalculator — Client-side installment calculator for collections agents.
 *
 * Calculates monthly payment options for 3/6/9/12-month plans.
 * No API calls — pure client-side computation.
 * Used inside CallDetailView or as a sidebar widget during active calls.
 */
export default function PaymentCalculator({
  initialBalance = 0,
  onSelectPlan,
}: PaymentCalculatorProps) {
  const [balance, setBalance] = useState<string>(
    initialBalance > 0 ? initialBalance.toFixed(2) : ''
  )
  const [downPayment, setDownPayment] = useState<string>('')
  const [selectedPlanMonths, setSelectedPlanMonths] = useState<number | null>(null)

  const balanceNum = parseFloat(balance) || 0
  const downPaymentNum = parseFloat(downPayment) || 0
  const netBalance = Math.max(0, balanceNum - downPaymentNum)

  const plans: PaymentPlan[] = useMemo(() => {
    if (netBalance <= 0) return []

    return [3, 6, 9, 12].map((months) => ({
      months,
      monthly: Math.ceil((netBalance / months) * 100) / 100,
      total: netBalance,
      label: `${months}-month plan`,
    }))
  }, [netBalance])

  const handleSelectPlan = (plan: PaymentPlan) => {
    setSelectedPlanMonths(plan.months)
    onSelectPlan?.(plan)
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-200">Payment Calculator</h3>

      {/* Input Fields */}
      <div className="mb-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Total Balance
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-gray-600 bg-gray-700 py-2 pl-7 pr-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">
            Down Payment (optional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={balanceNum}
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-gray-600 bg-gray-700 py-2 pl-7 pr-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Remaining Balance Display */}
      {balanceNum > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-gray-700/50 px-3 py-2">
          <span className="text-xs text-gray-400">Remaining to finance</span>
          <span className="text-sm font-semibold text-white">
            {formatCurrency(netBalance)}
          </span>
        </div>
      )}

      {/* Payment Plans */}
      {plans.length > 0 ? (
        <div className="space-y-2">
          {plans.map((plan) => (
            <button
              key={plan.months}
              onClick={() => handleSelectPlan(plan)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors ${
                selectedPlanMonths === plan.months
                  ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                  : 'border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-white">{plan.label}</p>
                <p className="text-xs text-gray-400">
                  {plan.months} payments of {formatCurrency(plan.monthly)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-400">
                  {formatCurrency(plan.monthly)}
                </p>
                <p className="text-xs text-gray-500">/month</p>
              </div>
            </button>
          ))}
        </div>
      ) : balanceNum > 0 && netBalance <= 0 ? (
        <div className="rounded-md bg-green-500/10 p-3 text-center">
          <p className="text-sm font-medium text-green-400">
            Down payment covers full balance!
          </p>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500">
          Enter a balance to see payment options
        </p>
      )}

      {/* Selected Plan Summary */}
      {selectedPlanMonths && (
        <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
          <p className="text-xs font-medium text-blue-400">Selected Plan</p>
          <p className="text-sm text-gray-300">
            {downPaymentNum > 0 && (
              <span>
                {formatCurrency(downPaymentNum)} down + {' '}
              </span>
            )}
            {selectedPlanMonths} payments of{' '}
            {formatCurrency(
              Math.ceil((netBalance / selectedPlanMonths) * 100) / 100
            )}
          </p>
        </div>
      )}
    </div>
  )
}
