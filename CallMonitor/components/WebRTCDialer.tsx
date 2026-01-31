"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { useWebRTC, WebRTCStatus, CallState } from '@/hooks/useWebRTC'
import { Button } from '@/components/ui/button'

/**
 * WebRTC Dialer Component
 * 
 * Browser-based softphone using SignalWire WebRTC.
 * Per ARCH_DOCS: Clean UI, follows Design System v3.0
 * 
 * Features:
 * - Connect/disconnect from WebRTC
 * - Dial pad for entering phone numbers
 * - Mute/unmute controls
 * - Call quality indicators
 * - Call duration timer
 */

interface WebRTCDialerProps {
  organizationId: string | null
  onCallStarted?: (callId: string) => void
  onCallEnded?: (callId: string) => void
  compact?: boolean
  className?: string
}

const DIAL_PAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
]

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

function StatusIndicator({ status }: { status: WebRTCStatus }) {
  const statusConfig: Record<WebRTCStatus, { color: string; label: string }> = {
    disconnected: { color: 'bg-gray-400', label: 'Disconnected' },
    initializing: { color: 'bg-yellow-400 animate-pulse', label: 'Initializing...' },
    connecting: { color: 'bg-yellow-400 animate-pulse', label: 'Connecting...' },
    registered: { color: 'bg-green-500', label: 'Ready' },
    on_call: { color: 'bg-blue-500 animate-pulse', label: 'On Call' },
    error: { color: 'bg-red-500', label: 'Error' },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-gray-600">{config.label}</span>
    </div>
  )
}

function QualityIndicator({ quality }: { quality: { packet_loss_percent?: number } | null }) {
  if (!quality) return null

  const loss = quality.packet_loss_percent ?? 0
  let color = 'text-green-600'
  let label = 'Excellent'

  if (loss > 5) {
    color = 'text-red-600'
    label = 'Poor'
  } else if (loss > 2) {
    color = 'text-yellow-600'
    label = 'Fair'
  } else if (loss > 0.5) {
    color = 'text-green-500'
    label = 'Good'
  }

  return (
    <div className="flex items-center gap-1">
      <svg className={`w-4 h-4 ${color}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className={`text-xs ${color}`}>{label}</span>
    </div>
  )
}

export function WebRTCDialer({
  organizationId,
  onCallStarted,
  onCallEnded,
  compact = false,
  className = '',
}: WebRTCDialerProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown')

  const {
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
  } = useWebRTC(organizationId)

  // Check microphone permission on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((result) => {
          setMicPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown')
          result.onchange = () => {
            setMicPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown')
          }
        })
        .catch(() => setMicPermission('unknown'))
    }
  }, [])

  // Notify parent on call start/end
  useEffect(() => {
    if (currentCall && callState === 'active' && onCallStarted) {
      onCallStarted(currentCall.id)
    }
  }, [currentCall, callState, onCallStarted])

  useEffect(() => {
    if (!currentCall && callState === 'idle' && onCallEnded) {
      // Call ended
    }
  }, [currentCall, callState, onCallEnded])

  const handleDialPadPress = useCallback((key: string) => {
    if (callState === 'idle') {
      setPhoneNumber(prev => prev + key)
    } else if (callState === 'active') {
      // Send DTMF tone (if supported)
      // callRef.current?.sendDTMF(key)
    }
  }, [callState])

  const handleBackspace = useCallback(() => {
    setPhoneNumber(prev => prev.slice(0, -1))
  }, [])

  const handleClear = useCallback(() => {
    setPhoneNumber('')
  }, [])

  const handleConnect = useCallback(async () => {
    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicPermission('granted')
      await connect()
    } catch (err) {
      setMicPermission('denied')
    }
  }, [connect])

  const handleCall = useCallback(async () => {
    if (phoneNumber.length >= 10) {
      await makeCall(phoneNumber)
      setPhoneNumber('')
    }
  }, [phoneNumber, makeCall])

  const isConnected = status === 'registered' || status === 'on_call'
  const canDial = isConnected && callState === 'idle' && phoneNumber.length >= 10
  const isOnCall = callState === 'active' || callState === 'ringing' || callState === 'dialing'

  // Compact mode - just a connection button and minimal UI
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StatusIndicator status={status} />
        {!isConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={status === 'connecting' || status === 'initializing'}
          >
            {status === 'connecting' || status === 'initializing' ? 'Connecting...' : 'Enable Browser Calling'}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={disconnect}>
            Disconnect
          </Button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Browser Phone</h3>
            <StatusIndicator status={status} />
          </div>
        </div>
        {quality && <QualityIndicator quality={quality} />}
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Connection State */}
        {!isConnected && status !== 'connecting' && status !== 'initializing' && (
          <div className="text-center py-6">
            {micPermission === 'denied' ? (
              <div className="space-y-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">Microphone access denied</p>
                <p className="text-xs text-gray-500">Enable microphone in browser settings to use browser calling</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">Make calls directly from your browser</p>
                <Button onClick={handleConnect} variant="primary">
                  Enable Browser Calling
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Connecting State */}
        {(status === 'connecting' || status === 'initializing') && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mt-3">Connecting to phone system...</p>
          </div>
        )}

        {/* Active Call */}
        {isOnCall && currentCall && (
          <div className="text-center py-4 space-y-4">
            <div>
              <p className="text-2xl font-mono font-medium text-gray-900">
                {formatPhoneDisplay(currentCall.phone_number)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {callState === 'dialing' && 'Dialing...'}
                {callState === 'ringing' && 'Ringing...'}
                {callState === 'active' && formatDuration(currentCall.duration)}
              </p>
            </div>

            {/* Call Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={isMuted ? unmute : mute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              <button
                onClick={hangUp}
                className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                title="End Call"
              >
                <svg className="w-6 h-6 transform rotate-135" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Dial Pad (when connected and not on call) */}
        {isConnected && !isOnCall && (
          <div className="space-y-4">
            {/* Phone Number Display */}
            <div className="relative">
              <input
                type="tel"
                value={formatPhoneDisplay(phoneNumber)}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d+]/g, ''))}
                placeholder="Enter phone number"
                className="w-full text-center text-2xl font-mono py-3 border-b border-gray-200 focus:border-[#1E3A5F] outline-none bg-transparent"
              />
              {phoneNumber && (
                <button
                  onClick={handleBackspace}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600"
                  title="Backspace"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Dial Pad Grid */}
            <div className="grid grid-cols-3 gap-2">
              {DIAL_PAD_KEYS.flat().map((key) => (
                <button
                  key={key}
                  onClick={() => handleDialPadPress(key)}
                  className="h-14 rounded-lg bg-gray-50 hover:bg-gray-100 text-xl font-medium text-gray-900 transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Call Button */}
            <div className="flex gap-2">
              <button
                onClick={handleCall}
                disabled={!canDial}
                className={`flex-1 h-14 rounded-lg flex items-center justify-center gap-2 text-white font-medium transition-colors ${canDial
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-300 cursor-not-allowed'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Footer - Disconnect button */}
      {isConnected && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={disconnect}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Disconnect Browser Phone
          </button>
        </div>
      )}
    </div>
  )
}

export default WebRTCDialer
