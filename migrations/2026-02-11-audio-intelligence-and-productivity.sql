-- ============================================================
-- Migration: Audio Intelligence + Productivity Features
-- Date: 2026-02-11
-- Version: v5.2
--
-- P0: AssemblyAI entity_detection + content_safety columns
-- P2: Likelihood-to-pay scoring on collection_accounts
-- P3: Objection rebuttals library
-- P3: Note templates
-- ============================================================

BEGIN;

-- ─── P0: Audio Intelligence Columns on calls ────────────────────────────────
-- Store entity detection results (amounts, dates, names, locations)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS detected_entities JSONB;

-- Store content safety labels (profanity, threats, hate speech)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS content_safety_labels JSONB;

COMMENT ON COLUMN calls.detected_entities IS 'AssemblyAI entity detection: amounts, dates, names, orgs';
COMMENT ON COLUMN calls.content_safety_labels IS 'AssemblyAI content safety: profanity, threats, sensitive topics';

-- ─── P2: Likelihood to Pay Scoring ──────────────────────────────────────────
ALTER TABLE collection_accounts ADD COLUMN IF NOT EXISTS likelihood_score NUMERIC(5,2);
ALTER TABLE collection_accounts ADD COLUMN IF NOT EXISTS likelihood_factors JSONB;
ALTER TABLE collection_accounts ADD COLUMN IF NOT EXISTS likelihood_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN collection_accounts.likelihood_score IS 'AI-computed likelihood to pay (0-100)';
COMMENT ON COLUMN collection_accounts.likelihood_factors IS 'Factors used in score computation';
COMMENT ON COLUMN collection_accounts.likelihood_updated_at IS 'When likelihood was last recalculated';

-- Index for sorting by likelihood
CREATE INDEX IF NOT EXISTS idx_collection_accounts_likelihood
  ON collection_accounts (organization_id, likelihood_score DESC NULLS LAST)
  WHERE is_deleted = false;

-- ─── P3: Objection Rebuttals Library ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS objection_rebuttals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('financial','legal','emotional','stalling','general')),
  objection_text  TEXT NOT NULL,
  rebuttal_text   TEXT NOT NULL,
  compliance_note TEXT,
  is_active       BOOLEAN DEFAULT true,
  usage_count     INTEGER DEFAULT 0,
  effectiveness   NUMERIC(5,2),
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE objection_rebuttals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'objection_rebuttals_org_isolation'
  ) THEN
    CREATE POLICY objection_rebuttals_org_isolation ON objection_rebuttals
      USING (organization_id = current_setting('app.organization_id', true)::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_objection_rebuttals_org_category
  ON objection_rebuttals (organization_id, category)
  WHERE is_active = true;

-- updated_at trigger
CREATE OR REPLACE TRIGGER trg_objection_rebuttals_updated_at
  BEFORE UPDATE ON objection_rebuttals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── P3: Note Templates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS note_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shortcode       TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  tags            JSONB DEFAULT '[]'::jsonb,
  is_active       BOOLEAN DEFAULT true,
  usage_count     INTEGER DEFAULT 0,
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE note_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'note_templates_org_isolation'
  ) THEN
    CREATE POLICY note_templates_org_isolation ON note_templates
      USING (organization_id = current_setting('app.organization_id', true)::uuid);
  END IF;
END $$;

-- Shortcodes must be unique within an org
CREATE UNIQUE INDEX IF NOT EXISTS idx_note_templates_org_shortcode
  ON note_templates (organization_id, shortcode)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_note_templates_org
  ON note_templates (organization_id)
  WHERE is_active = true;

-- updated_at trigger
CREATE OR REPLACE TRIGGER trg_note_templates_updated_at
  BEFORE UPDATE ON note_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Seed default objection rebuttals (system-level) ────────────────────────
-- These are inserted with a NULL org so they serve as system defaults.
-- In practice, the API will return org-specific + system defaults.
-- We skip seeding here since org_id is NOT NULL; the API will provide
-- defaults when an org has no custom rebuttals yet.

COMMIT;

-- ============================================================
-- END MIGRATION
-- ============================================================
