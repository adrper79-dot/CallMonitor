-- Migration: 2026-02-04-schema-alignment-comprehensive.sql
-- Purpose: Comprehensive schema alignment to fix all code<->DB mismatches
-- This consolidates all necessary schema changes in one place
-- Run this migration to ensure the database matches the codebase expectations

-- ============================================================================
-- PART 1: USER TABLE EXTENSIONS (for credential-based auth)
-- ============================================================================

-- Add columns needed for local authentication
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS normalized_email TEXT;

-- Create index for normalized email lookup
CREATE INDEX IF NOT EXISTS idx_users_normalized_email ON public.users(normalized_email);

-- ============================================================================
-- PART 2: CALLS TABLE EXTENSIONS
-- ============================================================================

-- Add missing columns to calls table
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS from_number TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS flow_type TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.users(id);
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_calls_phone_number ON public.calls(phone_number);
CREATE INDEX IF NOT EXISTS idx_calls_created_by ON public.calls(created_by);
CREATE INDEX IF NOT EXISTS idx_calls_organization_id ON public.calls(organization_id);

-- ============================================================================
-- PART 3: ORGANIZATIONS TABLE EXTENSIONS
-- ============================================================================

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tool_id TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- ============================================================================
-- PART 4: AI_RUNS TABLE EXTENSIONS
-- ============================================================================

ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS assemblyai_status TEXT;
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS input JSONB;
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- PART 5: CALL_OUTCOMES TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.call_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  outcome_status TEXT NOT NULL CHECK (outcome_status IN ('agreed', 'declined', 'partial', 'inconclusive', 'follow_up_required', 'cancelled')),
  confidence_level TEXT DEFAULT 'high' CHECK (confidence_level IN ('high', 'medium', 'low', 'uncertain')),
  agreed_items JSONB DEFAULT '[]'::jsonb,
  declined_items JSONB DEFAULT '[]'::jsonb,
  ambiguities JSONB DEFAULT '[]'::jsonb,
  follow_up_actions JSONB DEFAULT '[]'::jsonb,
  summary_text TEXT,
  summary_source TEXT DEFAULT 'human' CHECK (summary_source IN ('human', 'ai_generated', 'ai_confirmed')),
  readback_confirmed BOOLEAN DEFAULT false,
  readback_timestamp TIMESTAMPTZ,
  declared_by_user_id TEXT REFERENCES public.users(id),
  revision_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_outcomes_call_id ON public.call_outcomes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_organization_id ON public.call_outcomes(organization_id);

-- ============================================================================
-- PART 6: CALL_OUTCOME_HISTORY TABLE (for audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.call_outcome_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_outcome_id UUID NOT NULL REFERENCES public.call_outcomes(id) ON DELETE CASCADE,
  outcome_status TEXT,
  summary_text TEXT,
  revision_number INTEGER NOT NULL,
  changed_by_user_id TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 7: AI_SUMMARIES TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  summary_text TEXT NOT NULL,
  topics_discussed JSONB DEFAULT '[]'::jsonb,
  potential_agreements JSONB DEFAULT '[]'::jsonb,
  potential_concerns JSONB DEFAULT '[]'::jsonb,
  recommended_followup JSONB DEFAULT '[]'::jsonb,
  confidence_score NUMERIC(3,2) DEFAULT 0.85,
  model_used TEXT DEFAULT 'gpt-4-turbo-preview',
  generated_by_user_id TEXT REFERENCES public.users(id),
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  input_length INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_call_id ON public.ai_summaries(call_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_organization_id ON public.ai_summaries(organization_id);

-- ============================================================================
-- PART 8: USAGE_STATS TABLE (scheduled job aggregation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  date DATE NOT NULL,
  total_calls INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  total_recordings INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_stats_org_date ON public.usage_stats(organization_id, date);

-- ============================================================================
-- PART 9: BILLING_EVENTS TABLE (Stripe webhook events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  event_type TEXT NOT NULL,
  amount INTEGER,
  invoice_id TEXT,
  stripe_event_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org ON public.billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_invoice ON public.billing_events(invoice_id);

-- ============================================================================
-- PART 10: BOOKING_EVENTS TABLE EXTENSIONS
-- ============================================================================

ALTER TABLE public.booking_events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.booking_events ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE public.booking_events ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE public.booking_events ADD COLUMN IF NOT EXISTS attendee_phone TEXT;

-- ============================================================================
-- PART 11: CAMPAIGNS TABLE EXTENSIONS
-- ============================================================================

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS script_type TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS completed_count INTEGER DEFAULT 0;

-- ============================================================================
-- PART 12: RECORDINGS TABLE VERIFICATION
-- ============================================================================

-- Schema has duration_seconds, ensure it exists
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS disclosure_given BOOLEAN DEFAULT false;
ALTER TABLE public.recordings ADD COLUMN IF NOT EXISTS disclosure_type TEXT;

-- ============================================================================
-- PART 13: UPDATE TIMESTAMP TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
DO $$
BEGIN
  -- calls
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_calls_updated_at') THEN
    CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON public.calls
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
  
  -- users
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
  
  -- organizations
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizations_updated_at') THEN
    CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
  
  -- call_outcomes
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_call_outcomes_updated_at') THEN
    CREATE TRIGGER update_call_outcomes_updated_at BEFORE UPDATE ON public.call_outcomes
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
  
  -- ai_summaries
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ai_summaries_updated_at') THEN
    CREATE TRIGGER update_ai_summaries_updated_at BEFORE UPDATE ON public.ai_summaries
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run to confirm)
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'calls' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organizations' ORDER BY ordinal_position;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('call_outcomes', 'ai_summaries', 'call_outcome_history');
