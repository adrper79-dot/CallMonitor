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

/**
 * ActivityFeedEmbed - Professional Design System v3.0
 * 
 * Clean activity feed with minimal decoration.
 * No emojis, subtle status indicators.
 */
export default function ActivityFeedEmbed({ 
  callId, 
  organizationId, 
  limit = 10, 
  events: initialEvents 
}: ActivityFeedEmbedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents || [])
  const [filter, setFilter] = useState<string>('all')

  const { updates, connected } = useRealtime(organizationId || null)

  const { data: polledEvents } = usePolling<ActivityEvent>(
    async () => {
      if (!organizationId) return []
      try {
        const res = await fetch(`/api/audit-logs?orgId=${encodeURIComponent(organizationId)}&limit=${limit}`, { credentials: 'include' })
        if (res.status === 401) return []
        if (res.ok) {
          const data = await res.json()
          return data.events || []
        }
        return []
      } catch {
        return []
      }
    },
    30000,
    !connected && !!organizationId
  )

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
        setEvents((prev) => [event, ...prev].slice(0, limit * 2))
      }
    })
  }, [updates, limit])

  useEffect(() => {
    if (!connected && polledEvents.length > 0) {
      setEvents(polledEvents)
    }
  }, [polledEvents, connected])

  const filteredEvents = events
    .filter((e) => {
      if (callId) return e.call_id === callId
      if (filter !== 'all') return e.type.includes(filter)
      return true
    })
    .slice(0, limit)

  function handleEventClick(event: ActivityEvent) {
    if (event.call_id) {
      window.dispatchEvent(
        new CustomEvent('call:select', {
          detail: { callId: event.call_id },
        })
      )
    }
  }

  return (
    <section aria-label="Activity feed" className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Activity</h3>
        {!connected && (
          <span className="text-xs text-warning" aria-label="Real-time disconnected">
            Offline
          </span>
        )}
      </div>

      {/* Filters */}
      {!callId && (
        <div className="flex gap-1 mb-3">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="text-xs"
          >
            All
          </Button>
          <Button
            variant={filter === 'call' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('call')}
            className="text-xs"
          >
            Calls
          </Button>
          <Button
            variant={filter === 'transcript' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('transcript')}
            className="text-xs"
          >
            Transcripts
          </Button>
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {filteredEvents.length} events shown
      </div>

      {/* Event List */}
      <div className="max-h-[60vh] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            No recent activity
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredEvents.map((evt) => (
              <li
                key={evt.id}
                className={`p-3 bg-gray-50 rounded-md border border-gray-200 transition-colors ${
                  evt.call_id ? 'cursor-pointer hover:bg-gray-100' : ''
                }`}
                onClick={() => evt.call_id && handleEventClick(evt)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{evt.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(evt.timestamp).toLocaleString()}
                    </p>
                    {evt.call_id && (
                      <p className="text-xs text-primary-600 mt-1">
                        Call: {evt.call_id.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      evt.status === 'error' ? 'error' :
                      evt.status === 'warning' ? 'warning' :
                      evt.status === 'success' ? 'success' :
                      'default'
                    }
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
