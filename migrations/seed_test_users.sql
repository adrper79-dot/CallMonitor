-- Idempotent SQL seed for test accounts and organization 'testgroup'
BEGIN;

-- Insert users if missing (email has UNIQUE constraint)
INSERT INTO public.users (id, name, email)
SELECT gen_random_uuid(), 'admin01', 'admin01@testgroup.org'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admin01@testgroup.org');

INSERT INTO public.users (id, name, email)
SELECT gen_random_uuid(), 'owner', 'owner@testgroup.org'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'owner@testgroup.org');

INSERT INTO public.users (id, name, email)
SELECT gen_random_uuid(), 'user1', 'user1@testgroup.org'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'user1@testgroup.org');

INSERT INTO public.users (id, name, email)
SELECT gen_random_uuid(), 'user2', 'user2@testgroup.org'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'user2@testgroup.org');

-- Ensure organization exists
DO $$
DECLARE
  org_exists BOOLEAN;
  admin_id_uuid UUID;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.organizations WHERE name = 'testgroup') INTO org_exists;
  IF NOT org_exists THEN
    SELECT id::uuid INTO admin_id_uuid FROM public.users WHERE email = 'admin01@testgroup.org' LIMIT 1;
    INSERT INTO public.organizations (id, name, created_by)
    VALUES (gen_random_uuid(), 'testgroup', admin_id_uuid);
  END IF;
END
$$;

-- Add org_members if missing (use SELECT to avoid needing a unique index)
INSERT INTO public.org_members (organization_id, user_id, role)
SELECT o.id, u.id::uuid, 'owner'
FROM public.organizations o, public.users u
WHERE o.name = 'testgroup' AND u.email = 'owner@testgroup.org'
  AND NOT EXISTS (
    SELECT 1 FROM public.org_members om WHERE om.organization_id = o.id AND om.user_id = u.id::uuid
  );

INSERT INTO public.org_members (organization_id, user_id, role)
SELECT o.id, u.id::uuid, 'member'
FROM public.organizations o, public.users u
WHERE o.name = 'testgroup' AND u.email = 'user1@testgroup.org'
  AND NOT EXISTS (
    SELECT 1 FROM public.org_members om WHERE om.organization_id = o.id AND om.user_id = u.id::uuid
  );

INSERT INTO public.org_members (organization_id, user_id, role)
SELECT o.id, u.id::uuid, 'member'
FROM public.organizations o, public.users u
WHERE o.name = 'testgroup' AND u.email = 'user2@testgroup.org'
  AND NOT EXISTS (
    SELECT 1 FROM public.org_members om WHERE om.organization_id = o.id AND om.user_id = u.id::uuid
  );

INSERT INTO public.org_members (organization_id, user_id, role)
SELECT o.id, u.id::uuid, 'admin'
FROM public.organizations o, public.users u
WHERE o.name = 'testgroup' AND u.email = 'admin01@testgroup.org'
  AND NOT EXISTS (
    SELECT 1 FROM public.org_members om WHERE om.organization_id = o.id AND om.user_id = u.id::uuid
  );

-- Add tool_team_members entries (avoid conflict by checking existence)
INSERT INTO public.tool_team_members (id, organization_id, user_id, tool, role, invited_by)
SELECT gen_random_uuid(), o.id, u.id::uuid, 'callmonitor', 'admin', a.id::uuid
FROM public.organizations o
JOIN public.users u ON u.email = 'owner@testgroup.org'
JOIN public.users a ON a.email = 'admin01@testgroup.org'
WHERE o.name = 'testgroup'
  AND NOT EXISTS (
    SELECT 1 FROM public.tool_team_members ttm WHERE ttm.organization_id = o.id AND ttm.user_id = u.id::uuid AND ttm.tool = 'callmonitor'
  );

INSERT INTO public.tool_team_members (id, organization_id, user_id, tool, role, invited_by)
SELECT gen_random_uuid(), o.id, u.id::uuid, 'callmonitor', 'editor', a.id::uuid
FROM public.organizations o
JOIN public.users u ON u.email IN ('user1@testgroup.org','user2@testgroup.org')
JOIN public.users a ON a.email = 'admin01@testgroup.org'
WHERE o.name = 'testgroup'
  AND NOT EXISTS (
    SELECT 1 FROM public.tool_team_members ttm WHERE ttm.organization_id = o.id AND ttm.user_id = u.id::uuid AND ttm.tool = 'callmonitor'
  );

COMMIT;

-- Verification output (select rows inserted)
-- SELECT u.id, u.email FROM public.users u WHERE u.email LIKE '%@testgroup.org';
