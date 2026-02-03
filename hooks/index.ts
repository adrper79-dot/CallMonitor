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

  CurrentCall
} from './useWebRTC'

// WebRTC Provider
export { WebRTCProvider, useWebRTCContext, useOptionalWebRTC } from './WebRTCProvider'

// Real-time updates
export { useRealtime, usePolling } from './useRealtime'

// Voice configuration
export { useVoiceConfig, VoiceConfigProvider } from './useVoiceConfig'
export type { VoiceConfig } from './useVoiceConfig'

// Call details
export { useCallDetails } from './useCallDetails'

// RBAC
export { useRBAC } from './useRBAC'
