-- ============================================================
-- DEEP VALIDATION: Database Schema Verification Script
-- Run this in Supabase SQL Editor to validate all tables
-- Generated: 2026-01-14
-- ============================================================

-- 1. CHECK ALL REQUIRED TABLES EXIST
SELECT '=== TABLE EXISTENCE CHECK ===' as section;

SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'organizations',
    'users', 
    'org_members',
    'calls',
    'recordings',
    'voice_configs',
    'ai_runs',
    'audit_logs',
    'voice_targets',
    'surveys',
    'booking_events',
    'caller_id_numbers',
    'shopper_scripts',
    'shopper_results',
    'evidence_manifests',
    'tools',
    'systems'
  )
ORDER BY table_name;

-- 2. CHECK CRITICAL COLUMNS IN CALLS TABLE
SELECT '=== CALLS TABLE COLUMNS ===' as section;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;

-- 3. CHECK VOICE_CONFIGS TABLE STRUCTURE
SELECT '=== VOICE_CONFIGS COLUMNS ===' as section;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'voice_configs'
ORDER BY ordinal_position;

-- 4. CHECK VOICE_TARGETS TABLE
SELECT '=== VOICE_TARGETS COLUMNS ===' as section;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'voice_targets'
ORDER BY ordinal_position;

-- 5. CHECK BOOKING_EVENTS TABLE
SELECT '=== BOOKING_EVENTS COLUMNS ===' as section;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'booking_events'
ORDER BY ordinal_position;

-- 6. COUNT RECORDS IN KEY TABLES
SELECT '=== RECORD COUNTS ===' as section;

SELECT 'organizations' as table_name, COUNT(*) as count FROM public.organizations
UNION ALL
SELECT 'users', COUNT(*) FROM public.users
UNION ALL
SELECT 'org_members', COUNT(*) FROM public.org_members
UNION ALL
SELECT 'calls', COUNT(*) FROM public.calls
UNION ALL
SELECT 'recordings', COUNT(*) FROM public.recordings
UNION ALL
SELECT 'voice_configs', COUNT(*) FROM public.voice_configs
UNION ALL
SELECT 'voice_targets', COUNT(*) FROM public.voice_targets
UNION ALL
SELECT 'booking_events', COUNT(*) FROM public.booking_events
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM public.audit_logs;

-- 7. CHECK FOREIGN KEY CONSTRAINTS
SELECT '=== FOREIGN KEY CONSTRAINTS ===' as section;

SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 8. CHECK RLS POLICIES
SELECT '=== ROW LEVEL SECURITY POLICIES ===' as section;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 9. CHECK INDEXES
SELECT '=== TABLE INDEXES ===' as section;

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('calls', 'recordings', 'voice_configs', 'audit_logs', 'booking_events')
ORDER BY tablename, indexname;

-- 10. VERIFY ORGANIZATION HAS REQUIRED DATA
SELECT '=== ORGANIZATION DATA VALIDATION ===' as section;

SELECT 
  o.id as org_id,
  o.name as org_name,
  o.plan,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT vc.id) as voice_config_count,
  COUNT(DISTINCT c.id) as call_count
FROM public.organizations o
LEFT JOIN public.users u ON u.organization_id = o.id
LEFT JOIN public.voice_configs vc ON vc.organization_id = o.id
LEFT JOIN public.calls c ON c.organization_id = o.id
GROUP BY o.id, o.name, o.plan
ORDER BY o.created_at DESC
LIMIT 10;

-- 11. CHECK FOR ORPHANED RECORDS
SELECT '=== ORPHAN CHECK ===' as section;

-- Calls without valid organization
SELECT 'orphan_calls' as check_type, COUNT(*) as count
FROM public.calls c
WHERE c.organization_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = c.organization_id);

-- 12. VERIFY TOOLS TABLE HAS ENTRIES
SELECT '=== TOOLS TABLE ===' as section;

SELECT id, name, description, created_at
FROM public.tools
ORDER BY created_at DESC
LIMIT 10;

-- 13. FINAL SUMMARY
SELECT '=== VALIDATION COMPLETE ===' as section;
SELECT 
  'Database validation completed at ' || NOW()::text as message,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables;
