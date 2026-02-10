-- Migration: Fix artifacts table primary key from TEXT to UUID
-- Purpose: Standardize artifacts.id to use UUID PRIMARY KEY DEFAULT gen_random_uuid()
-- Status: Low risk - table has low usage currently, no FK references found in codebase

-- Step 1: Add new UUID column with default
ALTER TABLE artifacts ADD COLUMN id_new UUID DEFAULT gen_random_uuid();

-- Step 2: Populate new column (generate UUIDs for existing rows)
UPDATE artifacts SET id_new = gen_random_uuid() WHERE id_new IS NULL;

-- Step 3: Make new column NOT NULL
ALTER TABLE artifacts ALTER COLUMN id_new SET NOT NULL;

-- Step 4: Drop old primary key constraint
ALTER TABLE artifacts DROP CONSTRAINT artifacts_pkey;

-- Step 5: Drop old TEXT column
ALTER TABLE artifacts DROP COLUMN id;

-- Step 6: Rename new column to id
ALTER TABLE artifacts RENAME COLUMN id_new TO id;

-- Step 7: Add new primary key constraint
ALTER TABLE artifacts ADD CONSTRAINT artifacts_pkey PRIMARY KEY (id);

-- Step 8: Update the index name to match new column
DROP INDEX IF EXISTS idx_artifacts_org_id;
CREATE INDEX idx_artifacts_org_id ON artifacts (organization_id);

COMMENT ON TABLE artifacts IS 'Artifacts storage with standardized UUID primary keys';