"use client"

import { useState, useEffect } from 'react'

export interface VoiceConfig {
  recording_enabled?: boolean
  transcription_enabled?: boolean
  translation_enabled?: boolean
  translation_from?: string
  translation_to?: string
  survey_enabled?: boolean
  survey_id?: string | null
  secret_shopper_enabled?: boolean
  script_id?: string | null
  target_id?: string | null
  campaign_id?: string | null
}

export function useVoiceConfig(organizationId: string | null) {
  const [config, setConfig] = useState<VoiceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) {
      setConfig(null)
      setLoading(false)
      return
    }

    async function fetchConfig() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/voice/config?orgId=${encodeURIComponent(organizationId)}`)
        if (!res.ok) {
          throw new Error('Failed to fetch voice config')
        }
        const data = await res.json()
        setConfig(data.config || {})
      } catch (err: any) {
        setError(err?.message || 'Failed to load config')
        setConfig(null)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [organizationId])

  async function updateConfig(updates: Partial<VoiceConfig>) {
    if (!organizationId) {
      throw new Error('Organization ID required')
    }

    try {
      setError(null)
      const res = await fetch('/api/voice/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: organizationId,
          ...updates,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update config' }))
        throw new Error(errorData.error || 'Failed to update config')
      }

      const data = await res.json()
      setConfig(data.config || {})
      return data.config
    } catch (err: any) {
      setError(err?.message || 'Failed to update config')
      throw err
    }
  }

  return { config, loading, error, updateConfig }
}
