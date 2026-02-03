-- ============================================================================
-- TIER 1 FEATURES - FINAL MIGRATION
-- Tables verified to work from debug script
-- ============================================================================

-- ============================================================================
-- 1. ADD REMAINING COLUMNS TO CALLS
-- ============================================================================

ALTER TABLE calls ADD COLUMN IF NOT EXISTS disposition_notes TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS consent_verified_by UUID;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS consent_verified_at TIMESTAMPTZ;

-- ============================================================================
-- 2. ADD CONSENT COLUMNS TO RECORDINGS
-- ============================================================================

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS consent_captured BOOLEAN DEFAULT false;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS consent_method TEXT;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS consent_audio_offset_ms INTEGER;

-- ============================================================================
-- 3. CALL NOTES TABLE (no FKs to avoid issues)
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_notes_call_id ON call_notes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_org_id ON call_notes(organization_id);

-- ============================================================================
-- 4. WEBHOOK SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  retry_policy TEXT DEFAULT 'exponential',
  max_retries INTEGER DEFAULT 5,
  timeout_ms INTEGER DEFAULT 30000,
  headers JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org ON webhook_subscriptions(organization_id);

-- ============================================================================
-- 5. WEBHOOK DELIVERIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
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
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id);

-- ============================================================================
-- 6. ORG FEATURE FLAGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  feature TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  disabled_reason TEXT,
  disabled_at TIMESTAMPTZ,
  disabled_by UUID,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  current_daily_usage INTEGER DEFAULT 0,
  current_monthly_usage INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT org_feature_flags_unique UNIQUE (organization_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_org_feature_flags_lookup ON org_feature_flags(organization_id, feature);

-- ============================================================================
-- 7. GLOBAL FEATURE FLAGS (already created from debug)
-- ============================================================================

-- Table already exists, just seed remaining flags
INSERT INTO global_feature_flags (feature, enabled) VALUES
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
-- 8. WEBRTC SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  call_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_user ON webrtc_sessions(user_id, status);

-- ============================================================================
-- 9. HELPER FUNCTION
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
-- VERIFY
-- ============================================================================

SELECT 
  'call_notes' AS table_name, COUNT(*) AS exists FROM information_schema.tables WHERE table_name = 'call_notes'
UNION ALL
SELECT 
  'webhook_subscriptions', COUNT(*) FROM information_schema.tables WHERE table_name = 'webhook_subscriptions'
UNION ALL
SELECT 
  'webhook_deliveries', COUNT(*) FROM information_schema.tables WHERE table_name = 'webhook_deliveries'
UNION ALL
SELECT 
  'org_feature_flags', COUNT(*) FROM information_schema.tables WHERE table_name = 'org_feature_flags'
UNION ALL
SELECT 
  'global_feature_flags', COUNT(*) FROM information_schema.tables WHERE table_name = 'global_feature_flags'
UNION ALL
SELECT 
  'webrtc_sessions', COUNT(*) FROM information_schema.tables WHERE table_name = 'webrtc_sessions';
