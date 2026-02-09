-- ============================================================================
-- Migration: 2026-02-09 — Add Missing Columns to calls Table
-- 
-- Root Cause: The production `calls` table was created from an older schema
-- that lacked columns required by the current codebase. The INSERT in
-- calls.ts uses `caller_id_used`, webhook handlers use `call_control_id`,
-- and various features reference `recording_url`, `transcript`, etc.
--
-- Without these columns:
--   - POST /calls/start fails silently (INSERT error on caller_id_used)
--   - Webhook call_control_id matching fails
--   - Live translation pipeline never fires (no call record found)
--   - Recording/transcript storage fails
--
-- Safe to run multiple times (all IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================================

-- Core columns needed by calls.ts and webhooks.ts
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_id_used TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_control_id TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS to_number TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS from_number TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS flow_type TEXT DEFAULT 'direct';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS transcript_status TEXT DEFAULT 'none';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS transcript_id TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Disposition workflow columns
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS disposition_set_at TIMESTAMPTZ;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS disposition_set_by UUID;

-- Consent/disclosure columns (compliance features)
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS consent_method TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS consent_audio_offset_ms INTEGER;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS disclosure_type TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS disclosure_given BOOLEAN DEFAULT false;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS disclosure_timestamp TIMESTAMPTZ;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS disclosure_text TEXT;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Evidence integrity columns
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS is_authoritative BOOLEAN DEFAULT true;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS immutability_policy TEXT DEFAULT 'limited';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS custody_status TEXT DEFAULT 'active';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS retention_class TEXT DEFAULT 'default';
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS evidence_completeness TEXT DEFAULT 'unknown';

-- Indexes for webhook matching
CREATE INDEX IF NOT EXISTS idx_calls_call_control_id ON public.calls(call_control_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON public.calls(call_sid);
