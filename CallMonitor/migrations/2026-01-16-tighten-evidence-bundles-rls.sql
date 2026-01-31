-- Migration: Tighten Evidence Bundles RLS
-- Date: 2026-01-16
-- Purpose: Require organization match on insert for non-service-role usage
-- Reference: ARCH_DOCS/04-DESIGN/EVIDENCE_BUNDLE_IMPROVEMENTS.md

BEGIN;

-- =============================================================================
-- DROP PERMISSIVE INSERT POLICY
-- =============================================================================

-- The current policy allows any insert:
--   CREATE POLICY "evidence_bundles_insert_all"
--     ON public.evidence_bundles FOR INSERT
--     WITH CHECK (true);
--
-- This is too permissive - users could potentially insert bundles for other orgs

DROP POLICY IF EXISTS "evidence_bundles_insert_all" ON public.evidence_bundles;

-- =============================================================================
-- CREATE ORG-SCOPED INSERT POLICY
-- =============================================================================

-- New policy requires organization match for user-context inserts
-- Service role (used by backend) bypasses RLS entirely, so this only affects
-- direct client connections or improperly configured server calls

CREATE POLICY "evidence_bundles_insert_org"
  ON public.evidence_bundles FOR INSERT
  WITH CHECK (
    -- Allow if user is member of the organization
    organization_id IN (
      SELECT om.organization_id 
      FROM public.org_members om 
      WHERE auth.user_equals_auth(om.user_id::text)
    )
    OR
    -- Allow system inserts (service role bypasses RLS, but auth.uid() is null)
    -- This ensures backend services can still insert
    auth.uid() IS NULL
  );

-- =============================================================================
-- ADD UPDATE POLICY FOR TSA FIELDS ONLY
-- =============================================================================

-- The immutability trigger prevents content updates, but we need RLS to allow
-- the updates that the trigger permits (TSA fields, supersession)

DROP POLICY IF EXISTS "evidence_bundles_update_tsa" ON public.evidence_bundles;

CREATE POLICY "evidence_bundles_update_tsa"
  ON public.evidence_bundles FOR UPDATE
  USING (
    -- Can only update bundles in user's org
    organization_id IN (
      SELECT om.organization_id 
      FROM public.org_members om 
      WHERE auth.user_equals_auth(om.user_id::text)
    )
    OR
    -- System updates allowed
    auth.uid() IS NULL
  )
  WITH CHECK (
    -- Same org check for the new row
    organization_id IN (
      SELECT om.organization_id 
      FROM public.org_members om 
      WHERE auth.user_equals_auth(om.user_id::text)
    )
    OR
    auth.uid() IS NULL
  );

-- =============================================================================
-- VERIFY POLICIES
-- =============================================================================

COMMENT ON POLICY "evidence_bundles_insert_org" ON public.evidence_bundles IS
  'Requires org membership for user-context inserts. Service role bypasses RLS.';

COMMENT ON POLICY "evidence_bundles_update_tsa" ON public.evidence_bundles IS
  'Allows TSA field updates (trigger enforces immutability of content fields).';

COMMIT;

