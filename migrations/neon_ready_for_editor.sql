-- ============================================================================
-- Neon-ready Schema Fix & Creation
-- Run this after creating a blank database in Neon
-- ============================================================================

-- 1. Enable required extensions (supported in Neon 2026)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for better text/search on transcripts/notes

-- 2. Create helper function for updated_at triggers
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Core auth tables (standard NextAuth / Auth.js names - kept only these)
CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  name text,
  email text UNIQUE,
  email_verified timestamptz,
  image text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT accounts_provider_unique UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id text PRIMARY KEY,
  session_token text UNIQUE NOT NULL,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (identifier, token)
);

-- 4. Your main application tables (cleaned & fixed)
-- organizations (root tenant)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  plan_status text DEFAULT 'active' CHECK (plan_status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  created_by text REFERENCES public.users(id)
);

-- org_members (membership link)
CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- calls (core entity)
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  system_id uuid,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text REFERENCES public.users(id),
  call_sid text,
  disposition text CHECK (disposition IN ('sale', 'no_answer', 'voicemail', 'not_interested', 'follow_up', 'wrong_number', 'other')),
  -- ... (add remaining columns from your original schema as needed)
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  legal_hold_flag boolean DEFAULT false
);

-- recordings
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  call_id uuid REFERENCES public.calls(id),
  recording_url text NOT NULL,
  duration_seconds integer,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  storage_path text,
  transcript_json jsonb
);

-- Add more tables here (artifacts, evidence_bundles, alerts, attention_events, etc.)
-- Example for one more:
CREATE TABLE IF NOT EXISTS public.artifacts (
  id text PRIMARY KEY,
  type text NOT NULL,
  title text,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  storage_path text,
  provenance jsonb
);

-- 5. Enable RLS on key tables (multi-tenant isolation)
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.artifacts ENABLE ROW LEVEL SECURITY;

-- Basic tenant isolation policies
DROP POLICY IF EXISTS org_isolation_organizations ON public.organizations;
CREATE POLICY org_isolation_organizations ON public.organizations
  USING (id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (id = current_setting('app.current_organization_id')::uuid);

DROP POLICY IF EXISTS org_isolation_members ON public.org_members;
CREATE POLICY org_isolation_members ON public.org_members
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

DROP POLICY IF EXISTS org_isolation_calls ON public.calls;
CREATE POLICY org_isolation_calls ON public.calls
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

DROP POLICY IF EXISTS org_isolation_recordings ON public.recordings;
CREATE POLICY org_isolation_recordings ON public.recordings
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

DROP POLICY IF EXISTS org_isolation_artifacts ON public.artifacts;
CREATE POLICY org_isolation_artifacts ON public.artifacts
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- 6. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_organizations_id ON public.organizations (id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_user ON public.org_members (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON public.calls (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_org_call ON public.recordings (organization_id, call_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_org_id ON public.artifacts (organization_id);

-- 7. Add updated_at triggers to selected tables
DROP TRIGGER IF EXISTS update_organizations_timestamp ON public.organizations;
CREATE TRIGGER update_organizations_timestamp
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_calls_timestamp ON public.calls;
CREATE TRIGGER update_calls_timestamp
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_recordings_timestamp ON public.recordings;
CREATE TRIGGER update_recordings_timestamp
  BEFORE UPDATE ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- Done. Test with:
-- SET app.current_organization_id = 'your-org-uuid-here';
-- SELECT * FROM calls;  -- should only show rows for that org
-- ============================================================================
