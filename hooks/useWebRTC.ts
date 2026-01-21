"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from '@/lib/apiClient'

/**
 * WebRTC Hook (Robust Voice Client Version)
 * 
 * Strategy: Dynamic Import of SignalWire SDK.
 * Supports both Unified (SignalWire function) and Legacy (Voice/Relay classes).
 * Full Event Handling + Audio Track binding.
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

  const clientRef = useRef<any>(null)
  const activeCallRef = useRef<any>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  // Initialization of Audio Element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio()
      audio.autoplay = true // Important
      remoteAudioRef.current = audio
    }
  }, [])

  // Call Duration Timer
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

  // Cleanup on Unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      if (activeCallRef.current) activeCallRef.current.hangup?.()
      if (clientRef.current) clientRef.current.disconnect?.()
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

      // 1. Get Session & Token
      await apiPost('/api/webrtc/session') // Keep session alive
      const tokenRes = await apiPost<{ success: boolean; token: string, project_id: string }>('/api/webrtc/token')

      if (!tokenRes.success || !tokenRes.token) {
        throw new Error('Failed to fetch SignalWire Token')
      }

      // 2. Dynamic Import
      console.log('[SignalWire] Importing SDK...')
      // @ts-ignore
      const module = await import('@signalwire/js')
      console.log('[SignalWire] Exports:', Object.keys(module))
      console.log('[SignalWire] Typeof SignalWire:', typeof module.SignalWire)
      console.log('[SignalWire] Has Video?', !!module.Video)
      console.log('[SignalWire] Has Voice?', !!module.Voice)
      console.log('[SignalWire] Has Relay?', !!module.Relay)

      let client

      // Strategy A: Unified 'SignalWire' Factory
      if (typeof module.SignalWire === 'function') {
        console.log('[SignalWire] Strategy A: Factory Function')
        try {
          // Try Connect
          client = await module.SignalWire({
            token: tokenRes.token,
            // project: tokenRes.project_id // Unified usually infers project from token
          })
        } catch (e: any) {
          console.error('[SignalWire] Factory Error:', e)
          // If Factory fails, try Legacy Class if available
        }
      }

      // Strategy B: Legacy Voice/Relay Class (Fallback or Primary if Factory failed/missing)
      if (!client) {
        const ClientClass = (module.Voice && module.Voice.Client) || (module.Relay && module.Relay.Client)
        if (ClientClass) {
          console.log('[SignalWire] Strategy B: Legacy Client Class')
          client = new ClientClass({
            project: tokenRes.project_id,
            token: tokenRes.token
          })
          await client.connect()
        } else {
          throw new Error('No compatible Client Class found (Factory failed or missing, Legacy missing)')
        }
      }

      console.log('[SignalWire] Client Ready. Keys:', Object.keys(client))
      console.log('[SignalWire] Client Proto:', Object.getPrototypeOf(client))
      console.log('[SignalWire] Client.voice?', !!client.voice)
      console.log('[SignalWire] Client.dial?', typeof client.dial)


      // Bind Global Events if possible
      if (client.on) {
        client.on('signalwire.error', (e: any) => console.error('SW Error:', e))
        client.on('signalwire.notification', (n: any) => console.log('SW Notification:', n))
      }

      clientRef.current = client
      setStatus('connected')

    } catch (err: any) {
      console.error('[WebRTC] Connection error:', err)
      setError(err?.message || 'Failed to connect')
      setStatus('error')
    }
  }, [organizationId, status])

  const disconnect = useCallback(async () => {
    // ... same disconnect logic
    if (clientRef.current) try { clientRef.current.disconnect() } catch { }
    setStatus('disconnected')
  }, [])

  const makeCall = useCallback(async (phoneNumber: string) => {
    if (status !== 'connected' || !clientRef.current) {
      setError('Not connected')
      return
    }

    try {
      setCallState('dialing')
      const client = clientRef.current

      let call
      const params = {
        to: phoneNumber,
        from: process.env.NEXT_PUBLIC_SIGNALWIRE_NUMBER || '+15550100666', // Verification requires verified CallerID
      }

      // Detect Method
      // 1. Unified: client.voice.dialPhone?
      if (client.voice && typeof client.voice.dialPhone === 'function') {
        console.log('[Dial] Using client.voice.dialPhone')
        call = await client.voice.dialPhone(params)
      }
      // 2. Relay V3: client.dial?
      else if (typeof client.dial === 'function') {
        console.log('[Dial] Using client.dial')
        call = await client.dial(params)
      }
      // 3. Helper: client.dialPhoneNumber?
      else if (typeof client.dialPhoneNumber === 'function') {
        console.log('[Dial] Using client.dialPhoneNumber')
        call = await client.dialPhoneNumber(params)
      }
      else {
        throw new Error('No dial method found on client')
      }

      console.log('[SignalWire] Call Object Created:', call)
      activeCallRef.current = call

      // Event Binding (Crucial)
      call.on('ringing', () => {
        console.log('[Call] Ringing...')
        setCallState('ringing')
      })

      call.on('active', () => {
        console.log('[Call] Active')
        setCallState('active')
        setCurrentCall({
          id: call.id,
          phone_number: phoneNumber,
          started_at: new Date(),
          duration: 0
        })
      })

      call.on('answered', () => {
        // Equivalent to active often
        console.log('[Call] Answered')
        setCallState('active')
      })

      call.on('destroy', () => {
        console.log('[Call] Destroyed (Ended)')
        setCallState('idle')
        setCurrentCall(null)
      })

      // Media Binding
      // Look for 'track' event or check call.remoteStream
      if (call.on) {
        call.on('track', (event: any) => {
          console.log('[Call] Track Event', event)
          // Attach to audio element
          // event.track usually available
          const track = event.track
          if (track && track.kind === 'audio' && remoteAudioRef.current) {
            const stream = new MediaStream([track])
            remoteAudioRef.current.srcObject = stream
            remoteAudioRef.current.play().catch(e => console.error('Play Error', e))
          }
        })
      }

    } catch (err: any) {
      console.error('[Dial] Error:', err)
      setError(err.message)
      setCallState('idle')
    }

  }, [status])

  const hangUp = useCallback(async () => {
    if (activeCallRef.current) await activeCallRef.current.hangup()
    setCallState('idle')
  }, [])

  // ... mute/unmute

  return {
    connect,
    disconnect,
    status,
    error,
    makeCall,
    hangUp,
    callState,
    currentCall,
    mute: () => { },
    unmute: () => { },
    isMuted,
    quality,
    sessionId
  }
}
