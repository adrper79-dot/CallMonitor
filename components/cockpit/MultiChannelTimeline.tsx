'use client'

/**
 * MultiChannelTimeline — Unified Communications View for Collections
 *
 * Displays a chronological timeline of all customer touchpoints:
 * - Phone calls (duration, outcome, disposition)
 * - SMS messages (sent/received)
 * - Emails (delivered, opened, clicked)
 * - Payment links (sent, clicked, paid)
 * - Notes & dispositions
 *
 * Features:
 * - Real-time updates via polling (30s)
 * - Channel filtering (All, Calls, SMS, Email, Payments, Notes)
 * - Search within communications
 * - Expandable items for full content
 * - Color-coded by channel type
 * - Mobile-responsive card layout
 * - Dark mode support
 * - Pagination (20 items per page)
 */

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Phone,
  MessageSquare,
  Mail,
  CreditCard,
  FileText,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  DollarSign,
  Eye,
  MousePointer,
} from 'lucide-react'
import type { TimelineItem, TimelineResponse, ChannelType } from '@/types/multi-channel-timeline'

export interface MultiChannelTimelineProps {
  accountId: string
  organizationId: string
  refreshTrigger?: number
}

type FilterOption = 'all' | 'calls' | 'sms' | 'email' | 'payments' | 'notes'

const CHANNEL_COLORS: Record<ChannelType, string> = {
  call: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  sms: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800',
  email: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  payment_link: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  note: 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-800',
}

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  payment_link: <CreditCard className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  call: 'Phone Call',
  sms: 'SMS',
  email: 'Email',
  payment_link: 'Payment Link',
  note: 'Note',
}

