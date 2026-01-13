-- FIX: Create tool and link to organization
-- This fixes the "no recordings being created" issue

-- Step 1: Check current status (should show tool_id = null)
SELECT 
  id as organization_id,
  name,
  tool_id,
  CASE 
    WHEN tool_id IS NULL THEN '❌ Missing tool_id'
    ELSE '✅ Has tool_id'
  END as status
FROM organizations
WHERE id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  ORDER BY organization_id DESC
  LIMIT 1
);

-- Step 2: Create a new tool (if needed)
-- Run this ONLY if tool_id is NULL above
INSERT INTO tools (
  name,
  description
)
VALUES (
  'Default Voice Tool',
  'Default tool for call recordings and AI services'
)
ON CONFLICT (name) DO UPDATE 
  SET description = EXCLUDED.description
RETURNING id;

-- Step 3: Copy the UUID returned above, then run this:
-- REPLACE 'YOUR_TOOL_ID_HERE' with the actual UUID from Step 2
UPDATE organizations
SET tool_id = 'YOUR_TOOL_ID_HERE'
WHERE id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  ORDER BY organization_id DESC
  LIMIT 1
);

-- Step 4: Verify the fix worked
SELECT 
  id as organization_id,
  name,
  tool_id,
  CASE 
    WHEN tool_id IS NULL THEN '❌ Still missing!'
    ELSE '✅ Fixed!'
  END as status
FROM organizations
WHERE id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  ORDER BY organization_id DESC
  LIMIT 1
);
