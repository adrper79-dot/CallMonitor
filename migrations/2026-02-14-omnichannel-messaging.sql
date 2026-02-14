-- Omnichannel Messaging Schema — Word Is Bond v4.30
-- Adds SMS/Email messaging support with opt-out/opt-in management
--
-- Design decisions:
--   - messages table stores all communications (SMS, email, call summaries)
--   - Multi-tenant isolation via organization_id
--   - Links to collection_accounts for CRM integration
--   - Supports opt-out compliance (TCPA)
--   - External message IDs for Telnyx/Resend tracking
--
-- @see ARCH_DOCS/02-FEATURES/OMNICHANNEL_MESSAGING.md

-- ─── Messages Table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id UUID REFERENCES collection_accounts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Message properties
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'call')),
  from_number TEXT,                            -- E.164 format for SMS
  to_number TEXT,                              -- E.164 format for SMS
  from_email TEXT,                             -- For email channel
  to_email TEXT,                               -- For email channel
  message_body TEXT,                           -- SMS text or email body
  subject TEXT,                                -- Email subject (null for SMS)
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'received')),
  external_message_id TEXT,                    -- Telnyx message ID or Resend ID
  error_message TEXT,                          -- Error details if failed
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_organization_id
  ON messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_account_id
  ON messages(account_id, created_at DESC) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_campaign_id
  ON messages(campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_external_id
  ON messages(external_message_id) WHERE external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_status
  ON messages(organization_id, status, created_at DESC);

-- ─── Collection Accounts: Add SMS/Email Consent ─────────────────────────────

-- Add consent fields to collection_accounts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'collection_accounts' AND column_name = 'sms_consent') THEN
    ALTER TABLE collection_accounts ADD COLUMN sms_consent BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'collection_accounts' AND column_name = 'email_consent') THEN
    ALTER TABLE collection_accounts ADD COLUMN email_consent BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'collection_accounts' AND column_name = 'last_contact_at') THEN
    ALTER TABLE collection_accounts ADD COLUMN last_contact_at TIMESTAMPTZ;
  END IF;
END
$$;

COMMENT ON COLUMN collection_accounts.sms_consent IS 'User has consented to receive SMS (TCPA compliance)';
COMMENT ON COLUMN collection_accounts.email_consent IS 'User has consented to receive email (CAN-SPAM compliance)';
COMMENT ON COLUMN collection_accounts.last_contact_at IS 'Last inbound or outbound contact timestamp';

-- ─── Opt-Out Requests Tracking ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opt_out_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id UUID REFERENCES collection_accounts(id) ON DELETE SET NULL,
  
  -- Opt-out details
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'call', 'manual')),
  phone_number TEXT,                           -- E.164 format
  email_address TEXT,
  request_type TEXT NOT NULL CHECK (request_type IN ('opt_out', 'opt_in')),
  
  -- Tracking
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opt_out_requests_org
  ON opt_out_requests(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opt_out_requests_account
  ON opt_out_requests(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opt_out_requests_phone
  ON opt_out_requests(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opt_out_requests_pending
  ON opt_out_requests(organization_id, processed) WHERE NOT processed;

COMMENT ON TABLE opt_out_requests IS 'Tracks opt-out/opt-in requests for compliance audit trail';
COMMENT ON COLUMN opt_out_requests.request_type IS 'Whether this is an opt-out (STOP) or opt-in (START) request';

-- ─── Auto-Reply Templates ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auto_reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Template properties
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('opt_out', 'opt_in', 'business_hours', 'generic')),
  message_body TEXT NOT NULL,
  subject TEXT,                                -- For email channel
  
  -- Settings
  is_active BOOLEAN NOT NULL DEFAULT true,
  send_delay_seconds INT DEFAULT 0,            -- Optional delay before sending
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_templates_org
  ON auto_reply_templates(organization_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_auto_reply_templates_trigger
  ON auto_reply_templates(organization_id, channel, trigger_type) WHERE is_active = true;

COMMENT ON TABLE auto_reply_templates IS 'Customizable auto-reply messages for different triggers';

-- ─── Default Auto-Reply Templates ────────────────────────────────────────────

-- Note: Default templates are created at the application level when an org is created
-- This ensures each org can customize their messages
