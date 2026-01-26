-- Migration: Add from_number to booking_events
-- Date: January 14, 2026
-- Purpose: Support bridge calls where user's number is called first

-- Add from_number column for bridge call support
ALTER TABLE public.booking_events 
  ADD COLUMN IF NOT EXISTS from_number text;

COMMENT ON COLUMN public.booking_events.from_number IS 'Caller number for bridge calls (your phone)';

-- If from_number is provided, the call will be a bridge call:
-- 1. System calls from_number first
-- 2. When answered, system calls attendee_phone
-- 3. Both parties are bridged together
