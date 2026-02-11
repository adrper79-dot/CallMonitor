/**
 * Hooks Index
 *
 * Re-exports all hooks for cleaner imports.
 * Usage: import { useWebRTC, useRealtime, useVoiceConfig } from '@/hooks'
 */

// WebRTC - Browser-based calling
export { useWebRTC } from './useWebRTC'
export type {
  WebRTCStatus,
  CallState,
  WebRTCSession,
  CallQuality,
  UseWebRTCResult,
  CurrentCall,
} from './useWebRTC'

// WebRTC Provider
export { WebRTCProvider, useWebRTCContext, useOptionalWebRTC } from './WebRTCProvider'

// Real-time updates
export { useRealtime, usePolling, RealtimeProvider } from './useRealtime'

// Voice configuration
export { useVoiceConfig, VoiceConfigProvider } from './useVoiceConfig'
export type { VoiceConfig } from './useVoiceConfig'

// Call details
export { useCallDetails } from './useCallDetails'

// RBAC
export { useRBAC } from './useRBAC'

// Call Modulation (Higher-Order Hook)
export { useCallModulation } from './useCallModulation'
export type {
  ModulationKey,
  Modulations,
  CallRequest,
  UseCallModulationResult,
} from './useCallModulation'

// API Query Hook - Universal data fetching
export { useApiQuery } from './useApiQuery'
export type { UseApiQueryResult } from './useApiQuery'

// SSE Hook - Server-Sent Events streaming
export { useSSE } from './useSSE'
export type { UseSSEResult } from './useSSE'
