-- Migration: Add Evidence Bundles (Custody-Grade)
-- Date: 2026-01-16
-- Purpose: Introduce evidence bundles with hash + RFC3161 TSA support
-- Reference: ARCH_DOCS/01-CORE/THE_FINAL_ARCHITECTURE_MINIMAL_ADDITIONS.md

BEGIN;

-- =============================================================================
-- EVIDENCE_BUNDLES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.evidence_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  call_id uuid NOT NULL REFERENCES public.calls(id),
  recording_id uuid REFERENCES public.recordings(id),
  manifest_id uuid NOT NULL REFERENCES public.evidence_manifests(id),
  manifest_hash text NOT NULL,
  artifact_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  bundle_payload jsonb NOT NULL,
  bundle_hash text NOT NULL,
  bundle_hash_algo text NOT NULL DEFAULT 'sha256',
  version integer NOT NULL DEFAULT 1,
  parent_bundle_id uuid REFERENCES public.evidence_bundles(id),
  superseded_at timestamptz,
  superseded_by uuid REFERENCES public.evidence_bundles(id),
  immutable_storage boolean NOT NULL DEFAULT true,
  is_authoritative boolean NOT NULL DEFAULT true,
  produced_by text NOT NULL DEFAULT 'system_cas',
  immutability_policy text NOT NULL DEFAULT 'immutable'
    CHECK (immutability_policy IN ('immutable', 'limited', 'mutable')),
  tsa jsonb,
  tsa_status text NOT NULL DEFAULT 'not_configured'
    CHECK (tsa_status IN ('not_configured', 'pending', 'completed', 'error')),
  tsa_requested_at timestamptz,
  tsa_received_at timestamptz,
  tsa_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evidence_bundles_org_created
  ON public.evidence_bundles (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_call
  ON public.evidence_bundles (call_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_manifest
  ON public.evidence_bundles (manifest_id);

-- Ensure one active bundle per manifest
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_bundles_manifest_active
  ON public.evidence_bundles (manifest_id)
  WHERE superseded_at IS NULL;

-- =============================================================================
-- IMMUTABILITY TRIGGER (ALLOW ONLY TSA + SUPERSESSION UPDATES)
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_evidence_bundle_content_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
    NEW.call_id IS DISTINCT FROM OLD.call_id OR
    NEW.recording_id IS DISTINCT FROM OLD.recording_id OR
    NEW.manifest_id IS DISTINCT FROM OLD.manifest_id OR
    NEW.manifest_hash IS DISTINCT FROM OLD.manifest_hash OR
    NEW.artifact_hashes IS DISTINCT FROM OLD.artifact_hashes OR
    NEW.bundle_payload IS DISTINCT FROM OLD.bundle_payload OR
    NEW.bundle_hash IS DISTINCT FROM OLD.bundle_hash OR
    NEW.bundle_hash_algo IS DISTINCT FROM OLD.bundle_hash_algo OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.parent_bundle_id IS DISTINCT FROM OLD.parent_bundle_id OR
    NEW.immutable_storage IS DISTINCT FROM OLD.immutable_storage OR
    NEW.is_authoritative IS DISTINCT FROM OLD.is_authoritative OR
    NEW.produced_by IS DISTINCT FROM OLD.produced_by OR
    NEW.immutability_policy IS DISTINCT FROM OLD.immutability_policy OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'evidence_bundles is append-only. Only TSA and supersession fields may be updated.';
  END IF;

  -- Allow TSA fields and supersession marking only
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evidence_bundles_immutable ON public.evidence_bundles;
CREATE TRIGGER evidence_bundles_immutable
  BEFORE UPDATE ON public.evidence_bundles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_evidence_bundle_content_update();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.evidence_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_bundles_select_org"
  ON public.evidence_bundles FOR SELECT
  USING (organization_id = public.get_user_organization_id() OR public.is_admin());

CREATE POLICY "evidence_bundles_insert_all"
  ON public.evidence_bundles FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- UPDATE ARTIFACT_PROVENANCE TYPE CONSTRAINT
-- =============================================================================

ALTER TABLE public.artifact_provenance
  DROP CONSTRAINT IF EXISTS artifact_provenance_artifact_type_check;

ALTER TABLE public.artifact_provenance
  ADD CONSTRAINT artifact_provenance_artifact_type_check
  CHECK (artifact_type IN (
    'recording', 'transcript', 'translation', 'survey', 'score',
    'evidence_manifest', 'evidence_bundle'
  ));

COMMIT;
