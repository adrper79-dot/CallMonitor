"use client"

import React, { useEffect, useState } from 'react'
import { useRealtime, usePolling } from '@/hooks/useRealtime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ActivityEvent {
  id: string
  call_id?: string
  timestamp: string
  type: string
  title: string
  status?: 'info' | 'success' | 'warning' | 'error'
  [k: string]: any
}

export interface ActivityFeedEmbedProps {
  callId?: string
  organizationId?: string | null
  limit?: number
  events?: ActivityEvent[]
}

export default function ActivityFeedEmbed({ callId, organizationId, limit = 10, events: initialEvents }: ActivityFeedEmbedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents || [])
  const [filter, setFilter] = useState<string>('all')

  // Real-time updates
  const { updates, connected } = useRealtime(organizationId || null)

  // Polling fallback for audit logs
  const { data: polledEvents } = usePolling<ActivityEvent>(
    async () => {
      if (!organizationId) return []
      try {
        const res = await fetch(`/api/audit-logs?orgId=${encodeURIComponent(organizationId)}&limit=${limit}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          return data.events || []
        }
        return []
      } catch {
        return []
      }
    },
    10000, // Poll every 10 seconds
    !connected && organizationId !== null
  )

  // Process real-time updates
  useEffect(() => {
    if (!updates.length) return

    updates.forEach((update) => {
      if (update.table === 'audit_logs' || update.table === 'calls' || update.table === 'recordings' || update.table === 'ai_runs') {
        const event: ActivityEvent = {
          id: update.new?.id || `event-${Date.now()}`,
          call_id: update.new?.call_id || update.new?.call_sid || undefined,
          timestamp: update.new?.created_at || new Date().toISOString(),
          type: mapTableToEventType(update.table, update.new),
          title: mapTableToEventTitle(update.table, update.new),
          status: mapTableToEventStatus(update.table, update.new),
        }
        setEvents((prev) => [event, ...prev].slice(0, limit * 2)) // Keep more than limit for filtering
      }
    })
  }, [updates, limit])

  // Use polled events if real-time is disconnected
  useEffect(() => {
    if (!connected && polledEvents.length > 0) {
      setEvents(polledEvents)
    }
  }, [polledEvents, connected])

  // Filter events
  const filteredEvents = events
    .filter((e) => {
      if (callId) return e.call_id === callId
      if (filter !== 'all') return e.type.includes(filter)
      return true
    })
    .slice(0, limit)

  function iconFor(type: string) {
    if (type.includes('error') || type.includes('failed')) return '❌'
    if (type.includes('record')) return '⏺️'
    if (type.includes('transcript') || type.includes('transcription')) return '📝'
    if (type.includes('translation')) return '🌐'
    if (type.includes('survey')) return '📋'
    if (type.includes('score')) return '⭐'
    if (type.includes('call.started') || type.includes('call_started')) return '📞'
    if (type.includes('call.ended') || type.includes('call_ended') || type.includes('call.completed')) return '🔚'
    return 'ℹ️'
  }

  function handleEventClick(event: ActivityEvent) {
    if (event.call_id) {
      // Emit custom event to select call
      window.dispatchEvent(
        new CustomEvent('call:select', {
          detail: { callId: event.call_id },
        })
      )
    }
  }

  return (
    <section aria-label="Activity feed" className="w-full bg-slate-950 rounded-md border border-slate-800">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-100">Activity</h4>
          {!connected && (
            <span className="text-xs text-amber-400" aria-label="Real-time disconnected">
              ⚠
            </span>
          )}
        </div>
        {!callId && (
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="text-xs"
            >
              All
            </Button>
            <Button
              variant={filter === 'call' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('call')}
              className="text-xs"
            >
              Calls
            </Button>
            <Button
              variant={filter === 'transcript' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('transcript')}
              className="text-xs"
            >
              Transcripts
            </Button>
          </div>
        )}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {filteredEvents.length} events shown
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">No recent activity</div>
        ) : (
          <ul role="list" className="divide-y divide-slate-800">
            {filteredEvents.map((evt) => (
              <li
                key={evt.id}
                className={`p-3 hover:bg-slate-900 transition-colors ${
                  evt.call_id ? 'cursor-pointer' : ''
                }`}
                onClick={() => evt.call_id && handleEventClick(evt)}
                aria-labelledby={`evt-${evt.id}-title`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-lg" aria-hidden>
                    {iconFor(evt.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div id={`evt-${evt.id}-title`} className="text-sm text-slate-100">
                      {evt.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(evt.timestamp).toLocaleString()}
                    </div>
                    {evt.call_id && (
                      <div className="text-xs text-indigo-400 mt-1">Call: {evt.call_id}</div>
                    )}
                  </div>
                  <Badge
                    variant={
                      evt.status === 'error' ? 'error' :
                      evt.status === 'warning' ? 'warning' :
                      evt.status === 'success' ? 'success' :
                      'default'
                    }
                    className="text-xs"
                  >
                    {evt.status || 'info'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function mapTableToEventType(table: string, data: any): string {
  if (table === 'calls') {
    if (data.status === 'completed') return 'call.completed'
    if (data.status === 'failed') return 'call.failed'
    return 'call.started'
  }
  if (table === 'recordings') return 'recording.available'
  if (table === 'ai_runs') {
    if (data.model?.includes('transcription')) return 'transcription.completed'
    if (data.model?.includes('translation')) return 'translation.completed'
    return 'ai.run.completed'
  }
  return `${table}.updated`
}

function mapTableToEventTitle(table: string, data: any): string {
  if (table === 'calls') {
    if (data.status === 'completed') return 'Call completed'
    if (data.status === 'failed') return 'Call failed'
    return 'Call started'
  }
  if (table === 'recordings') return 'Recording available'
  if (table === 'ai_runs') {
    if (data.model?.includes('transcription')) return 'Transcription completed'
    if (data.model?.includes('translation')) return 'Translation completed'
    return 'AI processing completed'
  }
  return `${table} updated`
}

function mapTableToEventStatus(table: string, data: any): 'info' | 'success' | 'warning' | 'error' {
  if (table === 'calls') {
    if (data.status === 'completed') return 'success'
    if (data.status === 'failed') return 'error'
    return 'info'
  }
  if (table === 'recordings' || table === 'ai_runs') return 'success'
  return 'info'
}