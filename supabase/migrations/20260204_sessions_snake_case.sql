-- Migration: Rename sessions columns from camelCase to snake_case
-- Date: 2026-02-04
-- Author: Platform Team
-- Risk: LOW (only 2 columns, with proper transaction)
-- 
-- This migration aligns the sessions table with the mandatory snake_case
-- naming convention defined in ARCH_DOCS/MASTER_ARCHITECTURE.md
--
-- Changes:
--   sessionToken -> session_token
--   userId       -> user_id

BEGIN;

-- Step 1: Drop the unique constraint that references camelCase column
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS "sessions_sessionToken_key";

-- Step 2: Rename columns from camelCase to snake_case
ALTER TABLE public.sessions RENAME COLUMN "sessionToken" TO session_token;
ALTER TABLE public.sessions RENAME COLUMN "userId" TO user_id;

-- Step 3: Recreate the unique constraint with snake_case name
ALTER TABLE public.sessions ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);

-- Step 4: Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);

-- Step 5: Add index on expires for session cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions(expires);

COMMIT;

-- Verification query (run manually after migration):
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'sessions' AND table_schema = 'public'
-- ORDER BY ordinal_position;
--
-- Expected columns: id, session_token, user_id, expires, created_at, updated_at
