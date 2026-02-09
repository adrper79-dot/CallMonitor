/**
 * Zod Validation Schemas — Central Schema Registry
 *
 * All request body schemas for Workers API routes.
 * ARCH_DOCS compliance: H1 — Zero-trust input validation on all POST/PUT/PATCH endpoints.
 *
 * Usage in route:
 *   import { validateBody } from '../lib/validate'
 *   import { SignupSchema } from '../lib/schemas'
 *
 *   route.post('/signup', async (c) => {
 *     const parsed = await validateBody(c, SignupSchema)
 *     if (!parsed.success) return c.json({ error: parsed.error }, 400)
 *     const { email, password } = parsed.data
 *     ...
 *   })
 *
 * OpenAPI Support:
 *   Schemas are enhanced with .describe() for OpenAPI documentation generation.
 *   See scripts/generate-openapi.ts for API doc generation.
 */

import { z } from 'zod'

// ─── Shared Primitives ──────────────────────────────────────────────────────

const uuid = z.string().uuid()
const email = z
  .string()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase())
const e164Phone = z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format (e.g. +15551234567)')
const nonEmptyString = z.string().min(1).max(10_000)

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const ValidateKeySchema = z.object({
  apiKey: nonEmptyString,
})

export const SignupSchema = z.object({
  email,
  password: z.string().min(8).max(128),
  name: z.string().max(100).optional(),
  organizationName: z.string().max(200).optional(),
  csrf_token: z.string().uuid().optional(),
  csrfToken: z.string().uuid().optional(),
})

export const LoginSchema = z
  .object({
    // Accept both username and email for backwards compat
    username: z.string().max(254).optional(),
    email: z.string().email().max(254).optional(),
    password: z.string().min(1).max(128),
    csrf_token: z.string().uuid().optional(),
    csrfToken: z.string().uuid().optional(),
  })
  .refine((data) => data.username || data.email, {
    message: 'Either username or email is required',
  })

export const ForgotPasswordSchema = z.object({
  email,
  csrf_token: z.string().uuid().optional(),
  csrfToken: z.string().uuid().optional(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1).max(256),
  password: z.string().min(8).max(128),
})

// ─── Calls Schemas ───────────────────────────────────────────────────────────

export const StartCallSchema = z.object({
  phone_number: e164Phone,
  caller_id: z.string().max(50).optional(),
  system_id: uuid.optional(),
})

const OUTCOME_STATUSES = [
  'agreed',
  'declined',
  'partial',
  'inconclusive',
  'follow_up_required',
  'cancelled',
] as const

const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'uncertain'] as const
const SUMMARY_SOURCES = ['human', 'ai_generated', 'ai_confirmed'] as const

export const CallOutcomeSchema = z.object({
  outcome_status: z.enum(OUTCOME_STATUSES),
  confidence_level: z.enum(CONFIDENCE_LEVELS).default('high'),
  agreed_items: z.array(z.string().max(1000)).default([]),
  declined_items: z.array(z.string().max(1000)).default([]),
  ambiguities: z.array(z.string().max(1000)).default([]),
  follow_up_actions: z.array(z.string().max(1000)).default([]),
  summary_text: z.string().max(50_000).default(''),
  summary_source: z.enum(SUMMARY_SOURCES).default('human'),
  readback_confirmed: z.boolean().default(false),
})

export const CallOutcomeUpdateSchema = CallOutcomeSchema.partial()

export const GenerateSummarySchema = z.object({
  use_call_transcript: z.boolean().default(true),
  include_structured_extraction: z.boolean().default(true),
  custom_transcript: z.string().max(100_000).optional(),
})

export const CallNoteSchema = z.object({
  content: nonEmptyString.refine((v) => v.trim().length > 0, 'Note content cannot be blank'),
})

export const DispositionSchema = z.object({
  disposition: nonEmptyString,
  disposition_notes: z.string().max(5000).optional(),
})

export const ConfirmationSchema = z.object({
  confirmation_type: nonEmptyString,
  details: z.record(z.string(), z.unknown()).optional(),
  confirmed_by: uuid.optional(),
})

export const EmailCallSchema = z.object({
  recipients: z.array(z.string().email().max(254)).min(1).max(50),
})

// ─── Voice Schemas ───────────────────────────────────────────────────────────

