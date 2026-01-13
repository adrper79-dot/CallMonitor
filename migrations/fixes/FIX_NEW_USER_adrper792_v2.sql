-- FIX: New user adrper792@gmail.com (FIXED VERSION)
-- User ID: abccc4d0-4eab-4352-b326-008de7568f50
-- 
-- This version handles the case where the user doesn't exist in auth.users

-- Step 1: Check current user status
SELECT 
  u.id as user_id,
  u.email,
  u.organization_id,
  o.name as org_name,
  o.tool_id,
  CASE 
    WHEN u.id IS NULL THEN '❌ User does not exist in public.users'
    WHEN u.organization_id IS NULL THEN '❌ No organization'
    WHEN o.tool_id IS NULL THEN '❌ No tool_id'
    ELSE '✅ Looks good'
  END as status
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
WHERE u.id = 'abccc4d0-4eab-4352-b326-008de7568f50';

-- Step 2: Check if user exists in auth.users
SELECT 
  id,
  email,
  created_at,
  CASE 
    WHEN id IS NOT NULL THEN '✅ User exists in auth.users'
    ELSE '❌ User missing from auth.users'
  END as auth_status
FROM auth.users
WHERE id = 'abccc4d0-4eab-4352-b326-008de7568f50';

-- Step 3: Fix the user (handles both cases)
DO $$
DECLARE
  v_user_id uuid := 'abccc4d0-4eab-4352-b326-008de7568f50';
  v_org_id uuid;
  v_tool_id uuid;
  v_user_exists_in_auth boolean;
  v_user_exists_in_public boolean;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_user_id
  ) INTO v_user_exists_in_auth;
  
  -- Check if user exists in public.users
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = v_user_id
  ) INTO v_user_exists_in_public;
  
  RAISE NOTICE 'User exists in auth.users: %', v_user_exists_in_auth;
  RAISE NOTICE 'User exists in public.users: %', v_user_exists_in_public;
  
  IF NOT v_user_exists_in_auth THEN
    RAISE NOTICE 'ERROR: User does not exist in auth.users!';
    RAISE NOTICE 'The user needs to sign up first, or you need to create them in Supabase Auth.';
    RAISE NOTICE 'Cannot proceed with fix.';
    RETURN;
  END IF;
  
  -- If user exists in auth but not in public, we need to create everything
  IF v_user_exists_in_auth AND NOT v_user_exists_in_public THEN
    RAISE NOTICE 'User exists in auth.users but not in public.users. Creating organization and user...';
    
    -- Create tool first
    INSERT INTO tools (name, description)
    VALUES ('Default Voice Tool', 'Default tool for call recordings')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_tool_id;
    
    RAISE NOTICE 'Created tool: %', v_tool_id;
    
    -- Create organization (with created_by since user exists in auth.users)
    INSERT INTO organizations (name, plan, plan_status, created_by, tool_id)
    VALUES ('adrper792@gmail.com''s Organization', 'professional', 'active', v_user_id, v_tool_id)
    RETURNING id INTO v_org_id;
    
    RAISE NOTICE 'Created organization: %', v_org_id;
    
    -- Create user in public.users
    INSERT INTO users (id, email, organization_id, role, is_admin)
    VALUES (v_user_id, 'adrper792@gmail.com', v_org_id, 'member', false);
    
    RAISE NOTICE 'Created user in public.users';
    
    -- Create org_members
    INSERT INTO org_members (organization_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Created org_members record';
    
    -- Create voice_configs
    INSERT INTO voice_configs (
      organization_id,
      record,
      transcribe,
      translate,
      translate_from,
      translate_to
    )
    VALUES (
      v_org_id,
      true,
      true,
      false,
      'en-US',
      'es-ES'
    );
    
    RAISE NOTICE 'Created voice_configs';
    
  ELSIF v_user_exists_in_public THEN
    -- User exists in public.users, check if they have organization
    SELECT organization_id INTO v_org_id
    FROM users
    WHERE id = v_user_id;
    
    IF v_org_id IS NULL THEN
      RAISE NOTICE 'User exists but has no organization. Creating organization...';
      
      -- Create tool first
      INSERT INTO tools (name, description)
      VALUES ('Default Voice Tool', 'Default tool for call recordings')
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING id INTO v_tool_id;
      
      RAISE NOTICE 'Created tool: %', v_tool_id;
      
      -- Create organization
      INSERT INTO organizations (name, plan, plan_status, created_by, tool_id)
      VALUES ('adrper792@gmail.com''s Organization', 'professional', 'active', v_user_id, v_tool_id)
      RETURNING id INTO v_org_id;
      
      RAISE NOTICE 'Created organization: %', v_org_id;
      
      -- Update user with organization_id
      UPDATE users
      SET organization_id = v_org_id
      WHERE id = v_user_id;
      
      RAISE NOTICE 'Updated user with organization_id';
      
      -- Create org_members
      INSERT INTO org_members (organization_id, user_id, role)
      VALUES (v_org_id, v_user_id, 'owner')
      ON CONFLICT (organization_id, user_id) DO NOTHING;
      
      RAISE NOTICE 'Created org_members record';
      
      -- Create voice_configs
      INSERT INTO voice_configs (
        organization_id,
        record,
        transcribe,
        translate
      )
      VALUES (v_org_id, true, true, false);
      
      RAISE NOTICE 'Created voice_configs';
      
    ELSE
      RAISE NOTICE 'User already has organization: %', v_org_id;
      
      -- Check if organization has tool_id
      SELECT tool_id INTO v_tool_id
      FROM organizations
      WHERE id = v_org_id;
      
      IF v_tool_id IS NULL THEN
        -- Create tool and link it
        INSERT INTO tools (name, description)
        VALUES ('Default Voice Tool', 'Default tool for call recordings')
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id INTO v_tool_id;
        
        UPDATE organizations
        SET tool_id = v_tool_id
        WHERE id = v_org_id;
        
        RAISE NOTICE 'Created and linked tool: %', v_tool_id;
      END IF;
      
      -- Check if voice_configs exists
      IF NOT EXISTS (SELECT 1 FROM voice_configs WHERE organization_id = v_org_id) THEN
        INSERT INTO voice_configs (
          organization_id,
          record,
          transcribe,
          translate
        )
        VALUES (v_org_id, true, true, false);
        
        RAISE NOTICE 'Created voice_configs';
      END IF;
    END IF;
  END IF;
END $$;

-- Step 4: Verify the fix
SELECT 
  u.id as user_id,
  u.email,
  u.organization_id,
  o.name as org_name,
  o.tool_id,
  t.name as tool_name,
  vc.record as recording_enabled,
  om.role as org_role,
  CASE 
    WHEN u.organization_id IS NOT NULL AND o.tool_id IS NOT NULL AND vc.id IS NOT NULL AND om.id IS NOT NULL
    THEN '✅ FIXED!'
    ELSE '❌ Still has issues'
  END as status
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
LEFT JOIN tools t ON t.id = o.tool_id
LEFT JOIN voice_configs vc ON vc.organization_id = o.id
LEFT JOIN org_members om ON om.organization_id = o.id AND om.user_id = u.id
WHERE u.id = 'abccc4d0-4eab-4352-b326-008de7568f50';
