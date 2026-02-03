-- Migration: Add live translation fields to recordings table
-- Per TRANSLATION_AGENT_IMPLEMENTATION_PLAN.md Phase 1 Task 1.1
-- Run with: psql "$DATABASE_URL" -f migrations/2026-01-14-add-live-translation-fields.sql

-- Add live translation tracking columns to recordings table
ALTER TABLE public.recordings 
  ADD COLUMN IF NOT EXISTS has_live_translation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_translation_provider TEXT CHECK (live_translation_provider IN ('signalwire') OR live_translation_provider IS NULL);

-- Add column comments for documentation
COMMENT ON COLUMN public.recordings.has_live_translation IS 'Indicates if live translation was executed during the call (SignalWire AI Agent)';
COMMENT ON COLUMN public.recordings.live_translation_provider IS 'Provider that executed live translation (currently only signalwire)';

-- Create index for querying recordings with live translation
CREATE INDEX IF NOT EXISTS idx_recordings_has_live_translation ON public.recordings(organization_id, has_live_translation) WHERE has_live_translation = true;
