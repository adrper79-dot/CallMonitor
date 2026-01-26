-- COMPLETE FIX: User c5b62f6a-d86b-4b03-9c7d-c020f7b060b6
-- This fixes:
-- 1. Missing org_members record (causing 401 errors)
-- 2. Missing tool_id on organization (causing recordings to be skipped)

-- =====================================================
-- STEP 1: Check current state
-- =====================================================

SELECT 'Current State' as check_type;

-- Check user
SELECT 'User' as type, id, email, organization_id 
FROM users 
WHERE id = 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6';

-- Check organization
SELECT 'Organization' as type, id, name, plan, tool_id 
FROM organizations 
WHERE id = '688625da-c06b-4c51-bacd-1fc9543818e9';

-- Check org_members
SELECT 'Org Members' as type, id, user_id, organization_id, role 
FROM org_members 
WHERE organization_id = '688625da-c06b-4c51-bacd-1fc9543818e9';

-- Check voice_configs
SELECT 'Voice Configs' as type, id, organization_id, record, transcribe, translate 
FROM voice_configs 
WHERE organization_id = '688625da-c06b-4c51-bacd-1fc9543818e9';

-- =====================================================
-- STEP 2: Add missing org_members record
-- =====================================================

INSERT INTO org_members (
  organization_id,
  user_id,
  role
) VALUES (
  '688625da-c06b-4c51-bacd-1fc9543818e9',
  'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6',
  'owner'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

SELECT 'Org Members Created' as status;

-- =====================================================
-- STEP 3: Create tool if missing and link to organization
-- =====================================================

-- Create tool
INSERT INTO tools (name, description)
VALUES ('Default Voice Tool', 'Default tool for call recordings and AI services')
RETURNING id;

-- Get the tool ID we just created
-- IMPORTANT: Copy the UUID from the result above and paste it below!
-- Then uncomment and run the UPDATE statement:

-- UPDATE organizations
-- SET tool_id = 'PASTE_TOOL_ID_HERE'
-- WHERE id = '688625da-c06b-4c51-bacd-1fc9543818e9'
-- RETURNING id, tool_id;

-- =====================================================
-- STEP 4: Ensure voice_configs exists
-- =====================================================

INSERT INTO voice_configs (
  organization_id,
  record,
  transcribe,
  translate,
  translate_from,
  translate_to,
  survey,
  synthetic_caller
) VALUES (
  '688625da-c06b-4c51-bacd-1fc9543818e9',
  true,
  true,
  false,
  'en-US',
  'es-ES',
  false,
  false
)
ON CONFLICT (organization_id) DO NOTHING;

SELECT 'Voice Configs Ensured' as status;

-- =====================================================
-- STEP 5: Verify everything is fixed
-- =====================================================

SELECT 'Final Verification' as check_type;

-- Verify org_members
SELECT 'Org Members ✅' as status, role 
FROM org_members 
WHERE user_id = 'c5b62f6a-d86b-4b03-9c7d-c020f7b060b6' 
  AND organization_id = '688625da-c06b-4c51-bacd-1fc9543818e9';

-- Verify tool_id
SELECT 'Tool ID ✅' as status, tool_id, name 
FROM organizations 
WHERE id = '688625da-c06b-4c51-bacd-1fc9543818e9';

-- Verify voice_configs
SELECT 'Voice Configs ✅' as status, record, transcribe, translate 
FROM voice_configs 
WHERE organization_id = '688625da-c06b-4c51-bacd-1fc9543818e9';

-- =====================================================
-- SUCCESS! User should now be able to:
-- - Access dashboard (no 401 errors)
-- - Make calls
-- - Get recordings in database
-- =====================================================
