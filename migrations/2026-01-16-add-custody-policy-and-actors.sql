-- Migration: Custody Policy + Actor Identity Semantics
-- Date: 2026-01-16
-- Purpose: Add custody/retention fields and explicit actor taxonomy
-- Reference: ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md

BEGIN;

-- =============================================================================
-- CUSTODY & RETENTION POLICY FIELDS
-- =============================================================================

-- Calls (root entity)
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS custody_status text NOT NULL DEFAULT 'active'
    CHECK (custody_status IN ('active', 'archived', 'legal_hold', 'expired')),
  ADD COLUMN IF NOT EXISTS retention_class text NOT NULL DEFAULT 'default'
    CHECK (retention_class IN ('default', 'regulated', 'legal_hold')),
  ADD COLUMN IF NOT EXISTS legal_hold_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence_completeness text NOT NULL DEFAULT 'unknown'
    CHECK (evidence_completeness IN ('unknown', 'partial', 'complete', 'failed'));

-- Recordings (authoritative media)
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS custody_status text NOT NULL DEFAULT 'active'
    CHECK (custody_status IN ('active', 'archived', 'legal_hold', 'expired')),
  ADD COLUMN IF NOT EXISTS retention_class text NOT NULL DEFAULT 'default'
    CHECK (retention_class IN ('default', 'regulated', 'legal_hold')),
  ADD COLUMN IF NOT EXISTS legal_hold_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence_completeness text NOT NULL DEFAULT 'unknown'
    CHECK (evidence_completeness IN ('unknown', 'partial', 'complete', 'failed'));

-- Evidence bundles (custody-grade packaging)
ALTER TABLE public.evidence_bundles
  ADD COLUMN IF NOT EXISTS custody_status text NOT NULL DEFAULT 'active'
    CHECK (custody_status IN ('active', 'archived', 'legal_hold', 'expired')),
  ADD COLUMN IF NOT EXISTS retention_class text NOT NULL DEFAULT 'default'
    CHECK (retention_class IN ('default', 'regulated', 'legal_hold')),
  ADD COLUMN IF NOT EXISTS legal_hold_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence_completeness text NOT NULL DEFAULT 'unknown'
    CHECK (evidence_completeness IN ('unknown', 'partial', 'complete', 'failed'));

-- Backfill existing rows
UPDATE public.calls
SET custody_status = 'active',
    retention_class = 'default',
    legal_hold_flag = false
WHERE custody_status IS NULL
   OR retention_class IS NULL
   OR legal_hold_flag IS NULL;

UPDATE public.recordings
SET custody_status = 'active',
    retention_class = 'default',
    legal_hold_flag = false
WHERE custody_status IS NULL
   OR retention_class IS NULL
   OR legal_hold_flag IS NULL;

UPDATE public.evidence_bundles
SET custody_status = 'active',
    retention_class = 'default',
    legal_hold_flag = false
WHERE custody_status IS NULL
   OR retention_class IS NULL
   OR legal_hold_flag IS NULL;

-- =============================================================================
-- ACTOR IDENTITY SEMANTICS (AUDIT LOGS)
-- =============================================================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_type text
    CHECK (actor_type IN ('human', 'system', 'vendor', 'automation')),
  ADD COLUMN IF NOT EXISTS actor_label text;

-- Derive actor_type on insert if not provided
CREATE OR REPLACE FUNCTION set_audit_log_actor_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actor_type IS NULL THEN
    IF NEW.user_id IS NOT NULL THEN
      NEW.actor_type := 'human';
    ELSIF NEW.system_id IS NOT NULL THEN
      NEW.actor_type := 'system';
    ELSE
      NEW.actor_type := 'automation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_actor_type ON public.audit_logs;
CREATE TRIGGER audit_logs_actor_type
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_log_actor_type();

-- Backfill existing rows
UPDATE public.audit_logs
SET actor_type = CASE
  WHEN user_id IS NOT NULL THEN 'human'
  WHEN system_id IS NOT NULL THEN 'system'
  ELSE 'automation'
END
WHERE actor_type IS NULL;

COMMIT;
