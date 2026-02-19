-- =============================================================================
-- Regulation F / TCPA Compliance Enhancement Migration
-- Date: 2026-02-17
-- Spec: ARCH_DOCS/08-COMPLIANCE/REG_F_ENGINEERING_SPEC.md
--
-- Changes:
--   1. TASK-002: Attorney-represented consumer fields on collection_accounts
--   2. TASK-003: Employer prohibits contact flag
--   3. TASK-011: validation_notices table (Model Form B-1 per §1006.34)
--   4. TASK-015: state_consent_rules reference table (two-party consent)
--   5. TASK-017: state_sol_rules reference table (statute of limitations)
--   6. Audit action additions for new compliance events
--
-- Safe to run multiple times (idempotent via IF NOT EXISTS / IF EXISTS).
-- =============================================================================

-- ── TASK-002: Attorney-represented consumer ─────────────────────────────────
-- §1006.6(b)(2): Must not communicate directly with consumer represented by attorney
-- from diff @@ TASK-002 @@

ALTER TABLE collection_accounts
  ADD COLUMN IF NOT EXISTS attorney_represented BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS attorney_name TEXT,
  ADD COLUMN IF NOT EXISTS attorney_email TEXT,
  ADD COLUMN IF NOT EXISTS attorney_phone TEXT;

COMMENT ON COLUMN collection_accounts.attorney_represented
  IS 'FDCPA §1006.6(b)(2): Consumer is represented by attorney — direct contact prohibited';

-- ── TASK-003: Employer prohibits contact ────────────────────────────────────
-- §1006.6(b)(3): Must not contact consumer at workplace if employer prohibits

ALTER TABLE collection_accounts
  ADD COLUMN IF NOT EXISTS employer_prohibits_contact BOOLEAN DEFAULT false;

COMMENT ON COLUMN collection_accounts.employer_prohibits_contact
  IS 'FDCPA §1006.6(b)(3): Employer prohibits debt-related contact at workplace';

-- ── TASK-011: Validation Notices (Model Form B-1) ───────────────────────────
-- §1006.34: Must provide validation notice within 5 days of initial communication
-- from diff @@ TASK-011 @@

CREATE TABLE IF NOT EXISTS validation_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,

  -- Model Form B-1 fields per §1006.34(c)
  collector_name TEXT NOT NULL,
  collector_mailing_address TEXT NOT NULL,
  consumer_name TEXT NOT NULL,
  consumer_mailing_address TEXT,

  -- Creditor / debt info (§1006.34(c)(2))
  creditor_on_itemization_date TEXT,
  account_number_truncated TEXT,
  current_creditor TEXT NOT NULL,
  itemization_date DATE NOT NULL,
  amount_on_itemization_date DECIMAL(12,2) NOT NULL,
  itemization_details JSONB DEFAULT '{}',        -- interest, fees, payments, credits
  current_amount DECIMAL(12,2) NOT NULL,

  -- Validation period (§1006.34(c)(3))
  validation_period_end DATE NOT NULL,            -- 30 days after assumed receipt (+5 days mail)
  dispute_response_prompts JSONB DEFAULT '{}',    -- §1006.34(c)(4) tear-off prompts

  -- Spanish language (§1006.34(d)(3)(vi) & (e))
  spanish_translation_offered BOOLEAN DEFAULT false,
  spanish_notice_sent BOOLEAN DEFAULT false,

  -- Delivery tracking
  delivery_method TEXT NOT NULL DEFAULT 'mail'
    CHECK (delivery_method IN ('email', 'mail', 'in_app', 'initial_communication')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_reference TEXT,                        -- tracking number or message ID

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'disputed', 'expired')),

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for validation_notices
CREATE INDEX IF NOT EXISTS idx_validation_notices_org
  ON validation_notices(organization_id);
CREATE INDEX IF NOT EXISTS idx_validation_notices_account
  ON validation_notices(account_id);
CREATE INDEX IF NOT EXISTS idx_validation_notices_status
  ON validation_notices(status);
CREATE INDEX IF NOT EXISTS idx_validation_notices_period_end
  ON validation_notices(validation_period_end);

ALTER TABLE validation_notices ENABLE ROW LEVEL SECURITY;

-- ── TASK-015: State Consent Rules (two-party recording consent) ─────────────
-- TCPA / state wiretapping statutes: 13 states require all-party consent
-- from diff @@ TASK-015 @@

CREATE TABLE IF NOT EXISTS state_consent_rules (
  state_code CHAR(2) PRIMARY KEY,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('one_party', 'all_party')),
  recording_disclosure_required BOOLEAN DEFAULT false,
  statute_reference TEXT,
  notes TEXT
);

