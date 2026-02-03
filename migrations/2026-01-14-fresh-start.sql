-- ============================================================================
-- FRESH START - Drop and recreate tables
-- Run this if previous migrations left partial state
-- ============================================================================

-- Drop tables if they exist (in correct order due to dependencies)
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhook_subscriptions CASCADE;
DROP TABLE IF EXISTS call_notes CASCADE;
DROP TABLE IF EXISTS org_feature_flags CASCADE;
DROP TABLE IF EXISTS webrtc_sessions CASCADE;
-- Keep global_feature_flags since it has data

-- ============================================================================
-- CREATE TABLES ONE BY ONE
-- ============================================================================

-- 1. call_notes
CREATE TABLE call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. webhook_subscriptions  
CREATE TABLE webhook_subscriptions (
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

-- 3. webhook_deliveries
CREATE TABLE webhook_deliveries (
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

-- 4. org_feature_flags
CREATE TABLE org_feature_flags (
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. webrtc_sessions
CREATE TABLE webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  call_id UUID,
  session_token TEXT NOT NULL UNIQUE,
  signalwire_resource_id TEXT,
  status TEXT DEFAULT 'initializing',
  ice_servers JSONB,
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

-- ============================================================================
-- ADD INDEXES
-- ============================================================================

CREATE INDEX idx_call_notes_call ON call_notes(call_id);
CREATE INDEX idx_webhook_subs_org ON webhook_subscriptions(organization_id);
CREATE INDEX idx_webhook_del_status ON webhook_deliveries(status);
CREATE INDEX idx_org_flags_lookup ON org_feature_flags(organization_id, feature);
CREATE INDEX idx_webrtc_user ON webrtc_sessions(user_id);

-- ============================================================================
-- VERIFY
-- ============================================================================

SELECT 'Tables created successfully' AS status;

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('call_notes', 'webhook_subscriptions', 'webhook_deliveries', 'org_feature_flags', 'webrtc_sessions')
ORDER BY table_name;
