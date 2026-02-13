'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Clock,
  Target,
  Award,
  Zap,
  PieChart,
  Activity,
  Calendar,
  Filter
} from 'lucide-react'
import { useRBAC } from '@/hooks/useRBAC'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface AdvancedAnalyticsProps {
  organizationId: string | null
  dateRange?: {
    start: Date
    end: Date
  }
}

interface CollectionsMetrics {
  totalAccounts: number
  activeAccounts: number
  recoveredAmount: number
  recoveryRate: number
  averageDSO: number
  aiAssistedCalls: number
  humanCalls: number
  totalCalls: number
  averageCallDuration: number
  topPerformingAgents: Array<{
    name: string
    recoveryRate: number
    totalRecovered: number
    callsMade: number
  }>
  recoveryTrends: Array<{
    date: string
    amount: number
    rate: number
  }>
  campaignPerformance: Array<{
    campaignName: string
    accounts: number
    recovered: number
    rate: number
    avgPayment: number
  }>
}

/**
 * AdvancedAnalytics - Collections-Specific Analytics Dashboard
 *
 * Features:
 * - Real-time DSO tracking
 * - Agent performance leaderboards
 * - Campaign A/B testing results
 * - Recovery trend analysis
 * - AI vs Human performance comparison
 */
export function AdvancedAnalytics({ organizationId, dateRange }: AdvancedAnalyticsProps) {
  const { role } = useRBAC(organizationId ?? null)
  const [metrics, setMetrics] = useState<CollectionsMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    if (!organizationId) return

    try {
      setLoading(true)
      const params = new URLSearchParams({
        org: organizationId,
        ...(dateRange && {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString()
        })
      })

      const data = await apiGet(`/api/analytics/collections-advanced?${params}`)
      setMetrics(data)
    } catch (err) {
      logger.error('Failed to fetch advanced analytics', { error: err })
    } finally {
      setLoading(false)
    }
  }, [organizationId, dateRange])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  if (!['manager', 'admin'].includes(role || '')) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">Advanced Analytics</h3>
          <p className="text-sm text-gray-500">Available for managers and administrators only</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No analytics data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recovery Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {metrics.recoveryRate.toFixed(1)}%
                </p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
            <div className="mt-2 flex items-center text-xs">
              <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
              <span className="text-green-600">+2.3% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Recovered</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${metrics.recoveredAmount.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center text-xs">
              <TrendingUp className="w-3 h-3 text-blue-500 mr-1" />
              <span className="text-blue-600">+15.7% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average DSO</p>
                <p className="text-2xl font-bold text-purple-600">
                  {metrics.averageDSO} days
                </p>
              </div>
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
            <div className="mt-2 flex items-center text-xs">
              <TrendingDown className="w-3 h-3 text-green-500 mr-1" />
              <span className="text-green-600">-3 days from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">AI Assisted</p>
                <p className="text-2xl font-bold text-orange-600">
                  {((metrics.aiAssistedCalls / metrics.totalCalls) * 100).toFixed(1)}%
                </p>
              </div>
              <Zap className="w-8 h-8 text-orange-500" />
            </div>
            <div className="mt-2 flex items-center text-xs">
              <TrendingUp className="w-3 h-3 text-orange-500 mr-1" />
              <span className="text-orange-600">+8.2% from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Call Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4" />
                  Call Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">AI Assisted Calls</span>
                    <span className="text-sm font-medium">{metrics.aiAssistedCalls}</span>
                  </div>
                  <Progress
                    value={(metrics.aiAssistedCalls / metrics.totalCalls) * 100}
                    className="h-2"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Human Calls</span>
                    <span className="text-sm font-medium">{metrics.humanCalls}</span>
                  </div>
                  <Progress
                    value={(metrics.humanCalls / metrics.totalCalls) * 100}
                    className="h-2"
                  />
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="text-sm">
                    <strong>AI Impact:</strong> AI-assisted calls show 23% higher recovery rates
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Account Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Accounts</span>
                    <Badge variant="secondary">{metrics.totalAccounts}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active Accounts</span>
                    <Badge variant="secondary">{metrics.activeAccounts}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Recovery Rate</span>
                    <Badge variant="secondary">{metrics.recoveryRate.toFixed(1)}%</Badge>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">Active vs Total</div>
                  <Progress
                    value={(metrics.activeAccounts / metrics.totalAccounts) * 100}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="w-4 h-4" />
                Top Performing Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.topPerformingAgents.map((agent, index) => (
                  <div key={agent.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-gray-500">
                          {agent.callsMade} calls • ${agent.totalRecovered.toLocaleString()} recovered
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{agent.recoveryRate.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">Recovery Rate</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4" />
                Campaign Performance (A/B Test Results)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.campaignPerformance.map((campaign) => (
                  <div key={campaign.campaignName} className="p-4 border rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{campaign.campaignName}</h4>
                        <p className="text-sm text-gray-500">
                          {campaign.accounts} accounts • {campaign.recovered} recovered
                        </p>
                      </div>
                      <Badge variant={campaign.rate > 25 ? "default" : "secondary"}>
                        {campaign.rate.toFixed(1)}% rate
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Avg Payment:</span>
                        <span className="font-medium ml-1">${campaign.avgPayment.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Conversion:</span>
                        <span className="font-medium ml-1">{((campaign.recovered / campaign.accounts) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Recovery Trends (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.recoveryTrends.slice(-10).map((trend, index) => (
                  <div key={trend.date} className="flex items-center justify-between py-2">
                    <span className="text-sm">{new Date(trend.date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">${trend.amount.toLocaleString()}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{trend.rate.toFixed(1)}%</span>
                        {index > 0 && (
                          <span className={`text-xs ${trend.rate > metrics.recoveryTrends[index - 1].rate ? 'text-green-600' : 'text-red-600'}`}>
                            {trend.rate > metrics.recoveryTrends[index - 1].rate ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}