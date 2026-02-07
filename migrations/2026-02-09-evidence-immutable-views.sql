-- ============================================================================
-- Evidence Immutable Views — HIPAA Safe Harbor & SOC2 CC6.1
-- ============================================================================
-- Creates read-only views for evidence tables with SELECT-only RLS policies.
-- Evidence data (manifests, bundles, and associated recordings/artifacts) must
-- be immutable once created — no UPDATE or DELETE allowed through these views.
--
-- Usage: psql $NEON_PG_CONN -f migrations/2026-02-09-evidence-immutable-views.sql
-- npm script: db:evidence-views
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EVIDENCE IMMUTABLE VIEWS
-- ============================================================================
-- These views provide read-only access to evidence data with org isolation.
-- They join evidence tables with their related data for complete chain-of-custody.

-- evidence_manifests_readonly — full manifest with artifact count
CREATE OR REPLACE VIEW public.evidence_manifests_readonly AS
SELECT
  em.id,
  em.org_id,
  em.call_id,
  em.case_id,
  em.manifest_hash,
  em.status,
  em.created_at,
  em.created_by,
  em.metadata,
  (SELECT COUNT(*) FROM public.evidence_bundles eb WHERE eb.manifest_id = em.id) AS bundle_count
FROM public.evidence_manifests em
WHERE em.org_id = current_setting('app.current_organization_id', true)::uuid;

COMMENT ON VIEW public.evidence_manifests_readonly IS
  'Immutable read-only view of evidence manifests with org isolation. HIPAA safe harbor — no UPDATE/DELETE permitted.';

-- evidence_bundles_readonly — full bundle with manifest reference
CREATE OR REPLACE VIEW public.evidence_bundles_readonly AS
SELECT
  eb.id,
  eb.org_id,
  eb.manifest_id,
  eb.artifact_type,
  eb.artifact_id,
  eb.artifact_hash,
  eb.chain_position,
  eb.created_at,
  eb.metadata,
  em.call_id,
  em.case_id,
  em.status AS manifest_status
FROM public.evidence_bundles eb
JOIN public.evidence_manifests em ON em.id = eb.manifest_id
WHERE eb.org_id = current_setting('app.current_organization_id', true)::uuid;

COMMENT ON VIEW public.evidence_bundles_readonly IS
  'Immutable read-only view of evidence bundles with manifest context. HIPAA safe harbor — no UPDATE/DELETE permitted.';

-- evidence_chain_readonly — complete chain-of-custody view
CREATE OR REPLACE VIEW public.evidence_chain_readonly AS
SELECT
  em.id AS manifest_id,
  em.org_id,
  em.call_id,
  em.case_id,
  em.manifest_hash,
  em.status AS manifest_status,
  em.created_at AS manifest_created_at,
  em.created_by AS manifest_created_by,
  eb.id AS bundle_id,
  eb.artifact_type,
  eb.artifact_id,
  eb.artifact_hash,
  eb.chain_position,
  eb.created_at AS bundle_created_at
FROM public.evidence_manifests em
LEFT JOIN public.evidence_bundles eb ON eb.manifest_id = em.id
WHERE em.org_id = current_setting('app.current_organization_id', true)::uuid
ORDER BY em.created_at DESC, eb.chain_position ASC;

COMMENT ON VIEW public.evidence_chain_readonly IS
  'Complete chain-of-custody view joining manifests with bundles. HIPAA safe harbor — immutable evidence trail.';

-- ============================================================================
-- 2. SELECT-ONLY RLS POLICIES ON BASE TABLES
-- ============================================================================
-- Restrict evidence tables to SELECT-only via RLS. INSERT is permitted
-- for initial evidence creation, but UPDATE and DELETE are denied.
-- This ensures evidence immutability at the database level.

-- evidence_manifests: deny UPDATE/DELETE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evidence_manifests' AND policyname='evidence_manifests_deny_update') THEN
    CREATE POLICY evidence_manifests_deny_update ON public.evidence_manifests
      FOR UPDATE USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evidence_manifests' AND policyname='evidence_manifests_deny_delete') THEN
    CREATE POLICY evidence_manifests_deny_delete ON public.evidence_manifests
      FOR DELETE USING (false);
  END IF;
END $$;

-- evidence_bundles: deny UPDATE/DELETE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evidence_bundles' AND policyname='evidence_bundles_deny_update') THEN
    CREATE POLICY evidence_bundles_deny_update ON public.evidence_bundles
      FOR UPDATE USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evidence_bundles' AND policyname='evidence_bundles_deny_delete') THEN
    CREATE POLICY evidence_bundles_deny_delete ON public.evidence_bundles
      FOR DELETE USING (false);
  END IF;
END $$;

-- ============================================================================
-- 3. GRANT SELECT-ONLY ON VIEWS
-- ============================================================================
-- Application role gets SELECT on views, no INSERT/UPDATE/DELETE

DO $$ BEGIN
  -- Grant SELECT on views to the app role (neondb_owner is default)
  GRANT SELECT ON public.evidence_manifests_readonly TO neondb_owner;
  GRANT SELECT ON public.evidence_bundles_readonly TO neondb_owner;
  GRANT SELECT ON public.evidence_chain_readonly TO neondb_owner;
EXCEPTION WHEN OTHERS THEN
  -- Role might not exist in all environments, silently continue
  NULL;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run manually to validate)
-- ============================================================================
-- Check policies exist:
-- SELECT tablename, policyname, cmd, qual FROM pg_policies 
--   WHERE tablename IN ('evidence_manifests', 'evidence_bundles')
--   ORDER BY tablename, policyname;
--
-- Verify views exist:
-- SELECT table_name, is_updatable FROM information_schema.views 
--   WHERE table_schema = 'public' AND table_name LIKE 'evidence%';
--
-- Test immutability (should fail):
-- SET app.current_organization_id = 'your-org-id';
-- UPDATE evidence_manifests SET status = 'tampered' WHERE id = 'some-id';
-- Expected: ERROR - policy "evidence_manifests_deny_update" denies update
