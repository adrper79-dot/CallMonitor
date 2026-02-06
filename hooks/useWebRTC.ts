"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/apiClient'

/**
 * WebRTC Hook (Telnyx WebRTC Implementation)
 *
 * Architecture: Browser-based calling using Telnyx WebRTC SDK
 *
 * Flow:
 * 1. Get WebRTC credentials from /api/webrtc/token
 * 2. Initialize Telnyx WebRTC client
 * 3. Use /api/webrtc/dial to initiate outbound calls
 * 4. Handle incoming calls via WebRTC connection
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
  const [quality, setQuality] = useState<CallQuality | null>(null)
  const [callerId, setCallerId] = useState<string | null>(null)

  // Telnyx WebRTC refs
  const telnyxClientRef = useRef<any>(null)
  const currentCallRef = useRef<any>(null)  // Store active call object for mute/hangup
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Create audio element on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if audio element already exists
      let audio = document.getElementById('remote-audio') as HTMLAudioElement
      if (!audio) {
        audio = document.createElement('audio')
        audio.id = 'remote-audio'
        document.body.appendChild(audio)
      }
      // Configure for reliable playback
      audio.autoplay = true
      audio.muted = false  // Explicitly unmuted
      audio.volume = 1.0   // Full volume
      audio.setAttribute('playsinline', '')
      remoteAudioRef.current = audio
      console.log('[Telnyx] Audio element created/configured:', audio.id)
    }
    return () => {
      // Don't remove on cleanup - might cause issues with React strict mode
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
      if (telnyxClientRef.current) {
        try { telnyxClientRef.current.disconnect() } catch (e) { /* ignore */ }
        telnyxClientRef.current = null
      }
    }
  }, [])

  // Enumerate audio devices on mount and log them
  useEffect(() => {
    async function listAudioDevices() {
      try {
        // Need to request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true })
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(d => d.kind === 'audioinput')
        console.log('[Telnyx] === AVAILABLE AUDIO INPUT DEVICES ===')
        audioInputs.forEach((device, i) => {
          console.log(`[Telnyx] Device ${i}: "${device.label}" (${device.deviceId.substring(0, 8)}...)`)
        })
        console.log('[Telnyx] Default device will be the first one unless specified')
      } catch (e) {
        console.error('[Telnyx] Error enumerating devices:', e)
      }
    }
    listAudioDevices()
  }, [])

  /**
   * Connect to Telnyx WebRTC
   */
  const connect = useCallback(async () => {
    if (status === 'registered' || status === 'connecting') return

    await performConnect()
  }, [status])

  /**
   * Internal connection logic
   */
  const performConnect = useCallback(async () => {
    if (status === 'registered' || status === 'connecting') return

    try {
      setStatus('initializing')
      setError(null)

      console.log('[Telnyx] Fetching WebRTC credentials...')

      // 1. Get WebRTC credentials from server
      const tokenRes = await apiGet<{
        success: boolean
        token: string
        username: string
        credential_id?: string
        caller_id?: string
        expires: string
        error?: string
        hint?: string
        rtcConfig: {
          iceServers: any[]
        }
      }>('/api/webrtc/token')

      if (!tokenRes.success) {
        const errorMsg = tokenRes.error || 'Failed to get WebRTC token'
        console.error('[Telnyx] Token error:', errorMsg, tokenRes.hint)
        throw new Error(tokenRes.hint ? `${errorMsg} - ${tokenRes.hint}` : errorMsg)
      }

      if (!tokenRes.token) {
        throw new Error('No token in response')
      }

      console.log('[Telnyx] Credential obtained:', tokenRes.credential_id)
      console.log('[Telnyx] Caller ID:', tokenRes.caller_id)
      
      // Store caller ID for outbound calls
      if (tokenRes.caller_id) {
        setCallerId(tokenRes.caller_id)
      }

      console.log('[Telnyx] Got credentials, initializing client...')
      setStatus('connecting')

      // 2. Dynamic import of Telnyx WebRTC SDK
      const { TelnyxRTC } = await import('@telnyx/webrtc')

      // 3. Create Telnyx WebRTC client
      // When using login_token (JWT), do NOT pass login/password - the JWT contains all credentials
      console.log('[Telnyx] Creating client with token:', tokenRes.token.substring(0, 50) + '...')
      console.log('[Telnyx] Token length:', tokenRes.token.length, 'chars')
      
      const client = new TelnyxRTC({
        login_token: tokenRes.token,
        // Do NOT include login/password when using JWT token
        ringtoneFile: undefined, // Disable default ringtone
        ringbackFile: undefined, // Disable default ringback
      })

      telnyxClientRef.current = client
      setSessionId(tokenRes.username)

      // 4. Setup event handlers - try ALL possible event formats for debugging
      // Telnyx SDK uses both 'event' and 'telnyx.event' formats
      const socketEvents = ['socket.open', 'telnyx.socket.open', 'socketOpen']
      socketEvents.forEach(evt => {
        client.on(evt, () => console.log(`[Telnyx] Event: ${evt}`))
      })
      
      client.on('socket.close', (data: any) => {
        console.log('[Telnyx] WebSocket closed:', data)
      })
      
      client.on('socket.error', (error: any) => {
        console.error('[Telnyx] WebSocket error:', error)
      })
      
      client.on('socket.message', (message: any) => {
        console.log('[Telnyx] WebSocket message:', message?.method || message)
      })
      
      // Try both event name formats
      client.on('telnyx.ready', () => {
        console.log('[Telnyx] telnyx.ready event')
        setStatus('registered')
      })
      
      client.on('ready', () => {
        console.log('[Telnyx] ready event')
        setStatus('registered')
      })
      
      // Notification events - handle call updates through notifications
      client.on('telnyx.notification', (notification: any) => {
        console.log('[Telnyx] Notification:', notification?.type, notification)
        
        // Handle callUpdate notifications
        if (notification?.type === 'callUpdate' && notification?.call) {
          const call = notification.call
          const state = call.state
          console.log('[Telnyx] Call state from notification:', state, 'direction:', call.direction)
          
          switch (state) {
            case 'new':
            case 'trying':
            case 'requesting':
              setCallState('dialing')
              currentCallRef.current = call  // Store call reference
              // Debug local audio
              debugLocalAudio(call)
              break
            case 'ringing':
            case 'early':
              setCallState('ringing')
              // Try to get early media (ringback tone)
              attachRemoteAudio(call)
              break
            case 'active':
            case 'answering':
              setCallState('active')
              setStatus('on_call')
              setCurrentCall({
                id: call.id || String(Date.now()),
                phone_number: call.options?.destinationNumber || call.options?.remoteCallerNumber || 'Unknown',
                started_at: new Date(),
                duration: 0
              })
              // Attach the remote audio stream when call becomes active
              attachRemoteAudio(call)
              // Ensure microphone is unmuted
              ensureLocalAudioEnabled(call)
              break
            case 'hangup':
            case 'destroy':
            case 'purge':
              setCallState('idle')
              setCurrentCall(null)
              setStatus('registered')
              currentCallRef.current = null  // Clear call reference
              // Stop audio
              if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = null
              }
              break
          }
        }
      })
      
      // Helper function to attach remote audio from call object
      function attachRemoteAudio(call: any) {
        try {
          // Try multiple ways to get the remote stream
          let remoteStream = call.remoteStream || call.peer?.remoteStream || call._remoteStream
          
          // Also try getting from RTCPeerConnection directly
          if (!remoteStream && call.peer?.pc) {
            const pc = call.peer.pc as RTCPeerConnection
            const receivers = pc.getReceivers()
            console.log('[Telnyx] PC receivers:', receivers.length)
            
            const audioReceiver = receivers.find((r: RTCRtpReceiver) => r.track?.kind === 'audio')
            if (audioReceiver?.track) {
              remoteStream = new MediaStream([audioReceiver.track])
              console.log('[Telnyx] Created stream from receiver track')
            }
          }
          
          console.log('[Telnyx] Attempting to attach remote audio, stream:', remoteStream)
          
          if (remoteStream) {
            // Log stream details
            const audioTracks = remoteStream.getAudioTracks()
            console.log('[Telnyx] Audio tracks in stream:', audioTracks.length)
            audioTracks.forEach((track: MediaStreamTrack, i: number) => {
              console.log(`[Telnyx] Track ${i}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`)
              // Ensure track is enabled
              track.enabled = true
            })
            
            if (remoteAudioRef.current) {
              console.log('[Telnyx] Attaching remote stream to audio element')
              const audioEl = remoteAudioRef.current
              
              // Reset and configure
              audioEl.srcObject = remoteStream
              audioEl.muted = false
              audioEl.volume = 1.0
              
              // Try to play
              const playPromise = audioEl.play()
              if (playPromise) {
                playPromise.then(() => {
                  console.log('[Telnyx] Audio playback started successfully')
                  console.log('[Telnyx] Audio element state: paused=', audioEl.paused, 'volume=', audioEl.volume, 'muted=', audioEl.muted)
                }).catch((e: Error) => {
                  console.error('[Telnyx] Audio play error:', e.name, e.message)
                  // Try playing on user gesture
                  const resumeAudio = () => {
                    audioEl.play().catch(console.error)
                    document.removeEventListener('click', resumeAudio)
                  }
                  document.addEventListener('click', resumeAudio, { once: true })
                  console.log('[Telnyx] Added click listener to resume audio')
                })
              }
            }
          } else {
            console.log('[Telnyx] No remote stream available yet')
          }
        } catch (e) {
          console.error('[Telnyx] Error attaching remote audio:', e)
        }
      }
      
      // Debug local audio (microphone) stream
      function debugLocalAudio(call: any) {
        try {
          console.log('[Telnyx] === LOCAL AUDIO DEBUG ===')
          
          // Check call object for local stream
          const localStream = call.localStream || call.peer?.localStream || call._localStream
          console.log('[Telnyx] Local stream from call:', localStream)
          
          if (localStream) {
            const audioTracks = localStream.getAudioTracks()
            console.log('[Telnyx] Local audio tracks:', audioTracks.length)
            audioTracks.forEach((track: MediaStreamTrack, i: number) => {
              console.log(`[Telnyx] Local track ${i}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}, label=${track.label}`)
            })
          }
          
          // Check peer connection senders
          if (call.peer?.pc) {
            const pc = call.peer.pc as RTCPeerConnection
            const senders = pc.getSenders()
            console.log('[Telnyx] PC Senders:', senders.length)
            senders.forEach((sender: RTCRtpSender, i: number) => {
              if (sender.track) {
                console.log(`[Telnyx] Sender ${i}: kind=${sender.track.kind}, enabled=${sender.track.enabled}, muted=${sender.track.muted}, readyState=${sender.track.readyState}`)
              } else {
                console.log(`[Telnyx] Sender ${i}: no track`)
              }
            })
          }
          
          // Check if call has mute state
          console.log('[Telnyx] Call mute state:', {
            audioMuted: call.audioMuted,
            localAudioMuted: call.localAudioMuted,
            isMuted: call.isMuted,
          })
        } catch (e) {
          console.error('[Telnyx] Error debugging local audio:', e)
        }
      }
      
      // Ensure local audio is enabled and unmuted
      function ensureLocalAudioEnabled(call: any) {
        try {
          console.log('[Telnyx] === ENSURING LOCAL AUDIO ENABLED ===')
          
          // Try to unmute the call if it has mute methods
          if (call.unmuteAudio && typeof call.unmuteAudio === 'function') {
            console.log('[Telnyx] Calling call.unmuteAudio()')
            call.unmuteAudio()
          }
          if (call.unmute && typeof call.unmute === 'function') {
            console.log('[Telnyx] Calling call.unmute()')
            call.unmute()
          }
          
          // Directly enable local audio tracks
          const localStream = call.localStream || call.peer?.localStream || call._localStream
          if (localStream) {
            const audioTracks = localStream.getAudioTracks()
            audioTracks.forEach((track: MediaStreamTrack, i: number) => {
              if (!track.enabled) {
                console.log(`[Telnyx] Enabling local track ${i}`)
                track.enabled = true
              }
            })
          }
          
          // Also check peer connection senders
          if (call.peer?.pc) {
            const pc = call.peer.pc as RTCPeerConnection
            const senders = pc.getSenders()
            senders.forEach((sender: RTCRtpSender, i: number) => {
              if (sender.track && sender.track.kind === 'audio') {
                if (!sender.track.enabled) {
                  console.log(`[Telnyx] Enabling sender track ${i}`)
                  sender.track.enabled = true
                }
              }
            })
          }
          
          // Debug after enabling
          debugLocalAudio(call)
        } catch (e) {
          console.error('[Telnyx] Error ensuring local audio:', e)
        }
      }

      client.on('error', (error: any) => {
        console.error('[Telnyx] Client error:', error)
        setError(error.message || 'WebRTC error')
        setStatus('error')
      })

      // Handle token refresh requests from Telnyx SDK
      client.on('login', async () => {
        console.log('[Telnyx] Login event - refreshing token')
        try {
          // Fetch new token
          const tokenRes = await apiGet<{
            success: boolean
            token: string
            username: string
            expires: string
            rtcConfig: {
              iceServers: any[]
            }
          }>('/api/webrtc/token')

          if (tokenRes.success && tokenRes.token) {
            // Disconnect current client
            await client.disconnect()
            
            // Update client properties
            const clientAny: any = client
            clientAny.login_token = tokenRes.token
            clientAny.login = tokenRes.username
            clientAny.iceServers = tokenRes.rtcConfig.iceServers
            
            // Reconnect with new token
            await client.connect()
            console.log('[Telnyx] Reconnected with refreshed token')
          } else {
            throw new Error('Failed to refresh token')
          }
        } catch (err) {
          console.error('[Telnyx] Token refresh failed:', err)
          setError('Token refresh failed')
          setStatus('error')
        }
      })

      // Also listen for auth failures
      client.on('authFailed', async () => {
        console.log('[Telnyx] Auth failed - attempting full reconnect')
        try {
          // Disconnect completely
          await client.disconnect()
          setStatus('disconnected')
          
          // Wait a moment
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Reconnect with fresh credentials
          await performConnect()
        } catch (err) {
          console.error('[Telnyx] Reconnect failed:', err)
          setStatus('error')
        }
      })

      client.on('callUpdate', (call: any) => {
        console.log('[Telnyx] Call update:', call.state, call)

        switch (call.state) {
          case 'new':
          case 'trying':
            setCallState('dialing')
            break
          case 'ringing':
          case 'early':
            setCallState('ringing')
            break
          case 'active':
          case 'answering':
            setCallState('active')
            setStatus('on_call')
            // Set current call info
            setCurrentCall({
              id: call.id || String(Date.now()),
              phone_number: call.options?.destinationNumber || call.options?.remoteCallerNumber || 'Unknown',
              started_at: new Date(),
              duration: 0
            })
            break
          case 'hangup':
          case 'destroy':
            setCallState('idle')
            setCurrentCall(null)
            setStatus('registered')
            break
        }
      })

      // Media event handler - try multiple event names
      client.on('media', (media: any) => {
        console.log('[Telnyx] Media event received:', media)
        if (media?.stream && remoteAudioRef.current) {
          console.log('[Telnyx] Attaching media stream from event')
          remoteAudioRef.current.srcObject = media.stream
          remoteAudioRef.current.play().catch((e: Error) => console.error('[Telnyx] Audio play error', e))
        }
      })
      
      client.on('telnyx.media', (media: any) => {
        console.log('[Telnyx] telnyx.media event received:', media)
        if (media?.stream && remoteAudioRef.current) {
          console.log('[Telnyx] Attaching telnyx.media stream')
          remoteAudioRef.current.srcObject = media.stream
          remoteAudioRef.current.play().catch((e: Error) => console.error('[Telnyx] Audio play error', e))
        }
      })

      // Track events - some SDKs use track instead of media
      client.on('track', (track: any) => {
        console.log('[Telnyx] Track event received:', track)
      })

      // 5. Connect - wrap in try/catch for better error handling
      console.log('[Telnyx] About to call client.connect()...')
      try {
        const connectResult = await client.connect()
        console.log('[Telnyx] connect() returned:', connectResult)
      } catch (connectErr: any) {
        console.error('[Telnyx] connect() threw:', connectErr)
        throw connectErr
      }
      console.log('[Telnyx] Connection initiated, waiting for ready event...')
      
      // Log client state after connect
      console.log('[Telnyx] Client state after connect:', {
        connected: client.connected,
        // @ts-ignore - accessing internal state for debugging
        state: client._state,
        // @ts-ignore
        socket: client._socket ? 'exists' : 'null',
      })

    } catch (err: any) {
      console.error('[Telnyx] Connect Error', err)
      setError(err.message || 'Connection failed')
      setStatus('error')
    }
  }, [status])

  /**
   * Disconnect from Telnyx WebRTC
   */
  const disconnect = useCallback(async () => {
    try {
      if (telnyxClientRef.current) {
        await telnyxClientRef.current.disconnect()
        telnyxClientRef.current = null
      }

      setStatus('disconnected')
      setCallState('idle')
      setCurrentCall(null)
      setSessionId(null)
    } catch (err) {
      console.error('[Telnyx] Disconnect error', err)
      setStatus('disconnected')
    }
  }, [])

  /**
   * Make outbound call via TelnyxRTC client (WebRTC → PSTN)
   */
  const makeCall = useCallback(async (phoneNumber: string) => {
    if (status !== 'registered' || !telnyxClientRef.current) {
      setError('Not connected to WebRTC')
      return
    }

    try {
      setCallState('dialing')
      setError(null)

      console.log('[Telnyx] Initiating WebRTC call to:', phoneNumber, 'from:', callerId)
      
      // Find a real microphone (not virtual devices like Steam Streaming Microphone)
      let audioConstraint: boolean | MediaTrackConstraints = true
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(d => d.kind === 'audioinput')
        console.log('[Telnyx] Available audio devices for call:', audioInputs.map(d => d.label))
        
        // Try to find a real microphone - exclude virtual devices
        const virtualKeywords = ['steam', 'virtual', 'vb-audio', 'voicemeeter', 'cable']
        const realMic = audioInputs.find(d => {
          const label = d.label.toLowerCase()
          return !virtualKeywords.some(kw => label.includes(kw))
        })
        
        if (realMic && realMic.deviceId) {
          console.log('[Telnyx] Using real microphone:', realMic.label)
          audioConstraint = {
            deviceId: { exact: realMic.deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        } else {
          console.log('[Telnyx] No non-virtual mic found, using default with constraints')
          // Use audio constraints without specific device
          audioConstraint = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }
      } catch (e) {
        console.log('[Telnyx] Could not enumerate devices, using default audio')
      }

      // Use TelnyxRTC client directly to make the call
      // This creates a WebRTC call that bridges to PSTN via Telnyx
      const call = telnyxClientRef.current.newCall({
        destinationNumber: phoneNumber,
        callerNumber: callerId || '', // Use the caller ID from server
        callerName: 'VoxSouth', // Display name
        audio: audioConstraint,
        video: false,
      })

      console.log('[Telnyx] WebRTC call created:', call?.id || 'no id')

      // The call events will be handled by our callUpdate listener
      // No need to track here - the SDK manages the call lifecycle

    } catch (err: any) {
      console.error('[Telnyx] Call error', err)
      setError(err.message || 'Call failed')
      setCallState('idle')
    }
  }, [status, callerId])

  /**
   * Hang up current call
   */
  const hangUp = useCallback(async () => {
    if (!currentCallRef.current) {
      console.log('[Telnyx] No active call to hang up')
      return
    }

    try {
      setCallState('ending')

      // Hang up via call object (not client)
      const call = currentCallRef.current
      if (call.hangup) {
        call.hangup()
      } else if (call.disconnect) {
        call.disconnect()
      } else {
        console.error('[Telnyx] Call object has no hangup method:', Object.keys(call))
      }

      currentCallRef.current = null
      setCallState('idle')
      setCurrentCall(null)
      setStatus('registered')
    } catch (err) {
      console.error('[Telnyx] Hangup error', err)
      currentCallRef.current = null
      setCallState('idle')
      setCurrentCall(null)
    }
  }, [])

  /**
   * Mute microphone
   */
  const mute = useCallback(() => {
    const call = currentCallRef.current
    if (call) {
      if (call.muteAudio) {
        call.muteAudio()
      } else if (call.mute) {
        call.mute()
      } else {
        console.error('[Telnyx] Call has no mute method:', Object.keys(call))
      }
      setIsMuted(true)
    }
  }, [])

  /**
   * Unmute microphone
   */
  const unmute = useCallback(() => {
    const call = currentCallRef.current
    if (call) {
      if (call.unmuteAudio) {
        call.unmuteAudio()
      } else if (call.unmute) {
        call.unmute()
      } else {
        console.error('[Telnyx] Call has no unmute method:', Object.keys(call))
      }
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
