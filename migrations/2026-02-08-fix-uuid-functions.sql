-- Migration: Fix uuid_generate_v4() → gen_random_uuid()
-- Date: 2026-02-08
-- Reason: gen_random_uuid() is built-in to PG 13+, no extension needed.
--         uuid_generate_v4() requires uuid-ossp extension.
-- Impact: Zero downtime — ALTER COLUMN SET DEFAULT is catalog-only.
-- Idempotent: Yes — safe to run multiple times.

-- organizations
ALTER TABLE IF EXISTS public.organizations
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- org_members
ALTER TABLE IF EXISTS public.org_members
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- calls
ALTER TABLE IF EXISTS public.calls
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- recordings
ALTER TABLE IF EXISTS public.recordings
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
