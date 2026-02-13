'use client'

/**
 * CallbackScheduler — Schedule callback for a specific account
 *
 * Used from the Cockpit or account detail page.
 * Posts to /api/bookings with type=callback.
 */

import React, { useState, useCallback } from 'react'
import { apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CalendarClock, Clock, X, CheckCircle, Loader2,
  AlertTriangle, Phone, Repeat, Globe,
} from 'lucide-react'

/** Common US timezones for debt collection (FDCPA 8am-9pm windows) */
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
] as const

interface CallbackSchedulerProps {
  accountId: string
  accountName: string
  phone: string
  /** Pre-populated timezone from the account (e.g., from collection_accounts.timezone) */
  accountTimezone?: string
  onClose: () => void
  onScheduled?: (bookingId: string) => void
}

export default function CallbackScheduler({
  accountId,
  accountName,
  phone,
  accountTimezone,
  onClose,
  onScheduled,
}: CallbackSchedulerProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [timezone, setTimezone] = useState(accountTimezone || 'America/New_York')
  const [notes, setNotes] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<'daily' | 'weekly' | 'biweekly'>('weekly')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quick-pick buttons for common times
  const quickPicks = [
    { label: 'In 1 hour', getDate: () => { const d = new Date(); d.setHours(d.getHours() + 1); return d } },
    { label: 'Tomorrow 9am', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d } },
    { label: 'Tomorrow 2pm', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(14, 0, 0, 0); return d } },
    { label: 'Next Monday', getDate: () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(10, 0, 0, 0); return d } },
  ]

  const handleQuickPick = (getDate: () => Date) => {
    const d = getDate()
    setDate(d.toISOString().split('T')[0])
    setTime(d.toTimeString().slice(0, 5))
  }

  const handleSchedule = useCallback(async () => {
    if (!date || !time) {
      setError('Select a date and time')
      return
    }

    // Build a timezone-aware ISO string: interpret date+time in the selected timezone
    const scheduledAt = new Date(`${date}T${time}:00`)
    if (scheduledAt <= new Date()) {
      setError('Callback must be in the future')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await apiPost('/api/bookings', {
        account_id: accountId,
        phone_number: phone,
        type: 'callback',
        scheduled_time: scheduledAt.toISOString(),
        timezone,
        notes: notes || `Callback for ${accountName}`,
        recurring: recurring ? recurrenceInterval : null,
      })

      setCreated(true)
      onScheduled?.(data.id || data.data?.id || data.booking?.id)
      logger.info('Callback scheduled', { accountId, time: scheduledAt.toISOString() })
    } catch (err: any) {
      logger.error('Failed to schedule callback', { error: err?.message })
      setError(err?.message || 'Failed to schedule callback')
    } finally {
      setLoading(false)
    }
  }, [accountId, accountName, phone, date, time, timezone, notes, recurring, recurrenceInterval, onScheduled])

  if (created) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Callback Scheduled</h3>
            <p className="text-sm text-gray-500 mt-1">
              {accountName} — {new Date(`${date}T${time}`).toLocaleString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                timeZone: timezone,
              })} ({TIMEZONES.find(tz => tz.value === timezone)?.label || timezone})
            </p>
            <Button onClick={onClose} className="mt-4">Done</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-blue-500" />
            Schedule Callback
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{accountName}</p>
                <p className="text-xs text-gray-500">{phone}</p>
              </div>
            </div>
          </div>

          {/* Quick picks */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quick Pick</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {quickPicks.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => handleQuickPick(qp.getDate)}
                  className="px-2 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Account Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-primary-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRecurring(!recurring)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                recurring
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              Recurring
            </button>
            {recurring && (
              <select
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(e.target.value as any)}
                className="px-2 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
              </select>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for callback..."
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={2}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSchedule}
            disabled={loading || !date || !time}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
            Schedule Callback
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
