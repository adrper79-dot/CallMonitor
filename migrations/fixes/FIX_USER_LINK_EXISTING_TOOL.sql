-- FIX: Link existing tool to organization
-- Tool already exists, just need to link it!

-- Step 1: Find the existing tool
SELECT 'Existing Tool' as info, id, name, description 
FROM tools 
WHERE name = 'Default Voice Tool' 
LIMIT 1;

-- Step 2: Link the existing tool to your organization
UPDATE organizations
SET tool_id = (
  SELECT id FROM tools 
  WHERE name = 'Default Voice Tool' 
  LIMIT 1
)
WHERE id = '688625da-c06b-4c51-bacd-1fc9543818e9'
  AND tool_id IS NULL
RETURNING id, tool_id;

-- Step 3: Add org_members if missing
INSERT INTO org_members (organization_id, user_id, role)
VALUES ('688625da-c06b-4c51-bacd-1fc9543818e9', 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6', 'owner')
ON CONFLICT DO NOTHING;

-- Step 4: VERIFY EVERYTHING
SELECT 
  '✅ VERIFICATION' as status,
  o.id as org_id,
  o.name as org_name,
  o.tool_id,
  t.name as tool_name,
  om.role as user_role,
  CASE 
    WHEN o.tool_id IS NOT NULL AND om.role IS NOT NULL THEN '🎉 ALL FIXED!'
    WHEN o.tool_id IS NULL THEN '❌ TOOL_ID STILL NULL'
    WHEN om.role IS NULL THEN '❌ ORG_MEMBERS MISSING'
    ELSE '⚠️ UNKNOWN STATE'
  END as result
FROM organizations o
LEFT JOIN tools t ON t.id = o.tool_id
LEFT JOIN org_members om ON om.organization_id = o.id AND om.user_id = 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6'
WHERE o.id = '688625da-c06b-4c51-bacd-1fc9543818e9';