export const VoiceConfigSchema = z.object({
  orgId: z.string().max(100).optional(),
  modulations: z
    .object({
      record: z.boolean().optional(),
      transcribe: z.boolean().optional(),
      translate: z.boolean().optional(),
      translate_mode: z.enum(['post_call', 'live']).optional(),
      translate_from: z.string().max(10).optional(),
      translate_to: z.string().max(10).optional(),
      survey: z.boolean().optional(),
      synthetic_caller: z.boolean().optional(),
      use_voice_cloning: z.boolean().optional(),
      live_translate: z.boolean().optional(),
    })
    .optional(),
})

export const CreateCallSchema = z.object({
  to_number: e164Phone.optional(),
  from_number: z.string().max(50).nullable().optional(),
  organization_id: uuid.optional(),
  target_id: z.string().max(200).nullable().optional(),
  campaign_id: z.string().max(200).nullable().optional(),
  modulations: z.record(z.string(), z.unknown()).optional(),
  flow_type: z.string().max(50).optional(),
})

export const VoiceTargetSchema = z.object({
  organization_id: uuid.optional(),
  phone_number: e164Phone,
  name: z.string().max(200).optional(),
})

// ─── Team Schemas ────────────────────────────────────────────────────────────

export const CreateTeamSchema = z.object({
  name: nonEmptyString.refine((v) => v.trim().length > 0, 'Team name cannot be blank'),
  description: z.string().max(2000).optional(),
  team_type: z.string().max(50).default('department'),
  parent_team_id: z.string().uuid().optional().nullable(),
  manager_user_id: z.string().uuid().optional().nullable(),
})

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  team_type: z.string().max(50).optional(),
  parent_team_id: z.string().uuid().optional().nullable(),
  manager_user_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

export const AddTeamMemberSchema = z.object({
  user_id: uuid,
  team_role: z.string().max(50).default('member'),
})

export const SwitchOrgSchema = z.object({
  organization_id: uuid,
})

export const UpdateRoleSchema = z.object({
  role: z.enum(['viewer', 'agent', 'manager', 'compliance', 'admin', 'owner']),
})

export const InviteMemberSchema = z.object({
  email,
  role: z.enum(['viewer', 'agent', 'manager', 'compliance', 'admin']).default('viewer'),
})

export const AddMemberSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['viewer', 'agent', 'manager', 'compliance', 'admin', 'owner']).default('viewer'),
})

// ─── Bookings Schemas ────────────────────────────────────────────────────────

export const CreateBookingSchema = z.object({
  title: nonEmptyString,
  call_id: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).optional(),
  start_time: z.string().max(50),
  end_time: z.string().max(50),
  duration_minutes: z.number().int().min(1).max(480).default(30),
  attendee_name: z.string().max(200).optional(),
  attendee_email: z.string().email().max(254).optional(),
  attendee_phone: z.string().max(30),
  from_number: z.string().max(30).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).default('pending'),
})

export const UpdateBookingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  start_time: z.string().max(50).optional(),
  end_time: z.string().max(50).optional(),
  duration_minutes: z.number().int().min(1).max(480).optional(),
  attendee_name: z.string().max(200).optional(),
  attendee_email: z.string().email().max(254).optional(),
  attendee_phone: z.string().max(30).optional(),
  from_number: z.string().max(30).optional().nullable(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
})

// ─── Surveys Schemas ─────────────────────────────────────────────────────────

const SurveyQuestionSchema = z.object({
  id: z.string().max(100).optional(),
  type: z.enum(['text', 'rating', 'multiple_choice', 'boolean', 'scale']).default('text'),
  question: z.string().max(2000),
  options: z.array(z.string().max(500)).optional(),
  required: z.boolean().optional(),
})

export const CreateSurveySchema = z.object({
  title: nonEmptyString,
  description: z.string().max(5000).optional().nullable(),
  questions: z.array(SurveyQuestionSchema).default([]),
  active: z.boolean().default(true),
  trigger_type: z.string().max(50).default('post_call'),
})

// ─── Retention Schemas ───────────────────────────────────────────────────────

export const UpdateRetentionSchema = z.object({
  recording_retention_days: z.number().int().min(1).max(3650).optional(),
  transcript_retention_days: z.number().int().min(1).max(3650).optional(),
  call_log_retention_days: z.number().int().min(1).max(3650).optional(),
  auto_delete_enabled: z.boolean().optional(),
  gdpr_mode: z.boolean().optional(),
})

export const CreateLegalHoldSchema = z.object({
  name: nonEmptyString.refine((v) => v.trim().length > 0, 'Legal hold name cannot be blank'),
  matter_reference: z.string().max(500).optional().nullable(),
  applies_to_all: z.boolean().default(false),
})

