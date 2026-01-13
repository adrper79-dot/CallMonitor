-- CLEANUP: Delete all user data from PUBLIC tables only
-- This leaves auth.users intact but removes all application data
-- Users can sign in again and new records will be created

-- =====================================================
-- STEP 1: Show what will be deleted
-- =====================================================

SELECT 'Before Cleanup' as step, 
       (SELECT COUNT(*) FROM users) as public_users,
       (SELECT COUNT(*) FROM organizations) as organizations,
       (SELECT COUNT(*) FROM org_members) as org_members,
       (SELECT COUNT(*) FROM calls) as calls,
       (SELECT COUNT(*) FROM recordings) as recordings,
       (SELECT COUNT(*) FROM ai_runs) as ai_runs,
       (SELECT COUNT(*) FROM voice_configs) as voice_configs,
       (SELECT COUNT(*) FROM tools) as tools,
       (SELECT COUNT(*) FROM audit_logs) as audit_logs;

-- =====================================================
-- STEP 2: Delete child records first (bottom-up)
-- =====================================================

-- Delete audit logs FIRST (references users, organizations)
DELETE FROM audit_logs;

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
UPDATE organizations
SET tool_id = NULL, created_by = NULL;

-- =====================================================
-- STEP 4: Delete parent records
-- =====================================================

-- Delete tools (now safe)
DELETE FROM tools;

-- Delete organizations (now safe)
DELETE FROM organizations;

-- =====================================================
-- STEP 5: Show results
-- =====================================================

SELECT 'After Cleanup' as step,
       (SELECT COUNT(*) FROM auth.users) as auth_users_remain,
       (SELECT COUNT(*) FROM users) as public_users,
       (SELECT COUNT(*) FROM organizations) as organizations,
       (SELECT COUNT(*) FROM org_members) as org_members,
       (SELECT COUNT(*) FROM calls) as calls,
       (SELECT COUNT(*) FROM recordings) as recordings,
       (SELECT COUNT(*) FROM ai_runs) as ai_runs,
       (SELECT COUNT(*) FROM voice_configs) as voice_configs,
       (SELECT COUNT(*) FROM tools) as tools,
       (SELECT COUNT(*) FROM audit_logs) as audit_logs;

-- =====================================================
-- NOTE: auth.users still exist but have no data
-- When they login again, new records will be created
-- =====================================================
