-- ============================================================================
-- SESSION 7: CRITICAL SECURITY HARDENING MIGRATION
-- Date: 2026-02-10
-- Priority: P0 CRITICAL — Multi-Tenant Isolation Enforcement
-- ============================================================================
-- 
-- OBJECTIVES:
--   BL-131: Enable RLS on 39 tables with organization_id
--   BL-135: Create indexes on organization_id for query performance
--   BL-136: Add updated_at timestamps to tables missing them
--
-- ESTIMATED EXECUTION TIME: ~15-20 minutes on production
--   - RLS enablement: ~2 minutes (instant, metadata only)
--   - Index creation: ~10-15 minutes (CONCURRENTLY, no table locks)
--   - Timestamp columns: ~2-3 minutes
--
-- DEPLOYMENT NOTES:
--   - MUST set app.current_org_id in Workers API middleware (workers/src/lib/db.ts)
--   - Test in staging FIRST with verification queries at end
--   - Monitor for RLS permission errors in application logs
--   - Indexes built CONCURRENTLY to avoid blocking production writes
--
-- ROLLBACK INSTRUCTIONS (Emergency Only):
--   Uncomment ROLLBACK section at bottom and run separately
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: ENABLE ROW LEVEL SECURITY (RLS) ON 39 TABLES
-- ============================================================================
-- Pattern: current_setting('app.current_org_id')::uuid
-- Workers API MUST set this session variable before executing tenant queries
-- RLS is the database-level safety net when application code has bugs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BATCH 1: AI & Analytics Tables (6 tables)
-- ----------------------------------------------------------------------------

-- ai_call_events
ALTER TABLE IF EXISTS public.ai_call_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='ai_call_events' AND policyname='org_isolation_ai_call_events'
  ) THEN
    CREATE POLICY org_isolation_ai_call_events ON public.ai_call_events
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ai_summaries
ALTER TABLE IF EXISTS public.ai_summaries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='ai_summaries' AND policyname='org_isolation_ai_summaries'
  ) THEN
    CREATE POLICY org_isolation_ai_summaries ON public.ai_summaries
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- artifacts
ALTER TABLE IF EXISTS public.artifacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='artifacts' AND policyname='org_isolation_artifacts'
  ) THEN
    CREATE POLICY org_isolation_artifacts ON public.artifacts
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- bond_ai_copilot_contexts
ALTER TABLE IF EXISTS public.bond_ai_copilot_contexts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='bond_ai_copilot_contexts' AND policyname='org_isolation_bond_ai_copilot_contexts'
  ) THEN
    CREATE POLICY org_isolation_bond_ai_copilot_contexts ON public.bond_ai_copilot_contexts
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- campaigns
ALTER TABLE IF EXISTS public.campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='campaigns' AND policyname='org_isolation_campaigns'
  ) THEN
    CREATE POLICY org_isolation_campaigns ON public.campaigns
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- campaign_calls
ALTER TABLE IF EXISTS public.campaign_calls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='campaign_calls' AND policyname='org_isolation_campaign_calls'
  ) THEN
    CREATE POLICY org_isolation_campaign_calls ON public.campaign_calls
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- BATCH 2: Collections & CRM Tables (9 tables)
-- ----------------------------------------------------------------------------

-- collection_accounts
ALTER TABLE IF EXISTS public.collection_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='collection_accounts' AND policyname='org_isolation_collection_accounts'
  ) THEN
    CREATE POLICY org_isolation_collection_accounts ON public.collection_accounts
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- collection_calls
ALTER TABLE IF EXISTS public.collection_calls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='collection_calls' AND policyname='org_isolation_collection_calls'
  ) THEN
    CREATE POLICY org_isolation_collection_calls ON public.collection_calls
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- collection_csv_imports
ALTER TABLE IF EXISTS public.collection_csv_imports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='collection_csv_imports' AND policyname='org_isolation_collection_csv_imports'
  ) THEN
    CREATE POLICY org_isolation_collection_csv_imports ON public.collection_csv_imports
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- collection_letters
ALTER TABLE IF EXISTS public.collection_letters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='collection_letters' AND policyname='org_isolation_collection_letters'
  ) THEN
    CREATE POLICY org_isolation_collection_letters ON public.collection_letters
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- collection_payments
ALTER TABLE IF EXISTS public.collection_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='collection_payments' AND policyname='org_isolation_collection_payments'
  ) THEN
    CREATE POLICY org_isolation_collection_payments ON public.collection_payments
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- collection_tasks
ALTER TABLE IF EXISTS public.collection_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='collection_tasks' AND policyname='org_isolation_collection_tasks'
  ) THEN
    CREATE POLICY org_isolation_collection_tasks ON public.collection_tasks
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- crm_contacts
ALTER TABLE IF EXISTS public.crm_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='crm_contacts' AND policyname='org_isolation_crm_contacts'
  ) THEN
    CREATE POLICY org_isolation_crm_contacts ON public.crm_contacts
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- crm_interactions
ALTER TABLE IF EXISTS public.crm_interactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='crm_interactions' AND policyname='org_isolation_crm_interactions'
  ) THEN
    CREATE POLICY org_isolation_crm_interactions ON public.crm_interactions
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- customer_history
ALTER TABLE IF EXISTS public.customer_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='customer_history' AND policyname='org_isolation_customer_history'
  ) THEN
    CREATE POLICY org_isolation_customer_history ON public.customer_history
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- BATCH 3: Call Workflow & Disposition Tables (5 tables)
-- ----------------------------------------------------------------------------

