-- ============================================================================
-- DEBUG: Run each section separately to find the error
-- Copy and run ONE section at a time
-- ============================================================================

-- ============================================================================
-- STEP 1: Check what tables exist
-- ============================================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('calls', 'organizations', 'users', 'recordings', 'org_members')
ORDER BY table_name;

-- ============================================================================
-- STEP 2: Check organizations table structure
-- ============================================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 3: Check users table structure  
-- ============================================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 4: Check recordings table structure
-- ============================================================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recordings'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 5: Try adding column to calls (should work based on your output)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'disposition_notes'
  ) THEN
    ALTER TABLE calls ADD COLUMN disposition_notes TEXT;
    RAISE NOTICE 'Added disposition_notes';
  ELSE
    RAISE NOTICE 'disposition_notes already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Try creating call_notes table
-- ============================================================================
CREATE TABLE IF NOT EXISTS call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 7: Try creating global_feature_flags (no FKs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS global_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STEP 8: Seed global flags
-- ============================================================================
INSERT INTO global_feature_flags (feature, enabled) VALUES
  ('voice_operations', true),
  ('recording', true)
ON CONFLICT (feature) DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================
SELECT 'Debug complete' AS status;
