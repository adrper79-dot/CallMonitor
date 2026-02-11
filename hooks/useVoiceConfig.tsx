'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import type { SurveyQuestionConfig } from '@/types/tier1-features'
import { apiGet, apiPut } from '@/lib/apiClient'

export interface VoiceConfig {
  // Database column names (what comes from API)
  record?: boolean
  transcribe?: boolean
  translate?: boolean
  translate_mode?: 'post_call' | 'live'
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
  // Voice-to-voice translation
  voice_to_voice?: boolean
  elevenlabs_voice_id?: string | null
  // AI Survey Bot fields
  survey_prompts?: string[]
  survey_question_types?: SurveyQuestionConfig[]
  survey_prompts_locales?: Record<string, string[]>
  survey_voice?: string
  survey_webhook_email?: string
  survey_inbound_number?: string
  // Quick dial - transient fields (not persisted to DB, session-only)
  quick_dial_number?: string | null // Target number to call
  from_number?: string | null // Agent's phone number for bridge calls
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

  // Load transient fields from localStorage
  const loadTransientFields = useCallback((): Partial<VoiceConfig> => {
    if (!organizationId) return {}
    try {
      const stored = localStorage.getItem(`voice-config-transient-${organizationId}`)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      // Validate that values are not empty strings
      const validated: Partial<VoiceConfig> = {}
      if (parsed.quick_dial_number && parsed.quick_dial_number !== '') {
        validated.quick_dial_number = parsed.quick_dial_number
      }
      if (parsed.from_number && parsed.from_number !== '') {
        validated.from_number = parsed.from_number
      }
      if (parsed.target_id && parsed.target_id !== '') {
        validated.target_id = parsed.target_id
      }
      if (parsed.campaign_id && parsed.campaign_id !== '') {
        validated.campaign_id = parsed.campaign_id
      }
      return validated
    } catch {
      return {}
    }
  }, [organizationId])

  // Save transient fields to localStorage
  const saveTransientFields = useCallback((fields: Partial<VoiceConfig>) => {
    if (!organizationId) return
    try {
      // Filter out null/undefined/empty string values before saving
      const filtered: any = {}
      if (fields.quick_dial_number) filtered.quick_dial_number = fields.quick_dial_number
      if (fields.from_number) filtered.from_number = fields.from_number
      if (fields.target_id) filtered.target_id = fields.target_id
      if (fields.campaign_id) filtered.campaign_id = fields.campaign_id
      localStorage.setItem(`voice-config-transient-${organizationId}`, JSON.stringify(filtered))
    } catch {
      // Ignore localStorage errors
    }
  }, [organizationId])

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
        const data = await apiGet(`/api/voice/config?orgId=${encodeURIComponent(organizationId)}`)
        // Merge with transient fields from localStorage
        setConfig((prev) => {
          const transientFields = loadTransientFields()
          return { ...(data.config || {}), ...transientFields }
        })
      } catch (err: any) {
        setError(err?.message || 'Failed to load config')
        setConfig(null)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [organizationId, loadTransientFields])

  const updateConfig = useCallback(
    async (updates: Partial<VoiceConfig>): Promise<VoiceConfig | null> => {
      if (!organizationId) {
        throw new Error('Organization ID required')
      }

      try {
        setError(null)

        // Transient fields are stored locally only, not sent to server
        // NOTE: target_id and campaign_id are transient because they don't exist in the DB schema
        const { quick_dial_number, from_number, target_id, campaign_id, ...persistentUpdates } =
          updates

        // Build transient updates object
        const transientUpdates: Pick<
          VoiceConfig,
          'quick_dial_number' | 'from_number' | 'target_id' | 'campaign_id'
        > = {}
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
          setConfig((prev) => {
            const newConfig = { ...(prev || {}), ...transientUpdates }
            // Save transient fields to localStorage
            saveTransientFields(newConfig)
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

        const data = await apiPut('/api/voice/config', {
          orgId: organizationId,
          modulations: mappedUpdates,
        })
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
    },
    [organizationId, config, saveTransientFields]
  )

  return (
    <VoiceConfigContext.Provider value={{ config, loading, error, updateConfig }}>
      {children}
    </VoiceConfigContext.Provider>
  )
}

export function useVoiceConfig(organizationId?: string | null) {
  const context = useContext(VoiceConfigContext)

  // Fallback state for components not wrapped in provider (backward compatibility)
  const [config, setConfig] = useState<VoiceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // If used within provider, return context (hooks already called above)
  const hasContext = context !== null

  useEffect(() => {
    // Skip fallback fetch if using context
    if (hasContext) return

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
        const data = await apiGet(`/api/voice/config?orgId=${encodeURIComponent(organizationId)}`)
        // Merge with transient fields from localStorage
        let transientFields = {}
        try {
          const stored = localStorage.getItem(`voice-config-transient-${organizationId}`)
          transientFields = stored ? JSON.parse(stored) : {}
        } catch {
          // Ignore localStorage errors
        }
        setConfig({ ...(data.config || {}), ...transientFields })
      } catch (err: any) {
        setError(err?.message || 'Failed to load config')
        setConfig(null)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [organizationId, hasContext])

  const updateConfig = useCallback(
    async (updates: Partial<VoiceConfig>): Promise<VoiceConfig | null> => {
      // If using context, delegate to context's updateConfig
      if (hasContext && context) {
        return context.updateConfig(updates)
      }

      if (!organizationId) {
        throw new Error('Organization ID required')
      }

      // Transient fields - not persisted to database
      const { quick_dial_number, from_number, target_id, campaign_id, ...persistentUpdates } =
        updates

      const transientUpdates: Pick<
        VoiceConfig,
        'quick_dial_number' | 'from_number' | 'target_id' | 'campaign_id'
      > = {}
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
        setConfig((prev) => {
          const newConfig = { ...(prev || {}), ...transientUpdates }
          // Save transient fields to localStorage
          try {
            localStorage.setItem(
              `voice-config-transient-${organizationId}`,
              JSON.stringify(newConfig)
            )
          } catch {
            // Ignore localStorage errors
          }
          return newConfig
        })
      }

      if (Object.keys(persistentUpdates).length === 0) {
        return { ...(config || {}), ...transientUpdates }
      }

      const mappedUpdates = mapFieldsToDb(persistentUpdates)

      const data = await apiPut('/api/voice/config', {
        orgId: organizationId,
        modulations: mappedUpdates,
      })
      const newConfig = {
        ...(data.config || {}),
        quick_dial_number: transientUpdates.quick_dial_number ?? config?.quick_dial_number,
        from_number: transientUpdates.from_number ?? config?.from_number,
        target_id: transientUpdates.target_id ?? config?.target_id,
        campaign_id: transientUpdates.campaign_id ?? config?.campaign_id,
      }
      setConfig(newConfig)
      return newConfig
    },
    [organizationId, config, hasContext, context]
  )

  // If using context, return context values
  if (hasContext && context) {
    return context
  }

  return { config, loading, error, updateConfig }
}
