-- ============================================================================
-- Reset & Seed Test Data
-- Run: npm run db:reset-test  (psql $NEON_PG_CONN -f migrations/reset_test.sql)
--
-- Purpose: Cleans transactional data while preserving schema, then seeds a
-- deterministic test organization with users at every role level.
--
-- Safe to run repeatedly (all operations are idempotent).
-- ============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- Phase 1: Clear transactional data (child → parent order for FK safety)
-- ──────────────────────────────────────────────────────────────────────────
TRUNCATE TABLE audit_logs              CASCADE;
TRUNCATE TABLE billing_events          CASCADE;
TRUNCATE TABLE call_confirmations      CASCADE;
TRUNCATE TABLE call_notes              CASCADE;
TRUNCATE TABLE call_outcomes           CASCADE;
TRUNCATE TABLE call_timeline_events    CASCADE;
TRUNCATE TABLE calls                   CASCADE;
TRUNCATE TABLE recordings              CASCADE;
TRUNCATE TABLE booking_events          CASCADE;
TRUNCATE TABLE bookings                CASCADE;
TRUNCATE TABLE campaign_contacts       CASCADE;
TRUNCATE TABLE campaigns               CASCADE;
TRUNCATE TABLE webrtc_sessions         CASCADE;
TRUNCATE TABLE team_invites            CASCADE;

-- Keep schema, users table, orgs, memberships — rebuild those in Phase 2.
-- Do NOT truncate: users, organizations, org_members, tool_team_members,
-- sessions, voice_configs (these are treated as reference data).

-- ──────────────────────────────────────────────────────────────────────────
-- Phase 2: Seed deterministic test org + users
-- Uses fixed UUIDs so tests can hardcode references.
-- ──────────────────────────────────────────────────────────────────────────

-- Test organization
INSERT INTO organizations (id, name, slug, subscription_status, created_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Test Organization',
  'test-org',
  'active',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug;

-- Admin user
INSERT INTO users (id, name, email, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Test Admin',
  'admin@test-org.local',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

-- Operator user
INSERT INTO users (id, name, email, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'Test Operator',
  'operator@test-org.local',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

-- Viewer user (read-only)
INSERT INTO users (id, name, email, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000003',
  'Test Viewer',
  'viewer@test-org.local',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

-- Org memberships
INSERT INTO org_members (organization_id, user_id, role)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'member'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'viewer')
ON CONFLICT DO NOTHING;

-- Tool team memberships
INSERT INTO tool_team_members (id, organization_id, user_id, tool, role, invited_by)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'callmonitor', 'admin', 'b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'callmonitor', 'editor', 'b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'callmonitor', 'viewer', 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- Phase 3: Seed sample transactional data
-- ──────────────────────────────────────────────────────────────────────────

-- Sample calls
INSERT INTO calls (id, organization_id, user_id, phone_number, status, created_at)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '+15551234567', 'completed', NOW() - INTERVAL '2 hours'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', '+15559876543', 'completed', NOW() - INTERVAL '1 hour'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '+15555550100', 'pending', NOW())
ON CONFLICT (id) DO NOTHING;

-- Sample call outcomes
INSERT INTO call_outcomes (id, call_id, organization_id, outcome_status, confidence_level, summary_text, summary_source, declared_by_user_id, revision_number)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'agreed', 'high', 'Customer agreed to all terms.', 'human', 'b0000000-0000-0000-0000-000000000002', 1),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'follow_up_required', 'medium', 'Customer needs more time.', 'human', 'b0000000-0000-0000-0000-000000000002', 1)
ON CONFLICT (id) DO NOTHING;

-- Sample audit entries (self-documenting)
INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, new_value)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'calls', 'd0000000-0000-0000-0000-000000000001', 'call:started', '{"phone": "+15551234567"}'::jsonb),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'calls', 'd0000000-0000-0000-0000-000000000001', 'call:ended', '{"status": "completed"}'::jsonb);

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────
-- Verification
-- ──────────────────────────────────────────────────────────────────────────
SELECT 'Users' AS entity, COUNT(*) AS count FROM users WHERE email LIKE '%@test-org.local'
UNION ALL
SELECT 'Org Members', COUNT(*) FROM org_members WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Calls', COUNT(*) FROM calls WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Outcomes', COUNT(*) FROM call_outcomes WHERE organization_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Audit Logs', COUNT(*) FROM audit_logs WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
