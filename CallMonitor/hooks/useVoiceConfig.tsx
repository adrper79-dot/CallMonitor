"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { SurveyQuestionConfig } from '@/types/tier1-features'

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
  survey_question_types?: SurveyQuestionConfig[]
  survey_prompts_locales?: Record<string, string[]>
  survey_voice?: string
  survey_webhook_email?: string
  survey_inbound_number?: string
  // Quick dial - transient fields (not persisted to DB, session-only)
  quick_dial_number?: string | null  // Target number to call
  from_number?: string | null         // Agent's phone number for bridge calls
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

interface VoiceConfigContextType {
  config: VoiceConfig | null
  loading: boolean
  error: string | null
  updateConfig: (updates: Partial<VoiceConfig>) => Promise<VoiceConfig | null>
}

const VoiceConfigContext = createContext<VoiceConfigContextType | null>(null)

interface VoiceConfigProviderProps {
  organizationId: string | null
  children: ReactNode
}

export function VoiceConfigProvider({ organizationId, children }: VoiceConfigProviderProps) {
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
      if (!organizationId) return
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/voice/config?orgId=${encodeURIComponent(organizationId)}`, {
          credentials: 'include'
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

  const updateConfig = useCallback(async (updates: Partial<VoiceConfig>): Promise<VoiceConfig | null> => {
    if (!organizationId) {
      throw new Error('Organization ID required')
    }

    try {
      setError(null)
      
      // Transient fields are stored locally only, not sent to server
      // NOTE: target_id and campaign_id are transient because they don't exist in the DB schema
      const { quick_dial_number, from_number, target_id, campaign_id, ...persistentUpdates } = updates
      
      // Build transient updates object
      const transientUpdates: Pick<VoiceConfig, 'quick_dial_number' | 'from_number' | 'target_id' | 'campaign_id'> = {}
      if ('quick_dial_number' in updates) {
        transientUpdates.quick_dial_number = quick_dial_number
      }
      if ('from_number' in updates) {
        transientUpdates.from_number = from_number
      }
      if ('target_id' in updates) {
        transientUpdates.target_id = target_id
      }
      if ('campaign_id' in updates) {
        transientUpdates.campaign_id = campaign_id
      }
      
      // Update local state immediately for transient fields (synchronous update)
      if (Object.keys(transientUpdates).length > 0) {
        setConfig(prev => {
          const newConfig = { ...(prev || {}), ...transientUpdates }
          return newConfig
        })
      }
      
      // If only transient fields changed, return immediately
      if (Object.keys(persistentUpdates).length === 0) {
        // Return current config with transient updates
        return { ...(config || {}), ...transientUpdates }
      }
      
      // Map frontend field names to database column names
      const mappedUpdates = mapFieldsToDb(persistentUpdates)
      
      const res = await fetch('/api/voice/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      const newConfig = { 
        ...(data.config || {}), 
        quick_dial_number: transientUpdates.quick_dial_number ?? config?.quick_dial_number,
        from_number: transientUpdates.from_number ?? config?.from_number,
        target_id: transientUpdates.target_id ?? config?.target_id,
        campaign_id: transientUpdates.campaign_id ?? config?.campaign_id,
      }
      setConfig(newConfig)
      return newConfig
    } catch (err: any) {
      setError(err?.message || 'Failed to update config')
      throw err
    }
  }, [organizationId, config])

  return (
    <VoiceConfigContext.Provider value={{ config, loading, error, updateConfig }}>
      {children}
    </VoiceConfigContext.Provider>
  )
}

export function useVoiceConfig(organizationId?: string | null) {
  const context = useContext(VoiceConfigContext)
  
  // If used within provider, return context
  if (context) {
    return context
  }
  
  // Fallback for components not wrapped in provider (backward compatibility)
  // This creates isolated state - not recommended but prevents breaking existing code
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
      if (!organizationId) return
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/voice/config?orgId=${encodeURIComponent(organizationId)}`, {
          credentials: 'include'
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

  const updateConfig = useCallback(async (updates: Partial<VoiceConfig>): Promise<VoiceConfig | null> => {
    if (!organizationId) {
      throw new Error('Organization ID required')
    }

    // Transient fields - not persisted to database
    const { quick_dial_number, from_number, target_id, campaign_id, ...persistentUpdates } = updates
    
    const transientUpdates: Pick<VoiceConfig, 'quick_dial_number' | 'from_number' | 'target_id' | 'campaign_id'> = {}
    if ('quick_dial_number' in updates) {
      transientUpdates.quick_dial_number = quick_dial_number
    }
    if ('from_number' in updates) {
      transientUpdates.from_number = from_number
    }
    if ('target_id' in updates) {
      transientUpdates.target_id = target_id
    }
    if ('campaign_id' in updates) {
      transientUpdates.campaign_id = campaign_id
    }
    
    if (Object.keys(transientUpdates).length > 0) {
      setConfig(prev => ({ ...(prev || {}), ...transientUpdates }))
    }
    
    if (Object.keys(persistentUpdates).length === 0) {
      return { ...(config || {}), ...transientUpdates }
    }
    
    const mappedUpdates = mapFieldsToDb(persistentUpdates)
    
    const res = await fetch('/api/voice/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
    const newConfig = { 
      ...(data.config || {}), 
      quick_dial_number: transientUpdates.quick_dial_number ?? config?.quick_dial_number,
      from_number: transientUpdates.from_number ?? config?.from_number,
      target_id: transientUpdates.target_id ?? config?.target_id,
      campaign_id: transientUpdates.campaign_id ?? config?.campaign_id,
    }
    setConfig(newConfig)
    return newConfig
  }, [organizationId, config])

  return { config, loading, error, updateConfig }
}
