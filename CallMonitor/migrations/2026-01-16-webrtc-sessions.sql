-- Migration: WebRTC Sessions Table
-- Date: 2026-01-16
-- Purpose: Ensure webrtc_sessions table exists for browser-based calling
-- Reference: ARCH_DOCS/01-CORE - SignalWire-first execution

BEGIN;

-- =============================================================================
-- WEBRTC_SESSIONS TABLE
-- Purpose: Track browser-based calling sessions via SignalWire WebRTC
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.webrtc_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  call_id uuid REFERENCES public.calls(id),
  
  -- Session identification
  session_token text NOT NULL UNIQUE,
  signalwire_resource_id text,
  
  -- Connection state
  status text NOT NULL DEFAULT 'initializing' CHECK (status IN (
    'initializing',
    'connecting', 
    'connected',
    'on_call',
    'disconnected',
    'failed'
  )),
  
  -- ICE/SDP info (for debugging and quality monitoring)
  ice_servers jsonb,
  local_sdp text,
  remote_sdp text,
  
  -- Call quality metrics
  audio_bitrate integer,
  packet_loss_percent numeric(5,2),
  jitter_ms integer,
  round_trip_time_ms integer,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  connected_at timestamptz,
  disconnected_at timestamptz,
  
  -- Client info (for security/debugging)
  user_agent text,
  ip_address text
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Find active sessions by user
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_user_status
  ON public.webrtc_sessions (user_id, status)
  WHERE status IN ('initializing', 'connecting', 'connected', 'on_call');

-- Find sessions by organization
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_org
  ON public.webrtc_sessions (organization_id, created_at DESC);

-- Find session by token
CREATE INDEX IF NOT EXISTS idx_webrtc_sessions_token
  ON public.webrtc_sessions (session_token);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.webrtc_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
DROP POLICY IF EXISTS "webrtc_sessions_select_own" ON public.webrtc_sessions;
CREATE POLICY "webrtc_sessions_select_own"
  ON public.webrtc_sessions FOR SELECT
  USING (auth.user_equals_auth(user_id::text));

-- Admins can view all sessions in their org
DROP POLICY IF EXISTS "webrtc_sessions_select_org_admin" ON public.webrtc_sessions;
CREATE POLICY "webrtc_sessions_select_org_admin"
  ON public.webrtc_sessions FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.org_members om
      WHERE auth.user_equals_auth(om.user_id::text) AND om.role IN ('owner', 'admin')
    )
  );

-- Users can create their own sessions
DROP POLICY IF EXISTS "webrtc_sessions_insert_own" ON public.webrtc_sessions;
CREATE POLICY "webrtc_sessions_insert_own"
  ON public.webrtc_sessions FOR INSERT
  WITH CHECK (auth.user_equals_auth(user_id::text));

-- Users can update their own sessions
DROP POLICY IF EXISTS "webrtc_sessions_update_own" ON public.webrtc_sessions;
CREATE POLICY "webrtc_sessions_update_own"
  ON public.webrtc_sessions FOR UPDATE
  USING (auth.user_equals_auth(user_id::text));

-- =============================================================================
-- FUNCTION: Auto-cleanup stale sessions
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_stale_webrtc_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark sessions as disconnected if they've been active for > 4 hours
  -- (calls shouldn't last that long, likely orphaned)
  UPDATE public.webrtc_sessions
  SET 
    status = 'disconnected',
    disconnected_at = now()
  WHERE 
    status IN ('initializing', 'connecting', 'connected', 'on_call')
    AND created_at < now() - interval '4 hours';
    
  -- Delete sessions older than 30 days
  DELETE FROM public.webrtc_sessions
  WHERE created_at < now() - interval '30 days';
END;
$$;

-- =============================================================================
-- COMMENT
-- =============================================================================

COMMENT ON TABLE public.webrtc_sessions IS 
  'Tracks browser-based WebRTC calling sessions. Per ARCH_DOCS: SignalWire-first execution.';

COMMIT;

