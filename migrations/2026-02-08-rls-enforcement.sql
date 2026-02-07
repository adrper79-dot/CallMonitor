-- ============================================================================
-- RLS Enforcement Migration — Multi-Tenant Row-Level Security
-- Run: psql $NEON_PG_CONN -f migrations/2026-02-08-rls-enforcement.sql
--
-- Pattern: current_setting('app.current_organization_id')::uuid
-- Workers must SET app.current_organization_id before tenant queries
-- Application-level WHERE org_id=$1 remains the primary isolation
-- RLS is the database-level safety net
--
-- NOTE: Run scripts/rls-audit.sql AFTER this to verify coverage
-- ============================================================================

BEGIN;

-- ============================================================================
-- CORE BUSINESS TABLES (actively queried in Workers routes)
-- ============================================================================

-- audit_logs (compliance critical)
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='org_isolation_audit_logs') THEN
    CREATE POLICY org_isolation_audit_logs ON public.audit_logs
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- call_outcomes
ALTER TABLE IF EXISTS public.call_outcomes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='call_outcomes' AND policyname='org_isolation_call_outcomes') THEN
    CREATE POLICY org_isolation_call_outcomes ON public.call_outcomes
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- call_notes
ALTER TABLE IF EXISTS public.call_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='call_notes' AND policyname='org_isolation_call_notes') THEN
    CREATE POLICY org_isolation_call_notes ON public.call_notes
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- campaigns
ALTER TABLE IF EXISTS public.campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='campaigns' AND policyname='org_isolation_campaigns') THEN
    CREATE POLICY org_isolation_campaigns ON public.campaigns
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- voice_configs
ALTER TABLE IF EXISTS public.voice_configs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='voice_configs' AND policyname='org_isolation_voice_configs') THEN
    CREATE POLICY org_isolation_voice_configs ON public.voice_configs
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- voice_targets
ALTER TABLE IF EXISTS public.voice_targets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='voice_targets' AND policyname='org_isolation_voice_targets') THEN
    CREATE POLICY org_isolation_voice_targets ON public.voice_targets
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- ============================================================================
-- BILLING & SUBSCRIPTION TABLES
-- ============================================================================

-- billing_events
ALTER TABLE IF EXISTS public.billing_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='billing_events' AND policyname='org_isolation_billing_events') THEN
    CREATE POLICY org_isolation_billing_events ON public.billing_events
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- stripe_subscriptions
ALTER TABLE IF EXISTS public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stripe_subscriptions' AND policyname='org_isolation_stripe_subscriptions') THEN
    CREATE POLICY org_isolation_stripe_subscriptions ON public.stripe_subscriptions
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- stripe_invoices
ALTER TABLE IF EXISTS public.stripe_invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stripe_invoices' AND policyname='org_isolation_stripe_invoices') THEN
    CREATE POLICY org_isolation_stripe_invoices ON public.stripe_invoices
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- stripe_payment_methods
ALTER TABLE IF EXISTS public.stripe_payment_methods ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stripe_payment_methods' AND policyname='org_isolation_stripe_payment_methods') THEN
    CREATE POLICY org_isolation_stripe_payment_methods ON public.stripe_payment_methods
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- usage_records
ALTER TABLE IF EXISTS public.usage_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usage_records' AND policyname='org_isolation_usage_records') THEN
    CREATE POLICY org_isolation_usage_records ON public.usage_records
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- ============================================================================
-- TEAM & RBAC TABLES
-- ============================================================================

-- team_invites
ALTER TABLE IF EXISTS public.team_invites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_invites' AND policyname='org_isolation_team_invites') THEN
    CREATE POLICY org_isolation_team_invites ON public.team_invites
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- scorecards
ALTER TABLE IF EXISTS public.scorecards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scorecards' AND policyname='org_isolation_scorecards') THEN
    CREATE POLICY org_isolation_scorecards ON public.scorecards
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- scored_recordings
ALTER TABLE IF EXISTS public.scored_recordings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scored_recordings' AND policyname='org_isolation_scored_recordings') THEN
    CREATE POLICY org_isolation_scored_recordings ON public.scored_recordings
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- ============================================================================
-- COMPLIANCE TABLES (high-sensitivity)
-- ============================================================================

