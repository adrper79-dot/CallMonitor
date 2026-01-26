-- DIAGNOSTIC AND CLEANUP FOR BROKEN USERS
-- Aligned with MASTER_ARCHITECTURE: Call-rooted design, clean data model
--
-- This script:
-- 1. Diagnoses user status (auth.users vs public.users)
-- 2. Provides clear recommendations
-- 3. Cleans up orphaned data if needed
-- 4. Follows architecture principle: "If no auth user exists, there's nothing to fix"

-- =====================================================
-- STEP 1: DIAGNOSTIC - Check User Status
-- =====================================================

-- Check for user in both auth and public
SELECT 
  'User Status Check' as diagnostic_step,
  (SELECT COUNT(*) FROM auth.users WHERE email = 'adrper792@gmail.com') as in_auth_users,
  (SELECT COUNT(*) FROM users WHERE email = 'adrper792@gmail.com') as in_public_users,
  CASE
    WHEN (SELECT COUNT(*) FROM auth.users WHERE email = 'adrper792@gmail.com') = 0
      THEN '❌ NOT IN AUTH - User should sign up again'
    WHEN (SELECT COUNT(*) FROM users WHERE email = 'adrper792@gmail.com') = 0
      THEN '⚠️ IN AUTH BUT NOT PUBLIC - Signup incomplete, can fix'
    ELSE '✅ IN BOTH - Check for organization issues'
  END as recommendation;

-- If user is in public, show full details
SELECT 
  'Public User Details' as step,
  u.id,
  u.email,
  u.organization_id,
  u.role,
  u.is_admin,
  o.name as org_name,
  o.plan,
  o.tool_id,
  CASE
    WHEN u.organization_id IS NULL THEN '❌ No organization'
    WHEN o.tool_id IS NULL THEN '❌ Missing tool_id'
    ELSE '✅ Has org and tool'
  END as status
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
WHERE u.email = 'adrper792@gmail.com';

-- =====================================================
-- STEP 2: CONDITIONAL CLEANUP
-- =====================================================

-- SCENARIO A: User NOT in auth.users
-- RECOMMENDATION: Delete orphaned data and have user sign up again

DO $$
DECLARE
  v_email text := 'adrper792@gmail.com';
  v_user_id uuid;
  v_user_in_auth boolean;
  v_user_in_public boolean;
  v_org_id uuid;
