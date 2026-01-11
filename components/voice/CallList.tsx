"use client"

import React, { useEffect, useState, useRef } from 'react'
import type { Call } from '@/app/voice/page'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRealtime, usePolling } from '@/hooks/useRealtime'

export interface CallListProps {
  calls: Call[]
  selectedCallId?: string | null
  organizationId?: string | null
  onSelect?: (id: string) => void
}

type StatusFilter = 'all' | 'active' | 'completed' | 'failed'
type SortBy = 'date' | 'score' | 'duration'

export default function CallList({ calls: initialCalls, selectedCallId, organizationId, onSelect }: CallListProps) {
  const [calls, setCalls] = useState<Call[]>(initialCalls)
  const [filteredCalls, setFilteredCalls] = useState<Call[]>(initialCalls)
  const [focusedIndex, setFocusedIndex] = useState<number>(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const listRef = useRef<HTMLDivElement | null>(null)
  const pageSize = 20

  // Real-time updates
  const { updates, connected } = useRealtime(organizationId || null)

  // Polling fallback
  const { data: polledCalls } = usePolling<Call>(
    async () => {
      if (!organizationId) return []
      try {
        const res = await fetch(`/api/calls?orgId=${encodeURIComponent(organizationId)}&page=${page}&limit=${pageSize}`)
        if (res.ok) {
          const data = await res.json()
          return data.calls || []
        }
        return []
      } catch {
        return []
      }
    },
    5000, // Poll every 5 seconds for active calls
    !connected && organizationId !== null
  )

  // Process real-time updates
  useEffect(() => {
    if (!updates.length) return

    updates.forEach((update) => {
      if (update.table === 'calls') {
        if (update.eventType === 'INSERT' || update.eventType === 'UPDATE') {
          const updatedCall = update.new
          setCalls((prev) => {
            const existing = prev.findIndex((c) => c.id === updatedCall.id)
            if (existing >= 0) {
              const newCalls = [...prev]
              newCalls[existing] = { ...newCalls[existing], ...updatedCall }
              return newCalls
            } else {
              return [updatedCall, ...prev]
            }
          })
        }
      }
    })
  }, [updates])

  // Use polled data if real-time is disconnected
  useEffect(() => {
    if (!connected && polledCalls.length > 0) {
      setCalls(polledCalls)
    }
  }, [polledCalls, connected])

  // Filter and sort calls
  useEffect(() => {
    let filtered = [...calls]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => {
        if (statusFilter === 'active') {
          return c.status === 'in_progress' || c.status === 'ringing'
        }
        if (statusFilter === 'completed') {
          return c.status === 'completed'
        }
        if (statusFilter === 'failed') {
          return c.status === 'failed' || c.status === 'no-answer' || c.status === 'busy'
        }
        return true
      })
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.id.toLowerCase().includes(query) ||
          c.call_sid?.toLowerCase().includes(query) ||
          c.created_by?.toLowerCase().includes(query)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const aTime = a.started_at ? new Date(a.started_at).getTime() : 0
        const bTime = b.started_at ? new Date(b.started_at).getTime() : 0
        return bTime - aTime // Newest first
      }
      // Add other sort options as needed
      return 0
    })

    setFilteredCalls(filtered)
    setPage(1) // Reset to first page on filter change
  }, [calls, statusFilter, searchQuery, sortBy])

  // Pagination
  const paginatedCalls = filteredCalls.slice(0, page * pageSize)
  const hasMore = filteredCalls.length > page * pageSize

  useEffect(() => {
    if (selectedCallId) {
      const idx = paginatedCalls.findIndex((c) => c.id === selectedCallId)
      if (idx >= 0) setFocusedIndex(idx)
    }
  }, [selectedCallId, paginatedCalls])

  function focusItem(idx: number) {
    setFocusedIndex(idx)
    const container = listRef.current
    const item = container?.querySelectorAll('[role="listitem"]')[idx] as HTMLElement | undefined
    item?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!paginatedCalls || paginatedCalls.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(paginatedCalls.length - 1, focusedIndex + 1)
      focusItem(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(0, focusedIndex - 1)
      focusItem(prev)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const c = paginatedCalls[focusedIndex]
      if (c) onSelect?.(c.id)
    }
  }

  function loadMore() {
    setPage((p) => p + 1)
  }

  const statusVariant = (status: string | null) => {
    if (status === 'completed') return 'success'
    if (status === 'in_progress' || status === 'ringing') return 'info'
    if (status === 'failed' || status === 'no-answer' || status === 'busy') return 'error'
    return 'default'
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filters and Search */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <Input
          label="Search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by ID, SID, or user..."
          className="w-full"
        />

        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </Select>

          <Select
            label="Sort By"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="date">Date (Newest)</option>
            <option value="score">Score</option>
            <option value="duration">Duration</option>
          </Select>
        </div>

        {!connected && (
          <div className="text-xs text-amber-400 flex items-center gap-1">
            <span>⚠</span>
            <span>Real-time disconnected. Using polling.</span>
          </div>
        )}
      </div>

      {/* Call List */}
      <div
        ref={listRef}
        role="list"
        aria-label="Calls list"
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading calls...</div>
        ) : paginatedCalls.length === 0 ? (
          <div className="text-center text-slate-400 py-8">No calls found</div>
        ) : (
          paginatedCalls.map((c, idx) => {
            const selected = selectedCallId === c.id
            return (
              <div
                key={c.id}
                role="listitem"
                tabIndex={-1}
                aria-selected={selected}
                onClick={() => onSelect?.(c.id)}
                onFocus={() => setFocusedIndex(idx)}
                className={`w-full p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-colors cursor-pointer bg-slate-800 hover:bg-slate-700 ${
                  selected ? 'ring-2 ring-indigo-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-slate-100 truncate">{c.id}</h4>
                      <Badge variant={statusVariant(c.status)}>{c.status ?? 'unknown'}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-400 truncate">
                      {c.started_at ? new Date(c.started_at).toLocaleString() : '—'}
                    </div>
                    {c.created_by && (
                      <div className="mt-0.5 text-xs text-slate-500 truncate">By: {c.created_by}</div>
                    )}
                  </div>

                  {c.call_sid && (
                    <div className="ml-3 text-right">
                      <div className="text-xs text-slate-500 font-mono truncate max-w-[100px]">
                        {c.call_sid}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {hasMore && (
          <div className="pt-4 text-center">
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load More ({filteredCalls.length - paginatedCalls.length} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        Showing {paginatedCalls.length} of {filteredCalls.length} calls
      </div>
    </div>
  )
}
