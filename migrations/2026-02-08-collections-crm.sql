-- Collections CRM Schema — Word Is Bond v4.29
-- Adds collection accounts, payments, tasks, and CSV import tracking.
--
-- Design decisions:
--   - All tables include organization_id for multi-tenant isolation
--   - gen_random_uuid() (not uuid_generate_v4) per platform standard
--   - created_by tracks the user who created each record
--   - accounts.primary_phone stored as E.164 text
--   - payments.amount is NUMERIC(12,2) for precise currency
--   - csv_imports.errors is JSONB (not JSONB[]) for simpler querying
--   - No RLS — tenant isolation enforced via parameterized WHERE clauses
--
-- @see ARCH_DOCS/02-FEATURES/COLLECTIONS_CRM.md

-- ─── Collection Accounts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collection_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  external_id   TEXT,                             -- e.g. Dentrix patient ID
  source        TEXT DEFAULT 'manual',            -- manual | csv_import | api
  name          TEXT NOT NULL,
  balance_due   NUMERIC(12,2) NOT NULL DEFAULT 0,
  primary_phone TEXT NOT NULL,                    -- E.164 format
  secondary_phone TEXT,                           -- optional alternate
  email         TEXT,
  address       TEXT,
  custom_fields JSONB DEFAULT '{}',               -- flexible metadata
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paid', 'partial', 'disputed', 'archived')),
  notes         TEXT,
  last_contacted_at TIMESTAMPTZ,
  promise_date  DATE,                             -- next payment promise
  promise_amount NUMERIC(12,2),
  created_by    TEXT NOT NULL,                    -- user_id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ,
  deleted_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_collection_accounts_org
  ON collection_accounts(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_collection_accounts_org_balance
  ON collection_accounts(organization_id, balance_due DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_collection_accounts_org_status
  ON collection_accounts(organization_id, status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_collection_accounts_external
  ON collection_accounts(organization_id, external_id) WHERE external_id IS NOT NULL;

-- ─── Collection Payments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collection_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id      UUID NOT NULL REFERENCES collection_accounts(id),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method          TEXT NOT NULL DEFAULT 'other'
    CHECK (method IN ('stripe', 'cash', 'check', 'transfer', 'other')),
  stripe_payment_id TEXT,                         -- Stripe payment intent ID
  reference_number  TEXT,                         -- check #, transfer ref, etc.
  notes           TEXT,
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_payments_account
  ON collection_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_collection_payments_org
  ON collection_payments(organization_id, created_at DESC);

-- ─── Collection Tasks ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collection_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id      UUID NOT NULL REFERENCES collection_accounts(id),
  type            TEXT NOT NULL DEFAULT 'followup'
    CHECK (type IN ('followup', 'promise', 'payment', 'review', 'escalation')),
  title           TEXT NOT NULL,
  notes           TEXT,
  due_date        TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to     TEXT,                           -- user_id
  completed_at    TIMESTAMPTZ,
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_tasks_account
  ON collection_tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_org_status
  ON collection_tasks(organization_id, status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_collection_tasks_due
  ON collection_tasks(organization_id, due_date)
  WHERE status = 'pending' AND due_date IS NOT NULL;

-- ─── CSV Imports ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collection_csv_imports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  file_name       TEXT NOT NULL,
  rows_total      INT NOT NULL DEFAULT 0,
  rows_imported   INT NOT NULL DEFAULT 0,
  rows_skipped    INT NOT NULL DEFAULT 0,
  column_mapping  JSONB DEFAULT '{}',             -- { csv_col: db_col } mapping used
  errors          JSONB DEFAULT '[]',             -- array of { row, field, message }
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_collection_csv_imports_org
  ON collection_csv_imports(organization_id, created_at DESC);