-- compliance_violations
ALTER TABLE IF EXISTS public.compliance_violations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='compliance_violations' AND policyname='org_isolation_compliance_violations') THEN
    CREATE POLICY org_isolation_compliance_violations ON public.compliance_violations
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- compliance_restrictions
ALTER TABLE IF EXISTS public.compliance_restrictions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='compliance_restrictions' AND policyname='org_isolation_compliance_restrictions') THEN
    CREATE POLICY org_isolation_compliance_restrictions ON public.compliance_restrictions
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- legal_holds
ALTER TABLE IF EXISTS public.legal_holds ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_holds' AND policyname='org_isolation_legal_holds') THEN
    CREATE POLICY org_isolation_legal_holds ON public.legal_holds
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- retention_policies
ALTER TABLE IF EXISTS public.retention_policies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='retention_policies' AND policyname='org_isolation_retention_policies') THEN
    CREATE POLICY org_isolation_retention_policies ON public.retention_policies
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- disclosure_logs
ALTER TABLE IF EXISTS public.disclosure_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='disclosure_logs' AND policyname='org_isolation_disclosure_logs') THEN
    CREATE POLICY org_isolation_disclosure_logs ON public.disclosure_logs
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- ============================================================================
-- WEBHOOKS & INTEGRATIONS
-- ============================================================================

-- webhook_subscriptions
ALTER TABLE IF EXISTS public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='webhook_subscriptions' AND policyname='org_isolation_webhook_subscriptions') THEN
    CREATE POLICY org_isolation_webhook_subscriptions ON public.webhook_subscriptions
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- webhook_configs
ALTER TABLE IF EXISTS public.webhook_configs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='webhook_configs' AND policyname='org_isolation_webhook_configs') THEN
    CREATE POLICY org_isolation_webhook_configs ON public.webhook_configs
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- integrations
ALTER TABLE IF EXISTS public.integrations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='integrations' AND policyname='org_isolation_integrations') THEN
    CREATE POLICY org_isolation_integrations ON public.integrations
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- ============================================================================
-- AI & EVIDENCE TABLES
-- ============================================================================

-- ai_summaries
ALTER TABLE IF EXISTS public.ai_summaries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_summaries' AND policyname='org_isolation_ai_summaries') THEN
    CREATE POLICY org_isolation_ai_summaries ON public.ai_summaries
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- evidence_manifests
ALTER TABLE IF EXISTS public.evidence_manifests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evidence_manifests' AND policyname='org_isolation_evidence_manifests') THEN
    CREATE POLICY org_isolation_evidence_manifests ON public.evidence_manifests
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- evidence_bundles
ALTER TABLE IF EXISTS public.evidence_bundles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evidence_bundles' AND policyname='org_isolation_evidence_bundles') THEN
    CREATE POLICY org_isolation_evidence_bundles ON public.evidence_bundles
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- webrtc_sessions
ALTER TABLE IF EXISTS public.webrtc_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='webrtc_sessions' AND policyname='org_isolation_webrtc_sessions') THEN
    CREATE POLICY org_isolation_webrtc_sessions ON public.webrtc_sessions
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- ============================================================================
-- REPORTS
-- ============================================================================

-- generated_reports
ALTER TABLE IF EXISTS public.generated_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='generated_reports' AND policyname='org_isolation_generated_reports') THEN
    CREATE POLICY org_isolation_generated_reports ON public.generated_reports
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- report_templates
ALTER TABLE IF EXISTS public.report_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='report_templates' AND policyname='org_isolation_report_templates') THEN
    CREATE POLICY org_isolation_report_templates ON public.report_templates
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- scheduled_reports
ALTER TABLE IF EXISTS public.scheduled_reports ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reports' AND policyname='org_isolation_scheduled_reports') THEN
    CREATE POLICY org_isolation_scheduled_reports ON public.scheduled_reports
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- ============================================================================
-- CALLER ID
-- ============================================================================

-- caller_id_numbers
ALTER TABLE IF EXISTS public.caller_id_numbers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='caller_id_numbers' AND policyname='org_isolation_caller_id_numbers') THEN
    CREATE POLICY org_isolation_caller_id_numbers ON public.caller_id_numbers
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- caller_id_permissions
ALTER TABLE IF EXISTS public.caller_id_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='caller_id_permissions' AND policyname='org_isolation_caller_id_permissions') THEN
    CREATE POLICY org_isolation_caller_id_permissions ON public.caller_id_permissions
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

-- surveys
ALTER TABLE IF EXISTS public.surveys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='surveys' AND policyname='org_isolation_surveys') THEN
    CREATE POLICY org_isolation_surveys ON public.surveys
      USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION: Run this after to check coverage
-- ============================================================================
-- psql $NEON_PG_CONN -f scripts/rls-audit.sql
-- Expected: All critical tables should show ✅ ENABLED
-- ============================================================================
