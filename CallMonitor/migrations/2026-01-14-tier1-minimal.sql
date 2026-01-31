-- ============================================================================
-- TIER 1 FEATURES MIGRATION (MINIMAL - NO RLS)
-- Run this first, then add RLS policies separately if needed
-- ============================================================================

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

-- consent_verified_at (missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'consent_verified_at'
  ) THEN
    ALTER TABLE calls ADD COLUMN consent_verified_at TIMESTAMPTZ;
    RAISE NOTICE 'Added consent_verified_at to calls';
  END IF;
END $$;

-- ============================================================================
-- 2. ADD CONSENT TO RECORDINGS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recordings' AND column_name = 'consent_captured'
  ) THEN
    ALTER TABLE recordings ADD COLUMN consent_captured BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recordings' AND column_name = 'consent_method'
  ) THEN
    ALTER TABLE recordings ADD COLUMN consent_method TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recordings' AND column_name = 'consent_audio_offset_ms'
  ) THEN
    ALTER TABLE recordings ADD COLUMN consent_audio_offset_ms INTEGER;
  END IF;
END $$;

-- ============================================================================
-- 3. CALL NOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_notes_call_id ON call_notes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_org_id ON call_notes(organization_id);

-- ============================================================================
-- 4. WEBHOOK TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  retry_policy TEXT DEFAULT 'exponential',
  max_retries INTEGER DEFAULT 5,
  timeout_ms INTEGER DEFAULT 30000,
  headers JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT webhook_subscriptions_unique_url UNIQUE (organization_id, url)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  CONSTRAINT webhook_deliveries_idempotent UNIQUE (subscription_id, event_type, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending 
  ON webhook_deliveries(status, next_retry_at) 
  WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org 
  ON webhook_subscriptions(organization_id) 
  WHERE active = true;

-- ============================================================================
-- 5. FEATURE FLAGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  disabled_reason TEXT,
  disabled_at TIMESTAMPTZ,
  disabled_by UUID REFERENCES users(id),
  daily_limit INTEGER,
  monthly_limit INTEGER,
  current_daily_usage INTEGER DEFAULT 0,
  current_monthly_usage INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT org_feature_flags_unique UNIQUE (organization_id, feature)
);

CREATE TABLE IF NOT EXISTS global_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  disabled_reason TEXT,
  disabled_at TIMESTAMPTZ,
  disabled_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed global flags
INSERT INTO global_feature_flags (feature, enabled) VALUES
  ('voice_operations', true),
  ('recording', true),
  ('transcription', true),
  ('translation', true),
  ('live_translation', true),
  ('survey', true),
  ('synthetic_caller', true),
  ('secret_shopper', true),
  ('ai_features', true),
  ('webhooks', true),
  ('api_access', true),
  ('bulk_upload', true),
  ('evidence_export', true)
ON CONFLICT (feature) DO NOTHING;

-- ============================================================================
-- 6. WEBRTC SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  call_id UUID REFERENCES calls(id),
  session_token TEXT NOT NULL UNIQUE,
  signalwire_resource_id TEXT,
  status TEXT DEFAULT 'initializing',
  ice_servers JSONB,
  local_sdp TEXT,
  remote_sdp TEXT,
  audio_bitrate INTEGER,
  packet_loss_percent NUMERIC(5,2),
  jitter_ms INTEGER,
  round_trip_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_active 
  ON webrtc_sessions(organization_id, user_id, status) 
  WHERE status IN ('initializing', 'connecting', 'connected', 'on_call');

-- ============================================================================
-- 7. HELPER FUNCTIONS (no RLS dependency)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_organization_id UUID,
  p_feature TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_global_enabled BOOLEAN;
  v_org_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_global_enabled
  FROM global_feature_flags
  WHERE feature = p_feature;
  
  IF v_global_enabled = false THEN
    RETURN false;
  END IF;
  
  SELECT enabled INTO v_org_enabled
  FROM org_feature_flags
  WHERE organization_id = p_organization_id AND feature = p_feature;
  
  RETURN COALESCE(v_org_enabled, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DONE - Tables created without RLS policies
-- ============================================================================
SELECT 'Tier 1 Migration Complete (without RLS)' AS status;
