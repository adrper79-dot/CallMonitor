-- Migration: Add ElevenLabs audio URL to translations
-- Date: 2026-01-12
-- Purpose: Store ElevenLabs-generated audio URLs for translated text

-- Add translated_audio_url column to ai_runs output (stored in JSONB)
-- This is a soft-schema change - no ALTER needed since output is JSONB
-- The column will be accessed via: ai_runs.output->>'translated_audio_url'

-- However, for documentation and future indexing, we can add a comment
COMMENT ON COLUMN ai_runs.output IS 
  'JSON output from AI run. For translations, includes:
  - translated_text: The translated text (string)
  - translated_audio_url: ElevenLabs-generated audio URL (string, optional)
  - tts_provider: TTS provider used (e.g., "elevenlabs")
  - provider: Translation provider used (e.g., "openai")
  - from_language: Source language code
  - to_language: Target language code
  - source_text: Original text';

-- Create index on ai_runs for faster translation queries
CREATE INDEX IF NOT EXISTS idx_ai_runs_model_status 
  ON ai_runs(model, status) 
  WHERE model = 'translation';

-- Add GIN index for JSONB output field (for faster JSON queries)
CREATE INDEX IF NOT EXISTS idx_ai_runs_output_gin 
  ON ai_runs USING gin(output);

-- Verify migration
DO $$
BEGIN
  -- Check that ai_runs table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_runs') THEN
    RAISE EXCEPTION 'ai_runs table does not exist';
  END IF;
  
  -- Check that output column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_runs' 
    AND column_name = 'output'
  ) THEN
    RAISE EXCEPTION 'ai_runs.output column does not exist';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully';
END $$;
