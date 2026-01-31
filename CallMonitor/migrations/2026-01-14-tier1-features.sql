-- ============================================================================
-- TIER 1 FEATURES MIGRATION
-- Call Disposition, Structured Notes, Consent Tracking, Webhooks, Kill Switches
-- Per MASTER_ARCHITECTURE: Call is root object, all features are modulations
-- ============================================================================

-- ============================================================================
-- 1. CALL DISPOSITION (Agent Outcome Tagging)
-- Purpose: Required post-call outcome for pipeline reconciliation
-- ============================================================================

-- Add disposition columns to calls table
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS disposition TEXT CHECK (disposition IN (
  'sale',
  'no_answer', 
  'voicemail',
  'not_interested',
  'follow_up',
  'wrong_number',
  'callback_scheduled',
  'other'
));

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS disposition_set_at TIMESTAMPTZ;

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS disposition_set_by UUID REFERENCES users(id);

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS disposition_notes TEXT;

-- Index for disposition analytics
CREATE INDEX IF NOT EXISTS idx_calls_disposition ON calls(disposition) WHERE disposition IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_disposition_set_at ON calls(disposition_set_at) WHERE disposition_set_at IS NOT NULL;

-- ============================================================================
-- 2. STRUCTURED CALL NOTES (Not Freeform - Checkboxes + Short Text)
-- Purpose: Replace CRM bloat, feed scorecards + audits
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Structured tags (checkboxes in UI)
  tags TEXT[] DEFAULT '{}' CHECK (
    tags <@ ARRAY[
      'objection_raised',
      'competitor_mentioned', 
      'pricing_discussed',
      'escalation_required',
      'decision_maker_reached',
      'follow_up_needed',
      'compliance_issue',
      'quality_concern',
      'positive_feedback',
      'technical_issue'
    ]::TEXT[]
  ),
  
  -- Short note (max 500 chars, enforced at API level)
  note TEXT,
  
  -- Audit trail
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate notes per call per user within short window
  CONSTRAINT call_notes_unique_recent UNIQUE (call_id, created_by, created_at)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_call_notes_call_id ON call_notes(call_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_org_id ON call_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_notes_tags ON call_notes USING GIN(tags);

-- ============================================================================
-- 3. CONSENT & DISCLOSURE TRACKING
-- Purpose: Turn "call tool" into "defensible evidence system"
-- Critical for healthcare, finance, recruiting verticals
-- ============================================================================

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS consent_method TEXT CHECK (consent_method IN (
  'ivr_played',      -- IVR played "This call may be recorded" message
  'verbal_yes',      -- Caller verbally confirmed consent
  'dtmf_confirm',    -- Caller pressed key to confirm (e.g., "Press 1 to continue")
  'written',         -- Prior written consent on file
  'assumed',         -- Assumed consent (one-party consent state)
  'none'            -- No consent obtained (call not recorded)
));

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS consent_audio_offset_ms INTEGER;

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS consent_verified_by UUID REFERENCES users(id);

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS consent_verified_at TIMESTAMPTZ;

-- Add consent info to recordings for evidence manifests
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS consent_captured BOOLEAN DEFAULT false;

ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS consent_method TEXT;

ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS consent_audio_offset_ms INTEGER;

-- ============================================================================
-- 4. WEBHOOK / EVENT SUBSCRIPTION API
-- Purpose: Enable BYO integrations, replace Zapier at scale
-- Events: call.*, recording.*, transcript.*, survey.*, scorecard.*
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Subscription details
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,  -- HMAC signing secret
  
  -- Events to subscribe to (array of event types)
  events TEXT[] NOT NULL CHECK (
    events <@ ARRAY[
      'call.started',
      'call.answered',
      'call.completed',
      'call.failed',
      'call.disposition_set',
      'recording.available',
      'recording.transcribed',
      'transcript.completed',
      'translation.completed',
      'survey.completed',
      'scorecard.completed',
      'evidence.exported'
    ]::TEXT[]
  ),
  
  -- Configuration
  active BOOLEAN DEFAULT true,
  retry_policy TEXT DEFAULT 'exponential' CHECK (retry_policy IN ('none', 'fixed', 'exponential')),
  max_retries INTEGER DEFAULT 5,
  timeout_ms INTEGER DEFAULT 30000,
  
  -- Headers to include (for API keys, auth, etc)
  headers JSONB DEFAULT '{}',
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique per org + URL + events
  CONSTRAINT webhook_subscriptions_unique_url UNIQUE (organization_id, url)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL,  -- ID of the source entity (call_id, recording_id, etc)
  payload JSONB NOT NULL,
  
  -- Delivery status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'delivered',
    'failed',
    'retrying'
  )),
  
  -- Retry tracking
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  
  -- Response details
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  
  -- Error tracking
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  
  -- Index for efficient processing
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
-- 5. KILL SWITCHES & FEATURE FLAGS
-- Purpose: Per-org feature disable, emergency stop, AI fallbacks
-- Buyers trust systems that can say "no" safely
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Feature identifier
  feature TEXT NOT NULL CHECK (feature IN (
    'voice_operations',
    'recording',
    'transcription',
    'translation',
    'live_translation',
    'survey',
    'synthetic_caller',
    'secret_shopper',
    'ai_features',
    'webhooks',
    'api_access',
    'bulk_upload',
    'evidence_export'
  )),
  
  -- Control
  enabled BOOLEAN DEFAULT true,
  
  -- Kill switch metadata
  disabled_reason TEXT,
  disabled_at TIMESTAMPTZ,
  disabled_by UUID REFERENCES users(id),
  
  -- Limits (for rate limiting / cost control)
  daily_limit INTEGER,
  monthly_limit INTEGER,
  current_daily_usage INTEGER DEFAULT 0,
  current_monthly_usage INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT org_feature_flags_unique UNIQUE (organization_id, feature)
);

