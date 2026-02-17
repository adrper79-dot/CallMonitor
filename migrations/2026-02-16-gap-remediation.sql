-- Migration: Gap Analysis Remediation
-- Date: 2026-02-16
-- Closes: Dispute auto-pause, consent records, legal escalation, settlement offers
-- Reference: ARCH_DOCS/08-COMPLIANCE/GAP_ANALYSIS_CORRECTED.md

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CONSENT RECORDS TABLE
-- Replaces scattered consent flags with proper evidence chain
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'granted', 'revoked', 'renewed', 'expired', 'verbal_yes', 'written', 'ivr_confirm', 'dtmf_confirm'
  )),
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'call_recording', 'outbound_contact', 'sms_contact', 'email_contact', 'payment_processing', 'data_sharing'
  )),
  source TEXT NOT NULL CHECK (source IN (
    'inbound_call', 'outbound_call', 'web_form', 'written_letter', 'agent_entry', 'ivr', 'api', 'import'
  )),
  evidence_reference TEXT, -- e.g., recording ID, document URL, timestamp offset
  notes TEXT,
  ip_address TEXT, -- for web-form consent
  user_agent TEXT, -- for web-form consent
  expires_at TIMESTAMPTZ, -- optional expiry
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_account
  ON consent_records (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_records_org
  ON consent_records (organization_id, consent_type, event_type);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_records_org_isolation ON consent_records;
CREATE POLICY consent_records_org_isolation ON consent_records
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. LEGAL ESCALATIONS TABLE
-- Tracks accounts escalated to legal/litigation with full checklist
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS legal_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'review', 'approved', 'referred', 'filed', 'judgment', 'dismissed', 'settled', 'withdrawn'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  reason TEXT NOT NULL,
  attorney_name TEXT,
  attorney_email TEXT,
  attorney_phone TEXT,
  law_firm TEXT,
  case_number TEXT,
  court_name TEXT,
  filing_date TIMESTAMPTZ,
  hearing_date TIMESTAMPTZ,
  judgment_amount DECIMAL(12,2),
  -- Checklist fields (FDCPA pre-litigation requirements)
  checklist_demand_letter_sent BOOLEAN DEFAULT false,
  checklist_demand_letter_date TIMESTAMPTZ,
  checklist_validation_completed BOOLEAN DEFAULT false,
  checklist_dispute_period_expired BOOLEAN DEFAULT false,
  checklist_statute_of_limitations_checked BOOLEAN DEFAULT false,
  checklist_sol_expiry_date DATE,
  checklist_documentation_complete BOOLEAN DEFAULT false,
  checklist_compliance_review_passed BOOLEAN DEFAULT false,
  checklist_supervisor_approved BOOLEAN DEFAULT false,
  checklist_supervisor_id UUID,
  checklist_supervisor_approved_at TIMESTAMPTZ,
  notes TEXT,
  escalated_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_escalations_account
  ON legal_escalations (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_escalations_org_status
  ON legal_escalations (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_legal_escalations_hearing
  ON legal_escalations (hearing_date) WHERE hearing_date IS NOT NULL AND status NOT IN ('dismissed', 'settled', 'withdrawn');

ALTER TABLE legal_escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_escalations_org_isolation ON legal_escalations;
CREATE POLICY legal_escalations_org_isolation ON legal_escalations
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SETTLEMENT OFFERS TABLE
-- Backend storage for settlement negotiation workflow
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS settlement_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed', 'counter_offered', 'accepted', 'rejected', 'expired', 'paid', 'voided'
  )),
  -- Amounts
  original_balance DECIMAL(12,2) NOT NULL,
  proposed_amount DECIMAL(12,2) NOT NULL,
  counter_amount DECIMAL(12,2),
  accepted_amount DECIMAL(12,2),
  discount_percent DECIMAL(5,2),
  -- Terms
  payment_terms TEXT CHECK (payment_terms IN ('lump_sum', 'installment_2', 'installment_3', 'installment_6', 'installment_12', 'custom')),
  installment_count INTEGER,
  first_payment_due DATE,
  -- Authority
  requires_approval BOOLEAN DEFAULT false,
  authority_limit DECIMAL(12,2), -- max the agent can approve without supervisor
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  -- Expiry
  valid_until TIMESTAMPTZ,
  -- Resolution
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  -- Metadata
  proposed_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_offers_account
  ON settlement_offers (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_offers_org_status
  ON settlement_offers (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_settlement_offers_expiry
  ON settlement_offers (valid_until) WHERE status = 'proposed' AND valid_until IS NOT NULL;

ALTER TABLE settlement_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settlement_offers_org_isolation ON settlement_offers;
CREATE POLICY settlement_offers_org_isolation ON settlement_offers
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. DISPUTE WORKFLOW COLUMNS
-- Add validation tracking to collection_disputes
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE collection_disputes ADD COLUMN IF NOT EXISTS legal_hold_id UUID REFERENCES legal_holds(id) ON DELETE SET NULL;
ALTER TABLE collection_disputes ADD COLUMN IF NOT EXISTS validation_letter_sent BOOLEAN DEFAULT false;
ALTER TABLE collection_disputes ADD COLUMN IF NOT EXISTS validation_letter_date TIMESTAMPTZ;
ALTER TABLE collection_disputes ADD COLUMN IF NOT EXISTS validation_due_date TIMESTAMPTZ;
ALTER TABLE collection_disputes ADD COLUMN IF NOT EXISTS auto_hold_applied BOOLEAN DEFAULT false;
