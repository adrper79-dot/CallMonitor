-- Migration: add login_attempts for tracking failed credential attempts
-- This table is optional; we use an in-memory limiter by default but recommend
-- a persistent table or Redis for production rate-limiting across instances.

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  ip text,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT login_attempts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS login_attempts_username_idx ON public.login_attempts (username);
CREATE INDEX IF NOT EXISTS login_attempts_attempted_at_idx ON public.login_attempts (attempted_at);
