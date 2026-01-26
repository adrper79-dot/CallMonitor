-- Fix Existing Users Without organization_id
-- Run this to repair any users created during the buggy period

-- ==========================================
-- STEP 1: Identify broken users
-- ==========================================

-- Check for users in auth.users but NOT in public.users
SELECT 
  au.id,
  au.email,
  au.created_at,
  CASE 
    WHEN pu.id IS NULL THEN '❌ MISSING from public.users'
    WHEN pu.organization_id IS NULL THEN '❌ MISSING organization_id'
    ELSE '✅ OK'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL OR pu.organization_id IS NULL
ORDER BY au.created_at DESC;

-- ==========================================
-- STEP 2: Get or create default organization
-- ==========================================

-- Option A: Use existing organization (if you have one)
SELECT id, name, tool_id 
FROM organizations 
ORDER BY created_at DESC 
LIMIT 1;

-- Option B: Create new default organization
-- (Replace YOUR_ADMIN_USER_ID with an actual user ID from auth.users)
-- INSERT INTO organizations (name, plan, plan_status, created_by)
-- VALUES ('Default Organization', 'professional', 'active', 'YOUR_ADMIN_USER_ID')
-- RETURNING id, name;

-- ==========================================
-- STEP 3: Create default tool (if organization doesn't have one)
-- ==========================================

-- Check if organization has tool
-- SELECT id, name, tool_id FROM organizations WHERE tool_id IS NULL;

-- Create tool and link to organization
-- DO $$
-- DECLARE
--   org_id uuid;
--   new_tool_id uuid;
-- BEGIN
--   -- Get organization without tool
--   SELECT id INTO org_id FROM organizations WHERE tool_id IS NULL LIMIT 1;
--   
--   IF org_id IS NOT NULL THEN
--     -- Create tool
--     INSERT INTO tools (name, type, organization_id)
--     VALUES ('Default Recording Tool', 'recording', org_id)
--     RETURNING id INTO new_tool_id;
--     
--     -- Link tool to organization
--     UPDATE organizations 
--     SET tool_id = new_tool_id 
--     WHERE id = org_id;
--     
--     RAISE NOTICE 'Created tool % for organization %', new_tool_id, org_id;
--   END IF;
-- END $$;

-- ==========================================
-- STEP 4: Fix broken users
-- ==========================================

-- MANUAL FIX (after getting organization ID from Step 2):
-- Replace 'YOUR_ORG_ID_HERE' with actual organization UUID

-- Fix users missing from public.users
-- INSERT INTO public.users (id, email, organization_id, role, is_admin)
-- SELECT 
--   au.id,
--   au.email,
--   'YOUR_ORG_ID_HERE'::uuid,
--   'member',
--   false
-- FROM auth.users au
-- LEFT JOIN public.users pu ON pu.id = au.id
-- WHERE pu.id IS NULL;

-- Fix users with NULL organization_id
-- UPDATE public.users
-- SET organization_id = 'YOUR_ORG_ID_HERE'::uuid
-- WHERE organization_id IS NULL;

-- Create missing org_members entries
-- INSERT INTO org_members (organization_id, user_id, role)
-- SELECT 
--   'YOUR_ORG_ID_HERE'::uuid,
--   u.id,
--   'member'
-- FROM public.users u
-- LEFT JOIN org_members om ON om.user_id = u.id
-- WHERE om.user_id IS NULL
-- ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ==========================================
-- STEP 5: Verify fix
-- ==========================================

-- Check all users now have organization
SELECT 
  u.id,
  u.email,
  u.organization_id,
  o.name as org_name,
  o.tool_id,
  om.role as member_role,
  CASE 
    WHEN u.organization_id IS NULL THEN '❌ MISSING org'
    WHEN o.id IS NULL THEN '❌ ORG DOES NOT EXIST'
    WHEN o.tool_id IS NULL THEN '⚠️ ORG MISSING TOOL'
    WHEN om.user_id IS NULL THEN '⚠️ MISSING org_members'
    ELSE '✅ OK'
  END as status
FROM public.users u
LEFT JOIN organizations o ON o.id = u.organization_id
LEFT JOIN org_members om ON om.user_id = u.id AND om.organization_id = u.organization_id
ORDER BY u.created_at DESC;

-- ==========================================
-- AUTOMATED FIX SCRIPT (Run this if you understand the risks)
-- ==========================================

-- DO $$
-- DECLARE
--   default_org_id uuid;
--   default_tool_id uuid;
--   fixed_count int := 0;
-- BEGIN
--   -- Get or create default organization
--   SELECT id INTO default_org_id FROM organizations ORDER BY created_at DESC LIMIT 1;
--   
--   IF default_org_id IS NULL THEN
--     -- Create default organization
--     INSERT INTO organizations (name, plan, plan_status)
--     VALUES ('Default Organization', 'professional', 'active')
--     RETURNING id INTO default_org_id;
--     
--     RAISE NOTICE 'Created default organization: %', default_org_id;
--   END IF;
--   
--   -- Get or create default tool
--   SELECT tool_id INTO default_tool_id FROM organizations WHERE id = default_org_id;
--   
--   IF default_tool_id IS NULL THEN
--     -- Create tool
--     INSERT INTO tools (name, type, organization_id)
--     VALUES ('Default Recording Tool', 'recording', default_org_id)
--     RETURNING id INTO default_tool_id;
--     
--     -- Link tool to organization
--     UPDATE organizations SET tool_id = default_tool_id WHERE id = default_org_id;
--     
--     RAISE NOTICE 'Created default tool: %', default_tool_id;
--   END IF;
--   
--   -- Fix users missing from public.users
--   WITH inserted AS (
--     INSERT INTO public.users (id, email, organization_id, role, is_admin)
--     SELECT 
--       au.id,
--       au.email,
--       default_org_id,
--       'member',
--       false
--     FROM auth.users au
--     LEFT JOIN public.users pu ON pu.id = au.id
--     WHERE pu.id IS NULL
--     RETURNING id
--   )
--   SELECT COUNT(*) INTO fixed_count FROM inserted;
--   RAISE NOTICE 'Created % missing public.users entries', fixed_count;
--   
--   -- Fix users with NULL organization_id
--   UPDATE public.users
--   SET organization_id = default_org_id
--   WHERE organization_id IS NULL;
--   
--   GET DIAGNOSTICS fixed_count = ROW_COUNT;
--   RAISE NOTICE 'Fixed % users with NULL organization_id', fixed_count;
--   
--   -- Create missing org_members entries
--   INSERT INTO org_members (organization_id, user_id, role)
--   SELECT 
--     default_org_id,
--     u.id,
--     'member'
--   FROM public.users u
--   LEFT JOIN org_members om ON om.user_id = u.id AND om.organization_id = default_org_id
--   WHERE om.user_id IS NULL
--   ON CONFLICT (organization_id, user_id) DO NOTHING;
--   
--   GET DIAGNOSTICS fixed_count = ROW_COUNT;
--   RAISE NOTICE 'Created % missing org_members entries', fixed_count;
--   
--   RAISE NOTICE 'Fix complete! All users now have organization: %', default_org_id;
-- END $$;
