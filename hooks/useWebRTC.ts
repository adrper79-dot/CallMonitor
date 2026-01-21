"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'
// Removed static import to avoid build errors. Using dynamic import.

/**
 * WebRTC Hook (SignalWire Video Room Version)
 * 
 * Strategy: Connect to a Video Room to verify Media Connectivity (Relay Tunnel).
 * Implementation: Uses Dynamic Import to load SDK and find RoomSession class.
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

  const roomSessionRef = useRef<any>(null)
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
      if (roomSessionRef.current) roomSessionRef.current.leave()
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

      // 2. Get Video Room Token
      const tokenRes = await apiPost<{ success: boolean; token: string }>('/api/webrtc/token')
      if (!tokenRes.success || !tokenRes.token) {
        throw new Error('Failed to fetch SignalWire Token')
      }

      // 3. Dynamic Import of SDK
      console.log('[SignalWire] Dynamically Importing SDK...')

      // @ts-ignore
      const module = await import('@signalwire/js')
      console.log('[SignalWire] Module Loaded:', module)

      // Resolve RoomSession Class
      // Try multiple locations: Named export, Video namespace, etc.
      const RoomSession = module.VideoRoomSession || (module.Video && module.Video.RoomSession) || module.RoomSession

      if (!RoomSession) {
        console.error('[SignalWire] Exports:', Object.keys(module))
        throw new Error('Could not find RoomSession class in SDK')
      }

      console.log('[SignalWire] Found RoomSession Class')

      // Instantiate
      const roomSession = new RoomSession({
        token: tokenRes.token,
        rootElement: remoteAudioRef.current || undefined
      })

      roomSessionRef.current = roomSession

      // Bind Events
      roomSession.on('room.joined', (e: any) => {
        console.log('[SignalWire] Room Joined', e.room_session.name)
        setStatus('connected')
        setCallState('idle')
      })

      roomSession.on('room.error', (e: any) => {
        console.error('[SignalWire] Room Error', e)
        setError(e?.message || 'Room Error')
      })

      roomSession.on('destroy', () => {
        console.log('[SignalWire] Room Session Destroyed')
        setStatus('disconnected')
        setCallState('idle')
      })

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
    setCallState('idle')
    setCurrentCall(null)
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
