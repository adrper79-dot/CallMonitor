-- ============================================================================
-- DIAGNOSE CALL EXECUTION FAILURE
-- Run this in Supabase to identify why execute_call is failing
-- ============================================================================

-- 1. Verify organization exists and has correct plan
SELECT 
  id,
  name,
  plan,
  plan_status,
  created_at,
  CASE 
    WHEN plan IN ('base', 'pro', 'standard', 'active', 'business', 'enterprise', 'global', 'insights') 
    THEN '✅ Valid plan'
    ELSE '⚠️ Unknown plan - may cause issues'
  END as plan_check
FROM organizations 
WHERE id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';

-- 2. Check org membership and roles
SELECT 
  u.id as user_id,
  u.email,
  om.role,
  u.is_admin,
  CASE 
    WHEN om.role IN ('owner', 'admin') THEN '✅ Can execute calls'
    ELSE '⚠️ Limited permissions'
  END as permission_check
FROM users u
JOIN org_members om ON u.id = om.user_id
WHERE om.organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
ORDER BY om.role DESC;

-- 3. Check if systems table is populated (required for calls)
SELECT 
  id,
  key,
  name,
  category,
  execution_plane
FROM systems
WHERE key IN ('signalwire', 'assemblyai', 'elevenlabs', 'cpid')
ORDER BY key;

-- 4. Verify voice_configs exists for this org
SELECT 
  id,
  organization_id,
  record,
  transcribe,
  translate,
  translate_from,
  translate_to,
  updated_at
FROM voice_configs
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2';

-- 5. Check recent calls for this org (if any)
SELECT 
  id,
  call_sid,
  status,
  started_at,
  ended_at
FROM calls
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
ORDER BY started_at DESC NULLS LAST
LIMIT 5;

-- 6. Check for any audit log errors (if any exist)
SELECT 
  id,
  resource_type,
  action,
  after->>'error' as error_message,
  created_at
FROM audit_logs
WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2'
  AND action = 'error'
ORDER BY created_at DESC
LIMIT 10;

-- 7. CRITICAL: Check if 'cpid' system exists (required by startCallHandler)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM systems WHERE key = 'cpid') 
    THEN '✅ CPID system exists'
    ELSE '❌ CPID system MISSING - THIS WILL BREAK CALLS!'
  END as cpid_check;

-- 8. If CPID is missing, this is the fix:
-- UNCOMMENT AND RUN IF STEP 7 SHOWS "MISSING"
/*
INSERT INTO systems (id, key, name, description, category, execution_plane, is_billable, is_internal)
VALUES (
  gen_random_uuid(),
  'cpid',
  'Control Plane & Insights Dashboard',
  'Main application control plane',
  'platform',
  'control',
  false,
  true
)
ON CONFLICT (key) DO NOTHING;
*/

-- 9. Summary Report
SELECT 
  'DIAGNOSTIC SUMMARY' as report_section,
  '===================' as separator
UNION ALL
SELECT 
  '1. Organization',
  CASE WHEN EXISTS (SELECT 1 FROM organizations WHERE id = '143a4ad7-403c-4933-a0e6-553b05ca77a2') 
    THEN '✅ Exists' ELSE '❌ Not found' END
UNION ALL
SELECT 
  '2. Owner user',
  CASE WHEN EXISTS (
    SELECT 1 FROM org_members 
    WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2' 
    AND role = 'owner'
  ) THEN '✅ Exists' ELSE '❌ No owner' END
UNION ALL
SELECT 
  '3. CPID system',
  CASE WHEN EXISTS (SELECT 1 FROM systems WHERE key = 'cpid') 
    THEN '✅ Exists' ELSE '❌ Missing' END
UNION ALL
SELECT 
  '4. Voice config',
  CASE WHEN EXISTS (SELECT 1 FROM voice_configs WHERE organization_id = '143a4ad7-403c-4933-a0e6-553b05ca77a2') 
    THEN '✅ Exists' ELSE '⚠️ Not configured' END
UNION ALL
SELECT 
  '5. voice_targets table',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_targets') 
    THEN '✅ Exists' ELSE '❌ Missing' END
UNION ALL
SELECT 
  '6. surveys table',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'surveys') 
    THEN '✅ Exists' ELSE '❌ Missing' END;
