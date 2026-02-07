-- ============================================================================
-- Migration: 2026-02-07 Runtime DDL Consolidation
-- Purpose: Create ALL tables that were previously created at runtime via
--          CREATE TABLE IF NOT EXISTS in route handlers. These DDL blocks
--          have been removed from route files and consolidated here.
--
-- This migration is idempotent — safe to run multiple times.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. campaigns — previously runtime DDL in campaigns.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  scenario TEXT,
  status TEXT DEFAULT 'draft',
  total_targets INT DEFAULT 0,
  completed_calls INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_id
  ON public.campaigns(organization_id);

-- ---------------------------------------------------------------------------
-- 2. surveys — previously runtime DDL in surveys.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT true,
  trigger_type TEXT DEFAULT 'post_call',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_org_id
  ON public.surveys(organization_id);

-- ---------------------------------------------------------------------------
-- 3. scorecards — previously runtime DDL in scorecards.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  call_id UUID,
  template_id TEXT,
  scores JSONB DEFAULT '{}',
  notes TEXT,
  overall_score NUMERIC(5,2),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scorecards_org_id
  ON public.scorecards(organization_id);

-- ---------------------------------------------------------------------------
-- 4. webhook_subscriptions — previously runtime DDL in webhooks.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org_id
  ON public.webhook_subscriptions(organization_id);

-- ---------------------------------------------------------------------------
-- 5. webhook_deliveries — previously runtime DDL in webhooks.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL,
  event TEXT NOT NULL,
  payload JSONB,
  response_status INT,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  duration_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id
  ON public.webhook_deliveries(webhook_id);

-- ---------------------------------------------------------------------------
-- 6. shopper_scripts — previously runtime DDL in shopper.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopper_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT,
  scenario TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopper_scripts_org_id
  ON public.shopper_scripts(organization_id);

-- ---------------------------------------------------------------------------
-- 7. caller_ids — previously runtime DDL in caller-id.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.caller_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  label TEXT,
  status TEXT DEFAULT 'pending',
  verification_code TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caller_ids_org_id
  ON public.caller_ids(organization_id);

-- ---------------------------------------------------------------------------
-- 8. auth_providers — previously runtime DDL in admin.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  client_id TEXT,
  client_secret_hash TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, provider)
);

-- ---------------------------------------------------------------------------
-- 9. reports — previously runtime DDL in reports.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'call_volume',
  status TEXT NOT NULL DEFAULT 'pending',
  filters JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '[]',
  format TEXT DEFAULT 'pdf',
  result_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_org_id
  ON public.reports(organization_id);

-- ---------------------------------------------------------------------------
-- 10. report_schedules — previously runtime DDL in reports.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'call_volume',
  cron_pattern TEXT NOT NULL DEFAULT '0 8 * * 1',
  is_active BOOLEAN DEFAULT true,
  delivery_emails TEXT[],
  filters JSONB DEFAULT '{}',
  format TEXT DEFAULT 'pdf',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_org_id
  ON public.report_schedules(organization_id);

-- ---------------------------------------------------------------------------
-- 11. tts_audio — previously runtime DDL in tts.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tts_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  text TEXT NOT NULL,
  voice_id TEXT,
  language TEXT DEFAULT 'en',
  file_key TEXT NOT NULL,
  duration_seconds INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tts_audio_org_id
  ON public.tts_audio(organization_id);

-- ---------------------------------------------------------------------------
-- 12. audio_files — previously runtime DDL in audio.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  file_key TEXT NOT NULL,
  original_name TEXT,
  content_type TEXT DEFAULT 'audio/mpeg',
  size_bytes INTEGER,
  duration_seconds INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_files_org_id
  ON public.audio_files(organization_id);

-- ---------------------------------------------------------------------------
-- 13. transcriptions — previously runtime DDL in audio.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  audio_file_id UUID,
  file_key TEXT,
  status TEXT DEFAULT 'pending',
  language TEXT DEFAULT 'en',
  transcript TEXT,
  confidence NUMERIC(5,4),
  word_count INTEGER,
  error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transcriptions_org_id
  ON public.transcriptions(organization_id);

-- ---------------------------------------------------------------------------
-- 14. retention_policies — previously runtime DDL in compliance.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  recording_retention_days INTEGER DEFAULT 365,
  transcript_retention_days INTEGER DEFAULT 365,
  call_log_retention_days INTEGER DEFAULT 730,
  auto_delete_enabled BOOLEAN DEFAULT false,
  gdpr_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 15. legal_holds — previously runtime DDL in compliance.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  matter_reference TEXT,
  applies_to_all BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_org_id
  ON public.legal_holds(organization_id);

-- ---------------------------------------------------------------------------
-- 16. webhook_failures — previously runtime DDL in webhook-failures.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  webhook_url TEXT NOT NULL,
  event_type TEXT,
  payload JSONB,
  status_code INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'failed',
  resolution_notes TEXT,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_org_id
  ON public.webhook_failures(organization_id);

-- ---------------------------------------------------------------------------
-- 17. ai_configs — previously runtime DDL in ai.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 18. call_notes — previously runtime DDL in voice.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_notes_call_id
  ON public.call_notes(call_id);

-- ---------------------------------------------------------------------------
-- 19. call_confirmations — previously runtime DDL in voice.ts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL,
  confirmation_type TEXT NOT NULL,
  details JSONB,
  confirmed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_confirmations_call_id
  ON public.call_confirmations(call_id);

-- ---------------------------------------------------------------------------
-- 20. Add disposition columns to calls (if not exists)
-- ---------------------------------------------------------------------------
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS disposition TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS disposition_notes TEXT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
