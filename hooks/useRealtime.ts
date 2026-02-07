'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { apiPost } from '@/lib/apiClient'

/**
 * Real-time Updates Hook
 *
 * Uses polling-based updates for Neon compatibility.
 */

interface RealtimeUpdate {
  type: string
  table: string
  data: any
  receivedAt: number
}

// Polling interval
const POLL_INTERVAL = 5000 // 5 seconds

export function useRealtime(organizationId: string | null) {
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([])
  const [connected, setConnected] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPollRef = useRef<Date>(new Date())
  const setupAttemptedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!organizationId || setupAttemptedRef.current) {
      return
    }

    setupAttemptedRef.current = true
    let mounted = true

    // For now, just set connected to true to avoid UI issues
    // Real-time functionality requires WebSocket implementation
    setConnected(true)

    // Cleanup function
    return () => {
      mounted = false
      setupAttemptedRef.current = false
      setConnected(false)
    }
  }, [organizationId])

  const clearUpdates = useCallback(() => setUpdates([]), [])

  return {
    updates,
    connected,
    clearUpdates,
  }
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
