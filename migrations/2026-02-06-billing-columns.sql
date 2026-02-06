-- Migration: Add Stripe billing columns to organizations table
-- Date: 2026-02-06
-- Agent: Billing Integration Agent (Agent 3)
-- Purpose: Ensure all Stripe billing columns exist for real billing integration

-- Add subscription_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.organizations
    ADD COLUMN subscription_status text DEFAULT 'inactive'
    CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'inactive'));
  END IF;
END $$;

-- Add subscription_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE public.organizations
    ADD COLUMN subscription_id text;
  END IF;
END $$;

-- Add plan_id column if it doesn't exist (stores Stripe price ID)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.organizations
    ADD COLUMN plan_id text;
  END IF;
END $$;

-- Add plan_started_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'plan_started_at'
  ) THEN
    ALTER TABLE public.organizations
    ADD COLUMN plan_started_at timestamptz;
  END IF;
END $$;

-- Add plan_ends_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'plan_ends_at'
  ) THEN
    ALTER TABLE public.organizations
    ADD COLUMN plan_ends_at timestamptz;
  END IF;
END $$;

-- Create billing_events table if it doesn't exist (for invoice history)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  amount integer,
  invoice_id text,
  payment_intent_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index on organization_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_billing_events_org_id
  ON public.billing_events(organization_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at
  ON public.billing_events(created_at DESC);

-- Create index on invoice_id for webhook deduplication
CREATE INDEX IF NOT EXISTS idx_billing_events_invoice_id
  ON public.billing_events(invoice_id);

COMMENT ON TABLE public.billing_events IS 'Stores billing events from Stripe webhooks (invoices, payments, etc.)';
COMMENT ON COLUMN public.organizations.subscription_status IS 'Stripe subscription status (active, trialing, canceled, etc.)';
COMMENT ON COLUMN public.organizations.subscription_id IS 'Stripe subscription ID (sub_...)';
COMMENT ON COLUMN public.organizations.plan_id IS 'Stripe price ID (price_...)';
COMMENT ON COLUMN public.organizations.plan_started_at IS 'When the current plan started';
COMMENT ON COLUMN public.organizations.plan_ends_at IS 'When the plan ends (for canceled subscriptions)';
