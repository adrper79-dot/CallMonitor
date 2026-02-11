'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiPut } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { useApiQuery } from '@/hooks'

interface SentimentConfig {
  enabled: boolean
  alert_threshold: number
  objection_keywords: string[]
  alert_channels: string[]
  webhook_url: string | null
}

interface SentimentHistory {
  call_id: string
  avg_score: number
  min_score: number
  max_score: number
  total_segments: number
  objection_count: number
  escalation_triggered: boolean
  updated_at: string
  from_number: string
  to_number: string
  call_status: string
  call_started: string
}

/**
 * SentimentDashboard — Full sentiment analytics page.
 *
 * Shows sentiment history across calls, config management,
 * and aggregate metrics. Used on the /analytics route.
 *
 * Professional Design System v3.0
 */
export function SentimentDashboard() {
  const [configEditing, setConfigEditing] = useState(false)
  const [threshold, setThreshold] = useState(-0.5)
  const [keywords, setKeywords] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch config with useApiQuery
  const {
    data: configData,
    loading: configLoading,
    refetch: refetchConfig,
  } = useApiQuery<{ config: SentimentConfig }>('/api/sentiment/config')

  // Fetch history with useApiQuery
  const {
    data: historyData,
    loading: historyLoading,
  } = useApiQuery<{ history: SentimentHistory[] }>('/api/sentiment/history?limit=20')

  const config = configData?.config || null
  const history = historyData?.history || []
  const loading = configLoading || historyLoading

  // Initialize form fields when config loads
  useEffect(() => {
    if (config) {
      setThreshold(config.alert_threshold)
      setKeywords((config.objection_keywords || []).join(', '))
    }
  }, [config])

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await apiPut('/api/sentiment/config', {
        enabled: config?.enabled ?? false,
        alert_threshold: threshold,
        objection_keywords: keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        alert_channels: config?.alert_channels || ['dashboard'],
        webhook_url: config?.webhook_url || null,
      })
      refetchConfig() // Refetch latest config
      setConfigEditing(false)
    } catch (err: any) {
      logger.error('Save sentiment config error', { error: err?.message })
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async () => {
    const newEnabled = !config?.enabled
    setSaving(true)
    try {
      const res = await apiPut('/api/sentiment/config', {
        enabled: newEnabled,
        alert_threshold: config?.alert_threshold ?? -0.5,
        alert_channels: config?.alert_channels || ['dashboard'],
      })
      refetchConfig() // Refetch latest config
    } catch (err: any) {
      logger.error('Toggle sentiment error', { error: err?.message })
    } finally {
      setSaving(false)
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 0.3) return 'text-green-500'
    if (score >= -0.2) return 'text-yellow-500'
    return 'text-red-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // Compute aggregate stats
  const avgScore =
    history.length > 0
      ? history.reduce((sum, h) => sum + Number(h.avg_score), 0) / history.length
      : 0
  const totalObjections = history.reduce((sum, h) => sum + h.objection_count, 0)
  const escalations = history.filter((h) => h.escalation_triggered).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sentiment Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Real-time sentiment tracking and objection detection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config?.enabled ? 'default' : 'secondary'}>
            {config?.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Button size="sm" variant="outline" onClick={toggleEnabled} disabled={saving}>
            {config?.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfigEditing(!configEditing)}>
            ⚙️ Settings
          </Button>
        </div>
      </div>

      {/* Config editor */}
      {configEditing && (
        <div className="rounded-xl border p-4 bg-card space-y-3">
          <h3 className="text-sm font-medium">Alert Configuration</h3>
          <div>
            <label className="text-xs text-muted-foreground">Alert Threshold</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              Alert when score drops below:{' '}
              <span className="font-medium">{threshold.toFixed(1)}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Objection Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full mt-1 text-sm rounded border bg-background px-3 py-2"
              placeholder="cancel, lawsuit, attorney, complaint..."
            />
          </div>
          <Button size="sm" onClick={saveConfig} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      )}

      {/* Aggregate stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs text-muted-foreground">Avg Sentiment</div>
          <div className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs text-muted-foreground">Calls Analyzed</div>
          <div className="text-2xl font-bold">{history.length}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs text-muted-foreground">Objections</div>
          <div className="text-2xl font-bold text-yellow-500">{totalObjections}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card">
          <div className="text-xs text-muted-foreground">Escalations</div>
          <div className="text-2xl font-bold text-red-500">{escalations}</div>
        </div>
      </div>

      {/* History table */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <h3 className="text-sm font-medium">Recent Call Sentiment</h3>
        </div>
        <div className="divide-y">
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No sentiment data yet. Enable sentiment analysis and make some calls.
            </div>
          ) : (
            history.map((h) => (
              <div key={h.call_id} className="p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className={`text-lg font-bold ${scoreColor(Number(h.avg_score))}`}>
                    {Number(h.avg_score).toFixed(2)}
                  </div>
                  <div>
                    <div className="text-xs">
                      {h.from_number} → {h.to_number}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(h.call_started).toLocaleString()} · {h.total_segments} segments
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {h.objection_count > 0 && (
                    <Badge variant="warning" className="text-[10px]">
                      {h.objection_count} objection{h.objection_count > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {h.escalation_triggered && (
                    <Badge variant="error" className="text-[10px]">
                      Escalated
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
