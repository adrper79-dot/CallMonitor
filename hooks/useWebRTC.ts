"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'
import { SignalWire } from '@signalwire/js'

/**
 * WebRTC Hook (SignalWire SDK Version)
 * 
 * Manages browser-based calling via SignalWire Unified SDK (v3).
 * Uses 'Call Fabric' pattern via { SignalWire } export.
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

export interface WebRTCSession {
  id: string
}

export interface CallQuality {
  packet_loss_percent?: number
  audio_bitrate?: number
  jitter_ms?: number
  round_trip_time_ms?: number
}

export interface CurrentCall {
  id: string
  phone_number: string
  started_at: Date
  duration: number
}

export interface UseWebRTCResult {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  status: WebRTCStatus
  error: string | null

  makeCall: (phoneNumber: string) => Promise<void>
  hangUp: () => Promise<void>

  callState: CallState
  currentCall: CurrentCall | null

  mute: () => void
  unmute: () => void
  isMuted: boolean

  quality: CallQuality | null
  sessionId: string | null
}

export function useWebRTC(organizationId: string | null): UseWebRTCResult {
  const [status, setStatus] = useState<WebRTCStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [quality, setQuality] = useState<CallQuality | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const clientRef = useRef<any>(null)
  const activeCallRef = useRef<any>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio()
      audio.autoplay = true
      remoteAudioRef.current = audio
    }
  }, [])

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (clientRef.current) clientRef.current.disconnect()
    }
  }, [])

  useEffect(() => {
    if (callState === 'active' && currentCall) {
      durationIntervalRef.current = setInterval(() => {
        setCurrentCall(prev => prev ? { ...prev, duration: Math.floor((Date.now() - prev.started_at.getTime()) / 1000) } : null)
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

      // 2. Get JWT Token
      const tokenRes = await apiPost<{ success: boolean; token: string }>('/api/webrtc/token')
      if (!tokenRes.success || !tokenRes.token) {
        throw new Error('Failed to fetch SignalWire Token')
      }

      // 3. Initialize SignalWire Client
      console.log('[SignalWire] Initializing Fabric Client')
      console.log('[SignalWire] Factory:', SignalWire)

      // Use the Factory function pattern for Call Fabric
      // @ts-ignore
      const client = await SignalWire({
        token: tokenRes.token,
        // rootElement: remoteAudioRef.current // Optional
      })

      console.log('[SignalWire] Client Created:', client)

      // Connect
      await client.connect()
      console.log('[SignalWire] Client Connected')

      setStatus('connected')
      clientRef.current = client

      // Handle Incoming Calls?
      // client.on('call.received', ...)

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
    if (!clientRef.current || status !== 'connected') {
      setError('Not connected')
      return
    }

    try {
      setCallState('dialing')
      const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '')

      console.log('[SignalWire] Dialing:', cleanNumber)

      // Fabric Dialing
      const call = await clientRef.current.dial({
        to: cleanNumber,
        rootElement: remoteAudioRef.current // Bind audio here
      })

      activeCallRef.current = call
      console.log('[SignalWire] Call Object:', call)

      // Need to listen to call state
      // Fabric Call object might expose .on('state', ...) or promises
      // Assuming 'call' is the active session.

      // If dial matches successfully, we are active?
      setCallState('active')
      setCurrentCall({
        id: call.id || Math.random().toString(),
        phone_number: phoneNumber,
        started_at: new Date(),
        duration: 0
      })

      // Listen for hangup
      // call.on('destroy', ...)

    } catch (err: any) {
      console.error('[WebRTC] Make call error:', err)
      setError(err?.message)
      setCallState('idle')
    }
  }, [status])

  const hangUp = useCallback(async () => {
    if (activeCallRef.current) {
      await activeCallRef.current.hangup()
      setCallState('idle')
      setCurrentCall(null)
    }
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
