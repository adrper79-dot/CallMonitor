-- ============================================================================
-- SIMPLE FIX: Add organization_id to calls table
-- Run this in Supabase SQL Editor FIRST, then run tier1 migration
-- ============================================================================

-- Add the column (will error if already exists, that's okay)
ALTER TABLE calls ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE calls 
ADD CONSTRAINT calls_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES organizations(id);

-- Add index for performance
CREATE INDEX idx_calls_organization_id ON calls(organization_id);

-- Verify it worked
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'calls'
  AND column_name = 'organization_id';
