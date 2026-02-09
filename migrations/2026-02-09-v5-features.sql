-- v5.0 Feature Migration — Word Is Bond
-- Adds tables for: Sentiment Analysis, Dialer Agent Pool, Translation Quality
-- Existing tables leveraged: voice_configs (AI columns), calls, collection_accounts/payments
--
-- Design decisions:
--   - All tables include organization_id for multi-tenant isolation
--   - gen_random_uuid() per platform standard
--   - No RLS — tenant isolation via parameterized WHERE clauses
--   - Idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING)

-- ─── Sentiment Scoring ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_sentiment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  transcript_text TEXT,
  score NUMERIC(4,3) NOT NULL CHECK (score >= -1.0 AND score <= 1.0),
  objections JSONB DEFAULT '[]',
  escalation_recommended BOOLEAN DEFAULT FALSE,
  model_used TEXT DEFAULT 'gpt-4o-mini',
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_call_id
  ON call_sentiment_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_org_score
  ON call_sentiment_scores(organization_id, score);
CREATE INDEX IF NOT EXISTS idx_sentiment_escalation
  ON call_sentiment_scores(organization_id, escalation_recommended)
  WHERE escalation_recommended = TRUE;

-- ─── Sentiment Summary (aggregate per call) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS call_sentiment_summary (
  call_id UUID PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  avg_score NUMERIC(4,3),
  min_score NUMERIC(4,3),
  max_score NUMERIC(4,3),
  total_segments INTEGER DEFAULT 0,
  objection_count INTEGER DEFAULT 0,
  escalation_triggered BOOLEAN DEFAULT FALSE,
  escalation_triggered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_summary_org
  ON call_sentiment_summary(organization_id, avg_score);

-- ─── Sentiment Alert Configuration ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sentiment_alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  alert_threshold NUMERIC(4,3) DEFAULT -0.5,
  objection_keywords JSONB DEFAULT '["cancel","lawsuit","attorney","complaint","supervisor","manager","refuse","dispute","unfair","illegal"]',
  alert_channels JSONB DEFAULT '["dashboard"]',
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Dialer Agent Status Pool ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dialer_agent_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL, -- REFERENCES users(id) removed due to type mismatch
  campaign_id UUID REFERENCES campaigns(id),
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('offline', 'available', 'on_call', 'wrap_up', 'break')),
  current_call_id UUID REFERENCES calls(id),
  last_call_ended_at TIMESTAMPTZ,
  wrap_up_seconds INTEGER DEFAULT 30,
  calls_handled INTEGER DEFAULT 0,
  shift_started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialer_agent_org_status
  ON dialer_agent_status(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_dialer_agent_campaign
  ON dialer_agent_status(campaign_id) WHERE campaign_id IS NOT NULL;

-- Unique constraint: one agent status per user per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_dialer_agent_unique
  ON dialer_agent_status(organization_id, user_id);

-- ─── Translation Quality Extension ───────────────────────────────────────────

ALTER TABLE call_translations ADD COLUMN IF NOT EXISTS quality_score NUMERIC(3,2);
ALTER TABLE call_translations ADD COLUMN IF NOT EXISTS detected_language TEXT;
