"use client"

import React, { useEffect, useState, useRef } from 'react'
import type { Call } from '@/app/voice/page'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientDate } from '@/components/ui/ClientDate'
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
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      {/* Filters and Search */}
      <div className="p-4 bg-white border-b border-[#E5E5E5] space-y-3">
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
          <div className="text-xs text-[#F57C00] flex items-center gap-1">
            <span>⚠</span>
            <span>Real-time disconnected. Using polling.</span>
          </div>
        )}
      </div>

      {/* Call Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center text-[#666666] py-8">Loading calls...</div>
        ) : paginatedCalls.length === 0 ? (
          <div className="text-center text-[#666666] py-8">No calls found</div>
        ) : (
          <table className="w-full border-collapse bg-white">
            <thead className="sticky top-0 bg-[#FAFAFA] border-b-2 border-[#D0D0D0] z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-[#333333] uppercase tracking-wide text-left">Call ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#333333] uppercase tracking-wide text-left">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#333333] uppercase tracking-wide text-left">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#333333] uppercase tracking-wide text-left">Created By</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#333333] uppercase tracking-wide text-right">Call SID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {paginatedCalls.map((c, idx) => {
                const selected = selectedCallId === c.id
                return (
                  <tr
                    key={c.id}
                    tabIndex={-1}
                    aria-selected={selected}
                    onClick={() => onSelect?.(c.id)}
                    onFocus={() => setFocusedIndex(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect?.(c.id)
                      }
                    }}
                    className={`cursor-pointer transition-colors ${
                      selected ? 'bg-[#E3F2FD]' : 'hover:bg-[#F8F8F8]'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-[#333333]">
                      <span className="font-mono text-xs">{c.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(c.status)}>{c.status ?? 'unknown'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#333333]">
                      <ClientDate date={c.started_at} format="short" />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#666666]">
                      {c.created_by || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.call_sid ? (
                        <span className="text-xs text-[#666666] font-mono">{c.call_sid}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {hasMore && (
          <div className="p-4 bg-white border-t border-[#E5E5E5] text-center">
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load More ({filteredCalls.length - paginatedCalls.length} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 bg-white border-t border-[#E5E5E5] text-xs text-[#666666]">
        Showing {paginatedCalls.length} of {filteredCalls.length} calls
      </div>
    </div>
  )
}
