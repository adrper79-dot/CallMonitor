-- Check current structure of calls table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'calls'
ORDER BY ordinal_position;

-- Check if organization_id exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'calls' AND column_name = 'organization_id'
) AS has_organization_id;

-- Count of calls without organization_id (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE 'Calls with NULL organization_id:';
    EXECUTE 'SELECT COUNT(*) FROM calls WHERE organization_id IS NULL';
  ELSE
    RAISE NOTICE 'organization_id column does NOT exist on calls table';
  END IF;
END $$;
