-- Migration: Add Row Level Security (RLS) Policies
-- Date: 2026-01-11
-- Purpose: Secure database tables with proper RLS policies to prevent unauthorized access

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =============================================================================

-- Core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Voice support tables
ALTER TABLE public.voice_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

-- Scorecard tables
ALTER TABLE public.scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scored_recordings ENABLE ROW LEVEL SECURITY;

-- Test/monitoring tables
ALTER TABLE public.test_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_statistics ENABLE ROW LEVEL SECURITY;

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
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.users WHERE id = auth.uid()), false);
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
    WHERE user_id = auth.uid() AND organization_id = org_id
  );
$$;

-- =============================================================================
-- USERS TABLE POLICIES
-- =============================================================================

-- Users can view their own user record
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

-- Users can view other users in their organization
CREATE POLICY "users_select_org"
  ON public.users FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Users can update their own user record
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

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
      AND user_id = auth.uid() 
      AND role = 'owner'
    )
  );

-- =============================================================================
-- ORG_MEMBERS TABLE POLICIES
-- =============================================================================

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
      AND user_id = auth.uid() 
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
      AND user_id = auth.uid() 
      AND role = 'owner'
    )
  );

-- =============================================================================
-- CALLS TABLE POLICIES
-- =============================================================================

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
-- VOICE SUPPORT TABLES POLICIES
-- =============================================================================

-- Voice targets
CREATE POLICY "voice_targets_select_org"
  ON public.voice_targets FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "voice_targets_insert_org"
  ON public.voice_targets FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "voice_targets_update_org"
  ON public.voice_targets FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "voice_targets_delete_org"
  ON public.voice_targets FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Campaigns
CREATE POLICY "campaigns_select_org"
  ON public.campaigns FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "campaigns_insert_org"
  ON public.campaigns FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "campaigns_update_org"
  ON public.campaigns FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "campaigns_delete_org"
  ON public.campaigns FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Surveys
CREATE POLICY "surveys_select_org"
  ON public.surveys FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "surveys_insert_org"
  ON public.surveys FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "surveys_update_org"
  ON public.surveys FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "surveys_delete_org"
  ON public.surveys FOR DELETE
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- SCORECARD TABLES POLICIES
-- =============================================================================

-- Scorecards
CREATE POLICY "scorecards_select_org"
  ON public.scorecards FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "scorecards_insert_org"
  ON public.scorecards FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "scorecards_update_org"
  ON public.scorecards FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "scorecards_delete_org"
  ON public.scorecards FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Scored recordings
CREATE POLICY "scored_recordings_select_org"
  ON public.scored_recordings FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "scored_recordings_insert_org"
  ON public.scored_recordings FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "scored_recordings_update_org"
  ON public.scored_recordings FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- AUDIT_LOGS TABLE POLICIES
-- =============================================================================

-- Users can view audit logs for their organization
CREATE POLICY "audit_logs_select_org"
  ON public.audit_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

-- System can insert audit logs
CREATE POLICY "audit_logs_insert_all"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- TEST/MONITORING TABLES POLICIES
-- =============================================================================

-- Test configs
CREATE POLICY "test_configs_select_org"
  ON public.test_configs FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "test_configs_insert_org"
  ON public.test_configs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "test_configs_update_org"
  ON public.test_configs FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "test_configs_delete_org"
  ON public.test_configs FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Test results
CREATE POLICY "test_results_select_org"
  ON public.test_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.test_configs 
      WHERE test_configs.id = test_results.test_config_id 
      AND test_configs.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "test_results_insert_all"
  ON public.test_results FOR INSERT
  WITH CHECK (true);

-- Monitored numbers
CREATE POLICY "monitored_numbers_select_org"
  ON public.monitored_numbers FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "monitored_numbers_insert_org"
  ON public.monitored_numbers FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "monitored_numbers_update_org"
  ON public.monitored_numbers FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "monitored_numbers_delete_org"
  ON public.monitored_numbers FOR DELETE
  USING (organization_id = get_user_organization_id());

-- KPI logs
CREATE POLICY "kpi_logs_select_org"
  ON public.kpi_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.test_configs 
      WHERE test_configs.id = kpi_logs.test_id 
      AND test_configs.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "kpi_logs_insert_all"
  ON public.kpi_logs FOR INSERT
  WITH CHECK (true);

-- Test statistics
CREATE POLICY "test_statistics_select_org"
  ON public.test_statistics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.test_configs 
      WHERE test_configs.id = test_statistics.test_config_id 
      AND test_configs.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "test_statistics_insert_all"
  ON public.test_statistics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "test_statistics_update_all"
  ON public.test_statistics FOR UPDATE
  USING (true);

-- =============================================================================
-- GRANT USAGE ON HELPER FUNCTIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

-- =============================================================================
-- NOTES
-- =============================================================================

-- This migration enables Row Level Security (RLS) on all major tables.
-- 
-- Key principles:
-- 1. Users can only see data from their own organization
-- 2. Organization owners can manage members
-- 3. Admins have elevated privileges
-- 4. System (webhooks, background jobs) can insert data via service role key
-- 5. All SELECT policies use get_user_organization_id() for performance
--
-- Testing:
-- 1. Test with different user roles (admin, owner, member)
-- 2. Verify users cannot access other organizations' data
-- 3. Verify webhooks can still insert data (use service role key)
-- 4. Test API endpoints to ensure they work with RLS enabled
--
-- To disable RLS on a table (for debugging):
-- ALTER TABLE public.table_name DISABLE ROW LEVEL SECURITY;
--
-- To re-enable:
-- ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
