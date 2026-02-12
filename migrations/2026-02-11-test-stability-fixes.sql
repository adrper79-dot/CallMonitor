-- Production safety: additive, idempotent columns for test stability
-- - calls.amd_status (VARCHAR) to capture AMD results
-- - call_translations.timestamp (timestamptz) for ordering
-- - audit_logs.correlation_id (TEXT) for traceability
-- - critical table drift closures (calls/organizations/voice_configs/usage_stats)

ALTER TABLE IF EXISTS public.calls
  ADD COLUMN IF NOT EXISTS amd_status VARCHAR;

-- Critical calls columns expected by monitoring tests
ALTER TABLE IF EXISTS public.calls
  ADD COLUMN IF NOT EXISTS call_session_id TEXT;
ALTER TABLE IF EXISTS public.calls
  ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE IF EXISTS public.calls
  ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE IF EXISTS public.calls
  ADD COLUMN IF NOT EXISTS transcript_status TEXT;
ALTER TABLE IF EXISTS public.calls
  ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE IF EXISTS public.calls
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

ALTER TABLE IF EXISTS public.call_translations
  ADD COLUMN IF NOT EXISTS "timestamp" timestamptz DEFAULT now();

-- Backfill timestamp where missing
UPDATE public.call_translations
SET "timestamp" = COALESCE("timestamp", created_at, now())
WHERE "timestamp" IS NULL;

ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id
  ON public.audit_logs (correlation_id);

-- Organizations subscription status
ALTER TABLE IF EXISTS public.organizations
  ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- Voice config feature flags
ALTER TABLE IF EXISTS public.voice_configs
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.voice_configs
  ADD COLUMN IF NOT EXISTS bond_enabled BOOLEAN DEFAULT false;

-- Usage stats expected counters
ALTER TABLE IF EXISTS public.usage_stats
  ADD COLUMN IF NOT EXISTS calls_count INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.usage_stats
  ADD COLUMN IF NOT EXISTS minutes_used INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.usage_stats
  ADD COLUMN IF NOT EXISTS transcripts_count INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.usage_stats
  ADD COLUMN IF NOT EXISTS ai_requests_count INTEGER DEFAULT 0;
