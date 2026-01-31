-- AI Quality Evaluation Compliance Migration
-- Purpose: Phase 4 - Secret Shopper repositioned as AI Quality Evaluation
-- Migration: 20260127_ai_quality_evaluation
-- Reference: WORD_IS_BOND_AI_ROLE_IMPLEMENTATION_PLAN.md Phase 4
-- ============================================================================
-- PHASE 4: SECRET SHOPPER → AI QUALITY EVALUATION
-- ============================================================================
-- Per the AI Role Policy:
-- - Secret Shopper is repositioned as "AI Quality Evaluation"
-- - Used for INTERNAL QA purposes only, NOT customer-facing agreements
-- - Calls include disclosure that this is an AI-assisted evaluation
-- - AI acts as evaluator/observer, NOT as a negotiating party
-- - Feature cannot be combined with agreement/confirmation capture
-- ============================================================================

-- ============================================================================
-- Table: qa_evaluation_disclosures
-- Tracks QA evaluation disclosures for AI Role compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS qa_evaluation_disclosures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Disclosure details
  disclosure_type TEXT NOT NULL DEFAULT 'qa_evaluation' CHECK (disclosure_type IN (
    'qa_evaluation',      -- Standard QA evaluation disclosure
    'internal_audit',     -- Internal audit disclosure
    'training'            -- Training/learning disclosure
  )),
  disclosure_text TEXT NOT NULL,
  
  -- When disclosure was given
  disclosed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disclosure_position_seconds DECIMAL(10,2), -- Position in recording
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Table: compliance_restrictions
-- Tracks restrictions on feature combinations
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Restriction definition
  restriction_code TEXT NOT NULL UNIQUE CHECK (restriction_code IN (
    'QA_NO_CONFIRMATIONS',    -- QA eval calls cannot capture confirmations
    'QA_NO_OUTCOMES',         -- QA eval calls cannot have outcome declarations
    'QA_NO_AGREEMENTS',       -- QA eval calls cannot record agreements
    'SURVEY_NO_AGREEMENTS',   -- Survey calls are feedback only
    'AI_NO_NEGOTIATION'       -- AI never negotiates
  )),
  restriction_name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- What happens on violation
  violation_action TEXT NOT NULL DEFAULT 'warn' CHECK (violation_action IN (
    'block',    -- Block the action entirely
    'warn',     -- Allow but warn operator
    'log'       -- Allow but log for audit
  )),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Table: compliance_violations
-- Logs potential compliance violations for audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Violation details
  restriction_code TEXT NOT NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN (
    'blocked',      -- Action was blocked
    'warned',       -- User was warned but proceeded
    'detected',     -- Violation detected post-hoc
    'prevented'     -- System prevented automatically
  )),
  violation_context JSONB,  -- Additional context about what was attempted
  
  -- Resolution
  resolution_status TEXT DEFAULT 'open' CHECK (resolution_status IN (
    'open',         -- Not yet addressed
    'reviewed',     -- Reviewed by admin
    'dismissed',    -- Dismissed as false positive
    'confirmed'     -- Confirmed as violation
  )),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_qa_disclosures_call_id ON qa_evaluation_disclosures(call_id);
