CREATE SEQUENCE IF NOT EXISTS kpi_logs_id_seq;

-- pass1: CREATE TABLE statements (safe)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.access_grants_archived (
  id uuid NOT NULL,
  organization_id uuid,
  user_id uuid,
  role_id uuid,
  system_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT access_grants_archived_pkey PRIMARY KEY (id)
);

CREATE TABLE public.accounts (
  id text NOT NULL,
  user_id text NOT NULL,
  type text NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  oauth_token_secret text,
  oauth_token text,
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_agent_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  changed_by uuid,
  change_type text NOT NULL CHECK (change_type = ANY (ARRAY['created', 'updated', 'deleted', 'enabled', 'disabled']::text[])),
  old_config jsonb,
  new_config jsonb,
  change_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_audit_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_runs (
  id uuid NOT NULL,
  call_id uuid,
  system_id uuid,
  model text,
  status text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  output jsonb,
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  is_authoritative boolean NOT NULL DEFAULT false,
  produced_by text,
  job_id text,
  CONSTRAINT ai_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.alert_acknowledgements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alert_id uuid,
  user_id uuid,
  acknowledged_at timestamp with time zone DEFAULT now(),
  acknowledgement_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT alert_acknowledgements_pkey PRIMARY KEY (id)
);

CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  test_config_id uuid,
  rule jsonb,
  enabled boolean DEFAULT true,
  last_triggered timestamp with time zone,
  CONSTRAINT alerts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.artifact_provenance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  artifact_type text NOT NULL CHECK (artifact_type = ANY (ARRAY['recording', 'transcript', 'translation', 'survey', 'score', 'evidence_manifest', 'evidence_bundle']::text[])),
  artifact_id uuid NOT NULL,
  parent_artifact_id uuid,
  parent_artifact_type text,
  produced_by text NOT NULL CHECK (produced_by = ANY (ARRAY['system', 'human', 'model']::text[])),
  produced_by_model text,
  produced_by_user_id uuid,
  produced_by_system_id uuid,
  produced_at timestamp with time zone NOT NULL DEFAULT now(),
  input_refs jsonb,
  version integer NOT NULL DEFAULT 1,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT artifact_provenance_pkey PRIMARY KEY (id)
);

CREATE TABLE public.artifacts (
  id text NOT NULL,
  type text NOT NULL,
  title text,
  created_at timestamp with time zone DEFAULT now(),
  duration_seconds integer,
  size_bytes bigint,
  storage_bucket text,
  storage_path text,
  provenance jsonb,
  transcript jsonb,
  evidence_manifest jsonb,
  CONSTRAINT artifacts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.attention_decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  attention_event_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision = ANY (ARRAY['escalate', 'suppress', 'include_in_digest', 'needs_review']::text[])),
  reason text NOT NULL,
  policy_id uuid,
  confidence integer CHECK (confidence >= 0 AND confidence <= 100),
  uncertainty_notes text,
  produced_by text NOT NULL CHECK (produced_by = ANY (ARRAY['system', 'human', 'model']::text[])),
  produced_by_model text,
  produced_by_user_id uuid,
  input_refs jsonb NOT NULL DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attention_decisions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.attention_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['call_completed', 'alert_triggered', 'webhook_failed', 'carrier_degraded', 'campaign_ended', 'evidence_generated', 'system_error']::text[])),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  payload_snapshot jsonb NOT NULL DEFAULT '{}',
  input_refs jsonb NOT NULL DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attention_events_pkey PRIMARY KEY (id)
);

CREATE TABLE public.attention_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  policy_type text NOT NULL CHECK (policy_type = ANY (ARRAY['quiet_hours', 'threshold', 'recurring_suppress', 'keyword_escalate', 'custom']::text[])),
  policy_config jsonb NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 100,
  is_enabled boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attention_policies_pkey PRIMARY KEY (id)
);

CREATE TABLE public.audit_logs (
  id uuid NOT NULL,
  organization_id uuid,
  user_id uuid,
  system_id uuid,
  resource_type text,
  resource_id uuid,
  action text,
  before jsonb,
  after jsonb,
  created_at timestamp with time zone DEFAULT now(),
  actor_type text CHECK (actor_type = ANY (ARRAY['human', 'system', 'vendor', 'automation']::text[])),
  actor_label text,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.booking_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  call_id uuid,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  timezone text DEFAULT 'UTC',
  attendee_name text,
  attendee_email text,
  attendee_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reminder_sent boolean DEFAULT false,
  modulations jsonb DEFAULT '{}',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  from_number text,
  CONSTRAINT booking_events_pkey PRIMARY KEY (id)
);

CREATE TABLE public.call_confirmation_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  template_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'confirmed', 'declined', 'skipped', 'not_applicable']::text[])),
  confirmation_id uuid,
  skip_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT call_confirmation_checklists_pkey PRIMARY KEY (id)
);

