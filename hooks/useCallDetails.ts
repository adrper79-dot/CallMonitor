"use client"

import { useState, useEffect } from 'react'

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
}

export function useCallDetails(callId: string | null) {
  const [details, setDetails] = useState<CallDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!callId) {
      setDetails(null)
      setLoading(false)
      return
    }

    async function fetchDetails() {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch call details - may need to create this endpoint
        const res = await fetch(`/api/calls/${encodeURIComponent(callId)}`)
        if (!res.ok) {
          // Fallback to existing endpoint if new one doesn't exist
          const fallbackRes = await fetch(`/api/calls/getCallStatus?callId=${encodeURIComponent(callId)}`)
          if (!fallbackRes.ok) {
            throw new Error('Failed to fetch call details')
          }
          const fallbackData = await fallbackRes.json()
          setDetails({
            call: fallbackData.call || null,
            recording: fallbackData.recording || null,
            transcript: fallbackData.recording?.transcript_json || null,
            translation: null,
            manifest: fallbackData.evidence_manifest || null,
            score: null,
            survey: null,
          })
          return
        }
        
        const data = await res.json()
        setDetails(data)
      } catch (err: any) {
        setError(err?.message || 'Failed to load call details')
        setDetails(null)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [callId])

  return {
    call: details?.call || null,
    recording: details?.recording || null,
    transcript: details?.transcript || null,
    translation: details?.translation || null,
    manifest: details?.manifest || null,
    score: details?.score || null,
    survey: details?.survey || null,
    loading,
    error,
  }
}
