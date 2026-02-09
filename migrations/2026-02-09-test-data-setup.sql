-- Migration: 2026-02-09-test-data-setup.sql
-- Purpose: Create test user, organization, and voice config for production tests
-- This ensures database tests have the required test data

BEGIN;

-- Create test user if not exists
INSERT INTO users (id, email, name, is_admin, platform_role)
VALUES ('fixer-test-owner-001', 'fixer-owner@wordisbond.test', 'Test Owner', true, 'admin')
ON CONFLICT (id) DO NOTHING;

-- Create test organization if not exists
INSERT INTO organizations (id, name, plan, created_by)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001'::uuid, 'Fixer Test Organization', 'enterprise', 'fixer-test-owner-001')
ON CONFLICT (id) DO NOTHING;

-- Create org_members relationship
INSERT INTO org_members (organization_id, user_id, role)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001'::uuid, 'fixer-test-owner-001', 'owner')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Create voice config for test organization
INSERT INTO voice_configs (organization_id, record, transcribe, translate, survey)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001'::uuid, true, true, false, false)
ON CONFLICT (organization_id) DO NOTHING;

COMMIT;