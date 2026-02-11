                                      migration_sql                                      
-----------------------------------------------------------------------------------------
 ALTER TABLE access_grants_archived ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE alert_acknowledgements ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE audit_logs ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE bond_ai_conversations ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE booking_events ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE caller_id_default_rules ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE caller_id_permissions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE calls ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE campaign_audit_log ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE compliance_violations ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE dialer_agent_status ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE org_members ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE report_access_log ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE sessions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE sso_login_events ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE team_members ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE tool_access ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE tool_access_archived ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE tool_team_members ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
 ALTER TABLE webrtc_sessions ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
(20 rows)

