-- ============================================================================
-- SCHEMA VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify your database is aligned
-- ============================================================================

-- Step 1: Check if critical tables exist
-- ============================================================================
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_targets') 
    THEN '✅ voice_targets exists'
    ELSE '❌ voice_targets MISSING - Run migration!'
  END as voice_targets_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'surveys') 
    THEN '✅ surveys exists'
    ELSE '❌ surveys MISSING - Run migration!'
  END as surveys_status;

-- Step 2: Check RLS is enabled on critical tables
-- ============================================================================
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('voice_targets', 'surveys', 'voice_configs', 'calls', 'recordings', 'ai_runs', 'organizations', 'users', 'org_members')
ORDER BY tablename;

-- Step 3: Verify voice_targets table structure
-- ============================================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'voice_targets'
ORDER BY ordinal_position;

-- Step 4: Verify surveys table structure
-- ============================================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'surveys'
ORDER BY ordinal_position;

-- Step 5: Check voice_configs has all required fields
-- ============================================================================
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_configs' AND column_name = 'live_translate') 
    THEN '✅ live_translate field exists'
    ELSE '⚠️ live_translate field missing (may need migration 2026-01-14-add-live-translation-fields.sql)'
  END as live_translate_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_configs' AND column_name = 'use_voice_cloning') 
    THEN '✅ use_voice_cloning field exists'
    ELSE '⚠️ use_voice_cloning field missing (may need migration 2026-01-13-add-voice-cloning.sql)'
  END as voice_cloning_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_configs' AND column_name = 'survey_prompts') 
    THEN '✅ survey_prompts field exists'
    ELSE '⚠️ survey_prompts field missing (may need migration 2026-01-14-add-survey-ai-prompts.sql)'
  END as survey_prompts_status;

-- Step 6: Check if booking_events table exists (for Cal.com-style bookings)
-- ============================================================================
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_events') 
    THEN '✅ booking_events exists'
    ELSE '⚠️ booking_events missing (may need migration 2026-01-14-add-booking-events.sql)'
  END as booking_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopper_scripts') 
    THEN '✅ shopper_scripts exists'
    ELSE '⚠️ shopper_scripts missing (may need migration 2026-01-14-add-shopper-scripts.sql)'
  END as shopper_status;

-- Step 7: Check RLS policies on voice_targets
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'voice_targets'
ORDER BY policyname;

-- Step 8: Check RLS policies on surveys
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'surveys'
ORDER BY policyname;

-- Step 9: Verify your organization exists and get org_id
-- ============================================================================
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  o.plan,
  u.email as owner_email,
  om.role as user_role
FROM organizations o
LEFT JOIN org_members om ON o.id = om.organization_id
LEFT JOIN users u ON om.user_id = u.id
WHERE u.email = 'stepdadstrong@gmail.com'
LIMIT 1;

-- Step 10: Check if SERVICE_API_KEY is needed (Vercel env var check - informational only)
-- ============================================================================
SELECT 
  '⚠️ Remember to set SERVICE_API_KEY in Vercel environment variables' as reminder,
  'This is required for the E2E test endpoint /api/test/e2e' as purpose;

-- ============================================================================
-- SUMMARY CHECKLIST
-- ============================================================================
-- Run this query to get a simple checklist:
SELECT 
  'Database Schema Alignment Check' as section,
  '------------------------------------' as separator
UNION ALL
SELECT 
  '1. voice_targets table',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_targets') 
    THEN '✅ Exists' ELSE '❌ Missing' END
UNION ALL
SELECT 
  '2. surveys table',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'surveys') 
    THEN '✅ Exists' ELSE '❌ Missing' END
UNION ALL
SELECT 
  '3. booking_events table',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_events') 
    THEN '✅ Exists' ELSE '❌ Missing' END
UNION ALL
SELECT 
  '4. shopper_scripts table',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shopper_scripts') 
    THEN '✅ Exists' ELSE '❌ Missing' END
UNION ALL
SELECT 
  '5. RLS on voice_targets',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'voice_targets' AND rowsecurity = true) 
    THEN '✅ Enabled' ELSE '❌ Disabled' END
UNION ALL
SELECT 
  '6. RLS on surveys',
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'surveys' AND rowsecurity = true) 
    THEN '✅ Enabled' ELSE '❌ Disabled' END;
