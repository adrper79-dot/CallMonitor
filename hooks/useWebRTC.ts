"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete, apiGet } from '@/lib/apiClient'

/**
 * WebRTC Hook
 * 
 * Manages browser-based calling via SignalWire WebRTC.
 * Per ARCH_DOCS: SignalWire-first execution, credentials: include for all API calls.
 * 
 * Usage:
 * const { connect, disconnect, makeCall, hangUp, status, callState } = useWebRTC(organizationId)
 */

// SignalWire Client type (loaded dynamically to avoid SSR issues)
type SignalWireClient = any

export type WebRTCStatus =
  | 'disconnected'
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'on_call'
  | 'error'

export type CallState =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'active'
  | 'ending'

export interface WebRTCSession {
  id: string
  token: string
  signalwire_project: string
  signalwire_space: string
  signalwire_token: string | null
  ice_servers: RTCIceServer[]
}

export interface CallQuality {
  audio_bitrate?: number
  packet_loss_percent?: number
  jitter_ms?: number
  round_trip_time_ms?: number
}

export interface UseWebRTCResult {
  // Connection
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  status: WebRTCStatus
  error: string | null

  // Calling
  makeCall: (phoneNumber: string, options?: CallOptions) => Promise<void>
  hangUp: () => Promise<void>
  callState: CallState
  currentCall: CurrentCall | null

  // Controls
  mute: () => void
  unmute: () => void
  isMuted: boolean

  // Quality
  quality: CallQuality | null

  // Session info
  sessionId: string | null
}

export interface CallOptions {
  record?: boolean
  transcribe?: boolean
  translate?: boolean
  translate_from?: string
  translate_to?: string
}

export interface CurrentCall {
  id: string
  phone_number: string
  started_at: Date
  duration: number
}

// Singleton SignalWire client
let signalWireClient: SignalWireClient | null = null
let signalWirePromise: Promise<any> | null = null

async function loadSignalWire(): Promise<any> {
  if (signalWirePromise) return signalWirePromise

  signalWirePromise = (async () => {
    // Dynamic import to avoid SSR issues
    const { SignalWire } = await import('@signalwire/js')
    return SignalWire
  })()

  return signalWirePromise
}

