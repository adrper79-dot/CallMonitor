'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { apiGet } from '@/lib/apiClient'

/**
 * Shared Real-time Updates Context
 *
 * Manages a single polling loop per organization and distributes updates
 * to all subscribed components. Eliminates duplicate API calls.
 */

interface RealtimeUpdate {
  type: string
  table: string
  data: any
  receivedAt: number
}

interface RealtimeContextValue {
  updates: RealtimeUpdate[]
  connected: boolean
  subscribe: (organizationId: string) => () => void // Returns unsubscribe function
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

// Global state for shared polling
const globalState = new Map<string, {
  updates: RealtimeUpdate[]
  subscribers: Set<() => void>
  intervalRef: NodeJS.Timeout | null
  lastPollRef: string
  connected: boolean
}>()

// Polling interval — 5 s keeps UI responsive
const POLL_INTERVAL = 5000

function getOrCreateOrgState(organizationId: string) {
  if (!globalState.has(organizationId)) {
    globalState.set(organizationId, {
      updates: [],
      subscribers: new Set(),
      intervalRef: null,
      lastPollRef: new Date().toISOString(),
      connected: false,
    })
  }
  return globalState.get(organizationId)!
}

async function pollOrganization(organizationId: string) {
  const state = getOrCreateOrgState(organizationId)

  try {
    const data = await apiGet(
      `/api/audit-logs?limit=20&since=${encodeURIComponent(state.lastPollRef)}`
    )

    const entries = data.logs || []
    if (entries.length > 0) {
      const newUpdates: RealtimeUpdate[] = entries.map((evt: any) => ({
        type: evt.action || 'update',
        table: evt.resource_type || 'audit_logs',
        data: evt,
        receivedAt: Date.now(),
      }))

      // Update global state
      state.updates = [...newUpdates, ...state.updates].slice(0, 100) // Keep last 100 updates
      state.lastPollRef = new Date().toISOString()
      state.connected = true

      // Notify all subscribers
      state.subscribers.forEach(callback => callback())
    } else {
      state.connected = true
    }
  } catch (error) {
    console.warn(`Realtime polling failed for org ${organizationId}:`, error)
    state.connected = false
  }
}

function startPolling(organizationId: string) {
  const state = getOrCreateOrgState(organizationId)

  if (state.intervalRef) return // Already polling

  // Initial poll
  pollOrganization(organizationId)

  // Set up interval
  state.intervalRef = setInterval(() => {
    pollOrganization(organizationId)
  }, POLL_INTERVAL)
}

function stopPolling(organizationId: string) {
  const state = globalState.get(organizationId)
  if (!state) return

  if (state.intervalRef) {
    clearInterval(state.intervalRef)
    state.intervalRef = null
  }

  // If no more subscribers, clean up
  if (state.subscribers.size === 0) {
    globalState.delete(organizationId)
  }
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [, forceUpdate] = useState(0)

  const subscribe = useCallback((organizationId: string) => {
    const state = getOrCreateOrgState(organizationId)

    // Add subscriber
    const notify = () => forceUpdate(Math.random())
    state.subscribers.add(notify)

    // Start polling if this is the first subscriber
    if (state.subscribers.size === 1) {
      startPolling(organizationId)
    }

    // Return unsubscribe function
    return () => {
      state.subscribers.delete(notify)

      // Stop polling if no more subscribers
      if (state.subscribers.size === 0) {
        stopPolling(organizationId)
      }
    }
  }, [])

  const contextValue: RealtimeContextValue = {
    updates: [], // This will be overridden by individual hooks
    connected: false, // This will be overridden by individual hooks
    subscribe,
  }

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime(organizationId: string | null) {
  const context = useContext(RealtimeContext)
  const [localUpdates, setLocalUpdates] = useState<RealtimeUpdate[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!context || !organizationId) {
      setConnected(false)
      return
    }

    // Subscribe to updates for this organization
    const unsubscribe = context.subscribe(organizationId)

    // Set up local state sync
    const state = getOrCreateOrgState(organizationId)
    setLocalUpdates(state.updates)
    setConnected(state.connected)

    // Listen for updates
    const checkForUpdates = () => {
      const currentState = getOrCreateOrgState(organizationId)
      setLocalUpdates(currentState.updates)
      setConnected(currentState.connected)
    }

    // Initial sync
    checkForUpdates()

    return unsubscribe
  }, [context, organizationId])

  return { updates: localUpdates, connected }
}

/**
 * Polling fallback for real-time updates
 * Now uses shared polling when available
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