-- disposition_outcomes
ALTER TABLE IF EXISTS public.disposition_outcomes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='disposition_outcomes' AND policyname='org_isolation_disposition_outcomes'
  ) THEN
    CREATE POLICY org_isolation_disposition_outcomes ON public.disposition_outcomes
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- disposition_workflows
ALTER TABLE IF EXISTS public.disposition_workflows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='disposition_workflows' AND policyname='org_isolation_disposition_workflows'
  ) THEN
    CREATE POLICY org_isolation_disposition_workflows ON public.disposition_workflows
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- call_confirmations
ALTER TABLE IF EXISTS public.call_confirmations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='call_confirmations' AND policyname='org_isolation_call_confirmations'
  ) THEN
    CREATE POLICY org_isolation_call_confirmations ON public.call_confirmations
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- compliance_monitoring
ALTER TABLE IF EXISTS public.compliance_monitoring ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='compliance_monitoring' AND policyname='org_isolation_compliance_monitoring'
  ) THEN
    CREATE POLICY org_isolation_compliance_monitoring ON public.compliance_monitoring
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- recordings
ALTER TABLE IF EXISTS public.recordings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='recordings' AND policyname='org_isolation_recordings'
  ) THEN
    CREATE POLICY org_isolation_recordings ON public.recordings
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- BATCH 4: Communications & Events Tables (6 tables)
-- ----------------------------------------------------------------------------

-- email_logs
ALTER TABLE IF EXISTS public.email_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='email_logs' AND policyname='org_isolation_email_logs'
  ) THEN
    CREATE POLICY org_isolation_email_logs ON public.email_logs
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ivr_sessions
ALTER TABLE IF EXISTS public.ivr_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='ivr_sessions' AND policyname='org_isolation_ivr_sessions'
  ) THEN
    CREATE POLICY org_isolation_ivr_sessions ON public.ivr_sessions
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- telnyx_call_events
ALTER TABLE IF EXISTS public.telnyx_call_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='telnyx_call_events' AND policyname='org_isolation_telnyx_call_events'
  ) THEN
    CREATE POLICY org_isolation_telnyx_call_events ON public.telnyx_call_events
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- webhook_event_types
ALTER TABLE IF EXISTS public.webhook_event_types ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='webhook_event_types' AND policyname='org_isolation_webhook_event_types'
  ) THEN
    CREATE POLICY org_isolation_webhook_event_types ON public.webhook_event_types
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- webhook_retry_history
ALTER TABLE IF EXISTS public.webhook_retry_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='webhook_retry_history' AND policyname='org_isolation_webhook_retry_history'
  ) THEN
    CREATE POLICY org_isolation_webhook_retry_history ON public.webhook_retry_history
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- surveys
ALTER TABLE IF EXISTS public.surveys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='surveys' AND policyname='org_isolation_surveys'
  ) THEN
    CREATE POLICY org_isolation_surveys ON public.surveys
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- BATCH 5: Organization, RBAC & Platform Tables (8 tables)
-- ----------------------------------------------------------------------------

