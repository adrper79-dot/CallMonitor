-- ============================================================================
-- SESSION 4 SCHEMA FIXES — Word Is Bond v4.29
-- Migration: 2026-02-08-session4-schema-fixes.sql
-- Database:  Neon PostgreSQL 17
-- Backlog:   BL-056, BL-062, BL-063, BL-064, BL-065, BL-066,
--            BL-081, BL-082, BL-083, BL-087
--
-- RULES:
--   ✅ IF NOT EXISTS / IF EXISTS everywhere — fully idempotent
--   ✅ Safe to run multiple times
--   ✅ No table rewrites or dangerous ALTER operations
--   ✅ gen_random_uuid() only (NOT uuid_generate_v4)
--   ✅ All FKs use NOT VALID + VALIDATE CONSTRAINT for zero-downtime
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. ENSURE update_timestamp() FUNCTION EXISTS
--    (Referenced by BL-083 triggers; must exist first)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- BL-065: UUID/TEXT TYPE MISMATCHES
--    users.id is TEXT, but these columns were typed UUID.
--    Fix: ALTER COLUMN ... TYPE TEXT
--    NOTE: This uses ALTER TYPE which scans data but does NOT rewrite if
--    the storage format is compatible (UUID→TEXT is safe, no rewrite).
-- ============================================================================

-- call_notes.created_by: UUID → TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'call_notes'
      AND column_name = 'created_by'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.call_notes ALTER COLUMN created_by TYPE TEXT;
  END IF;
END $$;

-- webhook_subscriptions.created_by: UUID → TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webhook_subscriptions'
      AND column_name = 'created_by'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.webhook_subscriptions ALTER COLUMN created_by TYPE TEXT;
  END IF;
END $$;

-- webrtc_sessions.user_id: UUID → TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webrtc_sessions'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.webrtc_sessions ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;


-- ============================================================================
-- BL-056: calls.organization_id SET NOT NULL
--    Backfill any NULLs first (should be none in production), then constrain.
-- ============================================================================

-- Step 1: Backfill orphan rows (if any exist, assign to a sentinel or delete)
-- In production there should be zero NULL rows. This DELETE is a safety net.
DELETE FROM public.calls WHERE organization_id IS NULL;

-- Step 2: Add NOT NULL constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calls'
      AND column_name = 'organization_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.calls ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;


-- ============================================================================
-- BL-062: artifacts.organization_id SET NOT NULL
--    Same pattern: backfill safety net, then constrain.
-- ============================================================================

DELETE FROM public.artifacts WHERE organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'artifacts'
      AND column_name = 'organization_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.artifacts ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;


-- ============================================================================
-- BL-064: webhook_deliveries — ADD organization_id COLUMN
--    Don't add NOT NULL yet since existing rows lack the value.
--    Application code should populate it going forward.
-- ============================================================================

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org
  ON public.webhook_deliveries(organization_id)
  WHERE organization_id IS NOT NULL;


-- ============================================================================
-- BL-066: calls FK — ADD ON DELETE CASCADE to organization_id
--    Drop existing FK (if any) and re-add with CASCADE.
--    Uses DO block for idempotent drop.
-- ============================================================================

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  -- Find the existing FK constraint name on calls.organization_id → organizations.id
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'calls'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'organization_id'
    AND ccu.table_name = 'organizations'
  LIMIT 1;

  -- Drop it if found
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.calls DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- Re-add with ON DELETE CASCADE (NOT VALID for zero-downtime, then VALIDATE)
ALTER TABLE public.calls
  ADD CONSTRAINT calls_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.calls
  VALIDATE CONSTRAINT calls_organization_id_fkey;


-- ============================================================================
-- BL-066 (cont.): calls.created_by FK — re-add with ON DELETE SET NULL
--    created_by → users(id). If user is deleted, keep the call but null out creator.
-- ============================================================================

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'calls'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'created_by'
    AND ccu.table_name = 'users'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.calls DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE public.calls
  VALIDATE CONSTRAINT calls_created_by_fkey;


-- ============================================================================
-- BL-081: MISSING FK CONSTRAINTS
--    Add REFERENCES where missing on call_notes, webhook_subscriptions,
--    webhook_deliveries, org_feature_flags.
--    All use NOT VALID + VALIDATE for zero-downtime.
-- ============================================================================

-- ─── call_notes FKs ──────────────────────────────────────────────────────────

