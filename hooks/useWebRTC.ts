"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'
import { Inviter, UserAgent, Registerer, SessionState, Session } from 'sip.js'

/**
 * WebRTC Hook (SIP.js Version)
 * 
 * Manages browser-based calling via SIP over WebSockets.
 * Replaces legacy @signalwire/js implementation.
 * 
 * Architecture:
 * - Registers as SIP endpoint (e.g., sip:web-rtc01@domain)
 * - Uses standard SIP INVITE for outbound calls (Browser -> PSTN)
 * - Handles incoming calls via SIP registration
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
  sip_username: string
  sip_password?: string
  sip_domain: string
  websocket_url: string
  ice_servers: Array<{ urls: string; username?: string; credential?: string }>
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
  const userAgentRef = useRef<UserAgent | null>(null)
  const registererRef = useRef<Registerer | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio()
      audio.autoplay = true
      // iOS/Safari Helper: unlock audio context on touch? 
      // SIP.js usually handles this if we prompt getUserMedia first
      remoteAudioRef.current = audio
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (sessionRef.current?.state === SessionState.Established) {
        sessionRef.current.bye()
      }
      if (userAgentRef.current) {
        userAgentRef.current.stop()
      }
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

      // 1. Get Session Config from Backend
      const response = await apiPost<{ success: boolean; session: WebRTCSession; error?: any }>(
        '/api/webrtc/session'
      )

      if (!response.success || !response.session) {
        throw new Error(response.error?.message || 'Failed to create WebRTC session')
      }

      const { session } = response
      setSessionId(session.id)

      // 2. Initialize SIP UserAgent
      const { sip_username, sip_password, sip_domain, websocket_url, ice_servers } = session

      if (!sip_password) {
        throw new Error('SIP credentials missing password from server')
      }

      const uri = UserAgent.makeURI(`sip:${sip_username}@${sip_domain}`)
      if (!uri) throw new Error('Invalid SIP URI')

      const userAgent = new UserAgent({
        uri,
        transportOptions: {
          server: websocket_url
        },
        authorizationUsername: sip_username,
        authorizationPassword: sip_password,
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionOptions: {
            iceServers: ice_servers
          }
        }
      })

      userAgentRef.current = userAgent

      // 3. Setup Event Listeners
      userAgent.delegate = {
        onConnect: () => {
          setStatus('connected')
          console.log('[WebRTC] Connected to WebSocket')
        },
        onDisconnect: (error) => {
          setStatus('disconnected')
          console.log('[WebRTC] Disconnected', error)
          if (error) setError(`Disconnected: ${error.message}`)
        },
        onInvite: (invitation) => {
          console.log('[WebRTC] Incoming Invite')
          // Auto-answer logic could go here
        }
      }

      await userAgent.start()

      // 4. Register
      const registerer = new Registerer(userAgent)
      registererRef.current = registerer
      await registerer.register()
      console.log('[WebRTC] Registered')

    } catch (err: any) {
      console.error('[WebRTC] Connection error:', err)
      setError(err?.message || 'Failed to connect')
      setStatus('error')
    }
  }, [organizationId, status])

  // DISCONNECT
  const disconnect = useCallback(async () => {
    try {
      if (sessionRef.current && sessionRef.current.state === SessionState.Established) {
        await sessionRef.current.bye()
      }
      if (registererRef.current) {
        await registererRef.current.unregister()
      }
      if (userAgentRef.current) {
        await userAgentRef.current.stop()
      }
      // Cleanup backend session
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
    if (!userAgentRef.current || status !== 'connected') {
      setError('Not connected')
      return
    }

    try {
      setCallState('dialing')

      // Clean number
      const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '')
      const target = UserAgent.makeURI(`sip:${cleanNumber}@${userAgentRef.current.configuration.uri?.host}`)
      if (!target) throw new Error('Invalid target URI')

      const inviter = new Inviter(userAgentRef.current, target)
      sessionRef.current = inviter

      // Setup Session Events
      inviter.stateChange.addListener((newState) => {
        console.log('[WebRTC] Session state:', newState)
        switch (newState) {
          case SessionState.Establishing:
            setCallState('ringing')
            if (remoteAudioRef.current && inviter.sessionDescriptionHandler) {
              const sdh = inviter.sessionDescriptionHandler as any
              const remoteStream = new MediaStream()
              if (sdh.peerConnection) {
                sdh.peerConnection.oniceconnectionstatechange = () => {
                  console.log('[WebRTC] ICE State:', sdh.peerConnection.iceConnectionState)
                }
                sdh.peerConnection.getReceivers().forEach((receiver: any) => {
                  if (receiver.track) {
                    remoteStream.addTrack(receiver.track)
                  }
                })
              }
              remoteAudioRef.current.srcObject = remoteStream
              remoteAudioRef.current.play().catch(e => console.error('Audio play error (early)', e))
            }
            break
          case SessionState.Established:
            setCallState('active')
            setCurrentCall({
              id: inviter.id,
              phone_number: phoneNumber,
              started_at: new Date(),
              duration: 0
            })

            // Audio Handling (Confirmed)
            if (remoteAudioRef.current) {
              const remoteStream = new MediaStream()
              const sdh = inviter.sessionDescriptionHandler as any
              if (sdh && sdh.peerConnection) {
                sdh.peerConnection.getReceivers().forEach((receiver: any) => {
                  if (receiver.track) {
                    remoteStream.addTrack(receiver.track)
                  }
                })
              }
              remoteAudioRef.current.srcObject = remoteStream
              remoteAudioRef.current.play().catch(e => console.error('Audio play error', e))
            }
            break
          case SessionState.Terminated:
            setCallState('idle')
            setCurrentCall(null)
            sessionRef.current = null
            break
        }
      })

      // Send Invite with Explicit Audio Constraints
      await inviter.invite({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false }
        }
      })

    } catch (err: any) {
      console.error('[WebRTC] Make call error:', err)
      setError(err?.message)
      setCallState('idle')
    }
  }, [status])

  // HANG UP
  const hangUp = useCallback(async () => {
    if (sessionRef.current) {
      switch (sessionRef.current.state) {
        case SessionState.Initial:
        case SessionState.Establishing:
          if (sessionRef.current instanceof Inviter) {
            await sessionRef.current.cancel()
          } else {
            const invitation = sessionRef.current as any
            if (typeof invitation.reject === 'function') {
              await invitation.reject()
            }
          }
          break
        case SessionState.Established:
          await sessionRef.current.bye()
          break
      }
      setCallState('idle')
      setCurrentCall(null)
    }
  }, [])

  // MUTE/UNMUTE
  const mute = useCallback(() => {
    setIsMuted(true)
    // TODO: implement logic
  }, [])

  const unmute = useCallback(() => {
    setIsMuted(false)
    // TODO: implement logic
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