CREATE TABLE public.call_confirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  confirmation_type text NOT NULL CHECK (confirmation_type = ANY (ARRAY['disclosure_accepted', 'recording_consent', 'terms_agreed', 'price_confirmed', 'scope_confirmed', 'identity_verified', 'authorization_given', 'understanding_confirmed', 'custom']::text[])),
  confirmation_label text,
  prompt_text text NOT NULL,
  confirmer_role text NOT NULL CHECK (confirmer_role = ANY (ARRAY['customer', 'operator', 'third_party', 'both']::text[])),
  confirmed_at timestamp with time zone NOT NULL DEFAULT now(),
  recording_timestamp_seconds numeric,
  captured_by text NOT NULL DEFAULT 'human' CHECK (captured_by = ANY (ARRAY['human', 'system']::text[])),
  captured_by_user_id uuid,
  verification_method text CHECK (verification_method = ANY (ARRAY['verbal', 'keypress', 'biometric', 'document', 'other']::text[])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT call_confirmations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.call_export_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_id uuid NOT NULL,
  bundle_hash text NOT NULL,
  artifacts_included jsonb NOT NULL,
  storage_path text,
  exported_by uuid,
  exported_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  download_count integer DEFAULT 0,
  metadata jsonb,
  CONSTRAINT call_export_bundles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.call_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  note text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT call_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.caller_id_default_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  scope_type text NOT NULL CHECK (scope_type = ANY (ARRAY['organization', 'user', 'role']::text[])),
  user_id uuid,
  role_scope text,
  caller_id_number_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamp with time zone NOT NULL DEFAULT now(),
  effective_until timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT caller_id_default_rules_pkey PRIMARY KEY (id)
);

CREATE TABLE public.caller_id_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  phone_number text NOT NULL,
  display_name text,
  is_verified boolean DEFAULT false,
  verification_code text,
  verified_at timestamp with time zone,
  signalwire_verification_sid text,
  is_default boolean DEFAULT false,
  use_count integer DEFAULT 0,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active', 'suspended', 'retired']::text[])),
  retired_at timestamp with time zone,
  retired_by uuid,
  notes text,
  CONSTRAINT caller_id_numbers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.caller_id_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  caller_id_number_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission_type text NOT NULL DEFAULT 'use' CHECK (permission_type = ANY (ARRAY['use', 'manage', 'full']::text[])),
  is_active boolean NOT NULL DEFAULT true,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  granted_by uuid NOT NULL,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  revoke_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT caller_id_permissions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.calls (
  id uuid NOT NULL CHECK (id IS NOT NULL AND id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  organization_id uuid,
  system_id uuid,
  status text,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_by uuid,
  call_sid text,
  disposition text CHECK (disposition = ANY (ARRAY['sale', 'no_answer', 'voicemail', 'not_interested', 'follow_up', 'wrong_number', 'other']::text[])),
  disposition_set_at timestamp with time zone,
  disposition_set_by uuid,
  consent_method text CHECK (consent_method = ANY (ARRAY['ivr_played', 'verbal_yes', 'dtmf_confirm', 'written', 'assumed', 'none']::text[])),
  consent_timestamp timestamp with time zone,
  consent_audio_offset_ms integer,
  disposition_notes text,
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  is_authoritative boolean NOT NULL DEFAULT true,
  immutability_policy text NOT NULL DEFAULT 'limited' CHECK (immutability_policy = ANY (ARRAY['immutable', 'limited', 'mutable']::text[])),
  custody_status text NOT NULL DEFAULT 'active' CHECK (custody_status = ANY (ARRAY['active', 'archived', 'legal_hold', 'expired']::text[])),
  retention_class text NOT NULL DEFAULT 'default' CHECK (retention_class = ANY (ARRAY['default', 'regulated', 'legal_hold']::text[])),
  legal_hold_flag boolean NOT NULL DEFAULT false,
  evidence_completeness text NOT NULL DEFAULT 'unknown' CHECK (evidence_completeness = ANY (ARRAY['unknown', 'partial', 'complete', 'failed']::text[])),
  disclosure_type text CHECK (disclosure_type = ANY (ARRAY['recording', 'survey', 'translation', 'qa_evaluation', 'multi']::text[])),
  disclosure_given boolean DEFAULT false,
  disclosure_timestamp timestamp with time zone,
  disclosure_text text,
  caller_id_number_id uuid,
  caller_id_used text,
  CONSTRAINT calls_pkey PRIMARY KEY (id)
);

CREATE TABLE public.campaign_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  changes jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_audit_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.campaign_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  call_id uuid,
  target_phone text NOT NULL,
  target_metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'calling', 'completed', 'failed', 'canceled']::text[])),
  attempt_number integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 3,
  outcome text CHECK (outcome = ANY (ARRAY['answered', 'no_answer', 'busy', 'failed', 'error']::text[])),
  duration_seconds integer,
  error_message text,
  score_data jsonb,
  scheduled_for timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_calls_pkey PRIMARY KEY (id)
);

CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft', 'scheduled', 'active', 'paused', 'completed', 'canceled']::text[])),
  call_flow_type text NOT NULL CHECK (call_flow_type = ANY (ARRAY['secret_shopper', 'survey', 'outbound', 'test']::text[])),
  target_list jsonb NOT NULL DEFAULT '[]',
  caller_id_id uuid,
  script_id uuid,
  survey_id uuid,
  custom_prompt text,
  schedule_type text NOT NULL DEFAULT 'immediate' CHECK (schedule_type = ANY (ARRAY['immediate', 'scheduled', 'recurring']::text[])),
  scheduled_at timestamp with time zone,
  recurring_pattern jsonb,
  call_config jsonb DEFAULT '{}',
  total_targets integer NOT NULL DEFAULT 0,
  calls_completed integer NOT NULL DEFAULT 0,
  calls_successful integer NOT NULL DEFAULT 0,
  calls_failed integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);

CREATE TABLE public.capabilities_archived (
  id uuid NOT NULL,
  system_id uuid,
  action text NOT NULL,
  description text,
  CONSTRAINT capabilities_archived_pkey PRIMARY KEY (id)
);

CREATE TABLE public.carrier_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  carrier_name text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status = ANY (ARRAY['operational', 'degraded', 'outage']::text[])),
  last_updated timestamp with time zone DEFAULT now(),
  official_url text,
  status_page_api text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  incident_count integer DEFAULT 0,
  last_incident_at timestamp with time zone,
  CONSTRAINT carrier_status_pkey PRIMARY KEY (id)
);

