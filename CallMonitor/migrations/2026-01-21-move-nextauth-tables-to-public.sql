-- Move NextAuth tables from next_auth to public schema
-- This fixes the SupabaseAdapter schema mismatch issue

-- Move accounts table
ALTER TABLE next_auth.accounts SET SCHEMA public;

-- Move sessions table  
ALTER TABLE next_auth.sessions SET SCHEMA public;

-- Move users table
ALTER TABLE next_auth.users SET SCHEMA public;

-- Move verificationtokens table
ALTER TABLE next_auth.verificationtokens SET SCHEMA public;

-- Drop the empty next_auth schema
DROP SCHEMA IF EXISTS next_auth CASCADE;
