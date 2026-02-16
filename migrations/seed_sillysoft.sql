BEGIN;

-- 1. Create SillySoft organization
INSERT INTO organizations (id, name, plan, onboarding_step, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'SillySoft',
  'trial',
  0,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- Store org ID for member inserts
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  -- Get or create the org
  SELECT id INTO v_org_id FROM organizations WHERE name = 'SillySoft' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (id, name, plan, onboarding_step, created_at, updated_at)
    VALUES (gen_random_uuid(), 'SillySoft', 'trial', 0, NOW(), NOW())
    RETURNING id INTO v_org_id;
  END IF;

  -- Create owner user
  INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
  VALUES (gen_random_uuid(), 'owner@sillysoft.test', 'Owner User', 'pbkdf2:120000:20d888ae6d5d1d7f9cf53cdedbbf5652:72734a57727f9a2b3457a9930a47bf16da10918c11358124c472135861f421ff', NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;
  SELECT id INTO v_user_id FROM users WHERE email = 'owner@sillysoft.test';

  INSERT INTO org_members (id, user_id, organization_id, role, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_org_id, 'owner', NOW())
  ON CONFLICT DO NOTHING;

  -- Create admin user
  INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
  VALUES (gen_random_uuid(), 'admin@sillysoft.test', 'Admin User', 'pbkdf2:120000:e88a6c06accce3f91ee3990216a81226:ee529b6fc0df02fa91aca432541d39b0b242a1a8d89386c102905d7bc5824e8f', NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;
  SELECT id INTO v_user_id FROM users WHERE email = 'admin@sillysoft.test';

  INSERT INTO org_members (id, user_id, organization_id, role, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_org_id, 'admin', NOW())
  ON CONFLICT DO NOTHING;

  -- Create manager user
  INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
  VALUES (gen_random_uuid(), 'manager@sillysoft.test', 'Manager User', 'pbkdf2:120000:bfd2c4322650f2ecf6796c7ea012d610:5fc333511022063e9b52c9b76b10d332f792965dce731395e4e360b30f13c2b3', NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;
  SELECT id INTO v_user_id FROM users WHERE email = 'manager@sillysoft.test';

  INSERT INTO org_members (id, user_id, organization_id, role, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_org_id, 'manager', NOW())
  ON CONFLICT DO NOTHING;

  -- Create compliance user
  INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
  VALUES (gen_random_uuid(), 'compliance@sillysoft.test', 'Compliance User', 'pbkdf2:120000:770b535c4cba6ed480a1fa0a4178616e:026de6afd56b6573389c4c8dee32b4556920687da0a5a9b0a428680564f8cf54', NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;
  SELECT id INTO v_user_id FROM users WHERE email = 'compliance@sillysoft.test';

  INSERT INTO org_members (id, user_id, organization_id, role, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_org_id, 'compliance', NOW())
  ON CONFLICT DO NOTHING;

  -- Create agent user
  INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
  VALUES (gen_random_uuid(), 'agent@sillysoft.test', 'Agent User', 'pbkdf2:120000:f5f50e13aa9755f3cdabe410c5f15a41:782554cb2f70cd4c0a34644cd756d23be30e8449790a1013c31e585872b92112', NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;
  SELECT id INTO v_user_id FROM users WHERE email = 'agent@sillysoft.test';

  INSERT INTO org_members (id, user_id, organization_id, role, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_org_id, 'agent', NOW())
  ON CONFLICT DO NOTHING;

  -- Create viewer user
  INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
  VALUES (gen_random_uuid(), 'viewer@sillysoft.test', 'Viewer User', 'pbkdf2:120000:cbe349adf3d823e25469863bd8357a25:ca96e9b06efed4a736ff1d844e2990d0e4f1fa3cb86c756fc4e265333ad0cfcc', NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;
  SELECT id INTO v_user_id FROM users WHERE email = 'viewer@sillysoft.test';

  INSERT INTO org_members (id, user_id, organization_id, role, created_at)
  VALUES (gen_random_uuid(), v_user_id, v_org_id, 'viewer', NOW())
  ON CONFLICT DO NOTHING;

  -- Set org created_by to the owner user
  SELECT id INTO v_user_id FROM users WHERE email = 'owner@sillysoft.test';
  UPDATE organizations SET created_by = v_user_id WHERE id = v_org_id;
END $$;

COMMIT;