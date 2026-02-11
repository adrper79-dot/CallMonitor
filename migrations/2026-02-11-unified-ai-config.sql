-- Unified AI Configuration & Cost Optimization Migration
-- Date: 2026-02-11
-- Purpose: Consolidate AI settings, add usage quotas, enable Groq/Grok providers

-- =====================================================
-- 1. Unified AI Configuration Table
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_org_configs (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Master toggles
  ai_features_enabled BOOLEAN DEFAULT false,

  -- Chat assistant (Bond AI)
  bond_ai_enabled BOOLEAN DEFAULT false,
  bond_ai_model TEXT DEFAULT 'gpt-4o-mini',
  bond_ai_temperature NUMERIC DEFAULT 0.7,

  -- Translation
  translation_enabled BOOLEAN DEFAULT false,
  translate_from TEXT,
  translate_to TEXT,
  live_translate BOOLEAN DEFAULT false,
  voice_to_voice BOOLEAN DEFAULT false,

  -- AI Provider preferences (NEW - Cost Optimization)
  ai_provider_llm TEXT DEFAULT 'groq', -- 'groq' | 'openai'
  ai_provider_tts TEXT DEFAULT 'grok', -- 'grok' | 'elevenlabs' | 'openai'

  -- Transcription
  transcription_provider TEXT DEFAULT 'assemblyai', -- 'assemblyai' | 'openai' | 'telnyx'
  auto_summarize BOOLEAN DEFAULT false,

  -- Sentiment
  sentiment_enabled BOOLEAN DEFAULT false,
  sentiment_alert_threshold NUMERIC DEFAULT -0.5,
  sentiment_objection_keywords JSONB DEFAULT '[]',

  -- AI Agent
  ai_agent_enabled BOOLEAN DEFAULT false,
  ai_agent_prompt TEXT,
  ai_agent_max_turns INTEGER DEFAULT 20,

  -- Quotas (NEW - Critical for cost control)
  monthly_ai_budget_usd NUMERIC DEFAULT 1000.00,
  monthly_usage_usd NUMERIC DEFAULT 0.00,
  quota_alert_sent BOOLEAN DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_org_configs_quota ON ai_org_configs(org_id, monthly_usage_usd);
CREATE INDEX IF NOT EXISTS idx_ai_org_configs_providers ON ai_org_configs(ai_provider_llm, ai_provider_tts);

-- =====================================================
-- 2. Migrate Existing Data
-- =====================================================

-- Migrate from voice_configs and ai_configs to unified table
INSERT INTO ai_org_configs (
  org_id,
  ai_features_enabled,
  bond_ai_enabled,
  translation_enabled,
  translate_from,
  translate_to,
  live_translate,
  voice_to_voice,
  sentiment_enabled,
  ai_agent_enabled,
  ai_agent_prompt,
  created_at,
  updated_at
)
SELECT DISTINCT
  COALESCE(vc.organization_id, ac.organization_id) as org_id,
  COALESCE(vc.ai_features_enabled, ac.enabled, false) as ai_features_enabled,
  COALESCE(ac.enabled, false) as bond_ai_enabled,
  COALESCE(vc.translate, false) as translation_enabled,
  vc.translate_from,
  vc.translate_to,
  COALESCE(vc.live_translate, false) as live_translate,
  COALESCE(vc.voice_to_voice, false) as voice_to_voice,
  COALESCE(ac.sentiment_analysis, false) as sentiment_enabled,
  COALESCE(vc.ai_features_enabled, false) as ai_agent_enabled,
  vc.ai_agent_prompt,
  COALESCE(vc.created_at, ac.created_at, now()) as created_at,
  now() as updated_at
FROM voice_configs vc
FULL OUTER JOIN ai_configs ac ON ac.organization_id = vc.organization_id
WHERE COALESCE(vc.organization_id, ac.organization_id) IS NOT NULL
ON CONFLICT (org_id) DO UPDATE SET
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- 3. AI Operation Logs (Usage Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),

  -- Operation details
  operation_type TEXT NOT NULL, -- 'chat' | 'translate' | 'summarize' | 'sentiment' | 'tts'
  provider TEXT NOT NULL,       -- 'openai' | 'groq' | 'grok' | 'assemblyai' | 'elevenlabs'
  model TEXT NOT NULL,

  -- Usage metrics
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd NUMERIC(10,6),

  -- Performance
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Content hash (for deduplication detection & caching)
  input_hash TEXT,
  output_hash TEXT,

  -- Security (PII redaction tracking)
  pii_redacted BOOLEAN DEFAULT false,
  pii_entities_count INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics & monitoring
CREATE INDEX IF NOT EXISTS idx_ai_logs_org_date ON ai_operation_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_cost ON ai_operation_logs(org_id, cost_usd DESC) WHERE cost_usd > 0;
CREATE INDEX IF NOT EXISTS idx_ai_logs_provider ON ai_operation_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_errors ON ai_operation_logs(success, created_at DESC) WHERE success = false;
CREATE INDEX IF NOT EXISTS idx_ai_logs_input_hash ON ai_operation_logs(input_hash) WHERE input_hash IS NOT NULL; -- For caching

-- =====================================================
-- 4. Functions for Quota Management
-- =====================================================

-- Function to increment AI usage for an organization
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_org_id UUID,
  p_cost_usd NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_new_usage NUMERIC;
  v_budget NUMERIC;
BEGIN
  -- Update usage and get new total
  UPDATE ai_org_configs
  SET monthly_usage_usd = monthly_usage_usd + p_cost_usd,
      updated_at = now()
  WHERE org_id = p_org_id
  RETURNING monthly_usage_usd, monthly_ai_budget_usd
  INTO v_new_usage, v_budget;

  -- Check if quota exceeded (for alerting)
  IF v_new_usage > v_budget THEN
    -- Mark for alert if not already sent
    UPDATE ai_org_configs
    SET quota_alert_sent = true
    WHERE org_id = p_org_id AND quota_alert_sent = false;

    RETURN false; -- Quota exceeded
  END IF;

  RETURN true; -- Within quota
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly usage (run via cron on 1st of month)
CREATE OR REPLACE FUNCTION reset_monthly_ai_usage()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Reset all organization quotas
  UPDATE ai_org_configs
  SET monthly_usage_usd = 0.00,
      quota_alert_sent = false,
      updated_at = now()
  WHERE EXTRACT(DAY FROM now()) = 1;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if org has exceeded quota
CREATE OR REPLACE FUNCTION check_ai_quota(
  p_org_id UUID,
  p_estimated_cost_usd NUMERIC DEFAULT 0.01
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage NUMERIC;
  v_budget NUMERIC;
BEGIN
  SELECT monthly_usage_usd, monthly_ai_budget_usd
  INTO v_current_usage, v_budget
  FROM ai_org_configs
  WHERE org_id = p_org_id;

  -- If no config found, return false (deny by default)
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if adding estimated cost would exceed budget
  RETURN (v_current_usage + p_estimated_cost_usd) <= v_budget;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Materialized View for Cost Analytics
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS ai_cost_summary AS
SELECT
  org_id,
  provider,
  operation_type,
  DATE(created_at) as date,
  COUNT(*) as operation_count,
  SUM(cost_usd) as total_cost_usd,
  AVG(latency_ms) as avg_latency_ms,
  SUM(total_tokens) as total_tokens,
  COUNT(*) FILTER (WHERE success = false) as error_count
FROM ai_operation_logs
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY org_id, provider, operation_type, DATE(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_cost_summary_org_date ON ai_cost_summary(org_id, date DESC);

-- =====================================================
-- 6. Row-Level Security (RLS)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE ai_org_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_operation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own organization's AI config
CREATE POLICY ai_org_configs_select_policy ON ai_org_configs
  FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM org_members WHERE user_id = current_user_id()
    )
  );

-- Policy: Users can only see their own organization's AI logs
CREATE POLICY ai_operation_logs_select_policy ON ai_operation_logs
  FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM org_members WHERE user_id = current_user_id()
    )
  );

