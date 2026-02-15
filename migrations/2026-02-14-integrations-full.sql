-- ============================================================================
-- INTEGRATIONS FULL BUILD — Additional Tables for v4.30
-- Extends the CRM connectivity foundation (2026-01-20-crm-connectivity.sql)
-- Adds: webhook subscriptions, deliveries, notification channels,
--        helpdesk tickets, field mappings, contact cache
-- ============================================================================

BEGIN;

-- 1. Webhook Subscriptions (for Zapier, Make.com, custom endpoints)
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    target_url      TEXT NOT NULL,
    secret          TEXT NOT NULL,  -- HMAC-SHA256 signing secret
    events          TEXT[] NOT NULL DEFAULT '{}',
    headers         JSONB DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Webhook Deliveries (delivery log)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status_code     INTEGER,
    response_body   TEXT,
    response_time_ms INTEGER,
    attempt         INTEGER DEFAULT 1,
    success         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. Notification Channels (Slack, Teams)
CREATE TABLE IF NOT EXISTS notification_channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('slack', 'teams')),
    name            TEXT NOT NULL,
    webhook_url     TEXT NOT NULL,
    events          TEXT[] NOT NULL DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. Notification Deliveries
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id      UUID NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status_code     INTEGER,
    success         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 5. Helpdesk Tickets (created from calls)
CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    call_id         UUID REFERENCES calls(id) ON DELETE SET NULL,
    provider        TEXT NOT NULL CHECK (provider IN ('zendesk', 'freshdesk')),
    ticket_id       TEXT NOT NULL,  -- External ticket ID
    ticket_url      TEXT,
    subject         TEXT,
    status          TEXT DEFAULT 'open',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 6. CRM Field Mappings
CREATE TABLE IF NOT EXISTS crm_field_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    wib_field       TEXT NOT NULL,
    crm_field       TEXT NOT NULL,
    direction       TEXT NOT NULL DEFAULT 'to_crm' CHECK (direction IN ('to_crm', 'from_crm', 'bidirectional')),
    transform       TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (integration_id, wib_field)
);

-- 7. CRM Contact Cache (for real-time lookup during calls)
CREATE TABLE IF NOT EXISTS crm_contact_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    crm_contact_id  TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    first_name      TEXT,
    last_name       TEXT,
    company         TEXT,
    title           TEXT,
    extra_data      JSONB DEFAULT '{}',
    synced_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (integration_id, crm_contact_id)
);

-- Add missing columns to integrations table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'last_sync_at') THEN
    ALTER TABLE integrations ADD COLUMN last_sync_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'sync_cursor') THEN
    ALTER TABLE integrations ADD COLUMN sync_cursor TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'last_error_at') THEN
    ALTER TABLE integrations ADD COLUMN last_error_at TIMESTAMPTZ;
  END IF;
END $$;

-- Also update the provider CHECK constraint to include new providers
-- (use a migration-safe approach)
DO $$
BEGIN
  -- Drop old constraint if it exists and recreate with new values
  IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'integrations_provider_check') THEN
    ALTER TABLE integrations DROP CONSTRAINT integrations_provider_check;
  END IF;
  ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
    CHECK (provider IN ('hubspot', 'salesforce', 'zoho', 'pipedrive', 'quickbooks', 'google_workspace', 'zendesk', 'freshdesk', 'slack', 'teams', 'zapier'));
EXCEPTION WHEN others THEN
  -- Constraint may already be correct
  NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org ON webhook_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_channels_org ON notification_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel ON notification_deliveries(channel_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_org ON helpdesk_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_call ON helpdesk_tickets(call_id);
CREATE INDEX IF NOT EXISTS idx_crm_field_mappings_integration ON crm_field_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_field_mappings_org ON crm_field_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_cache_org ON crm_contact_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_cache_phone ON crm_contact_cache(phone);
CREATE INDEX IF NOT EXISTS idx_crm_contact_cache_email ON crm_contact_cache(email);
CREATE INDEX IF NOT EXISTS idx_crm_contact_cache_integration ON crm_contact_cache(integration_id);

COMMIT;
