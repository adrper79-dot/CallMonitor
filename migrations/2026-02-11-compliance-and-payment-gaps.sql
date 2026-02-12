-- Migration: Compliance Gateway + Payment Gaps
-- Date: 2026-02-11
-- Purpose: P0 Pre-dial compliance enforcement + P1 payment scheduling/dunning
-- Depends on: neon_schema.sql, 2026-02-09-v5-features.sql
-- MUST be applied BEFORE deploying updated Workers code

BEGIN;

-- ============================================================
-- PHASE 1: COMPLIANCE INFRASTRUCTURE
-- ============================================================

-- 1a. DNC Lists — per-org Do Not Call registry
-- Fix: Original add_compliance.sql had GLOBAL unique on phone_number.
-- Correct: UNIQUE per (organization_id, phone_number) so orgs have independent DNC lists.
CREATE TABLE IF NOT EXISTS dnc_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  reason TEXT,
  source TEXT DEFAULT 'manual',  -- 'manual', 'federal', 'state', 'consumer_request'
  added_by TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, phone_number)
);

ALTER TABLE dnc_lists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dnc_lists_org_isolation') THEN
    CREATE POLICY dnc_lists_org_isolation ON dnc_lists
      USING (organization_id = current_setting('app.organization_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dnc_lists_org_phone
  ON dnc_lists (organization_id, phone_number);

-- 1b. Compliance scores — per-call risk scoring
CREATE TABLE IF NOT EXISTS compliance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  compliance_risk_score NUMERIC(3,2) DEFAULT 0.00,
  violation_flags JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compliance_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'compliance_scores_org_isolation') THEN
    CREATE POLICY compliance_scores_org_isolation ON compliance_scores
      USING (organization_id = current_setting('app.organization_id', true)::uuid);
  END IF;
END $$;

-- 1c. Compliance events — comprehensive pre/during/post contact audit trail
-- 7-year retention per FDCPA requirement
CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES collection_accounts(id) ON DELETE SET NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,  -- 'pre_dial_check', 'dnc_blocked', 'time_blocked', 'frequency_blocked', 'mini_miranda', 'disclosure_given', 'consent_captured', 'dispute_filed'
  severity TEXT NOT NULL DEFAULT 'info',  -- 'info', 'warning', 'violation', 'block'
  passed BOOLEAN NOT NULL DEFAULT true,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'compliance_events_org_isolation') THEN
    CREATE POLICY compliance_events_org_isolation ON compliance_events
      USING (organization_id = current_setting('app.organization_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compliance_events_org_type
  ON compliance_events (organization_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_events_account
  ON compliance_events (account_id, created_at DESC);

-- 1d. Add timezone + compliance columns to collection_accounts
DO $$
BEGIN
  -- Timezone for time-of-day enforcement (8am-9pm debtor local time)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_accounts' AND column_name = 'timezone') THEN
    ALTER TABLE collection_accounts ADD COLUMN timezone TEXT DEFAULT 'America/New_York';
  END IF;

  -- Do-not-call flag (quick per-account override, separate from org-wide DNC list)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_accounts' AND column_name = 'do_not_call') THEN
    ALTER TABLE collection_accounts ADD COLUMN do_not_call BOOLEAN DEFAULT false;
  END IF;

  -- Cease and desist / bankruptcy flags
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_accounts' AND column_name = 'cease_and_desist') THEN
    ALTER TABLE collection_accounts ADD COLUMN cease_and_desist BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_accounts' AND column_name = 'bankruptcy_flag') THEN
    ALTER TABLE collection_accounts ADD COLUMN bankruptcy_flag BOOLEAN DEFAULT false;
  END IF;

  -- Contact frequency tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_accounts' AND column_name = 'consent_status') THEN
    ALTER TABLE collection_accounts ADD COLUMN consent_status TEXT DEFAULT 'unknown';  -- 'verified', 'revoked', 'unknown'
  END IF;
END $$;

-- Index for pre-dial compliance lookups by phone number
CREATE INDEX IF NOT EXISTS idx_collection_accounts_phone_org
  ON collection_accounts (organization_id, primary_phone);

CREATE INDEX IF NOT EXISTS idx_collection_accounts_secondary_phone_org
  ON collection_accounts (organization_id, secondary_phone)
  WHERE secondary_phone IS NOT NULL;


-- ============================================================
-- PHASE 2: PAYMENT GAPS
-- ============================================================

-- 2a. Scheduled payments / payment plans
CREATE TABLE IF NOT EXISTS scheduled_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  scheduled_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  method TEXT DEFAULT 'stripe',   -- 'stripe', 'ach', 'manual'
  stripe_payment_intent_id TEXT,
  stripe_payment_method_id TEXT,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scheduled_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'scheduled_payments_org_isolation') THEN
    CREATE POLICY scheduled_payments_org_isolation ON scheduled_payments
      USING (organization_id = current_setting('app.organization_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scheduled_payments_due
  ON scheduled_payments (scheduled_date, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_payments_org_account
  ON scheduled_payments (organization_id, account_id);

-- 2b. Payment plans (parent record for grouped scheduled payments)
CREATE TABLE IF NOT EXISTS payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  installment_amount NUMERIC(12,2) NOT NULL,
  installment_count INTEGER NOT NULL,
  frequency TEXT DEFAULT 'monthly',  -- 'weekly', 'biweekly', 'monthly'
  start_date DATE NOT NULL,
  status TEXT DEFAULT 'active',  -- 'active', 'completed', 'defaulted', 'cancelled'
  stripe_payment_method_id TEXT,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  next_payment_date DATE,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'payment_plans_org_isolation') THEN
    CREATE POLICY payment_plans_org_isolation ON payment_plans
      USING (organization_id = current_setting('app.organization_id', true)::uuid);
  END IF;
END $$;

-- 2c. Dunning escalation tracking
CREATE TABLE IF NOT EXISTS dunning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  escalation_level TEXT DEFAULT 'reminder',  -- 'reminder', 'warning', 'final_notice', 'suspension'
  action_taken TEXT,  -- 'email_sent', 'subscription_paused', 'subscription_cancelled'
  next_action_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dunning_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'dunning_events_org_isolation') THEN
    CREATE POLICY dunning_events_org_isolation ON dunning_events
      USING (organization_id = current_setting('app.organization_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dunning_events_unresolved
  ON dunning_events (organization_id, resolved, next_action_at)
  WHERE resolved = false;

-- 2d. Add updated_at trigger for new tables
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_scheduled_payments') THEN
    CREATE TRIGGER set_updated_at_scheduled_payments
      BEFORE UPDATE ON scheduled_payments
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_payment_plans') THEN
    CREATE TRIGGER set_updated_at_payment_plans
      BEFORE UPDATE ON payment_plans
      FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;
END $$;

COMMIT;
