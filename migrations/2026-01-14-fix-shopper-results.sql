-- Fix: Add missing columns to shopper_results table
-- Run this if you get "column does not exist" errors

-- Drop the incomplete table and recreate it
DROP TABLE IF EXISTS public.shopper_results CASCADE;

-- Recreate shopper_results with all columns
CREATE TABLE public.shopper_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  call_id uuid REFERENCES public.calls(id),
  recording_id uuid REFERENCES public.recordings(id),
  script_id uuid REFERENCES public.shopper_scripts(id),
  
  -- Scoring results
  overall_score integer,
  sentiment_score text,
  sentiment_confidence numeric(4,3),
  
  -- Detailed breakdown
  outcome_results jsonb DEFAULT '[]',
  
  -- Transcript analysis
  keywords_found text[],
  key_phrases text[],
  issues_detected text[],
  
  -- Timing
  first_response_time_ms integer,
  hold_time_total_seconds integer,
  
  -- Metadata
  evaluated_at timestamptz DEFAULT now(),
  evaluated_by text DEFAULT 'system',
  notes text
);

-- Add constraint after table creation (avoids error if column doesn't exist)
ALTER TABLE public.shopper_results 
  ADD CONSTRAINT shopper_results_overall_score_check 
  CHECK (overall_score >= 0 AND overall_score <= 100);

-- Add comments
COMMENT ON TABLE public.shopper_results IS 'Secret shopper evaluation results and scores';
COMMENT ON COLUMN public.shopper_results.overall_score IS 'Final score 0-100 based on weighted outcomes';
COMMENT ON COLUMN public.shopper_results.outcome_results IS 'Detailed breakdown of each expected outcome check';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shopper_results_org_id ON public.shopper_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_shopper_results_call_id ON public.shopper_results(call_id);
CREATE INDEX IF NOT EXISTS idx_shopper_results_score ON public.shopper_results(overall_score);
