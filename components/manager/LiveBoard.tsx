'use client'

/**
 * LiveBoard — Real-time agent status grid
 *
 * Shows all agents with their current state (idle, calling, wrapping, offline),
 * active call duration, listen-in buttons, and live metrics.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Headphones, Mic, MicOff, Phone, PhoneOff, Clock,
  Radio, Volume2, User, Users, Activity, Wifi, WifiOff,
} from 'lucide-react'

type AgentStatus = 'idle' | 'calling' | 'wrapping' | 'offline' | 'break'

interface LiveAgent {
  id: string
  name: string
  email: string
  status: AgentStatus
  current_call_id?: string
  current_account_name?: string
  call_duration_seconds?: number
  calls_today: number
  collections_today: number
  avg_handle_time: number
  last_activity: string
}

const statusConfig: Record<AgentStatus, { label: string; color: string; dotColor: string; icon: React.ReactNode }> = {
  calling: {
    label: 'On Call',
    color: 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    dotColor: 'bg-green-500',
    icon: <Phone className="w-3.5 h-3.5" />,
  },
  idle: {
    label: 'Ready',
    color: 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    icon: <Wifi className="w-3.5 h-3.5" />,
  },
  wrapping: {
    label: 'Wrap-Up',
    color: 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  break: {
    label: 'Break',
    color: 'text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
    dotColor: 'bg-purple-500',
    icon: <User className="w-3.5 h-3.5" />,
  },
  offline: {
    label: 'Offline',
    color: 'text-gray-500 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400',
    dotColor: 'bg-gray-400',
    icon: <WifiOff className="w-3.5 h-3.5" />,
  },
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function LiveBoard() {
  const [agents, setAgents] = useState<LiveAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const fetchAgents = useCallback(async () => {
    try {
      const res = await apiGet('/api/manager/team-members')
      if (res.success && res.members) {
        setAgents(
          res.members.map((m: any) => ({
            id: m.id,
            name: m.name || m.email?.split('@')[0] || 'Agent',
            email: m.email,
            status: m.status || 'offline',
            current_call_id: m.current_call_id,
            current_account_name: m.current_account_name,
            call_duration_seconds: m.call_duration_seconds || 0,
            calls_today: m.calls_today || 0,
            collections_today: m.collections_today || 0,
            avg_handle_time: m.avg_handle_time || 0,
            last_activity: m.last_activity || '',
          }))
        )
      }
    } catch (err: any) {
      logger.error('LiveBoard: Failed to fetch agents', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 10000) // 10s for live feel
    return () => clearInterval(interval)
  }, [fetchAgents])

  // Tick call durations locally
  useEffect(() => {
    const tick = setInterval(() => {
      setAgents((prev) =>
        prev.map((a) =>
          a.status === 'calling' && a.call_duration_seconds !== undefined
            ? { ...a, call_duration_seconds: a.call_duration_seconds + 1 }
            : a
        )
      )
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  const handleListenIn = (agentId: string, callId?: string) => {
    logger.info('Listen-in requested', { agentId, callId })
    // TODO: Wire to WebRTC listen channel
    alert(`Listen-in: agent=${agentId}, call=${callId || 'none'}`)
  }

  const handleWhisper = (agentId: string, callId?: string) => {
    logger.info('Whisper requested', { agentId, callId })
    // TODO: Wire to WebRTC whisper channel
    alert(`Whisper: agent=${agentId}, call=${callId || 'none'}`)
  }

  const sorted = [...agents].sort((a, b) => {
    const order: Record<AgentStatus, number> = { calling: 0, wrapping: 1, idle: 2, break: 3, offline: 4 }
    return (order[a.status] ?? 5) - (order[b.status] ?? 5)
  })

  const statusCounts = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            Live Board
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Status summary pills */}
            <div className="flex items-center gap-1.5 text-xs">
              {Object.entries(statusCounts).map(([status, count]) => {
                const cfg = statusConfig[status as AgentStatus]
                if (!cfg) return null
                return (
                  <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                    {count}
                  </span>
                )
              })}
            </div>
            {/* View toggle */}
            <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`px-2 py-1 text-xs ${view === 'grid' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : 'text-gray-500'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-2 py-1 text-xs ${view === 'list' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : 'text-gray-500'}`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No team members found</p>
          </div>
        ) : view === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sorted.map((agent) => {
              const cfg = statusConfig[agent.status]
              return (
                <div
                  key={agent.id}
                  className={`relative rounded-lg border p-3 transition-all ${
                    agent.status === 'calling'
                      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                      : agent.status === 'offline'
                      ? 'border-gray-200 dark:border-gray-700 opacity-60'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Status dot */}
                  <div className="absolute top-2 right-2">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${cfg.dotColor} ${agent.status === 'calling' ? 'animate-pulse' : ''}`} />
                  </div>

                  {/* Agent info */}
                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate pr-4">{agent.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {cfg.icon}
                      <span className="text-[10px] font-medium text-gray-500">{cfg.label}</span>
                    </div>
                  </div>

                  {/* Call info for active calls */}
                  {agent.status === 'calling' && (
                    <div className="mb-2 px-2 py-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
                      <p className="text-[10px] text-green-700 dark:text-green-400 truncate">{agent.current_account_name || 'Active call'}</p>
                      <p className="text-sm font-mono font-bold text-green-800 dark:text-green-300">
                        {formatDuration(agent.call_duration_seconds || 0)}
                      </p>
                    </div>
                  )}

                  {/* Metrics */}
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-2">
                    <span>{agent.calls_today} calls</span>
                    <span>{formatCurrency(agent.collections_today)}</span>
                  </div>

                  {/* Listen/Whisper for active calls */}
                  {agent.status === 'calling' && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-[10px] gap-1"
                        onClick={() => handleListenIn(agent.id, agent.current_call_id)}
                      >
                        <Headphones className="w-3 h-3" />
                        Listen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-[10px] gap-1"
                        onClick={() => handleWhisper(agent.id, agent.current_call_id)}
                      >
                        <Mic className="w-3 h-3" />
                        Whisper
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Agent</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Current Call</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Calls</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Collected</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Avg Handle</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((agent) => {
                  const cfg = statusConfig[agent.status]
                  return (
                    <tr key={agent.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{agent.name}</p>
                        <p className="text-[10px] text-gray-400">{agent.email}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge className={`text-[10px] ${cfg.color}`}>
                          {cfg.icon}
                          <span className="ml-1">{cfg.label}</span>
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        {agent.status === 'calling' ? (
                          <div>
                            <p className="text-xs text-gray-700 dark:text-gray-300">{agent.current_account_name || '—'}</p>
                            <p className="text-xs font-mono text-green-600">{formatDuration(agent.call_duration_seconds || 0)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">{agent.calls_today}</td>
                      <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(agent.collections_today)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">{formatDuration(agent.avg_handle_time)}</td>
                      <td className="py-2.5 px-3 text-center">
                        {agent.status === 'calling' ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleListenIn(agent.id, agent.current_call_id)}
                              title="Listen in"
                            >
                              <Headphones className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleWhisper(agent.id, agent.current_call_id)}
                              title="Whisper"
                            >
                              <Mic className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
