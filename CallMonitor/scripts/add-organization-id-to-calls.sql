-- ============================================================================
-- ADD ORGANIZATION_ID TO CALLS TABLE
-- Run this FIRST before running tier1-features migration
-- ============================================================================

-- Check current state
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE '❌ organization_id does NOT exist in calls table - will add it';
  ELSE
    RAISE NOTICE '✅ organization_id already exists in calls table - skipping';
  END IF;
END $$;

-- Add organization_id column if it doesn't exist
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Create foreign key constraint to organizations table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'calls_organization_id_fkey'
  ) THEN
    ALTER TABLE calls 
    ADD CONSTRAINT calls_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES organizations(id);
    
    RAISE NOTICE '✅ Added foreign key constraint calls_organization_id_fkey';
  ELSE
    RAISE NOTICE '✅ Foreign key constraint already exists';
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_organization_id 
ON calls(organization_id);

-- Verify the column was added
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE '✅ SUCCESS: organization_id column now exists in calls table';
  ELSE
    RAISE EXCEPTION '❌ FAILED: organization_id column was not added';
  END IF;
END $$;

-- Show the column details
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'calls' AND column_name = 'organization_id';
