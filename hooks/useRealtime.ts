"use client"

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

/**
 * Real-time Updates Hook
 * 
 * Subscribes to Supabase real-time updates for calls, recordings, and AI runs.
 * Per PRODUCTION_READINESS_TASKS.md
 */

interface RealtimeConfig {
  supabaseUrl: string
  organizationId: string
  channels: Array<{
    name: string
    table: string
    filter: string
  }>
}

export function useRealtime(organizationId: string | null) {
  const [updates, setUpdates] = useState<any[]>([])
  const [connected, setConnected] = useState(false)
  const channelsRef = useRef<any[]>([])

  useEffect(() => {
    if (!organizationId) {
      return
    }

    let supabase: any = null
    let mounted = true

    async function setupRealtime() {
      try {
        // Get real-time config from API
        const res = await fetch('/api/realtime/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: organizationId })
        })

        if (!res.ok) {
          // Fallback to polling if real-time fails
          return
        }

        const { config } = await res.json()
        const realtimeConfig: RealtimeConfig = config

        // Initialize Supabase client
        supabase = createClient(
          realtimeConfig.supabaseUrl,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        )

        // Subscribe to channels
        for (const channelConfig of realtimeConfig.channels) {
          const channel = supabase
            .channel(channelConfig.name)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: channelConfig.table,
                filter: channelConfig.filter
              },
              (payload: any) => {
                if (mounted) {
                  setUpdates(prev => [...prev, {
                    ...payload,
                    timestamp: new Date().toISOString()
                  }])
                }
              }
            )
            .subscribe((status: string) => {
              if (mounted) {
                setConnected(status === 'SUBSCRIBED')
              }
            })

          channelsRef.current.push(channel)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('useRealtime: setup failed', err)
        // Fallback to polling
      }
    }

    setupRealtime()

    return () => {
      mounted = false
      // Unsubscribe from all channels
      channelsRef.current.forEach(channel => {
        if (supabase) {
          supabase.removeChannel(channel)
        }
      })
      channelsRef.current = []
    }
  }, [organizationId])

  return {
    updates,
    connected,
    clearUpdates: () => setUpdates([])
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
