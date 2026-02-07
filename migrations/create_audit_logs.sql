-- Create audit_logs table for tracking system events
-- Run: psql $NEON_PG_CONN -f migrations/create_audit_logs.sql

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- 'create', 'update', 'delete', 'view', 'login', etc.
  resource_type TEXT,    -- 'call', 'organization', 'user', 'recording', etc.
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,        -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON audit_logs TO PUBLIC;

-- Insert sample audit log for testing
INSERT INTO audit_logs (organization_id, user_id, action, resource_type, metadata)
SELECT 
  o.id,
  u.id,
  'system.table_created',
  'audit_logs',
  '{"message": "Audit logs table initialized"}'::jsonb
FROM organizations o
CROSS JOIN users u
WHERE o.name IS NOT NULL AND u.email IS NOT NULL
LIMIT 1
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'audit_logs table created successfully';
END $$;
