-- Migration: Add RLS policies for transcriptions and ai_summaries tables
-- Date: 2026-02-11
-- Fixes: BL-002, BL-003 from Multi-Agent Audit
-- Priority: HIGH (Multi-tenant data isolation)

-- Enable RLS on transcriptions table
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS transcriptions_org_isolation ON transcriptions;

-- Create RLS policy: Users can only access transcriptions from their organization
CREATE POLICY transcriptions_org_isolation ON transcriptions
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org_id', true)::uuid
    OR current_setting('app.current_org_id', true) IS NULL
  );

-- Enable RLS on ai_summaries table
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS ai_summaries_org_isolation ON ai_summaries;

-- Create RLS policy: Users can only access AI summaries from their organization
CREATE POLICY ai_summaries_org_isolation ON ai_summaries
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org_id', true)::uuid
    OR current_setting('app.current_org_id', true) IS NULL
  );

-- Verify policies created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('transcriptions', 'ai_summaries')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('transcriptions', 'ai_summaries')
  AND schemaname = 'public';
