-- Migration: Post-Transcription Pipeline Enhancement
-- Date: 2026-02-11
-- Phase 1: Add columns for AssemblyAI enrichment data (speaker utterances, highlights, sentiment)
-- Phase 3: Add inbound_phone_numbers table for DID-to-org routing

-- ============================================================
-- Phase 1: Post-Transcription Enrichment Columns on calls
-- ============================================================

-- Speaker utterances from AssemblyAI (array of {speaker, text, start, end, confidence, sentiment})
ALTER TABLE calls ADD COLUMN IF NOT EXISTS speaker_utterances jsonb;

-- Auto-highlights from AssemblyAI (key phrases, important moments)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS auto_highlights jsonb;

-- AssemblyAI sentiment results (per-sentence sentiment array)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS assemblyai_sentiment jsonb;

-- Transcription completed timestamp (for pipeline metrics)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription_completed_at timestamptz;

-- ============================================================
-- Phase 3: Inbound Phone Numbers — DID-to-Organization Mapping
-- ============================================================

CREATE TABLE IF NOT EXISTS inbound_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  label text,                          -- e.g., "Main Office", "Collections Line"
  routing_type text NOT NULL DEFAULT 'round_robin',  -- round_robin, specific_agent, ivr
  routing_target_id uuid,              -- agent user_id if routing_type = 'specific_agent'
  auto_record boolean NOT NULL DEFAULT true,
  auto_transcribe boolean NOT NULL DEFAULT true,
  greeting_text text,                  -- IVR greeting to play on answer
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_inbound_phone_number UNIQUE (phone_number)
);

-- RLS policy: org-scoped access
ALTER TABLE inbound_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY inbound_phone_numbers_org_isolation ON inbound_phone_numbers
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- Index for fast phone number lookup during inbound call routing
CREATE INDEX IF NOT EXISTS idx_inbound_phone_org ON inbound_phone_numbers(phone_number, organization_id) WHERE is_active = true;

-- Index for transcription pipeline metrics
CREATE INDEX IF NOT EXISTS idx_calls_transcription_completed ON calls(transcription_completed_at) WHERE transcription_completed_at IS NOT NULL;

-- Add updated_at trigger for inbound_phone_numbers
CREATE OR REPLACE TRIGGER set_inbound_phone_numbers_updated_at
  BEFORE UPDATE ON inbound_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
