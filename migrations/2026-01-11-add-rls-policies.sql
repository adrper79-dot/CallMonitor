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

-- Users can view their own user record
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (id = auth.uid());


DROP POLICY IF EXISTS "users_select_org" ON public.users;
CREATE POLICY "users_select_org" ON public.users FOR SELECT USING (organization_id = get_user_organization_id());


DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = auth.uid());


DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
CREATE POLICY "users_insert_admin" ON public.users FOR INSERT WITH CHECK (is_admin());


DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users FOR DELETE USING (is_admin());

-- =============================================================================

DROP POLICY IF EXISTS "organizations_select_own" ON public.organizations;
CREATE POLICY "organizations_select_own" ON public.organizations FOR SELECT USING (id = get_user_organization_id());


DROP POLICY IF EXISTS "organizations_select_admin" ON public.organizations;
CREATE POLICY "organizations_select_admin" ON public.organizations FOR SELECT USING (is_admin());


DROP POLICY IF EXISTS "organizations_insert_admin" ON public.organizations;
CREATE POLICY "organizations_insert_admin" ON public.organizations FOR INSERT WITH CHECK (is_admin());


DROP POLICY IF EXISTS "organizations_update_owner" ON public.organizations;
CREATE POLICY "organizations_update_owner" ON public.organizations FOR UPDATE USING (
  id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE organization_id = organizations.id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- =============================================================================

DROP POLICY IF EXISTS "org_members_select_org" ON public.org_members;
CREATE POLICY "org_members_select_org" ON public.org_members FOR SELECT USING (organization_id = get_user_organization_id());


DROP POLICY IF EXISTS "org_members_insert_owner" ON public.org_members;
CREATE POLICY "org_members_insert_owner" ON public.org_members FOR INSERT WITH CHECK (
  organization_id = get_user_organization_id() AND
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE organization_id = org_members.organization_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);


DROP POLICY IF EXISTS "org_members_delete_owner" ON public.org_members;
CREATE POLICY "org_members_delete_owner" ON public.org_members FOR DELETE USING (
  organization_id = get_user_organization_id() AND
  EXISTS (
    SELECT 1 FROM public.org_members 
    WHERE organization_id = org_members.organization_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- =============================================================================

DROP POLICY IF EXISTS "calls_select_org" ON public.calls;
CREATE POLICY "calls_select_org" ON public.calls FOR SELECT USING (organization_id = get_user_organization_id());


DROP POLICY IF EXISTS "calls_insert_org" ON public.calls;
CREATE POLICY "calls_insert_org" ON public.calls FOR INSERT WITH CHECK (organization_id = get_user_organization_id());


DROP POLICY IF EXISTS "calls_update_org" ON public.calls;
CREATE POLICY "calls_update_org" ON public.calls FOR UPDATE USING (organization_id = get_user_organization_id());

-- =============================================================================

DROP POLICY IF EXISTS "recordings_select_org" ON public.recordings;
CREATE POLICY "recordings_select_org" ON public.recordings FOR SELECT USING (organization_id = get_user_organization_id());


DROP POLICY IF EXISTS "recordings_insert_all" ON public.recordings;
CREATE POLICY "recordings_insert_all" ON public.recordings FOR INSERT WITH CHECK (true);


DROP POLICY IF EXISTS "recordings_update_org" ON public.recordings;
CREATE POLICY "recordings_update_org" ON public.recordings FOR UPDATE USING (organization_id = get_user_organization_id());

-- =============================================================================

DROP POLICY IF EXISTS "ai_runs_select_org" ON public.ai_runs;
CREATE POLICY "ai_runs_select_org" ON public.ai_runs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.calls 
    WHERE calls.id = ai_runs.call_id 
    AND calls.organization_id = get_user_organization_id()
  )
);

DROP POLICY IF EXISTS "ai_runs_insert_all" ON public.ai_runs;
CREATE POLICY "ai_runs_insert_all" ON public.ai_runs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ai_runs_update_all" ON public.ai_runs;
CREATE POLICY "ai_runs_update_all" ON public.ai_runs FOR UPDATE USING (true);

-- =============================================================================

DROP POLICY IF EXISTS "evidence_manifests_select_org" ON public.evidence_manifests;
CREATE POLICY "evidence_manifests_select_org" ON public.evidence_manifests FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "evidence_manifests_insert_all" ON public.evidence_manifests;
CREATE POLICY "evidence_manifests_insert_all" ON public.evidence_manifests FOR INSERT WITH CHECK (true);

-- =============================================================================

DROP POLICY IF EXISTS "voice_configs_select_org" ON public.voice_configs;
CREATE POLICY "voice_configs_select_org" ON public.voice_configs FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "voice_configs_update_org" ON public.voice_configs;
CREATE POLICY "voice_configs_update_org" ON public.voice_configs FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "voice_configs_insert_org" ON public.voice_configs;
CREATE POLICY "voice_configs_insert_org" ON public.voice_configs FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- =============================================================================

DROP POLICY IF EXISTS "voice_targets_select_org" ON public.voice_targets;
CREATE POLICY "voice_targets_select_org" ON public.voice_targets FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "voice_targets_insert_org" ON public.voice_targets;
CREATE POLICY "voice_targets_insert_org" ON public.voice_targets FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "voice_targets_update_org" ON public.voice_targets;
CREATE POLICY "voice_targets_update_org" ON public.voice_targets FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "voice_targets_delete_org" ON public.voice_targets;
CREATE POLICY "voice_targets_delete_org" ON public.voice_targets FOR DELETE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "campaigns_select_org" ON public.campaigns;
CREATE POLICY "campaigns_select_org" ON public.campaigns FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "campaigns_insert_org" ON public.campaigns;
CREATE POLICY "campaigns_insert_org" ON public.campaigns FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "campaigns_update_org" ON public.campaigns;
CREATE POLICY "campaigns_update_org" ON public.campaigns FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "campaigns_delete_org" ON public.campaigns;
CREATE POLICY "campaigns_delete_org" ON public.campaigns FOR DELETE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "surveys_select_org" ON public.surveys;
CREATE POLICY "surveys_select_org" ON public.surveys FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "surveys_insert_org" ON public.surveys;
CREATE POLICY "surveys_insert_org" ON public.surveys FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "surveys_update_org" ON public.surveys;
CREATE POLICY "surveys_update_org" ON public.surveys FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "surveys_delete_org" ON public.surveys;
CREATE POLICY "surveys_delete_org" ON public.surveys FOR DELETE USING (organization_id = get_user_organization_id());

-- =============================================================================

DROP POLICY IF EXISTS "scorecards_select_org" ON public.scorecards;
CREATE POLICY "scorecards_select_org" ON public.scorecards FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "scorecards_insert_org" ON public.scorecards;
CREATE POLICY "scorecards_insert_org" ON public.scorecards FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "scorecards_update_org" ON public.scorecards;
CREATE POLICY "scorecards_update_org" ON public.scorecards FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "scorecards_delete_org" ON public.scorecards;
CREATE POLICY "scorecards_delete_org" ON public.scorecards FOR DELETE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "scored_recordings_select_org" ON public.scored_recordings;
CREATE POLICY "scored_recordings_select_org" ON public.scored_recordings FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "scored_recordings_insert_org" ON public.scored_recordings;
CREATE POLICY "scored_recordings_insert_org" ON public.scored_recordings FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "scored_recordings_update_org" ON public.scored_recordings;
CREATE POLICY "scored_recordings_update_org" ON public.scored_recordings FOR UPDATE USING (organization_id = get_user_organization_id());

-- =============================================================================

DROP POLICY IF EXISTS "audit_logs_select_org" ON public.audit_logs;
CREATE POLICY "audit_logs_select_org" ON public.audit_logs FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "audit_logs_insert_all" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_all" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- =============================================================================

DROP POLICY IF EXISTS "test_configs_select_org" ON public.test_configs;
CREATE POLICY "test_configs_select_org" ON public.test_configs FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "test_configs_insert_org" ON public.test_configs;
CREATE POLICY "test_configs_insert_org" ON public.test_configs FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "test_configs_update_org" ON public.test_configs;
CREATE POLICY "test_configs_update_org" ON public.test_configs FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "test_configs_delete_org" ON public.test_configs;
CREATE POLICY "test_configs_delete_org" ON public.test_configs FOR DELETE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "test_results_select_org" ON public.test_results;
CREATE POLICY "test_results_select_org" ON public.test_results FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.test_configs 
    WHERE test_configs.id = test_results.test_config_id 
    AND test_configs.organization_id = get_user_organization_id()
  )
);

