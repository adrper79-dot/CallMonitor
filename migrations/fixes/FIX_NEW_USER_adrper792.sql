-- FIX: New user adrper792@gmail.com 
-- User ID: abccc4d0-4eab-4352-b326-008de7568f50

-- Step 1: Check current user status
SELECT 
  u.id as user_id,
  u.email,
  u.organization_id,
  o.name as org_name,
  o.tool_id,
  CASE 
    WHEN u.organization_id IS NULL THEN '❌ No organization'
    WHEN o.tool_id IS NULL THEN '❌ No tool_id'
    ELSE '✅ Looks good'
  END as status
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
WHERE u.id = 'abccc4d0-4eab-4352-b326-008de7568f50';

-- Step 2: If organization_id is NULL, we need to create everything
-- If organization exists but tool_id is NULL, we only need to create tool

-- Option A: User has NO organization (need to create org + tool + voice_configs)
-- Run this if Step 1 shows organization_id IS NULL

DO $$
DECLARE
  v_user_id uuid := 'abccc4d0-4eab-4352-b326-008de7568f50';
  v_org_id uuid;
  v_tool_id uuid;
BEGIN
  -- Check if user already has organization
  SELECT organization_id INTO v_org_id
  FROM users
  WHERE id = v_user_id;
  
  IF v_org_id IS NULL THEN
    -- Create organization
    INSERT INTO organizations (name, plan, plan_status, created_by)
    VALUES ('adrper792@gmail.com''s Organization', 'professional', 'active', v_user_id)
    RETURNING id INTO v_org_id;
    
    RAISE NOTICE 'Created organization: %', v_org_id;
    
    -- Create tool
    INSERT INTO tools (name, description)
    VALUES ('Default Voice Tool', 'Default tool for call recordings')
    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_tool_id;
    
    RAISE NOTICE 'Created tool: %', v_tool_id;
    
    -- Link tool to organization
    UPDATE organizations
    SET tool_id = v_tool_id
    WHERE id = v_org_id;
    
    RAISE NOTICE 'Linked tool to organization';
    
    -- Update user with organization_id
    UPDATE users
    SET organization_id = v_org_id
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Updated user with organization_id';
    
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
    
    -- Create org_members
    INSERT INTO org_members (organization_id, user_id, role)
    VALUES (v_org_id, v_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Created org_members record';
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
END $$;

-- Step 3: Verify the fix
SELECT 
  u.id as user_id,
  u.email,
  u.organization_id,
  o.name as org_name,
  o.tool_id,
  t.name as tool_name,
  vc.record as recording_enabled,
  CASE 
    WHEN u.organization_id IS NOT NULL AND o.tool_id IS NOT NULL AND vc.id IS NOT NULL 
    THEN '✅ FIXED!'
    ELSE '❌ Still broken'
  END as status
FROM users u
LEFT JOIN organizations o ON o.id = u.organization_id
LEFT JOIN tools t ON t.id = o.tool_id
LEFT JOIN voice_configs vc ON vc.organization_id = o.id
WHERE u.id = 'abccc4d0-4eab-4352-b326-008de7568f50';
