-- Migration: Add call_sid to calls for canonical mapping from recordings.call_sid -> calls.id
-- Run with psql or your migration tool.

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS call_sid text;

-- Ensure uniqueness so we can map a call_sid -> single calls.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='calls_call_sid_idx'
  ) THEN
    CREATE UNIQUE INDEX calls_call_sid_idx ON public.calls(call_sid);
  END IF;
END$$;

-- Note: Backfill may be required depending on existing data. No backfill performed here.