CREATE TABLE public.compliance_restrictions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  restriction_code text NOT NULL UNIQUE CHECK (restriction_code = ANY (ARRAY['QA_NO_CONFIRMATIONS', 'QA_NO_OUTCOMES', 'QA_NO_AGREEMENTS', 'SURVEY_NO_AGREEMENTS', 'AI_NO_NEGOTIATION']::text[])),
  restriction_name text NOT NULL,
  description text NOT NULL,
  is_active boolean DEFAULT true,
  violation_action text NOT NULL DEFAULT 'warn' CHECK (violation_action = ANY (ARRAY['block', 'warn', 'log']::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT compliance_restrictions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.compliance_violations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_id uuid,
  user_id uuid,
  restriction_code text NOT NULL,
  violation_type text NOT NULL CHECK (violation_type = ANY (ARRAY['blocked', 'warned', 'detected', 'prevented']::text[])),
  violation_context jsonb,
  resolution_status text DEFAULT 'open' CHECK (resolution_status = ANY (ARRAY['open', 'reviewed', 'dismissed', 'confirmed']::text[])),
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT compliance_violations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.confirmation_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  confirmation_type text NOT NULL,
  label text NOT NULL,
  prompt_text text NOT NULL,
  description text,
  icon text DEFAULT '📋',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_required boolean DEFAULT false,
  use_cases text[] DEFAULT ARRAY['general']::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT confirmation_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE public.crm_object_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  integration_id uuid NOT NULL,
  call_id uuid NOT NULL,
  crm_object_type text NOT NULL CHECK (crm_object_type = ANY (ARRAY['contact', 'company', 'deal', 'lead', 'account', 'opportunity']::text[])),
  crm_object_id text NOT NULL,
  crm_object_name text,
  crm_object_url text,
  synced_at timestamp with time zone,
  sync_direction text NOT NULL CHECK (sync_direction = ANY (ARRAY['inbound', 'outbound']::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_object_links_pkey PRIMARY KEY (id)
);

CREATE TABLE public.crm_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  integration_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation = ANY (ARRAY['oauth_connect', 'oauth_disconnect', 'oauth_refresh', 'push_evidence', 'push_note', 'push_engagement', 'pull_contact', 'pull_company', 'pull_deal', 'link_object', 'unlink_object', 'error', 'rate_limited']::text[])),
  status text NOT NULL CHECK (status = ANY (ARRAY['pending', 'success', 'failed', 'rate_limited', 'skipped']::text[])),
  call_id uuid,
  export_bundle_id uuid,
  crm_object_link_id uuid,
  idempotency_key text,
  request_summary jsonb,
  response_summary jsonb,
  error_details jsonb,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  triggered_by text NOT NULL CHECK (triggered_by = ANY (ARRAY['user', 'system', 'webhook', 'scheduler']::text[])),
  triggered_by_user_id uuid,
  CONSTRAINT crm_sync_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.digest_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  digest_id uuid NOT NULL,
  attention_decision_id uuid NOT NULL,
  item_order integer NOT NULL,
  is_highlighted boolean NOT NULL DEFAULT false,
  highlight_reason text,
  CONSTRAINT digest_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.digests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  digest_type text NOT NULL CHECK (digest_type = ANY (ARRAY['overnight', 'weekly', 'on_demand']::text[])),
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  summary_text text NOT NULL,
  total_events integer NOT NULL DEFAULT 0,
  escalated_count integer NOT NULL DEFAULT 0,
  suppressed_count integer NOT NULL DEFAULT 0,
  needs_review_count integer NOT NULL DEFAULT 0,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  generated_by text NOT NULL DEFAULT 'system',
  generated_by_user_id uuid,
  CONSTRAINT digests_pkey PRIMARY KEY (id)
);

CREATE TABLE public.disclosure_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_id uuid,
  disclosure_type text NOT NULL CHECK (disclosure_type = ANY (ARRAY['recording', 'survey', 'translation', 'qa_evaluation', 'multi']::text[])),
  disclosure_text text NOT NULL,
  disclosed_at timestamp with time zone NOT NULL DEFAULT now(),
  disclosure_method text NOT NULL DEFAULT 'tts' CHECK (disclosure_method = ANY (ARRAY['tts', 'prerecorded', 'ivr', 'agent']::text[])),
  caller_response text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT disclosure_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.evidence_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_id uuid NOT NULL,
  recording_id uuid,
  manifest_id uuid NOT NULL,
  manifest_hash text NOT NULL,
  artifact_hashes jsonb NOT NULL DEFAULT '[]',
  bundle_payload jsonb NOT NULL,
  bundle_hash text NOT NULL,
  bundle_hash_algo text NOT NULL DEFAULT 'sha256',
  version integer NOT NULL DEFAULT 1,
  parent_bundle_id uuid,
  superseded_at timestamp with time zone,
  superseded_by uuid,
  immutable_storage boolean NOT NULL DEFAULT true,
  is_authoritative boolean NOT NULL DEFAULT true,
  produced_by text NOT NULL DEFAULT 'system_cas',
  immutability_policy text NOT NULL DEFAULT 'immutable' CHECK (immutability_policy = ANY (ARRAY['immutable', 'limited', 'mutable']::text[])),
  tsa jsonb,
  tsa_status text NOT NULL DEFAULT 'not_configured' CHECK (tsa_status = ANY (ARRAY['not_configured', 'pending', 'completed', 'error']::text[])),
  tsa_requested_at timestamp with time zone,
  tsa_received_at timestamp with time zone,
  tsa_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  custody_status text NOT NULL DEFAULT 'active' CHECK (custody_status = ANY (ARRAY['active', 'archived', 'legal_hold', 'expired']::text[])),
  retention_class text NOT NULL DEFAULT 'default' CHECK (retention_class = ANY (ARRAY['default', 'regulated', 'legal_hold']::text[])),
  legal_hold_flag boolean NOT NULL DEFAULT false,
  evidence_completeness text NOT NULL DEFAULT 'unknown' CHECK (evidence_completeness = ANY (ARRAY['unknown', 'partial', 'complete', 'failed']::text[])),
  CONSTRAINT evidence_bundles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.evidence_manifests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  recording_id uuid NOT NULL,
  scorecard_id uuid,
  manifest jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  parent_manifest_id uuid,
  superseded_at timestamp with time zone,
  superseded_by uuid,
  is_authoritative boolean NOT NULL DEFAULT true,
  produced_by text NOT NULL DEFAULT 'system_cas',
  immutability_policy text NOT NULL DEFAULT 'immutable' CHECK (immutability_policy = ANY (ARRAY['immutable', 'limited', 'mutable']::text[])),
  cryptographic_hash text,
  CONSTRAINT evidence_manifests_pkey PRIMARY KEY (id)
);

