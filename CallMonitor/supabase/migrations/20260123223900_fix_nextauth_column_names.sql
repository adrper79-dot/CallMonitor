-- Fix NextAuth tables column names to use camelCase as expected by adapter
-- This migration corrects the column names from snake_case to camelCase

-- Drop and recreate accounts table with correct column names
DROP TABLE IF EXISTS public.accounts CASCADE;
CREATE TABLE public.accounts (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    oauth_token_secret TEXT,
    oauth_token TEXT,
    UNIQUE(provider, providerAccountId)
);

-- Drop and recreate sessions table with correct column names
DROP TABLE IF EXISTS public.sessions CASCADE;
CREATE TABLE public.sessions (
    id TEXT NOT NULL PRIMARY KEY,
    sessionToken TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL
);

-- Drop and recreate users table with correct column names
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    emailVerified TIMESTAMPTZ,
    image TEXT
);

-- Drop and recreate verificationtokens table
DROP TABLE IF EXISTS public.verificationtokens CASCADE;
CREATE TABLE public.verificationtokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verificationtokens ENABLE ROW LEVEL SECURITY;

-- Create policies for NextAuth operations
CREATE POLICY "Allow all operations on accounts" ON public.accounts FOR ALL USING (true);
CREATE POLICY "Allow all operations on sessions" ON public.sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations on users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all operations on verificationtokens" ON public.verificationtokens FOR ALL USING (true);