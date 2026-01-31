-- Call Outcomes Migration
-- Purpose: Outcome Declaration System for AI Role compliance
-- Migration: 20260127_call_outcomes
-- Reference: WORD_IS_BOND_AI_ROLE_IMPLEMENTATION_PLAN.md Phase 3
-- ============================================================================
-- PHASE 3: OUTCOME DECLARATION SYSTEM
-- ============================================================================
-- Per the AI Role Policy:
-- - Humans declare outcomes, not AI
-- - AI may assist with summary generation, but humans verify and confirm
-- - System records what was agreed/not agreed/ambiguous
-- - Read-back confirmation captures when summary was read to customer
-- ============================================================================

-- ============================================================================
-- Table: call_outcomes
-- Stores human-declared outcomes for calls
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID UNIQUE NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Outcome summary status
  outcome_status TEXT NOT NULL CHECK (outcome_status IN (
    'agreed',           -- All parties agreed on terms
    'declined',         -- Customer/party declined
    'partial',          -- Some items agreed, some not
    'inconclusive',     -- No clear outcome
    'pending_review',   -- Needs management review
    'follow_up_required'-- Requires follow-up call
  )),
  
  -- What was agreed (array of items)
  -- Format: [{ "term": "string", "confirmed": boolean, "timestamp_seconds": number }]
  agreed_items JSONB DEFAULT '[]'::jsonb,
  
  -- What was NOT agreed/declined
  -- Format: [{ "term": "string", "reason": "string", "timestamp_seconds": number }]
  declined_items JSONB DEFAULT '[]'::jsonb,
  
  -- Ambiguities flagged for review
  -- Format: [{ "issue": "string", "context": "string", "timestamp_seconds": number }]
  ambiguities JSONB DEFAULT '[]'::jsonb,
  
  -- Follow-up actions
  -- Format: [{ "action": "string", "due_date": "string", "assignee": "string" }]
  follow_up_actions JSONB DEFAULT '[]'::jsonb,
  
  -- Summary for record
  summary_text TEXT,
  summary_source TEXT DEFAULT 'human' CHECK (summary_source IN (
    'human',            -- Human-written summary
    'ai_generated',     -- AI-generated, unconfirmed
    'ai_confirmed'      -- AI-generated, human-confirmed
  )),
  
  -- Who declared the outcome (must be human)
  declared_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Read-back confirmation
  -- When the summary was read back to customer for confirmation
  readback_confirmed BOOLEAN DEFAULT false,
  readback_timestamp_seconds DECIMAL(10,2),
  readback_confirmed_by TEXT,  -- 'customer', 'operator', 'both'
  
  -- Outcome confidence
  confidence_level TEXT DEFAULT 'high' CHECK (confidence_level IN (
    'high',       -- Clear, explicit agreement/decline
    'medium',     -- Implicit or somewhat ambiguous
    'low',        -- Needs review, many uncertainties
    'disputed'    -- Parties disagree on outcome
  )),
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Table: call_outcome_history
-- Tracks revisions to outcomes for audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_outcome_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id UUID NOT NULL REFERENCES call_outcomes(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- What changed
  revision_number INT NOT NULL DEFAULT 1,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  
  -- Snapshot of key fields at this revision
  agreed_items_snapshot JSONB,
  declined_items_snapshot JSONB,
  summary_snapshot TEXT,
  
  -- Change metadata
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Table: ai_summaries
-- Stores AI-generated summaries for human review
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Summary content
  summary_text TEXT NOT NULL,
  
  -- Structured extraction
  topics_discussed JSONB DEFAULT '[]'::jsonb,        -- string[]
  potential_agreements JSONB DEFAULT '[]'::jsonb,    -- string[]
  potential_concerns JSONB DEFAULT '[]'::jsonb,      -- string[]
  recommended_followup JSONB DEFAULT '[]'::jsonb,    -- string[]
  
  -- Generation metadata
  model_used TEXT,                      -- e.g., 'gpt-4', 'gpt-4-turbo'
  input_tokens INT,
  output_tokens INT,
  generation_time_ms INT,
  
  -- Human review status
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN (
    'pending',          -- Not yet reviewed
    'approved',         -- Human approved as accurate
    'edited',           -- Human edited before approval
    'rejected'          -- Human rejected as inaccurate
  )),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  
  -- Edited version if modified
  edited_summary_text TEXT,
  
  -- Warning flags
  warnings JSONB DEFAULT '[]'::jsonb,   -- Array of warning messages
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- call_outcomes indexes
CREATE INDEX IF NOT EXISTS idx_call_outcomes_call_id 
  ON call_outcomes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_org_id 
  ON call_outcomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_status 
  ON call_outcomes(outcome_status);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_declared_at 
  ON call_outcomes(declared_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_declared_by 
  ON call_outcomes(declared_by);

-- call_outcome_history indexes
CREATE INDEX IF NOT EXISTS idx_outcome_history_outcome_id 
  ON call_outcome_history(outcome_id);
CREATE INDEX IF NOT EXISTS idx_outcome_history_call_id 
  ON call_outcome_history(call_id);
CREATE INDEX IF NOT EXISTS idx_outcome_history_changed_at 
  ON call_outcome_history(changed_at DESC);

-- ai_summaries indexes
CREATE INDEX IF NOT EXISTS idx_ai_summaries_call_id 
  ON ai_summaries(call_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_org_id 
  ON ai_summaries(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_review_status 
  ON ai_summaries(review_status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE call_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_outcome_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS "Users can view own org outcomes" ON call_outcomes;
DROP POLICY IF EXISTS "Users can create outcomes for own org" ON call_outcomes;
DROP POLICY IF EXISTS "Users can update own org outcomes" ON call_outcomes;
DROP POLICY IF EXISTS "Service role can manage outcomes" ON call_outcomes;

DROP POLICY IF EXISTS "Users can view own org outcome history" ON call_outcome_history;
DROP POLICY IF EXISTS "Service role can manage outcome history" ON call_outcome_history;

DROP POLICY IF EXISTS "Users can view own org summaries" ON ai_summaries;
DROP POLICY IF EXISTS "Users can create summaries for own org" ON ai_summaries;
DROP POLICY IF EXISTS "Users can update own org summaries" ON ai_summaries;
DROP POLICY IF EXISTS "Service role can manage summaries" ON ai_summaries;

-- call_outcomes policies
CREATE POLICY "Users can view own org outcomes"
  ON call_outcomes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create outcomes for own org"
  ON call_outcomes FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org outcomes"
  ON call_outcomes FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage outcomes"
  ON call_outcomes FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- call_outcome_history policies
CREATE POLICY "Users can view own org outcome history"
  ON call_outcome_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage outcome history"
  ON call_outcome_history FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ai_summaries policies
CREATE POLICY "Users can view own org summaries"
  ON ai_summaries FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create summaries for own org"
  ON ai_summaries FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org summaries"
  ON ai_summaries FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage summaries"
  ON ai_summaries FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at for call_outcomes
DROP TRIGGER IF EXISTS set_call_outcomes_updated_at ON call_outcomes;
CREATE TRIGGER set_call_outcomes_updated_at
  BEFORE UPDATE ON call_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for ai_summaries
DROP TRIGGER IF EXISTS set_ai_summaries_updated_at ON ai_summaries;
CREATE TRIGGER set_ai_summaries_updated_at
  BEFORE UPDATE ON ai_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Log outcome changes to history
-- ============================================================================
CREATE OR REPLACE FUNCTION log_outcome_change()
RETURNS TRIGGER AS $$
DECLARE
  revision INT;
BEGIN
  -- Get next revision number
  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO revision
  FROM call_outcome_history
  WHERE outcome_id = NEW.id;
  
  -- Insert history record
  INSERT INTO call_outcome_history (
    outcome_id,
    call_id,
    organization_id,
    revision_number,
    previous_status,
    new_status,
    agreed_items_snapshot,
    declined_items_snapshot,
    summary_snapshot,
    changed_by,
    change_reason
  ) VALUES (
    NEW.id,
    NEW.call_id,
    NEW.organization_id,
    revision,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.outcome_status ELSE NULL END,
    NEW.outcome_status,
    NEW.agreed_items,
    NEW.declined_items,
    NEW.summary_text,
    NEW.declared_by,
    CASE WHEN TG_OP = 'INSERT' THEN 'Initial declaration' ELSE 'Updated' END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log changes
DROP TRIGGER IF EXISTS log_outcome_changes ON call_outcomes;
CREATE TRIGGER log_outcome_changes
  AFTER INSERT OR UPDATE ON call_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION log_outcome_change();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE call_outcomes IS 
  'Stores human-declared outcomes for calls. Per AI Role Policy: humans declare outcomes, AI only assists.';

COMMENT ON TABLE call_outcome_history IS 
  'Audit trail of all outcome revisions for compliance and dispute resolution.';

COMMENT ON TABLE ai_summaries IS 
  'AI-generated summaries that require human review before becoming official.';

COMMENT ON COLUMN call_outcomes.summary_source IS 
  'Indicates whether summary was human-written, AI-generated (unconfirmed), or AI-generated and human-confirmed.';

COMMENT ON COLUMN call_outcomes.readback_confirmed IS 
  'Whether the summary was read back to the customer for verbal confirmation.';

COMMENT ON COLUMN ai_summaries.review_status IS 
  'Human review status: pending, approved, edited, or rejected. AI summaries are not official until approved.';
