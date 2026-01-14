/**
 * Tier 1 Features Type Definitions
 * Per MASTER_ARCHITECTURE: Call is root object, all features are modulations
 * 
 * These types are normative: API responses must match exactly
 */

// ============================================================================
// CALL DISPOSITION
// ============================================================================

export type CallDisposition = 
  | 'sale'
  | 'no_answer'
  | 'voicemail'
  | 'not_interested'
  | 'follow_up'
  | 'wrong_number'
  | 'callback_scheduled'
  | 'other'

export interface CallDispositionUpdate {
  call_id: string
  disposition: CallDisposition
  disposition_notes?: string
}

export interface CallWithDisposition {
  id: string
  disposition: CallDisposition | null
  disposition_set_at: string | null
  disposition_set_by: string | null
  disposition_notes: string | null
}

// ============================================================================
// STRUCTURED CALL NOTES
// ============================================================================

export type CallNoteTag = 
  | 'objection_raised'
  | 'competitor_mentioned'
  | 'pricing_discussed'
  | 'escalation_required'
  | 'decision_maker_reached'
  | 'follow_up_needed'
  | 'compliance_issue'
  | 'quality_concern'
  | 'positive_feedback'
  | 'technical_issue'

export const CALL_NOTE_TAGS: readonly CallNoteTag[] = [
  'objection_raised',
  'competitor_mentioned',
  'pricing_discussed',
  'escalation_required',
  'decision_maker_reached',
  'follow_up_needed',
  'compliance_issue',
  'quality_concern',
  'positive_feedback',
  'technical_issue'
] as const

export const CALL_NOTE_TAG_LABELS: Record<CallNoteTag, string> = {
  objection_raised: 'Objection Raised',
  competitor_mentioned: 'Competitor Mentioned',
  pricing_discussed: 'Pricing Discussed',
  escalation_required: 'Escalation Required',
  decision_maker_reached: 'Decision Maker Reached',
  follow_up_needed: 'Follow-up Needed',
  compliance_issue: 'Compliance Issue',
  quality_concern: 'Quality Concern',
  positive_feedback: 'Positive Feedback',
  technical_issue: 'Technical Issue'
}

