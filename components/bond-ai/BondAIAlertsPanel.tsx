'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/apiClient'

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
}

interface BondAIAlertsPanelProps {
  className?: string
  compact?: boolean
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    icon: '🔴',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    icon: '🟡',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    icon: '🔵',
  },
}

export default function BondAIAlertsPanel({ className, compact }: BondAIAlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [severityFilter, setSeverityFilter] = useState<string>('')

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
    <div className={className || ''}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bond AI Alerts</h3>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              {unreadCount}
            </span>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'unread')}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="unread">Unread</option>
              <option value="all">All</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            {unreadCount > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <svg
            className="w-8 h-8 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm">No alerts right now</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info
            return (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${styles.bg} ${styles.border} ${
                  alert.status === 'unread' ? 'ring-1 ring-offset-1 ring-blue-300' : 'opacity-80'
                } transition-all`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs">{styles.icon}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${styles.badge}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {timeAgo(alert.created_at)}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {alert.title}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {alert.message}
                    </p>
                  </div>
                  {alert.status === 'unread' && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => acknowledgeAlert(alert.id, 'acknowledged')}
                        className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        title="Acknowledge"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => acknowledgeAlert(alert.id, 'dismissed')}
                        className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-400 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
