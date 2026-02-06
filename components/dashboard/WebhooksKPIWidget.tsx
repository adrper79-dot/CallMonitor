"use client"

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/apiClient'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface WebhookMetrics {
  status: 'healthy' | 'unhealthy'
  feature: string
  latency_ms: number
  last_check: string
  metrics: {
    active_subscriptions: number
    deliveries_last_24h: number
    successful_deliveries_last_24h: number
    failed_deliveries_last_24h: number
    success_rate: number
    avg_response_time_ms: number
  }
}

/**
 * WebhooksKPIWidget Component
 *
 * Dashboard widget displaying webhook health metrics
 * Shows active webhooks, delivery success rate, and failed deliveries
 */
export function WebhooksKPIWidget() {
  const [metrics, setMetrics] = useState<WebhookMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiGet<WebhookMetrics>('/api/health/webhooks')
        setMetrics(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load webhook metrics')
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()

    // Refresh every minute
    const interval = setInterval(fetchMetrics, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !metrics) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-sm text-gray-500">Loading webhook metrics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">Webhooks Unavailable</h3>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  const { status, metrics: data } = metrics
  const isHealthy = status === 'healthy'
  const hasFailures = data.failed_deliveries_last_24h > 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${
              isHealthy ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <svg
              className={`w-5 h-5 ${isHealthy ? 'text-green-600' : 'text-red-600'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Webhooks</h3>
            <p className="text-sm text-gray-500">Real-time event notifications</p>
          </div>
        </div>
        <Badge variant={isHealthy ? 'default' : 'error'} className={isHealthy ? 'bg-green-100 text-green-700' : ''}>
          {isHealthy ? 'Healthy' : 'Unhealthy'}
        </Badge>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Active Subscriptions */}
        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Active Webhooks
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data.active_subscriptions}
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Success Rate (24h)
          </div>
          <div className="flex items-baseline gap-2">
            <div
              className={`text-2xl font-bold ${
                data.success_rate >= 95
                  ? 'text-green-600'
                  : data.success_rate >= 80
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {data.success_rate.toFixed(1)}%
            </div>
            {data.success_rate < 95 && (
              <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
        </div>

        {/* Deliveries */}
        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Deliveries (24h)
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data.deliveries_last_24h}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data.successful_deliveries_last_24h} successful
          </div>
        </div>

        {/* Failed Deliveries */}
        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Failed (24h)
          </div>
          <div className="flex items-baseline gap-2">
            <div
              className={`text-2xl font-bold ${
                hasFailures ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {data.failed_deliveries_last_24h}
            </div>
            {hasFailures && (
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Response Time */}
      {data.avg_response_time_ms > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              Avg Response Time
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {data.avg_response_time_ms.toFixed(0)}ms
            </span>
          </div>
        </div>
      )}

      {/* Alert for Failed Deliveries */}
      {hasFailures && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                {data.failed_deliveries_last_24h} failed {data.failed_deliveries_last_24h === 1 ? 'delivery' : 'deliveries'}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Check webhook logs for error details
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href="/settings?tab=webhooks"
          className="flex-1 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors text-center"
        >
          Manage Webhooks
        </Link>
        {hasFailures && (
          <Link
            href="/settings?tab=webhooks"
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors text-center"
          >
            View Logs
          </Link>
        )}
      </div>

      {/* Last Updated */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">
          Last updated: {new Date(metrics.last_check).toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}
