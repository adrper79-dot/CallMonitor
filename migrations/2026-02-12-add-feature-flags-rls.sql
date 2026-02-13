-- Add RLS policies for feature flags tables
-- Global feature flags: accessible to admins only
-- Org feature flags: org-scoped

-- Enable RLS on global_feature_flags
ALTER TABLE public.global_feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy for global feature flags: only admins can access
CREATE POLICY admin_access_global_feature_flags ON public.global_feature_flags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = current_setting('app.current_user_id', true)::uuid
      AND om.organization_id = current_setting('app.current_org_id', true)::uuid
      AND om.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = current_setting('app.current_user_id', true)::uuid
      AND om.organization_id = current_setting('app.current_org_id', true)::uuid
      AND om.role IN ('admin', 'owner')
    )
  );

-- Enable RLS on org_feature_flags
ALTER TABLE public.org_feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy for org feature flags: org isolation
CREATE POLICY org_isolation_org_feature_flags ON public.org_feature_flags
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);