CREATE TABLE public.execution_contexts (
  id uuid NOT NULL,
  name text UNIQUE,
  isolation_level text,
  description text,
  CONSTRAINT execution_contexts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.export_compliance_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_id uuid NOT NULL,
  bundle_id uuid,
  retention_check_passed boolean NOT NULL,
  legal_hold_check_passed boolean NOT NULL,
  custody_status_at_export text NOT NULL,
  retention_class_at_export text NOT NULL,
  export_allowed boolean NOT NULL,
  denial_reason text,
  requested_by uuid NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  decision_metadata jsonb,
  CONSTRAINT export_compliance_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.external_entities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  display_name text,
  entity_type text NOT NULL DEFAULT 'contact' CHECK (entity_type = ANY (ARRAY['contact', 'company', 'location', 'other']::text[])),
  notes text,
  tags text[],
  metadata jsonb DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT external_entities_pkey PRIMARY KEY (id)
);

CREATE TABLE public.external_entity_identifiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_id uuid,
  identifier_type text NOT NULL CHECK (identifier_type = ANY (ARRAY['phone', 'email_domain', 'email', 'crm_object', 'other']::text[])),
  identifier_value text NOT NULL,
  identifier_normalized text NOT NULL,
  first_observed_at timestamp with time zone NOT NULL DEFAULT now(),
  last_observed_at timestamp with time zone NOT NULL DEFAULT now(),
  observation_count integer NOT NULL DEFAULT 1,
  first_observed_source text,
  first_observed_source_id uuid,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamp with time zone,
  verified_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT external_entity_identifiers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.external_entity_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  link_type text NOT NULL CHECK (link_type = ANY (ARRAY['identifier_to_entity', 'entity_merge', 'entity_split', 'identifier_transfer']::text[])),
  source_entity_id uuid,
  target_entity_id uuid,
  identifier_id uuid,
  created_by uuid NOT NULL,
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  revoke_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT external_entity_links_pkey PRIMARY KEY (id)
);

CREATE TABLE public.external_entity_observations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  identifier_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['call', 'target', 'campaign_call', 'booking', 'manual']::text[])),
  source_id uuid NOT NULL,
  role text CHECK (role = ANY (ARRAY['caller', 'callee', 'participant', 'target', 'other']::text[])),
  direction text CHECK (direction = ANY (ARRAY['inbound', 'outbound']::text[])),
  observed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT external_entity_observations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.generated_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  file_path text,
  file_format text CHECK (file_format = ANY (ARRAY['pdf', 'csv', 'xlsx', 'json']::text[])),
  file_size_bytes integer,
  report_data jsonb,
  parameters jsonb NOT NULL DEFAULT '{}',
  generated_by uuid NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'generating' CHECK (status = ANY (ARRAY['generating', 'completed', 'failed']::text[])),
  error_message text,
  generation_duration_ms integer,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT generated_reports_pkey PRIMARY KEY (id)
);

CREATE TABLE public.global_feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feature text NOT NULL UNIQUE,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT global_feature_flags_pkey PRIMARY KEY (id)
);

CREATE TABLE public.incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']::text[])),
  error_code text NOT NULL,
  error_message text NOT NULL,
  resource_type text,
  resource_id uuid,
  call_id uuid,
  stack_trace text,
  metadata jsonb,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT incidents_pkey PRIMARY KEY (id)
);

CREATE TABLE public.integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['hubspot', 'salesforce', 'zoho', 'pipedrive']::text[])),
  provider_account_id text,
  provider_account_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'active', 'disconnected', 'error', 'expired']::text[])),
  error_message text,
  last_error_at timestamp with time zone,
  settings jsonb DEFAULT '{}',
  sync_enabled boolean NOT NULL DEFAULT true,
  connected_at timestamp with time zone,
  disconnected_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  connected_by uuid,
  CONSTRAINT integrations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.invoices (
  id uuid NOT NULL,
  organization_id uuid,
  stripe_invoice_id text,
  amount_cents integer,
  status text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id)
);

