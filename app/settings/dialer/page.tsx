'use client'

/**
 * Dialer Settings Page
 * 
 * Configuration for power dialer features:
 * - Auto-advance settings
 * - Agent status preferences
 * - Campaign defaults
 */

import React from 'react'
import { AutoAdvanceSettings } from '@/components/settings/AutoAdvanceSettings'

export default function DialerSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dialer Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure power dialer and auto-advance behavior
        </p>
      </div>

      <AutoAdvanceSettings />
    </div>
  )
}
