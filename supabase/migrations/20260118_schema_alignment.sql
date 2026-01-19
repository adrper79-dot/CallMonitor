-- Add missing columns to align code with schema expectations
-- Migration: 20260118_schema_alignment.sql

-- 1. Add call_id to recordings table for direct FK to calls
-- (Currently recordings only has call_sid which is a text field)
ALTER TABLE recordings 
ADD COLUMN IF NOT EXISTS call_id UUID REFERENCES calls(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_recordings_call_id ON recordings(call_id);

-- 2. Add job_id to ai_runs table for vendor job tracking
-- (Currently code stores this but column doesn't exist)
ALTER TABLE ai_runs
ADD COLUMN IF NOT EXISTS job_id TEXT;

-- Create index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_ai_runs_job_id ON ai_runs(job_id);

-- 3. Backfill call_id in recordings from call_sid
-- Match recordings.call_sid to calls.call_sid to populate recordings.call_id
UPDATE recordings r
SET call_id = c.id
FROM calls c
WHERE r.call_sid = c.call_sid
  AND r.call_id IS NULL
  AND r.call_sid IS NOT NULL;

-- Note: This migration aligns the schema with code expectations.
-- Code correctly uses:
--   - recordings.call_id for FK joins
--   - ai_runs.job_id for vendor tracking
-- Both patterns are correct per ARCH_DOCS principles where calls is the central node.
