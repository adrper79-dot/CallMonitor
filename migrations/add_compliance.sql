-- Add compliance features (idempotent)
-- ARCH_DOCS snake_case, RLS

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_scores') THEN
    CREATE TABLE compliance_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
      compliance_risk_score NUMERIC(3,2) NOT NULL DEFAULT 0.0,
      violation_flags JSONB,
      recommendations JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE compliance_scores ENABLE ROW LEVEL SECURITY;
    CREATE POLICY compliance_scores_org ON compliance_scores USING (organization_id = current_setting('app.current_organization_id')::uuid);
    CREATE POLICY compliance_scores_insert ON compliance_scores FOR INSERT WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dnc_lists') THEN
    CREATE TABLE dnc_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      phone_number TEXT NOT NULL UNIQUE,
      reason TEXT,
      added_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE dnc_lists ENABLE ROW LEVEL SECURITY;
    CREATE POLICY dnc_lists_org ON dnc_lists USING (organization_id = current_setting('app.current_organization_id')::uuid);
  END IF;
END $$;