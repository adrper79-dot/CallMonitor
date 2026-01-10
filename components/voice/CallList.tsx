"use client"

import React, { useEffect, useState, useRef } from 'react'
import type { Call } from '@/app/voice/page'

export interface CallListProps {
  calls: Call[]
  selectedCallId?: string | null
  onSelect: (id: string) => void
}

export default function CallList({ calls, selectedCallId, onSelect }: CallListProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(() => {
    if (!selectedCallId) return 0
    const idx = calls.findIndex(c => c.id === selectedCallId)
    return idx >= 0 ? idx : 0
  })

  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (selectedCallId) {
      const idx = calls.findIndex(c => c.id === selectedCallId)
      if (idx >= 0) setFocusedIndex(idx)
    }
  }, [selectedCallId, calls])

  function focusItem(idx: number) {
    setFocusedIndex(idx)
    const container = listRef.current
    const item = container?.querySelectorAll('[role="listitem"]')[idx] as HTMLElement | undefined
    item?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!calls || calls.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(calls.length - 1, focusedIndex + 1)
      focusItem(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(0, focusedIndex - 1)
      focusItem(prev)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const c = calls[focusedIndex]
      if (c) onSelect(c.id)
    }
  }

  return (
    <div ref={listRef} role="list" aria-label="Calls list" onKeyDown={onKeyDown} tabIndex={0} className="space-y-2">
      {calls.map((c, idx) => {
        const selected = selectedCallId === c.id
        return (
          <div
            key={c.id}
            role="listitem"
            tabIndex={-1}
            aria-selected={selected}
            onClick={() => onSelect(c.id)}
            onFocus={() => setFocusedIndex(idx)}
            className={
              `w-full p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors cursor-pointer bg-slate-800 hover:bg-slate-700 ${selected ? 'ring-2 ring-indigo-500' : ''}`
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-slate-100 truncate">{c.id}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'completed' ? 'bg-green-600' : c.status === 'in_progress' ? 'bg-indigo-600' : 'bg-gray-600'} text-slate-100`}>{c.status ?? 'unknown'}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400 truncate">Started: {c.started_at ?? '—'}</div>
                <div className="mt-0.5 text-xs text-slate-400 truncate">Created by: {c.created_by ?? '—'}</div>
              </div>

              <div className="ml-3 text-right">
                {/* duration is not on calls in Schema.txt; omit unless available via server action */}
                {c.call_sid ? <div className="text-xs text-slate-300">SID: {c.call_sid}</div> : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
