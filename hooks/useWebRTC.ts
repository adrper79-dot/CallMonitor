"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'

/**
 * WebRTC Hook (SignalWire Voice Client Version)
 * 
 * Strategy: Use Voice.Client (Relay V3) for PSTN Calling.
 * Implementation: Dynamic Import of @signalwire/js to access 'Voice' namespace.
 * Connects via Relay Tunnel (UDP Bypass).
 */

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

export interface UseWebRTCResult {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  status: WebRTCStatus
  error: string | null

  makeCall: (phoneNumber: string) => Promise<void>
  hangUp: () => Promise<void>

  callState: CallState
  currentCall: any

  mute: () => void
  unmute: () => void
  isMuted: boolean

  quality: any
  sessionId: string | null
}

export function useWebRTC(organizationId: string | null): UseWebRTCResult {
  const [status, setStatus] = useState<WebRTCStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentCall, setCurrentCall] = useState<any>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [quality, setQuality] = useState<any>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const clientRef = useRef<any>(null)
  const activeCallRef = useRef<any>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Audio element for Voice Client to bind to (if supported via rootElement or tracks)
      // Voice SDK often handles audio internally or emits tracks
      const audio = new Audio()
      audio.autoplay = true
      remoteAudioRef.current = audio
    }
  }, [])

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (clientRef.current) {
        try { clientRef.current.disconnect() } catch (e) { }
      }
    }
  }, [])

  useEffect(() => {
    if (callState === 'active' && currentCall) {
      durationIntervalRef.current = setInterval(() => {
        setCurrentCall((prev: any) => prev ? { ...prev, duration: Math.floor((Date.now() - prev.started_at.getTime()) / 1000) } : null)
      }, 1000)
    } else {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    }
    return () => { if (durationIntervalRef.current) clearInterval(durationIntervalRef.current) }
  }, [callState, currentCall?.id])

  const connect = useCallback(async () => {
    if (!organizationId) {
      setError('Organization ID required')
      return
    }

    if (status === 'connected' || status === 'connecting') return

    try {
      setStatus('initializing')
      setError(null)

      // 1. Get Session ID
      const sessionRes = await apiPost<{ success: boolean; session: any }>('/api/webrtc/session')
      if (sessionRes.success && sessionRes.session) {
        setSessionId(sessionRes.session.id)
      }

      // 2. Get Relay V3 JWT
      const tokenRes = await apiPost<{ success: boolean; token: string }>('/api/webrtc/token')
      if (!tokenRes.success || !tokenRes.token) {
        throw new Error('Failed to fetch SignalWire Token')
      }

      // 3. Dynamic Import of SDK
      console.log('[SignalWire] Dynamically Importing SDK (Voice Client)...')

      // @ts-ignore
      const module = await import('@signalwire/js')
      console.log('[SignalWire] Module Loaded. Keys:', Object.keys(module))

      // Locate Voice Client
      // Try 'Voice' (Unified) or 'Relay' (V3)
      const ClientClass = (module.Voice && module.Voice.Client) || (module.Relay && module.Relay.Client) || (module.SignalWire && module.SignalWire.Relay && module.SignalWire.Relay.Client)

      if (!ClientClass) {
        console.error('[SignalWire] Could not find Voice/Relay Client in module', module)
        throw new Error('Voice Client class not found in SDK')
      }

      console.log('[SignalWire] Found Client Class')

      // Instantiate
      const client = new ClientClass({
        project: tokenRes.project_id || undefined, // Some clients need project
        token: tokenRes.token,
        // Bind audio? Voice Client usually emits 'track' event or handles it.
      })

      clientRef.current = client

      // Bind Connection Events
      client.on('signalwire.ready', () => {
        console.log('[SignalWire] Voice Client Ready')
        setStatus('connected')
      })

      client.on('signalwire.error', (error: any) => {
        console.error('[SignalWire] Client Error', error)
        setStatus('error')
        setError(error.message)
      })

      client.on('signalwire.notification', (n: any) => {
        // console.log('Notification', n)
      })

      console.log('[SignalWire] Connecting...')
      await client.connect()

    } catch (err: any) {
      console.error('[WebRTC] Connection error:', err)
      setError(err?.message || 'Failed to connect')
      setStatus('error')
    }
  }, [organizationId, status])

  const disconnect = useCallback(async () => {
    try {
      if (activeCallRef.current) await activeCallRef.current.hangup()
      if (clientRef.current) clientRef.current.disconnect()

      try { await apiDelete('/api/webrtc/session') } catch { }
      setStatus('disconnected')
      setCallState('idle')
      setCurrentCall(null)
    } catch (err: any) {
      setError(err?.message)
    }
  }, [])

  const makeCall = useCallback(async (phoneNumber: string) => {
    if (status !== 'connected' || !clientRef.current) {
      setError('Not connected')
      return
    }

    try {
      setCallState('dialing')
      console.log('[SignalWire] Dialing Phone:', phoneNumber)

      // Detect dial method
      const client = clientRef.current
      let callPromise

      if (typeof client.dial === 'function') {
        // Standard Relay Dial
        callPromise = client.dial({ to: phoneNumber, from: process.env.NEXT_PUBLIC_SIGNALWIRE_NUMBER || 'default' })
      } else if (typeof client.dialPhoneNumber === 'function') {
        // Voice Helper
        callPromise = client.dialPhoneNumber({ to: phoneNumber })
      } else {
        throw new Error('No dial method found on client')
      }

      const call = await callPromise
      activeCallRef.current = call
      console.log('[SignalWire] Call Init:', call)

      // Handle Call Events
      // Usually Call object emits events like 'answered', 'ended'
      // Or we must pass handlers in dial?

      // Assuming standard event emitter on Call
      // Note: Event names vary by SDK version. 

      // Check if call is already started?
      setCallState('ringing') // Assume ringing until active

      // We might need to handle remote stream here
      // call.on('track', ...) or call.remoteStream?
      if (call.remoteStream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = call.remoteStream
        remoteAudioRef.current.play()
      }

      setCallState('active')
      setCurrentCall({
        id: call.id,
        phone_number: phoneNumber,
        started_at: new Date(),
        duration: 0
      })

    } catch (err: any) {
      console.error('[SignalWire] Call Failed:', err)
      setCallState('idle')
      setError(err.message)
    }

  }, [status])

  const hangUp = useCallback(async () => {
    if (activeCallRef.current) {
      await activeCallRef.current.hangup()
    }
    setCallState('idle')
    setCurrentCall(null)
  }, [])

  const mute = useCallback(() => { /* TODO */ }, [])
  const unmute = useCallback(() => { /* TODO */ }, [])

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
    sessionId
  }
}
