-- Migration: Add performance indexes
-- Run with: psql "$DATABASE_URL" -f migrations/2026-01-13-add-indexes.sql

-- Calls table indexes
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON public.calls(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_org_started ON public.calls(organization_id, started_at DESC) WHERE started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON public.calls(call_sid) WHERE call_sid IS NOT NULL;

-- Recordings table indexes
CREATE INDEX IF NOT EXISTS idx_recordings_call_sid ON public.recordings(call_sid);
CREATE INDEX IF NOT EXISTS idx_recordings_org_status ON public.recordings(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_recordings_org_created ON public.recordings(organization_id, created_at DESC);

-- AI runs table indexes
CREATE INDEX IF NOT EXISTS idx_ai_runs_call_id ON public.ai_runs(call_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON public.ai_runs(status) WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_ai_runs_model ON public.ai_runs(model, status);

-- Evidence manifests indexes
CREATE INDEX IF NOT EXISTS idx_evidence_manifests_recording ON public.evidence_manifests(recording_id);
CREATE INDEX IF NOT EXISTS idx_evidence_manifests_org ON public.evidence_manifests(organization_id, created_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action ON public.audit_logs(organization_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Org members indexes (for RBAC lookups)
CREATE INDEX IF NOT EXISTS idx_org_members_user_org ON public.org_members(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON public.org_members(organization_id, role);
