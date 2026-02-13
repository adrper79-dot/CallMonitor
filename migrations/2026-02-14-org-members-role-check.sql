-- =============================================================================
-- Migration: Add CHECK constraint on org_members.role
-- Date: 2026-02-14
-- Purpose: Enforce valid role values at the database level to prevent
--          drift between client/server/DB role vocabularies.
--
-- Valid roles (superset of all known roles across codebase):
--   owner, admin, manager, operator, compliance, analyst, agent, viewer, member
--
-- NOTE: This is idempotent — safe to run multiple times.
-- =============================================================================

-- Step 1: Update any legacy/unknown roles to 'member' (the DB default)
UPDATE public.org_members
SET role = 'member'
WHERE role IS NULL
   OR role NOT IN ('owner', 'admin', 'manager', 'operator', 'compliance', 'analyst', 'agent', 'viewer', 'member');

-- Step 2: Add the CHECK constraint (NOT VALID first for zero-downtime)
ALTER TABLE public.org_members
  DROP CONSTRAINT IF EXISTS org_members_role_check;

ALTER TABLE public.org_members
  ADD CONSTRAINT org_members_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'operator', 'compliance', 'analyst', 'agent', 'viewer', 'member'))
  NOT VALID;

-- Step 3: Validate existing data against the constraint
ALTER TABLE public.org_members
  VALIDATE CONSTRAINT org_members_role_check;

-- Step 4: Add a comment documenting the constraint
COMMENT ON COLUMN public.org_members.role IS
  'Role within organization. Valid: owner, admin, manager, operator, compliance, analyst, agent, viewer, member. Default: member.';