// ─── AI Config Schemas ───────────────────────────────────────────────────────

export const UpdateAIConfigSchema = z.object({
  enabled: z.boolean().optional(),
  model: z.string().max(50).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(128_000).optional(),
  system_prompt: z.string().max(50_000).optional(),
  sentiment_analysis: z.boolean().optional(),
  auto_summarize: z.boolean().optional(),
  language: z.string().max(10).optional(),
})

// ─── Billing Schemas ─────────────────────────────────────────────────────────

export const CheckoutSchema = z.object({
  priceId: z.string().min(1).max(200).startsWith('price_'),
  planId: z.string().max(200).optional(),
  returnUrl: z.string().url().max(2000).optional(),
})

/** Change plan: same fields as Checkout minus returnUrl */
export const ChangePlanSchema = z.object({
  priceId: z.string().min(1).max(200).startsWith('price_'),
  planId: z.string().max(200).optional(),
})

// ─── Organization Schemas ────────────────────────────────────────────────────

export const CreateOrgSchema = z.object({
  name: nonEmptyString.refine((v) => v.trim().length > 0, 'Organization name cannot be blank'),
})

// ─── Caller ID Schemas ───────────────────────────────────────────────────────

export const AddCallerIdSchema = z.object({
  phone_number: e164Phone,
  label: z.string().max(100).optional(),
})

export const VerifyCallerIdSchema = z.object({
  phone_number: z.string().min(1, 'Phone number is required'),
  code: z.string().min(1, 'Verification code is required'),
})

// ─── WebRTC Schema ───────────────────────────────────────────────────────────

export const WebRTCDialSchema = z.object({
  phone_number: z.string().min(1, 'Phone number required'),
})

// ─── Campaigns Schemas ───────────────────────────────────────────────────────

export const CreateCampaignSchema = z.object({
  name: nonEmptyString,
  description: z.string().max(2000).optional(),
  scenario: z.string().max(50_000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft'),
})

export const UpdateCampaignSchema = CreateCampaignSchema.partial()

// ─── Bond AI Schemas ─────────────────────────────────────────────────────────

export const AnalyzeCallSchema = z.object({
  title: z.string().max(200).optional(),
  context_type: z.string().max(100).optional(),
  context_id: z.string().max(200).optional(),
  model: z.string().max(50).default('gpt-4o-mini'),
})

export const ChatSchema = z.object({
  message: nonEmptyString,
  conversation_id: uuid.optional(),
  context_type: z.string().max(100).optional(),
  context_id: z.string().max(200).optional(),
})

export const UpdateInsightSchema = z.object({
  status: z.enum(['read', 'acknowledged', 'dismissed']),
})

export const BulkInsightSchema = z.object({
  alert_ids: z.array(uuid).min(1).max(100),
  action: z.enum(['read', 'acknowledged', 'dismissed']),
})

export const CreateAlertRuleSchema = z.object({
  name: nonEmptyString,
  description: z.string().max(2000).optional(),
  rule_type: nonEmptyString,
  rule_config: z.record(z.string(), z.unknown()).optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  notification_channels: z.array(z.string().max(50)).default(['in_app']),
  cooldown_minutes: z.number().int().min(1).max(10080).default(60),
})

export const UpdateAlertRuleSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  rule_config: z.record(z.string(), z.unknown()).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  is_enabled: z.boolean().optional(),
  notification_channels: z.array(z.string().max(50)).optional(),
  cooldown_minutes: z.number().int().min(1).max(10080).optional(),
})

export const CopilotSchema = z
  .object({
    call_id: z.string().max(200).optional(),
    transcript_segment: z.string().max(50_000).optional(),
    agent_question: z.string().max(5000).optional(),
    scorecard_id: z.string().max(200).optional(),
  })
  .refine((d) => d.agent_question?.trim() || d.transcript_segment?.trim(), {
    message: 'Either agent_question or transcript_segment is required',
  })

// ─── Reports Schemas ─────────────────────────────────────────────────────────

export const GenerateReportSchema = z.object({
  name: nonEmptyString,
  type: z.string().max(50).default('call_volume'),
  filters: z.record(z.string(), z.unknown()).optional(),
  metrics: z.array(z.unknown()).optional(),
  format: z.enum(['pdf', 'csv', 'json']).default('pdf'),
})

