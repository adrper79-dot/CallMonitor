-- Migration: Add Row Level Security (RLS) to transcriptions and ai_summaries tables
-- Date: 2026-02-11
-- Priority: HIGH (Security - Multi-tenant Isolation)
-- Issue: Schema Drift Validation found missing RLS policies on critical business tables
-- Reference: ARCH_DOCS/SCHEMA_DRIFT_VALIDATION_2026-02-10.md

-- ============================================================================
-- TRANSCRIPTIONS TABLE RLS
-- ============================================================================

-- Enable RLS on transcriptions table
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Organization isolation for all operations
-- Ensures users can only access transcriptions from their own organization
CREATE POLICY "transcriptions_org_isolation" 
ON transcriptions
FOR ALL
USING (
  organization_id = current_setting('app.current_org_id', true)::UUID
);

-- Additional policy: Platform admins can view all (if needed)
-- Uncomment if platform admin cross-org access is required
-- CREATE POLICY "transcriptions_platform_admin_access" 
-- ON transcriptions
-- FOR SELECT
-- USING (
--   EXISTS (
--     SELECT 1 FROM users 
--     WHERE users.id::text = current_setting('app.current_user_id', true)
--       AND users.is_admin = true
--   )
-- );

-- ============================================================================
-- AI_SUMMARIES TABLE RLS
-- ============================================================================

-- Enable RLS on ai_summaries table
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

-- Policy: Organization isolation for all operations
-- Ensures users can only access AI summaries from their own organization
CREATE POLICY "ai_summaries_org_isolation" 
ON ai_summaries
FOR ALL
USING (
  organization_id = current_setting('app.current_org_id', true)::UUID
);

-- Additional policy: Platform admins can view all (if needed)
-- Uncomment if platform admin cross-org access is required
-- CREATE POLICY "ai_summaries_platform_admin_access" 
-- ON ai_summaries
-- FOR SELECT
-- USING (
--   EXISTS (
--     SELECT 1 FROM users 
--     WHERE users.id::text = current_setting('app.current_user_id', true)
--       AND users.is_admin = true
--   )
-- );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('transcriptions', 'ai_summaries');
-- Expected: Both tables show rowsecurity = true

-- Verify policies are created
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
  AND tablename IN ('transcriptions', 'ai_summaries')
ORDER BY tablename, policyname;
-- Expected: 2 policies (one per table)

-- ============================================================================
-- ROLLBACK (IF NEEDED)
-- ============================================================================

-- To disable RLS (emergency rollback only):
-- ALTER TABLE transcriptions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_summaries DISABLE ROW LEVEL SECURITY;

-- To drop policies:
-- DROP POLICY IF EXISTS "transcriptions_org_isolation" ON transcriptions;
-- DROP POLICY IF EXISTS "ai_summaries_org_isolation" ON ai_summaries;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. This migration adds RLS policies to enforce multi-tenant isolation
-- 2. Policies use current_setting('app.current_org_id') which must be set 
--    by the application layer (Workers API middleware)
-- 3. The 'true' parameter in current_setting allows NULL if not set (graceful degradation)
-- 4. Platform admin policies are commented out - uncomment if cross-org access needed
-- 5. Test thoroughly in staging before production deployment
-- 6. Verify that Workers API sets app.current_org_id in all database connections
--    Reference: workers/src/lib/db.ts - getDb() function

-- ============================================================================
-- TESTING CHECKLIST
-- ============================================================================

-- [ ] 1. Deploy to staging environment
-- [ ] 2. Verify RLS policies are active (run verification queries)
-- [ ] 3. Test normal user operations (should see only their org's data)
-- [ ] 4. Test cross-org isolation (User A should NOT see User B's data)
-- [ ] 5. Test API endpoints that query transcriptions/ai_summaries
-- [ ] 6. Monitor for RLS permission errors in logs
-- [ ] 7. Verify performance impact (RLS should use indexes efficiently)
-- [ ] 8. Deploy to production after staging validation
-- [ ] 9. Update SCHEMA_DRIFT_VALIDATION_2026-02-10.md status to RESOLVED
