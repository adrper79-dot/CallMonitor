-- Migration: Add bridge_partner_id to calls table
-- Purpose: Track the partner call_control_id for bridge call flow
-- When agent answers (bridge leg 1), we create the customer call (bridge leg 2)
-- and store the agent's call_control_id in bridge_partner_id so that when
-- the customer answers, we can look up the agent's call to bridge them.

ALTER TABLE calls ADD COLUMN IF NOT EXISTS bridge_partner_id TEXT;

-- Index for fast lookups during bridge flow
CREATE INDEX IF NOT EXISTS idx_calls_bridge_partner_id ON calls(bridge_partner_id)
  WHERE bridge_partner_id IS NOT NULL;

COMMENT ON COLUMN calls.bridge_partner_id IS 'For bridge_customer calls: stores the agent call_control_id to bridge when customer answers';
