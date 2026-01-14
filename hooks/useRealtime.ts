"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Real-time Updates Hook
 * 
 * Subscribes to Supabase real-time updates for calls, recordings, and AI runs.
 * Uses a singleton client to avoid multiple GoTrueClient instances.
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

// Singleton Supabase client for real-time subscriptions
let realtimeClient: SupabaseClient | null = null

function getRealtimeClient(supabaseUrl: string, anonKey: string): SupabaseClient {
  if (!realtimeClient) {
    realtimeClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false, // Don't persist - just for realtime
        autoRefreshToken: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  }
  return realtimeClient
}

export function useRealtime(organizationId: string | null) {
  const [updates, setUpdates] = useState<any[]>([])
  const [connected, setConnected] = useState(false)
  const channelsRef = useRef<any[]>([])
  const setupAttemptedRef = useRef(false)

  useEffect(() => {
    if (!organizationId || setupAttemptedRef.current) {
      return
    }

    setupAttemptedRef.current = true
    let mounted = true
    let supabase: SupabaseClient | null = null

    async function setupRealtime() {
      try {
        // Get real-time config from API
        const res = await fetch('/api/realtime/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: organizationId })
        })

        if (!res.ok || !mounted) {
          return
        }

        const { config } = await res.json()
        if (!config || !mounted) return

        const realtimeConfig: RealtimeConfig = config
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        
        if (!anonKey) {
          console.warn('useRealtime: NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
          return
        }

        // Use singleton client
        supabase = getRealtimeClient(realtimeConfig.supabaseUrl, anonKey)

        // Subscribe to channels
        for (const channelConfig of realtimeConfig.channels) {
          const channelName = `${channelConfig.name}-${organizationId?.slice(0, 8) || 'default'}`
          
          const channel = supabase
            .channel(channelName)
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
                  setUpdates(prev => [...prev.slice(-50), { // Keep last 50 updates
                    ...payload,
                    receivedAt: Date.now()
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
        console.warn('useRealtime: setup failed, using polling fallback')
      }
    }

    setupRealtime()

    return () => {
      mounted = false
      // Unsubscribe from all channels
      channelsRef.current.forEach(channel => {
        if (supabase) {
          try {
            supabase.removeChannel(channel)
          } catch {
            // Ignore cleanup errors
          }
        }
      })
      channelsRef.current = []
      setupAttemptedRef.current = false
    }
  }, [organizationId])

  const clearUpdates = useCallback(() => setUpdates([]), [])

  return {
    updates,
    connected,
    clearUpdates
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
