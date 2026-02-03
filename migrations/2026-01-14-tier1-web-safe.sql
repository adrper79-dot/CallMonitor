-- ============================================================================
-- TIER 1 FEATURES MIGRATION (WEB-SAFE - NO PSQL METACOMMANDS)
-- Safe to run in Supabase SQL Editor
-- ============================================================================

-- 1. ADD MISSING COLUMNS TO CALLS
-- ============================================================================

-- disposition_notes (missing based on your schema output)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'disposition_notes'
  ) THEN
    ALTER TABLE calls ADD COLUMN disposition_notes TEXT;
    RAISE NOTICE 'Added disposition_notes to calls';
  END IF;
END $$;

-- consent_verified_by (missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'consent_verified_by'
  ) THEN
    ALTER TABLE calls ADD COLUMN consent_verified_by UUID;
    RAISE NOTICE 'Added consent_verified_by to calls';
  END IF;
END $$;

-- recording_consent (missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'recording_consent'
  ) THEN
    ALTER TABLE calls ADD COLUMN recording_consent BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added recording_consent to calls';
  END IF;
END $$;

-- escalated (missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'escalated'
  ) THEN
    ALTER TABLE calls ADD COLUMN escalated BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added escalated to calls';
  END IF;
END $$;

-- escalation_time (missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'escalation_time'
  ) THEN
    ALTER TABLE calls ADD COLUMN escalation_time TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added escalation_time to calls';
  END IF;
END $$;

-- ============================================================================
-- 2. ENSURE VOICE_CONFIGS TABLE EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  caller_id_name TEXT,
  caller_id_number TEXT,
  default_from_number TEXT,
  allow_caller_id_override BOOLEAN DEFAULT false,
  translation_enabled BOOLEAN DEFAULT false,
  source_language TEXT DEFAULT 'en',
  target_languages JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE voice_configs ENABLE ROW LEVEL SECURITY;

-- Add RLS policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_configs' AND policyname = 'Users can view their org voice config'
  ) THEN
    CREATE POLICY "Users can view their org voice config"
      ON voice_configs FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM org_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 3. ENSURE VOICE_TARGETS TABLE EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE voice_targets ENABLE ROW LEVEL SECURITY;

-- Add RLS policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_targets' AND policyname = 'Users can view their org targets'
  ) THEN
    CREATE POLICY "Users can view their org targets"
      ON voice_targets FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM org_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 4. ENSURE SURVEYS TABLE EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

-- Add RLS policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'surveys' AND policyname = 'Users can view their org surveys'
  ) THEN
    CREATE POLICY "Users can view their org surveys"
      ON surveys FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM org_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 5. ENSURE BOOKING_EVENTS TABLE EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  target_id UUID REFERENCES voice_targets(id),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  phone_number TEXT NOT NULL,
  call_id UUID REFERENCES calls(id),
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

-- Add RLS policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'booking_events' AND policyname = 'Users can view their org bookings'
  ) THEN
    CREATE POLICY "Users can view their org bookings"
      ON booking_events FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM org_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 6. ENSURE SHOPPER_SCRIPTS TABLE EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopper_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  script_content TEXT NOT NULL,
  scoring_criteria JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shopper_scripts ENABLE ROW LEVEL SECURITY;

-- Add RLS policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'shopper_scripts' AND policyname = 'Users can view their org scripts'
  ) THEN
    CREATE POLICY "Users can view their org scripts"
      ON shopper_scripts FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM org_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Migration completed successfully' AS status;
