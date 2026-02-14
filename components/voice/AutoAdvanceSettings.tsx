'use client'

import React, { useState, useEffect } from 'react'
import { setAutoAdvancePrefs } from './QuickDisposition'

// LocalStorage keys (must match QuickDisposition)
const AUTO_ADVANCE_ENABLED_KEY = 'wb-auto-advance-enabled'
const AUTO_ADVANCE_DELAY_KEY = 'wb-auto-advance-delay'

/**
 * Get auto-advance preferences from localStorage
 */
function getAutoAdvancePrefs(): { enabled: boolean; delay: number } {
  if (typeof window === 'undefined') return { enabled: false, delay: 2 }
  
  const enabled = localStorage.getItem(AUTO_ADVANCE_ENABLED_KEY) === 'true'
  const delay = parseInt(localStorage.getItem(AUTO_ADVANCE_DELAY_KEY) || '2', 10)
  
  return { enabled, delay: Math.min(Math.max(delay, 1), 5) }
}

/**
 * AutoAdvanceSettings — Settings panel for Power Dialer auto-advance feature.
 * 
 * Features:
 * - Enable/disable auto-advance
 * - Configure delay (1-5 seconds)
 * - Real-time sync with QuickDisposition via localStorage
 * 
 * Usage: Add to voice operations settings panel
 */
export function AutoAdvanceSettings() {
  const [enabled, setEnabled] = useState(false)
  const [delay, setDelay] = useState(2)

  // Load preferences on mount
  useEffect(() => {
    const prefs = getAutoAdvancePrefs()
    setEnabled(prefs.enabled)
    setDelay(prefs.delay)
  }, [])

  // Save preferences when changed
  const handleEnabledChange = (newEnabled: boolean) => {
    setEnabled(newEnabled)
    setAutoAdvancePrefs(newEnabled, delay)
  }

  const handleDelayChange = (newDelay: number) => {
    const clampedDelay = Math.min(Math.max(newDelay, 1), 5)
    setDelay(clampedDelay)
    setAutoAdvancePrefs(enabled, clampedDelay)
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-md border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Power Dialer Auto-Advance</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Automatically dial next contact after disposition
          </p>
        </div>
        <button
          onClick={() => handleEnabledChange(!enabled)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${enabled ? 'bg-primary-600' : 'bg-gray-200'}
          `}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${enabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {enabled && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">
              Delay before auto-dial: <span className="text-primary-600 font-semibold">{delay}s</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={delay}
                onChange={(e) => handleDelayChange(parseInt(e.target.value, 10))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => handleDelayChange(value)}
                    className={`
                      px-2 py-1 text-xs rounded border transition-colors
                      ${delay === value 
                        ? 'bg-primary-600 text-white border-primary-600' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                      }
                    `}
                  >
                    {value}s
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 flex items-start gap-1.5">
              <svg className="w-3 h-3 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>
                After setting a disposition, the system will wait {delay} second{delay !== 1 ? 's' : ''} 
                before dialing the next contact. Press ESC to cancel.
              </span>
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="text-xs font-semibold text-blue-900 mb-1.5 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              How Auto-Advance Works
            </h4>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>Set disposition code (1-7 keys)</li>
              <li>Countdown timer shows remaining time</li>
              <li>Compliance checks run before auto-dial</li>
              <li>Press ESC or click Cancel to stop</li>
              <li>Manual dial (N key) cancels auto-timer</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-yellow-900">Compliance Note</p>
              <p className="text-xs text-yellow-800 mt-0.5">
                Auto-advance respects all compliance checks (FDCPA, TCPA, 7-in-7 limits). 
                If a contact fails checks, auto-dial is blocked and you'll be notified.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AutoAdvanceSettings
