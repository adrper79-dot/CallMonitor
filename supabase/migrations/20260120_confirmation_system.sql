-- Confirmation System Migration
-- Purpose: Guided confirmation capture for AI Role compliance
-- Migration: 20260120_confirmation_system
-- Reference: WORD_IS_BOND_AI_ROLE_IMPLEMENTATION_PLAN.md Phase 2
-- ============================================================================
-- PHASE 2: GUIDED CONFIRMATION SYSTEM
-- ============================================================================
-- Per the AI Role Policy:
-- - Operators ask confirmation questions (not AI)
-- - AI guides/prompts the operator what to ask
-- - Human marks confirmations as captured
-- - System records timestamp linked to recording position
-- ============================================================================

-- ============================================================================
-- Table: call_confirmations
-- Tracks operator-captured confirmations during calls
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- What was confirmed
  confirmation_type TEXT NOT NULL CHECK (confirmation_type IN (
    'disclosure_accepted',    -- Call participant acknowledged disclosure
    'recording_consent',      -- Explicit consent to record
    'terms_agreed',           -- Terms and conditions acknowledged
    'price_confirmed',        -- Pricing/costs confirmed
    'scope_confirmed',        -- Scope of work/service confirmed
    'identity_verified',      -- Caller identity verified
    'authorization_given',    -- Authorization for action given
    'understanding_confirmed',-- Understanding of key terms confirmed
    'custom'                  -- Custom confirmation type
  )),
  confirmation_label TEXT,    -- Human-readable label for custom types
  prompt_text TEXT NOT NULL,  -- What the operator was prompted to ask
  
  -- Who confirmed
  confirmer_role TEXT NOT NULL CHECK (confirmer_role IN (
    'customer',      -- The called party/customer confirmed
    'operator',      -- The operator confirmed on behalf of org
    'third_party',   -- A third party on the call confirmed
    'both'           -- Both parties confirmed
  )),
  
  -- When and where in recording
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recording_timestamp_seconds DECIMAL(10,2),  -- Position in recording
  
  -- Verification metadata
  captured_by TEXT NOT NULL DEFAULT 'human' CHECK (captured_by IN (
    'human',    -- Human operator clicked to mark confirmed
    'system'    -- System auto-detected (e.g., keypress, voice)
  )),
  captured_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  verification_method TEXT CHECK (verification_method IN (
    'verbal',      -- Verbal confirmation heard
    'keypress',    -- DTMF keypress (e.g., "Press 1 to confirm")
    'biometric',   -- Voice biometric verification
    'document',    -- Document/ID verification
    'other'        -- Other verification method
  )),
  
  -- Optional notes
  notes TEXT,
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Table: confirmation_templates
-- Pre-defined confirmation prompts for operators
-- ============================================================================
CREATE TABLE IF NOT EXISTS confirmation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Template definition
  confirmation_type TEXT NOT NULL,
  label TEXT NOT NULL,           -- Display name
  prompt_text TEXT NOT NULL,     -- What to ask
  description TEXT,              -- Help text for operators
  icon TEXT DEFAULT '📋',        -- Icon for UI display
  
  -- Ordering and visibility
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,  -- Must be confirmed before call ends
  
  -- Use case filtering
  use_cases TEXT[] DEFAULT ARRAY['general'],  -- 'sales', 'support', 'compliance', etc.
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- Table: call_confirmation_checklists
-- Tracks which templates apply to which calls
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_confirmation_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES confirmation_templates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Not yet addressed
    'confirmed',   -- Confirmation captured
    'declined',    -- Party declined/refused
    'skipped',     -- Operator skipped (with reason)
    'not_applicable'  -- Not applicable to this call
  )),
  
  -- Link to actual confirmation if captured
  confirmation_id UUID REFERENCES call_confirmations(id) ON DELETE SET NULL,
  
  -- If skipped or declined
  skip_reason TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one checklist item per template per call
  UNIQUE(call_id, template_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- call_confirmations indexes
CREATE INDEX IF NOT EXISTS idx_call_confirmations_call_id 
  ON call_confirmations(call_id);
CREATE INDEX IF NOT EXISTS idx_call_confirmations_org_id 
  ON call_confirmations(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_confirmations_type 
  ON call_confirmations(confirmation_type);
CREATE INDEX IF NOT EXISTS idx_call_confirmations_confirmed_at 
  ON call_confirmations(confirmed_at DESC);

-- confirmation_templates indexes
CREATE INDEX IF NOT EXISTS idx_confirmation_templates_org_id 
  ON confirmation_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_templates_type 
  ON confirmation_templates(confirmation_type);
CREATE INDEX IF NOT EXISTS idx_confirmation_templates_active 
  ON confirmation_templates(is_active) WHERE is_active = true;

-- call_confirmation_checklists indexes
CREATE INDEX IF NOT EXISTS idx_confirmation_checklists_call_id 
  ON call_confirmation_checklists(call_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_checklists_status 
  ON call_confirmation_checklists(status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE call_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_confirmation_checklists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS "Users can view own org confirmations" ON call_confirmations;
DROP POLICY IF EXISTS "Users can create confirmations for own org" ON call_confirmations;
DROP POLICY IF EXISTS "Service role can manage confirmations" ON call_confirmations;

DROP POLICY IF EXISTS "Users can view own org templates" ON confirmation_templates;
DROP POLICY IF EXISTS "Admins can manage org templates" ON confirmation_templates;
DROP POLICY IF EXISTS "Service role can manage templates" ON confirmation_templates;

DROP POLICY IF EXISTS "Users can view own org checklists" ON call_confirmation_checklists;
DROP POLICY IF EXISTS "Users can update own org checklists" ON call_confirmation_checklists;
DROP POLICY IF EXISTS "Service role can manage checklists" ON call_confirmation_checklists;

-- call_confirmations policies
CREATE POLICY "Users can view own org confirmations"
  ON call_confirmations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create confirmations for own org"
  ON call_confirmations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage confirmations"
  ON call_confirmations FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- confirmation_templates policies
CREATE POLICY "Users can view own org templates"
  ON confirmation_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage org templates"
  ON confirmation_templates FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM org_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role can manage templates"
  ON confirmation_templates FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- call_confirmation_checklists policies
CREATE POLICY "Users can view own org checklists"
  ON call_confirmation_checklists FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org checklists"
  ON call_confirmation_checklists FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage checklists"
  ON call_confirmation_checklists FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- DEFAULT CONFIRMATION TEMPLATES (System-wide)
-- ============================================================================
-- These are inserted as organization-agnostic defaults
-- Organizations can customize by creating their own templates

-- Note: We use a special 'system' organization ID pattern for shared templates
-- Actual implementation should use a dedicated system org or handle via app logic

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_call_confirmations_updated_at ON call_confirmations;
CREATE TRIGGER set_call_confirmations_updated_at
  BEFORE UPDATE ON call_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_confirmation_templates_updated_at ON confirmation_templates;
CREATE TRIGGER set_confirmation_templates_updated_at
  BEFORE UPDATE ON confirmation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_confirmation_checklists_updated_at ON call_confirmation_checklists;
CREATE TRIGGER set_confirmation_checklists_updated_at
  BEFORE UPDATE ON call_confirmation_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE call_confirmations IS 
  'Tracks operator-captured confirmations during calls. Per AI Role Policy: operators ask questions, humans answer, operators mark captured.';

COMMENT ON TABLE confirmation_templates IS 
  'Pre-defined confirmation prompts that guide operators on what to ask during calls.';

COMMENT ON TABLE call_confirmation_checklists IS 
  'Links confirmation templates to specific calls, tracking completion status.';

COMMENT ON COLUMN call_confirmations.captured_by IS 
  'Who/what marked this confirmation - "human" for operator click, "system" for auto-detection';

COMMENT ON COLUMN call_confirmations.recording_timestamp_seconds IS 
  'Position in the call recording where confirmation was given, for evidence linking';

COMMENT ON COLUMN confirmation_templates.is_required IS 
  'If true, operator must address this confirmation before call can be completed';
