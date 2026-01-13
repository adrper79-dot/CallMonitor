"use client"

import { useState, useEffect } from 'react'

export interface VoiceConfig {
  // Database column names (what comes from API)
  record?: boolean
  transcribe?: boolean
  translate?: boolean
  translate_from?: string
  translate_to?: string
  survey?: boolean
  synthetic_caller?: boolean
  // Additional fields
  survey_id?: string | null
  script_id?: string | null
  target_id?: string | null
  campaign_id?: string | null
  // Voice cloning
  use_voice_cloning?: boolean
  cloned_voice_id?: string | null
}

// Map frontend-friendly names to database column names
const FIELD_MAP: Record<string, string> = {
  recording_enabled: 'record',
  transcription_enabled: 'transcribe',
  translation_enabled: 'translate',
  translation_from: 'translate_from',
  translation_to: 'translate_to',
  survey_enabled: 'survey',
  secret_shopper_enabled: 'synthetic_caller',
}

function mapFieldsToDb(updates: Record<string, any>): Record<string, any> {
  const mapped: Record<string, any> = {}
  for (const [key, value] of Object.entries(updates)) {
    const dbKey = FIELD_MAP[key] || key
    mapped[dbKey] = value
  }
  return mapped
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
      if (!organizationId) return // Guard for TypeScript
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/voice/config?orgId=${encodeURIComponent(organizationId)}`, {
          credentials: 'include' // CRITICAL: Include session cookies for auth
        })
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
      // Map frontend field names to database column names
      const mappedUpdates = mapFieldsToDb(updates)
      
      const res = await fetch('/api/voice/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // CRITICAL: Include session cookies for auth
        body: JSON.stringify({
          orgId: organizationId,
          modulations: mappedUpdates,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update config' }))
        throw new Error(errorData.error?.message || errorData.error || 'Failed to update config')
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
