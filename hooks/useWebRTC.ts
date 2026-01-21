"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'
import { Video } from '@signalwire/js'

/**
 * WebRTC Hook (SignalWire SDK Version)
 * 
 * Manages browser-based calling via SignalWire Unified SDK (v3).
 * Replaces legacy SIP.js implementation to solve traversal issues.
 * 
 * Features:
 * - Authenticates via JWT (from /api/webrtc/token)
 * - Uses SignalWire Relay for connectivity (Bypassing UDP blocks)
 * - Handles Outbound Calls
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
  // State
  const [status, setStatus] = useState<WebRTCStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [quality, setQuality] = useState<CallQuality | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Refs
  const clientRef = useRef<any>(null) // SignalWire Client
  const activeCallRef = useRef<any>(null) // SignalWire Call Object
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio()
      audio.autoplay = true
      remoteAudioRef.current = audio
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (activeCallRef.current) activeCallRef.current.hangup()
      if (clientRef.current) clientRef.current.disconnect()
    }
  }, [])

  // Duration timer
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

  // CONNECT
  const connect = useCallback(async () => {
    if (!organizationId) {
      setError('Organization ID required')
      return
    }

    if (status === 'connected' || status === 'connecting') return

    try {
      setStatus('initializing')
      setError(null)

      // 1. Get Session ID (for Audit Log)
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
      console.log('[SignalWire] Initializing Client with Token')

      // Use named export Video.Client
      // Note: In @signalwire/js v3, Video.Client is the correct constructor for browser-based WebRTC
      const client = new Video.Client({
        token: tokenRes.token,
        // rootElement: remoteAudioRef.current // Optional binding
      })

      // Event Listeners
      client.on('signalwire.error', (err: any) => {
        console.error('[SignalWire] Error:', err)
        setError(err?.message)
      })

      client.on('signalwire.ready', () => {
        console.log('[SignalWire] Client Ready')
        setStatus('connected')
      })

      client.on('signalwire.notification', (notification: any) => {
        // console.log('[SignalWire] Notification:', notification)
      })

      await client.connect()
      clientRef.current = client

    } catch (err: any) {
      console.error('[WebRTC] Connection error:', err)
      setError(err?.message || 'Failed to connect')
      setStatus('error')
    }
  }, [organizationId, status])

  // DISCONNECT
  const disconnect = useCallback(async () => {
    try {
      if (activeCallRef.current) {
        await activeCallRef.current.hangup()
      }
      if (clientRef.current) {
        clientRef.current.disconnect()
      }
      try { await apiDelete('/api/webrtc/session') } catch { }

      setStatus('disconnected')
      setCallState('idle')
      setCurrentCall(null)
    } catch (err: any) {
      setError(err?.message)
    }
  }, [])

  // MAKE CALL
  const makeCall = useCallback(async (phoneNumber: string) => {
    if (!clientRef.current || status !== 'connected') {
      setError('Not connected')
      return
    }

    try {
      setCallState('dialing')

      const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '')

      // Dial
      const call = await clientRef.current.dial({
        to: cleanNumber,
        audio: true,
        video: false
      })

      activeCallRef.current = call

      // Bind Events
      call.on('room.joined', () => {
        setCallState('active')
        setCurrentCall({
          id: call.id,
          phone_number: phoneNumber,
          started_at: new Date(),
          duration: 0
        })

        if (call.remoteStream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = call.remoteStream
          remoteAudioRef.current.play().catch(e => console.error('Audio play error', e))
        }
      })

      call.on('room.ended', () => {
        setCallState('idle')
        setCurrentCall(null)
        activeCallRef.current = null
      })

      console.log('[SignalWire] Call initiated', call.id)

    } catch (err: any) {
      console.error('[WebRTC] Make call error:', err)
      setError(err?.message)
      setCallState('idle')
    }
  }, [status])

  // HANG UP
  const hangUp = useCallback(async () => {
    if (activeCallRef.current) {
      await activeCallRef.current.hangup()
      setCallState('idle')
      setCurrentCall(null)
    }
  }, [])

  // MUTE/UNMUTE
  const mute = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.audioMute()
      setIsMuted(true)
    }
  }, [])

  const unmute = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.audioUnmute()
      setIsMuted(false)
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
    sessionId
  }
}
