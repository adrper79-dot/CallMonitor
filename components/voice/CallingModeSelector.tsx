"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'

/**
 * Calling Mode Type
 * - phone: Traditional REST API calling (SignalWire calls your phone)
 * - browser: WebRTC calling (uses computer mic/speakers)
 */
export type CallingMode = 'phone' | 'browser'

export interface CallingModeSelectorProps {
  mode: CallingMode
  onModeChange: (mode: CallingMode) => void
  webrtcStatus?: string
  disabled?: boolean
}

/**
 * CallingModeSelector - Professional Design System v3.0
 * 
 * Toggle between phone and browser calling modes.
 * Per ARCH_DOCS: Clear UI for capability selection.
 */
export function CallingModeSelector({
  mode,
  onModeChange,
  webrtcStatus,
  disabled = false,
}: CallingModeSelectorProps) {
  return (
    <div className="bg-white rounded-md border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
          Calling Mode
        </span>
        {mode === 'browser' && webrtcStatus && (
          <Badge 
            variant={
              webrtcStatus === 'connected' || webrtcStatus === 'on_call' ? 'success' : 
              webrtcStatus === 'connecting' || webrtcStatus === 'initializing' ? 'warning' :
              webrtcStatus === 'error' ? 'error' : 'default'
            }
            className="text-xs"
          >
            {webrtcStatus}
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {/* Phone Mode */}
        <button
          onClick={() => onModeChange('phone')}
          disabled={disabled}
          className={`
            flex flex-col items-center justify-center p-3 rounded-md border-2 transition-all
            ${mode === 'phone' 
              ? 'border-primary-500 bg-primary-50 text-primary-700' 
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-pressed={mode === 'phone'}
        >
          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
          <span className="text-sm font-medium">Phone</span>
          <span className="text-xs text-gray-500 mt-0.5">Rings your phone</span>
        </button>

        {/* Browser Mode */}
        <button
          onClick={() => onModeChange('browser')}
          disabled={disabled}
          className={`
            flex flex-col items-center justify-center p-3 rounded-md border-2 transition-all
            ${mode === 'browser' 
              ? 'border-primary-500 bg-primary-50 text-primary-700' 
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-pressed={mode === 'browser'}
        >
          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          <span className="text-sm font-medium">Browser</span>
          <span className="text-xs text-gray-500 mt-0.5">Uses headset</span>
        </button>
      </div>
      
      {mode === 'browser' && (
        <p className="mt-2 text-xs text-gray-500">
          Browser calling uses your computer's microphone and speakers. 
          Make sure to grant microphone permission when prompted.
        </p>
      )}
    </div>
  )
}

export default CallingModeSelector