CREATE TABLE public.kpi_logs (
  id bigint NOT NULL DEFAULT nextval('kpi_logs_id_seq'),
  test_id uuid,
  stage text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['success', 'failure']::text[])),
  message text NOT NULL,
  duration_ms integer,
  error_details text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kpi_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.kpi_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  response_time_threshold_ms integer DEFAULT 5000,
  response_time_warning_ms integer DEFAULT 3000,
  consecutive_failures_before_alert integer DEFAULT 3,
  alert_sensitivity text DEFAULT 'medium' CHECK (alert_sensitivity = ANY (ARRAY['low', 'medium', 'high']::text[])),
  default_test_frequency text DEFAULT '5min' CHECK (default_test_frequency = ANY (ARRAY['5min', '15min', '30min', '1hr', '4hr', '24hr']::text[])),
  send_email_alerts boolean DEFAULT true,
  send_sms_alerts boolean DEFAULT true,
  alert_on_recovery boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kpi_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.legal_holds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hold_name text NOT NULL,
  matter_reference text,
  description text,
  applies_to_all boolean NOT NULL DEFAULT false,
  call_ids text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active', 'released', 'expired']::text[])),
  effective_from timestamp with time zone NOT NULL DEFAULT now(),
  effective_until timestamp with time zone,
  released_at timestamp with time zone,
  released_by uuid,
  release_reason text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT legal_holds_pkey PRIMARY KEY (id)
);

CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  ip text,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT login_attempts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.media_sessions (
  id uuid NOT NULL,
  call_id uuid,
  system_id uuid,
  freeswitch_node text,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  CONSTRAINT media_sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.monitored_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  number text NOT NULL,
  name text,
  description text,
  type text DEFAULT 'inbound',
  test_frequency text NOT NULL DEFAULT 'hourly',
  greeting_message_id uuid,
  custom_greeting_message text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT monitored_numbers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.network_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  source text NOT NULL,
  link text,
  pub_date timestamp with time zone,
  severity text CHECK (severity = ANY (ARRAY['low', 'medium', 'high', 'critical']::text[])),
  affected_carriers text[],
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT network_incidents_pkey PRIMARY KEY (id)
);

CREATE TABLE public.number_kpi_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  monitored_number_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  stage text,
  duration_ms integer,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT number_kpi_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.number_kpi_snapshot (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  monitored_number_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  status text NOT NULL,
  uptime_percentage numeric,
  last_24h_failures integer,
  last_test_at timestamp with time zone,
  last_test_status text,
  avg_response_time_ms integer,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT number_kpi_snapshot_pkey PRIMARY KEY (id)
);

CREATE TABLE public.oauth_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL UNIQUE,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_type text DEFAULT 'Bearer',
  expires_at timestamp with time zone,
  refresh_expires_at timestamp with time zone,
  scopes text[],
  instance_url text,
  last_refreshed_at timestamp with time zone,
  refresh_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT oauth_tokens_pkey PRIMARY KEY (id)
);

CREATE TABLE public.org_feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  feature text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  disabled_reason text,
  disabled_at timestamp with time zone,
  disabled_by uuid,
  daily_limit integer,
  monthly_limit integer,
  current_daily_usage integer DEFAULT 0,
  current_monthly_usage integer DEFAULT 0,
  usage_reset_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT org_feature_flags_pkey PRIMARY KEY (id)
);

CREATE TABLE public.org_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member',
  created_at timestamp with time zone DEFAULT now(),
  invite_id uuid,
  CONSTRAINT org_members_pkey PRIMARY KEY (id)
);

CREATE TABLE public.org_sso_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider_type text NOT NULL CHECK (provider_type = ANY (ARRAY['saml', 'oidc', 'azure_ad', 'okta', 'google_workspace']::text[])),
  provider_name text NOT NULL,
  is_enabled boolean DEFAULT false,
  saml_entity_id text,
  saml_sso_url text,
  saml_slo_url text,
  saml_certificate text,
  saml_signature_algorithm text DEFAULT 'sha256',
  saml_name_id_format text DEFAULT 'emailAddress',
  oidc_client_id text,
  oidc_client_secret_encrypted text,
  oidc_issuer_url text,
  oidc_authorization_url text,
  oidc_token_url text,
  oidc_userinfo_url text,
  oidc_scopes text[] DEFAULT text[]['openid', 'email', 'profile'],
  verified_domains text[] DEFAULT '{}'::text[],
  auto_provision_users boolean DEFAULT true,
  default_role text DEFAULT 'member',
  require_sso boolean DEFAULT false,
  allow_idp_initiated boolean DEFAULT true,
  session_duration_hours integer DEFAULT 24,
  attribute_mapping jsonb DEFAULT '{"name": "displayName", "email": "email", "groups": "groups", "given_name": "firstName", "family_name": "lastName"}',
  group_mapping jsonb DEFAULT '{}',
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  login_count integer DEFAULT 0,
  CONSTRAINT org_sso_configs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text,
  created_at timestamp with time zone DEFAULT now(),
  plan_status text DEFAULT 'active' CHECK (plan_status = ANY (ARRAY['active', 'past_due', 'canceled', 'trialing', 'incomplete']::text[])),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  tenant_id uuid,
  tool_id uuid,
  created_by uuid,
  default_booking_duration integer DEFAULT 30,
  booking_enabled boolean DEFAULT false,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.qa_evaluation_disclosures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  disclosure_type text NOT NULL DEFAULT 'qa_evaluation' CHECK (disclosure_type = ANY (ARRAY['qa_evaluation', 'internal_audit', 'training']::text[])),
  disclosure_text text NOT NULL,
  disclosed_at timestamp with time zone NOT NULL DEFAULT now(),
  disclosure_position_seconds numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qa_evaluation_disclosures_pkey PRIMARY KEY (id)
);

