-- ============================================================================
-- Migration: Create scorecard_alerts table
-- Date: 2026-02-13
-- Issue: ENGINEERING_GUIDE.md Appendix A, Issue #11
--        Table queried by scorecards.ts but has no version-controlled migration
-- Idempotent: All statements use IF NOT EXISTS
-- ============================================================================

-- Source: workers/src/routes/scorecards.ts lines 121-130
--   SELECT: id, organization_id, scorecard_id, call_id, trigger_type,
--           severity, message, acknowledged, acknowledged_by, created_at
--   WHERE:  organization_id=$1
--   ORDER:  created_at DESC
-- Source: docs/SCHEMA_ERD.md lines 297-301

CREATE TABLE IF NOT EXISTS scorecard_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scorecard_id    UUID REFERENCES scorecards(id) ON DELETE CASCADE,
    call_id         UUID REFERENCES calls(id) ON DELETE SET NULL,
    trigger_type    TEXT NOT NULL,                            -- e.g., 'low_score', 'compliance_violation'
    severity        TEXT NOT NULL DEFAULT 'info',             -- info, warning, critical
    message         TEXT,                                     -- Human-readable alert message
    acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,          -- Has alert been acknowledged
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Who acknowledged
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policy for multi-tenant isolation
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'scorecard_alerts' AND policyname = 'org_isolation_scorecard_alerts'
    ) THEN
        ALTER TABLE scorecard_alerts ENABLE ROW LEVEL SECURITY;
        CREATE POLICY org_isolation_scorecard_alerts ON scorecard_alerts
            USING (organization_id = current_setting('app.current_org_id', true)::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scorecard_alerts_org_created
    ON scorecard_alerts (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scorecard_alerts_scorecard
    ON scorecard_alerts (scorecard_id);

-- ============================================================================
-- VERIFICATION:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name = 'scorecard_alerts';
-- ============================================================================
