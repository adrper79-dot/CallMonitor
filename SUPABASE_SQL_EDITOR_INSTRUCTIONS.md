# Fix Tier 1 Migration - Supabase SQL Editor Instructions

## Problem
Migration failing with: `ERROR: 42703: column "organization_id" does not exist`

---

## Solution (3 Steps)

### Step 1: Check Current Schema

1. Go to **Supabase Dashboard**
2. Click **SQL Editor** in left sidebar
3. Click **+ New Query**
4. Copy/paste this query:

```sql
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;
```

5. Click **Run** (or press Ctrl+Enter)
6. **Look for `organization_id` in the results**
   - If you see it → Skip to Step 3
   - If you DON'T see it → Continue to Step 2

---

### Step 2: Add Missing Column

1. In **SQL Editor**, create new query
2. Copy/paste this:

```sql
-- Add organization_id to calls table
ALTER TABLE calls ADD COLUMN organization_id UUID;

-- Add foreign key
ALTER TABLE calls 
ADD CONSTRAINT calls_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id);

-- Add index
CREATE INDEX idx_calls_organization_id ON calls(organization_id);

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'calls' AND column_name = 'organization_id';
```

3. Click **Run**
4. Should see `organization_id` in results (means it worked)

---

### Step 3: Run Tier 1 Migration

Now the column exists, run the actual migration.

**Option A: Via SQL Editor (Recommended)**

1. Open file: `migrations/2026-01-14-tier1-features.sql`
2. Copy **entire contents**
3. Paste into **SQL Editor**
4. Click **Run**

**Option B: Via Command Line**

```bash
psql "$SUPABASE_CONNECTION_STRING" -f migrations/2026-01-14-tier1-features.sql
```

---

## Verify Success

Run this in SQL Editor to confirm all new tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN (
    'call_notes',
    'webhook_subscriptions',
    'webhook_deliveries',
    'org_feature_flags',
    'global_feature_flags',
    'webrtc_sessions'
  )
ORDER BY table_name;
```

**Expected Result**: Should see all 6 tables listed

---

## If You Get Errors

### Error: "relation already exists"
**Meaning**: Table already created  
**Action**: Ignore, continue

### Error: "constraint already exists"
**Meaning**: Constraint already added  
**Action**: Ignore, continue

### Error: "organizations table does not exist"
**Meaning**: Need to create organizations table first  
**Action**: Run this first:

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

Then go back to Step 2.

---

## Quick Reference

| Step | What | Where |
|------|------|-------|
| 1 | Check schema | SQL Editor |
| 2 | Add column | SQL Editor |
| 3 | Run migration | SQL Editor or CLI |
| 4 | Verify | SQL Editor |

**Files**:
- Check: `scripts/supabase-schema-check.sql`
- Fix: `scripts/add-org-id-simple.sql`
- Migrate: `migrations/2026-01-14-tier1-features.sql`

---

## TL;DR

```sql
-- 1. Check if organization_id exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'calls' AND column_name = 'organization_id';

-- 2. If not, add it
ALTER TABLE calls ADD COLUMN organization_id UUID
  REFERENCES organizations(id);

-- 3. Then run tier1-features.sql in SQL Editor
```

**That's it!**
