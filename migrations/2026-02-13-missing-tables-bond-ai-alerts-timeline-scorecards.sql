-- ============================================================================
-- Migration: Create 4 missing tables
-- Date: 2026-02-13
-- Tables: bond_ai_alerts, bond_ai_alert_rules, call_timeline_events, scorecard_templates
-- Issue: ENGINEERING_GUIDE.md Issue #11 — tables exist in production but have no migration
-- Idempotent: All statements use IF NOT EXISTS
-- ============================================================================

-- ─── 1. bond_ai_alerts ──────────────────────────────────────────────────────
-- Source: workers/src/routes/bond-ai.ts lines 380-486
--   SELECT: id, alert_type, severity, title, message, context_data, status, created_at, rule_id, organization_id
--   UPDATE: status, acknowledged_by, acknowledged_at
--   COUNT:  status='unread', severity='critical'
-- Source: docs/SCHEMA_ERD.md lines 266-271
-- Source: tests/production/database-live.test.ts line 199 — required: id, organization_id, severity, status

CREATE TABLE IF NOT EXISTS bond_ai_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id         UUID,                                   -- FK to bond_ai_alert_rules (added after that table)
    alert_type      TEXT NOT NULL,                           -- SELECT a.alert_type (line 380)
    severity        TEXT NOT NULL DEFAULT 'info',            -- SELECT a.severity, WHERE severity=$N, COUNT severity='critical'
    title           TEXT NOT NULL,                           -- SELECT a.title (line 380)
    message         TEXT,                                    -- SELECT a.message (line 380)
    context_data    JSONB,                                   -- SELECT a.context_data (line 380)
    status          TEXT NOT NULL DEFAULT 'unread',          -- SELECT/UPDATE/WHERE status, default 'unread'
    acknowledged_by UUID,                                    -- UPDATE SET acknowledged_by=$2 (user_id)
    acknowledged_at TIMESTAMPTZ,                             -- UPDATE SET acknowledged_at=NOW()
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()       -- SELECT a.created_at, ORDER BY created_at DESC
);

