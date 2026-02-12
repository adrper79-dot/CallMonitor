-- Migration: Remove auth schema dependency from soft delete triggers
-- Date: 2026-02-12
-- Purpose: Ensure soft-delete functions work in Neon (no auth schema) and keep audit logging
-- Notes: Uses application-provided actor context when available; falls back to NULL

-- Helper to pull actor/user id from current_setting (set by application session middleware)
-- Prefer app.current_user_id or JWT claim if present; otherwise null
CREATE OR REPLACE FUNCTION public._resolve_actor_id()
RETURNS uuid AS $$
DECLARE
  actor uuid;
BEGIN
  BEGIN
    actor := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN others THEN
    actor := NULL;
  END;

  IF actor IS NULL THEN
    BEGIN
      actor := current_setting('request.jwt.claim.sub', true)::uuid;
    EXCEPTION WHEN others THEN
      actor := NULL;
    END;
  END IF;

  RETURN actor;
END;
$$ LANGUAGE plpgsql STABLE;

-- Soft delete for calls without auth schema dependency
CREATE OR REPLACE FUNCTION public.soft_delete_call()
RETURNS TRIGGER AS $$
DECLARE
  actor uuid := public._resolve_actor_id();
BEGIN
  UPDATE public.calls
    SET is_deleted = true,
        deleted_at = NOW(),
        deleted_by = COALESCE(actor, deleted_by)
    WHERE id = OLD.id;

  INSERT INTO public.audit_logs (
    id,
    organization_id,
    user_id,
    resource_type,
    resource_id,
    action,
    before,
    after,
    created_at,
    actor_type,
    actor_label
  ) VALUES (
    gen_random_uuid(),
    OLD.organization_id,
    actor,
    'calls',
    OLD.id,
    'soft_delete',
    row_to_json(OLD),
    NULL,
    NOW(),
    'system',
    'trigger:soft_delete_call'
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft delete for ai_runs without auth schema dependency
CREATE OR REPLACE FUNCTION public.soft_delete_ai_run()
RETURNS TRIGGER AS $$
DECLARE
  actor uuid := public._resolve_actor_id();
  org_id uuid;
BEGIN
  IF OLD.call_id IS NOT NULL THEN
    SELECT organization_id INTO org_id FROM public.calls WHERE id = OLD.call_id;
  ELSE
    org_id := (OLD.output->>'organization_id')::uuid;
  END IF;

  UPDATE public.ai_runs
    SET is_deleted = true,
        deleted_at = NOW(),
        deleted_by = COALESCE(actor, deleted_by)
    WHERE id = OLD.id;

  INSERT INTO public.audit_logs (
    id,
    organization_id,
    user_id,
    resource_type,
    resource_id,
    action,
    before,
    after,
    created_at,
    actor_type,
    actor_label
  ) VALUES (
    gen_random_uuid(),
    org_id,
    actor,
    'ai_runs',
    OLD.id,
    'soft_delete',
    row_to_json(OLD),
    NULL,
    NOW(),
    'system',
    'trigger:soft_delete_ai_run'
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
