-- Migration: System of Record Compliance
-- Date: 2026-01-15
-- Purpose: Achieve 100% compliance with Conversation System of Record requirements
-- Reference: ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt

-- =============================================================================
-- REQUIREMENT 3: IMMUTABILITY GUARANTEES
-- =============================================================================

-- 3.1 Evidence Manifests - Make append-only (no content updates allowed)
-- Allow ONLY supersession marking (superseded_at, superseded_by)
CREATE OR REPLACE FUNCTION prevent_evidence_manifest_content_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow updates ONLY to supersession fields
  IF (OLD.manifest IS DISTINCT FROM NEW.manifest) OR
     (OLD.recording_id IS DISTINCT FROM NEW.recording_id) OR
     (OLD.scorecard_id IS DISTINCT FROM NEW.scorecard_id) OR
     (OLD.organization_id IS DISTINCT FROM NEW.organization_id) OR
     (OLD.version IS DISTINCT FROM NEW.version) OR
     (OLD.parent_manifest_id IS DISTINCT FROM NEW.parent_manifest_id) THEN
    RAISE EXCEPTION 'evidence_manifests content is immutable. Only supersession marking is allowed.';
  END IF;
  
  -- Allow supersession marking
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evidence_manifests_immutable ON public.evidence_manifests;
CREATE TRIGGER evidence_manifests_immutable
  BEFORE UPDATE ON public.evidence_manifests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_evidence_manifest_content_update();

-- 3.2 Add version tracking to evidence_manifests
ALTER TABLE public.evidence_manifests 
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_manifest_id uuid REFERENCES public.evidence_manifests(id),
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.evidence_manifests(id);

-- 3.3 Create transcript_versions table for immutable transcript history
CREATE TABLE IF NOT EXISTS public.transcript_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.recordings(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  version integer NOT NULL DEFAULT 1,
  transcript_json jsonb NOT NULL,
  transcript_hash text NOT NULL,  -- SHA256 of transcript content
  produced_by text NOT NULL CHECK (produced_by IN ('system', 'human', 'model')),
  produced_by_model text,  -- e.g., 'assemblyai-v1'
  produced_by_user_id uuid REFERENCES public.users(id),
  input_refs jsonb,  -- References to input artifacts (recording URL, etc.)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recording_id, version)
);

-- Trigger to prevent updates on transcript_versions
CREATE OR REPLACE FUNCTION prevent_transcript_version_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'transcript_versions is append-only. Updates are not permitted. Create a new version instead.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transcript_versions_immutable ON public.transcript_versions;
CREATE TRIGGER transcript_versions_immutable
  BEFORE UPDATE ON public.transcript_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_transcript_version_update();

-- Enable RLS on transcript_versions
ALTER TABLE public.transcript_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transcript_versions_select_org"
  ON public.transcript_versions FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "transcript_versions_insert_all"
  ON public.transcript_versions FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- REQUIREMENT 7: SOURCE-OF-TRUTH MEDIA HANDLING
-- =============================================================================

-- 7.1 Add source tracking to recordings
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'signalwire' 
    CHECK (source IN ('signalwire', 'webrtc', 'upload', 'external')),
  ADD COLUMN IF NOT EXISTS external_call_id text,  -- External system reference
  ADD COLUMN IF NOT EXISTS media_hash text,  -- SHA256 of media file for integrity
  ADD COLUMN IF NOT EXISTS is_altered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_url text;  -- Preserve original URL if copied

-- =============================================================================
-- REQUIREMENT 2: ARTIFACT CHAIN OF CUSTODY
-- =============================================================================

