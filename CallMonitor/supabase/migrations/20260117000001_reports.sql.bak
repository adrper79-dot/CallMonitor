-- Report Builder Database Schema
-- Creates tables for custom report generation and scheduling
-- Migration: 20260117000001_reports.sql

-- Report templates table
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Report configuration
  report_type TEXT NOT NULL CHECK (report_type IN ('call_volume', 'quality_scorecard', 'campaign_performance', 'custom')),
  data_source TEXT NOT NULL CHECK (data_source IN ('calls', 'campaigns', 'scorecards', 'surveys', 'multi')),
  
  -- Filters and parameters
  filters JSONB NOT NULL DEFAULT '{}'::jsonb, -- {date_range, statuses, users, tags, etc}
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of metric names to include
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Group by dimensions
  
  -- Visualization config
  visualization_config JSONB DEFAULT '{}'::jsonb, -- Chart types, colors, layout
  
  -- Access control
  is_public BOOLEAN NOT NULL DEFAULT false, -- Accessible to all org members
  created_by UUID NOT NULL REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated reports table - instances of report execution
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Report metadata
  name TEXT NOT NULL,
  file_path TEXT, -- S3/storage path for exported report
  file_format TEXT CHECK (file_format IN ('pdf', 'csv', 'xlsx', 'json')),
  file_size_bytes INTEGER,
  
  -- Report data (for JSON reports, stored inline)
  report_data JSONB, -- Actual report results
  
  -- Generation metadata
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb, -- Parameters used for generation
  generated_by UUID NOT NULL REFERENCES users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  error_message TEXT,
  generation_duration_ms INTEGER,
  
  -- Expiration
  expires_at TIMESTAMPTZ, -- Auto-delete after this date
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Schedule configuration
  name TEXT NOT NULL,
  schedule_pattern TEXT NOT NULL, -- cron-like: 'daily', 'weekly', 'monthly'
  schedule_time TIME NOT NULL DEFAULT '09:00:00', -- Time of day to run
  schedule_days INTEGER[], -- Days of week (0-6) or month (1-31)
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Delivery configuration
  delivery_method TEXT NOT NULL DEFAULT 'email' CHECK (delivery_method IN ('email', 'webhook', 'storage')),
  delivery_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- {emails: [], webhook_url: '', etc}
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report access log (who viewed which reports)
CREATE TABLE IF NOT EXISTS report_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('viewed', 'downloaded', 'shared')),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_templates_organization ON report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_template ON generated_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_organization ON generated_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(status);
CREATE INDEX IF NOT EXISTS idx_generated_reports_expires_at ON generated_reports(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_organization ON scheduled_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_access_log_report ON report_access_log(report_id);

-- Updated_at triggers
CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_access_log ENABLE ROW LEVEL SECURITY;

-- Users can access reports in their organization
CREATE POLICY report_templates_org_access ON report_templates
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY generated_reports_org_access ON generated_reports
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY scheduled_reports_org_access ON scheduled_reports
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY report_access_log_user_access ON report_access_log
  FOR ALL
  USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE report_templates IS 'Reusable report templates with filters and metrics configuration';
COMMENT ON TABLE generated_reports IS 'Generated report instances with exported files';
COMMENT ON TABLE scheduled_reports IS 'Scheduled report execution configuration';
COMMENT ON TABLE report_access_log IS 'Audit trail for report access';
COMMENT ON COLUMN report_templates.filters IS 'JSON filters: {date_range: {start, end}, statuses: [], users: [], etc}';
COMMENT ON COLUMN report_templates.metrics IS 'Array of metric names to calculate';
COMMENT ON COLUMN report_templates.dimensions IS 'Array of dimension names to group by';
COMMENT ON COLUMN generated_reports.report_data IS 'Inline JSON data for small reports, null for exported files';
COMMENT ON COLUMN scheduled_reports.schedule_pattern IS 'Frequency: daily, weekly, monthly';
COMMENT ON COLUMN scheduled_reports.delivery_config IS 'Delivery settings: {emails: [], webhook_url: "", s3_bucket: ""}';
