# Database Schema Diagnostic

## Problem
The Tier 1 migration is failing with:
```
ERROR: 42703: column "organization_id" does not exist
```

Even the "fixed" migration that was supposed to add it automatically is failing.

---

## Step 1: Check Current Schema

Run this to see what's actually in your database:

```bash
psql "$SUPABASE_CONNECTION_STRING" -f scripts/check-current-schema.sql
```

This will show:
- ✅ What tables exist
- ✅ What columns are in the `calls` table
- ✅ Whether `organization_id` exists
- ✅ All foreign keys
- ✅ Sample data structure

---

## Step 2: Add Missing Column (If Needed)

If the diagnostic confirms `organization_id` is missing, run:

```bash
psql "$SUPABASE_CONNECTION_STRING" -f scripts/add-organization-id-to-calls.sql
```

This script:
- Checks if column exists before adding
- Adds `organization_id UUID` column
- Creates foreign key to `organizations` table
- Adds index for performance
- Verifies success

---

## Step 3: Run Tier 1 Migration

After adding `organization_id`, run the tier 1 migration:

```bash
psql "$SUPABASE_CONNECTION_STRING" -f migrations/2026-01-14-tier1-features-fixed.sql
```

---

## Possible Issues

### Issue 1: Organizations table doesn't exist
**Symptom**: Foreign key constraint fails
**Fix**: Need to create organizations table first

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'professional',
  plan_status TEXT DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Issue 2: Calls table doesn't exist
**Symptom**: Can't add column to non-existent table
**Fix**: Need to create calls table first

```sql
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT UNIQUE,
  status TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Issue 3: DO block syntax not supported
**Symptom**: `DO $$ ... END $$` fails
**Solution**: Your Supabase version might not support it. Use simpler approach:

```sql
-- Just add the column directly (will error if exists, but harmless)
ALTER TABLE calls ADD COLUMN organization_id UUID;
ALTER TABLE calls ADD CONSTRAINT calls_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
```

---

## Alternative: Single Simple Script

If the DO blocks are causing issues, here's a simpler version:

```sql
-- Step 1: Add column (ignore error if exists)
ALTER TABLE calls ADD COLUMN organization_id UUID;

-- Step 2: Add foreign key (ignore error if exists)  
ALTER TABLE calls ADD CONSTRAINT calls_organization_id_fkey 
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Step 3: Add index
CREATE INDEX IF NOT EXISTS idx_calls_organization_id ON calls(organization_id);

-- Step 4: Verify
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'calls' AND column_name = 'organization_id';
```

---

## Debug Output Format

When you run `check-current-schema.sql`, you should see:

```
============================================================================
CHECKING CURRENT DATABASE SCHEMA
============================================================================

1. CALLS TABLE - Does it exist?
✅ calls table EXISTS

2. CALLS TABLE - All current columns:
 column_name  | data_type | is_nullable | column_default
--------------+-----------+-------------+----------------
 id           | uuid      | NO          | gen_random_uuid()
 call_sid     | text      | YES         | 
 status       | text      | YES         |
 ...

3. CALLS TABLE - Does organization_id exist?
❌ organization_id DOES NOT EXIST in calls table  <-- THE PROBLEM

4. ORGANIZATIONS TABLE - Does it exist?
✅ organizations table EXISTS

...
```

---

## Quick Commands

```bash
# 1. Get your Supabase connection string
# Go to: Supabase Dashboard → Settings → Database → Connection String
# Copy the "Session pooler" connection string

# 2. Set it as environment variable
export SUPABASE_CONNECTION_STRING="postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# 3. Run diagnostic
psql "$SUPABASE_CONNECTION_STRING" -f scripts/check-current-schema.sql > schema-report.txt

# 4. Share the output
cat schema-report.txt
```

---

## What To Share

After running the diagnostic, share:

1. **Does calls table exist?** (Yes/No)
2. **Does organization_id exist in calls?** (Yes/No)
3. **Does organizations table exist?** (Yes/No)
4. **List of all columns in calls table**
5. **Any error messages from the diagnostic**

This will tell us exactly what's missing and how to fix it.

---

## Files Created

| File | Purpose |
|------|---------|
| `scripts/check-current-schema.sql` | Diagnostic - shows current DB state |
| `scripts/add-organization-id-to-calls.sql` | Fix - adds missing column |
| `SCHEMA_DIAGNOSTIC.md` | This guide |

**Next**: Run the diagnostic and share the output!
