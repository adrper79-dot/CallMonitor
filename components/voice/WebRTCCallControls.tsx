'use client'

import React, { useEffect, useCallback } from 'react'
import { useWebRTCContext } from '@/hooks/WebRTCProvider'
import { useTargetNumber } from '@/hooks/TargetNumberProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

export interface WebRTCCallControlsProps {
  organizationId: string | null
  onCallPlaced?: (callId: string) => void
}

/**
 * WebRTCCallControls - Professional Design System v3.0
 *
 * Browser-based calling controls using WebRTC.
 * Per ARCH_DOCS: Telnyx WebRTC execution via browser SDK.
 */
export function WebRTCCallControls({ organizationId, onCallPlaced }: WebRTCCallControlsProps) {
  const webrtc = useWebRTCContext()
  const { toast } = useToast()
  const { targetNumber, isValid: hasValidNumber } = useTargetNumber() // Read from shared context

  const {
    connect,
    disconnect,
    makeCall,
    hangUp,
    mute,
    unmute,
    status,
    callState,
    currentCall,
    isMuted,
    quality,
    error,
  } = webrtc

  // Auto-connect when component mounts if disconnected
  useEffect(() => {
    if (status === 'disconnected' && organizationId) {
      // Don't auto-connect - let user initiate
    }
  }, [status, organizationId])

  // Show errors as toasts
  useEffect(() => {
    if (error) {
      toast({
        title: 'WebRTC Error',
        description: error,
        variant: 'destructive',
      })
    }
  }, [error, toast])

  const handleConnect = useCallback(async () => {
    try {
      await connect()
      toast({
        title: 'Connected',
        description: 'WebRTC is ready for browser calling',
      })
    } catch (err: any) {
      toast({
        title: 'Connection Failed',
        description: err?.message || 'Could not connect to WebRTC',
        variant: 'destructive',
      })
    }
  }, [connect, toast])

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect()
      toast({
        title: 'Disconnected',
        description: 'WebRTC session ended',
      })
    } catch (err: any) {
      // Ignore disconnect errors
    }
  }, [disconnect, toast])

  const handleMakeCall = useCallback(async () => {
    if (!hasValidNumber) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid phone number in E.164 format (starts with +)',
        variant: 'destructive',
      })
      return
    }

    console.info('[WebRTCCallControls] Attempting call with:', {
      phoneNumber: targetNumber ? `***${targetNumber.slice(-4)}` : 'none',
      hasValidNumber,
    })

    try {
      await makeCall(targetNumber)

      // Notify parent - use a generated ID since WebRTC doesn't have call_id yet
      if (currentCall?.id) {
        onCallPlaced?.(currentCall.id)
      }
    } catch (err: any) {
      toast({
        title: 'Call Failed',
        description: err?.message || 'Could not place call',
        variant: 'destructive',
      })
    }
  }, [hasValidNumber, targetNumber, makeCall, currentCall, onCallPlaced, toast])

  const handleHangUp = useCallback(async () => {
    try {
      await hangUp()
    } catch (err: any) {
      // Ignore hangup errors
    }
  }, [hangUp])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Not connected - show connect button
  if (status === 'disconnected' || status === 'error') {
    return (
      <section className="bg-white rounded-md border border-gray-200 p-6">
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Browser Calling</h3>
            <p className="text-xs text-gray-500 mb-4">
              Connect to enable calling from your browser using your computer&apos;s microphone.
            </p>
          </div>

          <Button
            onClick={handleConnect}
            variant="primary"
            size="lg"
            className="w-full h-14 text-base"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
              />
            </svg>
            Connect Microphone
          </Button>

          {error && <p className="text-sm text-error text-center">{error}</p>}
        </div>
      </section>
    )
  }

  // Connecting state
  if (status === 'initializing' || status === 'connecting') {
    return (
      <section className="bg-white rounded-md border border-gray-200 p-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mb-3 animate-pulse">
            <svg className="w-6 h-6 text-primary-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-1">Connecting...</h3>
          <p className="text-xs text-gray-500">
            Requesting microphone access and connecting to Telnyx
          </p>
        </div>
      </section>
    )
  }

  // Connected - show call controls
  return (
    <section className="bg-white rounded-md border border-gray-200 p-6">
      <div className="space-y-4">
        {/* Connection status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-gray-600">Browser connected</span>
          </div>
          <button
            onClick={handleDisconnect}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Disconnect
          </button>
        </div>

        {/* Target number display - only show if we have a valid target */}
        {hasValidNumber && callState === 'idle' && (
          <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
            <div className="text-sm text-gray-700">
              <span className="font-medium">Ready to call:</span>{' '}
              <span className="font-mono">{targetNumber}</span>
            </div>
          </div>
        )}

        {/* Active Call Display */}
        {currentCall && (
          <div className="p-4 bg-success-light rounded-md border border-success/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-success-dark">Active Call</span>
              <Badge variant="success">{callState}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 font-mono">{currentCall.phone_number}</span>
              <span className="text-lg font-mono text-gray-900 tabular-nums">
                {formatDuration(currentCall.duration)}
              </span>
            </div>

            {/* Call Quality */}
            {quality && (
              <div className="mt-3 pt-3 border-t border-success/10 grid grid-cols-2 gap-2 text-xs">
                {quality.audio_bitrate && (
                  <div>
                    <span className="text-gray-500">Bitrate:</span>{' '}
                    <span className="font-mono">
                      {Math.round(quality.audio_bitrate / 1000)}kbps
                    </span>
                  </div>
                )}
                {quality.packet_loss_percent !== undefined && (
                  <div>
                    <span className="text-gray-500">Loss:</span>{' '}
                    <span className="font-mono">{quality.packet_loss_percent.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Call Controls */}
        {callState === 'idle' && (
          <Button
            onClick={handleMakeCall}
            disabled={!hasValidNumber}
            variant="primary"
            size="lg"
            className="w-full h-14 text-base"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            </svg>
            Place Call (Browser)
          </Button>
        )}

        {(callState === 'dialing' || callState === 'ringing') && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 py-4">
              <svg
                className="w-8 h-8 text-primary-500 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                />
              </svg>
              <span className="text-lg font-medium text-gray-700">
                {callState === 'dialing' ? 'Dialing...' : 'Ringing...'}
              </span>
            </div>
            <Button
              onClick={handleHangUp}
              variant="outline"
              size="lg"
              className="w-full border-error text-error hover:bg-error-light"
            >
              Cancel
            </Button>
          </div>
        )}

        {callState === 'active' && (
          <div className="grid grid-cols-3 gap-2">
            {/* Mute/Unmute */}
            <Button
              onClick={isMuted ? unmute : mute}
              variant="outline"
              size="lg"
              className={`flex flex-col items-center py-4 ${isMuted ? 'bg-warning-light border-warning' : ''}`}
            >
              {isMuted ? (
                <svg
                  className="w-6 h-6 mb-1 text-warning"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 mb-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
              )}
              <span className="text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
            </Button>

            {/* Hang Up */}
            <Button
              onClick={handleHangUp}
              variant="outline"
              size="lg"
              className="flex flex-col items-center py-4 border-error text-error hover:bg-error-light"
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m-12 8.25c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                />
              </svg>
              <span className="text-xs">End</span>
            </Button>

            {/* Placeholder for future controls (hold, transfer, etc.) */}
            <Button
              variant="outline"
              size="lg"
              className="flex flex-col items-center py-4 opacity-50"
              disabled
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
              <span className="text-xs">More</span>
            </Button>
          </div>
        )}

        {!hasValidNumber && callState === 'idle' && (
          <p className="text-sm text-gray-500 text-center">
            Enter a phone number above to place a call
          </p>
        )}
      </div>
    </section>
  )
}

export default WebRTCCallControls
