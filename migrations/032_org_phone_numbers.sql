-- Migration 032: Org Phone Numbers (round-robin outbound pool)
-- Creates the per-org phone number pool with round-robin tracking,
-- CNAM status, and active/inactive flags.

BEGIN;

CREATE TABLE IF NOT EXISTS org_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  telnyx_number_id TEXT,           -- Telnyx internal phone number ID
  label TEXT DEFAULT 'Line 1',     -- Display label (Line 1, Line 2, ...)
  purpose TEXT NOT NULL DEFAULT 'outbound' CHECK (purpose IN ('outbound', 'inbound', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  pool_order INTEGER NOT NULL DEFAULT 0,
  cnam_listing_id TEXT,            -- Telnyx CNAM listing ID (shared per org)
  cnam_status TEXT DEFAULT 'pending' CHECK (cnam_status IN ('pending', 'verified', 'rejected', 'none')),
  last_used_at TIMESTAMPTZ,        -- For round-robin: NULL = never used = highest priority
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Round-robin index: pick least-recently-used active outbound number per org
CREATE INDEX IF NOT EXISTS idx_org_phone_numbers_round_robin
  ON org_phone_numbers (organization_id, last_used_at ASC NULLS FIRST)
  WHERE is_active = true AND purpose IN ('outbound', 'both');

-- Lookup by org
CREATE INDEX IF NOT EXISTS idx_org_phone_numbers_org
  ON org_phone_numbers (organization_id);

-- Lookup by phone number (for inbound routing)
CREATE INDEX IF NOT EXISTS idx_org_phone_numbers_phone
  ON org_phone_numbers (phone_number);

COMMIT;