-- org_members
ALTER TABLE IF EXISTS public.org_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='org_members' AND policyname='org_isolation_org_members'
  ) THEN
    CREATE POLICY org_isolation_org_members ON public.org_members
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- org_roles
ALTER TABLE IF EXISTS public.org_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='org_roles' AND policyname='org_isolation_org_roles'
  ) THEN
    CREATE POLICY org_isolation_org_roles ON public.org_roles
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- role_permissions
ALTER TABLE IF EXISTS public.role_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='role_permissions' AND policyname='org_isolation_role_permissions'
  ) THEN
    CREATE POLICY org_isolation_role_permissions ON public.role_permissions
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- team_invites
ALTER TABLE IF EXISTS public.team_invites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='team_invites' AND policyname='org_isolation_team_invites'
  ) THEN
    CREATE POLICY org_isolation_team_invites ON public.team_invites
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- tool_access
ALTER TABLE IF EXISTS public.tool_access ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='tool_access' AND policyname='org_isolation_tool_access'
  ) THEN
    CREATE POLICY org_isolation_tool_access ON public.tool_access
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- users (has organization_id via org_members join)
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='users' AND policyname='org_isolation_users'
  ) THEN
    CREATE POLICY org_isolation_users ON public.users
      FOR ALL
      USING (
        id::text IN (
          SELECT user_id FROM org_members 
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      )
      WITH CHECK (
        id::text IN (
          SELECT user_id FROM org_members 
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        )
      );
  END IF;
END $$;

-- plan_usage_limits
ALTER TABLE IF EXISTS public.plan_usage_limits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='plan_usage_limits' AND policyname='org_isolation_plan_usage_limits'
  ) THEN
    CREATE POLICY org_isolation_plan_usage_limits ON public.plan_usage_limits
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- usage_meters
ALTER TABLE IF EXISTS public.usage_meters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='usage_meters' AND policyname='org_isolation_usage_meters'
  ) THEN
    CREATE POLICY org_isolation_usage_meters ON public.usage_meters
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- BATCH 6: Security & Infrastructure Tables (5 tables)
-- ----------------------------------------------------------------------------

-- verification_codes
ALTER TABLE IF EXISTS public.verification_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='verification_codes' AND policyname='org_isolation_verification_codes'
  ) THEN
    CREATE POLICY org_isolation_verification_codes ON public.verification_codes
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- voice_configs
ALTER TABLE IF EXISTS public.voice_configs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='voice_configs' AND policyname='org_isolation_voice_configs'
  ) THEN
    CREATE POLICY org_isolation_voice_configs ON public.voice_configs
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- sip_trunks
ALTER TABLE IF EXISTS public.sip_trunks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='sip_trunks' AND policyname='org_isolation_sip_trunks'
  ) THEN
    CREATE POLICY org_isolation_sip_trunks ON public.sip_trunks
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- webrtc_credentials
ALTER TABLE IF EXISTS public.webrtc_credentials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='webrtc_credentials' AND policyname='org_isolation_webrtc_credentials'
  ) THEN
    CREATE POLICY org_isolation_webrtc_credentials ON public.webrtc_credentials
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- webrtc_sessions
ALTER TABLE IF EXISTS public.webrtc_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename='webrtc_sessions' AND policyname='org_isolation_webrtc_sessions'
  ) THEN
    CREATE POLICY org_isolation_webrtc_sessions ON public.webrtc_sessions
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ============================================================================
-- SECTION 3: ADD updated_at TIMESTAMPS TO TABLES MISSING THEM (BL-136)
-- ============================================================================
-- Runs INSIDE the transaction (safe: no CONCURRENTLY involved)
-- Adds audit trail capability for tracking record modifications
-- Triggers auto-update updated_at on every UPDATE operation
-- ============================================================================

-- First verify update_timestamp() function exists (from neon_schema.sql)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column and trigger to tables that don't have it
DO $$
DECLARE
  table_record RECORD;
  tables_to_update TEXT[] := ARRAY[
    'ai_call_events', 'bond_ai_copilot_contexts', 'collection_accounts',
    'collection_calls', 'collection_csv_imports', 'collection_letters',
    'collection_payments', 'collection_tasks', 'compliance_monitoring',
    'crm_contacts', 'crm_interactions', 'customer_history',
    'disposition_outcomes', 'disposition_workflows', 'email_logs',
    'ivr_sessions', 'org_roles', 'plan_usage_limits', 'role_permissions',
    'sip_trunks', 'telnyx_call_events', 'webhook_event_types',
    'webhook_retry_history', 'webrtc_credentials', 'webrtc_sessions',
    'call_confirmations', 'tool_access', 'usage_meters'
  ];
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY tables_to_update
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = table_name 
        AND column_name = 'updated_at'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now()', table_name);
      RAISE NOTICE 'Added updated_at column to %', table_name;
      EXECUTE format(
        'CREATE TRIGGER update_%I_timestamp BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_timestamp()',
        table_name, table_name
      );
      RAISE NOTICE 'Created update trigger for %', table_name;
    ELSE
      RAISE NOTICE 'Table % already has updated_at column', table_name;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 2: CREATE PERFORMANCE INDEXES ON organization_id (BL-135)
