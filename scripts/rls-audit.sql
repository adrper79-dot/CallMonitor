-- ============================================================================
-- RLS Policy Audit — Run against Neon to find coverage gaps
-- Run: psql $NEON_PG_CONN -f scripts/rls-audit.sql
--
-- Output:
--   1. All public tables with RLS status (enabled / DISABLED)
--   2. All active RLS policies with details
--   3. Tables with org-scoped data but NO RLS (action items)
-- ============================================================================

-- Section 1: Table RLS status overview
SELECT '=== TABLE RLS STATUS ===' AS section;

SELECT
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END AS rls_status,
  CASE WHEN c.relforcerowsecurity THEN 'FORCED' ELSE '-' END AS force_status,
  pg_catalog.pg_size_pretty(pg_catalog.pg_total_relation_size(c.oid)) AS total_size
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity DESC, c.relname;

-- Section 2: Active RLS policies
SELECT '=== ACTIVE RLS POLICIES ===' AS section;

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  LEFT(qual::text, 120) AS using_clause,
  LEFT(with_check::text, 120) AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Section 3: Tables that probably need RLS but don't have it
-- (contain organization_id column = org-scoped data)
SELECT '=== ⚠️  ORG-SCOPED TABLES WITHOUT RLS ===' AS section;

SELECT
  t.table_name,
  '❌ MISSING RLS' AS status,
  'ALTER TABLE public.' || t.table_name || ' ENABLE ROW LEVEL SECURITY;' AS fix_sql
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_name = c.table_name AND t.table_schema = c.table_schema
JOIN pg_catalog.pg_class pc ON pc.relname = t.table_name
JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
WHERE c.table_schema = 'public'
  AND c.column_name = 'organization_id'
  AND t.table_type = 'BASE TABLE'
  AND pc.relrowsecurity = false
ORDER BY t.table_name;

-- Section 4: Tables with NO organization_id (reference tables — RLS optional)
SELECT '=== ℹ️  TABLES WITHOUT organization_id (reference data) ===' AS section;

SELECT t.table_name, 'No org_id column' AS note
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN (
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organization_id'
  )
ORDER BY t.table_name;
