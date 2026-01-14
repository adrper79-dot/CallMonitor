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
  // AI Survey Bot fields
  survey_prompts?: string[]
  survey_voice?: string
  survey_webhook_email?: string
  survey_inbound_number?: string
  // Quick dial (transient - not persisted to DB)
  quick_dial_number?: string | null
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
      
      // Separate transient fields (local-only) from persistent fields
      const { quick_dial_number, ...persistentUpdates } = updates
      
      // Update local state immediately for transient fields
      if ('quick_dial_number' in updates) {
        setConfig(prev => ({ ...prev, quick_dial_number }))
      }
      
      // If only transient fields changed, don't hit the server
      if (Object.keys(persistentUpdates).length === 0) {
        return { ...config, quick_dial_number }
      }
      
      // Map frontend field names to database column names
      const mappedUpdates = mapFieldsToDb(persistentUpdates)
      
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
      // Preserve transient fields when updating from server response
      const newConfig = { ...(data.config || {}), quick_dial_number: config?.quick_dial_number }
      setConfig(newConfig)
      return newConfig
    } catch (err: any) {
      setError(err?.message || 'Failed to update config')
      throw err
    }
  }

  return { config, loading, error, updateConfig }
}