CREATE INDEX IF NOT EXISTS idx_qa_disclosures_org_id ON qa_evaluation_disclosures(organization_id);
CREATE INDEX IF NOT EXISTS idx_qa_disclosures_disclosed_at ON qa_evaluation_disclosures(disclosed_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_restrictions_code ON compliance_restrictions(restriction_code);
CREATE INDEX IF NOT EXISTS idx_compliance_restrictions_active ON compliance_restrictions(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_compliance_violations_call_id ON compliance_violations(call_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_org_id ON compliance_violations(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_status ON compliance_violations(resolution_status);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_created_at ON compliance_violations(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE qa_evaluation_disclosures ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_violations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS "Users can view own org QA disclosures" ON qa_evaluation_disclosures;
DROP POLICY IF EXISTS "Service role can manage QA disclosures" ON qa_evaluation_disclosures;

DROP POLICY IF EXISTS "Users can view compliance restrictions" ON compliance_restrictions;
DROP POLICY IF EXISTS "Service role can manage restrictions" ON compliance_restrictions;

DROP POLICY IF EXISTS "Users can view own org violations" ON compliance_violations;
DROP POLICY IF EXISTS "Admins can manage violations" ON compliance_violations;
DROP POLICY IF EXISTS "Service role can manage violations" ON compliance_violations;

-- qa_evaluation_disclosures policies
CREATE POLICY "Users can view own org QA disclosures"
  ON qa_evaluation_disclosures FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE auth.user_equals_auth(user_id::text)
    )
  );

CREATE POLICY "Service role can manage QA disclosures"
  ON qa_evaluation_disclosures FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- compliance_restrictions policies (read-only for users)
CREATE POLICY "Users can view compliance restrictions"
  ON compliance_restrictions FOR SELECT
  USING (true);  -- All users can view restrictions

CREATE POLICY "Service role can manage restrictions"
  ON compliance_restrictions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- compliance_violations policies
CREATE POLICY "Users can view own org violations"
  ON compliance_violations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE auth.user_equals_auth(user_id::text)
    )
  );

CREATE POLICY "Admins can manage violations"
  ON compliance_violations FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM org_members om
      WHERE auth.user_equals_auth(om.user_id::text) 
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role can manage violations"
  ON compliance_violations FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- DEFAULT COMPLIANCE RESTRICTIONS
-- ============================================================================

INSERT INTO compliance_restrictions (
  organization_id, 
  restriction_code, 
  restriction_name, 
  description, 
  violation_action
)
SELECT 
  o.id,
  r.code,
  r.name,
  r.description,
  r.action
FROM organizations o
CROSS JOIN (
  VALUES 
    ('QA_NO_CONFIRMATIONS', 'QA calls cannot capture confirmations', 
     'AI Quality Evaluation calls are for internal QA purposes only. Confirmation capture should not be enabled on QA evaluation calls as they do not involve actual customer agreements.', 'warn'),
    ('QA_NO_OUTCOMES', 'QA calls cannot have outcome declarations',
     'AI Quality Evaluation calls should not have outcome declarations as they are evaluations, not real business transactions.', 'warn'),
    ('SURVEY_NO_AGREEMENTS', 'Survey calls are feedback only',
     'Survey calls are for collecting feedback and do not constitute contractual agreements. Confirmation capture should not be enabled.', 'warn'),
    ('AI_NO_NEGOTIATION', 'AI never negotiates',
     'AI must never negotiate on behalf of any party. All negotiations must be conducted by humans.', 'block')
) AS r(code, name, description, action)
ON CONFLICT (restriction_code) DO NOTHING;

-- ============================================================================
-- FUNCTION: check_qa_compliance
-- Checks if a call violates QA compliance rules
-- ============================================================================
CREATE OR REPLACE FUNCTION check_qa_compliance(
  p_call_id UUID,
  p_feature TEXT
) RETURNS JSONB AS $$
DECLARE
  v_call RECORD;
  v_restriction RECORD;
  v_violation_id UUID;
BEGIN
  -- Get call details
  SELECT c.*, vc.synthetic_caller, vc.survey
  INTO v_call
  FROM calls c
  LEFT JOIN voice_configs vc ON vc.organization_id = c.organization_id
  WHERE c.id = p_call_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'Call not found');
  END IF;
  
  -- Check if this is a QA evaluation call (synthetic_caller enabled)
  IF v_call.synthetic_caller AND p_feature IN ('confirmation', 'outcome') THEN
    -- Get the restriction
    SELECT * INTO v_restriction
    FROM compliance_restrictions
    WHERE restriction_code = 
      CASE 
        WHEN p_feature = 'confirmation' THEN 'QA_NO_CONFIRMATIONS'
        WHEN p_feature = 'outcome' THEN 'QA_NO_OUTCOMES'
      END
    AND is_active = true
    LIMIT 1;
    
    IF FOUND THEN
      -- Log the violation
      INSERT INTO compliance_violations (
        organization_id,
        call_id,
        restriction_code,
        violation_type,
        violation_context
      ) VALUES (
        v_call.organization_id,
        p_call_id,
        v_restriction.restriction_code,
        CASE v_restriction.violation_action
          WHEN 'block' THEN 'blocked'
          WHEN 'warn' THEN 'warned'
          ELSE 'detected'
        END,
        jsonb_build_object(
          'feature_attempted', p_feature,
          'call_type', 'qa_evaluation',
          'timestamp', now()
        )
      )
      RETURNING id INTO v_violation_id;
      
      RETURN jsonb_build_object(
        'allowed', v_restriction.violation_action != 'block',
        'warning', v_restriction.violation_action = 'warn',
        'restriction_code', v_restriction.restriction_code,
        'restriction_name', v_restriction.restriction_name,
        'description', v_restriction.description,
        'violation_id', v_violation_id
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE qa_evaluation_disclosures IS 
  'Tracks QA evaluation disclosures. Per AI Role Policy: QA evaluations must disclose that the call is for internal evaluation purposes only.';

COMMENT ON TABLE compliance_restrictions IS 
  'Defines compliance restrictions for AI Role Policy. Prevents conflicting features from being used together.';

COMMENT ON TABLE compliance_violations IS 
  'Logs potential compliance violations for audit. Used to track and review any policy conflicts.';

COMMENT ON FUNCTION check_qa_compliance IS 
  'Checks if a call operation violates AI Role Policy compliance rules. Returns whether action is allowed and any warnings.';

