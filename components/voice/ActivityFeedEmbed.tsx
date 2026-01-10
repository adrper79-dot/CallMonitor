"use client"

import React from 'react'

// Mock data shape (example):
// [
//   { id: 'e1', call_id: 'call_1', timestamp: '2026-01-09T00:00:00Z', type: 'call.started', title: 'Call started', status: 'info' },
//   { id: 'e2', call_id: 'call_1', timestamp: '2026-01-09T00:00:10Z', type: 'recording.saved', title: 'Recording saved', status: 'success' },
//   { id: 'e3', call_id: 'call_2', timestamp: '2026-01-09T00:01:00Z', type: 'transcription.completed', title: 'Transcription ready', status: 'success' }
// ]

export interface ActivityEvent {
  id: string
  call_id?: string
  timestamp: string
  type: string
  title: string
  status?: 'info' | 'success' | 'warning' | 'error'
  [k: string]: any
}

export default function ActivityFeedEmbed({ callId, limit = 10, events }: { callId?: string; limit?: number; events?: ActivityEvent[] }) {
  // `events` is optional; when omitted, the component renders an empty state.
  // This component is read-only and call-rooted when `callId` is provided.

  const all: ActivityEvent[] = Array.isArray(events) ? events : []
  const filtered = callId ? all.filter(e => e.call_id === callId) : all
  const list = filtered.slice(0, limit)

  function iconFor(type: string) {
    if (type.includes('error')) return '❌'
    if (type.includes('record')) return '⏺️'
    if (type.includes('transcript') || type.includes('transcription')) return '📝'
    if (type.includes('call.started')) return '📞'
    if (type.includes('call.ended')) return '🔚'
    return 'ℹ️'
  }

  return (
    <section aria-label="Activity feed" className="w-full bg-slate-950 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-slate-100">Activity</h4>
        <div className="text-xs text-slate-400">{callId ? `Call: ${callId}` : 'All events'}</div>
      </div>

      <div role="status" aria-live="polite" className="sr-only">{list.length} events shown</div>

      <ul role="list" className="space-y-2">
        {list.length === 0 ? (
          <li className="p-3 bg-slate-900 rounded text-slate-400 text-sm">No recent activity</li>
        ) : (
          list.map(evt => (
            <li key={evt.id} className="p-3 bg-slate-900 rounded flex items-start gap-3" aria-labelledby={`evt-${evt.id}-title`}>
              <div className="text-lg" aria-hidden>{iconFor(evt.type)}</div>
              <div className="flex-1">
                <div id={`evt-${evt.id}-title`} className="text-sm text-slate-100">{evt.title}</div>
                <div className="text-xs text-slate-400">{new Date(evt.timestamp).toLocaleString()}</div>
              </div>
              <div className={`text-xs font-medium ${evt.status === 'error' ? 'text-rose-400' : evt.status === 'warning' ? 'text-amber-400' : 'text-slate-400'}`}>
                {evt.status || 'info'}
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