BEGIN
  -- Check if user exists in auth
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = v_email
  ) INTO v_user_in_auth;
  
  -- Check if user exists in public
  SELECT EXISTS (
    SELECT 1 FROM users WHERE email = v_email
  ) INTO v_user_in_public;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'DIAGNOSIS RESULTS';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'User in auth.users: %', v_user_in_auth;
  RAISE NOTICE 'User in public.users: %', v_user_in_public;
  RAISE NOTICE '';
  
  IF NOT v_user_in_auth THEN
    RAISE NOTICE '❌ USER NOT IN AUTH.USERS';
    RAISE NOTICE '';
    RAISE NOTICE 'RECOMMENDATION: Delete orphaned data and have user sign up again';
    RAISE NOTICE '';
    RAISE NOTICE 'Architecture Principle: "If no auth user exists, there''s nothing to fix"';
    RAISE NOTICE 'The signup bug has been fixed in code. New signups will work correctly.';
    RAISE NOTICE '';
    
    IF v_user_in_public THEN
      -- Get user details before cleanup
      SELECT id, organization_id INTO v_user_id, v_org_id
      FROM users WHERE email = v_email;
      
      RAISE NOTICE 'CLEANING UP ORPHANED DATA:';
      RAISE NOTICE 'User ID: %', v_user_id;
      RAISE NOTICE 'Organization ID: %', v_org_id;
      RAISE NOTICE '';
      
      -- Delete in correct order (respect foreign keys)
      
      -- 1. Delete org_members
      DELETE FROM org_members WHERE user_id = v_user_id;
      RAISE NOTICE '✓ Deleted org_members records';
      
      -- 2. Delete user from public.users
      DELETE FROM users WHERE id = v_user_id;
      RAISE NOTICE '✓ Deleted user from public.users';
      
      -- 3. If organization has no other members, clean it up
      IF NOT EXISTS (SELECT 1 FROM org_members WHERE organization_id = v_org_id) THEN
        -- Delete voice_configs
        DELETE FROM voice_configs WHERE organization_id = v_org_id;
        RAISE NOTICE '✓ Deleted voice_configs for empty org';
        
        -- NULL out tool_id before deleting org
        UPDATE organizations SET tool_id = NULL WHERE id = v_org_id;
        
        -- Delete organization
        DELETE FROM organizations WHERE id = v_org_id;
        RAISE NOTICE '✓ Deleted empty organization';
      ELSE
        RAISE NOTICE '⚠️  Organization has other members - keeping it';
      END IF;
      
      RAISE NOTICE '';
      RAISE NOTICE '✅ CLEANUP COMPLETE';
      RAISE NOTICE '';
      RAISE NOTICE 'NEXT STEPS:';
      RAISE NOTICE '1. Have user visit: https://your-domain.com/signup';
      RAISE NOTICE '2. User signs up with email: %', v_email;
      RAISE NOTICE '3. Signup will work correctly (bug is fixed in code)';
      
    ELSE
      RAISE NOTICE 'No orphaned data found. User can simply sign up.';
    END IF;
    
  ELSIF v_user_in_auth AND NOT v_user_in_public THEN
    RAISE NOTICE '⚠️  USER IN AUTH BUT NOT IN PUBLIC';
    RAISE NOTICE '';
    RAISE NOTICE 'RECOMMENDATION: Signup incomplete, can complete setup';
    RAISE NOTICE '';
    RAISE NOTICE 'This means signup started but didn''t finish.';
    RAISE NOTICE 'User exists in Supabase Auth but missing public.users record.';
    RAISE NOTICE '';
    RAISE NOTICE 'OPTIONS:';
    RAISE NOTICE '1. Complete setup by running signup flow manually';
    RAISE NOTICE '2. Delete from auth.users and have user sign up again (cleanest)';
    RAISE NOTICE '';
    RAISE NOTICE 'To delete and start fresh:';
    RAISE NOTICE 'DELETE FROM auth.users WHERE email = ''%'';', v_email;
    RAISE NOTICE 'Then have user sign up again.';
    
  ELSE
    RAISE NOTICE '✅ USER EXISTS IN BOTH AUTH AND PUBLIC';
    RAISE NOTICE '';
    RAISE NOTICE 'User has successfully signed up. Checking for organization issues...';
    RAISE NOTICE '';
    
    SELECT id, organization_id INTO v_user_id, v_org_id
    FROM users WHERE email = v_email;
    
    IF v_org_id IS NULL THEN
      RAISE NOTICE '❌ USER MISSING ORGANIZATION';
      RAISE NOTICE '';
      RAISE NOTICE 'This should not happen with the fixed signup code.';
      RAISE NOTICE 'User may have signed up during the bug window.';
      RAISE NOTICE '';
      RAISE NOTICE 'RECOMMENDATION: Have user contact support';
      RAISE NOTICE 'Manual fix required to create organization and link user.';
    ELSE
      RAISE NOTICE '✅ User has organization: %', v_org_id;
      RAISE NOTICE 'No action needed. User should be able to use the system.';
    END IF;
  END IF;
  
  RAISE NOTICE '==============================================';
END $$;

-- =====================================================
-- STEP 3: VERIFICATION
-- =====================================================

-- Final status check
SELECT 
  'Final Status' as step,
  (SELECT COUNT(*) FROM auth.users WHERE email = 'adrper792@gmail.com') as in_auth,
  (SELECT COUNT(*) FROM users WHERE email = 'adrper792@gmail.com') as in_public,
  CASE
    WHEN (SELECT COUNT(*) FROM auth.users WHERE email = 'adrper792@gmail.com') = 0
         AND (SELECT COUNT(*) FROM users WHERE email = 'adrper792@gmail.com') = 0
      THEN '✅ CLEANED - User can sign up fresh'
    WHEN (SELECT COUNT(*) FROM auth.users WHERE email = 'adrper792@gmail.com') > 0
         AND (SELECT COUNT(*) FROM users WHERE email = 'adrper792@gmail.com') > 0
      THEN '✅ EXISTS - Check org status above'
    ELSE '⚠️  MIXED STATE - See recommendations above'
  END as final_status;

-- =====================================================
-- ARCHITECTURE ALIGNMENT NOTES
-- =====================================================

-- This script aligns with MASTER_ARCHITECTURE principles:
--
-- 1. **Call-rooted design**: Respects data hierarchy (users → orgs → calls)
-- 2. **Clean data model**: Removes orphans, maintains integrity
-- 3. **Capability-driven**: Auth user existence determines capability to use system
-- 4. **Artifact integrity**: Respects foreign key relationships
-- 5. **No magic fixes**: If auth user doesn't exist, cleanup and restart is correct approach
--
-- Philosophy: "If the user doesn't exist in auth, there's nothing to fix"
-- This is correct because:
-- - Supabase Auth is the source of truth for authentication
-- - public.users is derived from auth.users
-- - Without auth user, they can't login anyway
-- - Cleanest solution: remove orphans, have user sign up with fixed code
