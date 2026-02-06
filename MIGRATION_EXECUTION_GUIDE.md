# Migration Execution Guide

**Date**: February 6, 2026
**Status**: Ready to Execute
**Risk Level**: 🟢 LOW (Idempotent migrations with safety guards)

---

## Prerequisites

Ensure you have the `NEON_PG_CONN` environment variable set:

```bash
# Check if variable exists
echo $NEON_PG_CONN

# If not set, get from Cloudflare Workers secrets
wrangler secret list --config workers/wrangler.toml
```

---

## Migration 1: Drop Zombie Auth Schemas ✅

**File**: `migrations/005_drop_zombie_auth_schemas.sql`
**Purpose**: Remove 6 unused authentication schemas from database cleanup
**Risk**: 🟢 LOW - All schemas verified unused by Agent 2

### Pre-execution Verification

```bash
# Verify no active connections to zombie schemas
psql $NEON_PG_CONN -c "
  SELECT schema_name
  FROM information_schema.schemata
  WHERE schema_name IN ('authjs', 'next_auth', 'neon_auth', 'realtime', 'graphql', 'graphql_public');
"
```

**Expected**: List of schemas that will be dropped

### Execute Migration

```bash
psql $NEON_PG_CONN -f migrations/005_drop_zombie_auth_schemas.sql
```

**Expected Output**:
```
DROP SCHEMA
DROP SCHEMA
DROP SCHEMA
DROP SCHEMA
DROP SCHEMA
DROP SCHEMA
```

### Post-execution Verification

```bash
# Verify schemas are gone
psql $NEON_PG_CONN -c "
  SELECT schema_name
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('public', 'pg_catalog', 'information_schema',
                            'pg_toast', 'auth', 'extensions', 'storage',
                            'vault', 'supabase_functions', 'supabase_migrations');
"
```

**Expected**: Empty result (0 rows) or only `auth` schema remaining

---

## Migration 2: Add Billing Columns ✅

**File**: `migrations/2026-02-06-billing-columns.sql`
**Purpose**: Add Stripe billing columns to `organizations` table + create `billing_events` table
**Risk**: 🟢 LOW - Idempotent with IF NOT EXISTS checks

### Pre-execution Verification

```bash
# Check current organizations table structure
psql $NEON_PG_CONN -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'organizations'
  AND column_name LIKE '%subscription%' OR column_name LIKE '%plan%';
"
```

**Expected**: May show existing columns (safe - migration won't duplicate)

### Execute Migration

```bash
psql $NEON_PG_CONN -f migrations/2026-02-06-billing-columns.sql
```

**Expected Output**:
```
DO
DO
DO
DO
DO
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
COMMENT
```

### Post-execution Verification

```bash
# Verify new columns exist
psql $NEON_PG_CONN -c "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'organizations'
  AND column_name IN ('subscription_status', 'subscription_id', 'plan_id', 'plan_started_at', 'plan_ends_at')
  ORDER BY column_name;
"
```

**Expected**: 5 rows showing all new columns

```bash
# Verify billing_events table exists
psql $NEON_PG_CONN -c "\d billing_events"
```

**Expected**: Table structure with columns: id, organization_id, event_type, amount, invoice_id, payment_intent_id, metadata, created_at

---

## Migration 3: Run RLS Audit (Diagnostic Only) 📊

**File**: `scripts/rls-audit.sql`
**Purpose**: Generate report of missing Row Level Security policies
**Risk**: 🟢 ZERO - Read-only diagnostic

### Execute Audit

```bash
npm run db:rls-audit > rls-audit-report-2026-02-06.txt
```

**OR manually:**

```bash
psql $NEON_PG_CONN -f scripts/rls-audit.sql > rls-audit-report-2026-02-06.txt
```

### Review Report

```bash
cat rls-audit-report-2026-02-06.txt
```

**Expected Sections**:
1. Table RLS Status (enabled/disabled)
2. Active RLS Policies (current policies)
3. Missing RLS on Org-Scoped Tables (⚠️ SECURITY GAPS)
4. Reference Tables Without org_id (safe to skip)

### Next Steps After Audit

If Section 3 shows missing RLS policies:

1. Review the generated `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` statements
2. Create a new migration: `migrations/006_enable_rls_policies.sql`
3. Add policies for org isolation:
   ```sql
   CREATE POLICY org_isolation_policy ON <table_name>
   FOR ALL
   USING (organization_id = current_setting('app.org_id')::uuid);
   ```
4. Execute migration
5. Test with multi-org accounts

---

## Rollback Plans

### Rollback Migration 1 (Zombie Schemas)

⚠️ **NOT RECOMMENDED** - Schemas were unused

If needed:
```sql
-- Manually recreate schemas (no data to restore)
CREATE SCHEMA IF NOT EXISTS authjs;
CREATE SCHEMA IF NOT EXISTS next_auth;
CREATE SCHEMA IF NOT EXISTS neon_auth;
-- etc.
```

### Rollback Migration 2 (Billing Columns)

```sql
-- Remove columns from organizations table
ALTER TABLE public.organizations DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS subscription_id;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS plan_id;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS plan_started_at;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS plan_ends_at;

-- Drop billing_events table
DROP TABLE IF EXISTS public.billing_events;
```

---

## Post-Migration Checklist

After running all migrations:

- [ ] Verify zombie schemas are gone
- [ ] Verify billing columns exist in `organizations`
- [ ] Verify `billing_events` table created
- [ ] Run RLS audit and review output
- [ ] Test auth flow (ensure no regressions)
- [ ] Test billing endpoints (if applicable)
- [ ] Update `ARCH_DOCS/CURRENT_STATUS.md` to mark H7 complete
- [ ] Commit migration files if not already committed
- [ ] Deploy Workers with updated schema awareness

---

## Troubleshooting

### Error: "relation does not exist"
- **Cause**: Wrong database connection
- **Fix**: Verify `NEON_PG_CONN` points to production Neon database

### Error: "permission denied"
- **Cause**: Insufficient privileges
- **Fix**: Ensure connection uses admin/owner role

### Error: "database is locked"
- **Cause**: Active transactions
- **Fix**: Wait for transactions to complete, or run during maintenance window

### Migration runs but no changes
- **Cause**: Changes already applied (migrations are idempotent)
- **Fix**: This is expected! Run verification queries to confirm

---

## Quick Execute (All Migrations)

```bash
# Execute both migrations in sequence
psql $NEON_PG_CONN -f migrations/005_drop_zombie_auth_schemas.sql && \
psql $NEON_PG_CONN -f migrations/2026-02-06-billing-columns.sql && \
npm run db:rls-audit > rls-audit-report-2026-02-06.txt && \
echo "✅ All migrations complete. Review rls-audit-report-2026-02-06.txt"
```

---

## Timeline

- **Migration 1**: < 5 seconds (dropping schemas)
- **Migration 2**: < 10 seconds (adding columns + table)
- **RLS Audit**: < 5 seconds (read-only queries)
- **Total**: < 30 seconds

---

## Status Tracking

Mark as complete after execution:

- `ARCH_DOCS/CURRENT_STATUS.md` - Update v4.7 to mark H7 as ✅ COMPLETE
- `ARCH_DOCS/CRITICAL_FIXES_TRACKER.md` - Mark database cleanup as ✅ RESOLVED
- `ROADMAP.md` - Update RISK/SCALE section progress counter

---

**Prepared by**: Agent 2 (Database Cleanup Agent)
**Reviewed by**: Agent 1 (Security Hardening Agent)
**Approved by**: Orchestrator