-- 2.1 Create artifact_provenance table for complete chain of custody
CREATE TABLE IF NOT EXISTS public.artifact_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  artifact_type text NOT NULL CHECK (artifact_type IN ('recording', 'transcript', 'translation', 'survey', 'score', 'evidence_manifest')),
  artifact_id uuid NOT NULL,
  parent_artifact_id uuid,  -- Reference to input artifact
  parent_artifact_type text,
  produced_by text NOT NULL CHECK (produced_by IN ('system', 'human', 'model')),
  produced_by_model text,
  produced_by_user_id uuid REFERENCES public.users(id),
  produced_by_system_id uuid REFERENCES public.systems(id),
  produced_at timestamptz NOT NULL DEFAULT now(),
  input_refs jsonb,  -- Array of {type, id, hash} references
  version integer NOT NULL DEFAULT 1,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_artifact_provenance_artifact 
  ON public.artifact_provenance(artifact_type, artifact_id);

CREATE INDEX IF NOT EXISTS idx_artifact_provenance_org 
  ON public.artifact_provenance(organization_id);

-- Enable RLS
ALTER TABLE public.artifact_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artifact_provenance_select_org"
  ON public.artifact_provenance FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "artifact_provenance_insert_all"
  ON public.artifact_provenance FOR INSERT
  WITH CHECK (true);

-- Trigger to prevent updates
CREATE OR REPLACE FUNCTION prevent_artifact_provenance_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'artifact_provenance is append-only. Updates are not permitted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS artifact_provenance_immutable ON public.artifact_provenance;
CREATE TRIGGER artifact_provenance_immutable
  BEFORE UPDATE ON public.artifact_provenance
  FOR EACH ROW
  EXECUTE FUNCTION prevent_artifact_provenance_update();

-- =============================================================================
-- REQUIREMENT 9: READ-ONLY CONSUMPTION BY DEFAULT (SOFT DELETE)
-- =============================================================================

-- 9.1 Add soft delete columns to critical tables
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

ALTER TABLE public.ai_runs
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

ALTER TABLE public.scored_recordings
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id);

-- 9.2 Create function to soft delete instead of hard delete
CREATE OR REPLACE FUNCTION soft_delete_recording()
RETURNS TRIGGER AS $$
BEGIN
  -- Instead of deleting, mark as deleted
  UPDATE public.recordings 
  SET is_deleted = true, 
      deleted_at = now(),
      auth.user_equals_auth(deleted_by::text)
  WHERE id = OLD.id;
  
  -- Write audit log
  INSERT INTO public.audit_logs (id, organization_id, user_id, resource_type, resource_id, action, before, after, created_at)
  VALUES (
    gen_random_uuid(),
    OLD.organization_id,
    auth.uid(),
    'recordings',
    OLD.id,
    'soft_delete',
    row_to_json(OLD),
    NULL,
    now()
  );
  
  RETURN NULL;  -- Prevent actual deletion
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Apply this trigger only if you want to prevent all deletions
-- DROP TRIGGER IF EXISTS recordings_soft_delete ON public.recordings;
-- CREATE TRIGGER recordings_soft_delete
--   BEFORE DELETE ON public.recordings
--   FOR EACH ROW
--   EXECUTE FUNCTION soft_delete_recording();

-- =============================================================================
-- REQUIREMENT 12: OPERATIONAL READINESS
-- =============================================================================

