-- Add platform-admin role for god-mode app admin (global, bypass org)

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS platform_role text DEFAULT 'user' 
CHECK (platform_role IN ('user', 'platform-admin'));

-- Create super-admin (replace email with yours)
INSERT INTO public.users (id, email, name, platform_role)
VALUES (
  'god-0000-0000-0000-000000000000',
  'admin@wordis-bond.com',
  'Platform Admin',
  'platform-admin'
) ON CONFLICT (id) DO NOTHING;

-- Super-org for platform
INSERT INTO public.organizations (id, name, plan, created_by)
VALUES (
  'platform-0000-0000-0000-000000000000',
  'Platform',
  'enterprise',
  'god-0000-0000-0000-000000000000'
) ON CONFLICT (id) DO NOTHING;

-- Link
INSERT INTO public.org_members (organization_id, user_id, role)
VALUES (
  'platform-0000-0000-0000-000000000000',
  'god-0000-0000-0000-000000000000',
  'owner'
) ON CONFLICT (organization_id, user_id) DO NOTHING;