"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'

/**
 * WebRTC Hook (Server-Side Dialing Version)
 * 
 * Strategy:
 * 1. Connect to Video Room (`room-{userId}`) via Dynamic Import SDK.
 * 2. 'makeCall' sends request to Server.
 * 3. Server Dials PSTN and bridges to Room.
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
  const [roomName, setRoomName] = useState<string | null>(null)

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
    if (callState === 'active' && currentCall) {
      // Timer logic
      durationIntervalRef.current = setInterval(() => {
        setCurrentCall((prev: any) => prev ? { ...prev, duration: Math.floor((Date.now() - prev.started_at.getTime()) / 1000) } : null)
      }, 1000)
    } else {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    }
    return () => { if (durationIntervalRef.current) clearInterval(durationIntervalRef.current) }
  }, [callState, currentCall?.id])

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (roomSessionRef.current) roomSessionRef.current.leave?.()
    }
  }, [])

  const connect = useCallback(async () => {
    if (!organizationId) {
      setError('Organization ID required')
      return
    }
    if (status === 'connected' || status === 'connecting') return

    try {
      setStatus('initializing')
      setError(null)

      // 1. Token
      const tokenRes = await apiPost<{ success: boolean; token: string, room_name: string }>('/api/webrtc/token')
      if (!tokenRes.success) throw new Error('Token failed')
      setRoomName(tokenRes.room_name)

      // 2. Dynamic Import (Video sdk)
      console.log('[SignalWire] Importing SDK...')
      // @ts-ignore
      const module = await import('@signalwire/js')

      // Find RoomSession or Video.RoomSession
      const RoomSession = module.VideoRoomSession || (module.Video && module.Video.RoomSession) || module.RoomSession

      if (!RoomSession) {
        throw new Error('RoomSession class not found in SDK')
      }

      console.log('[SignalWire] Initializing RoomSession')

      const roomSession = new RoomSession({
        token: tokenRes.token,
        rootElement: remoteAudioRef.current || undefined
      })

      roomSessionRef.current = roomSession

      roomSession.on('room.joined', (e: any) => {
        console.log('[SignalWire] Room Joined:', e.room.name)
        setStatus('connected')
        // We are now "Ready" to make calls (which will be proxied by server)
      })

      roomSession.on('room.error', (e: any) => {
        console.error('Room error', e)
        setError(e.message)
      })

      // Audio handling often automatic with rootElement or track event
      roomSession.on('track', (e: any) => {
        if (e.track.kind === 'audio' && remoteAudioRef.current) {
          // ...
        }
      })

      await roomSession.join()

    } catch (err: any) {
      console.error('[WebRTC] Connect Error', err)
      setError(err.message)
      setStatus('error')
    }
  }, [organizationId, status])

  const disconnect = useCallback(async () => {
    if (roomSessionRef.current) roomSessionRef.current.leave()
    setStatus('disconnected')
  }, [])

  // MAKE CALL - SERVER SIDE DIAL
  const makeCall = useCallback(async (phoneNumber: string) => {
    if (status !== 'connected') {
      setError('Not connected to SignalWire Room')
      return
    }

    try {
      setCallState('dialing')
      console.log('[SignalWire] Requesting Server Dial:', phoneNumber)

      const res = await apiPost('/api/webrtc/dial', {
        phoneNumber,
        roomName // Pass room name so server knows where to connect
      })

      if (res.success) {
        setCallState('active') // Optimistic - Server should really confirm
        setCurrentCall({
          id: 'server-call',
          phone_number: phoneNumber,
          started_at: new Date(),
          duration: 0
        })
      } else {
        throw new Error('Server Failed to Dial')
      }
    } catch (e: any) {
      console.error(e)
      setCallState('idle')
      setError(e.message)
    }
  }, [status, roomName])

  const hangUp = useCallback(async () => {
    // Logic to hangup via Server?
    setCallState('idle')
    setCurrentCall(null)
  }, [])

  const mute = useCallback(() => { if (roomSessionRef.current) roomSessionRef.current.audioMute() }, [])
  const unmute = useCallback(() => { if (roomSessionRef.current) roomSessionRef.current.audioUnmute() }, [])

  return {
    connect, disconnect, status, error, makeCall, hangUp, callState, currentCall, mute, unmute, isMuted, quality, sessionId
  }
}
