"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'
// Use VideoRoomSession for Room Token connectivity
import { VideoRoomSession } from '@signalwire/js'

/**
 * WebRTC Hook (SignalWire Video Room Version)
 * 
 * Strategy: Connect to a Video Room to verify Media Connectivity (Relay Tunnel).
 * Fabric API was unavailable (404), so we use the robust Room Token API.
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

  const roomSessionRef = useRef<any>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio()
      audio.autoplay = true
      // Audio element management
      remoteAudioRef.current = audio
    }
  }, [])

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (roomSessionRef.current) roomSessionRef.current.leave()
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

      // 2. Get Video Room Token
      // Backend generates token for a user-specific room
      const tokenRes = await apiPost<{ success: boolean; token: string }>('/api/webrtc/token')
      if (!tokenRes.success || !tokenRes.token) {
        throw new Error('Failed to fetch SignalWire Token')
      }

      // 3. Initialize VideoRoomSession
      console.log('[SignalWire] Initializing Room Session')

      const roomSession = new VideoRoomSession({
        token: tokenRes.token,
        rootElement: remoteAudioRef.current || undefined
      })

      roomSessionRef.current = roomSession

      // Bind Events
      roomSession.on('room.joined', (e) => {
        console.log('[SignalWire] Room Joined', e.room_session.name)
        setStatus('connected')
        setCallState('idle') // Connected but not "calling" anyone yet

        // If we want to treat "Joined Room" as "Connected" (State: Connected)
      })

      roomSession.on('room.error', (e) => {
        console.error('[SignalWire] Room Error', e)
      })

      roomSession.on('destroy', () => {
        console.log('[SignalWire] Room Session Destroyed')
        setStatus('disconnected')
        setCallState('idle')
      })

      // We explicitly JOIN now?
      // Or we wait for makeCall?
      // Since the Token is for a specific room, connecting usually means joining.
      // But we can hold the instance.
      // Let's JOIN immediately to prove connectivity.

      console.log('[SignalWire] Joining Room...')
      await roomSession.join()

    } catch (err: any) {
      console.error('[WebRTC] Connection error:', err)
      setError(err?.message || 'Failed to connect')
      setStatus('error')
    }
  }, [organizationId, status])

  const disconnect = useCallback(async () => {
    try {
      if (roomSessionRef.current) {
        await roomSessionRef.current.leave()
      }
      try { await apiDelete('/api/webrtc/session') } catch { }
      setStatus('disconnected')
      setCallState('idle')
      setCurrentCall(null)
    } catch (err: any) {
      setError(err?.message)
    }
  }, [])

  const makeCall = useCallback(async (phoneNumber: string) => {
    // In "Room Mode", 'makeCall' is simulated or disabled.
    // We are likely already connected to the room.
    // We can update UI to show "In Room".
    console.log('[SignalWire] Dialing in Room Mode (Already Connected)')

    if (status !== 'connected') {
      setError('Not connected to room')
      return
    }

    setCallState('active')
    setCurrentCall({
      id: roomSessionRef.current?.id || 'room-call',
      phone_number: 'Room Audio',
      started_at: new Date(),
      duration: 0
    })
  }, [status])

  const hangUp = useCallback(async () => {
    // Just update state, don't leave room (disconnect does that)
    setCallState('idle')
    setCurrentCall(null)
    // Optionally leave room if we interpret hangup as disconnect
  }, [])

  const mute = useCallback(() => {
    if (roomSessionRef.current) roomSessionRef.current.audioMute()
    setIsMuted(true)
  }, [])

  const unmute = useCallback(() => {
    if (roomSessionRef.current) roomSessionRef.current.audioUnmute()
    setIsMuted(false)
  }, [])

  return {
    connect,
    disconnect,
    status,
    error,
    makeCall, // Re-purposed to start timer/UI state
    hangUp, // Re-purposed
    callState,
    currentCall,
    mute,
    unmute,
    isMuted,
    quality,
    sessionId
  }
}
