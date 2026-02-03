-- Disclosure Tracking Migration
-- Purpose: Track AI disclosures for compliance with AI Role Policy
-- Migration: 20260118_disclosure_tracking
-- Reference: WORD_IS_BOND_AI_ROLE_IMPLEMENTATION_PLAN.md Phase 1

-- ============================================================================
-- AI ROLE COMPLIANCE: Disclosure Tracking
-- ============================================================================
-- Per the AI Role Policy, the system must track when disclosures are given.
-- Disclosures are procedural (not contractual) and include:
-- - Recording disclosure (before recording begins)
-- - Survey disclosure (automated survey, not agreement)
-- - Translation disclosure (AI-assisted, may not capture nuances)
-- - QA Evaluation disclosure (internal purposes only)
-- ============================================================================

-- Add disclosure tracking columns to calls table
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS disclosure_type TEXT CHECK (disclosure_type IN (
  'recording',           -- Standard recording disclosure
  'survey',              -- Automated survey disclosure  
  'translation',         -- AI translation disclosure
  'qa_evaluation',       -- Quality assurance evaluation
  'multi'                -- Multiple disclosures given
)),
ADD COLUMN IF NOT EXISTS disclosure_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS disclosure_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS disclosure_text TEXT;

-- Index for disclosure tracking queries
CREATE INDEX IF NOT EXISTS idx_calls_disclosure_given 
ON calls(disclosure_given) 
WHERE disclosure_given = true;

-- Add disclosure tracking to recordings table for audit trail
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS disclosure_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS disclosure_type TEXT;

-- ============================================================================
-- CONSENT TRACKING ENHANCEMENT
-- ============================================================================
-- Existing consent_method enum already supports 'ivr_played' for disclosures.
-- Add audit log support for disclosure events.

-- Create disclosure_logs table for compliance audit trail
CREATE TABLE IF NOT EXISTS disclosure_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  
  -- Disclosure details
  disclosure_type TEXT NOT NULL CHECK (disclosure_type IN (
    'recording', 'survey', 'translation', 'qa_evaluation', 'multi'
  )),
  disclosure_text TEXT NOT NULL,
  
  -- When and how
  disclosed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disclosure_method TEXT NOT NULL DEFAULT 'tts' CHECK (disclosure_method IN (
    'tts',           -- Text-to-speech (AI voice)
    'prerecorded',   -- Pre-recorded audio file
    'ivr',           -- IVR system
    'agent'          -- Human agent read disclosure
  )),
  
  -- Verification
  caller_response TEXT,  -- 'continued', 'disconnected', 'acknowledged'
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for disclosure_logs
CREATE INDEX IF NOT EXISTS idx_disclosure_logs_org_id ON disclosure_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_logs_call_id ON disclosure_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_logs_type ON disclosure_logs(disclosure_type);
CREATE INDEX IF NOT EXISTS idx_disclosure_logs_disclosed_at ON disclosure_logs(disclosed_at DESC);

-- Enable RLS
ALTER TABLE disclosure_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own organization disclosure logs" ON disclosure_logs;
DROP POLICY IF EXISTS "Service role can manage disclosure logs" ON disclosure_logs;

-- RLS Policies
CREATE POLICY "Users can view own organization disclosure logs"
  ON disclosure_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage disclosure logs"
  ON disclosure_logs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Comments for documentation
COMMENT ON TABLE disclosure_logs IS 'Audit trail for AI disclosures per AI Role Policy compliance';
COMMENT ON COLUMN disclosure_logs.disclosure_type IS 'Type of disclosure: recording, survey, translation, qa_evaluation, or multi';
COMMENT ON COLUMN disclosure_logs.disclosure_method IS 'How disclosure was delivered: tts, prerecorded, ivr, or agent';
COMMENT ON COLUMN calls.disclosure_given IS 'Whether disclosure was provided before call processing';
COMMENT ON COLUMN calls.disclosure_type IS 'Type of disclosure given for this call';
