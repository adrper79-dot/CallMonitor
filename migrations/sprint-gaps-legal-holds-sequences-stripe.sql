-- Migration: Sprint gaps — legal_holds account_id, campaign_sequences,
-- sequence_enrollments, payment_links, tasks tables + Stripe columns
-- Run against Neon PostgreSQL 17
-- Date: 2026-02-16

-- ──────────────────────────────────────────────────────────
-- 1. Extend legal_holds to support per-account holds
--    Existing table tracks litigation holds on calls/evidence.
--    Adding optional account_id so compliance checker can gate outbound contact.
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.legal_holds
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES collection_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_legal_holds_account_active
  ON legal_holds (account_id, status) WHERE status = 'active';

-- ──────────────────────────────────────────────────────────
-- 2. Campaign sequences table (for sequence CRUD + execution engine)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sequences_org
  ON campaign_sequences (organization_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_active
  ON campaign_sequences (status) WHERE status = 'active';

-- ──────────────────────────────────────────────────────────
-- 3. Sequence enrollments (tracks per-account progress)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES campaign_sequences(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  current_step integer NOT NULL DEFAULT 0,
  last_step_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (sequence_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_active
  ON sequence_enrollments (sequence_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_account
  ON sequence_enrollments (account_id);

-- ──────────────────────────────────────────────────────────
-- 4. Payment links table (for payment link CRUD + Stripe Checkout)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  description text,
  currency text NOT NULL DEFAULT 'usd',
  link_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  stripe_session_id text,
  stripe_checkout_url text,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_org
  ON payment_links (organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_token
  ON payment_links (link_token);

-- ──────────────────────────────────────────────────────────
-- 5. Tasks table (for agent work queues + sequence call steps)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type text NOT NULL DEFAULT 'call' CHECK (type IN ('call', 'follow_up', 'review', 'other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid REFERENCES users(id),
  due_date timestamptz,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_org_status
  ON tasks (organization_id, status) WHERE status IN ('open', 'in_progress');

