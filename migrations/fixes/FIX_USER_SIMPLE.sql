-- SIMPLE FIX: Add org_members and tool_id
-- Run this entire script at once

-- Step 1: Add org_members
INSERT INTO org_members (organization_id, user_id, role)
VALUES ('688625da-c06b-4c51-bacd-1fc9543818e9', 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6', 'owner')
ON CONFLICT DO NOTHING;

-- Step 2: Create tool and get its ID
WITH new_tool AS (
  INSERT INTO tools (name, description)
  VALUES ('Default Voice Tool', 'Default tool for call recordings and AI services')
  RETURNING id
)
-- Step 3: Link tool to organization
UPDATE organizations
SET tool_id = (SELECT id FROM new_tool)
WHERE id = '688625da-c06b-4c51-bacd-1fc9543818e9'
  AND tool_id IS NULL;

-- Step 4: Verify
SELECT 
  o.id as org_id,
  o.name,
  o.tool_id,
  CASE 
    WHEN o.tool_id IS NULL THEN '❌ STILL NULL - CHECK LOGS'
    ELSE '✅ TOOL ID SET!'
  END as status,
  om.role as user_role
FROM organizations o
LEFT JOIN org_members om ON om.organization_id = o.id AND om.user_id = 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6'
WHERE o.id = '688625da-c06b-4c51-bacd-1fc9543818e9';
