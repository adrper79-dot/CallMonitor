-- COMPLETE CLEANUP: Delete all user data
-- Handles ALL foreign key constraints in correct order

-- =====================================================
-- STEP 1: Show what will be deleted
-- =====================================================

SELECT 'Before Cleanup' as step, 
       (SELECT COUNT(*) FROM users) as public_users,
       (SELECT COUNT(*) FROM organizations) as organizations,
       (SELECT COUNT(*) FROM calls) as calls,
       (SELECT COUNT(*) FROM recordings) as recordings,
       (SELECT COUNT(*) FROM audit_logs) as audit_logs;

-- =====================================================
-- STEP 2: Delete all child records (deepest first)
-- =====================================================

-- Delete evidence manifests (references recordings)
DELETE FROM evidence_manifests;

-- Delete scored recordings (references recordings, scorecards, organizations)
DELETE FROM scored_recordings;

-- Delete AI runs (references calls)
DELETE FROM ai_runs;

-- Delete recordings (references calls, organizations, tools)
DELETE FROM recordings;

-- Delete scorecards (references organizations)
DELETE FROM scorecards;

-- Delete shopper results (references organizations)
DELETE FROM shopper_results;

-- Delete test results (references test_configs)
DELETE FROM test_results;

-- Delete test statistics (references test_configs)
DELETE FROM test_statistics;

-- Delete kpi logs (references test_configs)
DELETE FROM kpi_logs;

-- Delete number kpi logs (references organizations)
DELETE FROM number_kpi_logs;

-- Delete number kpi snapshots (references organizations)
DELETE FROM number_kpi_snapshot;

-- Delete alert acknowledgements (references alerts)
DELETE FROM alert_acknowledgements;

-- Delete alerts (references organizations, test_configs)
DELETE FROM alerts;

-- Delete test configs (references organizations, monitored_numbers)
DELETE FROM test_configs;

-- Delete monitored numbers (references organizations)
DELETE FROM monitored_numbers;

-- Delete kpi settings (references organizations)
DELETE FROM kpi_settings;

-- Delete report schedules (references organizations)
DELETE FROM report_schedules;

-- Delete webhook configs (references organizations)
DELETE FROM webhook_configs;

-- Delete tool settings (references organizations)
DELETE FROM tool_settings;

-- Delete tool team members (references organizations)
DELETE FROM tool_team_members;

-- Delete tool access (references organizations)
DELETE FROM tool_access;

-- Delete calls (references organizations, users)
DELETE FROM calls;

-- Delete org_members (references organizations, users)
DELETE FROM org_members;

-- Delete voice_configs (references organizations)
DELETE FROM voice_configs;

-- Delete audit logs (references users, organizations)
DELETE FROM audit_logs;

-- Delete roles (references organizations)
DELETE FROM roles;

-- Delete access grants (references organizations, users)
DELETE FROM access_grants_archived;

-- Delete users from public.users (references organizations)
DELETE FROM users;

-- =====================================================
-- STEP 3: Break circular references in organizations
-- =====================================================

-- NULL out all foreign keys in organizations
UPDATE organizations
SET tool_id = NULL, 
    created_by = NULL;

-- =====================================================
-- STEP 4: Delete parent records
-- =====================================================

-- Delete tools (now safe - no references)
DELETE FROM tools;

-- Delete organizations (now safe - all children deleted)
DELETE FROM organizations;

-- =====================================================
-- STEP 5: Show results
-- =====================================================

SELECT 'After Cleanup' as step,
       (SELECT COUNT(*) FROM auth.users) as auth_users_remain,
       (SELECT COUNT(*) FROM users) as public_users,
       (SELECT COUNT(*) FROM organizations) as organizations,
       (SELECT COUNT(*) FROM calls) as calls,
       (SELECT COUNT(*) FROM recordings) as recordings,
       (SELECT COUNT(*) FROM audit_logs) as audit_logs,
       (SELECT COUNT(*) FROM tools) as tools;

-- =====================================================
-- DONE! All application data deleted
-- auth.users remain - when they login, new records created
-- =====================================================
