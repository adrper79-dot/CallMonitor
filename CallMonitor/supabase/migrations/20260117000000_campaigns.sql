-- Campaign Manager Database Schema
-- Creates tables for campaign management with call scheduling
-- Migration: 20260117000000_campaigns.sql

-- Drop existing tables if they exist (for clean re-run)
DROP TABLE IF EXISTS campaign_audit_log CASCADE;
DROP TABLE IF EXISTS campaign_calls CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- Campaigns table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Campaign configuration
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'canceled')),
  call_flow_type TEXT NOT NULL CHECK (call_flow_type IN ('secret_shopper', 'survey', 'outbound', 'test')),
  
  -- Target configuration
  target_list JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {phone, metadata}
  caller_id_id UUID REFERENCES caller_id_numbers(id) ON DELETE SET NULL,
  
  -- Script configuration
  script_id UUID REFERENCES shopper_scripts(id) ON DELETE SET NULL,
  survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
  custom_prompt TEXT,
  
  -- Scheduling
  schedule_type TEXT NOT NULL DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled', 'recurring')),
  scheduled_at TIMESTAMPTZ,
  recurring_pattern JSONB, -- cron-like pattern: {frequency: 'daily' | 'weekly', time: 'HH:MM', days: [0-6]}
  
  -- Call configuration
  call_config JSONB DEFAULT '{}'::jsonb, -- {max_duration, timeout, retry_attempts}
  
  -- Progress tracking
  total_targets INTEGER NOT NULL DEFAULT 0,
  calls_completed INTEGER NOT NULL DEFAULT 0,
  calls_successful INTEGER NOT NULL DEFAULT 0,
  calls_failed INTEGER NOT NULL DEFAULT 0,
  
  -- Audit fields
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Campaign calls table - tracks individual calls within a campaign
CREATE TABLE campaign_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  
  -- Target information
  target_phone TEXT NOT NULL,
  target_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Execution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'canceled')),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  
  -- Result tracking
  outcome TEXT CHECK (outcome IN ('answered', 'no_answer', 'busy', 'failed', 'error')),
  duration_seconds INTEGER,
  error_message TEXT,
  
  -- Scoring (for secret shopper campaigns)
  score_data JSONB,
  
  -- Timestamps
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign audit log
CREATE TABLE campaign_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- created, updated, started, paused, resumed, completed, canceled
  changes JSONB, -- Before/after snapshot
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_organization ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_calls_campaign ON campaign_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_status ON campaign_calls(status);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_scheduled_for ON campaign_calls(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_audit_campaign ON campaign_audit_log(campaign_id);

-- Updated_at triggers
-- Create function (will replace if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
DROP TRIGGER IF EXISTS update_campaign_calls_updated_at ON campaign_calls;

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_calls_updated_at
  BEFORE UPDATE ON campaign_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only access campaigns in their organization
-- Drop existing policies if they exist
DROP POLICY IF EXISTS campaigns_org_access ON campaigns;
DROP POLICY IF EXISTS campaign_calls_org_access ON campaign_calls;
DROP POLICY IF EXISTS campaign_audit_org_access ON campaign_audit_log;

CREATE POLICY campaigns_org_access ON campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth.user_equals_auth(users.id::text) 
      AND users.organization_id = campaigns.organization_id
    )
  );

CREATE POLICY campaign_calls_org_access ON campaign_calls
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_calls.campaign_id
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE auth.user_equals_auth(users.id::text) 
        AND users.organization_id = campaigns.organization_id
      )
    )
  );

CREATE POLICY campaign_audit_org_access ON campaign_audit_log
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_audit_log.campaign_id
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE auth.user_equals_auth(users.id::text) 
        AND users.organization_id = campaigns.organization_id
      )
    )
  );

-- Comments for documentation
COMMENT ON TABLE campaigns IS 'Campaign management for bulk call operations (secret shopper, surveys, outbound)';
COMMENT ON TABLE campaign_calls IS 'Individual call tracking within campaigns';
COMMENT ON TABLE campaign_audit_log IS 'Audit trail for all campaign actions';
COMMENT ON COLUMN campaigns.target_list IS 'JSON array of call targets with phone numbers and metadata';
COMMENT ON COLUMN campaigns.recurring_pattern IS 'Recurring schedule pattern in cron-like format';
COMMENT ON COLUMN campaign_calls.score_data IS 'Quality scorecard results for secret shopper calls';

