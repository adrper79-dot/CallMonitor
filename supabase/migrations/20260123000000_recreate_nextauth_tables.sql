-- Recreate NextAuth tables with correct camelCase column names for NextAuth adapter
-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.verificationtokens CASCADE;

-- Create accounts table with camelCase columns
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

-- Create sessions table with camelCase columns
CREATE TABLE public.sessions (
    id TEXT NOT NULL PRIMARY KEY,
    sessionToken TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL
);

-- Create users table with camelCase columns
CREATE TABLE public.users (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    emailVerified TIMESTAMPTZ,
    image TEXT
);

-- Create verificationtokens table
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