export interface CallNote {
  id: string
  call_id: string
  organization_id: string
  tags: CallNoteTag[]
  note: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CreateCallNoteRequest {
  call_id: string
  tags: CallNoteTag[]
  note?: string
}

// ============================================================================
// CONSENT TRACKING
// ============================================================================

export type ConsentMethod = 
  | 'ivr_played'
  | 'verbal_yes'
  | 'dtmf_confirm'
  | 'written'
  | 'assumed'
  | 'none'

export const CONSENT_METHOD_LABELS: Record<ConsentMethod, string> = {
  ivr_played: 'IVR Recording Notice Played',
  verbal_yes: 'Verbal Confirmation',
  dtmf_confirm: 'DTMF Key Press Confirmation',
  written: 'Written Consent on File',
  assumed: 'Assumed (One-Party State)',
  none: 'No Consent Obtained'
}

export interface CallConsent {
  consent_method: ConsentMethod | null
  consent_timestamp: string | null
  consent_audio_offset_ms: number | null
  consent_verified_by: string | null
  consent_verified_at: string | null
}

export interface ConsentCaptureRequest {
  call_id: string
  method: ConsentMethod
  audio_offset_ms?: number
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export type WebhookEventType = 
  | 'call.started'
  | 'call.answered'
  | 'call.completed'
  | 'call.failed'
  | 'call.disposition_set'
  | 'recording.available'
  | 'recording.transcribed'
  | 'transcript.completed'
  | 'translation.completed'
  | 'survey.completed'
  | 'scorecard.completed'
  | 'evidence.exported'

export const WEBHOOK_EVENT_TYPES: readonly WebhookEventType[] = [
  'call.started',
  'call.answered',
  'call.completed',
  'call.failed',
  'call.disposition_set',
  'recording.available',
  'recording.transcribed',
  'transcript.completed',
  'translation.completed',
  'survey.completed',
  'scorecard.completed',
  'evidence.exported'
] as const

export type WebhookRetryPolicy = 'none' | 'fixed' | 'exponential'

export type WebhookDeliveryStatus = 
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'retrying'

export interface WebhookSubscription {
  id: string
  organization_id: string
  name: string
  url: string
  secret: string
  events: WebhookEventType[]
  active: boolean
  retry_policy: WebhookRetryPolicy
  max_retries: number
  timeout_ms: number
  headers: Record<string, string>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateWebhookRequest {
  name: string
  url: string
  events: WebhookEventType[]
  headers?: Record<string, string>
  retry_policy?: WebhookRetryPolicy
  max_retries?: number
  timeout_ms?: number
}

export interface WebhookDelivery {
  id: string
  subscription_id: string
  event_type: WebhookEventType
  event_id: string
  payload: Record<string, unknown>
  status: WebhookDeliveryStatus
  attempts: number
  max_attempts: number
  next_retry_at: string | null
  response_status: number | null
  response_body: string | null
  response_time_ms: number | null
  last_error: string | null
  created_at: string
  delivered_at: string | null
}

export interface WebhookPayload {
  event: WebhookEventType
  event_id: string
  timestamp: string
  organization_id: string
  data: Record<string, unknown>
}

// ============================================================================
// FEATURE FLAGS / KILL SWITCHES
// ============================================================================

export type FeatureFlag = 
  | 'voice_operations'
  | 'recording'
  | 'transcription'
  | 'translation'
  | 'live_translation'
  | 'survey'
  | 'synthetic_caller'
  | 'secret_shopper'
  | 'ai_features'
  | 'webhooks'
  | 'api_access'
  | 'bulk_upload'
  | 'evidence_export'

export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  'voice_operations',
  'recording',
  'transcription',
  'translation',
  'live_translation',
  'survey',
  'synthetic_caller',
  'secret_shopper',
  'ai_features',
  'webhooks',
  'api_access',
  'bulk_upload',
  'evidence_export'
] as const

export const FEATURE_FLAG_LABELS: Record<FeatureFlag, string> = {
  voice_operations: 'Voice Operations',
  recording: 'Call Recording',
  transcription: 'Transcription',
  translation: 'Translation',
  live_translation: 'Live Translation',
  survey: 'After-Call Survey',
  synthetic_caller: 'Synthetic Caller',
  secret_shopper: 'Secret Shopper',
  ai_features: 'AI Features',
  webhooks: 'Webhooks',
  api_access: 'API Access',
  bulk_upload: 'Bulk Upload',
  evidence_export: 'Evidence Export'
}

export interface OrgFeatureFlag {
  id: string
  organization_id: string
  feature: FeatureFlag
  enabled: boolean
  disabled_reason: string | null
  disabled_at: string | null
  disabled_by: string | null
  daily_limit: number | null
  monthly_limit: number | null
  current_daily_usage: number
  current_monthly_usage: number
  usage_reset_at: string | null
  created_at: string
  updated_at: string
}

export interface FeatureFlagUpdate {
  feature: FeatureFlag
  enabled: boolean
  disabled_reason?: string
  daily_limit?: number | null
  monthly_limit?: number | null
}

export interface FeatureStatus {
  feature: FeatureFlag
  enabled: boolean
  reason?: string
  usage?: {
    daily: number
    daily_limit: number | null
    monthly: number
    monthly_limit: number | null
  }
}

// ============================================================================
// WEBRTC
// ============================================================================

export type WebRTCSessionStatus = 
  | 'initializing'
  | 'connecting'
  | 'connected'
  | 'on_call'
  | 'disconnected'
  | 'failed'

export interface WebRTCSession {
  id: string
  organization_id: string
  user_id: string
  call_id: string | null
  session_token: string
  signalwire_resource_id: string | null
  status: WebRTCSessionStatus
  ice_servers: RTCIceServer[] | null
  audio_bitrate: number | null
  packet_loss_percent: number | null
  jitter_ms: number | null
  round_trip_time_ms: number | null
  created_at: string
  connected_at: string | null
  disconnected_at: string | null
}

export interface WebRTCCredentials {
  session_id: string
  session_token: string
  ice_servers: RTCIceServer[]
  signalwire_project: string
  signalwire_token: string
}

export interface WebRTCCallRequest {
  to_number: string
  from_number?: string
  modulations?: {
    record?: boolean
    transcribe?: boolean
    translate?: boolean
    survey?: boolean
  }
}

// ============================================================================
// WEBRPC (Real-time Procedure Calls)
// ============================================================================

export type WebRPCMethod = 
  | 'call.place'
  | 'call.hangup'
  | 'call.mute'
  | 'call.unmute'
  | 'call.hold'
  | 'call.resume'
  | 'call.transfer'
  | 'call.dtmf'
  | 'session.ping'
  | 'session.end'

export interface WebRPCRequest {
  id: string
  method: WebRPCMethod
  params: Record<string, unknown>
}

export interface WebRPCResponse {
  id: string
  result?: Record<string, unknown>
  error?: {
    code: string
    message: string
    data?: unknown
  }
}

export interface WebRPCEvent {
  event: string
  data: Record<string, unknown>
  timestamp: string
}

// ============================================================================
// TIMELINE VIEW
// ============================================================================

export type TimelineEventType = 
  | 'call_started'
  | 'call_answered'
  | 'call_completed'
  | 'recording_started'
  | 'recording_completed'
  | 'transcript_started'
  | 'transcript_completed'
  | 'translation_completed'
  | 'survey_started'
  | 'survey_completed'
  | 'scorecard_generated'
  | 'note_added'
  | 'disposition_set'
  | 'evidence_exported'
  | 'consent_captured'

export interface TimelineEvent {
  id: string
  call_id: string
  event_type: TimelineEventType
  timestamp: string
  actor_id: string | null
  actor_name: string | null
  details: Record<string, unknown>
  metadata?: {
    duration_ms?: number
    status?: string
    artifact_id?: string
  }
}

export interface CallTimeline {
  call_id: string
  events: TimelineEvent[]
  summary: {
    total_events: number
    duration_ms: number
    has_recording: boolean
    has_transcript: boolean
    has_translation: boolean
    has_survey: boolean
    has_scorecard: boolean
    disposition: CallDisposition | null
  }
}
