-- ============================================================================
-- VOICE OPERATIONS DIAGNOSTIC SCRIPT
-- ============================================================================
-- Checks all required tables and configurations for Voice Operations page
-- Run this against your Supabase database
-- ============================================================================

\echo '═══════════════════════════════════════════════════════════════════════'
\echo 'VOICE OPERATIONS DIAGNOSTIC'
\echo 'Testing for user: stepdadstrong@gmail.com'
\echo 'Org: 143a4ad7-403c-4933-a0e6-553b05ca77a2'
\echo '═══════════════════════════════════════════════════════════════════════'

-- ============================================================================
-- 1. CHECK REQUIRED TABLES EXIST
-- ============================================================================

\echo '\n✓ Checking required tables...'

SELECT 
  'organizations' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 'voice_targets', 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_targets') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'campaigns', 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'voice_configs', 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_configs') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'calls', 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calls') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'org_members', 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_members') 
    THEN '✅ EXISTS' ELSE '❌ MISSING' END;

-- ============================================================================
-- 2. CHECK USER AND ORG MEMBERSHIP
-- ============================================================================

\echo '\n✓ Checking user membership...'

SELECT 
  u.id as user_id,
  u.email,
  om.organization_id,
  om.role,
  o.name as org_name,
  o.plan
FROM auth.users u
LEFT JOIN org_members om ON om.user_id = u.id
LEFT JOIN organizations o ON o.id = om.organization_id
WHERE u.email = 'stepdadstrong@gmail.com'
ORDER BY om.created_at DESC
LIMIT 5;

-- ============================================================================
-- 3. CHECK VOICE TARGETS
-- ============================================================================

\echo '\n✓ Checking voice targets for org...'

SELECT 
  id,
  phone_number,
  name,
  is_active,
  created_at
FROM voice_targets
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 4. CHECK CAMPAIGNS (IF TABLE EXISTS)
-- ============================================================================

\echo '\n✓ Checking campaigns for org...'

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    RAISE NOTICE 'Campaigns table exists, checking data...';
    PERFORM 1 FROM campaigns WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';
  ELSE
    RAISE NOTICE '⚠️  Campaigns table does not exist - will be handled gracefully by API';
  END IF;
END $$;

-- ============================================================================
-- 5. CHECK VOICE CONFIG
-- ============================================================================

\echo '\n✓ Checking voice configuration...'

SELECT 
  id,
  organization_id,
  record,
  transcribe,
  translate,
  survey,
  created_at,
  updated_at
FROM voice_configs
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
LIMIT 1;

-- ============================================================================
-- 6. CHECK RECENT CALLS
-- ============================================================================

\echo '\n✓ Checking recent calls...'

SELECT 
  id,
  call_sid,
  phone_from,
  phone_to,
  status,
  direction,
  created_at
FROM calls
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 7. TABLE STRUCTURE VALIDATION
-- ============================================================================

\echo '\n✓ Validating table structures...'

-- Check voice_targets columns
SELECT 
  'voice_targets' as table_name,
  string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'voice_targets'
GROUP BY table_name;

-- Check voice_configs columns
SELECT 
  'voice_configs' as table_name,
  string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'voice_configs'
GROUP BY table_name;

-- ============================================================================
-- 8. RLS POLICIES CHECK
-- ============================================================================

\echo '\n✓ Checking RLS policies...'

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('voice_targets', 'voice_configs', 'calls', 'campaigns')
ORDER BY tablename, policyname;

-- ============================================================================
-- SUMMARY
-- ============================================================================

\echo '\n═══════════════════════════════════════════════════════════════════════'
\echo 'DIAGNOSTIC COMPLETE'
\echo '═══════════════════════════════════════════════════════════════════════'
\echo 'Next steps:'
\echo '1. If campaigns table is missing, run: migrations/add-campaigns-table.sql'
\echo '2. If voice_targets is empty, add targets via UI or API'
\echo '3. If voice_configs is missing, it will be auto-created on first save'
\echo '4. Test APIs with: scripts/test-voice-ops-apis.sh'
\echo '═══════════════════════════════════════════════════════════════════════'
