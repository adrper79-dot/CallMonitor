-- Migration: fix_nextauth_tables
-- Drops duplicate NextAuth table variants and creates canonical tables

-- Drop all variants (safe because diagnostic showed all were empty)
DROP TABLE IF EXISTS public.account CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.session CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public."user" CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.verification_token CASCADE;
DROP TABLE IF EXISTS public.verification_tokens CASCADE;
DROP TABLE IF EXISTS public.verificationtokens CASCADE;

-- Create canonical accounts table
CREATE TABLE public.accounts (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  oauth_token_secret TEXT,
  oauth_token TEXT,
  UNIQUE(provider, provider_account_id)
);

-- Create canonical sessions table
CREATE TABLE public.sessions (
  id TEXT NOT NULL PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL
);

-- Create canonical users table
CREATE TABLE public.users (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  email_verified TIMESTAMPTZ,
  image TEXT
);

-- Create canonical verification_tokens table
CREATE TABLE public.verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Enable RLS and add permissive policies (adjust as needed for production)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on accounts" ON public.accounts FOR ALL USING (true);
CREATE POLICY "Allow all operations on sessions" ON public.sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all operations on verification_tokens" ON public.verification_tokens FOR ALL USING (true);
