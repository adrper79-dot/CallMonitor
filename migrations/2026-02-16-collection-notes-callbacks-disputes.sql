-- Migration: Create collection_notes, collection_callbacks, and collection_disputes tables
-- Date: 2026-02-16
-- Purpose: Support notes, scheduled callbacks, and disputes from the Cockpit UI
-- These features were wired in the frontend but had no backing tables or routes.
-- NOTE: created_by is TEXT (not UUID FK) matching the existing collection_accounts pattern.

-- ─── Collection Notes ────────────────────────────────────────────────────────
-- Separate from call_notes — these are account-level notes added via the Cockpit

CREATE TABLE IF NOT EXISTS collection_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  call_id UUID,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_notes_account
  ON collection_notes (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_notes_org
  ON collection_notes (organization_id);

-- RLS
ALTER TABLE collection_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_notes_org_isolation ON collection_notes;
CREATE POLICY collection_notes_org_isolation ON collection_notes
  USING (organization_id::text = current_setting('app.current_org_id', true));


-- ─── Collection Callbacks ────────────────────────────────────────────────────
-- Scheduled callback reminders for collection accounts

CREATE TABLE IF NOT EXISTS collection_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'missed')),
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_callbacks_account
  ON collection_callbacks (account_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_collection_callbacks_org_pending
  ON collection_callbacks (organization_id, status, scheduled_for)
  WHERE status = 'pending';

-- RLS
ALTER TABLE collection_callbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_callbacks_org_isolation ON collection_callbacks;
CREATE POLICY collection_callbacks_org_isolation ON collection_callbacks
  USING (organization_id::text = current_setting('app.current_org_id', true));


-- ─── Collection Disputes ────────────────────────────────────────────────────
-- Track disputes filed against collection accounts

CREATE TABLE IF NOT EXISTS collection_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  call_id UUID,
  type TEXT NOT NULL CHECK (type IN ('billing', 'identity', 'amount', 'other')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'rejected')),
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_disputes_account
  ON collection_disputes (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_disputes_org_status
  ON collection_disputes (organization_id, status);

-- RLS
ALTER TABLE collection_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_disputes_org_isolation ON collection_disputes;
CREATE POLICY collection_disputes_org_isolation ON collection_disputes
  USING (organization_id::text = current_setting('app.current_org_id', true));
