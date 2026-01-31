"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

interface RecentTarget {
  number: string
  name?: string
  lastCalled: string
  callCount: number
}

interface RecentTargetsProps {
  organizationId: string | null
  onSelect: (number: string, name?: string) => void
  limit?: number
}

/**
 * RecentTargets - Quick Access to Recent Call Targets
 * 
 * Shows recently called numbers for one-click dialing.
 * Professional Design System v3.0
 */
export function RecentTargets({ organizationId, onSelect, limit = 5 }: RecentTargetsProps) {
  const [targets, setTargets] = useState<RecentTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }

    async function fetchRecentTargets() {
      if (!organizationId) return
      
      try {
        // Fetch recent calls to extract target numbers
        const res = await fetch(`/api/calls?orgId=${encodeURIComponent(organizationId)}&limit=50`, {
          credentials: 'include',
        })
        
        if (!res.ok) {
          setLoading(false)
          return
        }

        const data = await res.json()
        const calls = data.calls || []

        // Aggregate targets from calls
        const targetMap = new Map<string, RecentTarget>()
        
        calls.forEach((call: any) => {
          const number = call.to_number
          if (!number) return

          if (targetMap.has(number)) {
            const existing = targetMap.get(number)!
            existing.callCount++
            if (new Date(call.created_at) > new Date(existing.lastCalled)) {
              existing.lastCalled = call.created_at
            }
          } else {
            targetMap.set(number, {
              number,
              name: call.target_name,
              lastCalled: call.created_at,
              callCount: 1,
            })
          }
        })

        // Sort by most recent first
        const sorted = Array.from(targetMap.values())
          .sort((a, b) => new Date(b.lastCalled).getTime() - new Date(a.lastCalled).getTime())

        setTargets(sorted)
      } catch (err) {
        logger.error('RecentTargets: failed to fetch recent calls', err, {
          organizationId
        })
      } finally {
        setLoading(false)
      }
    }

    fetchRecentTargets()
  }, [organizationId])

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-10 bg-gray-100 rounded" />
        <div className="h-10 bg-gray-100 rounded" />
      </div>
    )
  }

  if (targets.length === 0) {
    return null // Don't show anything if no recent targets
  }

  const displayTargets = expanded ? targets : targets.slice(0, limit)

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Recent
        </h4>
        {targets.length > limit && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            {expanded ? 'Show less' : `+${targets.length - limit} more`}
          </button>
        )}
      </div>

      <div className="space-y-1">
        {displayTargets.map((target) => (
          <button
            key={target.number}
            onClick={() => onSelect(target.number, target.name)}
            className="w-full flex items-center gap-3 p-2 rounded-md text-left hover:bg-gray-100 transition-colors group"
          >
            {/* Icon */}
            <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-primary-100 flex items-center justify-center flex-shrink-0">
              <svg 
                className="w-4 h-4 text-gray-400 group-hover:text-primary-600" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-gray-900 truncate">
                {target.number}
              </p>
              {target.name && (
                <p className="text-xs text-gray-500 truncate">{target.name}</p>
              )}
            </div>

            {/* Meta */}
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400">{formatRelativeTime(target.lastCalled)}</p>
              {target.callCount > 1 && (
                <p className="text-xs text-gray-400">{target.callCount} calls</p>
              )}
            </div>

            {/* Action hint */}
            <svg 
              className="w-4 h-4 text-gray-300 group-hover:text-primary-600 flex-shrink-0" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

export default RecentTargets
