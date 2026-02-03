-- Migration: Add Caller ID Masking Support
-- Date: January 14, 2026
-- Purpose: Allow organizations to display a custom caller ID

-- Add caller ID mask fields to voice_configs
ALTER TABLE public.voice_configs
  ADD COLUMN IF NOT EXISTS caller_id_mask text,
  ADD COLUMN IF NOT EXISTS caller_id_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS caller_id_verified_at timestamptz;

COMMENT ON COLUMN public.voice_configs.caller_id_mask IS 'Phone number to display as caller ID (must be verified or owned)';
COMMENT ON COLUMN public.voice_configs.caller_id_verified IS 'Whether the mask number has been verified with SignalWire';
COMMENT ON COLUMN public.voice_configs.caller_id_verified_at IS 'When the number was verified';

-- Add caller_id_numbers table for managing multiple verified numbers
CREATE TABLE IF NOT EXISTS public.caller_id_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  phone_number text NOT NULL,
  display_name text,
  
  -- Verification status
  is_verified boolean DEFAULT false,
  verification_code text,
  verified_at timestamptz,
  
  -- SignalWire verification
  signalwire_verification_sid text,
  
  -- Usage
  is_default boolean DEFAULT false,
  use_count integer DEFAULT 0,
  last_used_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  
  CONSTRAINT unique_org_phone UNIQUE (organization_id, phone_number)
);

COMMENT ON TABLE public.caller_id_numbers IS 'Verified caller ID numbers for outbound call masking';
COMMENT ON COLUMN public.caller_id_numbers.phone_number IS 'E.164 format phone number to display';
COMMENT ON COLUMN public.caller_id_numbers.is_verified IS 'Number verified via SignalWire validation call';

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_caller_id_numbers_org ON public.caller_id_numbers(organization_id);
CREATE INDEX IF NOT EXISTS idx_caller_id_numbers_default ON public.caller_id_numbers(organization_id) WHERE is_default = true;
