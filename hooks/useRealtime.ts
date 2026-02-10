'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'

/**
 * Real-time Updates Hook
 *
 * Polls audit_logs for recent changes and emits typed updates.
 * Consumers (ActivityFeedEmbed, call status panel) receive a
 * unified stream without needing WebSockets.
 */

interface RealtimeUpdate {
  type: string
  table: string
  data: any
  receivedAt: number
}

// Polling interval — 5 s keeps UI responsive without hammering the API
const POLL_INTERVAL = 5000

export function useRealtime(organizationId: string | null) {
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([])
  const [connected, setConnected] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPollRef = useRef<string>(new Date().toISOString())

  useEffect(() => {
    if (!organizationId) {
      setConnected(false)
      return
    }

    let mounted = true

    async function poll() {
      try {
        const data = await apiGet(
          `/api/audit-logs?limit=20&since=${encodeURIComponent(lastPollRef.current)}`
        )

        if (!mounted) return

        const entries = data.logs || []
        if (entries.length > 0) {
          const newUpdates: RealtimeUpdate[] = entries.map((evt: any) => ({
            type: evt.action || 'update',
            table: evt.resource_type || 'audit_logs',
            data: {
              id: evt.id || evt.resource_id,
              call_id: evt.resource_type === 'calls' ? evt.resource_id : undefined,
              status:
                (typeof evt.new_value === 'object' ? evt.new_value?.status : undefined) ||
                undefined,
              created_at: evt.created_at,
              ...(typeof evt.new_value === 'object' ? evt.new_value : {}),
            },
            receivedAt: Date.now(),
          }))

          setUpdates(newUpdates)

          // Advance cursor to newest event
          const newest = entries[0]?.created_at
          if (newest) lastPollRef.current = newest
        }

        if (mounted) setConnected(true)
      } catch (err: any) {
        if (err?.status === 401 && mounted) {
          setConnected(false)
          return
        }
        // Non-auth errors — stay in polling loop but flag disconnected
        if (mounted) setConnected(false)
      }
    }

    // Initial poll
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      mounted = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setConnected(false)
    }
  }, [organizationId])

  const clearUpdates = useCallback(() => setUpdates([]), [])

  return { updates, connected, clearUpdates }
}

/**
 * Polling fallback for real-time updates
 */
export function usePolling<T>(
  fetchFn: () => Promise<T[]>,
  intervalMs: number = 5000,
  enabled: boolean = true
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let mounted = true

    async function poll() {
      try {
        const result = await fetchFn()
        if (mounted) {
          setData(result)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    poll()
    const interval = setInterval(poll, intervalMs)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [fetchFn, intervalMs, enabled])

  return { data, loading }
}