export const ScheduleReportSchema = z.object({
  name: nonEmptyString,
  report_type: z.string().max(50).default('call_volume'),
  cron_pattern: z.string().max(100).default('0 8 * * 1'),
  delivery_emails: z.array(z.string().email().max(254)).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  format: z.string().max(20).default('pdf'),
})

export const UpdateScheduleSchema = z.object({
  is_active: z.boolean().optional(),
  name: z.string().max(200).optional(),
  cron_pattern: z.string().max(100).optional(),
  delivery_emails: z.array(z.string().email().max(254)).optional(),
})

// ─── Webhooks Schemas ────────────────────────────────────────────────────────

export const CreateWebhookSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(z.string().max(100)).min(1),
  secret: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
})

export const UpdateWebhookSchema = z.object({
  url: z.string().url().max(2000).optional(),
  events: z.array(z.string().max(100)).optional(),
  is_active: z.boolean().optional(),
  description: z.string().max(500).optional(),
})

// ─── Scorecards Schemas ──────────────────────────────────────────────────────

export const CreateScorecardSchema = z.object({
  call_id: uuid.optional(),
  template_id: z.string().max(200).optional(),
  scores: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(10_000).optional(),
  overall_score: z.number().min(0).max(100).optional(),
})

// ─── Shopper (Scripts) Schemas ────────────────────────────────────────────────

export const CreateShopperSchema = z.object({
  id: uuid.optional(),
  name: nonEmptyString,
  content: z.string().max(50_000).optional(),
  scenario: z.string().max(10_000).optional(),
  is_active: z.boolean().default(true),
})

export const UpdateShopperSchema = z.object({
  name: z.string().max(200).optional(),
  content: z.string().max(50_000).optional(),
  scenario: z.string().max(10_000).optional(),
  is_active: z.boolean().optional(),
})

export const DeleteShopperByIdSchema = z.object({
  id: uuid,
})

// ─── Admin (Auth Providers) Schemas ──────────────────────────────────────────

export const UpdateAuthProviderSchema = z.object({
  provider: nonEmptyString,
  enabled: z.boolean().optional(),
  client_id: z.string().max(500).optional().nullable(),
  client_secret: z.string().max(500).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional(),
})

// ─── Reliability Schemas ─────────────────────────────────────────────────────

export const WebhookActionSchema = z.object({
  failure_id: z.string().uuid(),
  action: z.enum(['retry', 'discard', 'manual_review']),
  resolution_notes: z.string().max(5000).optional(),
})

// ─── TTS Schemas ─────────────────────────────────────────────────────────────

export const TTSGenerateSchema = z.object({
  text: nonEmptyString,
  voice_id: z.string().max(100).optional(),
  language: z.string().max(10).optional(),
  organization_id: z.string().uuid().optional(),
})

// ─── Audio Schemas ───────────────────────────────────────────────────────────

export const TranscribeSchema = z
  .object({
    audio_file_id: z.string().uuid().optional().nullable(),
    file_key: z.string().max(500).optional().nullable(),
    language: z.string().max(10).optional(),
  })
  .refine((d) => d.audio_file_id || d.file_key, {
    message: 'Either audio_file_id or file_key is required',
  })

// ─── Compliance Schemas ──────────────────────────────────────────────────────

export const LogComplianceViolationSchema = z.object({
  call_id: z.string().uuid().optional().nullable(),
  restriction_code: z.enum([
    'QA_NO_CONFIRMATIONS',
    'QA_NO_OUTCOMES',
    'QA_NO_AGREEMENTS',
    'SURVEY_NO_AGREEMENTS',
    'AI_NO_NEGOTIATION',
  ]),
  violation_type: z.enum(['blocked', 'warned', 'detected', 'prevented']),
  context: z.record(z.string(), z.unknown()).optional(),
})

export const ResolveComplianceViolationSchema = z.object({
  resolution_status: z.enum(['open', 'reviewed', 'dismissed', 'confirmed']),
  resolution_notes: z.string().max(5000).optional(),
})

// ─── Collections CRM Schemas ────────────────────────────────────────────────

export const CreateCollectionAccountSchema = z.object({
  external_id: z.string().max(200).optional().nullable(),
  source: z.string().max(50).default('manual'),
  name: nonEmptyString,
  balance_due: z.number().min(0).max(99_999_999.99),
  primary_phone: e164Phone,
  secondary_phone: e164Phone.optional().nullable(),
  email: z.string().email().max(254).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'paid', 'partial', 'disputed', 'archived']).default('active'),
  notes: z.string().max(5000).optional().nullable(),
  promise_date: z.string().max(20).optional().nullable(),
  promise_amount: z.number().min(0).max(99_999_999.99).optional().nullable(),
})

