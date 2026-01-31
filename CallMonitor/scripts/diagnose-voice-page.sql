-- ============================================================================
-- Voice Operations Page Diagnostic Script
-- Run this in Supabase SQL Editor to diagnose issues
-- ============================================================================

-- Configuration
DO $$ 
DECLARE
    target_user_email TEXT := 'stepdadstrong@gmail.com';
    target_org_id UUID := '143a4ad7-403c-4933-a0e6-553b05ca77a2';
BEGIN
    RAISE NOTICE '=== Voice Operations Diagnostic ===';
    RAISE NOTICE 'User: %', target_user_email;
    RAISE NOTICE 'Org: %', target_org_id;
END $$;

-- ============================================================================
-- 1. CHECK REQUIRED TABLES EXIST
-- ============================================================================
SELECT '=== TABLE EXISTENCE CHECK ===' as section;

SELECT 
    table_name,
    CASE WHEN table_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users',
    'organizations', 
    'org_members',
    'calls',
    'recordings',
    'voice_configs',
    'voice_targets',
    'campaigns',
    'booking_events',
    'audit_logs',
    'shopper_scripts',
    'caller_id_numbers'
)
ORDER BY table_name;

-- Show missing tables
SELECT '=== MISSING TABLES ===' as section;
SELECT unnest(ARRAY[
    'users', 'organizations', 'org_members', 'calls', 'recordings',
    'voice_configs', 'voice_targets', 'campaigns', 'booking_events',
    'audit_logs', 'shopper_scripts', 'caller_id_numbers'
]) as required_table
EXCEPT
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- ============================================================================
-- 2. CHECK USER EXISTS AND HAS ORGANIZATION
-- ============================================================================
SELECT '=== USER CHECK ===' as section;

SELECT 
    u.id as user_id,
    u.email,
    u.organization_id,
    CASE WHEN u.organization_id IS NOT NULL THEN '✓ Has Org' ELSE '✗ No Org' END as org_status
FROM users u
WHERE u.email = 'stepdadstrong@gmail.com';

-- ============================================================================
-- 3. CHECK ORGANIZATION EXISTS AND HAS PLAN
-- ============================================================================
SELECT '=== ORGANIZATION CHECK ===' as section;

SELECT 
    o.id as org_id,
    o.name,
    o.plan,
    CASE WHEN o.plan IS NOT NULL THEN '✓ Has Plan' ELSE '✗ No Plan' END as plan_status
FROM organizations o
WHERE o.id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';

-- ============================================================================
-- 4. CHECK USER IS MEMBER OF ORGANIZATION
-- ============================================================================
SELECT '=== ORG MEMBERSHIP CHECK ===' as section;

SELECT 
    om.user_id,
    om.organization_id,
    om.role,
    u.email,
    CASE WHEN om.role IS NOT NULL THEN '✓ Has Role' ELSE '✗ No Role' END as role_status
FROM users u
LEFT JOIN org_members om ON om.user_id = u.id 
    AND om.organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
WHERE u.email = 'stepdadstrong@gmail.com';

-- ============================================================================
-- 5. CHECK VOICE CONFIG EXISTS (only if table exists)
-- ============================================================================
SELECT '=== VOICE CONFIG CHECK ===' as section;

-- Check if voice_configs table exists first
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_configs')
        THEN '✓ voice_configs table exists - checking data...'
        ELSE '✗ voice_configs table does NOT exist - needs to be created via migration'
    END as table_status;

-- Run this manually if the table exists:
-- SELECT vc.id, vc.organization_id, vc.record, vc.transcribe, vc.translate, vc.survey, vc.synthetic_caller
-- FROM voice_configs vc WHERE vc.organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';

-- ============================================================================
-- 6. QUICK DATA COUNTS (run each separately if some tables don't exist)
-- ============================================================================
SELECT '=== DATA COUNTS ===' as section;

-- Note: Run these one at a time if you get errors - some tables may not exist
-- SELECT 'calls' as table_name, COUNT(*) as count FROM calls WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';
-- SELECT 'recordings' as table_name, COUNT(*) as count FROM recordings WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';
-- SELECT 'voice_targets' as table_name, COUNT(*) as count FROM voice_targets WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';
-- SELECT 'campaigns' as table_name, COUNT(*) as count FROM campaigns WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';

-- Safe count query using information_schema (always works)
SELECT 
    t.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN '✓ Table exists' ELSE '✗ Missing' END as status
FROM (
    SELECT unnest(ARRAY['calls', 'recordings', 'voice_targets', 'campaigns', 'voice_configs']) as expected_table
) e
LEFT JOIN information_schema.tables t 
    ON t.table_schema = 'public' AND t.table_name = e.expected_table
ORDER BY e.expected_table;

-- ============================================================================
-- 7. FIX SCRIPT: Create missing org_member if needed
-- ============================================================================
SELECT '=== FIX: Add org membership if missing ===' as section;

-- This INSERT will be a no-op if the membership already exists
-- Uncomment to run:
/*
INSERT INTO org_members (id, organization_id, user_id, role, created_at)
SELECT 
    gen_random_uuid(),
    '143a4ad7-403c-4933-a0e6-553b05ca77a2',
    u.id,
    'owner',
    NOW()
FROM users u
WHERE u.email = 'stepdadstrong@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM org_members om 
    WHERE om.user_id = u.id 
    AND om.organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
)
RETURNING *;
*/

-- ============================================================================
-- 8. FIX SCRIPT: Create voice_config if missing (only if table exists)
-- ============================================================================
SELECT '=== FIX: Create voice_config if missing ===' as section;

-- NOTE: Only run this if voice_configs table exists!
-- Check first: SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_configs');

-- Uncomment to run (AFTER confirming table exists):
/*
INSERT INTO voice_configs (id, organization_id, record, transcribe, translate, survey, synthetic_caller)
SELECT 
    gen_random_uuid(),
    '143a4ad7-403c-4933-a0e6-553b05ca77a2',
    false, false, false, false, false
WHERE NOT EXISTS (
    SELECT 1 FROM voice_configs 
    WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
)
RETURNING *;
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT '=== DIAGNOSTIC COMPLETE ===' as section;
SELECT 'Run the FIX scripts above (uncomment them) if any checks failed.' as note;
