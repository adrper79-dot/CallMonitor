-- Migration: Add Authority Metadata
-- Date: 2026-01-15
-- Purpose: Add explicit authority markers for System of Record positioning
-- Reference: ARCH_DOCS/01-CORE/ARTIFACT_AUTHORITY_CONTRACT.md

BEGIN;

-- =============================================================================
-- RECORDINGS: Add authority metadata
-- =============================================================================

-- is_authoritative: TRUE for all recordings (source media is always authoritative)
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS is_authoritative boolean NOT NULL DEFAULT TRUE;

-- produced_by: Who created this recording (signalwire, webrtc, upload)
-- Note: 'source' column already exists from system-of-record-compliance.sql
-- We'll use that for producer attribution

-- immutability_policy: Level of mutability allowed
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS immutability_policy text NOT NULL DEFAULT 'immutable'
    CHECK (immutability_policy IN ('immutable', 'limited', 'mutable'));

-- Add comment explaining columns
COMMENT ON COLUMN public.recordings.is_authoritative IS 
  'TRUE if this recording is canonical evidence (always TRUE for recordings)';
COMMENT ON COLUMN public.recordings.immutability_policy IS 
  'Level of mutability: immutable (no changes), limited (status only), mutable (full CRUD)';

-- =============================================================================
-- TRANSCRIPT_VERSIONS: Add authority metadata
-- =============================================================================

-- is_authoritative: TRUE for AssemblyAI canonical transcripts
ALTER TABLE public.transcript_versions
  ADD COLUMN IF NOT EXISTS is_authoritative boolean NOT NULL DEFAULT TRUE;

-- immutability_policy: Transcripts are always immutable (append-only versioning)
ALTER TABLE public.transcript_versions
  ADD COLUMN IF NOT EXISTS immutability_policy text NOT NULL DEFAULT 'immutable'
    CHECK (immutability_policy IN ('immutable', 'limited', 'mutable'));

-- Add comment explaining columns
COMMENT ON COLUMN public.transcript_versions.is_authoritative IS 
  'TRUE if this is the canonical transcript (AssemblyAI). FALSE for draft/preview transcripts.';
COMMENT ON COLUMN public.transcript_versions.immutability_policy IS 
  'Always immutable - use versioning for changes';

-- =============================================================================
-- EVIDENCE_MANIFESTS: Add authority metadata
-- =============================================================================

-- is_authoritative: TRUE for all evidence manifests
ALTER TABLE public.evidence_manifests
  ADD COLUMN IF NOT EXISTS is_authoritative boolean NOT NULL DEFAULT TRUE;

-- produced_by: System CAS (content-addressable storage)
ALTER TABLE public.evidence_manifests
  ADD COLUMN IF NOT EXISTS produced_by text NOT NULL DEFAULT 'system_cas';

-- immutability_policy: Always immutable
ALTER TABLE public.evidence_manifests
  ADD COLUMN IF NOT EXISTS immutability_policy text NOT NULL DEFAULT 'immutable'
    CHECK (immutability_policy IN ('immutable', 'limited', 'mutable'));

-- cryptographic_hash: SHA256 of manifest content for integrity verification
ALTER TABLE public.evidence_manifests
  ADD COLUMN IF NOT EXISTS cryptographic_hash text;

-- Add comments
COMMENT ON COLUMN public.evidence_manifests.is_authoritative IS 
  'TRUE for all evidence manifests (canonical provenance records)';
COMMENT ON COLUMN public.evidence_manifests.produced_by IS 
  'Producer: system_cas (content-addressable storage)';
COMMENT ON COLUMN public.evidence_manifests.cryptographic_hash IS 
  'SHA256 hash of manifest content for integrity verification';

-- =============================================================================
-- AI_RUNS: Add authority metadata
-- =============================================================================

-- is_authoritative: FALSE by default (AI outputs are processing records, not evidence)
ALTER TABLE public.ai_runs
  ADD COLUMN IF NOT EXISTS is_authoritative boolean NOT NULL DEFAULT FALSE;

-- produced_by: The AI model/worker that produced this run
ALTER TABLE public.ai_runs
  ADD COLUMN IF NOT EXISTS produced_by text;

-- Add comments
COMMENT ON COLUMN public.ai_runs.is_authoritative IS 
  'FALSE by default - AI runs are execution records, not canonical evidence';
