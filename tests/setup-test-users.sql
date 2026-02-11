-- ============================================================================
-- Test Users Setup for Word Is Bond Platform
-- Creates two complete test users with SignalWire phone numbers
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TEST ORGANIZATION
-- ============================================================================

-- Create test organization (idempotent)
INSERT INTO organizations (id, name, created_by, created_at, updated_at)
VALUES (
  'test-org-001', 
  'Word Is Bond QA Team',
  'test-user-001',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- ============================================================================
-- 2. TEST USER 1 - Primary Test Account
-- ============================================================================

-- User: test-user-001@wordis-bond.com
-- Phone: +1 (202) 771-1933 (SignalWire)
-- Role: Owner

INSERT INTO users (id, email, name, password_hash, platform_role, created_at, updated_at)
VALUES (
  'test-user-001',
  'test-user-001@wordis-bond.com',
  'QA Test User 1',
  'pbkdf2:100000:a1b2c3d4e5f6789012345678901234567890123456789012:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'user',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  updated_at = NOW();

-- ============================================================================
-- 3. TEST USER 2 - Secondary Test Account
-- ============================================================================

-- User: test-user-002@wordis-bond.com
-- Phone: +1 (203) 298-7277 (SignalWire)
-- Role: Admin

INSERT INTO users (id, email, name, password_hash, platform_role, created_at, updated_at)
VALUES (
  'test-user-002',
  'test-user-002@wordis-bond.com',
  'QA Test User 2',
  'pbkdf2:100000:a1b2c3d4e5f6789012345678901234567890123456789012:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'user',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  updated_at = NOW();

-- ============================================================================
-- 4. ORG MEMBERSHIP
-- ============================================================================

-- User 1 - Owner
INSERT INTO org_members (id, user_id, organization_id, role, created_at)
VALUES (
  'test-org-member-001',
  'test-user-001',
  'test-org-001',
  'owner',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role;

-- User 2 - Admin
INSERT INTO org_members (id, user_id, organization_id, role, created_at)
VALUES (
  'test-org-member-002',
  'test-user-002',
  'test-org-001',
  'admin',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role;

-- ============================================================================
-- 5. VOICE CONFIGURATION (SignalWire)
-- ============================================================================

INSERT INTO voice_configs (
  id,
  organization_id,
  provider,
  telnyx_api_key,
  telnyx_public_key,
  call_control_app_id,
  default_from_number,
  live_translate,
  recording_enabled,
  transcription_enabled,
  created_at,
  updated_at
)
VALUES (
  'test-voice-config-001',
  'test-org-001',
  'signalwire',
  'PT43c47e95180c2ca50ff967e52be1a860ae41a7c51fec8407', -- SignalWire token
  '', -- Public key not needed for SignalWire
  '5786c423-864f-4b39-a77a-595de3b5cfdd', -- SignalWire AI Agent ID
  '+12027711933', -- SignalWire primary number
  false,
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  provider = EXCLUDED.provider,
  telnyx_api_key = EXCLUDED.telnyx_api_key,
  call_control_app_id = EXCLUDED.call_control_app_id,
  default_from_number = EXCLUDED.default_from_number,
  updated_at = NOW();

-- ============================================================================
-- 6. SIGNALWIRE PHONE NUMBERS
-- ============================================================================

-- Primary number: +1 (202) 771-1933
INSERT INTO phone_numbers (
  id,
  organization_id,
  phone_number,
  country_code,
  number_type,
  capabilities,
  is_active,
  provider_id,
  created_at
)
VALUES (
  '50bd6fb6-85f7-48e6-959f-199b37809707',
  'test-org-001',
  '+12027711933',
  'US',
  'local',
  ARRAY['voice', 'sms']::text[],
  true,
  '50bd6fb6-85f7-48e6-959f-199b37809707', -- SignalWire phone ID
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  phone_number = EXCLUDED.phone_number,
  is_active = EXCLUDED.is_active;

-- Secondary number: +1 (203) 298-7277
INSERT INTO phone_numbers (
  id,
  organization_id,
  phone_number,
  country_code,
  number_type,
  capabilities,
  is_active,
  provider_id,
  created_at
)
VALUES (
  'ae0e07df-3b2c-4415-8a9d-533d5639b7a5',
  'test-org-001',
  '+12032987277',
  'US',
  'local',
  ARRAY['voice', 'sms']::text[],
  true,
  'ae0e07df-3b2c-4415-8a9d-533d5639b7a5', -- SignalWire phone ID
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  phone_number = EXCLUDED.phone_number,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- 7. SUBSCRIPTION (Business Plan for full features)
-- ============================================================================

INSERT INTO subscriptions (
  id,
  organization_id,
  plan_id,
  status,
  start_date,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
VALUES (
  'test-sub-001',
  'test-org-001',
  'business', -- Full feature access
  'active',
  NOW(),
  NOW(),
  NOW() + INTERVAL '1 year',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = NOW();

-- ============================================================================
-- 9. TEST AGENTS FOR DIALER
-- ============================================================================

-- Agent 1 (test-user-001 as dialer agent)
INSERT INTO dialer_agent_status (
  id,
  organization_id,
  user_id,
  status,
  wrap_up_seconds,
  calls_handled,
  shift_started_at,
  updated_at
)
VALUES (
  'test-agent-001',
  'test-org-001',
  'test-user-001',
  'available',
  30,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT idx_dialer_agent_unique DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = NOW();

-- Agent 2 (test-user-002 as dialer agent)
INSERT INTO dialer_agent_status (
  id,
  organization_id,
  user_id,
  status,
  wrap_up_seconds,
  calls_handled,
  shift_started_at,
  updated_at
)
VALUES (
  'test-agent-002',
  'test-org-001',
  'test-user-002',
  'available',
  30,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT idx_dialer_agent_unique DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = NOW();

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo 'TEST ENVIRONMENT PROVISIONING COMPLETE'
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- Verify test users
\echo '📦 Test Users:'
SELECT 
  u.id,
  u.email,
  u.name,
  om.role as org_role,
  o.name as organization
FROM users u
JOIN org_members om ON om.user_id = u.id
JOIN organizations o ON o.id = om.organization_id
WHERE u.id IN ('test-user-001', 'test-user-002')
ORDER BY u.id;

\echo ''
\echo '📞 Voice Configuration:'
-- Verify voice config
SELECT
  vc.id,
  vc.organization_id,
  vc.provider,
  vc.default_from_number,
  vc.call_control_app_id
FROM voice_configs vc
WHERE vc.organization_id = 'test-org-001';

\echo ''
\echo '📱 Phone Numbers:'
-- Verify phone numbers
SELECT
  pn.id,
  pn.phone_number,
  pn.capabilities,
  pn.is_active
FROM phone_numbers pn
WHERE pn.organization_id = 'test-org-001'
ORDER BY pn.phone_number;

\echo ''
\echo '👥 Dialer Agents:'
-- Verify dialer agents
SELECT
  das.id,
  das.user_id,
  das.status,
  das.wrap_up_seconds,
  das.calls_handled
FROM dialer_agent_status das
WHERE das.organization_id = 'test-org-001'
ORDER BY das.user_id;

\echo ''
\echo '💳 Subscription:'
-- Verify subscription
SELECT
  s.id,
  s.plan_id,
  s.status,
  s.current_period_end
FROM subscriptions s
WHERE s.organization_id = 'test-org-001';

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo 'READY FOR E2E TESTING'
\echo '════════════════════════════════════════════════════════════════════════'
\echo ''

-- ============================================================================
-- TEST CREDENTIALS
-- ============================================================================

/*
TEST USER 1:
  Email: test-user-001@wordis-bond.com
  Password: TestPass123!
  Phone: +1 (202) 771-1933
  Role: Owner
  
TEST USER 2:
  Email: test-user-002@wordis-bond.com
  Password: TestPass123!
  Phone: +1 (203) 298-7277
  Role: Admin

ORGANIZATION:
  ID: test-org-001
  Name: Word Is Bond QA Team

SIGNALWIRE CONFIG:
  Project ID: ca1fd3cb-bd2d-4cad-a2b3-589c9fd2c624
  Space: blackkryptonians.signalwire.com
  Token: PT43c47e95180c2ca50ff967e52be1a860ae41a7c51fec8407
  AI Agent ID: 5786c423-864f-4b39-a77a-595de3b5cfdd

RUN THIS SCRIPT:
  psql $NEON_PG_CONN -f tests/setup-test-users.sql
*/