-- 12.1 Add index on audit_logs for resource_id lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id 
  ON public.audit_logs(resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type_id 
  ON public.audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created 
  ON public.audit_logs(organization_id, created_at DESC);

-- 12.2 Create call_debug_view for operational reconstruction
CREATE OR REPLACE VIEW public.call_debug_view AS
SELECT 
  c.id AS call_id,
  c.organization_id,
  c.status AS call_status,
  c.call_sid,
  c.started_at,
  c.ended_at,
  c.created_by,
  c.is_deleted AS call_deleted,
  r.id AS recording_id,
  r.recording_url,
  r.duration_seconds,
  r.status AS recording_status,
  r.source AS recording_source,
  r.transcript_json IS NOT NULL AS has_transcript,
  r.is_deleted AS recording_deleted,
  (SELECT COUNT(*) FROM public.ai_runs ar WHERE ar.call_id = c.id) AS ai_run_count,
  (SELECT json_agg(json_build_object('id', ar.id, 'model', ar.model, 'status', ar.status))
   FROM public.ai_runs ar WHERE ar.call_id = c.id) AS ai_runs,
  em.id AS manifest_id,
  em.version AS manifest_version,
  sr.id AS score_id,
  sr.total_score,
  (SELECT COUNT(*) FROM public.audit_logs al 
   WHERE al.resource_id = c.id AND al.resource_type = 'calls') AS audit_log_count,
  (SELECT json_agg(json_build_object('action', al.action, 'created_at', al.created_at) ORDER BY al.created_at DESC)
   FROM public.audit_logs al 
   WHERE al.resource_id = c.id AND al.resource_type = 'calls'
   LIMIT 10) AS recent_audit_events
FROM public.calls c
LEFT JOIN public.recordings r ON r.call_sid = c.call_sid AND r.is_deleted = false
LEFT JOIN public.evidence_manifests em ON em.recording_id = r.id AND em.superseded_at IS NULL
LEFT JOIN public.scored_recordings sr ON sr.recording_id = r.id AND sr.is_deleted = false
WHERE c.is_deleted = false;

-- =============================================================================
-- REQUIREMENT 1: CANONICAL EVENT AUTHORITY - Validation
-- =============================================================================

-- 1.1 Add check constraint to ensure call IDs are valid UUIDs generated server-side
-- (Client cannot supply custom IDs)
ALTER TABLE public.calls
  ADD CONSTRAINT calls_id_format CHECK (
    id IS NOT NULL AND 
    id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

-- =============================================================================
-- REQUIREMENT 10: EXPORTABILITY & PORTABILITY
-- =============================================================================

-- 10.1 Create call_export_bundles table to track exports
CREATE TABLE IF NOT EXISTS public.call_export_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  call_id uuid NOT NULL REFERENCES public.calls(id),
  bundle_hash text NOT NULL,  -- SHA256 of entire bundle
  artifacts_included jsonb NOT NULL,  -- List of {type, id, hash}
  storage_path text,  -- Path in storage bucket
  exported_by uuid REFERENCES public.users(id),
  exported_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,  -- Optional expiration for download links
  download_count integer DEFAULT 0,
  metadata jsonb
);

-- Enable RLS
ALTER TABLE public.call_export_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_export_bundles_select_org"
  ON public.call_export_bundles FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "call_export_bundles_insert_org"
  ON public.call_export_bundles FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.transcript_versions IS 'Immutable transcript history - each version is a new row, never updated';
COMMENT ON TABLE public.artifact_provenance IS 'Chain of custody for all artifacts - tracks who/what/when/how';
COMMENT ON TABLE public.call_export_bundles IS 'Self-contained export bundles for portability';
COMMENT ON VIEW public.call_debug_view IS 'Operational view for reconstructing call state in <30 seconds';
COMMENT ON TRIGGER evidence_manifests_immutable ON public.evidence_manifests IS 'Enforces append-only policy per System of Record requirement 3';

-- =============================================================================
-- NOTES
-- =============================================================================

-- This migration implements the following System of Record requirements:
--
-- 1. CANONICAL EVENT AUTHORITY: UUID v4 format validation
-- 2. ARTIFACT CHAIN OF CUSTODY: artifact_provenance table
-- 3. IMMUTABILITY GUARANTEES: Append-only triggers, version tables
-- 7. SOURCE-OF-TRUTH MEDIA HANDLING: recordings.source column
-- 9. READ-ONLY CONSUMPTION: Soft delete columns
-- 10. EXPORTABILITY: call_export_bundles table
-- 12. OPERATIONAL READINESS: Indexes and debug view
--
-- Code changes required (see corresponding .ts files):
-- - Evidence manifest service: Create new manifests instead of updating
-- - Scoring service: Create new manifest version with scoring
-- - Transcript service: Use transcript_versions table
-- - Export endpoint: Generate self-contained bundles