-- RLS policy for multi-tenant isolation (referenced in SECURITY_HARDENING.md)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'bond_ai_alerts' AND policyname = 'org_isolation_bond_ai_alerts'
    ) THEN
        ALTER TABLE bond_ai_alerts ENABLE ROW LEVEL SECURITY;
        CREATE POLICY org_isolation_bond_ai_alerts ON bond_ai_alerts
            USING (organization_id = current_setting('app.current_org_id', true)::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bond_ai_alerts_org_status
    ON bond_ai_alerts (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_bond_ai_alerts_org_created
    ON bond_ai_alerts (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bond_ai_alerts_severity
    ON bond_ai_alerts (organization_id, severity);


-- ─── 2. bond_ai_alert_rules ────────────────────────────────────────────────
-- Source: workers/src/routes/bond-ai.ts lines 495-660
--   SELECT: id, name, description, rule_type, rule_config, severity,
--           notification_channels, is_enabled, cooldown_minutes, last_triggered_at, created_at
--   INSERT: organization_id, name, description, rule_type, rule_config, severity,
--           notification_channels, cooldown_minutes, created_by
--   UPDATE: name, description, rule_config, severity, is_enabled, notification_channels,
--           cooldown_minutes, updated_at
--   DELETE: WHERE id=$1 AND organization_id=$2
--   JOIN:   LEFT JOIN bond_ai_alert_rules ar ON ar.id = a.rule_id (line 384)
-- Source: docs/SCHEMA_ERD.md lines 272-277
-- Source: tests/production/database-live.test.ts line 209 — required: id, organization_id, name, is_enabled

CREATE TABLE IF NOT EXISTS bond_ai_alert_rules (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                   TEXT NOT NULL,                          -- SELECT/INSERT/UPDATE name
    description            TEXT,                                   -- SELECT/INSERT/UPDATE description
    rule_type              TEXT NOT NULL,                          -- SELECT/INSERT rule_type
    rule_config            JSONB NOT NULL DEFAULT '{}',            -- SELECT/INSERT/UPDATE rule_config (JSON.stringify)
    severity               TEXT NOT NULL DEFAULT 'info',           -- SELECT/INSERT/UPDATE severity
    notification_channels  JSONB NOT NULL DEFAULT '["in_app"]',   -- SELECT/INSERT/UPDATE (JSON.stringify)
    is_enabled             BOOLEAN NOT NULL DEFAULT TRUE,          -- SELECT/UPDATE is_enabled
    cooldown_minutes       INTEGER NOT NULL DEFAULT 60,            -- SELECT/INSERT/UPDATE cooldown_minutes
    last_triggered_at      TIMESTAMPTZ,                            -- SELECT last_triggered_at
    created_by             UUID,                                   -- INSERT created_by (user_id)
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- SELECT created_at, ORDER BY created_at DESC
    updated_at             TIMESTAMPTZ                             -- UPDATE SET updated_at=NOW()
);

-- RLS policy
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'bond_ai_alert_rules' AND policyname = 'org_isolation_bond_ai_alert_rules'
    ) THEN
        ALTER TABLE bond_ai_alert_rules ENABLE ROW LEVEL SECURITY;
        CREATE POLICY org_isolation_bond_ai_alert_rules ON bond_ai_alert_rules
            USING (organization_id = current_setting('app.current_org_id', true)::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bond_ai_alert_rules_org
    ON bond_ai_alert_rules (organization_id);


-- ─── Add FK from bond_ai_alerts.rule_id → bond_ai_alert_rules.id ───────────
-- Referenced in: LEFT JOIN bond_ai_alert_rules ar ON ar.id = a.rule_id (line 384)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_bond_ai_alerts_rule_id'
          AND table_name = 'bond_ai_alerts'
    ) THEN
        ALTER TABLE bond_ai_alerts
            ADD CONSTRAINT fk_bond_ai_alerts_rule_id
            FOREIGN KEY (rule_id) REFERENCES bond_ai_alert_rules(id) ON DELETE SET NULL;
    END IF;
END $$;


-- ─── 3. call_timeline_events ────────────────────────────────────────────────
-- Source: workers/src/routes/calls.ts lines 1031-1039
--   SELECT: id, call_id, event_type, event_data, created_at
--   WHERE:  call_id=$1 AND organization_id=$2
--   ORDER:  created_at ASC
-- Source: docs/SCHEMA_ERD.md lines 93-98 — id PK, call_id FK, event_type, occurred_at
-- Source: ENGINEERING_GUIDE.md line 198 — call_id, event_type, timestamp, data
-- Note: ERD says "occurred_at", route code says "created_at" — use created_at (matches code)
--       ERD says no event_data, route code SELECTs event_data — include it

CREATE TABLE IF NOT EXISTS call_timeline_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    call_id         UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,                           -- SELECT event_type
    event_data      JSONB,                                   -- SELECT event_data
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()       -- SELECT/ORDER BY created_at ASC
);

-- RLS policy (referenced in SECURITY_HARDENING.md line 69)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'call_timeline_events' AND policyname = 'org_isolation_call_timeline_events'
    ) THEN
        ALTER TABLE call_timeline_events ENABLE ROW LEVEL SECURITY;
        CREATE POLICY org_isolation_call_timeline_events ON call_timeline_events
            USING (organization_id = current_setting('app.current_org_id', true)::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_timeline_events_call
    ON call_timeline_events (call_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_call_timeline_events_org
    ON call_timeline_events (organization_id);


-- ─── 4. scorecard_templates ────────────────────────────────────────────────
-- Source: workers/src/routes/bond-ai.ts lines 701-706
--   SELECT: name, sections
--   WHERE:  id=$1 AND organization_id=$2
-- Source: docs/SCHEMA_ERD.md lines 292-295 — id PK, organization_id FK, name
-- Source: workers/src/lib/plan-gating.ts line 48 — gated to 'business' plan
-- Source: workers/src/routes/scorecards.ts line 68 — scorecards table has template_id FK

CREATE TABLE IF NOT EXISTS scorecard_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,                           -- SELECT name
    sections        JSONB NOT NULL DEFAULT '[]',             -- SELECT sections (scoring criteria)
    created_by      UUID,                                    -- standard audit column
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- RLS policy
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'scorecard_templates' AND policyname = 'org_isolation_scorecard_templates'
    ) THEN
        ALTER TABLE scorecard_templates ENABLE ROW LEVEL SECURITY;
        CREATE POLICY org_isolation_scorecard_templates ON scorecard_templates
            USING (organization_id = current_setting('app.current_org_id', true)::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scorecard_templates_org
    ON scorecard_templates (organization_id);


-- ============================================================================
-- VERIFICATION QUERIES (run after migration to confirm):
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public'
--     AND table_name IN ('bond_ai_alerts','bond_ai_alert_rules','call_timeline_events','scorecard_templates');
-- ============================================================================