export function useWebRTC(organizationId: string | null): UseWebRTCResult {
  // State
  const [status, setStatus] = useState<WebRTCStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [quality, setQuality] = useState<CallQuality | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Refs
  const clientRef = useRef<SignalWireClient | null>(null)
  const callRef = useRef<any>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const qualityIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sessionRef = useRef<WebRTCSession | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current)
      // Don't disconnect on unmount - let the user control this
    }
  }, [])

  /**
   * Connect to SignalWire WebRTC
   */
  const connect = useCallback(async () => {
    if (!organizationId) {
      setError('Organization ID required')
      return
    }

    if (status === 'connected' || status === 'connecting') {
      return // Already connected or connecting
    }

    try {
      setStatus('initializing')
      setError(null)

      // Try to create WebRTC session via API
      let response = await apiPost<{ success: boolean; session: WebRTCSession; error?: any }>(
        '/api/webrtc/session'
      )

      // If session exists, end it and retry once (ARCH_DOCS: robust, idempotent session management)
      if (
        response?.error?.code === 'SESSION_EXISTS' ||
        (response as any)?.error?.message?.includes('Active WebRTC session already exists')
      ) {
        await apiDelete('/api/webrtc/session')
        response = await apiPost<{ success: boolean; session: WebRTCSession; error?: any }>(
          '/api/webrtc/session'
        )
      }

      if (!response.success || !response.session) {
        throw new Error('Failed to create WebRTC session')
      }

      const session = response.session
      sessionRef.current = session
      setSessionId(session.id)

      // Load SignalWire SDK
      const SignalWire = await loadSignalWire()

      setStatus('connecting')

      // Create SignalWire client
      // IMPORTANT: The @signalwire/js SDK v3+ automatically connects to relay.signalwire.com
      // Do NOT pass a custom "host" parameter - it will break WebSocket connections
      const clientOptions: any = {}

      if (session.signalwire_token) {
        // Use the JWT token from SignalWire's Relay REST API
        clientOptions.token = session.signalwire_token
      } else if (session.token) {
        // Fallback: Use the session token as the auth token
        clientOptions.token = session.token
      } else {
        // Last resort: Project credentials (requires correct Relay configuration in SignalWire)
        clientOptions.project = session.signalwire_project
        // Note: Project-based auth also doesn't need host - SDK handles it
      }

      console.log('[WebRTC] Initializing SignalWire client with:', {
        hasToken: !!clientOptions.token,
        tokenPreview: clientOptions.token ? `${clientOptions.token.substring(0, 10)}...` : 'MISSING',
        project: clientOptions.project || 'N/A (using token auth)'
      })

      const client = await SignalWire(clientOptions)

      clientRef.current = client
      signalWireClient = client

      // Set up event handlers
      client.on('call.received', (call: any) => {
        // Handle incoming calls
        console.log('[WebRTC] Incoming call:', call)
      })

      client.on('call.state', (state: any) => {
        console.log('[WebRTC] Call state changed:', state)
      })

      setStatus('connected')

      // Start quality monitoring
      qualityIntervalRef.current = setInterval(async () => {
        if (callRef.current) {
          try {
            const stats = await callRef.current.getStats()
            if (stats) {
              setQuality({
                audio_bitrate: stats.audio?.bitrate,
                packet_loss_percent: stats.audio?.packetsLost,
                jitter_ms: stats.audio?.jitter,
                round_trip_time_ms: stats.audio?.roundTripTime,
              })
            }
          } catch {
            // Ignore stats errors
          }
        }
      }, 5000)

    } catch (err: any) {
      console.error('[WebRTC] Connection error:', err)
      setError(err?.message || 'Failed to connect')
      setStatus('error')
    }
  }, [organizationId, status])

  /**
   * Disconnect from WebRTC
   */
  const disconnect = useCallback(async () => {
    try {
      // Hang up any active call
      if (callRef.current) {
        await callRef.current.hangup()
        callRef.current = null
      }

      // Disconnect client
      if (clientRef.current) {
        await clientRef.current.disconnect()
        clientRef.current = null
        signalWireClient = null
      }

      // End session on server
      if (sessionRef.current) {
        try {
          await apiDelete('/api/webrtc/session')
        } catch {
          // Ignore cleanup errors
        }
        sessionRef.current = null
      }

      // Clear intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
      if (qualityIntervalRef.current) {
        clearInterval(qualityIntervalRef.current)
        qualityIntervalRef.current = null
      }

      // Reset state
      setStatus('disconnected')
      setCallState('idle')
      setCurrentCall(null)
      setIsMuted(false)
      setQuality(null)
      setSessionId(null)
      setError(null)

    } catch (err: any) {
      console.error('[WebRTC] Disconnect error:', err)
      setError(err?.message || 'Failed to disconnect')
    }
  }, [])

  /**
   * Make an outbound call
   */
  const makeCall = useCallback(async (phoneNumber: string, options?: CallOptions) => {
    if (!clientRef.current) {
      setError('Not connected. Call connect() first.')
      return
    }

    if (callState !== 'idle') {
      setError('Already on a call')
      return
    }

    try {
      setCallState('dialing')
      setError(null)

      // Normalize phone number
      const formattedNumber = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+1${phoneNumber.replace(/\D/g, '')}`

      // Create call via SignalWire client
      const call = await clientRef.current.dial({
        to: formattedNumber,
        nodeId: undefined, // Let SignalWire choose
        // Pass modulation options
        ...(options?.record && { record: true }),
        ...(options?.transcribe && { transcribe: true }),
      })

      callRef.current = call

      // Set up call event handlers
      call.on('state', (state: string) => {
        console.log('[WebRTC] Call state:', state)
        switch (state) {
          case 'ringing':
            setCallState('ringing')
            break
          case 'active':
          case 'answered':
            setCallState('active')
            setStatus('on_call')
            setCurrentCall({
              id: call.id,
              phone_number: formattedNumber,
              started_at: new Date(),
              duration: 0,
            })
            // Start duration timer
            durationIntervalRef.current = setInterval(() => {
              setCurrentCall(prev => prev ? {
                ...prev,
                duration: Math.floor((Date.now() - prev.started_at.getTime()) / 1000)
              } : null)
            }, 1000)
            break
          case 'ending':
          case 'hangup':
            setCallState('ending')
            break
          case 'destroy':
          case 'ended':
            if (durationIntervalRef.current) {
              clearInterval(durationIntervalRef.current)
              durationIntervalRef.current = null
            }
            callRef.current = null
            setCallState('idle')
            setCurrentCall(null)
            setStatus('connected')
            break
        }
      })

      call.on('error', (err: any) => {
        console.error('[WebRTC] Call error:', err)
        setError(err?.message || 'Call failed')
        setCallState('idle')
        setStatus('connected')
        callRef.current = null
      })

    } catch (err: any) {
      console.error('[WebRTC] makeCall error:', err)
      setError(err?.message || 'Failed to place call')
      setCallState('idle')
    }
  }, [callState])

  /**
   * Hang up current call
   */
  const hangUp = useCallback(async () => {
    if (!callRef.current) {
      return
    }

    try {
      setCallState('ending')
      await callRef.current.hangup()
    } catch (err: any) {
      console.error('[WebRTC] hangUp error:', err)
      // Force cleanup
      callRef.current = null
      setCallState('idle')
      setCurrentCall(null)
      setStatus('connected')
    }
  }, [])

  /**
   * Mute microphone
   */
  const mute = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.mute()
        setIsMuted(true)
      } catch (err) {
        console.error('[WebRTC] mute error:', err)
      }
    }
  }, [])

  /**
   * Unmute microphone
   */
  const unmute = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.unmute()
        setIsMuted(false)
      } catch (err) {
        console.error('[WebRTC] unmute error:', err)
      }
    }
  }, [])

  return {
    connect,
    disconnect,
    status,
    error,
    makeCall,
    hangUp,
    callState,
    currentCall,
    mute,
    unmute,
    isMuted,
    quality,
    sessionId,
  }
}