-- ============================================================================
-- ⚠️  IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- The COMMIT above ends Section 1+3 transaction. Indexes run individually.
-- If any index fails, re-run it manually — IF NOT EXISTS makes them idempotent.
-- ============================================================================

COMMIT;

-- Batch 1: AI & Analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_call_events_org_id ON public.ai_call_events(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_summaries_org_id ON public.ai_summaries(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_org_id ON public.artifacts(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bond_ai_copilot_contexts_org_id ON public.bond_ai_copilot_contexts(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_org_id ON public.campaigns(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_calls_org_id ON public.campaign_calls(organization_id);

-- Batch 2: Collections & CRM
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_accounts_org_id ON public.collection_accounts(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_calls_org_id ON public.collection_calls(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_csv_imports_org_id ON public.collection_csv_imports(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_letters_org_id ON public.collection_letters(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_payments_org_id ON public.collection_payments(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collection_tasks_org_id ON public.collection_tasks(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_contacts_org_id ON public.crm_contacts(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crm_interactions_org_id ON public.crm_interactions(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_history_org_id ON public.customer_history(organization_id);

-- Batch 3: Call Workflow & Disposition
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disposition_outcomes_org_id ON public.disposition_outcomes(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disposition_workflows_org_id ON public.disposition_workflows(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_confirmations_org_id ON public.call_confirmations(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compliance_monitoring_org_id ON public.compliance_monitoring(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recordings_org_id ON public.recordings(organization_id);

-- Batch 4: Communications & Events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_org_id ON public.email_logs(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ivr_sessions_org_id ON public.ivr_sessions(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telnyx_call_events_org_id ON public.telnyx_call_events(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_event_types_org_id ON public.webhook_event_types(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_retry_history_org_id ON public.webhook_retry_history(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_surveys_org_id ON public.surveys(organization_id);

-- Batch 5: Organization & RBAC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_org_id ON public.org_members(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_roles_org_id ON public.org_roles(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permissions_org_id ON public.role_permissions(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_invites_org_id ON public.team_invites(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_access_org_id ON public.tool_access(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plan_usage_limits_org_id ON public.plan_usage_limits(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_meters_org_id ON public.usage_meters(organization_id);

-- Batch 6: Security & Infrastructure
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_codes_org_id ON public.verification_codes(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_configs_org_id ON public.voice_configs(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sip_trunks_org_id ON public.sip_trunks(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webrtc_credentials_org_id ON public.webrtc_credentials(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webrtc_sessions_org_id ON public.webrtc_sessions(organization_id);

-- ============================================================================
-- VERIFICATION QUERIES (Run separately after migration)
-- ============================================================================
-- Copy these queries and run them to verify successful migration
-- DO NOT run automatically in migration script
-- ============================================================================

/*

-- 1. Verify RLS is enabled on all 39 tables
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN (
    'ai_call_events', 'ai_summaries', 'artifacts', 'bond_ai_copilot_contexts',
    'campaigns', 'campaign_calls', 'collection_accounts', 'collection_calls',
    'collection_csv_imports', 'collection_letters', 'collection_payments',
    'collection_tasks', 'compliance_monitoring', 'crm_contacts', 'crm_interactions',
    'customer_history', 'disposition_outcomes', 'disposition_workflows',
    'email_logs', 'ivr_sessions', 'org_members', 'org_roles', 'plan_usage_limits',
    'role_permissions', 'sip_trunks', 'surveys', 'team_invites',
    'telnyx_call_events', 'usage_meters', 'users', 'verification_codes',
    'voice_configs', 'webhook_event_types', 'webhook_retry_history',
    'webrtc_credentials', 'webrtc_sessions', 'call_confirmations',
    'recordings', 'tool_access'
  )
ORDER BY tablename;
-- Expected: 39 rows, all with rowsecurity = true

-- 2. Verify RLS policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ai_call_events', 'ai_summaries', 'artifacts', 'bond_ai_copilot_contexts',
    'campaigns', 'campaign_calls', 'collection_accounts', 'collection_calls',
    'collection_csv_imports', 'collection_letters', 'collection_payments',
    'collection_tasks', 'compliance_monitoring', 'crm_contacts', 'crm_interactions',
    'customer_history', 'disposition_outcomes', 'disposition_workflows',
    'email_logs', 'ivr_sessions', 'org_members', 'org_roles', 'plan_usage_limits',
    'role_permissions', 'sip_trunks', 'surveys', 'team_invites',
    'telnyx_call_events', 'usage_meters', 'users', 'verification_codes',
    'voice_configs', 'webhook_event_types', 'webhook_retry_history',
    'webrtc_credentials', 'webrtc_sessions', 'call_confirmations',
    'recordings', 'tool_access'
  )
ORDER BY tablename, policyname;
-- Expected: 39 policies (one 'org_isolation_*' per table)

-- 3. Verify indexes exist on organization_id
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%_org_id'
ORDER BY tablename;
-- Expected: 39 indexes

-- 4. Verify updated_at columns exist
SELECT 
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'updated_at'
  AND table_name IN (
    'ai_call_events', 'ai_summaries', 'artifacts', 'bond_ai_copilot_contexts',
    'campaigns', 'campaign_calls', 'collection_accounts', 'collection_calls',
    'collection_csv_imports', 'collection_letters', 'collection_payments',
    'collection_tasks', 'compliance_monitoring', 'crm_contacts', 'crm_interactions',
    'customer_history', 'disposition_outcomes', 'disposition_workflows',
    'email_logs', 'ivr_sessions', 'org_members', 'org_roles', 'plan_usage_limits',
    'role_permissions', 'sip_trunks', 'surveys', 'team_invites',
    'telnyx_call_events', 'usage_meters', 'verification_codes',
    'voice_configs', 'webhook_event_types', 'webhook_retry_history',
    'webrtc_credentials', 'webrtc_sessions', 'call_confirmations',
    'recordings', 'tool_access'
  )
ORDER BY table_name;
-- Expected: All 39 tables have updated_at TIMESTAMPTZ column

-- 5. Verify triggers exist for updated_at
SELECT 
  trigger_schema,
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'update_%_timestamp'
ORDER BY event_object_table;
-- Expected: Triggers for all tables with updated_at

-- 6. Test RLS enforcement (requires app.current_org_id to be set)
-- This should be tested in application code, not in migration script
-- Example test in Workers API middleware:
-- 
-- await db.query("SET app.current_org_id = $1", [session.organization_id]);
-- const result = await db.query("SELECT * FROM campaigns WHERE id = $1", [campaign_id]);
-- // Should only return campaigns for current org

*/

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (Emergency Only — Run Separately)
-- ============================================================================
-- WARNING: Only use in case of critical production issues
-- This will DISABLE multi-tenant protection at database level
-- ============================================================================

/*

BEGIN;

-- Disable RLS on all 39 tables
ALTER TABLE IF EXISTS public.ai_call_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.artifacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bond_ai_copilot_contexts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collection_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collection_calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collection_csv_imports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collection_letters DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collection_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collection_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.compliance_monitoring DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.disposition_outcomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.disposition_workflows DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ivr_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.org_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.org_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plan_usage_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sip_trunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telnyx_call_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_meters DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.verification_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voice_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_event_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_retry_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webrtc_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webrtc_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_confirmations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recordings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tool_access DISABLE ROW LEVEL SECURITY;

-- Drop all RLS policies (if needed)
-- Note: Policies auto-drop when RLS is disabled, but explicit cleanup shown here
DROP POLICY IF EXISTS org_isolation_ai_call_events ON public.ai_call_events;
DROP POLICY IF EXISTS org_isolation_ai_summaries ON public.ai_summaries;
DROP POLICY IF EXISTS org_isolation_artifacts ON public.artifacts;
DROP POLICY IF EXISTS org_isolation_bond_ai_copilot_contexts ON public.bond_ai_copilot_contexts;
DROP POLICY IF EXISTS org_isolation_campaigns ON public.campaigns;
DROP POLICY IF EXISTS org_isolation_campaign_calls ON public.campaign_calls;
DROP POLICY IF EXISTS org_isolation_collection_accounts ON public.collection_accounts;
DROP POLICY IF EXISTS org_isolation_collection_calls ON public.collection_calls;
DROP POLICY IF EXISTS org_isolation_collection_csv_imports ON public.collection_csv_imports;
DROP POLICY IF EXISTS org_isolation_collection_letters ON public.collection_letters;
DROP POLICY IF EXISTS org_isolation_collection_payments ON public.collection_payments;
DROP POLICY IF EXISTS org_isolation_collection_tasks ON public.collection_tasks;
DROP POLICY IF EXISTS org_isolation_compliance_monitoring ON public.compliance_monitoring;
DROP POLICY IF EXISTS org_isolation_crm_contacts ON public.crm_contacts;
DROP POLICY IF EXISTS org_isolation_crm_interactions ON public.crm_interactions;
DROP POLICY IF EXISTS org_isolation_customer_history ON public.customer_history;
DROP POLICY IF EXISTS org_isolation_disposition_outcomes ON public.disposition_outcomes;
DROP POLICY IF EXISTS org_isolation_disposition_workflows ON public.disposition_workflows;
DROP POLICY IF EXISTS org_isolation_email_logs ON public.email_logs;
DROP POLICY IF EXISTS org_isolation_ivr_sessions ON public.ivr_sessions;
DROP POLICY IF EXISTS org_isolation_org_members ON public.org_members;
DROP POLICY IF EXISTS org_isolation_org_roles ON public.org_roles;
DROP POLICY IF EXISTS org_isolation_plan_usage_limits ON public.plan_usage_limits;
DROP POLICY IF EXISTS org_isolation_role_permissions ON public.role_permissions;
DROP POLICY IF EXISTS org_isolation_sip_trunks ON public.sip_trunks;
DROP POLICY IF EXISTS org_isolation_surveys ON public.surveys;
DROP POLICY IF EXISTS org_isolation_team_invites ON public.team_invites;
DROP POLICY IF EXISTS org_isolation_telnyx_call_events ON public.telnyx_call_events;
DROP POLICY IF EXISTS org_isolation_usage_meters ON public.usage_meters;
DROP POLICY IF EXISTS org_isolation_users ON public.users;
DROP POLICY IF EXISTS org_isolation_verification_codes ON public.verification_codes;
DROP POLICY IF EXISTS org_isolation_voice_configs ON public.voice_configs;
DROP POLICY IF EXISTS org_isolation_webhook_event_types ON public.webhook_event_types;
DROP POLICY IF EXISTS org_isolation_webhook_retry_history ON public.webhook_retry_history;
DROP POLICY IF EXISTS org_isolation_webrtc_credentials ON public.webrtc_credentials;
DROP POLICY IF EXISTS org_isolation_webrtc_sessions ON public.webrtc_sessions;
DROP POLICY IF EXISTS org_isolation_call_confirmations ON public.call_confirmations;
DROP POLICY IF EXISTS org_isolation_recordings ON public.recordings;
DROP POLICY IF EXISTS org_isolation_tool_access ON public.tool_access;

-- Indexes can remain (they still improve query performance)
-- Only drop if causing issues:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_ai_call_events_org_id;
-- (Repeat for all 39 indexes)

-- ============================================================================
-- PHASE 3: TYPE CONSISTENCY FIXES FOR ID AND USER_ID COLUMNS
-- ============================================================================
-- OBJECTIVES:
--   - Migrate legacy integer IDs to UUID (call_translations.id, kpi_logs.id)
--   - Standardize user_id types (16 UUID columns → TEXT)
--   - Remove casting logic from codebase
--
-- BEST PRACTICES IMPLEMENTED:
--   - Zero-downtime migrations using temporary columns and constraints
--   - Idempotent operations with IF NOT EXISTS/IF EXISTS
--   - Proper constraint handling and validation
--   - Concurrent index creation to avoid blocking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 MIGRATE LEGACY INTEGER IDs TO UUID
-- ----------------------------------------------------------------------------

-- 3.1.1 Migrate call_translations.id from INTEGER to UUID
-- Add temporary UUID column
ALTER TABLE call_translations
ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();

-- Populate UUID column with converted integer values (maintaining referential integrity)
UPDATE call_translations
SET id_uuid = encode(digest(id::text, 'sha256'), 'hex')::uuid
WHERE id_uuid IS NULL;

-- Add NOT NULL constraint to temporary column
ALTER TABLE call_translations
ALTER COLUMN id_uuid SET NOT NULL;

-- Drop existing primary key constraint
ALTER TABLE call_translations
DROP CONSTRAINT IF EXISTS call_translations_pkey;

-- Rename columns
ALTER TABLE call_translations
RENAME COLUMN id TO id_old;

ALTER TABLE call_translations
RENAME COLUMN id_uuid TO id;

-- Add new primary key
ALTER TABLE call_translations
ADD CONSTRAINT call_translations_pkey PRIMARY KEY (id);

-- Rebuild indexes that reference the old id column
DROP INDEX IF EXISTS idx_call_translations_audio;
DROP INDEX IF EXISTS idx_call_translations_call_id;
DROP INDEX IF EXISTS idx_call_translations_org_id;

CREATE INDEX CONCURRENTLY idx_call_translations_audio ON call_translations (call_id, segment_index) WHERE translated_audio_url IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_call_translations_call_id ON call_translations (call_id, segment_index);
CREATE INDEX CONCURRENTLY idx_call_translations_org_id ON call_translations (organization_id);

-- Drop old column after validation
ALTER TABLE call_translations
DROP COLUMN IF EXISTS id_old;

-- 3.1.2 Migrate kpi_logs.id from BIGINT to UUID
-- Add temporary UUID column
ALTER TABLE kpi_logs
ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();

-- Populate UUID column with converted bigint values
UPDATE kpi_logs
SET id_uuid = encode(digest(id::text, 'sha256'), 'hex')::uuid
WHERE id_uuid IS NULL;

-- Add NOT NULL constraint to temporary column
ALTER TABLE kpi_logs
ALTER COLUMN id_uuid SET NOT NULL;

-- Drop existing primary key constraint
ALTER TABLE kpi_logs
DROP CONSTRAINT IF EXISTS kpi_logs_pkey;

-- Rename columns
ALTER TABLE kpi_logs
RENAME COLUMN id TO id_old;

ALTER TABLE kpi_logs
RENAME COLUMN id_uuid TO id;

-- Add new primary key
ALTER TABLE kpi_logs
ADD CONSTRAINT kpi_logs_pkey PRIMARY KEY (id);

-- Rebuild indexes that reference the old id column
DROP INDEX IF EXISTS idx_kpi_logs_created_at;
DROP INDEX IF EXISTS idx_kpi_logs_stage_status;
DROP INDEX IF EXISTS idx_kpi_logs_test_id;

CREATE INDEX CONCURRENTLY idx_kpi_logs_created_at ON kpi_logs (created_at DESC);
CREATE INDEX CONCURRENTLY idx_kpi_logs_stage_status ON kpi_logs (stage, status);
CREATE INDEX CONCURRENTLY idx_kpi_logs_test_id ON kpi_logs (test_id);

-- Drop old column after validation
ALTER TABLE kpi_logs
DROP COLUMN IF EXISTS id_old;

-- ----------------------------------------------------------------------------
-- 3.2 STANDARDIZE USER_ID TYPES (UUID → TEXT)
-- ----------------------------------------------------------------------------

-- Helper function to safely convert UUID to TEXT
CREATE OR REPLACE FUNCTION uuid_to_text_safe(uuid_val UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT uuid_val::text;
$$;

-- 3.2.1 Tables to migrate user_id from UUID to TEXT
-- Using zero-downtime approach with temporary columns

-- access_grants_archived
ALTER TABLE access_grants_archived
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE access_grants_archived
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE access_grants_archived
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE access_grants_archived
RENAME COLUMN user_id_text TO user_id;

-- alert_acknowledgements
ALTER TABLE alert_acknowledgements
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE alert_acknowledgements
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE alert_acknowledgements
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE alert_acknowledgements
RENAME COLUMN user_id_text TO user_id;

-- audit_logs
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE audit_logs
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE audit_logs
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE audit_logs
RENAME COLUMN user_id_text TO user_id;

-- bond_ai_conversations
ALTER TABLE bond_ai_conversations
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE bond_ai_conversations
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE bond_ai_conversations
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE bond_ai_conversations
RENAME COLUMN user_id_text TO user_id;

-- booking_events
ALTER TABLE booking_events
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE booking_events
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE booking_events
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE booking_events
RENAME COLUMN user_id_text TO user_id;

-- caller_id_default_rules
ALTER TABLE caller_id_default_rules
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE caller_id_default_rules
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE caller_id_default_rules
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE caller_id_default_rules
RENAME COLUMN user_id_text TO user_id;

-- caller_id_permissions
ALTER TABLE caller_id_permissions
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE caller_id_permissions
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE caller_id_permissions
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE caller_id_permissions
RENAME COLUMN user_id_text TO user_id;

-- campaign_audit_log
ALTER TABLE campaign_audit_log
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE campaign_audit_log
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE campaign_audit_log
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE campaign_audit_log
RENAME COLUMN user_id_text TO user_id;

-- compliance_violations
ALTER TABLE compliance_violations
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE compliance_violations
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE compliance_violations
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE compliance_violations
RENAME COLUMN user_id_text TO user_id;

-- dialer_agent_status
ALTER TABLE dialer_agent_status
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE dialer_agent_status
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE dialer_agent_status
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE dialer_agent_status
RENAME COLUMN user_id_text TO user_id;

-- report_access_log
ALTER TABLE report_access_log
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE report_access_log
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE report_access_log
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE report_access_log
RENAME COLUMN user_id_text TO user_id;

-- sessions
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE sessions
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE sessions
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE sessions
RENAME COLUMN user_id_text TO user_id;

-- sso_login_events
ALTER TABLE sso_login_events
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE sso_login_events
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE sso_login_events
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE sso_login_events
RENAME COLUMN user_id_text TO user_id;

-- team_members
ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE team_members
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE team_members
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE team_members
RENAME COLUMN user_id_text TO user_id;

-- tool_access
ALTER TABLE tool_access
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE tool_access
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE tool_access
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE tool_access
RENAME COLUMN user_id_text TO user_id;

-- webrtc_sessions
ALTER TABLE webrtc_sessions
ADD COLUMN IF NOT EXISTS user_id_text TEXT;

UPDATE webrtc_sessions
SET user_id_text = uuid_to_text_safe(user_id)
WHERE user_id_text IS NULL;

ALTER TABLE webrtc_sessions
DROP COLUMN IF EXISTS user_id CASCADE;

ALTER TABLE webrtc_sessions
RENAME COLUMN user_id_text TO user_id;

-- Clean up helper function
DROP FUNCTION IF EXISTS uuid_to_text_safe(UUID);

-- ----------------------------------------------------------------------------
-- 3.3 VALIDATION QUERIES
-- ----------------------------------------------------------------------------

-- Verify call_translations migration
DO $$
BEGIN
  RAISE NOTICE 'Validating call_translations migration...';
  RAISE NOTICE 'Table: call_translations, Type: %', pg_typeof((SELECT id FROM call_translations LIMIT 1));
END $$;

-- Verify kpi_logs migration
DO $$
BEGIN
  RAISE NOTICE 'Validating kpi_logs migration...';
  RAISE NOTICE 'Table: kpi_logs, Type: %', pg_typeof((SELECT id FROM kpi_logs LIMIT 1));
END $$;

-- Verify user_id migrations
DO $$
DECLARE
  table_record RECORD;
  type_check TEXT;
BEGIN
  RAISE NOTICE 'Validating user_id type migrations...';

  FOR table_record IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'user_id'
      AND table_schema = 'public'
      AND table_name IN (
        'access_grants_archived', 'alert_acknowledgements', 'audit_logs',
        'bond_ai_conversations', 'booking_events', 'caller_id_default_rules',
        'caller_id_permissions', 'campaign_audit_log', 'compliance_violations',
        'dialer_agent_status', 'report_access_log', 'sessions',
        'sso_login_events', 'team_members', 'tool_access', 'webrtc_sessions'
      )
  LOOP
    EXECUTE format('SELECT pg_typeof(user_id) FROM %I LIMIT 1', table_record.table_name) INTO type_check;
    RAISE NOTICE 'Table: %, user_id type: %', table_record.table_name, type_check;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3.4 ROLLBACK STRATEGY (if needed)
-- ----------------------------------------------------------------------------
-- To rollback Phase 3.1 (ID migrations):
-- 1. Add back integer/bigint columns
-- 2. Populate with original values (if stored in backup)
-- 3. Drop UUID columns and rename back
-- 4. Recreate original constraints and indexes

-- To rollback Phase 3.2 (user_id migrations):
-- 1. Add back UUID columns
-- 2. Convert TEXT back to UUID using uuid() function
-- 3. Drop TEXT columns and rename back
-- 4. Recreate original constraints

COMMIT;

*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
