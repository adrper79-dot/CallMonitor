-- Migration: Add live translation tracking fields to recordings table
-- Date: 2026-01-12
-- Purpose: Track which calls used SignalWire AI Agent for live translation
-- Per: ARCH_DOCS/02-FEATURES/Translation_Agent

-- Add live translation tracking columns
ALTER TABLE recordings 
  ADD COLUMN IF NOT EXISTS has_live_translation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_translation_provider TEXT CHECK (
    live_translation_provider IN ('signalwire') OR 
    live_translation_provider IS NULL
  );

-- Add comments for documentation
COMMENT ON COLUMN recordings.has_live_translation IS 
  'Indicates if live translation was executed during the call (SignalWire AI Agent). 
   This is execution-only metadata - canonical transcripts always come from AssemblyAI.';

COMMENT ON COLUMN recordings.live_translation_provider IS 
  'Provider that executed live translation. Currently only "signalwire" is supported.
   This is non-authoritative - used for debugging and feature tracking only.';

-- Add index for queries filtering by live translation
CREATE INDEX IF NOT EXISTS idx_recordings_live_translation 
  ON recordings(has_live_translation) 
  WHERE has_live_translation = true;

-- Add composite index for organization + live translation queries
CREATE INDEX IF NOT EXISTS idx_recordings_org_live_translation 
  ON recordings(organization_id, has_live_translation) 
  WHERE has_live_translation = true;

-- Verify migration
DO $$
BEGIN
  -- Check that recordings table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'recordings'
  ) THEN
    RAISE EXCEPTION 'recordings table does not exist';
  END IF;
  
  -- Check that has_live_translation column was added
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recordings' 
    AND column_name = 'has_live_translation'
  ) THEN
    RAISE EXCEPTION 'has_live_translation column was not added';
  END IF;
  
  -- Check that live_translation_provider column was added
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recordings' 
    AND column_name = 'live_translation_provider'
  ) THEN
    RAISE EXCEPTION 'live_translation_provider column was not added';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE 'Columns added: has_live_translation, live_translation_provider';
  RAISE NOTICE 'Indexes created: idx_recordings_live_translation, idx_recordings_org_live_translation';
END $$;

-- Query to verify existing recordings are NOT affected
SELECT 
  COUNT(*) as total_recordings,
  COUNT(*) FILTER (WHERE has_live_translation = true) as with_live_translation,
  COUNT(*) FILTER (WHERE has_live_translation = false) as without_live_translation
FROM recordings;

-- Expected: All existing recordings have has_live_translation = false (default)
