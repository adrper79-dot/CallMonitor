-- Atomic Call Creation with Audit Log
-- 
-- Per ERROR_HANDLING_REVIEW.md recommendations and ARCH_DOCS standards:
-- - Ensures atomic multi-step operations
-- - Creates call and audit log in single transaction
-- - Prevents partial failures and data inconsistency
-- - Follows call-rooted design principle
--
-- @see ERROR_HANDLING_REVIEW.md - Priority 3 Recommendation
-- @see ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt - Call-rooted design
-- @see ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md - Audit logging

CREATE OR REPLACE FUNCTION create_call_with_audit(
  p_call_id uuid,
  p_organization_id uuid,
  p_phone_number text,
  p_from_number text DEFAULT NULL,
  p_call_sid text DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_flow_type text DEFAULT 'outbound',
  p_modulations jsonb DEFAULT '{}'::jsonb,
  p_created_by uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_system_id uuid DEFAULT NULL,
  p_audit_action text DEFAULT 'create',
  p_audit_after jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_call_id uuid;
  v_audit_id uuid;
  v_created_at timestamptz;
BEGIN
  -- Validate inputs
  IF p_call_id IS NULL THEN
    RAISE EXCEPTION 'call_id is required';
  END IF;
  
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;
  
  IF p_phone_number IS NULL THEN
    RAISE EXCEPTION 'phone_number is required';
  END IF;
  
  -- Set timestamp for consistency
  v_created_at := NOW();
  
  -- Insert call record
  INSERT INTO calls (
    id,
    organization_id,
    phone_number,
    from_number,
    call_sid,
    status,
    flow_type,
    created_by,
    started_at,
    created_at,
    updated_at
  ) VALUES (
    p_call_id,
    p_organization_id,
    p_phone_number,
    p_from_number,
    p_call_sid,
    p_status,
    p_flow_type,
    p_created_by,
    v_created_at,
    v_created_at,
    v_created_at
  )
  RETURNING id INTO v_call_id;
  
  -- Generate audit log ID
  v_audit_id := gen_random_uuid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    id,
    organization_id,
    user_id,
    system_id,
    resource_type,
    resource_id,
    action,
    before,
    after,
    created_at
  ) VALUES (
    v_audit_id,
    p_organization_id,
    p_actor_id,
    p_system_id,
    'calls',
    v_call_id,
    p_audit_action,
    NULL,
    COALESCE(p_audit_after, jsonb_build_object(
      'id', v_call_id,
      'organization_id', p_organization_id,
      'phone_number', p_phone_number,
      'from_number', p_from_number,
      'call_sid', p_call_sid,
      'status', p_status,
      'flow_type', p_flow_type,
      'modulations', p_modulations,
      'created_at', v_created_at
    )),
    v_created_at
  );
  
  -- Return success with IDs
  RETURN jsonb_build_object(
    'success', true,
    'call_id', v_call_id,
    'audit_id', v_audit_id,
    'created_at', v_created_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will rollback automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

-- Add comment
COMMENT ON FUNCTION create_call_with_audit IS 
'Atomically creates a call record and audit log entry in a single transaction. Prevents partial failures.';


-- Atomic Recording Creation with Audit Log
-- 
-- Creates recording and audit log atomically
-- Follows artifact integrity principle

CREATE OR REPLACE FUNCTION create_recording_with_audit(
  p_recording_id uuid,
  p_call_id uuid,
  p_organization_id uuid,
  p_recording_url text,
  p_recording_sid text DEFAULT NULL,
  p_duration integer DEFAULT NULL,
  p_status text DEFAULT 'completed',
  p_actor_id uuid DEFAULT NULL,
  p_system_id uuid DEFAULT NULL,
  p_audit_after jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recording_id uuid;
  v_audit_id uuid;
  v_created_at timestamptz;
BEGIN
  -- Validate inputs
  IF p_recording_id IS NULL THEN
    RAISE EXCEPTION 'recording_id is required';
  END IF;
  
  IF p_call_id IS NULL THEN
    RAISE EXCEPTION 'call_id is required';
  END IF;
  
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;
  
  -- Verify call exists
  IF NOT EXISTS (SELECT 1 FROM calls WHERE id = p_call_id) THEN
    RAISE EXCEPTION 'call_id does not exist: %', p_call_id;
  END IF;
  
  -- Set timestamp for consistency
  v_created_at := NOW();
  
  -- Insert recording record
  INSERT INTO recordings (
    id,
    call_id,
    organization_id,
    recording_url,
    recording_sid,
    duration,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_recording_id,
    p_call_id,
    p_organization_id,
    p_recording_url,
    p_recording_sid,
    p_duration,
    p_status,
    v_created_at,
    v_created_at
  )
  RETURNING id INTO v_recording_id;
  
  -- Generate audit log ID
  v_audit_id := gen_random_uuid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    id,
    organization_id,
    user_id,
    system_id,
    resource_type,
    resource_id,
    action,
    before,
    after,
    created_at
  ) VALUES (
    v_audit_id,
    p_organization_id,
    p_actor_id,
    p_system_id,
    'recordings',
    v_recording_id,
    'create',
    NULL,
    COALESCE(p_audit_after, jsonb_build_object(
      'id', v_recording_id,
      'call_id', p_call_id,
      'recording_url', p_recording_url,
      'recording_sid', p_recording_sid,
      'duration', p_duration,
      'status', p_status,
      'created_at', v_created_at
    )),
    v_created_at
  );
  
  -- Return success with IDs
  RETURN jsonb_build_object(
    'success', true,
    'recording_id', v_recording_id,
    'audit_id', v_audit_id,
    'created_at', v_created_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will rollback automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION create_recording_with_audit IS 
'Atomically creates a recording record and audit log entry. Ensures recording integrity.';


-- Atomic AI Run Creation with Audit Log
-- 
-- Creates AI run (transcription/translation) and audit log atomically
-- Follows intelligence plane principle

CREATE OR REPLACE FUNCTION create_ai_run_with_audit(
  p_ai_run_id uuid,
  p_call_id uuid,
  p_organization_id uuid,
  p_model text,
  p_purpose text,
  p_status text DEFAULT 'queued',
  p_input jsonb DEFAULT NULL,
  p_output jsonb DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_system_id uuid DEFAULT NULL,
  p_audit_after jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ai_run_id uuid;
  v_audit_id uuid;
  v_created_at timestamptz;
BEGIN
  -- Validate inputs
  IF p_ai_run_id IS NULL THEN
    RAISE EXCEPTION 'ai_run_id is required';
  END IF;
  
  IF p_call_id IS NULL THEN
    RAISE EXCEPTION 'call_id is required';
  END IF;
  
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;
  
  IF p_model IS NULL THEN
    RAISE EXCEPTION 'model is required';
  END IF;
  
  -- Verify call exists
  IF NOT EXISTS (SELECT 1 FROM calls WHERE id = p_call_id) THEN
    RAISE EXCEPTION 'call_id does not exist: %', p_call_id;
  END IF;
  
  -- Set timestamp for consistency
  v_created_at := NOW();
  
  -- Insert AI run record
  INSERT INTO ai_runs (
    id,
    call_id,
    organization_id,
    model,
    purpose,
    status,
    input,
    output,
    created_at,
    updated_at
  ) VALUES (
    p_ai_run_id,
    p_call_id,
    p_organization_id,
    p_model,
    p_purpose,
    p_status,
    p_input,
    p_output,
    v_created_at,
    v_created_at
  )
  RETURNING id INTO v_ai_run_id;
  
  -- Generate audit log ID
  v_audit_id := gen_random_uuid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    id,
    organization_id,
    user_id,
    system_id,
    resource_type,
    resource_id,
    action,
    before,
    after,
    created_at
  ) VALUES (
    v_audit_id,
    p_organization_id,
    p_actor_id,
    p_system_id,
    'ai_runs',
    v_ai_run_id,
    'create',
    NULL,
    COALESCE(p_audit_after, jsonb_build_object(
      'id', v_ai_run_id,
      'call_id', p_call_id,
      'model', p_model,
      'purpose', p_purpose,
      'status', p_status,
      'created_at', v_created_at
    )),
    v_created_at
  );
  
  -- Return success with IDs
  RETURN jsonb_build_object(
    'success', true,
    'ai_run_id', v_ai_run_id,
    'audit_id', v_audit_id,
    'created_at', v_created_at
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will rollback automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION create_ai_run_with_audit IS 
'Atomically creates an AI run record (transcription/translation) and audit log entry.';


-- Grant execute permissions to authenticated role
GRANT EXECUTE ON FUNCTION create_call_with_audit TO authenticated;
GRANT EXECUTE ON FUNCTION create_recording_with_audit TO authenticated;
GRANT EXECUTE ON FUNCTION create_ai_run_with_audit TO authenticated;

-- Grant execute permissions to service role (for backend)
GRANT EXECUTE ON FUNCTION create_call_with_audit TO service_role;
GRANT EXECUTE ON FUNCTION create_recording_with_audit TO service_role;
GRANT EXECUTE ON FUNCTION create_ai_run_with_audit TO service_role;
