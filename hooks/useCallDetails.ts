"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet } from '@/lib/api-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

export interface CallDetails {
  call: {
    id: string
    organization_id: string
    status: string | null
    started_at: string | null
    ended_at: string | null
    call_sid: string | null
  } | null
  recording: {
    id: string
    recording_url: string
    duration_seconds: number | null
    transcript_json: any | null
    status: string | null
  } | null
  transcript: any | null
  translation: any | null
  manifest: any | null
  score: {
    score: number
    scorecard_id: string | null
    breakdown: any
  } | null
  survey: any | null
  transcriptionStatus: 'queued' | 'processing' | 'completed' | 'failed' | null
}

// Terminal states - stop polling when call reaches these
const TERMINAL_STATES = ['completed', 'failed', 'no-answer', 'busy', 'cancelled']

export function useCallDetails(callId: string | null) {
  const [details, setDetails] = useState<CallDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const fetchDetails = useCallback(async (isInitial = false) => {
    if (!callId) return null

    try {
      if (isInitial) {
        setLoading(true)
        setError(null)
      }

      // Fetch call details with Bearer token authentication
      try {
        const data = await apiGet(`/api/calls/${encodeURIComponent(callId)}`)
        if (mountedRef.current) setDetails(data)
        return data
      } catch (primaryError) {
        // Fallback to existing endpoint if new one doesn't exist
        try {
          const fallbackData = await apiGet(`/api/calls/getCallStatus?callId=${encodeURIComponent(callId)}`)
          const newDetails = {
            call: fallbackData.call || null,
            recording: fallbackData.recording || null,
            transcript: fallbackData.recording?.transcript_json || null,
            translation: null,
            manifest: fallbackData.evidence_manifest || null,
            score: null,
            survey: null,
            transcriptionStatus: null,
          }
          if (mountedRef.current) setDetails(newDetails)
          return newDetails
        } catch (fallbackError) {
          throw new Error('Failed to fetch call details')
        }
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message || 'Failed to load call details')
        setDetails(null)
      }
      return null
    } finally {
      if (isInitial && mountedRef.current) {
        setLoading(false)
      }
    }
  }, [callId])

  // Manual refetch function
  const refetch = useCallback(() => {
    return fetchDetails(true)
  }, [fetchDetails])

  // Initial fetch and polling setup
  useEffect(() => {
    mountedRef.current = true

    if (!callId) {
      setDetails(null)
      setLoading(false)
      return
    }

    // Initial fetch
    fetchDetails(true).then((data) => {
      // Start polling if call is not in a terminal state
      const status = data?.call?.status
      if (status && !TERMINAL_STATES.includes(status)) {
        pollingRef.current = setInterval(async () => {
          const updated = await fetchDetails(false)
          // Stop polling if call reaches terminal state
          if (updated?.call?.status && TERMINAL_STATES.includes(updated.call.status)) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
        }, 5000) // Poll every 5 seconds
      }
    })

    return () => {
      mountedRef.current = false
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [callId, fetchDetails])

  return {
    call: details?.call || null,
    recording: details?.recording || null,
    transcript: details?.transcript || null,
    translation: details?.translation || null,
    manifest: details?.manifest || null,
    score: details?.score || null,
    survey: details?.survey || null,
    transcriptionStatus: details?.transcriptionStatus || null,
    loading,
    error,
    refetch, // Manual refresh function
  }
}
