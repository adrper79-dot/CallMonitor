-- Migration 038: Ensure call_notes, call_confirmations tables and disposition columns exist
-- These were previously created via DDL-in-handlers (anti-pattern), now moved to proper migrations

-- Call notes
CREATE TABLE IF NOT EXISTS call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call confirmations (in-call verbal/action confirmations)
CREATE TABLE IF NOT EXISTS call_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  confirmation_type TEXT NOT NULL,
  details JSONB,
  confirmed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disposition columns on calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS disposition TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS disposition_notes TEXT;