DROP POLICY IF EXISTS "test_results_insert_all" ON public.test_results;
CREATE POLICY "test_results_insert_all" ON public.test_results FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "monitored_numbers_select_org" ON public.monitored_numbers;
CREATE POLICY "monitored_numbers_select_org" ON public.monitored_numbers FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "monitored_numbers_insert_org" ON public.monitored_numbers;
CREATE POLICY "monitored_numbers_insert_org" ON public.monitored_numbers FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "monitored_numbers_update_org" ON public.monitored_numbers;
CREATE POLICY "monitored_numbers_update_org" ON public.monitored_numbers FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "monitored_numbers_delete_org" ON public.monitored_numbers;
CREATE POLICY "monitored_numbers_delete_org" ON public.monitored_numbers FOR DELETE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "kpi_logs_select_org" ON public.kpi_logs;
CREATE POLICY "kpi_logs_select_org" ON public.kpi_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.test_configs 
    WHERE test_configs.id = kpi_logs.test_id 
    AND test_configs.organization_id = get_user_organization_id()
  )
);

DROP POLICY IF EXISTS "kpi_logs_insert_all" ON public.kpi_logs;
CREATE POLICY "kpi_logs_insert_all" ON public.kpi_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "test_statistics_select_org" ON public.test_statistics;
CREATE POLICY "test_statistics_select_org" ON public.test_statistics FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.test_configs 
    WHERE test_configs.id = test_statistics.test_config_id 
    AND test_configs.organization_id = get_user_organization_id()
  )
);

DROP POLICY IF EXISTS "test_statistics_insert_all" ON public.test_statistics;
CREATE POLICY "test_statistics_insert_all" ON public.test_statistics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "test_statistics_update_all" ON public.test_statistics;
CREATE POLICY "test_statistics_update_all" ON public.test_statistics FOR UPDATE USING (true);

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
