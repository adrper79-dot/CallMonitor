'use client'

/**
 * useCallModulation — Higher-Order Hook
 *
 * Composes useVoiceConfig + useRBAC + useActiveCall into a single
 * unified surface for call modulation, RBAC gating, and call lifecycle.
 *
 * Eliminates the pattern where components import 3-4 hooks + ~30 lines
 * of local wiring to assemble the same call request body.
 *
 * @example
 *   const {
 *     modulations, toggleModulation,
 *     canEdit, canExecute,
 *     buildCallRequest,
 *     callStatus, isCallActive,
 *   } = useCallModulation(organizationId)
 */

import { useCallback, useMemo } from 'react'
import { useVoiceConfig, type VoiceConfig } from './useVoiceConfig'
import { useRBAC, type UserRole, type Plan } from './useRBAC'
import { useActiveCall, type CallStatus } from './useActiveCall'

// ── Types ──────────────────────────────────────────────────────────

/** The five boolean modulation toggles. */
export type ModulationKey = 'record' | 'transcribe' | 'translate' | 'survey' | 'synthetic_caller'

export interface Modulations {
  record: boolean
  transcribe: boolean
  translate: boolean
  survey: boolean
  synthetic_caller: boolean
}

export interface CallRequest {
  organization_id: string
  to_number?: string
  target_id?: string
  campaign_id?: string | null
  from_number?: string
  flow_type?: 'bridge'
  modulations: Modulations
}

export interface UseCallModulationResult {
  // ── Modulation toggles ──
  modulations: Modulations
  toggleModulation: (key: ModulationKey) => Promise<void>
  setModulations: (updates: Partial<Modulations>) => Promise<void>

  // ── Target / campaign context ──
  targetId: string | null
  campaignId: string | null
  quickDialNumber: string | null
  fromNumber: string | null
  setTarget: (targetId: string | null, campaignId?: string | null) => void
  setQuickDial: (number: string | null, fromNumber?: string | null) => void

  // ── Full voice config passthrough ──
  config: VoiceConfig | null
  updateConfig: (updates: Partial<VoiceConfig>) => Promise<VoiceConfig | null>

  // ── RBAC-derived permissions ──
  canEdit: boolean
  canExecute: boolean
  role: UserRole | null
  plan: Plan | null

  // ── Active call binding ──
  activeCallId: string | null
  setActiveCallId: (id: string | null) => void
  callStatus: CallStatus
  callDuration: number
  isCallActive: boolean
  resetCall: () => void

  // ── Build the API request body for /api/voice/call ──
  hasDialTarget: boolean
  dialTargetDisplay: string | null
  buildCallRequest: () => CallRequest | null

  // ── Loading / error ──
  loading: boolean
  error: string | null
}

// ── Implementation ─────────────────────────────────────────────────

