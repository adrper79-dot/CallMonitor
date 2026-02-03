-- Diagnostic queries to check for duplicate NextAuth tables in Supabase
-- Run this in the Supabase SQL Editor to identify which tables exist and have data

-- List all tables in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'user', 'accounts', 'account', 'sessions', 'session', 'verification_tokens', 'verificationtokens', 'verification_token')
ORDER BY table_name;

-- Check row counts for each potential table
SELECT 'users' as table_name, COUNT(*) as row_count FROM public.users
UNION ALL
SELECT 'user', COUNT(*) FROM public.user
UNION ALL
SELECT 'accounts', COUNT(*) FROM public.accounts
UNION ALL
SELECT 'account', COUNT(*) FROM public.account
UNION ALL
SELECT 'sessions', COUNT(*) FROM public.sessions
UNION ALL
SELECT 'session', COUNT(*) FROM public.session
UNION ALL
SELECT 'verification_tokens', COUNT(*) FROM public.verification_tokens
UNION ALL
SELECT 'verificationtokens', COUNT(*) FROM public.verificationtokens
UNION ALL
SELECT 'verification_token', COUNT(*) FROM public.verification_token
ORDER BY table_name;

-- Sample data from each table (first 3 rows if they exist)
-- Uncomment and run individually if needed
/*
SELECT * FROM public.users LIMIT 3;
SELECT * FROM public.user LIMIT 3;
SELECT * FROM public.accounts LIMIT 3;
SELECT * FROM public.account LIMIT 3;
SELECT * FROM public.sessions LIMIT 3;
SELECT * FROM public.session LIMIT 3;
SELECT * FROM public.verification_tokens LIMIT 3;
SELECT * FROM public.verificationtokens LIMIT 3;
SELECT * FROM public.verification_token LIMIT 3;
*/