-- ============================================================================
-- RLS Hardening: Active Tables Missing Tenant Isolation
-- Date: 2026-02-13
-- Ref: ARCH_DOCS/06-REFERENCE/ENGINEERING_GUIDE.md Appendix A, Issue #12
--
-- Tables addressed (confirmed missing RLS with organization_id):
--   1. call_translations          — HIGH: translated call content
--   2. booking_events             — HIGH: customer appointment data
--   3. ai_configs                 — HIGH: org AI configuration
--   4. shopper_scripts            — MEDIUM: proprietary QA scripts
--   5. shopper_results            — MEDIUM: mystery shopper results
--   6. bond_ai_conversations      — HIGH: AI conversation content
--   7. bond_ai_custom_prompts     — MEDIUM: custom AI prompts
--   8. payment_plans              — HIGH: financial data
--   9. scheduled_payments         — HIGH: financial data
--  10. dnc_lists                  — HIGH: regulatory compliance data
--  11. survey_responses           — MEDIUM: customer survey data
--  12. call_sentiment_scores      — MEDIUM: per-utterance sentiment
--  13. call_sentiment_summary     — MEDIUM: per-call sentiment
--  14. dialer_agent_status        — MEDIUM: agent availability
--
-- Pattern: session variable 'app.current_org_id' (session7 standard)
-- All policies are idempotent (IF NOT EXISTS checks).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. call_translations — Confirmed org_id, has index, zero RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.call_translations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_translations' AND policyname = 'org_isolation_call_translations'
  ) THEN
    CREATE POLICY org_isolation_call_translations ON public.call_translations
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- Index already exists: idx_call_translations_org_id (from session7)

-- ---------------------------------------------------------------------------
-- 2. booking_events — Customer appointment data
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.booking_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'booking_events' AND policyname = 'org_isolation_booking_events'
  ) THEN
    CREATE POLICY org_isolation_booking_events ON public.booking_events
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_events_org_id
  ON public.booking_events(organization_id);

-- ---------------------------------------------------------------------------
-- 3. ai_configs — Org-level AI configuration
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.ai_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_configs' AND policyname = 'org_isolation_ai_configs'
  ) THEN
    CREATE POLICY org_isolation_ai_configs ON public.ai_configs
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_configs_org_id
  ON public.ai_configs(organization_id);

-- ---------------------------------------------------------------------------
-- 4. shopper_scripts — Proprietary QA scripts
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.shopper_scripts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shopper_scripts' AND policyname = 'org_isolation_shopper_scripts'
  ) THEN
    CREATE POLICY org_isolation_shopper_scripts ON public.shopper_scripts
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopper_scripts_org_id
  ON public.shopper_scripts(organization_id);

-- ---------------------------------------------------------------------------
-- 5. shopper_results — Mystery shopper results
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.shopper_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shopper_results' AND policyname = 'org_isolation_shopper_results'
  ) THEN
    CREATE POLICY org_isolation_shopper_results ON public.shopper_results
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopper_results_org_id
  ON public.shopper_results(organization_id);

-- ---------------------------------------------------------------------------
-- 6. bond_ai_conversations — AI conversation content
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.bond_ai_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bond_ai_conversations' AND policyname = 'org_isolation_bond_ai_conversations'
  ) THEN
    CREATE POLICY org_isolation_bond_ai_conversations ON public.bond_ai_conversations
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bond_ai_conversations_org_id
  ON public.bond_ai_conversations(organization_id);

-- ---------------------------------------------------------------------------
-- 7. bond_ai_custom_prompts — Custom AI prompts per org
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.bond_ai_custom_prompts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bond_ai_custom_prompts' AND policyname = 'org_isolation_bond_ai_custom_prompts'
  ) THEN
    CREATE POLICY org_isolation_bond_ai_custom_prompts ON public.bond_ai_custom_prompts
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bond_ai_custom_prompts_org_id
  ON public.bond_ai_custom_prompts(organization_id);

-- ---------------------------------------------------------------------------
-- 8. payment_plans — Financial data (HIGH risk)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.payment_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_plans' AND policyname = 'org_isolation_payment_plans'
  ) THEN
    CREATE POLICY org_isolation_payment_plans ON public.payment_plans
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_plans_org_id
  ON public.payment_plans(organization_id);

-- ---------------------------------------------------------------------------
-- 9. scheduled_payments — Financial schedule data (HIGH risk)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.scheduled_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scheduled_payments' AND policyname = 'org_isolation_scheduled_payments'
  ) THEN
    CREATE POLICY org_isolation_scheduled_payments ON public.scheduled_payments
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_payments_org_id
  ON public.scheduled_payments(organization_id);

-- ---------------------------------------------------------------------------
-- 10. dnc_lists — Do Not Call entries (regulatory, HIGH risk)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.dnc_lists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dnc_lists' AND policyname = 'org_isolation_dnc_lists'
  ) THEN
    CREATE POLICY org_isolation_dnc_lists ON public.dnc_lists
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dnc_lists_org_id
  ON public.dnc_lists(organization_id);

-- ---------------------------------------------------------------------------
-- 11. survey_responses — Customer survey data
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.survey_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'survey_responses' AND policyname = 'org_isolation_survey_responses'
  ) THEN
    CREATE POLICY org_isolation_survey_responses ON public.survey_responses
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_survey_responses_org_id
  ON public.survey_responses(organization_id);

-- ---------------------------------------------------------------------------
-- 12. call_sentiment_scores — Per-utterance sentiment analysis
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.call_sentiment_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_sentiment_scores' AND policyname = 'org_isolation_call_sentiment_scores'
  ) THEN
    CREATE POLICY org_isolation_call_sentiment_scores ON public.call_sentiment_scores
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_sentiment_scores_org_id
  ON public.call_sentiment_scores(organization_id);

-- ---------------------------------------------------------------------------
-- 13. call_sentiment_summary — Per-call sentiment summary
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.call_sentiment_summary ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_sentiment_summary' AND policyname = 'org_isolation_call_sentiment_summary'
  ) THEN
    CREATE POLICY org_isolation_call_sentiment_summary ON public.call_sentiment_summary
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_sentiment_summary_org_id
  ON public.call_sentiment_summary(organization_id);

-- ---------------------------------------------------------------------------
-- 14. dialer_agent_status — Agent availability status
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.dialer_agent_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dialer_agent_status' AND policyname = 'org_isolation_dialer_agent_status'
  ) THEN
    CREATE POLICY org_isolation_dialer_agent_status ON public.dialer_agent_status
      FOR ALL
      USING (organization_id = current_setting('app.current_org_id', true)::uuid)
      WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dialer_agent_status_org_id
  ON public.dialer_agent_status(organization_id);

-- ============================================================================
-- END — 14 tables hardened with RLS org isolation
-- ============================================================================
