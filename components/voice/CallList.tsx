"use client"

import React, { useEffect, useState, useRef } from 'react'
import type { Call } from '@/app/voice/page'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
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

/**
 * CallList - Professional Design System v3.0
 * 
 * Clean data table with minimal decoration.
 * Efficient, scannable, keyboard accessible.
 */
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

  const { updates, connected } = useRealtime(organizationId || null)

  const { data: polledCalls } = usePolling<Call>(
    async () => {
      if (!organizationId) return []
      try {
        const res = await fetch(`/api/calls?orgId=${encodeURIComponent(organizationId)}&page=${page}&limit=${pageSize}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          return data.calls || []
        }
        return []
      } catch {
        return []
      }
    },
    5000,
    !connected && organizationId !== null
  )

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

  useEffect(() => {
    if (!connected && polledCalls.length > 0) {
      setCalls(polledCalls)
    }
  }, [polledCalls, connected])

  useEffect(() => {
    let filtered = [...calls]

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

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.id.toLowerCase().includes(query) ||
          c.call_sid?.toLowerCase().includes(query) ||
          c.created_by?.toLowerCase().includes(query)
      )
    }

    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const aTime = a.started_at ? new Date(a.started_at).getTime() : 0
        const bTime = b.started_at ? new Date(b.started_at).getTime() : 0
        return bTime - aTime
      }
      return 0
    })

    setFilteredCalls(filtered)
    setPage(1)
  }, [calls, statusFilter, searchQuery, sortBy])

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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Filters */}
      <div className="p-4 bg-white border-b border-gray-200 space-y-3">
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search calls..."
          className="w-full"
        />

        <div className="grid grid-cols-2 gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortBy)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Newest First" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Newest First</SelectItem>
              <SelectItem value="score">By Score</SelectItem>
              <SelectItem value="duration">By Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!connected && (
          <div className="text-xs text-warning">
            Offline mode - using cached data
          </div>
        )}
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-auto" ref={listRef} onKeyDown={onKeyDown}>
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : paginatedCalls.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No calls found</div>
        ) : (
          <table className="w-full border-collapse bg-white">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-left">ID</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-left">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-left">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-left">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCalls.map((c, idx) => {
                const selected = selectedCallId === c.id
                return (
                  <tr
                    key={c.id}
                    role="listitem"
                    tabIndex={0}
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
                      selected ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm">
                      <span className="font-mono text-xs text-gray-900">{c.id.slice(0, 8)}...</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(c.status)}>{c.status ?? 'unknown'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <ClientDate date={c.started_at} format="short" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.created_by || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {hasMore && (
          <div className="p-4 bg-white border-t border-gray-200 text-center">
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load More ({filteredCalls.length - paginatedCalls.length} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-3 bg-white border-t border-gray-200 text-xs text-gray-500">
        {paginatedCalls.length} of {filteredCalls.length} calls
      </div>
    </div>
  )
}
