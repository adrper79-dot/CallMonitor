-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.access_grants_archived (
  id uuid NOT NULL,
  organization_id uuid,
  user_id uuid,
  role_id uuid,
  system_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT access_grants_archived_pkey PRIMARY KEY (id),
  CONSTRAINT access_grants_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT access_grants_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles_archived(id),
  CONSTRAINT access_grants_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id)
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
  providerAccountId text DEFAULT provider_account_id,
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ai_agent_audit_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  changed_by uuid,
  change_type text NOT NULL CHECK (change_type = ANY (ARRAY['created'::text, 'updated'::text, 'deleted'::text, 'enabled'::text, 'disabled'::text])),
  old_config jsonb,
  new_config jsonb,
  change_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_agent_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT ai_agent_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
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
  CONSTRAINT ai_runs_pkey PRIMARY KEY (id),
  CONSTRAINT ai_runs_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id),
  CONSTRAINT ai_runs_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id)
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
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT alerts_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id)
);
CREATE TABLE public.artifact_provenance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  artifact_type text NOT NULL CHECK (artifact_type = ANY (ARRAY['recording'::text, 'transcript'::text, 'translation'::text, 'survey'::text, 'score'::text, 'evidence_manifest'::text, 'evidence_bundle'::text])),
  artifact_id uuid NOT NULL,
  parent_artifact_id uuid,
  parent_artifact_type text,
  produced_by text NOT NULL CHECK (produced_by = ANY (ARRAY['system'::text, 'human'::text, 'model'::text])),
  produced_by_model text,
  produced_by_user_id uuid,
  produced_by_system_id uuid,
  produced_at timestamp with time zone NOT NULL DEFAULT now(),
  input_refs jsonb,
  version integer NOT NULL DEFAULT 1,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT artifact_provenance_pkey PRIMARY KEY (id),
  CONSTRAINT artifact_provenance_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT artifact_provenance_produced_by_system_id_fkey FOREIGN KEY (produced_by_system_id) REFERENCES public.systems(id)
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
  decision text NOT NULL CHECK (decision = ANY (ARRAY['escalate'::text, 'suppress'::text, 'include_in_digest'::text, 'needs_review'::text])),
  reason text NOT NULL,
  policy_id uuid,
  confidence integer CHECK (confidence >= 0 AND confidence <= 100),
  uncertainty_notes text,
  produced_by text NOT NULL CHECK (produced_by = ANY (ARRAY['system'::text, 'human'::text, 'model'::text])),
  produced_by_model text,
  produced_by_user_id uuid,
  input_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attention_decisions_pkey PRIMARY KEY (id),
  CONSTRAINT attention_decisions_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT attention_decisions_event_fkey FOREIGN KEY (attention_event_id) REFERENCES public.attention_events(id),
  CONSTRAINT attention_decisions_policy_fkey FOREIGN KEY (policy_id) REFERENCES public.attention_policies(id)
);
CREATE TABLE public.attention_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['call_completed'::text, 'alert_triggered'::text, 'webhook_failed'::text, 'carrier_degraded'::text, 'campaign_ended'::text, 'evidence_generated'::text, 'system_error'::text])),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attention_events_pkey PRIMARY KEY (id),
  CONSTRAINT attention_events_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.attention_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  policy_type text NOT NULL CHECK (policy_type = ANY (ARRAY['quiet_hours'::text, 'threshold'::text, 'recurring_suppress'::text, 'keyword_escalate'::text, 'custom'::text])),
  policy_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  is_enabled boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attention_policies_pkey PRIMARY KEY (id),
  CONSTRAINT attention_policies_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
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
  actor_type text CHECK (actor_type = ANY (ARRAY['human'::text, 'system'::text, 'vendor'::text, 'automation'::text])),
  actor_label text,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT audit_logs_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id)
);
-- (truncated here; full schema present in conversation and saved in file)
