'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { apiGet } from '@/lib/apiClient'
import { WebhookSubscription, WebhookDelivery } from '@/types/tier1-features'

interface WebhookOverviewProps {
  organizationId: string
}

type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'none'

/**
 * WebhookOverview Component — Summary dashboard card
 *
 * Displays aggregate webhook stats: total, active/inactive counts,
 * recent delivery success rate, last delivery time, and health indicator.
 */
export function WebhookOverview({ organizationId }: WebhookOverviewProps) {
  const [totalCount, setTotalCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [inactiveCount, setInactiveCount] = useState(0)
  const [successRate, setSuccessRate] = useState<number | null>(null)
  const [lastDelivery, setLastDelivery] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthStatus>('none')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organizationId) return
    loadOverview()
  }, [organizationId])

  async function loadOverview() {
    try {
      setLoading(true)

      // Fetch subscriptions
      const subData = await apiGet<{ subscriptions: WebhookSubscription[] }>(
        '/api/webhooks/subscriptions'
      )
      const subs = subData.subscriptions || []

      setTotalCount(subs.length)
      const active = subs.filter((s) => s.active).length
      setActiveCount(active)
      setInactiveCount(subs.length - active)

      // Fetch recent deliveries for active subscriptions to compute success rate
      let totalDeliveries = 0
      let successfulDeliveries = 0
      let latestTimestamp: string | null = null

      // Only check active subscriptions (cap at 10 to avoid too many requests)
      const activeSubs = subs.filter((s) => s.active).slice(0, 10)

      const deliveryPromises = activeSubs.map((sub) =>
        apiGet<{ deliveries: WebhookDelivery[] }>(
          `/api/webhooks/subscriptions/${sub.id}/deliveries?limit=20`
        ).catch(() => ({ deliveries: [] as WebhookDelivery[] }))
      )

      const results = await Promise.all(deliveryPromises)

      for (const result of results) {
        const deliveries = result.deliveries || []
        totalDeliveries += deliveries.length
        successfulDeliveries += deliveries.filter((d) => d.status === 'delivered').length

        for (const d of deliveries) {
          const ts = d.delivered_at || d.created_at
          if (ts && (!latestTimestamp || ts > latestTimestamp)) {
            latestTimestamp = ts
          }
        }
      }

      setLastDelivery(latestTimestamp)

      if (totalDeliveries > 0) {
        const rate = Math.round((successfulDeliveries / totalDeliveries) * 100)
        setSuccessRate(rate)

        // Health: >=90% = healthy, >=70% = degraded, <70% = critical
        if (rate >= 90) setHealth('healthy')
        else if (rate >= 70) setHealth('degraded')
        else setHealth('critical')
      } else if (subs.length > 0) {
        setSuccessRate(null)
        setHealth('none')
      } else {
        setSuccessRate(null)
        setHealth('none')
      }
    } catch {
      // Silently degrade — the main list will show its own error
      setHealth('none')
    } finally {
      setLoading(false)
    }
  }

  const healthConfig: Record<
    HealthStatus,
    { color: string; bg: string; label: string; dot: string }
  > = {
    healthy: { color: 'text-green-700', bg: 'bg-green-100', label: 'Healthy', dot: 'bg-green-500' },
    degraded: {
      color: 'text-amber-700',
      bg: 'bg-amber-100',
      label: 'Degraded',
      dot: 'bg-amber-500',
    },
    critical: { color: 'text-red-700', bg: 'bg-red-100', label: 'Critical', dot: 'bg-red-500' },
    none: { color: 'text-gray-500', bg: 'bg-gray-100', label: 'No Data', dot: 'bg-gray-400' },
  }

  function formatTimestamp(ts: string) {
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-7 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (totalCount === 0) {
    return null // Don't show overview when no webhooks exist
  }

  const hc = healthConfig[health]

  return (
    <div
      className="border border-gray-200 rounded-lg p-6"
      role="region"
      aria-label="Webhook overview"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Webhook Overview
        </h3>
        <Badge variant="default" className={`${hc.bg} ${hc.color}`}>
          <span
            className={`inline-block w-2 h-2 rounded-full ${hc.dot} mr-1.5`}
            aria-hidden="true"
          />
          {hc.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {/* Total Webhooks */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Webhooks</p>
          <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>

        {/* Active / Inactive */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Active / Inactive</p>
          <p className="text-2xl font-bold text-gray-900">
            <span className="text-green-600">{activeCount}</span>
            <span className="text-gray-400 mx-1">/</span>
            <span className="text-gray-400">{inactiveCount}</span>
          </p>
        </div>

        {/* Success Rate */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Delivery Success</p>
          {successRate !== null ? (
            <p
              className={`text-2xl font-bold ${
                successRate >= 90
                  ? 'text-green-600'
                  : successRate >= 70
                    ? 'text-amber-600'
                    : 'text-red-600'
              }`}
            >
              {successRate}%
            </p>
          ) : (
            <p className="text-sm text-gray-400">No deliveries</p>
          )}
        </div>

        {/* Last Delivery */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Last Delivery</p>
          {lastDelivery ? (
            <p
              className="text-lg font-semibold text-gray-900"
              title={new Date(lastDelivery).toLocaleString()}
            >
              {formatTimestamp(lastDelivery)}
            </p>
          ) : (
            <p className="text-sm text-gray-400">None yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