-- =====================================================
-- 7. Triggers for Updated Timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_org_configs_updated_at
  BEFORE UPDATE ON ai_org_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. Comments for Documentation
-- =====================================================

COMMENT ON TABLE ai_org_configs IS 'Unified AI configuration per organization with cost quotas';
COMMENT ON TABLE ai_operation_logs IS 'All AI API calls for usage tracking and analytics';
COMMENT ON COLUMN ai_org_configs.ai_provider_llm IS 'Preferred LLM provider: groq (cheap) or openai (quality)';
COMMENT ON COLUMN ai_org_configs.ai_provider_tts IS 'Preferred TTS provider: grok (cheap), elevenlabs (quality), or openai';
COMMENT ON COLUMN ai_org_configs.monthly_ai_budget_usd IS 'Hard limit on AI spending per month';
COMMENT ON COLUMN ai_org_configs.monthly_usage_usd IS 'Current month AI spending (resets monthly)';
COMMENT ON FUNCTION increment_ai_usage IS 'Increment org AI usage and check quota';
COMMENT ON FUNCTION reset_monthly_ai_usage IS 'Reset all org AI quotas on 1st of month (run via cron)';

-- =====================================================
-- 9. Grant Permissions
-- =====================================================

-- Grant access to application role (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE ON ai_org_configs TO wordisbond_app_role;
-- GRANT SELECT, INSERT ON ai_operation_logs TO wordisbond_app_role;
-- GRANT EXECUTE ON FUNCTION increment_ai_usage TO wordisbond_app_role;
-- GRANT EXECUTE ON FUNCTION check_ai_quota TO wordisbond_app_role;

-- =====================================================
-- Migration Complete
-- =====================================================

-- Verify migration
DO $$
DECLARE
  v_config_count INTEGER;
  v_log_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_config_count FROM ai_org_configs;
  SELECT COUNT(*) INTO v_log_count FROM ai_operation_logs;

  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - ai_org_configs: % rows', v_config_count;
  RAISE NOTICE '  - ai_operation_logs: % rows', v_log_count;
  RAISE NOTICE '  - Functions created: increment_ai_usage, reset_monthly_ai_usage, check_ai_quota';
  RAISE NOTICE '  - RLS policies enabled';
END $$;
