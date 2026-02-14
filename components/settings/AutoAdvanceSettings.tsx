'use client'

/**
 * Auto-Advance Settings Component
 * 
 * Allows users to configure auto-advance behavior for the power dialer:
 * - Enable/disable auto-advance
 * - Countdown duration (1-5 seconds)
 * - Auto-advance on all dispositions vs. specific outcomes
 * 
 * Preferences are stored in localStorage and synced with QuickDisposition component.
 */

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { setAutoAdvancePrefs } from '@/components/voice/QuickDisposition'

const AUTO_ADVANCE_ENABLED_KEY = 'wb-auto-advance-enabled'
const AUTO_ADVANCE_DELAY_KEY = 'wb-auto-advance-delay'

export function AutoAdvanceSettings() {
  const [enabled, setEnabled] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(AUTO_ADVANCE_ENABLED_KEY) === 'true'
  })

  const [delay, setDelay] = React.useState(() => {
    if (typeof window === 'undefined') return 2
    const stored = localStorage.getItem(AUTO_ADVANCE_DELAY_KEY)
    return stored ? parseInt(stored, 10) : 2
  })

  const handleEnabledChange = (newEnabled: boolean) => {
    setEnabled(newEnabled)
    setAutoAdvancePrefs(newEnabled, delay)
  }

  const handleDelayChange = (values: number[]) => {
    const newDelay = values[0]
    setDelay(newDelay)
    setAutoAdvancePrefs(enabled, newDelay)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Auto-Advance Dialer
        </CardTitle>
        <CardDescription>
          Automatically dial the next account after disposition
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-advance-enabled" className="text-base font-medium">
              Enable Auto-Advance
            </Label>
            <p className="text-sm text-gray-500">
              Automatically fetch and dial next account after call disposition
            </p>
          </div>
          <Switch
            id="auto-advance-enabled"
            checked={enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        {/* Countdown Duration Slider */}
        {enabled && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-advance-delay" className="text-base font-medium">
                Countdown Duration
              </Label>
              <span className="text-sm font-semibold text-primary-600">
                {delay} second{delay !== 1 ? 's' : ''}
              </span>
            </div>
            <Slider
              id="auto-advance-delay"
              min={1}
              max={5}
              step={1}
              value={[delay]}
              onValueChange={handleDelayChange}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Time to cancel auto-dial after disposition (1-5 seconds)
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
            How it works
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Select a call disposition (Promise to Pay, Refused, etc.)</li>
            <li>• Countdown starts automatically</li>
            <li>• Press ESC to cancel before countdown completes</li>
            <li>• Next account is fetched and dialed automatically</li>
            <li>• Compliance checks are enforced (DNC, time-of-day, etc.)</li>
          </ul>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Keyboard Shortcuts
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">
                1-7
              </kbd>
              <span className="text-gray-600 dark:text-gray-400">Quick disposition</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">
                ESC
              </kbd>
              <span className="text-gray-600 dark:text-gray-400">Cancel auto-dial</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">
                N
              </kbd>
              <span className="text-gray-600 dark:text-gray-400">Dial next manually</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AutoAdvanceSettings
