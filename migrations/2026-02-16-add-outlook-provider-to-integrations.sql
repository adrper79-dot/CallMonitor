-- ============================================================================
-- Migration: 2026-02-16 — Add Outlook provider to integrations constraint
--
-- Purpose:
--   Allow provider='outlook' in integrations table for Microsoft 365 OAuth.
--
-- Safe rerun:
--   Drops/recreates the provider check constraint only when present.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'integrations'
      AND constraint_name = 'integrations_provider_check'
  ) THEN
    ALTER TABLE public.integrations DROP CONSTRAINT integrations_provider_check;
  END IF;

  ALTER TABLE public.integrations
    ADD CONSTRAINT integrations_provider_check
    CHECK (
      provider IN (
        'hubspot',
        'salesforce',
        'zoho',
        'pipedrive',
        'quickbooks',
        'google_workspace',
        'outlook',
        'zendesk',
        'freshdesk',
        'slack',
        'teams',
        'zapier'
      )
    );
END $$;