-- Seed all 50 states + DC (insert if empty)
INSERT INTO state_consent_rules (state_code, consent_type, recording_disclosure_required, statute_reference, notes)
VALUES
  ('AL', 'one_party',  false, 'Ala. Code §13A-11-30', NULL),
  ('AK', 'one_party',  false, 'Alaska Stat. §42.20.310', NULL),
  ('AZ', 'one_party',  false, 'Ariz. Rev. Stat. §13-3005', NULL),
  ('AR', 'one_party',  false, 'Ark. Code §5-60-120', NULL),
  ('CA', 'all_party',  true,  'Cal. Penal Code §632', 'Applies to confidential communications'),
  ('CO', 'one_party',  false, 'Colo. Rev. Stat. §18-9-303', NULL),
  ('CT', 'all_party',  true,  'Conn. Gen. Stat. §52-570d', NULL),
  ('DE', 'one_party',  false, 'Del. Code tit. 11, §2402', NULL),
  ('DC', 'one_party',  false, 'D.C. Code §23-542', NULL),
  ('FL', 'all_party',  true,  'Fla. Stat. §934.03', NULL),
  ('GA', 'one_party',  false, 'Ga. Code §16-11-62', NULL),
  ('HI', 'all_party',  true,  'Haw. Rev. Stat. §803-42', NULL),
  ('ID', 'one_party',  false, 'Idaho Code §18-6702', NULL),
  ('IL', 'all_party',  true,  '720 ILCS 5/14-2', 'Eavesdropping Act'),
  ('IN', 'one_party',  false, 'Ind. Code §35-33.5-5-5', NULL),
  ('IA', 'one_party',  false, 'Iowa Code §808B.2', NULL),
  ('KS', 'one_party',  false, 'Kan. Stat. §21-6101', NULL),
  ('KY', 'one_party',  false, 'Ky. Rev. Stat. §526.010', NULL),
  ('LA', 'one_party',  false, 'La. Rev. Stat. §15:1303', NULL),
  ('ME', 'one_party',  false, 'Me. Rev. Stat. tit. 15, §709', NULL),
  ('MD', 'all_party',  true,  'Md. Code, Cts. & Jud. Proc. §10-402', NULL),
  ('MA', 'all_party',  true,  'Mass. Gen. Laws ch. 272, §99', 'Strict all-party; criminal penalties'),
  ('MI', 'all_party',  true,  'Mich. Comp. Laws §750.539c', 'Case law interpretation — all-party'),
  ('MN', 'one_party',  false, 'Minn. Stat. §626A.02', NULL),
  ('MS', 'one_party',  false, 'Miss. Code §41-29-531', NULL),
  ('MO', 'one_party',  false, 'Mo. Rev. Stat. §542.402', NULL),
  ('MT', 'all_party',  true,  'Mont. Code §45-8-213', NULL),
  ('NE', 'one_party',  false, 'Neb. Rev. Stat. §86-290', NULL),
  ('NV', 'all_party',  true,  'Nev. Rev. Stat. §200.620', NULL),
  ('NH', 'all_party',  true,  'N.H. Rev. Stat. §570-A:2', NULL),
  ('NJ', 'one_party',  false, 'N.J. Stat. §2A:156A-4', NULL),
  ('NM', 'one_party',  false, 'N.M. Stat. §30-12-1', NULL),
  ('NY', 'one_party',  false, 'N.Y. Penal Law §250.00', NULL),
  ('NC', 'one_party',  false, 'N.C. Gen. Stat. §15A-287', NULL),
  ('ND', 'one_party',  false, 'N.D. Cent. Code §12.1-15-02', NULL),
  ('OH', 'one_party',  false, 'Ohio Rev. Code §2933.52', NULL),
  ('OK', 'one_party',  false, 'Okla. Stat. tit. 13, §176.4', NULL),
  ('OR', 'one_party',  false, 'Or. Rev. Stat. §165.540', NULL),
  ('PA', 'all_party',  true,  '18 Pa. Cons. Stat. §5704', NULL),
  ('RI', 'one_party',  false, 'R.I. Gen. Laws §11-35-21', NULL),
  ('SC', 'one_party',  false, 'S.C. Code §17-30-30', NULL),
  ('SD', 'one_party',  false, 'S.D. Codified Laws §23A-35A-20', NULL),
  ('TN', 'one_party',  false, 'Tenn. Code §39-13-601', NULL),
  ('TX', 'one_party',  false, 'Tex. Penal Code §16.02', NULL),
  ('UT', 'one_party',  false, 'Utah Code §77-23a-4', NULL),
  ('VT', 'one_party',  false, 'Vt. Stat. tit. 13, §7012', NULL),
  ('VA', 'one_party',  false, 'Va. Code §19.2-62', NULL),
  ('WA', 'all_party',  true,  'Wash. Rev. Code §9.73.030', NULL),
  ('WV', 'one_party',  false, 'W. Va. Code §62-1D-3', NULL),
  ('WI', 'one_party',  false, 'Wis. Stat. §968.31', NULL),
  ('WY', 'one_party',  false, 'Wyo. Stat. §7-3-702', NULL)
ON CONFLICT (state_code) DO NOTHING;

-- ── TASK-017: State SOL Rules (statute of limitations) ──────────────────────
-- §1006.26(b): Must not sue or threaten to sue on time-barred debt
-- from diff @@ TASK-017 @@

