-- SAFE CLEANUP: Delete all user and organization data
-- Uses CASCADE to automatically handle all foreign key constraints

-- =====================================================
-- STEP 1: Show current counts
-- =====================================================

SELECT 'Before Cleanup' as step, 
       (SELECT COUNT(*) FROM users) as public_users,
       (SELECT COUNT(*) FROM organizations) as organizations,
       (SELECT COUNT(*) FROM calls) as calls,
       (SELECT COUNT(*) FROM recordings) as recordings;

-- =====================================================
-- STEP 2: Disable foreign key checks temporarily
-- =====================================================

-- Set session to allow constraint deferral
SET CONSTRAINTS ALL DEFERRED;

-- =====================================================
-- STEP 3: Delete in safe order
-- =====================================================

-- Start with deepest children
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE ai_runs CASCADE;
TRUNCATE TABLE recordings CASCADE;
TRUNCATE TABLE calls CASCADE;
TRUNCATE TABLE org_members CASCADE;
TRUNCATE TABLE voice_configs CASCADE;

-- Delete users (references organizations, so do before orgs)
TRUNCATE TABLE users CASCADE;

-- Break circular reference in organizations
UPDATE organizations SET tool_id = NULL, created_by = NULL WHERE tool_id IS NOT NULL OR created_by IS NOT NULL;

-- Delete tools
TRUNCATE TABLE tools CASCADE;

-- Finally delete organizations
TRUNCATE TABLE organizations CASCADE;

-- =====================================================
-- STEP 4: Show results
-- =====================================================

SELECT 'After Cleanup' as step,
       (SELECT COUNT(*) FROM auth.users) as auth_users_remain,
       (SELECT COUNT(*) FROM users) as public_users,
       (SELECT COUNT(*) FROM organizations) as organizations,
       (SELECT COUNT(*) FROM calls) as calls,
       (SELECT COUNT(*) FROM recordings) as recordings,
       (SELECT COUNT(*) FROM audit_logs) as audit_logs;

-- =====================================================
-- SUCCESS! Database is clean
-- =====================================================
