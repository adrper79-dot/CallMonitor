"use client"

import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'


interface UsageData {
  usage: {
    calls: number
    minutes: number
    transcriptions: number
    translations: number
    period_start: string
    period_end: string
  }
  limits: {
    max_calls?: number | null
    max_minutes?: number | null
    max_transcriptions?: number | null
    max_translations?: number | null
    allow_live_translation: boolean
    allow_survey_calls: boolean
  }
}

interface UsageDisplayProps {
  organizationId: string
  plan: string
}

export function UsageDisplay({ organizationId, plan }: UsageDisplayProps) {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUsage() {
      try {
        setLoading(true)
        const res = await fetch(`/api/usage`, { credentials: 'include' })
        
        if (!res.ok) {
          throw new Error('Failed to fetch usage data')
        }
        
        const result = await res.json()
        setData(result)
      } catch (err: any) {
        logger.error('Failed to fetch usage', err, { organizationId })
        setError(err.message || 'Failed to load usage data')
      } finally {
        setLoading(false)
      }
    }

    if (organizationId) {
      fetchUsage()
    }
  }, [organizationId])

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="loading-spinner" />
          <span className="ml-3 text-gray-500">Loading usage...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-amber-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">{error || 'Unable to load usage data'}</span>
        </div>
      </div>
    )
  }

  const { usage, limits } = data

  // Calculate usage percentages
  const callsPercent = limits.max_calls ? Math.min((usage.calls / limits.max_calls) * 100, 100) : 0
  const minutesPercent = limits.max_minutes ? Math.min((usage.minutes / limits.max_minutes) * 100, 100) : 0

  // Determine warning state
  const isCallsNearLimit = callsPercent >= 80
  const isMinutesNearLimit = minutesPercent >= 80

  return (
    <div className="bg-white rounded-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Current Plan</p>
          <p className="text-2xl font-semibold text-gray-900 capitalize">{plan || 'Free'}</p>
        </div>
        <Badge variant="success">Active</Badge>
      </div>

      {/* Usage Metrics */}
      <div className="space-y-4 mb-6">
        {/* Calls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Calls this month</span>
            <span className="text-sm text-gray-600">
              {usage.calls} {limits.max_calls ? `/ ${limits.max_calls}` : ''}
            </span>
          </div>
          {limits.max_calls && (
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${
                  isCallsNearLimit ? 'bg-amber-500' : 'bg-primary-600'
                }`}
                style={{ width: `${callsPercent}%` }}
              />
            </div>
          )}
          {isCallsNearLimit && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Approaching call limit
            </p>
          )}
        </div>

        {/* Minutes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Minutes used</span>
            <span className="text-sm text-gray-600">
              {usage.minutes} {limits.max_minutes ? `/ ${limits.max_minutes}` : ''}
            </span>
          </div>
          {limits.max_minutes && (
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${
                  isMinutesNearLimit ? 'bg-amber-500' : 'bg-primary-600'
                }`}
                style={{ width: `${minutesPercent}%` }}
              />
            </div>
          )}
          {isMinutesNearLimit && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Approaching minute limit
            </p>
          )}
        </div>

        {/* Additional metrics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-500">Transcriptions</p>
            <p className="text-lg font-semibold text-gray-900">{usage.transcriptions}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Translations</p>
            <p className="text-lg font-semibold text-gray-900">{usage.translations}</p>
          </div>
        </div>
      </div>

      {/* Feature flags */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Live Translation</span>
          <Badge variant={limits.allow_live_translation ? 'default' : 'secondary'}>
            {limits.allow_live_translation ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Survey Calls</span>
          <Badge variant={limits.allow_survey_calls ? 'default' : 'secondary'}>
            {limits.allow_survey_calls ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </div>

      {/* Billing period */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Billing period: {new Date(usage.period_start).toLocaleDateString()} - {new Date(usage.period_end).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}
