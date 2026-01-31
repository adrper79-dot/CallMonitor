/**
 * Intent Action Types
 * 
 * ARCH_DOCS Compliance: "You initiate intent. We orchestrate execution."
 * (MASTER_ARCHITECTURE.txt)
 * 
 * Intent actions MUST be captured in audit_logs BEFORE execution begins.
 * The `action` field uses the `intent:` prefix to distinguish intent capture
 * from post-execution auditing.
 * 
 * AI_ROLE_POLICY.md: AI does NOT "Act as agent of intent" - humans declare
 * intent, systems execute.
 */

/**
 * All intent actions must start with 'intent:' prefix
 */
export const INTENT_PREFIX = 'intent:' as const

/**
 * Core intent actions for call lifecycle
 */
export const CallIntentActions = {
  /** User initiates a call (before SignalWire execution) */
  CALL_START: 'intent:call_start',
  /** User requests call termination */
  CALL_END: 'intent:call_end',
  /** User requests call hold */
  CALL_HOLD: 'intent:call_hold',
  /** User requests call transfer */
  CALL_TRANSFER: 'intent:call_transfer',
  /** User requests recording enable/disable */
  RECORDING_REQUESTED: 'intent:recording_requested',
} as const

/**
 * Intent actions for AI/ML operations
 */
export const AIIntentActions = {
  /** User/system requests transcription */
  TRANSCRIPTION_REQUESTED: 'intent:transcription_requested',
  /** User/system requests translation */
  TRANSLATION_REQUESTED: 'intent:translation_requested',
  /** User/system requests text-to-speech */
  TTS_REQUESTED: 'intent:tts_requested',
  /** User/system requests voice cloning */
  VOICE_CLONE_REQUESTED: 'intent:voice_clone_requested',
} as const

/**
 * Intent actions for configuration changes
 */
export const ConfigIntentActions = {
  /** User updates modulation settings */
  MODULATIONS_UPDATE: 'intent:modulations_update',
  /** User updates voice config */
  VOICE_CONFIG_UPDATE: 'intent:voice_config_update',
  /** User updates organization settings */
  ORG_SETTINGS_UPDATE: 'intent:org_settings_update',
} as const

/**
 * Intent actions for campaigns
 */
export const CampaignIntentActions = {
  /** User starts campaign execution */
  CAMPAIGN_START: 'intent:campaign_start',
  /** User pauses campaign */
  CAMPAIGN_PAUSE: 'intent:campaign_pause',
  /** User stops campaign */
  CAMPAIGN_STOP: 'intent:campaign_stop',
} as const

/**
 * All intent action types (union)
 */
export type IntentAction =
  | typeof CallIntentActions[keyof typeof CallIntentActions]
  | typeof AIIntentActions[keyof typeof AIIntentActions]
  | typeof ConfigIntentActions[keyof typeof ConfigIntentActions]
  | typeof CampaignIntentActions[keyof typeof CampaignIntentActions]

/**
 * Type guard to check if an action is an intent action
 */
export function isIntentAction(action: string): action is IntentAction {
  return action.startsWith(INTENT_PREFIX)
}

/**
 * Helper to create an intent audit log entry
 */
export interface IntentAuditEntry {
  organization_id: string
  user_id: string | null
  system_id: string | null
  resource_type: string
  resource_id: string | null
  action: IntentAction
  after: {
    declared_at: string
    [key: string]: unknown
  }
}