CREATE TABLE public.recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_sid text NOT NULL,
  recording_sid text UNIQUE,
  recording_url text NOT NULL,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  transcript_json jsonb,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tool_id uuid NOT NULL,
  created_by uuid,
  has_live_translation boolean NOT NULL DEFAULT false,
  live_translation_provider text CHECK (live_translation_provider = 'signalwire' OR live_translation_provider IS NULL),
  source text NOT NULL DEFAULT 'signalwire' CHECK (source = ANY (ARRAY['signalwire', 'webrtc', 'upload', 'external']::text[])),
  external_call_id text,
  media_hash text,
  is_altered boolean DEFAULT false,
  original_url text,
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  is_authoritative boolean NOT NULL DEFAULT true,
  immutability_policy text NOT NULL DEFAULT 'immutable' CHECK (immutability_policy = ANY (ARRAY['immutable', 'limited', 'mutable']::text[])),
  custody_status text NOT NULL DEFAULT 'active' CHECK (custody_status = ANY (ARRAY['active', 'archived', 'legal_hold', 'expired']::text[])),
  retention_class text NOT NULL DEFAULT 'default' CHECK (retention_class = ANY (ARRAY['default', 'regulated', 'legal_hold']::text[])),
  legal_hold_flag boolean NOT NULL DEFAULT false,
  evidence_completeness text NOT NULL DEFAULT 'unknown' CHECK (evidence_completeness = ANY (ARRAY['unknown', 'partial', 'complete', 'failed']::text[])),
  disclosure_given boolean DEFAULT false,
  disclosure_type text,
  call_id uuid,
  CONSTRAINT recordings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.report_access_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['viewed', 'downloaded', 'shared']::text[])),
  accessed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT report_access_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.report_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  test_config_id uuid,
  frequency text NOT NULL CHECK (frequency = ANY (ARRAY['daily', 'weekly']::text[])),
  recipient_emails text[] NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT report_schedules_pkey PRIMARY KEY (id)
);

CREATE TABLE public.report_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  report_type text NOT NULL CHECK (report_type = ANY (ARRAY['call_volume', 'quality_scorecard', 'campaign_performance', 'custom']::text[])),
  data_source text NOT NULL CHECK (data_source = ANY (ARRAY['calls', 'campaigns', 'scorecards', 'surveys', 'multi']::text[])),
  filters jsonb NOT NULL DEFAULT '{}',
  metrics jsonb NOT NULL DEFAULT '[]',
  dimensions jsonb NOT NULL DEFAULT '[]',
  visualization_config jsonb DEFAULT '{}',
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT report_templates_pkey PRIMARY KEY (id)
);

CREATE TABLE public.retention_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  default_retention_class text NOT NULL DEFAULT 'default' CHECK (default_retention_class = ANY (ARRAY['default', 'regulated', 'legal_hold']::text[])),
  default_retention_days integer NOT NULL DEFAULT 0,
  regulated_retention_days integer NOT NULL DEFAULT 2555,
  auto_archive_after_days integer DEFAULT 90,
  auto_delete_after_days integer,
  legal_hold_contact_email text,
  legal_hold_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT retention_policies_pkey PRIMARY KEY (id)
);

CREATE TABLE public.role_capabilities_archived (
  role_id uuid NOT NULL,
  capability_id uuid NOT NULL,
  CONSTRAINT role_capabilities_archived_pkey PRIMARY KEY (role_id, capability_id)
);

CREATE TABLE public.roles_archived (
  id uuid NOT NULL,
  organization_id uuid,
  name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roles_archived_pkey PRIMARY KEY (id)
);

CREATE TABLE public.scheduled_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  schedule_pattern text NOT NULL,
  schedule_time time NOT NULL DEFAULT '09:00:00',
  schedule_days text[],
  timezone text NOT NULL DEFAULT 'UTC',
  delivery_method text NOT NULL DEFAULT 'email' CHECK (delivery_method = ANY (ARRAY['email', 'webhook', 'storage']::text[])),
  delivery_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamp with time zone,
  next_run_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_reports_pkey PRIMARY KEY (id)
);

CREATE TABLE public.scorecards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  structure jsonb NOT NULL,
  is_template boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tool_id uuid NOT NULL,
  created_by uuid,
  CONSTRAINT scorecards_pkey PRIMARY KEY (id)
);

CREATE TABLE public.scored_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  recording_id uuid NOT NULL,
  scorecard_id uuid NOT NULL,
  scores_json jsonb NOT NULL,
  total_score numeric,
  manual_overrides_json jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  CONSTRAINT scored_recordings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.search_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['call', 'recording', 'transcript', 'evidence', 'note']::text[])),
  source_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  superseded_by uuid,
  title text,
  content text NOT NULL,
  content_hash text NOT NULL,
  call_id uuid,
  phone_number text,
  domain text,
  tags text[],
  source_created_at timestamp with time zone,
  indexed_at timestamp with time zone NOT NULL DEFAULT now(),
  indexed_by text NOT NULL DEFAULT 'system',
  indexed_by_user_id uuid,
  CONSTRAINT search_documents_pkey PRIMARY KEY (id)
);

CREATE TABLE public.search_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['indexed', 'reindexed', 'rebuild_started', 'rebuild_completed']::text[])),
  document_id uuid,
  source_type text,
  source_id uuid,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  actor_type text NOT NULL CHECK (actor_type = ANY (ARRAY['system', 'human', 'automation']::text[])),
  actor_id uuid,
  actor_label text,
  CONSTRAINT search_events_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sessions (
  id text NOT NULL,
  session_token text NOT NULL UNIQUE,
  user_id text NOT NULL,
  expires timestamp with time zone NOT NULL,
  CONSTRAINT sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.shopper_campaigns_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  scenario text NOT NULL,
  schedule text DEFAULT 'manual',
  phone_numbers text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  caller_number text,
  phone_to_test text,
  CONSTRAINT shopper_campaigns_archive_pkey PRIMARY KEY (id)
);

