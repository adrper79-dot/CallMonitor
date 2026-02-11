-- ============================================================================
-- Test Environment Provisioning for E2E Testing
-- ============================================================================
-- Creates:
--   - 1 test organization (with provisioned phone number)
--   - 2 test users (customers who receive calls)
--   - 2 test agents (dialer operators)
--   - Voice configuration (with translation enabled)
--   - Subscription
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE TEST ORGANIZATION
-- ============================================================================
INSERT INTO organizations (
  name,
  plan,
  plan_status,
  provisioned_number,
  created_at
) VALUES (
  'Word Is Bond QA Team',
  'enterprise',
  'active',
  '+12027711933', -- SignalWire number from .env.production
  NOW()
)
RETURNING id AS org_id \gset

-- ============================================================================
-- 2. CREATE TEST USERS (Customers)
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get the org ID we just created
  SELECT id INTO v_org_id 
  FROM organizations 
  WHERE name = 'Word Is Bond QA Team' 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Create test customers (will receive calls)
  INSERT INTO users (
    id,
    email,
    name,
    organization_id,
    role,
    created_at
  ) VALUES
  (
    gen_random_uuid(),
    'test-customer-1@wordisbond.test',
    'Test Customer One',
    v_org_id,
    'user',
    NOW()
  ),
  (
    gen_random_uuid(),
    'test-customer-2@wordisbond.test',
    'Test Customer Two',
    v_org_id,
    'user',
    NOW()
  );

  -- ============================================================================
  -- 3. CREATE TEST AGENTS (Dialer Operators)
  -- ============================================================================
  INSERT INTO users (
    id,
    email,
    name,
    organization_id,
    role,
    created_at
  ) VALUES
  (
    gen_random_uuid(),
    'test-agent-1@wordisbond.test',
    'Test Agent One',
    v_org_id,
    'agent',
    NOW()
  ),
  (
    gen_random_uuid(),
    'test-agent-2@wordisbond.test',
    'Test Agent Two',
    v_org_id,
    'agent',
    NOW()
  );

  -- ============================================================================
  -- 4. CREATE VOICE CONFIGURATION
  -- ============================================================================
  INSERT INTO voice_configs (
    id,
    organization_id,
    record,
    transcribe,
    translate,
    translate_from,
    translate_to,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_org_id,
    true,  -- Enable recording
    true,  -- Enable transcription
    true,  -- Enable translation
    'auto', -- Auto-detect source language
    'en',  -- Translate to English
    NOW()
  );

  -- ============================================================================
  -- 5. CREATE ORG MEMBERSHIP
  -- ============================================================================
  -- Add all users to org_members (required for auth)
  INSERT INTO org_members (user_id, organization_id, role, created_at)
  SELECT 
    u.id,
    v_org_id,
    CASE 
      WHEN u.role = 'agent' THEN 'admin'
      ELSE 'user'
    END,
    NOW()
  FROM users u
  WHERE u.organization_id = v_org_id;

  -- ============================================================================
  -- 6. CREATE SUBSCRIPTION
  -- ============================================================================
  INSERT INTO subscriptions (
    id,
    organization_id,
    plan,
    status,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_org_id,
    'enterprise',
    'active',
    NOW()
  );

  -- ============================================================================
  -- 7. VERIFY CREATION
  -- ============================================================================
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Test Environment Provisioned Successfully';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Organization ID: %', v_org_id;
  RAISE NOTICE 'Organizations: %', (SELECT COUNT(*) FROM organizations WHERE id = v_org_id);
  RAISE NOTICE 'Test Customers: %', (SELECT COUNT(*) FROM users WHERE organization_id = v_org_id AND role = 'user');
  RAISE NOTICE 'Test Agents: %', (SELECT COUNT(*) FROM users WHERE organization_id = v_org_id AND role = 'agent');
  RAISE NOTICE 'Voice Configs: %', (SELECT COUNT(*) FROM voice_configs WHERE organization_id = v_org_id);
  RAISE NOTICE 'Subscriptions: %', (SELECT COUNT(*) FROM subscriptions WHERE organization_id = v_org_id);
  RAISE NOTICE 'Provisioned Number: %', (SELECT provisioned_number FROM organizations WHERE id = v_org_id);
  RAISE NOTICE '============================================================================';

  -- Validation checks
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = v_org_id) THEN
    RAISE EXCEPTION 'FAILED: Organization not created';
  END IF;
  IF (SELECT COUNT(*) FROM users WHERE organization_id = v_org_id AND role = 'user') < 2 THEN
    RAISE EXCEPTION 'FAILED: Insufficient test customers (expected 2)';
  END IF;
  IF (SELECT COUNT(*) FROM users WHERE organization_id = v_org_id AND role = 'agent') < 2 THEN
    RAISE EXCEPTION 'FAILED: Insufficient test agents (expected 2)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voice_configs WHERE organization_id = v_org_id) THEN
    RAISE EXCEPTION 'FAILED: Voice config not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE organization_id = v_org_id) THEN
    RAISE EXCEPTION 'FAILED: Subscription not created';
  END IF;

  RAISE NOTICE 'All validation checks passed ✓';
END $$;

COMMIT;

-- ============================================================================
-- 8. DISPLAY TEST CREDENTIALS
-- ============================================================================
\echo '\n============================================================================'
\echo 'Test Users Created'
\echo '============================================================================'
SELECT 
  u.email,
  u.name,
  u.role,
  u.organization_id
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE o.name = 'Word Is Bond QA Team'
ORDER BY u.role DESC, u.email;

\echo '\n============================================================================'
\echo 'Organization Details'
\echo '============================================================================'
SELECT 
  o.id,
  o.name,
  o.plan,
  o.provisioned_number,
  o.plan_status
FROM organizations o
WHERE o.name = 'Word Is Bond QA Team';

\echo '\n============================================================================'
\echo 'Environment Ready for E2E Testing'
\echo '============================================================================'
