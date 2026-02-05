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

  // Telnyx WebRTC refs
  const telnyxClientRef = useRef<any>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
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
      if (telnyxClientRef.current) {
        try { telnyxClientRef.current.disconnect() } catch (e) { /* ignore */ }
        telnyxClientRef.current = null
      }
    }
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

      console.log('[Telnyx] Got credentials, initializing client...')
      setStatus('connecting')

      // 2. Dynamic import of Telnyx WebRTC SDK
      const { TelnyxRTC } = await import('@telnyx/webrtc')

      // 3. Create Telnyx WebRTC client
      const client = new TelnyxRTC({
        login_token: tokenRes.token,
        login: tokenRes.username,
        iceServers: tokenRes.rtcConfig.iceServers,
        ringtoneFile: null, // Disable default ringtone
        ringbackFile: null, // Disable default ringback
      })

      telnyxClientRef.current = client
      setSessionId(tokenRes.username)

      // 4. Setup event handlers
      client.on('ready', () => {
        console.log('[Telnyx] Client ready')
        setStatus('registered')
      })

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
            client.login_token = tokenRes.token
            client.login = tokenRes.username
            client.iceServers = tokenRes.rtcConfig.iceServers
            
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
        console.log('[Telnyx] Call update:', call.state)

        switch (call.state) {
          case 'ringing':
            setCallState('ringing')
            break
          case 'active':
            setCallState('active')
            setStatus('on_call')
            if (!currentCall) {
              setCurrentCall({
                id: call.id,
                phone_number: call.options?.remoteCallerNumber || 'Unknown',
                started_at: new Date(),
                duration: 0
              })
            }
            break
          case 'hangup':
          case 'destroy':
            setCallState('idle')
            setCurrentCall(null)
            setStatus('registered')
            break
        }
      })

      client.on('media', (media: any) => {
        console.log('[Telnyx] Media received')
        if (media.stream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = media.stream
          remoteAudioRef.current.play().catch(e => console.error('[Telnyx] Audio play error', e))
        }
      })

      // 5. Connect
      await client.connect()
      console.log('[Telnyx] Connection initiated')

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
   * Make outbound call via Telnyx Call Control API
   */
  const makeCall = useCallback(async (phoneNumber: string) => {
    if (status !== 'registered' || !telnyxClientRef.current) {
      setError('Not connected to WebRTC')
      return
    }

    try {
      setCallState('dialing')
      setError(null)

      console.log('[Telnyx] Initiating call to:', phoneNumber)

      // Use server-side dial via Call Control API
      const dialRes = await apiPost<{
        success: boolean
        call_id: string
        call_sid: string
        status: string
      }>('/api/webrtc/dial', { phone_number: phoneNumber })

      if (!dialRes.success) {
        throw new Error('Failed to initiate call')
      }

      console.log('[Telnyx] Server dial initiated:', dialRes.call_sid)

      // Update state
      setCurrentCall({
        id: dialRes.call_id,
        phone_number: phoneNumber,
        started_at: new Date(),
        duration: 0
      })

      // The call will be answered via WebRTC when the PSTN connection is established
      // The client will receive callUpdate events

    } catch (err: any) {
      console.error('[Telnyx] Call error', err)
      setError(err.message || 'Call failed')
      setCallState('idle')
    }
  }, [status])

  /**
   * Hang up current call
   */
  const hangUp = useCallback(async () => {
    if (!telnyxClientRef.current) return

    try {
      setCallState('ending')

      // Hang up via Telnyx client
      await telnyxClientRef.current.hangup()

      setCallState('idle')
      setCurrentCall(null)
      setStatus('registered')
    } catch (err) {
      console.error('[Telnyx] Hangup error', err)
      setCallState('idle')
      setCurrentCall(null)
    }
  }, [])

  /**
   * Mute microphone
   */
  const mute = useCallback(() => {
    if (telnyxClientRef.current) {
      telnyxClientRef.current.muteAudio()
      setIsMuted(true)
    }
  }, [])

  /**
   * Unmute microphone
   */
  const unmute = useCallback(() => {
    if (telnyxClientRef.current) {
      telnyxClientRef.current.unmuteAudio()
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
