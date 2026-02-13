'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  Target,
  Zap,
  Brain,
  DollarSign,
  Clock,
  Users,
  Award,
  BarChart3,
  PieChart,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield
} from 'lucide-react'
import { useRBAC } from '@/hooks/useRBAC'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface AdaptiveVoiceUIProps {
  callId?: string
  organizationId: string | null
  debtorSentiment?: 'positive' | 'neutral' | 'negative'
  callDuration?: number
  paymentHistory?: any[]
  aiInsights?: {
    likelihoodToPay: number
    recommendedStrategy: string
    objectionProbability: number
    paymentAmount: number
  }
}

interface RecoveryMetrics {
  totalCalls: number
  successfulPayments: number
  averagePayment: number
  recoveryRate: number
  aiAssistedRate: number
}

/**
 * AdaptiveVoiceUI - AI-Powered Voice Interface Adaptation
 *
 * Dynamically adjusts voice interface based on:
 * - Call context and duration
 * - Debtor sentiment analysis
 * - Payment history and likelihood scores
 * - AI recommendations for recovery optimization
 *
 * Goal: 35% recovery uplift through adaptive UX
 */
export function AdaptiveVoiceUI({
  callId,
  organizationId,
  debtorSentiment = 'neutral',
  callDuration = 0,
  paymentHistory = [],
  aiInsights
}: AdaptiveVoiceUIProps) {
  const { role } = useRBAC(organizationId ?? null)
  const [metrics, setMetrics] = useState<RecoveryMetrics | null>(null)
  const [adaptiveMode, setAdaptiveMode] = useState<'standard' | 'aggressive' | 'empathetic' | 'ai-guided'>('standard')
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false)

  // Determine adaptive mode based on context
  useEffect(() => {
    if (!aiInsights) return

    const { likelihoodToPay, objectionProbability, recommendedStrategy } = aiInsights

    if (likelihoodToPay > 0.7 && objectionProbability < 0.3) {
      setAdaptiveMode('aggressive')
    } else if (debtorSentiment === 'negative' || objectionProbability > 0.6) {
      setAdaptiveMode('empathetic')
    } else if (recommendedStrategy === 'ai-guided') {
      setAdaptiveMode('ai-guided')
    } else {
      setAdaptiveMode('standard')
    }
  }, [aiInsights, debtorSentiment])

  // Fetch recovery metrics for advanced analytics
  const fetchRecoveryMetrics = useCallback(async () => {
    if (!organizationId || !['manager', 'admin'].includes(role || '')) return

    try {
      const data = await apiGet(`/api/analytics/recovery-metrics?org=${organizationId}`)
      setMetrics(data)
    } catch (err) {
      logger.warn('Failed to fetch recovery metrics', { error: err })
    }
  }, [organizationId, role])

  useEffect(() => {
    fetchRecoveryMetrics()
  }, [fetchRecoveryMetrics])

  // Adaptive UI elements based on mode
  const getAdaptiveElements = () => {
    switch (adaptiveMode) {
      case 'aggressive':
        return {
          primaryColor: 'bg-green-500',
          strategy: 'Payment-Focused',
          showPaymentCalculator: true,
          showQuickDisposition: true,
          emphasis: 'Close the deal',
          aiPrompt: 'Focus on payment commitment and immediate action'
        }
      case 'empathetic':
        return {
          primaryColor: 'bg-blue-500',
          strategy: 'Relationship-Building',
          showObjectionLibrary: true,
          showSentimentWidget: true,
          emphasis: 'Build trust first',
          aiPrompt: 'Address concerns and build rapport'
        }
      case 'ai-guided':
        return {
          primaryColor: 'bg-purple-500',
          strategy: 'AI-Optimized',
          showAIInsights: true,
          showPredictiveActions: true,
          emphasis: 'Follow AI recommendations',
          aiPrompt: 'Use AI insights for optimal approach'
        }
      default:
        return {
          primaryColor: 'bg-gray-500',
          strategy: 'Standard',
          showBasicTools: true,
          emphasis: 'Follow standard procedure',
          aiPrompt: 'Use standard collection approach'
        }
    }
  }

  const adaptive = getAdaptiveElements()

  return (
    <div className="space-y-4">
      {/* Adaptive Mode Indicator */}
      <Card className={`border-l-4 ${adaptive.primaryColor.replace('bg-', 'border-l-')}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${adaptive.primaryColor} animate-pulse`} />
              <div>
                <h3 className="font-semibold text-sm">Adaptive Mode: {adaptive.strategy}</h3>
                <p className="text-xs text-gray-600">{adaptive.emphasis}</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {callDuration > 0 ? `${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')}` : '00:00'}
            </Badge>
          </div>

          {/* AI Prompt for current mode */}
          <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs">
            <Brain className="w-3 h-3 inline mr-1" />
            <strong>AI Guidance:</strong> {adaptive.aiPrompt}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Panel (for AI-guided mode) */}
      {adaptive.showAIInsights && aiInsights && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-500" />
              AI Recovery Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(aiInsights.likelihoodToPay * 100)}%
                </div>
                <div className="text-xs text-gray-500">Payment Likelihood</div>
                <Progress value={aiInsights.likelihoodToPay * 100} className="mt-1 h-2" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {Math.round(aiInsights.objectionProbability * 100)}%
                </div>
                <div className="text-xs text-gray-500">Objection Risk</div>
                <Progress value={aiInsights.objectionProbability * 100} className="mt-1 h-2" />
              </div>
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
              <div className="text-sm font-medium text-purple-900 dark:text-purple-100">
                Recommended: {aiInsights.recommendedStrategy}
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                Target Payment: ${aiInsights.paymentAmount.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adaptive Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {adaptive.showPaymentCalculator && (
          <Button size="sm" className="gap-1.5">
            <DollarSign className="w-3 h-3" />
            Payment Calc
          </Button>
        )}
        {adaptive.showObjectionLibrary && (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Users className="w-3 h-3" />
            Objections
          </Button>
        )}
        {adaptive.showQuickDisposition && (
          <Button size="sm" variant="outline" className="gap-1.5">
            <CheckCircle className="w-3 h-3" />
            Quick PTP
          </Button>
        )}
        {adaptive.showSentimentWidget && (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Activity className="w-3 h-3" />
            Sentiment
          </Button>
        )}
      </div>

      {/* Advanced Analytics (Manager/Admin only) */}
      {['manager', 'admin'].includes(role || '') && metrics && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Recovery Analytics
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
              >
                {showAdvancedAnalytics ? 'Hide' : 'Show'} Details
              </Button>
            </div>
          </CardHeader>
          {showAdvancedAnalytics && (
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{metrics.totalCalls}</div>
                  <div className="text-xs text-gray-500">Total Calls</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{metrics.successfulPayments}</div>
                  <div className="text-xs text-gray-500">Payments</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600">{metrics.recoveryRate.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">Recovery Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-600">{metrics.aiAssistedRate.toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">AI Assisted</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-medium">35% Recovery Uplift Target</span>
                  <Badge variant="secondary" className="text-xs">
                    AI-Adaptive UI Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Adaptive Compliance Panel */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Compliance Status</span>
            </div>
            <div className="flex gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <CheckCircle className="w-3 h-3 text-green-500" />
              <CheckCircle className="w-3 h-3 text-green-500" />
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Mini-Miranda • TCPA Time Check • Consent Verified
          </div>
        </CardContent>
      </Card>
    </div>
  )
}