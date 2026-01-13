-- URGENT FIX: Add missing org_members record for new user
-- This will immediately resolve the 401 errors

-- Insert org_members record for the new user
INSERT INTO org_members (
  organization_id,
  user_id,
  role
) VALUES (
  '688625da-c06b-4c51-bacd-1fc9543818e9',  -- org_id
  'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6',  -- user_id
  'owner'  -- First user should be owner
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Verify it was created
SELECT 
  'After Fix' as status,
  om.id as membership_id,
  om.user_id,
  om.organization_id,
  om.role,
  om.created_at
FROM org_members om
WHERE om.user_id = 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6'
  AND om.organization_id = '688625da-c06b-4c51-bacd-1fc9543818e9';
