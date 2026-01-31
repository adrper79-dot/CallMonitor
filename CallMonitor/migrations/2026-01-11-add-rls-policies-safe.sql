-- Migration: Add Row Level Security (RLS) Policies - SAFE VERSION
-- Date: 2026-01-11
-- Purpose: Secure database tables with proper RLS policies to prevent unauthorized access
-- Note: Only applies to tables that exist (skips optional tables)

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY ON CORE TABLES (REQUIRED)
-- =============================================================================

-- Core tables that MUST exist
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- ENABLE RLS ON OPTIONAL TABLES (IF THEY EXIST)
-- =============================================================================

-- Voice support tables (optional)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voice_targets') THEN
    ALTER TABLE public.voice_targets ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'surveys') THEN
    ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Scorecard tables (optional)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'scorecards') THEN
    ALTER TABLE public.scorecards ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'scored_recordings') THEN
    ALTER TABLE public.scored_recordings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Test/monitoring tables (optional)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_configs') THEN
    ALTER TABLE public.test_configs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_results') THEN
    ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monitored_numbers') THEN
    ALTER TABLE public.monitored_numbers ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'kpi_logs') THEN
    ALTER TABLE public.kpi_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_statistics') THEN
    ALTER TABLE public.test_statistics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM public.users WHERE auth.user_equals_auth(id::text);
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.users WHERE auth.user_equals_auth(id::text)), false);
$$;

-- Function to check if user is member of organization
CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE auth.user_equals_auth(user_id::text) AND organization_id = org_id
  );
$$;

-- =============================================================================
-- USERS TABLE POLICIES
-- =============================================================================

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_org" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

-- Users can view their own user record
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.user_equals_auth(id::text));

-- Users can view other users in their organization
CREATE POLICY "users_select_org"
  ON public.users FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Users can update their own user record
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.user_equals_auth(id::text));

-- Only admins can insert users
CREATE POLICY "users_insert_admin"
  ON public.users FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can delete users
CREATE POLICY "users_delete_admin"
  ON public.users FOR DELETE
  USING (is_admin());

-- =============================================================================
-- ORGANIZATIONS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;
DROP POLICY IF EXISTS "organizations_select_admin" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_admin" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_owner" ON public.organizations;

-- Users can view their own organization
CREATE POLICY "organizations_select_own"
  ON public.organizations FOR SELECT
  USING (id = get_user_organization_id());

-- Admins can view all organizations
CREATE POLICY "organizations_select_admin"
  ON public.organizations FOR SELECT
  USING (is_admin());

-- Only admins can create organizations
CREATE POLICY "organizations_insert_admin"
  ON public.organizations FOR INSERT
  WITH CHECK (is_admin());

-- Organization owners can update their organization
CREATE POLICY "organizations_update_owner"
  ON public.organizations FOR UPDATE
  USING (
    id = get_user_organization_id() AND 
    EXISTS (
      SELECT 1 FROM public.org_members 
      WHERE organization_id = organizations.id 
      AND auth.user_equals_auth(user_id::text) 
      AND role = 'owner'
    )
  );

-- =============================================================================
-- ORG_MEMBERS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "org_members_select_org" ON public.org_members;
DROP POLICY IF EXISTS "org_members_insert_owner" ON public.org_members;
DROP POLICY IF EXISTS "org_members_delete_owner" ON public.org_members;

-- Users can view members of their organization
CREATE POLICY "org_members_select_org"
  ON public.org_members FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Organization owners can add members
CREATE POLICY "org_members_insert_owner"
  ON public.org_members FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id() AND
    EXISTS (
      SELECT 1 FROM public.org_members 
      WHERE organization_id = org_members.organization_id 
      AND auth.user_equals_auth(user_id::text) 
      AND role = 'owner'
    )
  );

-- Organization owners can remove members
CREATE POLICY "org_members_delete_owner"
  ON public.org_members FOR DELETE
  USING (
    organization_id = get_user_organization_id() AND
    EXISTS (
      SELECT 1 FROM public.org_members 
      WHERE organization_id = org_members.organization_id 
      AND auth.user_equals_auth(user_id::text) 
      AND role = 'owner'
    )
  );

