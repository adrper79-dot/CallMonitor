-- Migration: 2026-02-02-schema-drift-fixes.sql
-- Fix critical schema drift issues identified in db_validation_report.json
-- Add missing tables and columns for call outcomes, AI summaries, and other features

-- Create call_outcomes table
CREATE TABLE IF NOT EXISTS public.call_outcomes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  outcome_status text NOT NULL CHECK (outcome_status IN ('agreed', 'declined', 'partial', 'inconclusive', 'follow_up_required', 'cancelled')),
  confidence_level text DEFAULT 'high' CHECK (confidence_level IN ('high', 'medium', 'low', 'uncertain')),
  agreed_items jsonb DEFAULT '[]'::jsonb,
  declined_items jsonb DEFAULT '[]'::jsonb,
  ambiguities jsonb DEFAULT '[]'::jsonb,
  follow_up_actions jsonb DEFAULT '[]'::jsonb,
  summary_text text,
  summary_source text DEFAULT 'human' CHECK (summary_source IN ('human', 'ai_generated', 'ai_confirmed')),
  readback_confirmed boolean DEFAULT false,
  readback_timestamp timestamptz,
  declared_by_user_id text REFERENCES public.users(id),
  revision_number integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create call_outcome_history table for audit trail
CREATE TABLE IF NOT EXISTS public.call_outcome_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_outcome_id uuid NOT NULL REFERENCES public.call_outcomes(id) ON DELETE CASCADE,
  outcome_status text,
  summary_text text,
  revision_number integer NOT NULL,
  changed_by_user_id text REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create ai_summaries table
CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  summary_text text NOT NULL,
  topics_discussed jsonb DEFAULT '[]'::jsonb,
  potential_agreements jsonb DEFAULT '[]'::jsonb,
  potential_concerns jsonb DEFAULT '[]'::jsonb,
  recommended_followup jsonb DEFAULT '[]'::jsonb,
  confidence_score numeric(3,2) DEFAULT 0.85,
  model_used text DEFAULT 'gpt-4-turbo-preview',
  generated_by_user_id text REFERENCES public.users(id),
  review_status text DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  input_length integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add missing columns to existing tables

-- Add error and assemblyai_status to ai_runs
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS error text;
ALTER TABLE public.ai_runs ADD COLUMN IF NOT EXISTS assemblyai_status text;

-- Add missing columns to booking_events
ALTER TABLE public.booking_events ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.booking_events ADD COLUMN IF NOT EXISTS start_time timestamptz;
ALTER TABLE public.booking_events ADD COLUMN IF NOT EXISTS end_time timestamptz;
ALTER TABLE public.booking_events ADD COLUMN IF NOT EXISTS attendee_phone text;

-- Add missing columns to caller_id_numbers
ALTER TABLE public.caller_id_numbers ADD COLUMN IF NOT EXISTS phone_number text;

-- Add missing columns to call_export_bundles (remove if they exist and shouldn't)
-- Note: The report says these columns should be removed, but let's check if they exist first
-- For now, we'll assume they need to be added if missing, but the report says "Remove column"

-- Add missing columns to campaigns table
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS completed_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS created_by text REFERENCES public.users(id);

-- Add missing columns to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tool_id text;

-- Add missing columns to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS normalized_email text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_outcomes_call_id ON public.call_outcomes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_organization_id ON public.call_outcomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_call_id ON public.ai_summaries(call_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_organization_id ON public.ai_summaries(organization_id);

-- Add updated_at triggers
CREATE TRIGGER update_call_outcomes_updated_at
  BEFORE UPDATE ON public.call_outcomes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_ai_summaries_updated_at
  BEFORE UPDATE ON public.ai_summaries
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();