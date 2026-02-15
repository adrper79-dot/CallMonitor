'use client'

/**
 * SettlementCalculator — AI-assisted settlement negotiation tool
 *
 * Analyzes account aging and likelihood score to suggest
 * optimal settlement ranges. Integrates with PaymentLinkGenerator
 * for instant settlement offer delivery.
 */

import React, { useState, useMemo, useCallback } from 'react'
import { apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calculator, DollarSign, TrendingDown, CheckCircle,
  AlertTriangle, Loader2, X, Link2, CreditCard, Sparkles,
} from 'lucide-react'

export interface SettlementCalculatorProps {
  accountId: string
  accountName: string
  balanceDue: number
  daysPastDue: number
  likelihoodScore?: number | null
  phone?: string
  email?: string | null
  onClose: () => void
  onSettlementCreated?: (settlementId: string) => void
}

interface SettlementRecommendation {
  min: number
  max: number
  suggested: number
  reason: string
  urgency: 'low' | 'medium' | 'high'
}

export default function SettlementCalculator({
  accountId,
  accountName,
  balanceDue,
  daysPastDue,
  likelihoodScore = 0.5,
  phone,
  email,
  onClose,
  onSettlementCreated,
}: SettlementCalculatorProps) {
  const [settlementPct, setSettlementPct] = useState(0)
  const [offerType, setOfferType] = useState<'onetime' | 'plan'>('onetime')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLinkGenerator, setShowLinkGenerator] = useState(false)

  // Calculate recommendation based on aging and likelihood score
  const recommendation = useMemo((): SettlementRecommendation => {
    let min = 30
    let max = 50
    let suggested = 40
    let reason = ''
    let urgency: 'low' | 'medium' | 'high' = 'low'

    // Base ranges on days past due
    if (daysPastDue < 60) {
      min = 75
      max = 85
      suggested = 80
      reason = 'Account recently delinquent'
      urgency = 'low'
    } else if (daysPastDue < 90) {
      min = 65
      max = 75
      suggested = 70
      reason = 'Early delinquency stage'
      urgency = 'medium'
    } else if (daysPastDue < 180) {
      min = 50
      max = 65
      suggested = 57
      reason = 'Mid-stage delinquency'
      urgency = 'medium'
    } else {
      min = 30
      max = 50
      suggested = 40
      reason = 'Severely delinquent account'
      urgency = 'high'
    }

    // Adjust based on likelihood score
    // Higher likelihood = consumer more likely to pay → suggest higher %
    const likelihoodAdj = Math.round((likelihoodScore || 0.5) * 10)
    suggested = Math.min(max, Math.max(min, suggested + likelihoodAdj))

    return { min, max, suggested, reason, urgency }
  }, [daysPastDue, likelihoodScore])

  // Initialize slider to suggested value on mount
  React.useEffect(() => {
    setSettlementPct(recommendation.suggested)
  }, [recommendation.suggested])

  const settlementAmount = useMemo(() => {
    return Math.round((balanceDue * settlementPct) / 100)
  }, [balanceDue, settlementPct])

  const discount = useMemo(() => {
    return balanceDue - settlementAmount
  }, [balanceDue, settlementAmount])

  // Quick preset percentages
  const presets = [
    { label: 'Min', value: recommendation.min },
    { label: 'Rec', value: recommendation.suggested },
    { label: 'Max', value: recommendation.max },
    { label: '50%', value: 50 },
    { label: '100%', value: 100 },
  ]

  const handleCreateSettlement = useCallback(async () => {
    if (settlementPct <= 0 || settlementPct > 100) {
      setError('Settlement percentage must be between 1% and 100%')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/api/settlements', {
        account_id: accountId,
        original_balance: balanceDue,
        settlement_amount: settlementAmount,
        settlement_percentage: settlementPct,
        offer_type: offerType,
        days_past_due: daysPastDue,
        likelihood_score: likelihoodScore,
        recommended_range: `${recommendation.min}-${recommendation.max}%`,
      })

      setCreated(true)
      onSettlementCreated?.(data.id || data.data?.id)
      logger.info('Settlement offer created', {
        accountId,
        settlementPct,
        settlementAmount,
      })

      // Auto-show payment link generator after 1.5s
      setTimeout(() => {
        setShowLinkGenerator(true)
      }, 1500)
    } catch (err: any) {
      logger.error('Failed to create settlement offer', { error: err?.message })
      setError(err?.message || 'Failed to create settlement')
    } finally {
      setLoading(false)
    }
  }, [
    accountId,
    balanceDue,
    settlementAmount,
    settlementPct,
    offerType,
    daysPastDue,
    likelihoodScore,
    recommendation,
    onSettlementCreated,
  ])

  const handleSendPaymentLink = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/api/payments/links', {
        account_id: accountId,
        amount: settlementAmount,
        description: `Settlement offer: ${settlementPct}% (${accountName})`,
        currency: 'usd',
      })

      const paymentLink = data.url || data.link || data.data?.url
      if (!paymentLink) throw new Error('No payment link returned')

      // Copy link to clipboard
      navigator.clipboard.writeText(paymentLink)

      logger.info('Settlement payment link created', {
        accountId,
        settlementAmount,
      })

      // Show success and close
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err: any) {
      logger.error('Failed to create payment link', { error: err?.message })
      setError(err?.message || 'Failed to create payment link')
    } finally {
      setLoading(false)
    }
  }, [accountId, settlementAmount, settlementPct, accountName, onClose])

  // Success state
  if (created && showLinkGenerator) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <Card
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-500" />
              Send Settlement Link
            </CardTitle>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Settlement Offer Created
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                ${settlementAmount.toLocaleString()} ({settlementPct}% of balance)
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1">
                Saves ${discount.toLocaleString()}
              </p>
            </div>

            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {accountName}
              </p>
              <p className="text-xs text-gray-500">
                {phone || 'No phone'} • {email || 'No email'}
              </p>
            </div>

            {error && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={onClose}
                variant="outline"
                className="gap-1.5"
              >
                Done
              </Button>
              <Button
                onClick={handleSendPaymentLink}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                Send Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Created but before showing link generator
  if (created && !showLinkGenerator) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <Card
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Settlement Created
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              ${settlementAmount.toLocaleString()} ({settlementPct}% settlement)
            </p>
            <div className="mt-2 text-xs text-gray-400">
              Preparing payment link...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-purple-500" />
            Settlement Calculator
          </CardTitle>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Info */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {accountName}
            </p>
            <p className="text-xs text-gray-500">
              Balance: ${balanceDue.toLocaleString()} • {daysPastDue} days past due
            </p>
          </div>

          {/* AI Recommendation */}
          <div
            className={`p-3 rounded-lg border ${
              recommendation.urgency === 'high'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : recommendation.urgency === 'medium'
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles
                className={`w-4 h-4 ${
                  recommendation.urgency === 'high'
                    ? 'text-red-600'
                    : recommendation.urgency === 'medium'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                }`}
              />
              <span
                className={`text-xs font-semibold uppercase ${
                  recommendation.urgency === 'high'
                    ? 'text-red-700 dark:text-red-300'
                    : recommendation.urgency === 'medium'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`}
              >
                AI Recommendation
              </span>
              <Badge
                variant="default"
                className={`ml-auto text-[10px] ${
                  recommendation.urgency === 'high'
                    ? 'border-red-400 text-red-600'
                    : recommendation.urgency === 'medium'
                    ? 'border-amber-400 text-amber-600'
                    : 'border-blue-400 text-blue-600'
                }`}
              >
                {recommendation.urgency} urgency
              </Badge>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {recommendation.reason}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Suggested range:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {recommendation.min}% - {recommendation.max}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-500">Optimal settlement:</span>
              <span
                className={`font-bold ${
                  recommendation.urgency === 'high'
                    ? 'text-red-600'
                    : recommendation.urgency === 'medium'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                }`}
              >
                {recommendation.suggested}%
              </span>
            </div>
          </div>

          {/* Settlement Percentage Slider */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Settlement Percentage: {settlementPct}%
            </label>
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              value={settlementPct}
              onChange={(e) => setSettlementPct(parseInt(e.target.value))}
              className="w-full mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            {/* Quick presets */}
            <div className="flex gap-1.5 mt-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setSettlementPct(p.value)}
                  className={`px-3 py-1 text-[10px] rounded border transition-colors ${
                    settlementPct === p.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calculation Display */}
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Settlement Amount</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${settlementAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-green-600" />
                  You Save
                </p>
                <p className="text-2xl font-bold text-green-600">
                  ${discount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Offer Type */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Offer Type
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => setOfferType('onetime')}
                className={`py-2 px-3 text-xs font-medium rounded-md border transition-colors ${
                  offerType === 'onetime'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                One-Time Payment
              </button>
              <button
                onClick={() => setOfferType('plan')}
                className={`py-2 px-3 text-xs font-medium rounded-md border transition-colors ${
                  offerType === 'plan'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                Payment Plan
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Create Settlement Button */}
          <Button
            onClick={handleCreateSettlement}
            disabled={loading || settlementPct <= 0 || settlementPct > 100}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Create Settlement Offer
          </Button>

          {/* Info Footer */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 text-center">
              Settlement offers are recorded in the account timeline and can be tracked in Reports
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