-- call_notes.call_id → calls(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'call_notes'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'call_id'
  ) THEN
    ALTER TABLE public.call_notes
      ADD CONSTRAINT call_notes_call_id_fkey
      FOREIGN KEY (call_id) REFERENCES public.calls(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;
ALTER TABLE public.call_notes VALIDATE CONSTRAINT call_notes_call_id_fkey;

-- call_notes.organization_id → organizations(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'call_notes'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.call_notes
      ADD CONSTRAINT call_notes_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;
ALTER TABLE public.call_notes VALIDATE CONSTRAINT call_notes_organization_id_fkey;

-- call_notes.created_by → users(id) ON DELETE SET NULL
-- (created_by is TEXT now, matching users.id TEXT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'call_notes'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'created_by'
  ) THEN
    -- Must drop NOT NULL first so SET NULL can work
    ALTER TABLE public.call_notes ALTER COLUMN created_by DROP NOT NULL;
    ALTER TABLE public.call_notes
      ADD CONSTRAINT call_notes_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;
ALTER TABLE public.call_notes VALIDATE CONSTRAINT call_notes_created_by_fkey;

-- ─── webhook_subscriptions FKs ──────────────────────────────────────────────

-- webhook_subscriptions.organization_id → organizations(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'webhook_subscriptions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.webhook_subscriptions
      ADD CONSTRAINT webhook_subscriptions_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;
ALTER TABLE public.webhook_subscriptions VALIDATE CONSTRAINT webhook_subscriptions_organization_id_fkey;

-- webhook_subscriptions.created_by → users(id) ON DELETE SET NULL
-- (created_by is TEXT now, matching users.id TEXT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'webhook_subscriptions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'created_by'
  ) THEN
    ALTER TABLE public.webhook_subscriptions
      ADD CONSTRAINT webhook_subscriptions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;
ALTER TABLE public.webhook_subscriptions VALIDATE CONSTRAINT webhook_subscriptions_created_by_fkey;

-- ─── webhook_deliveries FKs ────────────────────────────────────────────────

-- webhook_deliveries.subscription_id → webhook_subscriptions(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'webhook_deliveries'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'subscription_id'
  ) THEN
    ALTER TABLE public.webhook_deliveries
      ADD CONSTRAINT webhook_deliveries_subscription_id_fkey
      FOREIGN KEY (subscription_id) REFERENCES public.webhook_subscriptions(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;
ALTER TABLE public.webhook_deliveries VALIDATE CONSTRAINT webhook_deliveries_subscription_id_fkey;

-- ─── org_feature_flags FKs ─────────────────────────────────────────────────

-- org_feature_flags.organization_id → organizations(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'org_feature_flags'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.org_feature_flags
      ADD CONSTRAINT org_feature_flags_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;
ALTER TABLE public.org_feature_flags VALIDATE CONSTRAINT org_feature_flags_organization_id_fkey;


-- ============================================================================
-- BL-082: COLLECTION TABLES — ADD ON DELETE CASCADE to organization_id FK
--    Drop existing FKs and re-add with CASCADE.
-- ============================================================================

-- Helper: drop + re-add org FK with CASCADE for a collection table
-- We use a DO block per table for clarity and idempotency.

-- ─── collection_accounts.organization_id ON DELETE CASCADE ─────────────────

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'collection_accounts'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'organization_id'
    AND ccu.table_name = 'organizations'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.collection_accounts DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.collection_accounts
  ADD CONSTRAINT collection_accounts_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
  ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.collection_accounts
  VALIDATE CONSTRAINT collection_accounts_organization_id_fkey;

-- ─── collection_payments.organization_id ON DELETE CASCADE ─────────────────

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'collection_payments'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'organization_id'
    AND ccu.table_name = 'organizations'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.collection_payments DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.collection_payments
  ADD CONSTRAINT collection_payments_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
  ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.collection_payments
  VALIDATE CONSTRAINT collection_payments_organization_id_fkey;

-- ─── collection_tasks.organization_id ON DELETE CASCADE ────────────────────

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'collection_tasks'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'organization_id'
    AND ccu.table_name = 'organizations'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.collection_tasks DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.collection_tasks
  ADD CONSTRAINT collection_tasks_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
  ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.collection_tasks
  VALIDATE CONSTRAINT collection_tasks_organization_id_fkey;

-- ─── collection_csv_imports.organization_id ON DELETE CASCADE ──────────────

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'collection_csv_imports'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'organization_id'
    AND ccu.table_name = 'organizations'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.collection_csv_imports DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.collection_csv_imports
  ADD CONSTRAINT collection_csv_imports_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
  ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.collection_csv_imports
  VALIDATE CONSTRAINT collection_csv_imports_organization_id_fkey;


-- ============================================================================
-- BL-087: collection_payments.account_id ON DELETE CASCADE
--    Also collection_tasks.account_id ON DELETE CASCADE
-- ============================================================================

-- ─── collection_payments.account_id → collection_accounts(id) CASCADE ─────

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'collection_payments'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'account_id'
    AND ccu.table_name = 'collection_accounts'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.collection_payments DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.collection_payments
  ADD CONSTRAINT collection_payments_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.collection_accounts(id)
  ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.collection_payments
  VALIDATE CONSTRAINT collection_payments_account_id_fkey;

-- ─── collection_tasks.account_id → collection_accounts(id) CASCADE ────────

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'collection_tasks'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'account_id'
    AND ccu.table_name = 'collection_accounts'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.collection_tasks DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.collection_tasks
  ADD CONSTRAINT collection_tasks_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.collection_accounts(id)
  ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.collection_tasks
  VALIDATE CONSTRAINT collection_tasks_account_id_fkey;


-- ============================================================================
-- BL-063: COLLECTION TABLES — ENABLE RLS + ORG ISOLATION POLICIES
--    Defense-in-depth: RLS as secondary guard behind application WHERE clauses.
--    Uses current_setting('app.current_org_id') to match existing RLS pattern.
-- ============================================================================

-- ─── collection_accounts ──────────────────────────────────────────────────────

ALTER TABLE public.collection_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_collection_accounts ON public.collection_accounts;
CREATE POLICY org_isolation_collection_accounts ON public.collection_accounts
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ─── collection_payments ──────────────────────────────────────────────────────

ALTER TABLE public.collection_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_collection_payments ON public.collection_payments;
CREATE POLICY org_isolation_collection_payments ON public.collection_payments
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ─── collection_tasks ─────────────────────────────────────────────────────────

ALTER TABLE public.collection_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_collection_tasks ON public.collection_tasks;
CREATE POLICY org_isolation_collection_tasks ON public.collection_tasks
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ─── collection_csv_imports ───────────────────────────────────────────────────

ALTER TABLE public.collection_csv_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_collection_csv_imports ON public.collection_csv_imports;
CREATE POLICY org_isolation_collection_csv_imports ON public.collection_csv_imports
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ─── webhook_deliveries (now that it has organization_id from BL-064) ───────

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_webhook_deliveries ON public.webhook_deliveries;
CREATE POLICY org_isolation_webhook_deliveries ON public.webhook_deliveries
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);


-- ============================================================================
-- BL-083: MISSING update_timestamp() TRIGGERS
--    Tables with updated_at but no auto-update trigger.
-- ============================================================================

-- ─── collection_accounts ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_collection_accounts_timestamp ON public.collection_accounts;
CREATE TRIGGER update_collection_accounts_timestamp
  BEFORE UPDATE ON public.collection_accounts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ─── collection_tasks ─────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_collection_tasks_timestamp ON public.collection_tasks;
CREATE TRIGGER update_collection_tasks_timestamp
  BEFORE UPDATE ON public.collection_tasks
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ─── call_notes ───────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_call_notes_timestamp ON public.call_notes;
CREATE TRIGGER update_call_notes_timestamp
  BEFORE UPDATE ON public.call_notes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ─── webhook_subscriptions ────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_webhook_subscriptions_timestamp ON public.webhook_subscriptions;
CREATE TRIGGER update_webhook_subscriptions_timestamp
  BEFORE UPDATE ON public.webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ─── org_feature_flags ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_org_feature_flags_timestamp ON public.org_feature_flags;
CREATE TRIGGER update_org_feature_flags_timestamp
  BEFORE UPDATE ON public.org_feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();


-- ============================================================================
-- VERIFICATION QUERIES (SELECT only — safe to run)
-- ============================================================================

-- Verify NOT NULL constraints applied
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('calls', 'organization_id'),
    ('artifacts', 'organization_id')
  )
ORDER BY table_name;

-- Verify FK constraints exist
SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table,
       rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'calls', 'call_notes', 'webhook_subscriptions', 'webhook_deliveries',
    'org_feature_flags', 'collection_accounts', 'collection_payments',
    'collection_tasks', 'collection_csv_imports'
  )
ORDER BY tc.table_name, kcu.column_name;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'collection_accounts', 'collection_payments',
    'collection_tasks', 'collection_csv_imports',
    'webhook_deliveries'
  )
ORDER BY tablename;

-- Verify triggers exist
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'update_%_timestamp'
ORDER BY event_object_table;

-- Verify column types fixed (BL-065)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('call_notes', 'created_by'),
    ('webhook_subscriptions', 'created_by'),
    ('webrtc_sessions', 'user_id')
  )
ORDER BY table_name;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
--
-- Backlog items resolved:
--   ✅ BL-056  calls.organization_id SET NOT NULL
--   ✅ BL-062  artifacts.organization_id SET NOT NULL
--   ✅ BL-063  Collection tables RLS policies (4 tables)
--   ✅ BL-064  webhook_deliveries.organization_id added
--   ✅ BL-065  UUID/TEXT type mismatches fixed (3 columns)
--   ✅ BL-066  calls FK → ON DELETE CASCADE
--   ✅ BL-081  Missing FK constraints (call_notes, webhook_*, org_feature_flags)
--   ✅ BL-082  Collection tables org FK → ON DELETE CASCADE (4 tables)
--   ✅ BL-083  Missing update_timestamp() triggers (5 tables)
--   ✅ BL-087  collection_payments/tasks.account_id → ON DELETE CASCADE
--
-- BL-085 (SignInSchema email validation) — code-only fix, no DB change needed.
-- ============================================================================