export const UpdateCollectionAccountSchema = z.object({
  name: z.string().min(1).max(10_000).optional(),
  balance_due: z.number().min(0).max(99_999_999.99).optional(),
  primary_phone: e164Phone.optional(),
  secondary_phone: e164Phone.optional().nullable(),
  email: z.string().email().max(254).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'paid', 'partial', 'disputed', 'archived']).optional(),
  notes: z.string().max(5000).optional().nullable(),
  promise_date: z.string().max(20).optional().nullable(),
  promise_amount: z.number().min(0).max(99_999_999.99).optional().nullable(),
  last_contacted_at: z.string().datetime().optional().nullable(),
})

export const CreateCollectionPaymentSchema = z.object({
  account_id: uuid,
  amount: z.number().positive().max(99_999_999.99),
  method: z.enum(['stripe', 'cash', 'check', 'transfer', 'other']).default('other'),
  stripe_payment_id: z.string().max(200).optional().nullable(),
  reference_number: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export const CreateCollectionTaskSchema = z.object({
  account_id: uuid,
  type: z.enum(['followup', 'promise', 'payment', 'review', 'escalation']).default('followup'),
  title: nonEmptyString,
  notes: z.string().max(5000).optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
})

export const UpdateCollectionTaskSchema = z.object({
  title: z.string().min(1).max(10_000).optional(),
  notes: z.string().max(5000).optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
})

export const CollectionCsvImportSchema = z.object({
  file_name: nonEmptyString,
  accounts: z
    .array(CreateCollectionAccountSchema.omit({ source: true }))
    .min(1)
    .max(10_000),
  column_mapping: z.record(z.string(), z.string()).optional(),
})

// ─── Sentiment & Objection Schemas (v5.0) ────────────────────────────────────

export const SentimentConfigSchema = z.object({
  enabled: z.boolean(),
  alert_threshold: z.number().min(-1).max(1).default(-0.5),
  objection_keywords: z.array(z.string().max(100)).max(50).optional(),
  alert_channels: z.array(z.enum(['dashboard', 'webhook', 'email'])).default(['dashboard']),
  webhook_url: z.string().url().max(2000).optional().nullable(),
})

// ─── AI Toggle Schemas (v5.0) ────────────────────────────────────────────────

export const AIToggleSchema = z.object({
  call_id: uuid,
  mode: z.enum(['ai', 'human']),
  reason: z.string().max(500).optional(),
})

export const AIPromptConfigSchema = z.object({
  ai_agent_prompt: z.string().max(10_000),
  ai_agent_model: z.enum(['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']).default('gpt-4o-mini'),
  ai_agent_temperature: z.number().min(0).max(2).default(0.3),
  ai_features_enabled: z.boolean().default(true),
  ai_greeting: z.string().max(2000).optional(),
  ai_max_turns: z.number().int().min(1).max(100).default(20),
  ai_silence_timeout_seconds: z.number().int().min(5).max(120).default(30),
})

// ─── Predictive Dialer Schemas (v5.0) ────────────────────────────────────────

export const DialerQueueSchema = z.object({
  campaign_id: uuid,
  pacing_mode: z.enum(['preview', 'progressive', 'predictive']).default('progressive'),
  max_concurrent: z.number().int().min(1).max(50).default(5),
  abandon_rate_limit: z.number().min(0).max(0.05).default(0.03),
})

export const DialerAgentStatusSchema = z.object({
  status: z.enum(['offline', 'available', 'on_call', 'wrap_up', 'break']),
  campaign_id: uuid.optional().nullable(),
})

// ─── IVR Payment Schemas (v5.0) ──────────────────────────────────────────────

export const IVRFlowSchema = z.object({
  account_id: uuid,
  flow_type: z.enum(['payment', 'balance_check', 'callback_request']).default('payment'),
  language: z.string().max(5).default('en'),
})

export const IVRPaymentSchema = z.object({
  call_id: uuid,
  account_id: uuid,
  amount: z.number().positive().max(99_999_999.99),
  payment_method: z.enum(['stripe_link', 'sms_link']).default('stripe_link'),
})

// ─── Language Detection Schema (v5.0) ────────────────────────────────────────

export const LanguageDetectionSchema = z.object({
  call_id: uuid,
  auto_detect: z.boolean().default(true),
  preferred_language: z.string().max(5).optional(),
})

