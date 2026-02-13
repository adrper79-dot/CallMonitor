-- Migration: Dialer Schema Alignment
-- Date: 2026-02-12
-- Purpose: Add columns required by the dialer engine and webhook handlers.
-- Idempotent: safe to re-run.

-- Columns written by dialNumber() in dialer-engine.ts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='direction') THEN
    ALTER TABLE public.calls ADD COLUMN direction text DEFAULT 'inbound';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='from_number') THEN
    ALTER TABLE public.calls ADD COLUMN from_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='to_number') THEN
    ALTER TABLE public.calls ADD COLUMN to_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='campaign_id') THEN
    ALTER TABLE public.calls ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id);
  END IF;

  -- Columns written by Telnyx origination response (calls.ts + dialer-engine)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='call_control_id') THEN
    ALTER TABLE public.calls ADD COLUMN call_control_id text;
  END IF;

  -- Columns written by webhook handlers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='amd_status') THEN
    ALTER TABLE public.calls ADD COLUMN amd_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='hangup_cause') THEN
    ALTER TABLE public.calls ADD COLUMN hangup_cause text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='answered_at') THEN
    ALTER TABLE public.calls ADD COLUMN answered_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calls' AND column_name='bridge_partner_id') THEN
    ALTER TABLE public.calls ADD COLUMN bridge_partner_id text;
  END IF;
END $$;

-- Index for Telnyx webhook lookups (call_control_id + call_sid)
CREATE INDEX IF NOT EXISTS idx_calls_call_control_id ON public.calls (call_control_id) WHERE call_control_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON public.calls (call_sid) WHERE call_sid IS NOT NULL;

-- Index for dialer campaign call lookups
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON public.calls (campaign_id) WHERE campaign_id IS NOT NULL;

-- Relax campaign_calls.outcome CHECK to accept dialer outcomes
-- Drop the existing constraint if it exists, then re-add with expanded values
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'campaign_calls' AND column_name = 'outcome') THEN
    ALTER TABLE public.campaign_calls DROP CONSTRAINT IF EXISTS campaign_calls_outcome_check;
  END IF;
END $$;

ALTER TABLE public.campaign_calls
  ADD CONSTRAINT campaign_calls_outcome_check
  CHECK (outcome IN ('answered', 'no_answer', 'busy', 'failed', 'error', 'connected', 'voicemail', 'fax', 'compliance_blocked'))
  NOT VALID;

-- Table for transcript segments (used by transcript polling + future SSE)
CREATE TABLE IF NOT EXISTS public.call_transcript_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.calls(id),
  organization_id uuid NOT NULL,
  speaker text DEFAULT 'unknown',         -- 'agent', 'customer', 'unknown'
  content text NOT NULL,
  confidence real,
  segment_index integer DEFAULT 0,
  timestamp_ms integer,                   -- offset into call in ms
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_transcript_segments_call_id
  ON public.call_transcript_segments (call_id, segment_index);
