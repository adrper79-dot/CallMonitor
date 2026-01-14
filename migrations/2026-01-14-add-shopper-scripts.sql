-- Migration: Add Secret Shopper Script Infrastructure
-- Date: January 14, 2026
-- Purpose: Enable configurable scripts for synthetic callers and scoring

-- Add shopper script fields to voice_configs
ALTER TABLE public.voice_configs
  ADD COLUMN IF NOT EXISTS shopper_script text,
  ADD COLUMN IF NOT EXISTS shopper_script_name text,
  ADD COLUMN IF NOT EXISTS shopper_persona text DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS shopper_expected_outcomes jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS shopper_scoring_weights jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS shopper_voice text DEFAULT 'rime.spore';

COMMENT ON COLUMN public.voice_configs.shopper_script IS 'The script that the synthetic caller follows';
COMMENT ON COLUMN public.voice_configs.shopper_script_name IS 'Friendly name for this script';
COMMENT ON COLUMN public.voice_configs.shopper_persona IS 'Caller persona: professional, casual, frustrated, etc.';
COMMENT ON COLUMN public.voice_configs.shopper_expected_outcomes IS 'Expected outcomes for scoring (keywords, sentiment, duration, etc.)';
COMMENT ON COLUMN public.voice_configs.shopper_scoring_weights IS 'Weights for each scoring criterion';
COMMENT ON COLUMN public.voice_configs.shopper_voice IS 'TTS voice for the synthetic caller (SignalWire/ElevenLabs)';

-- Create shopper_scripts table for managing multiple scripts
CREATE TABLE IF NOT EXISTS public.shopper_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  
  -- Script details
  name text NOT NULL,
  description text,
  script_text text NOT NULL,
  persona text DEFAULT 'professional',
  
  -- Voice configuration
  tts_provider text DEFAULT 'signalwire' CHECK (tts_provider IN ('signalwire', 'elevenlabs', 'assemblyai')),
  tts_voice text DEFAULT 'rime.spore',
  elevenlabs_voice_id text,  -- For ElevenLabs voice cloning
  
  -- Scoring criteria
  expected_outcomes jsonb DEFAULT '[]',
  scoring_weights jsonb DEFAULT '{}',
  
  -- Example: expected_outcomes = [
  --   { "type": "keyword", "value": ["appointment", "available"], "weight": 30 },
  --   { "type": "sentiment", "value": "positive", "weight": 40 },
  --   { "type": "duration_min", "value": 60, "weight": 20 },
  --   { "type": "response_time", "value": 5, "weight": 10 }
  -- ]
  
  -- Metadata
  is_active boolean DEFAULT true,
  use_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id)
);

-- Add comments
COMMENT ON TABLE public.shopper_scripts IS 'Secret shopper scripts for synthetic caller evaluations';
COMMENT ON COLUMN public.shopper_scripts.script_text IS 'The conversation script - what the synthetic caller says';
COMMENT ON COLUMN public.shopper_scripts.persona IS 'Caller persona affects tone: professional, casual, frustrated, elderly, non-native';
COMMENT ON COLUMN public.shopper_scripts.tts_provider IS 'Text-to-speech provider: signalwire (default), elevenlabs (premium), assemblyai';
COMMENT ON COLUMN public.shopper_scripts.expected_outcomes IS 'What we expect from the call for scoring';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shopper_scripts_org_id ON public.shopper_scripts(organization_id);
CREATE INDEX IF NOT EXISTS idx_shopper_scripts_active ON public.shopper_scripts(organization_id) WHERE is_active = true;

-- Create shopper_results table for tracking evaluations
CREATE TABLE IF NOT EXISTS public.shopper_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  call_id uuid REFERENCES public.calls(id),
  recording_id uuid REFERENCES public.recordings(id),
  script_id uuid REFERENCES public.shopper_scripts(id),
  
  -- Scoring results
  overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100),
  sentiment_score text,  -- positive, negative, neutral
  sentiment_confidence numeric(4,3),
  
  -- Detailed breakdown
  outcome_results jsonb DEFAULT '[]',
  -- Example: [
  --   { "type": "keyword", "passed": true, "score": 30, "details": "Found: appointment, available" },
  --   { "type": "sentiment", "passed": true, "score": 40, "details": "Positive sentiment detected" }
  -- ]
  
  -- Transcript analysis
  keywords_found text[],
  key_phrases text[],
  issues_detected text[],
  
  -- Timing
  first_response_time_ms integer,  -- Time until first substantive response
  hold_time_total_seconds integer,
  
  -- Metadata
  evaluated_at timestamptz DEFAULT now(),
  evaluated_by text DEFAULT 'system',  -- 'system' or user_id
  notes text
);

-- Add comments
COMMENT ON TABLE public.shopper_results IS 'Secret shopper evaluation results and scores';
COMMENT ON COLUMN public.shopper_results.overall_score IS 'Final score 0-100 based on weighted outcomes';
COMMENT ON COLUMN public.shopper_results.outcome_results IS 'Detailed breakdown of each expected outcome check';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shopper_results_org_id ON public.shopper_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_shopper_results_call_id ON public.shopper_results(call_id);
CREATE INDEX IF NOT EXISTS idx_shopper_results_score ON public.shopper_results(overall_score);

-- Add script_id to voice_configs for linking active script
ALTER TABLE public.voice_configs
  ADD COLUMN IF NOT EXISTS script_id uuid REFERENCES public.shopper_scripts(id);

COMMENT ON COLUMN public.voice_configs.script_id IS 'Active shopper script for this organization';

-- Update trigger for shopper_scripts
CREATE OR REPLACE FUNCTION update_shopper_scripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shopper_scripts_updated_at ON public.shopper_scripts;
CREATE TRIGGER shopper_scripts_updated_at
  BEFORE UPDATE ON public.shopper_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_shopper_scripts_updated_at();