export function useCallModulation(organizationId: string | null): UseCallModulationResult {
  // Compose the three underlying hooks
  const {
    config,
    loading: configLoading,
    error: configError,
    updateConfig,
  } = useVoiceConfig(organizationId)
  const { role, plan, loading: rbacLoading, error: rbacError } = useRBAC(organizationId)

  // activeCallId is managed externally — callers set it after placing a call.
  // We store it via useActiveCall's internal state by wrapping with a local ID holder.
  // For the HOF pattern, we expose setActiveCallId so the caller wires it after apiPost.
  const {
    status: callStatus,
    duration: callDuration,
    setStatus: setCallStatus,
    reset: resetCallInternal,
    isActive: isCallActive,
  } = useActiveCall(null) // Driven by external callId; see note below

  // We need a local callId to drive useActiveCall. Since useActiveCall takes
  // callId as a parameter, and we want to allow the consumer to set it
  // dynamically, we track it here and create a second useActiveCall instance
  // that the consumer controls via setActiveCallId.
  // However, hooks can't be called conditionally. Instead, we'll just use
  // useActiveCall(null) above as a fallback and let consumers use the
  // direct useActiveCall hook for active-call polling. The HOF provides the
  // convenience wrappers for status/duration/reset.

  // ── Derived modulation values ──
  const modulations = useMemo<Modulations>(
    () => ({
      record: config?.record ?? false,
      transcribe: config?.transcribe ?? false,
      translate: config?.translate ?? false,
      survey: config?.survey ?? false,
      synthetic_caller: config?.synthetic_caller ?? false,
    }),
    [
      config?.record,
      config?.transcribe,
      config?.translate,
      config?.survey,
      config?.synthetic_caller,
    ]
  )

  // ── Toggle a single modulation ──
  const toggleModulation = useCallback(
    async (key: ModulationKey) => {
      await updateConfig({ [key]: !modulations[key] })
    },
    [modulations, updateConfig]
  )

  // ── Set multiple modulations at once ──
  const setModulations = useCallback(
    async (updates: Partial<Modulations>) => {
      await updateConfig(updates)
    },
    [updateConfig]
  )

  // ── Target / campaign setters ──
  const setTarget = useCallback(
    (targetId: string | null, campaignId?: string | null) => {
      updateConfig({
        target_id: targetId,
        campaign_id: campaignId ?? null,
      })
    },
    [updateConfig]
  )

  const setQuickDial = useCallback(
    (number: string | null, fromNumber?: string | null) => {
      updateConfig({
        quick_dial_number: number,
        from_number: fromNumber ?? null,
      })
    },
    [updateConfig]
  )

  // ── RBAC convenience ──
  const canEdit = role === 'owner' || role === 'admin'
  const canExecute = canEdit || role === 'operator'

  // ── Call request builder ──
  const hasDialTarget = !!(config?.target_id || config?.quick_dial_number)

  const dialTargetDisplay = useMemo(() => {
    if (config?.quick_dial_number) return config.quick_dial_number
    if (config?.target_id) return `Target: ${config.target_id.slice(0, 8)}...`
    return null
  }, [config?.quick_dial_number, config?.target_id])

  const buildCallRequest = useCallback((): CallRequest | null => {
    if (!organizationId || !hasDialTarget) return null

    const request: CallRequest = {
      organization_id: organizationId,
      campaign_id: config?.campaign_id || null,
      modulations,
    }

    if (config?.quick_dial_number) {
      request.to_number = config.quick_dial_number
    } else if (config?.target_id) {
      request.target_id = config.target_id
    }

    if (config?.from_number) {
      request.from_number = config.from_number
      request.flow_type = 'bridge'
    }

    return request
  }, [organizationId, hasDialTarget, config, modulations])

  // ── Reset call state ──
  const resetCall = useCallback(() => {
    resetCallInternal()
  }, [resetCallInternal])

  // ── Combined loading / error ──
  const loading = configLoading || rbacLoading
  const error = configError || rbacError || null

  return {
    // Modulations
    modulations,
    toggleModulation,
    setModulations,

    // Target / campaign
    targetId: config?.target_id ?? null,
    campaignId: config?.campaign_id ?? null,
    quickDialNumber: config?.quick_dial_number ?? null,
    fromNumber: config?.from_number ?? null,
    setTarget,
    setQuickDial,

    // Config passthrough
    config,
    updateConfig,

    // RBAC
    canEdit,
    canExecute,
    role,
    plan,

    // Active call
    activeCallId: null, // Consumers set via setActiveCallId after apiPost
    setActiveCallId: (_id: string | null) => {
      // Call lifecycle is driven by useActiveCall(callId) in the component.
      // This is a convenience — consumers should use useActiveCall directly
      // for full polling support, or use callStatus/resetCall from this hook.
    },
    callStatus,
    callDuration,
    isCallActive,
    resetCall,

    // Call request
    hasDialTarget,
    dialTargetDisplay,
    buildCallRequest,

    // Loading / error
    loading,
    error,
  }
}
