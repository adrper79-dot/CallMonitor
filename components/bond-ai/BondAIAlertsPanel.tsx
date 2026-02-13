'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/apiClient'
import { useRBAC } from '@/hooks/useRBAC'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell, TrendingUp, AlertTriangle, CheckCircle, X, Filter } from 'lucide-react'

interface Alert {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  context_data: any
  status: string
  rule_name?: string
  created_at: string
  ai_insight?: string
  recommended_action?: string
}

interface BondAIAlertsPanelProps {
  className?: string
  compact?: boolean
  organizationId?: string | null
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    icon: '🔴',
    animation: 'animate-pulse',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    icon: '🟡',
    animation: '',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    icon: '🔵',
    animation: '',
  },
}

export default function BondAIAlertsPanel({ className, compact, organizationId }: BondAIAlertsPanelProps) {
  const { role } = useRBAC(organizationId ?? null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [userPreferences, setUserPreferences] = useState<any>({})

  // Adaptive filtering based on role
  const getAdaptiveFilters = () => {
    if (role === 'agent') {
      return { defaultFilter: 'unread', showCritical: true, showPersonal: true }
    } else if (role === 'manager' || role === 'admin') {
      return { defaultFilter: 'all', showCritical: true, showTeam: true }
    }
    return { defaultFilter: 'unread', showCritical: true }
  }

  const adaptiveConfig = getAdaptiveFilters()

  const loadAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('status', filter === 'all' ? 'all' : 'unread')
      if (severityFilter) params.set('severity', severityFilter)
      params.set('limit', compact ? '5' : '25')

      const data = await apiGet(`/api/bond-ai/alerts?${params.toString()}`)
      setAlerts(data.alerts || [])
      setUnreadCount(data.unread_count || 0)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [filter, severityFilter, compact])

  useEffect(() => {
    loadAlerts()
    // Poll every 60 seconds
    const interval = setInterval(loadAlerts, 60000)
    return () => clearInterval(interval)
  }, [loadAlerts])

  const acknowledgeAlert = async (id: string, action: 'read' | 'acknowledged' | 'dismissed') => {
    try {
      await apiPatch(`/api/bond-ai/alerts/${id}`, { status: action })
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: action } : a)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      /* ignore */
    }
  }

  const dismissAll = async () => {
    const unreadIds = alerts.filter((a) => a.status === 'unread').map((a) => a.id)
    if (unreadIds.length === 0) return

    try {
      await apiPost('/api/bond-ai/alerts/bulk-action', {
        alert_ids: unreadIds,
        action: 'read',
      })
      setAlerts((prev) =>
        prev.map((a) => (unreadIds.includes(a.id) ? { ...a, status: 'read' } : a))
      )
      setUnreadCount(0)
    } catch {
      /* ignore */
    }
  }

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (loading) {
    return (
      <div className={`p-4 ${className || ''}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className={`${className || ''} animate-fade-in`}>
      {/* Adaptive Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {role === 'agent' ? 'My AI Alerts' : 'Bond AI Alerts'}
          </h3>
          {adaptiveConfig.showTeam && (
            <Badge variant="secondary" className="text-xs">
              Team
            </Badge>
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 px-2"
            >
              <Filter className="w-4 h-4" />
            </Button>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissAll}
                className="h-8 px-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Mark all read
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Adaptive Filters */}
      {showFilters && !compact && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg animate-slide-down">
          <div className="flex flex-wrap gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="unread">Unread</option>
              <option value="all">All</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            {adaptiveConfig.showPersonal && (
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" className="rounded" />
                Personal alerts only
              </label>
            )}
          </div>
        </div>
      )}

      {/* Alert list with micro-interactions */}
      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 animate-fade-in">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p className="text-sm">All clear! No alerts at this time.</p>
          {role === 'agent' && (
            <p className="text-xs mt-1">AI is monitoring your calls for opportunities.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert, index) => {
            const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info
            const isNew = alert.status === 'unread' && index < 3 // Highlight first 3 unread

            return (
              <Card
                key={alert.id}
                className={`transition-all duration-200 hover:shadow-md ${styles.bg} ${styles.border} ${
                  isNew ? 'ring-2 ring-blue-300 dark:ring-blue-600' : ''
                } ${alert.status === 'unread' ? 'opacity-100' : 'opacity-75'} animate-slide-up`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm ${styles.animation}`}>{styles.icon}</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${styles.badge} transition-colors`}
                        >
                          {alert.severity}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {timeAgo(alert.created_at)}
                        </span>
                        {alert.rule_name && (
                          <Badge variant="secondary" className="text-xs">
                            {alert.rule_name}
                          </Badge>
                        )}
                      </div>

                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {alert.title}
                      </h4>

                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {alert.message}
                      </p>

                      {/* AI Insights for managers/admins */}
                      {alert.ai_insight && (role === 'manager' || role === 'admin') && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                          <TrendingUp className="w-3 h-3 inline mr-1" />
                          <strong>AI Insight:</strong> {alert.ai_insight}
                        </div>
                      )}

                      {/* Recommended Actions */}
                      {alert.recommended_action && (
                        <div className="mt-2 flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            <strong>Recommended:</strong> {alert.recommended_action}
                          </span>
                        </div>
                      )}
                    </div>

                    {alert.status === 'unread' && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id, 'acknowledged')}
                          className="h-6 px-2 text-xs hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 transition-colors"
                        >
                          ✓ Acknowledge
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => acknowledgeAlert(alert.id, 'dismissed')}
                          className="h-6 px-2 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Adaptive Footer */}
      {!compact && alerts.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {alerts.filter(a => a.status === 'unread').length} unread •
              {alerts.filter(a => a.severity === 'critical').length} critical
            </span>
            <span>
              Auto-refreshing every minute
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
