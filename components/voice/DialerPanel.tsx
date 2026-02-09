'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiPost, apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface DialerStats {
  calls: {
    pending: number
    calling: number
    completed: number
    failed: number
    total: number
  }
  agents: {
    available: number
    on_call: number
    wrap_up: number
    total: number
  }
}

interface DialerAgent {
  id: string
  user_id: string
  full_name: string
  email: string
  status: string
  calls_handled: number
  current_call_id: string | null
  updated_at: string
}

interface DialerPanelProps {
  campaignId: string
  campaignName: string
  organizationId: string
}

/**
 * DialerPanel — Predictive dialer control panel for a campaign.
 *
 * Shows dialer queue stats, agent pool status, and provides
 * start/pause/stop controls for outbound dialing.
 *
 * Professional Design System v3.0
 */
export function DialerPanel({ campaignId, campaignName, organizationId }: DialerPanelProps) {
  const [stats, setStats] = useState<DialerStats | null>(null)
  const [agents, setAgents] = useState<DialerAgent[]>([])
  const [dialerStatus, setDialerStatus] = useState<'idle' | 'active' | 'paused'>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Poll stats
  useEffect(() => {
    if (!campaignId) return

    const fetchStats = async () => {
      try {
        const [statsRes, agentsRes] = await Promise.all([
          apiGet<any>(`/api/dialer/stats/${campaignId}`),
          apiGet<any>(`/api/dialer/agents?campaign_id=${campaignId}`),
        ])
        if (statsRes?.stats) {
          setStats(statsRes.stats)
          if (statsRes.campaign?.status === 'active') setDialerStatus('active')
          else if (statsRes.campaign?.status === 'paused') setDialerStatus('paused')
        }
        if (agentsRes?.agents) setAgents(agentsRes.agents)
      } catch (err: any) {
        logger.warn('Dialer stats fetch error', { error: err?.message })
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [campaignId])

  const startDialer = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiPost('/api/dialer/start', {
        campaign_id: campaignId,
        pacing_mode: 'progressive',
        max_concurrent: 5,
      })
      if (res?.success) {
        setDialerStatus('active')
      } else {
        setError(res?.error || 'Failed to start dialer')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to start dialer')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  const pauseDialer = useCallback(async () => {
    setLoading(true)
    try {
      await apiPost('/api/dialer/pause', { campaign_id: campaignId })
      setDialerStatus('paused')
    } catch (err: any) {
      setError(err?.message || 'Failed to pause')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  const stopDialer = useCallback(async () => {
    setLoading(true)
    try {
      await apiPost('/api/dialer/stop', { campaign_id: campaignId })
      setDialerStatus('idle')
    } catch (err: any) {
      setError(err?.message || 'Failed to stop')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  return (
    <div className="rounded-xl border p-4 bg-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📞</span>
          <h3 className="font-semibold text-sm">Predictive Dialer</h3>
          <Badge
            variant={dialerStatus === 'active' ? 'default' : 'secondary'}
            className={`text-xs ${
              dialerStatus === 'active'
                ? 'bg-green-500 animate-pulse'
                : dialerStatus === 'paused'
                  ? 'bg-yellow-500'
                  : ''
            }`}
          >
            {dialerStatus === 'active' ? 'Dialing' : dialerStatus === 'paused' ? 'Paused' : 'Idle'}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{campaignName}</span>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-background/50 p-3 border">
            <div className="text-xs text-muted-foreground mb-1">Call Queue</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div>
                Pending: <span className="font-medium">{stats.calls.pending}</span>
              </div>
              <div>
                Calling: <span className="font-medium text-blue-500">{stats.calls.calling}</span>
              </div>
              <div>
                Done: <span className="font-medium text-green-500">{stats.calls.completed}</span>
              </div>
              <div>
                Failed: <span className="font-medium text-red-500">{stats.calls.failed}</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-background/50 p-3 border">
            <div className="text-xs text-muted-foreground mb-1">Agent Pool</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div>
                Available:{' '}
                <span className="font-medium text-green-500">{stats.agents.available}</span>
              </div>
              <div>
                On Call: <span className="font-medium text-blue-500">{stats.agents.on_call}</span>
              </div>
              <div>
                Wrap-up: <span className="font-medium text-yellow-500">{stats.agents.wrap_up}</span>
              </div>
              <div>
                Total: <span className="font-medium">{stats.agents.total}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent list */}
      {agents.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Agents</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background/30"
              >
                <span>{agent.full_name || agent.email}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${
                    agent.status === 'available'
                      ? 'border-green-500 text-green-500'
                      : agent.status === 'on_call'
                        ? 'border-blue-500 text-blue-500'
                        : 'border-yellow-500 text-yellow-500'
                  }`}
                >
                  {agent.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {dialerStatus === 'idle' && (
          <Button
            onClick={startDialer}
            disabled={loading}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Starting...' : '▶ Start Dialer'}
          </Button>
        )}
        {dialerStatus === 'active' && (
          <>
            <Button
              onClick={pauseDialer}
              disabled={loading}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              {loading ? '...' : '⏸ Pause'}
            </Button>
            <Button
              onClick={stopDialer}
              disabled={loading}
              size="sm"
              variant="destructive"
              className="flex-1"
            >
              {loading ? '...' : '⏹ Stop'}
            </Button>
          </>
        )}
        {dialerStatus === 'paused' && (
          <>
            <Button
              onClick={startDialer}
              disabled={loading}
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? '...' : '▶ Resume'}
            </Button>
            <Button
              onClick={stopDialer}
              disabled={loading}
              size="sm"
              variant="destructive"
              className="flex-1"
            >
              {loading ? '...' : '⏹ Stop'}
            </Button>
          </>
        )}
      </div>

      {/* Error */}
      {error && <div className="text-xs text-red-500 bg-red-500/10 rounded p-2">{error}</div>}
    </div>
  )
}