CREATE TABLE public.shopper_jobs_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid,
  organization_id uuid,
  result_id uuid,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_try_at timestamp with time zone DEFAULT now(),
  last_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shopper_jobs_archive_pkey PRIMARY KEY (id)
);

CREATE TABLE public.shopper_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  call_id uuid,
  recording_id uuid,
  script_id uuid,
  overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100),
  sentiment_score text,
  sentiment_confidence numeric,
  outcome_results jsonb DEFAULT '[]',
  keywords_found text[],
  key_phrases text[],
  issues_detected text[],
  first_response_time_ms integer,
  hold_time_total_seconds integer,
  evaluated_at timestamp with time zone DEFAULT now(),
  evaluated_by text DEFAULT 'system',
  notes text,
  CONSTRAINT shopper_results_pkey PRIMARY KEY (id)
);

CREATE TABLE public.shopper_scripts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  script_text text NOT NULL,
  persona text DEFAULT 'professional',
  tts_provider text DEFAULT 'signalwire',
  tts_voice text DEFAULT 'rime.spore',
  elevenlabs_voice_id text,
  expected_outcomes jsonb DEFAULT '[]',
  scoring_weights jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  use_count integer DEFAULT 0,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT shopper_scripts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.sso_login_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  sso_config_id uuid NOT NULL,
  user_id uuid,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['login_success', 'login_failure', 'logout', 'token_refresh']::text[])),
  idp_subject text,
  idp_session_id text,
  email text,
  name text,
  groups text[],
  raw_claims jsonb,
  ip_address inet,
  user_agent text,
  error_code text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sso_login_events_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'greeting',
  text text NOT NULL,
  category text,
  duration_seconds integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stripe_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  organization_id uuid,
  data jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT stripe_events_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stripe_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_invoice_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  status text NOT NULL CHECK (status = ANY (ARRAY['draft', 'open', 'paid', 'void', 'uncollectible']::text[])),
  amount_due_cents integer NOT NULL,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  invoice_date timestamp with time zone NOT NULL,
  due_date timestamp with time zone,
  paid_at timestamp with time zone,
  invoice_pdf_url text,
  hosted_invoice_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stripe_invoices_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stripe_payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_payment_method_id text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type = ANY (ARRAY['card', 'bank_account', 'sepa_debit', 'us_bank_account']::text[])),
  is_default boolean NOT NULL DEFAULT false,
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  bank_name text,
  bank_last4 text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stripe_payment_methods_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stripe_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_price_id text NOT NULL,
  plan text NOT NULL CHECK (plan = ANY (ARRAY['free', 'pro', 'business', 'enterprise']::text[])),
  status text NOT NULL CHECK (status = ANY (ARRAY['active', 'canceled', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing', 'paused']::text[])),
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamp with time zone,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  interval text NOT NULL CHECK ("interval" = ANY (ARRAY['month', 'year']::text[])),
  trial_start timestamp with time zone,
  trial_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stripe_subscriptions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.subscriptions (
  id uuid NOT NULL,
  organization_id uuid,
  stripe_subscription_id text,
  plan text,
  status text,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.surveys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  questions jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT surveys_pkey PRIMARY KEY (id)
);

CREATE TABLE public.systems (
  id uuid NOT NULL,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  execution_plane text CHECK (execution_plane = ANY (ARRAY['control', 'media', 'ai']::text[])),
  is_billable boolean DEFAULT false,
  is_internal boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT systems_pkey PRIMARY KEY (id)
);

CREATE TABLE public.team_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  token uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'accepted', 'cancelled', 'expired']::text[])),
  invited_by uuid,
  accepted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  CONSTRAINT team_invites_pkey PRIMARY KEY (id)
);

CREATE TABLE public.test_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text,
  phone_to text NOT NULL,
  schedule text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  custom_message text,
  dtmf_required boolean DEFAULT false,
  dtmf_expected character varying,
  description text,
  carrier text,
  test_script text DEFAULT 'basic',
  alert_rules jsonb DEFAULT '{"alert_email": true, "consecutive_failures": 2}',
  last_test_at timestamp with time zone,
  last_status text,
  updated_at timestamp with time zone DEFAULT now(),
  tool_id uuid NOT NULL,
  created_by uuid,
  CONSTRAINT test_configs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.test_frequency_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  monitored_number_id uuid,
  frequency text NOT NULL,
  hours_between_tests integer,
  day_of_week integer,
  time_of_day time,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT test_frequency_config_pkey PRIMARY KEY (id)
);

CREATE TABLE public.test_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  test_config_id uuid,
  status text,
  duration_ms integer,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  tool_id uuid NOT NULL,
  created_by uuid,
  CONSTRAINT test_results_pkey PRIMARY KEY (id)
);

