-- Migration: Add Cal.com-style Booking Events
-- Date: January 14, 2026
-- Feature: Scheduled Call Booking System

-- Create booking_events table
CREATE TABLE IF NOT EXISTS public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid REFERENCES public.users(id),
  call_id uuid REFERENCES public.calls(id),  -- NULL until call executes
  
  -- Booking details
  title text NOT NULL,
  description text,
  
  -- Scheduling
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  timezone text DEFAULT 'UTC',
  
  -- Attendee info
  attendee_name text,
  attendee_email text,
  attendee_phone text NOT NULL,  -- Required for calling
  
  -- Status tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Booking created, awaiting scheduled time
    'confirmed',    -- Attendee confirmed (optional)
    'calling',      -- Call being placed
    'completed',    -- Call completed successfully
    'no_answer',    -- Call placed but not answered
    'cancelled',    -- Booking cancelled
    'failed'        -- Call failed
  )),
  
  -- Reminders
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamptz,
  
  -- Call modulations (inherit from voice_configs or override)
  modulations jsonb DEFAULT '{}',
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id)
);

-- Add comments
COMMENT ON TABLE public.booking_events IS 'Cal.com-style scheduled call bookings';
COMMENT ON COLUMN public.booking_events.call_id IS 'Linked call record after call is placed';
COMMENT ON COLUMN public.booking_events.modulations IS 'Override call modulations (record, transcribe, translate, etc.)';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_booking_events_org_id ON public.booking_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_status ON public.booking_events(status);
CREATE INDEX IF NOT EXISTS idx_booking_events_start_time ON public.booking_events(start_time);
CREATE INDEX IF NOT EXISTS idx_booking_events_pending_calls ON public.booking_events(start_time) 
  WHERE status = 'pending';

-- Add booking type to organizations (optional default template)
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS default_booking_duration integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.organizations.default_booking_duration IS 'Default booking duration in minutes';
COMMENT ON COLUMN public.organizations.booking_enabled IS 'Whether booking feature is enabled for this org';

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_booking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS booking_events_updated_at ON public.booking_events;
CREATE TRIGGER booking_events_updated_at
  BEFORE UPDATE ON public.booking_events
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_updated_at();
