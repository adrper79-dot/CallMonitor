-- Migration 005: Drop zombie auth schemas (H7 from CIO Audit)
-- 
-- These schemas are leftover from NextAuth/Supabase/NeonAuth migrations.
-- The active auth system uses public.users + public.sessions exclusively.
-- Workers auth routes in workers/src/routes/auth.ts only write to public schema.
-- No code references authjs, next_auth, or neon_auth schemas.
--
-- Safe to run multiple times (IF EXISTS guards).
-- Run against: Neon project misty-sound-29419685

-- 1. Drop next_auth schema (completely dead, never used by Workers)
DROP SCHEMA IF EXISTS next_auth CASCADE;

-- 2. Drop authjs schema (zombie — was dual-written by old NextAuth adapter)
DROP SCHEMA IF EXISTS authjs CASCADE;

-- 3. Drop neon_auth schema (provisioned by Neon Auth, never integrated)
DROP SCHEMA IF EXISTS neon_auth CASCADE;

-- 4. Drop realtime schema (Supabase realtime remnant)
DROP SCHEMA IF EXISTS realtime CASCADE;

-- 5. Drop graphql schema (Supabase GraphQL remnant)
DROP SCHEMA IF EXISTS graphql CASCADE;

-- 6. Drop graphql_public schema (Supabase GraphQL public remnant)
DROP SCHEMA IF EXISTS graphql_public CASCADE;

-- Note: The auth.* (Supabase GoTrue) schema is NOT dropped here.
-- It contains 20+ tables and may have historical user data that should
-- be reviewed before deletion. Schedule separately with DBA review.
--
-- Verification query after running:
-- SELECT schema_name FROM information_schema.schemata
-- WHERE schema_name NOT IN ('public', 'pg_catalog', 'information_schema', 'pg_toast', 'auth', 'extensions', 'storage', 'vault', 'supabase_functions', 'supabase_migrations');