CREATE TABLE public.test_statistics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  test_config_id uuid NOT NULL UNIQUE,
  uptime_percentage_24h numeric DEFAULT 100.00,
  uptime_percentage_7d numeric DEFAULT 100.00,
  uptime_percentage_30d numeric DEFAULT 100.00,
  avg_response_ms_24h integer,
  min_response_ms_24h integer,
  max_response_ms_24h integer,
  total_tests_24h integer DEFAULT 0,
  failures_24h integer DEFAULT 0,
  consecutive_failures integer DEFAULT 0,
  current_status text DEFAULT 'unknown' CHECK (current_status = ANY (ARRAY['healthy', 'warning', 'critical', 'unknown']::text[])),
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone,
  hourly_uptime_trend jsonb DEFAULT '[]',
  updated_at timestamp with time zone DEFAULT now(),
  system_id uuid,
  created_by uuid,
  visibility text DEFAULT 'org' CHECK (visibility = ANY (ARRAY['private', 'team', 'org']::text[])),
  CONSTRAINT test_statistics_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tool_access (
  id uuid,
  organization_id uuid,
  user_id uuid,
  tool text,
  role text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

CREATE TABLE public.tool_access_archived (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tool text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tool_access_archived_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tool_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  tool text NOT NULL,
  settings jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tool_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tool_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tool text NOT NULL,
  role text NOT NULL,
  invited_by uuid,
  invited_at timestamp with time zone,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tool_team_members_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tools_pkey PRIMARY KEY (id)
);

CREATE TABLE public.transcript_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  transcript_json jsonb NOT NULL,
  transcript_hash text NOT NULL,
  produced_by text NOT NULL CHECK (produced_by = ANY (ARRAY['system', 'human', 'model']::text[])),
  produced_by_model text,
  produced_by_user_id uuid,
  input_refs jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_authoritative boolean NOT NULL DEFAULT true,
  immutability_policy text NOT NULL DEFAULT 'immutable' CHECK (immutability_policy = ANY (ARRAY['immutable', 'limited', 'mutable']::text[])),
  CONSTRAINT transcript_versions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.usage_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  plan text,
  metric text,
  limit_value integer,
  billing_period text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usage_limits_pkey PRIMARY KEY (id)
);

CREATE TABLE public.usage_records (
  id uuid NOT NULL,
  organization_id uuid,
  metric text,
  value integer,
  recorded_at timestamp with time zone DEFAULT now(),
  call_id uuid,
  quantity integer,
  billing_period_start timestamp with time zone,
  billing_period_end timestamp with time zone,
  metadata jsonb,
  CONSTRAINT usage_records_pkey PRIMARY KEY (id)
);

CREATE TABLE public.users (
  id text NOT NULL,
  name text,
  email text NOT NULL UNIQUE,
  email_verified timestamp with time zone,
  image text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamp with time zone NOT NULL,
  CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token)
);

CREATE TABLE public.voice_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  record boolean DEFAULT false,
  transcribe boolean DEFAULT false,
  translate boolean DEFAULT false,
  translate_from text,
  translate_to text,
  survey boolean DEFAULT false,
  synthetic_caller boolean DEFAULT false,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  use_voice_cloning boolean DEFAULT false,
  cloned_voice_id text,
  survey_prompts jsonb DEFAULT '[]',
  survey_voice text DEFAULT 'rime.spore',
  survey_webhook_email text,
  survey_inbound_number text,
  shopper_script text,
  shopper_persona text DEFAULT 'professional',
  shopper_expected_outcomes jsonb DEFAULT '[]',
  script_id uuid,
  caller_id_mask text,
  caller_id_verified boolean DEFAULT false,
  caller_id_verified_at timestamp with time zone,
  translation_from text,
  translation_to text,
  survey_question_types jsonb DEFAULT '[]',
  survey_prompts_locales jsonb DEFAULT '{}',
  ai_agent_id text,
  ai_agent_prompt text,
  ai_agent_temperature numeric DEFAULT 0.3 CHECK (ai_agent_temperature >= 0 AND ai_agent_temperature <= 2),
  ai_agent_model text DEFAULT 'gpt-4o-mini' CHECK (ai_agent_model = ANY (ARRAY['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']::text[])),
  ai_post_prompt_url text,
  ai_features_enabled boolean DEFAULT true,
  live_translate boolean DEFAULT false,
  CONSTRAINT voice_configs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.voice_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  phone_number text NOT NULL,
  name text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT voice_targets_pkey PRIMARY KEY (id)
);

CREATE TABLE public.webhook_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['slack', 'teams']::text[])),
  url text NOT NULL,
  is_active boolean DEFAULT true,
  test_sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhook_configs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  event_type text NOT NULL,
  event_id uuid NOT NULL,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending',
  attempts integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  max_attempts integer DEFAULT 5,
  next_retry_at timestamp with time zone,
  response_status integer,
  response_body text,
  response_time_ms integer,
  last_error text,
  delivered_at timestamp with time zone,
  CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id)
);

CREATE TABLE public.webhook_failures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  source text NOT NULL CHECK (source = ANY (ARRAY['signalwire', 'assemblyai', 'resend', 'stripe', 'internal']::text[])),
  endpoint text NOT NULL,
  payload jsonb NOT NULL,
  headers jsonb,
  error_message text NOT NULL,
  error_code text,
  http_status integer,
  idempotency_key text UNIQUE,
  attempt_count integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 5,
  next_retry_at timestamp with time zone,
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'retrying', 'succeeded', 'failed', 'manual_review', 'discarded']::text[])),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resource_type text,
  resource_id uuid,
  CONSTRAINT webhook_failures_pkey PRIMARY KEY (id)
);

CREATE TABLE public.webhook_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL,
  active boolean DEFAULT true,
  headers jsonb DEFAULT '{}',
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  retry_policy text DEFAULT 'exponential',
  max_retries integer DEFAULT 5,
  timeout_ms integer DEFAULT 30000,
  updated_at timestamp with time zone,
  CONSTRAINT webhook_subscriptions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.webrtc_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_token text NOT NULL UNIQUE,
  status text DEFAULT 'initializing',
  created_at timestamp with time zone DEFAULT now(),
  call_id uuid,
  updated_at timestamp with time zone,
  CONSTRAINT webrtc_sessions_pkey PRIMARY KEY (id)
);
