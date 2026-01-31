-- ============================================================================
-- SCHEMA DIAGNOSTIC - Check Current Database State
-- Run this to see what actually exists in your database
-- ============================================================================

\echo '============================================================================'
\echo 'CHECKING CURRENT DATABASE SCHEMA'
\echo '============================================================================'
\echo ''

-- 1. Check if calls table exists
\echo '1. CALLS TABLE - Does it exist?'
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls')
    THEN '✅ calls table EXISTS'
    ELSE '❌ calls table DOES NOT EXIST'
  END as status;

\echo ''

-- 2. List ALL columns in calls table
\echo '2. CALLS TABLE - All current columns:'
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'calls'
ORDER BY ordinal_position;

\echo ''

-- 3. Check for organization_id specifically
\echo '3. CALLS TABLE - Does organization_id exist?'
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'calls' AND column_name = 'organization_id'
    )
    THEN '✅ organization_id EXISTS in calls table'
    ELSE '❌ organization_id DOES NOT EXIST in calls table'
  END as status;

\echo ''

-- 4. Check organizations table
\echo '4. ORGANIZATIONS TABLE - Does it exist?'
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
    THEN '✅ organizations table EXISTS'
    ELSE '❌ organizations table DOES NOT EXIST'
  END as status;

\echo ''

-- 5. List ALL tables in public schema
\echo '5. ALL TABLES - What tables exist in public schema?'
SELECT 
  table_name,
  CASE 
    WHEN table_type = 'BASE TABLE' THEN 'Table'
    WHEN table_type = 'VIEW' THEN 'View'
    ELSE table_type
  END as type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

\echo ''

-- 6. Check recordings table columns (since migration references it)
\echo '6. RECORDINGS TABLE - All current columns:'
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'recordings'
ORDER BY ordinal_position;

\echo ''

-- 7. Check users table (referenced in foreign keys)
\echo '7. USERS TABLE - Does it exist?'
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
    THEN '✅ users table EXISTS'
    ELSE '❌ users table DOES NOT EXIST'
  END as status;

\echo ''

-- 8. Check org_members table (used in RLS policies)
\echo '8. ORG_MEMBERS TABLE - Does it exist?'
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_members')
    THEN '✅ org_members table EXISTS'
    ELSE '❌ org_members table DOES NOT EXIST'
  END as status;

\echo ''

-- 9. Check for any foreign key constraints on calls table
\echo '9. CALLS TABLE - Foreign key constraints:'
SELECT
  conname as constraint_name,
  conrelid::regclass as table_name,
  confrelid::regclass as referenced_table,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'calls'::regclass
AND contype = 'f';

\echo ''

-- 10. Sample data from calls (just count and structure)
\echo '10. CALLS TABLE - Record count and sample:'
SELECT COUNT(*) as total_calls FROM calls;

\echo ''
\echo 'Taking first 3 rows to see structure...'
SELECT * FROM calls LIMIT 3;

\echo ''
\echo '============================================================================'
\echo 'DIAGNOSTIC COMPLETE'
\echo '============================================================================'
