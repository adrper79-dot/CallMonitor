"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ActiveCallPanelProps {
  callId: string
  status: string
  targetNumber?: string
  fromNumber?: string
  duration: number
  onViewDetails: () => void
  onEndCall?: () => void
  onNewCall: () => void
}

/**
 * ActiveCallPanel - Call Success State
 * 
 * Shows real-time call status with clear next actions.
 * Professional Design System v3.0
 */
export function ActiveCallPanel({
  callId,
  status,
  targetNumber,
  fromNumber,
  duration,
  onViewDetails,
  onEndCall,
  onNewCall,
}: ActiveCallPanelProps) {
  const [showCopied, setShowCopied] = useState(false)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const copyCallId = async () => {
    await navigator.clipboard.writeText(callId)
    setShowCopied(true)
    setTimeout(() => setShowCopied(false), 2000)
  }

  const statusConfig: Record<string, { color: string; label: string; animate: boolean }> = {
    initiating: { color: 'bg-blue-500', label: 'Initiating', animate: true },
    ringing: { color: 'bg-amber-500', label: 'Ringing', animate: true },
    in_progress: { color: 'bg-success', label: 'Connected', animate: true },
    completed: { color: 'bg-gray-400', label: 'Completed', animate: false },
    failed: { color: 'bg-error', label: 'Failed', animate: false },
    'no-answer': { color: 'bg-warning', label: 'No Answer', animate: false },
    busy: { color: 'bg-warning', label: 'Busy', animate: false },
  }

  const config = statusConfig[status] || statusConfig.initiating
  const isActive = ['initiating', 'ringing', 'in_progress'].includes(status)

  return (
    <div className={`
      rounded-lg border-2 overflow-hidden transition-colors
      ${isActive ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-white'}
    `}>
      {/* Status Header */}
      <div className={`
        px-4 py-3 flex items-center gap-3
        ${isActive ? 'bg-primary-100' : 'bg-gray-50'}
      `}>
        {/* Animated status indicator */}
        <div className="relative">
          <div className={`w-3 h-3 rounded-full ${config.color}`} />
          {config.animate && (
            <div className={`absolute inset-0 w-3 h-3 rounded-full ${config.color} animate-ping opacity-75`} />
          )}
        </div>
        
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {isActive ? 'Call Active' : `Call ${config.label}`}
          </p>
          {isActive && (
            <p className="text-xs text-gray-600">
              {status === 'in_progress' ? `Duration: ${formatDuration(duration)}` : config.label}
            </p>
          )}
        </div>

        <Badge 
          variant={
            status === 'completed' ? 'success' :
            status === 'failed' ? 'error' :
            isActive ? 'default' : 'warning'
          }
        >
          {config.label}
        </Badge>
      </div>

      {/* Call Details */}
      <div className="p-4 space-y-3">
        {/* Target Info */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Calling</span>
          <span className="text-sm font-mono text-gray-900">{targetNumber || 'Unknown'}</span>
        </div>

        {fromNumber && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">From</span>
            <span className="text-sm font-mono text-gray-900">{fromNumber}</span>
          </div>
        )}

        {/* Call ID */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Call ID</span>
          <button
            onClick={copyCallId}
            className="flex items-center gap-1 text-sm font-mono text-primary-600 hover:text-primary-700"
          >
            {callId.slice(0, 8)}...
            {showCopied ? (
              <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Duration (for active/completed calls) */}
        {(status === 'in_progress' || status === 'completed') && duration > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Duration</span>
            <span className="text-sm font-mono text-gray-900">{formatDuration(duration)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetails}
          className="flex-1"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View Details
        </Button>

        {isActive && onEndCall && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEndCall}
            className="text-error border-error hover:bg-error-light"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
            End
          </Button>
        )}

        {!isActive && (
          <Button
            variant="primary"
            size="sm"
            onClick={onNewCall}
            className="flex-1"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            New Call
          </Button>
        )}
      </div>
    </div>
  )
}

export default ActiveCallPanel
