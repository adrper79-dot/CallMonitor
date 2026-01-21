"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'

/**
 * WebRTC Hook (SIP.js Implementation)
 * 
 * Architecture: Per ARCH_DOCS - SignalWire-first execution via SIP over WebSockets
 * 
 * Flow:
 * 1. Get SIP credentials from /api/webrtc/session
 * 2. Connect to SignalWire via wss:// using sip.js
 * 3. Register SIP user agent
 * 4. Send SIP INVITE to dial PSTN numbers
 */

export type WebRTCStatus =
  | 'disconnected'
  | 'initializing'
  | 'connecting'
  | 'registered'
  | 'on_call'
  | 'error'

export type CallState =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'active'
  | 'ending'

export interface CurrentCall {
  id: string
  phone_number: string
  started_at: Date
  duration: number
}

// Legacy type exports for compatibility
export interface WebRTCSession {
  id: string
}

export interface CallQuality {
  packet_loss_percent?: number
  audio_bitrate?: number
  jitter_ms?: number
  round_trip_time_ms?: number
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

  quality: CallQuality | null  // Added back for compatibility
  sessionId: string | null
}

export function useWebRTC(organizationId: string | null): UseWebRTCResult {
  const [status, setStatus] = useState<WebRTCStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [quality, setQuality] = useState<CallQuality | null>(null)  // Added for compatibility

  // SIP.js refs
  const userAgentRef = useRef<any>(null)
  const registererRef = useRef<any>(null)
  const sessionRef = useRef<any>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Create audio element on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.id = 'remote-audio'
      document.body.appendChild(audio)
      remoteAudioRef.current = audio
    }
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.remove()
      }
    }
  }, [])

  // Duration timer
  useEffect(() => {
    if (callState === 'active' && currentCall) {
      durationIntervalRef.current = setInterval(() => {
        setCurrentCall((prev) =>
          prev ? { ...prev, duration: Math.floor((Date.now() - prev.started_at.getTime()) / 1000) } : null
        )
      }, 1000)
    } else {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    }
  }, [callState, currentCall?.id])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (sessionRef.current) {
        try { sessionRef.current.bye() } catch (e) { /* ignore */ }
      }
      if (registererRef.current) {
        try { registererRef.current.unregister() } catch (e) { /* ignore */ }
      }
      if (userAgentRef.current) {
        try { userAgentRef.current.stop() } catch (e) { /* ignore */ }
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  /**
   * Connect to SignalWire via SIP.js
   */
  const connect = useCallback(async () => {
    if (!organizationId) {
      setError('Organization ID required')
      return
    }
    if (status === 'registered' || status === 'connecting') return

    try {
      setStatus('initializing')
      setError(null)

      // 1. Get SIP credentials from session endpoint
      console.log('[SIP.js] Fetching SIP credentials...')
      const sessionRes = await apiPost<{
        success: boolean
        session: {
          id: string
          sip_username: string
          sip_password: string
          sip_domain: string
          websocket_url: string
          ice_servers: any[]
        }
      }>('/api/webrtc/session')

      if (!sessionRes.success || !sessionRes.session) {
        throw new Error('Failed to get SIP session')
      }

      const { id, sip_username, sip_password, sip_domain, websocket_url, ice_servers } = sessionRes.session
      setSessionId(id)

      console.log('[SIP.js] Got credentials, importing library...')
      setStatus('connecting')

      // 2. Dynamic import of sip.js
      const SIP = await import('sip.js')
      const { UserAgent, Registerer } = SIP

      // 3. Request microphone access
      console.log('[SIP.js] Requesting microphone access...')
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = localStream

      // 4. Create SIP URI
      const sipUri = `sip:${sip_username}@${sip_domain}`
      console.log('[SIP.js] Connecting as:', sipUri)

      // 5. Create UserAgent
      const userAgent = new UserAgent({
        uri: UserAgent.makeURI(sipUri)!,
        transportOptions: {
          server: websocket_url
        },
        authorizationUsername: sip_username,
        authorizationPassword: sip_password,
        sessionDescriptionHandlerFactoryOptions: {
          peerConnectionConfiguration: {
            iceServers: ice_servers
          }
        },
        logLevel: 'warn',
        delegate: {
          onInvite: (invitation: any) => {
            console.log('[SIP.js] Incoming call - auto-rejecting (outbound only)')
            invitation.reject()
          }
        }
      })

      userAgentRef.current = userAgent

      // 6. Start UserAgent
      await userAgent.start()
      console.log('[SIP.js] UserAgent started')

      // 7. Register
      const registerer = new Registerer(userAgent)
      registererRef.current = registerer

      registerer.stateChange.addListener((state: any) => {
        console.log('[SIP.js] Registerer state:', state)
        if (state === 'Registered') {
          setStatus('registered')
        } else if (state === 'Unregistered') {
          setStatus('disconnected')
        }
      })

      await registerer.register()
      console.log('[SIP.js] Registration sent')

    } catch (err: any) {
      console.error('[SIP.js] Connect Error', err)
      setError(err.message || 'Connection failed')
      setStatus('error')
    }
  }, [organizationId, status])

  /**
   * Disconnect from SIP server
   */
  const disconnect = useCallback(async () => {
    try {
      if (sessionRef.current) {
        try { sessionRef.current.bye() } catch (e) { /* ignore */ }
        sessionRef.current = null
      }
      if (registererRef.current) {
        await registererRef.current.unregister()
        registererRef.current = null
      }
      if (userAgentRef.current) {
        await userAgentRef.current.stop()
        userAgentRef.current = null
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop())
        localStreamRef.current = null
      }

      // Notify server
      await apiDelete('/api/webrtc/session').catch(() => { /* ignore */ })

      setStatus('disconnected')
      setCallState('idle')
      setCurrentCall(null)
    } catch (err) {
      console.error('[SIP.js] Disconnect error', err)
      setStatus('disconnected')
    }
  }, [])

  /**
   * Make outbound call via SIP INVITE
   */
  const makeCall = useCallback(async (phoneNumber: string) => {
    if (status !== 'registered') {
      setError('Not registered with SIP server')
      return
    }
    if (!userAgentRef.current) {
      setError('UserAgent not initialized')
      return
    }

    try {
      setCallState('dialing')
      setError(null)

      const SIP = await import('sip.js')
      const { Inviter } = SIP

      // Format phone number for SIP URI
      // SignalWire expects: sip:+1XXXXXXXXXX@domain
      const cleanNumber = phoneNumber.replace(/\D/g, '')
      const formattedNumber = cleanNumber.startsWith('1') ? `+${cleanNumber}` : `+1${cleanNumber}`

      // Get domain from session
      const sessionRes = await apiPost<{ success: boolean; session: any }>('/api/webrtc/session')
      const domain = sessionRes.session?.sip_domain || 'sip.signalwire.com'

      const targetUri = SIP.UserAgent.makeURI(`sip:${formattedNumber}@${domain}`)
      if (!targetUri) {
        throw new Error('Invalid phone number')
      }

      console.log('[SIP.js] Dialing:', targetUri.toString())

      // Create INVITE
      const inviter = new Inviter(userAgentRef.current, targetUri, {
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false }
        }
      })

      sessionRef.current = inviter

      // Handle session state changes
      inviter.stateChange.addListener((state: any) => {
        console.log('[SIP.js] Call state:', state)
        switch (state) {
          case 'Establishing':
            setCallState('ringing')
            break
          case 'Established':
            setCallState('active')
            setCurrentCall({
              id: inviter.id,
              phone_number: phoneNumber,
              started_at: new Date(),
              duration: 0
            })
            setStatus('on_call')
            break
          case 'Terminated':
            setCallState('idle')
            setCurrentCall(null)
            setStatus('registered')
            sessionRef.current = null
            break
        }
      })

      // Handle remote audio - use delegate pattern for sip.js
      const setupRemoteAudio = () => {
        const sessionDescHandler = inviter.sessionDescriptionHandler as any
        if (sessionDescHandler?.peerConnection) {
          sessionDescHandler.peerConnection.addEventListener('track', (event: RTCTrackEvent) => {
            if (event.track.kind === 'audio' && remoteAudioRef.current) {
              console.log('[SIP.js] Got remote audio track')
              const remoteStream = new MediaStream([event.track])
              remoteAudioRef.current.srcObject = remoteStream
              remoteAudioRef.current.play().catch(e => console.error('[SIP.js] Audio play error', e))
            }
          })
        }
      }

      // Setup audio after session is established
      inviter.stateChange.addListener((state: any) => {
        if (state === 'Established') {
          setupRemoteAudio()
        }
      })

      // Send INVITE
      await inviter.invite()

    } catch (err: any) {
      console.error('[SIP.js] Call error', err)
      setError(err.message || 'Call failed')
      setCallState('idle')
    }
  }, [status])

  /**
   * Hang up current call
   */
  const hangUp = useCallback(async () => {
    if (!sessionRef.current) return

    try {
      setCallState('ending')

      // Send BYE
      if (sessionRef.current.state === 'Established') {
        await sessionRef.current.bye()
      } else {
        // Cancel if still establishing
        await sessionRef.current.cancel()
      }

      sessionRef.current = null
      setCallState('idle')
      setCurrentCall(null)
      setStatus('registered')
    } catch (err: any) {
      console.error('[SIP.js] Hangup error', err)
      setCallState('idle')
      setCurrentCall(null)
      sessionRef.current = null
    }
  }, [])

  /**
   * Mute microphone
   */
  const mute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false
      })
      setIsMuted(true)
    }
  }, [])

  /**
   * Unmute microphone
   */
  const unmute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = true
      })
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