-- =============================================================================
-- CALLS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "calls_select_org" ON public.calls;
DROP POLICY IF EXISTS "calls_insert_org" ON public.calls;
DROP POLICY IF EXISTS "calls_update_org" ON public.calls;

-- Users can view calls from their organization
CREATE POLICY "calls_select_org"
  ON public.calls FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Users can create calls in their organization
CREATE POLICY "calls_insert_org"
  ON public.calls FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Users can update calls in their organization
CREATE POLICY "calls_update_org"
  ON public.calls FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- RECORDINGS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "recordings_select_org" ON public.recordings;
DROP POLICY IF EXISTS "recordings_insert_all" ON public.recordings;
DROP POLICY IF EXISTS "recordings_update_org" ON public.recordings;

-- Users can view recordings from their organization
CREATE POLICY "recordings_select_org"
  ON public.recordings FOR SELECT
  USING (organization_id = get_user_organization_id());

-- System can insert recordings (webhooks)
CREATE POLICY "recordings_insert_all"
  ON public.recordings FOR INSERT
  WITH CHECK (true);

-- Users can update recordings in their organization
CREATE POLICY "recordings_update_org"
  ON public.recordings FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- AI_RUNS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "ai_runs_select_org" ON public.ai_runs;
DROP POLICY IF EXISTS "ai_runs_insert_all" ON public.ai_runs;
DROP POLICY IF EXISTS "ai_runs_update_all" ON public.ai_runs;

-- Users can view AI runs for calls from their organization
CREATE POLICY "ai_runs_select_org"
  ON public.ai_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calls 
      WHERE calls.id = ai_runs.call_id 
      AND calls.organization_id = get_user_organization_id()
    )
  );

-- System can insert AI runs
CREATE POLICY "ai_runs_insert_all"
  ON public.ai_runs FOR INSERT
  WITH CHECK (true);

-- System can update AI runs
CREATE POLICY "ai_runs_update_all"
  ON public.ai_runs FOR UPDATE
  USING (true);

-- =============================================================================
-- EVIDENCE_MANIFESTS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "evidence_manifests_select_org" ON public.evidence_manifests;
DROP POLICY IF EXISTS "evidence_manifests_insert_all" ON public.evidence_manifests;

-- Users can view evidence manifests from their organization
CREATE POLICY "evidence_manifests_select_org"
  ON public.evidence_manifests FOR SELECT
  USING (organization_id = get_user_organization_id());

-- System can insert evidence manifests
CREATE POLICY "evidence_manifests_insert_all"
  ON public.evidence_manifests FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- VOICE_CONFIGS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "voice_configs_select_org" ON public.voice_configs;
DROP POLICY IF EXISTS "voice_configs_update_org" ON public.voice_configs;
DROP POLICY IF EXISTS "voice_configs_insert_org" ON public.voice_configs;

-- Users can view their organization's voice config
CREATE POLICY "voice_configs_select_org"
  ON public.voice_configs FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Users can update their organization's voice config
CREATE POLICY "voice_configs_update_org"
  ON public.voice_configs FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Users can insert voice config for their organization
CREATE POLICY "voice_configs_insert_org"
  ON public.voice_configs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- =============================================================================
-- AUDIT_LOGS TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "audit_logs_select_org" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_all" ON public.audit_logs;

-- Users can view audit logs for their organization
CREATE POLICY "audit_logs_select_org"
  ON public.audit_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

-- System can insert audit logs
CREATE POLICY "audit_logs_insert_all"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- GRANT USAGE ON HELPER FUNCTIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================

-- Run this to verify RLS is enabled on core tables:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('users', 'organizations', 'org_members', 'calls', 'recordings', 'ai_runs', 'evidence_manifests', 'voice_configs', 'audit_logs')
-- ORDER BY tablename;

-- Expected: rowsecurity = true for all core tables

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS Migration Complete!';
  RAISE NOTICE 'Core tables now have Row Level Security enabled.';
  RAISE NOTICE 'Run the verification query above to confirm.';
END $$;

