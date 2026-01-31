-- ============================================================================
-- TIER 1 FEATURES MIGRATION (SAFE VERSION)
-- Handles missing columns gracefully
-- ============================================================================

-- ============================================================================
-- 0. PRE-REQUISITES: Ensure calls table has organization_id
-- ============================================================================

-- Add organization_id to calls if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE calls ADD COLUMN organization_id UUID REFERENCES organizations(id);
    RAISE NOTICE 'Added organization_id to calls table';
  END IF;
END $$;

-- ============================================================================
-- 1. CALL DISPOSITION (Agent Outcome Tagging)
-- ============================================================================

-- Add disposition columns to calls table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'disposition'
  ) THEN
    ALTER TABLE calls ADD COLUMN disposition TEXT CHECK (disposition IN (
      'sale', 'no_answer', 'voicemail', 'not_interested', 
      'follow_up', 'wrong_number', 'callback_scheduled', 'other'
    ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'disposition_set_at'
  ) THEN
    ALTER TABLE calls ADD COLUMN disposition_set_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'disposition_set_by'
  ) THEN
    ALTER TABLE calls ADD COLUMN disposition_set_by UUID REFERENCES users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'disposition_notes'
  ) THEN
    ALTER TABLE calls ADD COLUMN disposition_notes TEXT;
  END IF;
END $$;

-- Index for disposition analytics
CREATE INDEX IF NOT EXISTS idx_calls_disposition ON calls(disposition) WHERE disposition IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_disposition_set_at ON calls(disposition_set_at) WHERE disposition_set_at IS NOT NULL;

-- ============================================================================
-- 2. CONSENT TRACKING (add to calls)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'consent_method'
  ) THEN
    ALTER TABLE calls ADD COLUMN consent_method TEXT CHECK (consent_method IN (
      'ivr_played', 'verbal_yes', 'dtmf_confirm', 'written', 'assumed', 'none'
    ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'consent_timestamp'
  ) THEN
    ALTER TABLE calls ADD COLUMN consent_timestamp TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'consent_audio_offset_ms'
  ) THEN
    ALTER TABLE calls ADD COLUMN consent_audio_offset_ms INTEGER;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'consent_verified_by'
  ) THEN
    ALTER TABLE calls ADD COLUMN consent_verified_by UUID REFERENCES users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'consent_verified_at'
  ) THEN
    ALTER TABLE calls ADD COLUMN consent_verified_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 3. CONSENT TRACKING (add to recordings)
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
-- 4. STRUCTURED CALL NOTES
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

-- Indexes for call_notes
CREATE INDEX IF NOT EXISTS idx_call_notes_call_id ON call_notes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_org_id ON call_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_tags ON call_notes USING GIN(tags);

-- ============================================================================
-- 5. WEBHOOK SUBSCRIPTIONS
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

-- ============================================================================
-- 6. WEBHOOK DELIVERIES
-- ============================================================================

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

-- Indexes for webhook processing
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending 
  ON webhook_deliveries(status, next_retry_at) 
  WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription 
  ON webhook_deliveries(subscription_id);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org 
  ON webhook_subscriptions(organization_id) 
  WHERE active = true;

-- ============================================================================
-- 7. FEATURE FLAGS (Organization Level)
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

-- Index for quick feature checks
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_lookup 
  ON org_feature_flags(organization_id, feature);

-- ============================================================================
-- 8. FEATURE FLAGS (Global Platform Level)
-- ============================================================================

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

-- Seed global feature flags (all enabled by default)
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
-- 9. WEBRTC SESSIONS
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

-- Index for active sessions
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_active 
  ON webrtc_sessions(organization_id, user_id, status) 
  WHERE status IN ('initializing', 'connecting', 'connected', 'on_call');

-- ============================================================================
-- 10. RLS POLICIES (with existence checks)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE call_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE webrtc_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DO $$
BEGIN
  -- call_notes policies
  DROP POLICY IF EXISTS "Users can view notes in their organization" ON call_notes;
  DROP POLICY IF EXISTS "Users can create notes in their organization" ON call_notes;
  
  CREATE POLICY "Users can view notes in their organization"
    ON call_notes FOR SELECT
    USING (organization_id IN (
      SELECT organization_id FROM org_members WHERE auth.user_equals_auth(user_id::text)
    ));
  
  CREATE POLICY "Users can create notes in their organization"
    ON call_notes FOR INSERT
    WITH CHECK (organization_id IN (
      SELECT organization_id FROM org_members WHERE auth.user_equals_auth(user_id::text)
    ));

  -- webhook_subscriptions policies
  DROP POLICY IF EXISTS "Admins can manage webhooks" ON webhook_subscriptions;
  
  CREATE POLICY "Admins can manage webhooks"
    ON webhook_subscriptions FOR ALL
    USING (organization_id IN (
      SELECT organization_id FROM org_members 
      WHERE auth.user_equals_auth(user_id::text) AND role IN ('owner', 'admin')
    ));

  -- webhook_deliveries policies
  DROP POLICY IF EXISTS "Org members can view webhook deliveries" ON webhook_deliveries;
  
  CREATE POLICY "Org members can view webhook deliveries"
    ON webhook_deliveries FOR SELECT
    USING (subscription_id IN (
      SELECT id FROM webhook_subscriptions WHERE organization_id IN (
        SELECT organization_id FROM org_members WHERE auth.user_equals_auth(user_id::text)
      )
    ));

  -- org_feature_flags policies
  DROP POLICY IF EXISTS "Admins can manage feature flags" ON org_feature_flags;
  
  CREATE POLICY "Admins can manage feature flags"
    ON org_feature_flags FOR ALL
    USING (organization_id IN (
      SELECT organization_id FROM org_members 
      WHERE auth.user_equals_auth(user_id::text) AND role IN ('owner', 'admin')
    ));

  -- webrtc_sessions policies
  DROP POLICY IF EXISTS "Users can manage their own WebRTC sessions" ON webrtc_sessions;
  
  CREATE POLICY "Users can manage their own WebRTC sessions"
    ON webrtc_sessions FOR ALL
    USING (auth.user_equals_auth(user_id::text));
    
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RLS policy creation encountered an issue: %', SQLERRM;
END $$;

-- ============================================================================
-- 11. HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a feature is enabled for an org
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

-- Function to increment feature usage
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_organization_id UUID,
  p_feature TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_flag RECORD;
BEGIN
  SELECT * INTO v_flag
  FROM org_feature_flags
  WHERE organization_id = p_organization_id AND feature = p_feature
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  
  IF NOT v_flag.enabled THEN
    RETURN false;
  END IF;
  
  IF v_flag.daily_limit IS NOT NULL AND v_flag.current_daily_usage >= v_flag.daily_limit THEN
    RETURN false;
  END IF;
  
  IF v_flag.monthly_limit IS NOT NULL AND v_flag.current_monthly_usage >= v_flag.monthly_limit THEN
    RETURN false;
  END IF;
  
  UPDATE org_feature_flags
  SET 
    current_daily_usage = current_daily_usage + 1,
    current_monthly_usage = current_monthly_usage + 1,
    updated_at = NOW()
  WHERE id = v_flag.id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT 'Tier 1 Features Migration Complete' AS status;

