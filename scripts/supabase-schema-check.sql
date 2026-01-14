-- ============================================================================
-- SUPABASE SCHEMA CHECK - Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Check if calls table exists and show all columns
SELECT 
  'CALLS TABLE COLUMNS' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;

-- 2. Check if organization_id exists in calls
SELECT 
  'ORGANIZATION_ID CHECK' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'calls' 
        AND column_name = 'organization_id'
    )
    THEN 'EXISTS'
    ELSE 'MISSING'
  END as status;

-- 3. List all tables in public schema
SELECT 
  'ALL TABLES' as check_type,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 4. Check organizations table
SELECT 
  'ORGANIZATIONS TABLE' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'organizations'
    )
    THEN 'EXISTS'
    ELSE 'MISSING'
  END as status;

-- 5. Check recordings table columns
SELECT 
  'RECORDINGS TABLE COLUMNS' as check_type,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
ORDER BY ordinal_position;

-- 6. Check users table
SELECT 
  'USERS TABLE' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    )
    THEN 'EXISTS'
    ELSE 'MISSING'
  END as status;

-- 7. Check org_members table
SELECT 
  'ORG_MEMBERS TABLE' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'org_members'
    )
    THEN 'EXISTS'
    ELSE 'MISSING'
  END as status;