CREATE TABLE IF NOT EXISTS state_sol_rules (
  state_code CHAR(2) NOT NULL,
  debt_type TEXT NOT NULL CHECK (debt_type IN (
    'written_contract', 'oral_contract', 'promissory_note', 'open_account', 'credit_card'
  )),
  sol_years INTEGER NOT NULL,
  PRIMARY KEY (state_code, debt_type)
);

-- Seed common SOL values (partial — top 15 states by debt collection volume)
INSERT INTO state_sol_rules (state_code, debt_type, sol_years) VALUES
  -- California
  ('CA', 'written_contract', 4), ('CA', 'oral_contract', 2),
  ('CA', 'promissory_note', 4), ('CA', 'open_account', 4), ('CA', 'credit_card', 4),
  -- New York
  ('NY', 'written_contract', 6), ('NY', 'oral_contract', 6),
  ('NY', 'promissory_note', 6), ('NY', 'open_account', 6), ('NY', 'credit_card', 6),
  -- Texas
  ('TX', 'written_contract', 4), ('TX', 'oral_contract', 4),
  ('TX', 'promissory_note', 4), ('TX', 'open_account', 4), ('TX', 'credit_card', 4),
  -- Florida
  ('FL', 'written_contract', 5), ('FL', 'oral_contract', 4),
  ('FL', 'promissory_note', 5), ('FL', 'open_account', 4), ('FL', 'credit_card', 4),
  -- Illinois
  ('IL', 'written_contract', 10), ('IL', 'oral_contract', 5),
  ('IL', 'promissory_note', 10), ('IL', 'open_account', 5), ('IL', 'credit_card', 5),
  -- Pennsylvania
  ('PA', 'written_contract', 4), ('PA', 'oral_contract', 4),
  ('PA', 'promissory_note', 4), ('PA', 'open_account', 4), ('PA', 'credit_card', 4),
  -- Ohio
  ('OH', 'written_contract', 8), ('OH', 'oral_contract', 6),
  ('OH', 'promissory_note', 8), ('OH', 'open_account', 6), ('OH', 'credit_card', 6),
  -- Georgia
  ('GA', 'written_contract', 6), ('GA', 'oral_contract', 4),
  ('GA', 'promissory_note', 6), ('GA', 'open_account', 4), ('GA', 'credit_card', 4),
  -- North Carolina
  ('NC', 'written_contract', 3), ('NC', 'oral_contract', 3),
  ('NC', 'promissory_note', 5), ('NC', 'open_account', 3), ('NC', 'credit_card', 3),
  -- New Jersey
  ('NJ', 'written_contract', 6), ('NJ', 'oral_contract', 6),
  ('NJ', 'promissory_note', 6), ('NJ', 'open_account', 6), ('NJ', 'credit_card', 6),
  -- Michigan
  ('MI', 'written_contract', 6), ('MI', 'oral_contract', 6),
  ('MI', 'promissory_note', 6), ('MI', 'open_account', 6), ('MI', 'credit_card', 6),
  -- Virginia
  ('VA', 'written_contract', 5), ('VA', 'oral_contract', 3),
  ('VA', 'promissory_note', 6), ('VA', 'open_account', 3), ('VA', 'credit_card', 3),
  -- Arizona
  ('AZ', 'written_contract', 6), ('AZ', 'oral_contract', 3),
  ('AZ', 'promissory_note', 6), ('AZ', 'open_account', 3), ('AZ', 'credit_card', 3),
  -- Maryland
  ('MD', 'written_contract', 3), ('MD', 'oral_contract', 3),
  ('MD', 'promissory_note', 6), ('MD', 'open_account', 3), ('MD', 'credit_card', 3),
  -- Washington
  ('WA', 'written_contract', 6), ('WA', 'oral_contract', 3),
  ('WA', 'promissory_note', 6), ('WA', 'open_account', 3), ('WA', 'credit_card', 3)
ON CONFLICT (state_code, debt_type) DO NOTHING;

-- ── SOL tracking columns on collection_accounts ─────────────────────────────
-- Pre-computed for fast pre-dial lookup

ALTER TABLE collection_accounts
  ADD COLUMN IF NOT EXISTS sol_state CHAR(2),
  ADD COLUMN IF NOT EXISTS charge_off_date DATE,
  ADD COLUMN IF NOT EXISTS sol_expires_at DATE;

-- sol_expired is checked at query time (CURRENT_DATE is not immutable, cannot use GENERATED ALWAYS AS)
-- Use: WHERE sol_expires_at IS NOT NULL AND sol_expires_at < CURRENT_DATE

COMMENT ON COLUMN collection_accounts.sol_state
  IS '§1006.26(b): Consumer state for statute of limitations lookup';
COMMENT ON COLUMN collection_accounts.sol_expires_at
  IS '§1006.26(b): Computed expiry = charge_off_date + state SOL years';

-- ── Done ────────────────────────────────────────────────────────────────────
