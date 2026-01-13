-- SIMPLEST FIX: Create tool and link to organization in one transaction
-- Just run this entire block - it will fix everything automatically

DO $$
DECLARE
  v_tool_id uuid;
  v_org_id uuid;
BEGIN
  -- Get your organization ID
  SELECT DISTINCT organization_id INTO v_org_id
  FROM calls 
  ORDER BY organization_id DESC
  LIMIT 1;
  
  RAISE NOTICE 'Found organization: %', v_org_id;
  
  -- Check if a default tool already exists
  SELECT id INTO v_tool_id
  FROM tools
  WHERE name = 'Default Voice Tool';
  
  -- If not, create it
  IF v_tool_id IS NULL THEN
    INSERT INTO tools (name, description)
    VALUES ('Default Voice Tool', 'Default tool for call recordings and AI services')
    RETURNING id INTO v_tool_id;
    
    RAISE NOTICE 'Created new tool: %', v_tool_id;
  ELSE
    RAISE NOTICE 'Using existing tool: %', v_tool_id;
  END IF;
  
  -- Link tool to organization
  UPDATE organizations
  SET tool_id = v_tool_id
  WHERE id = v_org_id;
  
  RAISE NOTICE 'Linked tool % to organization %', v_tool_id, v_org_id;
  
  -- Show result
  RAISE NOTICE 'Fix complete! Verifying...';
END $$;

-- Verify the fix
SELECT 
  o.id as organization_id,
  o.name,
  o.tool_id,
  t.name as tool_name,
  '✅ FIXED!' as status
FROM organizations o
LEFT JOIN tools t ON t.id = o.tool_id
WHERE o.id IN (
  SELECT DISTINCT organization_id 
  FROM calls 
  ORDER BY organization_id DESC
  LIMIT 1
);
