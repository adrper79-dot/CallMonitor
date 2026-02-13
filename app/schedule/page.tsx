'use client'

/**
 * /schedule — Callbacks & follow-ups landing
 *
 * Tabs: Callbacks | Follow-Ups
 * Reuses BookingsList for callbacks, FollowUpTracker for promises.
 */

import React, { useState } from 'react'
import { CalendarClock, ListChecks, Globe } from 'lucide-react'
import dynamic from 'next/dynamic'

const BookingsList = dynamic(() => import('@/components/voice/BookingsList'), { ssr: false })
const FollowUpTracker = dynamic(() => import('@/components/schedule/FollowUpTracker'), { ssr: false })

type Tab = 'callbacks' | 'follow-ups'

const DISPLAY_TIMEZONES = [
  { value: 'local', label: 'Local' },
  { value: 'America/New_York', label: 'Eastern' },
  { value: 'America/Chicago', label: 'Central' },
  { value: 'America/Denver', label: 'Mountain' },
  { value: 'America/Los_Angeles', label: 'Pacific' },
] as const

export default function SchedulePage() {
  const [tab, setTab] = useState<Tab>('callbacks')
  const [displayTz, setDisplayTz] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('wib-schedule-tz') || 'local'
    }
    return 'local'
  })

  const handleTzChange = (tz: string) => {
    setDisplayTz(tz)
    localStorage.setItem('wib-schedule-tz', tz)
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'callbacks', label: 'Callbacks', icon: <CalendarClock className="w-4 h-4" /> },
    { key: 'follow-ups', label: 'Follow-Ups', icon: <ListChecks className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">Callbacks, follow-ups & promise tracking</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Globe className="w-4 h-4 text-gray-400" />
          <select
            value={displayTz}
            onChange={(e) => handleTzChange(e.target.value)}
            className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
          >
            {DISPLAY_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'callbacks' && <BookingsList />}
      {tab === 'follow-ups' && <FollowUpTracker />}
    </div>
  )
}
