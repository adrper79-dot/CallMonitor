-- Migration: demo_requests table
-- Purpose: Persist enterprise demo request form submissions from /request-demo
-- Referenced in: app/request-demo/page.tsx, workers/src/routes/internal.ts
-- CEO-18: Enterprise "Request Demo" form with Calendly embed

CREATE TABLE IF NOT EXISTS public.demo_requests (
  id          uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL,
  company     text NOT NULL,
  team_size   text,
  use_case    text,
  message     text,
  status      text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'contacted', 'qualified', 'closed_won', 'closed_lost')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

-- Prevent exact duplicate submissions within 1 minute (same email + company)
CREATE UNIQUE INDEX IF NOT EXISTS idx_demo_requests_email_company_dedup
  ON public.demo_requests (email, company, date_trunc('minute', created_at));

-- Fast lookup by email for CRM cross-reference
CREATE INDEX IF NOT EXISTS idx_demo_requests_email
  ON public.demo_requests (email);

-- Fast lookup by status for sales pipeline view
CREATE INDEX IF NOT EXISTS idx_demo_requests_status_created
  ON public.demo_requests (status, created_at DESC);

COMMENT ON TABLE public.demo_requests IS 'Enterprise demo request submissions from /request-demo page';
COMMENT ON COLUMN public.demo_requests.status IS 'Sales pipeline status: new → contacted → qualified → closed_won | closed_lost';