COMMENT ON COLUMN public.ai_runs.produced_by IS 
  'The AI model or worker that produced this run (e.g., assemblyai, openai-gpt4)';

-- =============================================================================
-- CALLS: Add authority metadata (limited mutability)
-- =============================================================================

-- is_authoritative: TRUE (root entity is always authoritative)
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS is_authoritative boolean NOT NULL DEFAULT TRUE;

-- immutability_policy: Limited (only status/ended_at can change)
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS immutability_policy text NOT NULL DEFAULT 'limited'
    CHECK (immutability_policy IN ('immutable', 'limited', 'mutable'));

-- Add comments
COMMENT ON COLUMN public.calls.is_authoritative IS 
  'TRUE - calls are the root entity and always authoritative';
COMMENT ON COLUMN public.calls.immutability_policy IS 
  'Limited - only status, ended_at, call_sid can be updated';

-- =============================================================================
-- CREATE INDEXES FOR AUTHORITY FILTERING
-- =============================================================================

-- Index for filtering authoritative recordings
CREATE INDEX IF NOT EXISTS idx_recordings_authoritative 
  ON public.recordings (is_authoritative) 
  WHERE is_authoritative = TRUE;

-- Index for filtering authoritative transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_authoritative 
  ON public.transcript_versions (is_authoritative) 
  WHERE is_authoritative = TRUE;

-- Index for filtering authoritative evidence manifests
CREATE INDEX IF NOT EXISTS idx_evidence_manifests_authoritative 
  ON public.evidence_manifests (is_authoritative) 
  WHERE is_authoritative = TRUE;

-- =============================================================================
-- UPDATE EXISTING RECORDS
-- =============================================================================

-- Ensure all existing recordings are marked as authoritative
UPDATE public.recordings 
SET is_authoritative = TRUE, immutability_policy = 'immutable'
WHERE is_authoritative IS NULL OR immutability_policy IS NULL;

-- Ensure all existing transcripts are marked as authoritative
UPDATE public.transcript_versions 
SET is_authoritative = TRUE, immutability_policy = 'immutable'
WHERE is_authoritative IS NULL OR immutability_policy IS NULL;

-- Ensure all existing evidence manifests are marked as authoritative
UPDATE public.evidence_manifests 
SET is_authoritative = TRUE, produced_by = 'system_cas', immutability_policy = 'immutable'
WHERE is_authoritative IS NULL OR immutability_policy IS NULL;

-- Mark AI runs as non-authoritative by default
UPDATE public.ai_runs 
SET is_authoritative = FALSE
WHERE is_authoritative IS NULL;

-- Mark calls as authoritative with limited mutability
UPDATE public.calls 
SET is_authoritative = TRUE, immutability_policy = 'limited'
WHERE is_authoritative IS NULL OR immutability_policy IS NULL;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================

-- Verify authority columns exist and have values
-- SELECT 
--   'recordings' as table_name,
--   COUNT(*) as total_rows,
--   COUNT(*) FILTER (WHERE is_authoritative = TRUE) as authoritative_rows,
--   COUNT(*) FILTER (WHERE immutability_policy = 'immutable') as immutable_rows
-- FROM recordings
-- UNION ALL
-- SELECT 
--   'transcript_versions',
--   COUNT(*),
--   COUNT(*) FILTER (WHERE is_authoritative = TRUE),
--   COUNT(*) FILTER (WHERE immutability_policy = 'immutable')
-- FROM transcript_versions
-- UNION ALL
-- SELECT 
--   'evidence_manifests',
--   COUNT(*),
--   COUNT(*) FILTER (WHERE is_authoritative = TRUE),
--   COUNT(*) FILTER (WHERE immutability_policy = 'immutable')
-- FROM evidence_manifests
-- UNION ALL
-- SELECT 
--   'ai_runs',
--   COUNT(*),
--   COUNT(*) FILTER (WHERE is_authoritative = FALSE),
--   0 -- ai_runs don't have immutability_policy
-- FROM ai_runs
-- UNION ALL
-- SELECT 
--   'calls',
--   COUNT(*),
--   COUNT(*) FILTER (WHERE is_authoritative = TRUE),
--   COUNT(*) FILTER (WHERE immutability_policy = 'limited')
-- FROM calls;
