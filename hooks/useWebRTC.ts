"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete, apiGet } from '@/lib/apiClient'
import { useSignalWireContext } from '@/contexts/SignalWireContext'

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
  signalwire_number: string | null
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

/**
 * Load SignalWire SDK with deduplication
 * Uses context-based promise ref to prevent multiple loads per instance
 */
function useSignalWireSDKLoader() {
  const { sdkPromiseRef } = useSignalWireContext()

  const loadSignalWire = useCallback(async (): Promise<any> => {
    if (sdkPromiseRef.current) {
      return sdkPromiseRef.current
    }

    sdkPromiseRef.current = (async () => {
      // Dynamic import to avoid SSR issues
      const { SignalWire } = await import('@signalwire/js')
      return SignalWire
    })()

    return sdkPromiseRef.current
  }, [sdkPromiseRef])

  return { loadSignalWire }
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

  // SDK Loader
  const { loadSignalWire } = useSignalWireSDKLoader()

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

      // ALWAYS delete any existing session first to ensure clean slate
      // This prevents waiting for 5-minute timeout on stale sessions
      console.log('[WebRTC] Cleaning up any existing sessions...')
      try {
        await apiDelete('/api/webrtc/session')
      } catch (cleanupErr) {
        // Ignore cleanup errors (e.g., if no session exists)
        console.log('[WebRTC] Session cleanup completed (or no session to clean)')
      }

      // Create fresh WebRTC session
      const response = await apiPost<{ success: boolean; session: WebRTCSession; error?: any }>(
        '/api/webrtc/session'
      )

      if (!response.success || !response.session) {
        throw new Error(response.error?.message || 'Failed to create WebRTC session')
      }

      const session = response.session
      sessionRef.current = session
      setSessionId(session.id)

      // Load SignalWire SDK
      const SignalWire = await loadSignalWire()

      setStatus('connecting')

      // Create SignalWire client
      // For Fabric API subscribers, we need both the token AND subscriber ID
      // The SDK expects this format for Fabric authentication
      const clientOptions: any = {}

      if (session.signalwire_token) {
        // Fabric token format - check if it starts with 'wrtc_' (Fabric subscriber token)
        if (session.signalwire_token.startsWith('wrtc_')) {
          // For Fabric tokens, we need the subscriber name/ID as well
          clientOptions.fabric = {
            subscriber: sessionRef.current!.id, // Use session ID as subscriber name
            token: session.signalwire_token
          }
          console.log('[WebRTC] Using Fabric subscriber authentication')
        } else {
          // Legacy JWT format (starts with 'eyJ')
          clientOptions.token = session.signalwire_token
          console.log('[WebRTC] Using legacy JWT authentication')
        }
      } else if (session.token) {
        // Fallback: Use the session token as the auth token
        clientOptions.token = session.token
      } else {
        // Last resort: Project credentials
        clientOptions.project = session.signalwire_project
      }

      console.log('[WebRTC] Initializing SignalWire client with:', {
        hasToken: !!(clientOptions.token || clientOptions.fabric),
        authType: clientOptions.fabric ? 'Fabric' : (clientOptions.token ? 'JWT' : 'Project'),
        tokenPreview: (clientOptions.fabric?.token || clientOptions.token || 'N/A').substring(0, 10) + '...',
        project: clientOptions.project || 'N/A (using token auth)'
      })

      const client = await SignalWire(clientOptions)

      clientRef.current = client

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
    if (!clientRef.current || !sessionRef.current) {
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

      // Validate phone number - E.164 Compliance
      let cleanNumber = phoneNumber.trim()
      const hasPlus = cleanNumber.startsWith('+')
      const sanitizedNumber = cleanNumber.replace(/\D/g, '')

      if (sanitizedNumber.length < 6) {
        setError('Invalid phone number: Too short (must be at least 6 digits)')
        setCallState('idle')
        return
      }
      if (sanitizedNumber.length > 15) {
        setError('Invalid phone number: Must be no more than 15 digits')
        setCallState('idle')
        return
      }

      // Format to E.164
      let formattedNumber = cleanNumber
      if (hasPlus) {
        formattedNumber = cleanNumber
      } else {
        if (sanitizedNumber.length === 10) {
          formattedNumber = `+1${sanitizedNumber}`
        } else if (sanitizedNumber.length === 11 && sanitizedNumber.startsWith('1')) {
          formattedNumber = `+${sanitizedNumber}`
        } else {
          formattedNumber = `+${sanitizedNumber}`
        }
      }

      console.log('[WebRTC] Initiating conference call:', {
        to: formattedNumber,
        subscriberId: sessionRef.current.id
      })

      // Call backend to initiate conference bridging
      // The backend will:
      // 1. Create a SignalWire conference
      // 2. Dial our browser client (Fabric subscriber) into the conference
      // 3. Dial the PSTN number into the same conference
      const response = await fetch('/api/voice/webrtc-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          destination: formattedNumber,
          subscriber_id: sessionRef.current.id
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to initiate call')
      }

      const data = await response.json()
      console.log('[WebRTC] Conference bridging initiated:', {
        callId: data.call_id,
        conferenceId: data.conference_id
      })

      // The backend has initiated the conference.
      // SignalWire will now call our browser client via Fabric,
      // and we'll receive an incoming call notification via client.on('call.received')

      // Set temporary call state
      setCurrentCall({
        id: data.call_id,
        phone_number: formattedNumber,
        started_at: new Date(),
        duration: 0
      })

      // Set to ringing state while we wait for SignalWire to call us back
      setCallState('ringing')
      setStatus('connecting')

      // The actual call connection happens when SignalWire sends us the incoming call invite
      // See the client.on('call.received') handler in the connect() function

    } catch (err: any) {
      console.error('[WebRTC] makeCall error:', err)
      setError(err?.message || 'Failed to place call')
      setCallState('idle')
      setCurrentCall(null)
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
      // Ignore common error when hanging up a call that's already ending/destroyed
      if (err?.message?.includes('Invalid RTCPeer ID')) {
        console.log('[WebRTC] Call already destroyed (Invalid RTCPeer ID)')
      } else {
        console.error('[WebRTC] hangUp error:', err)
      }

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
