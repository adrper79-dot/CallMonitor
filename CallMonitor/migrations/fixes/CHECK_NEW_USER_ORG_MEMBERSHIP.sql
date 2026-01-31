-- Check if new user has org_members record
-- Run this to diagnose the 401 errors

SELECT 
  'User Info' as check_type,
  u.id as user_id,
  u.email,
  u.organization_id,
  u.role as user_role
FROM users u
WHERE u.id = 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6';

SELECT 
  'Organization Info' as check_type,
  o.id as org_id,
  o.name,
  o.plan,
  o.tool_id
FROM organizations o
WHERE o.id = '688625da-c06b-4c51-bacd-1fc9543818e9';

SELECT 
  'Org Membership' as check_type,
  om.id as membership_id,
  om.user_id,
  om.organization_id,
  om.role as membership_role,
  om.created_at
FROM org_members om
WHERE om.user_id = 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6'
  AND om.organization_id = '688625da-c06b-4c51-bacd-1fc9543818e9';

-- If above is EMPTY, that's the problem!
-- The signup created user and org but NOT org_members!