-- Emergency global kill switch (platform-level)
CREATE TABLE IF NOT EXISTS global_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  disabled_reason TEXT,
  disabled_at TIMESTAMPTZ,
  disabled_by TEXT,  -- System identifier, not user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick feature checks
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_lookup 
  ON org_feature_flags(organization_id, feature);

-- ============================================================================
-- 6. WEBRTC SESSIONS (Browser-based calling)
-- Purpose: Enable calling directly from browser without phone
-- ============================================================================

CREATE TABLE IF NOT EXISTS webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  call_id UUID REFERENCES calls(id),
  
  -- Session details
  session_token TEXT NOT NULL UNIQUE,
  signalwire_resource_id TEXT,  -- SignalWire WebRTC resource
  
  -- Connection state
  status TEXT DEFAULT 'initializing' CHECK (status IN (
    'initializing',
    'connecting',
    'connected',
    'on_call',
    'disconnected',
    'failed'
  )),
  
  -- ICE/SDP info (for debugging)
  ice_servers JSONB,
  local_sdp TEXT,
  remote_sdp TEXT,
  
  -- Quality metrics
  audio_bitrate INTEGER,
  packet_loss_percent NUMERIC(5,2),
  jitter_ms INTEGER,
  round_trip_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  
  -- User agent for debugging
  user_agent TEXT,
  ip_address TEXT
);

-- Index for active sessions
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_active 
  ON webrtc_sessions(organization_id, user_id, status) 
  WHERE status IN ('initializing', 'connecting', 'connected', 'on_call');

-- ============================================================================
-- 7. RLS POLICIES for new tables
-- Per MASTER_ARCHITECTURE: All enforcement happens before write
-- ============================================================================

-- call_notes RLS
ALTER TABLE call_notes ENABLE ROW LEVEL SECURITY;

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

-- webhook_subscriptions RLS
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhooks"
  ON webhook_subscriptions FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM org_members 
    WHERE auth.user_equals_auth(user_id::text) AND role IN ('owner', 'admin')
  ));

-- webhook_deliveries RLS (read-only for org members)
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (subscription_id IN (
    SELECT id FROM webhook_subscriptions WHERE organization_id IN (
      SELECT organization_id FROM org_members WHERE auth.user_equals_auth(user_id::text)
    )
  ));

-- org_feature_flags RLS
ALTER TABLE org_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage feature flags"
  ON org_feature_flags FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM org_members 
    WHERE auth.user_equals_auth(user_id::text) AND role IN ('owner', 'admin')
  ));

-- webrtc_sessions RLS
ALTER TABLE webrtc_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own WebRTC sessions"
  ON webrtc_sessions FOR ALL
  USING (auth.user_equals_auth(user_id::text));

-- ============================================================================
-- 8. HELPER FUNCTIONS
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
  -- Check global kill switch first
  SELECT enabled INTO v_global_enabled
  FROM global_feature_flags
  WHERE feature = p_feature;
  
  IF v_global_enabled = false THEN
    RETURN false;
  END IF;
  
  -- Check org-level flag
  SELECT enabled INTO v_org_enabled
  FROM org_feature_flags
  WHERE organization_id = p_organization_id AND feature = p_feature;
  
  -- Default to true if no flag exists
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
    RETURN true;  -- No limits set
  END IF;
  
  IF NOT v_flag.enabled THEN
    RETURN false;
  END IF;
  
  -- Check daily limit
  IF v_flag.daily_limit IS NOT NULL AND v_flag.current_daily_usage >= v_flag.daily_limit THEN
    RETURN false;
  END IF;
  
  -- Check monthly limit
  IF v_flag.monthly_limit IS NOT NULL AND v_flag.current_monthly_usage >= v_flag.monthly_limit THEN
    RETURN false;
  END IF;
  
  -- Increment usage
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
-- 9. SEED GLOBAL FEATURE FLAGS (default all enabled)
-- ============================================================================

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
-- MIGRATION COMPLETE
-- Per MASTER_ARCHITECTURE: This migration adds primitives, not features
-- All execution still derives from voice_configs via COE
-- ============================================================================

