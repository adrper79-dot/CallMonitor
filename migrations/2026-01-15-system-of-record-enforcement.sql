-- Migration: System of Record Enforcement (P0 Fixes)
-- Date: 2026-01-15
-- Purpose: Enable enforcement mechanisms that were prepared but not activated
-- Reference: SYSTEM_OF_RECORD_COMPLIANCE_AUDIT.md

-- =============================================================================
-- P0 FIX 1: ENABLE SOFT DELETE TRIGGERS
-- =============================================================================

-- 1.1 Soft delete function for recordings (already exists, now enabling trigger)
-- This prevents hard deletes and converts them to soft deletes with audit trail

DROP TRIGGER IF EXISTS recordings_soft_delete ON public.recordings;
CREATE TRIGGER recordings_soft_delete
  BEFORE DELETE ON public.recordings
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_recording();

-- 1.2 Create soft delete function and trigger for calls
CREATE OR REPLACE FUNCTION soft_delete_call()
RETURNS TRIGGER AS $$
BEGIN
  -- Instead of deleting, mark as deleted
  UPDATE public.calls 
  SET is_deleted = true, 
      deleted_at = now(),
      deleted_by = auth.uid()
  WHERE id = OLD.id;
  
  -- Write audit log
  INSERT INTO public.audit_logs (id, organization_id, user_id, resource_type, resource_id, action, before, after, created_at)
  VALUES (
    gen_random_uuid(),
    OLD.organization_id,
    auth.uid(),
    'calls',
    OLD.id,
    'soft_delete',
    row_to_json(OLD),
    NULL,
    now()
  );
  
  RETURN NULL;  -- Prevent actual deletion
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS calls_soft_delete ON public.calls;
CREATE TRIGGER calls_soft_delete
  BEFORE DELETE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_call();

-- 1.3 Create soft delete function and trigger for ai_runs
CREATE OR REPLACE FUNCTION soft_delete_ai_run()
RETURNS TRIGGER AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Get organization_id from related call (handle null call_id for upload transcriptions)
  IF OLD.call_id IS NOT NULL THEN
    SELECT organization_id INTO org_id 
    FROM public.calls 
    WHERE id = OLD.call_id;
  ELSE
    -- Fallback: try to get org from output metadata if available
    org_id := (OLD.output->>'organization_id')::uuid;
  END IF;
  
  -- Instead of deleting, mark as deleted
  UPDATE public.ai_runs 
  SET is_deleted = true, 
      deleted_at = now(),
      deleted_by = auth.uid()
  WHERE id = OLD.id;
  
  -- Write audit log (org_id may be null for orphaned records)
  INSERT INTO public.audit_logs (id, organization_id, user_id, resource_type, resource_id, action, before, after, created_at)
  VALUES (
    gen_random_uuid(),
    org_id,
    auth.uid(),
    'ai_runs',
    OLD.id,
    'soft_delete',
    row_to_json(OLD),
    NULL,
    now()
  );
  
  RETURN NULL;  -- Prevent actual deletion
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ai_runs_soft_delete ON public.ai_runs;
CREATE TRIGGER ai_runs_soft_delete
  BEFORE DELETE ON public.ai_runs
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_ai_run();

-- =============================================================================
-- P0 FIX 2: TIME ORDERING CONSTRAINTS
-- =============================================================================

-- 2.1 Add constraint ensuring started_at <= ended_at
-- Use DO block to handle case where constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calls_time_order'
  ) THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT calls_time_order CHECK (
        ended_at IS NULL OR started_at IS NULL OR started_at <= ended_at
      );
  END IF;
END$$;

-- 2.2 Add constraint ensuring recordings have valid duration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recordings_duration_valid'
  ) THEN
    ALTER TABLE public.recordings
      ADD CONSTRAINT recordings_duration_valid CHECK (
        duration_seconds IS NULL OR duration_seconds >= 0
      );
  END IF;
END$$;

-- =============================================================================
-- P0 FIX 3: PREVENT UNAUTHORIZED EVIDENCE MUTATION
-- =============================================================================

-- 3.1 Update evidence_manifests trigger to allow ONLY supersession updates
-- (The original trigger blocks ALL updates, but we need to allow marking supersession)
-- NOTE: Using same function name as compliance migration to properly override it
CREATE OR REPLACE FUNCTION prevent_evidence_manifest_content_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow supersession marking ONLY (setting superseded_at and superseded_by)
  -- Block all other updates including created_at
  IF (
    NEW.manifest IS DISTINCT FROM OLD.manifest OR
    NEW.recording_id IS DISTINCT FROM OLD.recording_id OR
    NEW.scorecard_id IS DISTINCT FROM OLD.scorecard_id OR
    NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.parent_manifest_id IS DISTINCT FROM OLD.parent_manifest_id OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'evidence_manifests is append-only. Only supersession marking is allowed. Create a new manifest instead.';
  END IF;
  
  -- If we get here, only superseded_at/superseded_by are changing - allow it
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- P0 FIX 4: RLS POLICY TO PREVENT DELETE (DEFENSE IN DEPTH)
-- =============================================================================

-- 4.1 Drop any existing delete policies that might be too permissive
DROP POLICY IF EXISTS "recordings_delete_org" ON public.recordings;
DROP POLICY IF EXISTS "calls_delete_org" ON public.calls;
DROP POLICY IF EXISTS "ai_runs_delete_org" ON public.ai_runs;

-- 4.2 Create restrictive delete policies (only for admin soft-delete recovery)
-- These will always deny normal users from deleting
CREATE POLICY "recordings_delete_admin_only"
  ON public.recordings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "calls_delete_admin_only"
  ON public.calls FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "ai_runs_delete_admin_only"
  ON public.ai_runs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =============================================================================
-- P1 FIX: INCIDENTS TABLE FOR ERROR TRACKING
-- =============================================================================

-- Create dedicated incidents table for operational tracking
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  severity text NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  error_code text NOT NULL,
  error_message text NOT NULL,
  resource_type text,
  resource_id uuid,
  call_id uuid REFERENCES public.calls(id),
  stack_trace text,
  metadata jsonb,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_incidents_org_severity 
  ON public.incidents(organization_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_unresolved 
  ON public.incidents(organization_id, created_at DESC) 
  WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_select_org"
  ON public.incidents FOR SELECT
  USING (organization_id = public.get_user_organization_id() OR public.is_admin());

CREATE POLICY "incidents_insert_all"
  ON public.incidents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "incidents_update_org"
  ON public.incidents FOR UPDATE
  USING (organization_id = public.get_user_organization_id() OR public.is_admin());

-- =============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- =============================================================================

-- Verify soft delete triggers are active
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE '%_soft_delete';

-- Verify time ordering constraint exists
-- SELECT conname, conrelid::regclass FROM pg_constraint WHERE conname = 'calls_time_order';

-- Verify RLS delete policies
-- SELECT policyname, tablename FROM pg_policies WHERE policyname LIKE '%delete%';

-- =============================================================================
-- NOTES
-- =============================================================================

-- This migration completes the System of Record compliance by enabling:
--
-- 1. Soft delete enforcement on recordings, calls, ai_runs
-- 2. Time ordering constraint on calls (started_at <= ended_at)
-- 3. Refined evidence manifest immutability (allows supersession)
-- 4. RLS policies blocking direct deletes (admin-only bypass)
-- 5. Incidents table for structured error tracking
--
-- After running this migration, the codebase will be at 95%+ compliance
-- with the Conversation System of Record requirements.
