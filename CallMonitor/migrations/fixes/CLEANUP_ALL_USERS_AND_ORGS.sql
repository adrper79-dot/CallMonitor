-- CLEANUP: Delete ALL users and organizations
-- WARNING: This will delete ALL user data, calls, recordings, etc.
-- Use this to start fresh with a clean database

-- =====================================================
-- STEP 1: Show what will be deleted (VERIFICATION)
-- =====================================================

-- Count everything before deletion
SELECT 'Before Cleanup' as step, 
       (SELECT COUNT(*) FROM auth.users) as auth_users,
       (SELECT COUNT(*) FROM users) as public_users,
       (SELECT COUNT(*) FROM organizations) as organizations,
       (SELECT COUNT(*) FROM org_members) as org_members,
       (SELECT COUNT(*) FROM calls) as calls,
       (SELECT COUNT(*) FROM recordings) as recordings,
       (SELECT COUNT(*) FROM ai_runs) as ai_runs,
       (SELECT COUNT(*) FROM voice_configs) as voice_configs,
       (SELECT COUNT(*) FROM tools) as tools;

-- =====================================================
-- STEP 2: Delete child records first (bottom-up)
-- =====================================================

-- Delete AI runs (references calls)
DELETE FROM ai_runs;

-- Delete recordings (references calls, organizations, tools)
DELETE FROM recordings;

-- Delete calls (references organizations, users)
DELETE FROM calls;

-- Delete org_members (references organizations, users)
DELETE FROM org_members;

-- Delete voice_configs (references organizations)
DELETE FROM voice_configs;

-- Delete users from public.users (references organizations)
DELETE FROM users;

-- =====================================================
-- STEP 3: Break circular references in organizations
-- =====================================================

-- NULL out tool_id and created_by in organizations
-- (breaks circular dependency)
UPDATE organizations
SET tool_id = NULL, created_by = NULL;

-- =====================================================
-- STEP 4: Delete parent records (top-down)
-- =====================================================

-- Delete tools (now safe - no references from organizations)
DELETE FROM tools;

-- Delete organizations (now safe - all children deleted)
DELETE FROM organizations;

-- =====================================================
-- STEP 5: Delete authentication users
-- =====================================================

-- CRITICAL: This deletes users from Supabase Auth
-- They will need to sign up again!
DELETE FROM auth.users;

-- =====================================================
-- STEP 6: Verify cleanup (should show all zeros)
-- =====================================================

SELECT 'After Cleanup' as step,
       (SELECT COUNT(*) FROM auth.users) as auth_users,
       (SELECT COUNT(*) FROM users) as public_users,
       (SELECT COUNT(*) FROM organizations) as organizations,
       (SELECT COUNT(*) FROM org_members) as org_members,
       (SELECT COUNT(*) FROM calls) as calls,
       (SELECT COUNT(*) FROM recordings) as recordings,
       (SELECT COUNT(*) FROM ai_runs) as ai_runs,
       (SELECT COUNT(*) FROM voice_configs) as voice_configs,
       (SELECT COUNT(*) FROM tools) as tools;

-- =====================================================
-- DONE! Database is now clean and ready for new users
-- =====================================================