export default function MultiChannelTimeline({
  accountId,
  organizationId,
  refreshTrigger = 0,
}: MultiChannelTimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterOption>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const limit = 20

  const fetchTimeline = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset
    setLoading(true)
    try {
      const channelParam = filter !== 'all' ? `&channel=${filter}` : ''
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : ''
      const url = `/api/collections/${accountId}/communications?limit=${limit}&offset=${currentOffset}${channelParam}${searchParam}`
      
      const res = await apiGet<TimelineResponse>(url)
      
      if (reset) {
        setItems(res.communications)
        setOffset(0)
      } else {
        setItems((prev) => [...prev, ...res.communications])
      }
      
      setHasMore(res.pagination.hasMore)
      setTotal(res.pagination.total)
    } catch (err: any) {
      logger.error('Failed to fetch communications timeline', { 
        error: err?.message,
        accountId,
      })
      if (reset) {
        setItems([])
      }
    } finally {
      setLoading(false)
    }
  }, [accountId, offset, filter, search])

  // Initial load + refresh trigger changes
  useEffect(() => {
    fetchTimeline(true)
  }, [fetchTimeline, refreshTrigger])

  // Real-time polling every 30 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchTimeline(true)
    }, 30000)

    return () => clearInterval(pollInterval)
  }, [fetchTimeline])

  // Handle filter change
  const handleFilterChange = (newFilter: FilterOption) => {
    setFilter(newFilter)
    setOffset(0)
    setExpandedIds(new Set())
  }

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setOffset(0)
    setExpandedIds(new Set())
  }

  // Clear search
  const handleClearSearch = () => {
    setSearchInput('')
    setSearch('')
    setOffset(0)
  }

  // Toggle item expansion
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Load more
  const handleLoadMore = () => {
    setOffset((prev) => prev + limit)
  }

  // Render timeline item based on type
  const renderTimelineItem = (item: TimelineItem) => {
    const isExpanded = expandedIds.has(item.id)
    const colorClass = CHANNEL_COLORS[item.channel_type]

    return (
      <Card
        key={item.id}
        className={`border-l-4 ${colorClass} hover:shadow-md transition-shadow`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Channel Icon */}
              <div className={`mt-1 p-2 rounded-lg ${colorClass}`}>
                {CHANNEL_ICONS[item.channel_type]}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" className={colorClass}>
                    {CHANNEL_LABELS[item.channel_type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </span>
                </div>

                {/* Type-specific content */}
                {renderItemContent(item, isExpanded)}
              </div>
            </div>

            {/* Expand/Collapse Button */}
            {hasExpandableContent(item) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpand(item.id)}
                className="shrink-0"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Check if item has expandable content
  const hasExpandableContent = (item: TimelineItem): boolean => {
    if (item.channel_type === 'call') {
      return !!(item.content || item.disposition)
    }
    if (item.channel_type === 'sms' || item.channel_type === 'note') {
      return !!(item.content && item.content.length > 100)
    }
    if (item.channel_type === 'email') {
      return true
    }
    if (item.channel_type === 'payment_link') {
      return true
    }
    return false
  }

  // Render content based on item type
  const renderItemContent = (item: TimelineItem, isExpanded: boolean) => {
    switch (item.channel_type) {
      case 'call':
        return (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {item.status && (
                <Badge variant="secondary" className="text-xs">
                  {item.status}
                </Badge>
              )}
              {item.disposition && (
                <Badge variant="secondary" className="text-xs">
                  {item.disposition}
                </Badge>
              )}
              {item.duration_seconds && (
                <span className="text-xs text-muted-foreground">
                  Duration: {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s
                </span>
              )}
            </div>
            {isExpanded && item.content && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {item.content}
              </p>
            )}
          </div>
        )

      case 'sms':
        return (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              {item.direction === 'outbound' ? (
                <Send className="h-3 w-3 text-muted-foreground" />
              ) : (
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {item.direction === 'outbound' ? 'Sent' : 'Received'}
              </span>
              {item.status && (
                <Badge variant="secondary" className="text-xs">
                  {item.status}
                </Badge>
              )}
            </div>
            {item.content && (
              <p className={`text-sm mt-2 ${!isExpanded && item.content.length > 100 ? 'line-clamp-2' : ''}`}>
                {item.content}
              </p>
            )}
          </div>
        )

      case 'email':
        return (
          <div className="mt-2 space-y-1">
            <p className="font-medium text-sm">{item.subject}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {item.status && <Badge variant="secondary" className="text-xs">{item.status}</Badge>}
              {item.opened_at && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Opened {formatDistanceToNow(new Date(item.opened_at), { addSuffix: true })}
                </span>
              )}
              {item.clicked_at && (
                <span className="flex items-center gap-1">
                  <MousePointer className="h-3 w-3" />
                  Clicked
                </span>
              )}
            </div>
            {isExpanded && (
              <div className="mt-2 text-xs space-y-1">
                <p><span className="font-medium">To:</span> {item.to_email}</p>
                <p><span className="font-medium">From:</span> {item.from_email}</p>
              </div>
            )}
          </div>
        )

      case 'payment_link':
        return (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                ${item.amount.toFixed(2)}
              </span>
              {item.status && (
                <Badge 
                  variant={item.paid_at ? 'default' : 'secondary'} 
                  className="text-xs"
                >
                  {item.status}
                </Badge>
              )}
            </div>
            {isExpanded && (
              <div className="mt-2 text-xs space-y-1">
                {item.sent_at && (
                  <p className="flex items-center gap-1">
                    <Send className="h-3 w-3" />
                    Sent {formatDistanceToNow(new Date(item.sent_at), { addSuffix: true })}
                  </p>
                )}
                {item.clicked_at && (
                  <p className="flex items-center gap-1">
                    <MousePointer className="h-3 w-3" />
                    Clicked {formatDistanceToNow(new Date(item.clicked_at), { addSuffix: true })}
                  </p>
                )}
                {item.paid_at && (
                  <p className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Paid {formatDistanceToNow(new Date(item.paid_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            )}
          </div>
        )

      case 'note':
        return (
          <div className="mt-2 space-y-1">
            <p className="font-medium text-sm">{item.title}</p>
            <div className="flex items-center gap-2">
              {item.type && <Badge variant="secondary" className="text-xs">{item.type}</Badge>}
              {item.status && <Badge variant="secondary" className="text-xs">{item.status}</Badge>}
            </div>
            {isExpanded && item.content && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {item.content}
              </p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communications Timeline
          <Badge variant="secondary" className="ml-auto">
            {total} total
          </Badge>
        </CardTitle>
      </CardHeader>

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4 space-y-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search communications..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {search && (
            <Button type="button" variant="ghost" onClick={handleClearSearch}>
              Clear
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fetchTimeline(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </form>

        {/* Channel Filters */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'calls', 'sms', 'email', 'payments', 'notes'] as FilterOption[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange(f)}
            >
              {f === 'all' ? 'All' : CHANNEL_LABELS[f as ChannelType] || f}
            </Button>
          ))}
        </div>
      </div>

      {/* Timeline Items */}
      <div className="space-y-3">
        {loading && items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading communications...
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">No communications yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start engaging with this account to see the timeline.
              </p>
              <Button variant="default">
                <Send className="h-4 w-4 mr-2" />
                Send First Message
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {items.map((item) => renderTimelineItem(item))}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
