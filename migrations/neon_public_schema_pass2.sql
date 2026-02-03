-- pass2: ALTER TABLE / FK / additional DDL
-- Generated Neon-ready schema draft
-- Conservative transformations applied: gen_random_uuid(), USER-DEFINED->text,
-- removed foreign keys referencing auth/next_auth schemas, removed camelCase duplicate columns.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

ALTER TABLE public.access_grants_archived ADD CONSTRAINT access_grants_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.access_grants_archived ADD CONSTRAINT access_grants_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles_archived(id);

ALTER TABLE public.access_grants_archived ADD CONSTRAINT access_grants_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);

ALTER TABLE public.ai_agent_audit_log ADD CONSTRAINT ai_agent_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);

ALTER TABLE public.alerts ADD CONSTRAINT alerts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.alerts ADD CONSTRAINT alerts_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id);

ALTER TABLE public.artifact_provenance ADD CONSTRAINT artifact_provenance_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.artifact_provenance ADD CONSTRAINT artifact_provenance_produced_by_system_id_fkey FOREIGN KEY (produced_by_system_id) REFERENCES public.systems(id);

ALTER TABLE public.attention_decisions ADD CONSTRAINT attention_decisions_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.attention_decisions ADD CONSTRAINT attention_decisions_event_fkey FOREIGN KEY (attention_event_id) REFERENCES public.attention_events(id);

ALTER TABLE public.attention_decisions ADD CONSTRAINT attention_decisions_policy_fkey FOREIGN KEY (policy_id) REFERENCES public.attention_policies(id);

ALTER TABLE public.attention_events ADD CONSTRAINT attention_events_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.attention_policies ADD CONSTRAINT attention_policies_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);

ALTER TABLE public.booking_events ADD CONSTRAINT booking_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.booking_events ADD CONSTRAINT booking_events_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.call_confirmation_checklists ADD CONSTRAINT call_confirmation_checklists_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.call_confirmation_checklists ADD CONSTRAINT call_confirmation_checklists_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.confirmation_templates(id);

ALTER TABLE public.call_confirmation_checklists ADD CONSTRAINT call_confirmation_checklists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.call_confirmation_checklists ADD CONSTRAINT call_confirmation_checklists_confirmation_id_fkey FOREIGN KEY (confirmation_id) REFERENCES public.call_confirmations(id);

ALTER TABLE public.call_confirmations ADD CONSTRAINT call_confirmations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.call_confirmations ADD CONSTRAINT call_confirmations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.call_export_bundles ADD CONSTRAINT call_export_bundles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.call_export_bundles ADD CONSTRAINT call_export_bundles_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.caller_id_default_rules ADD CONSTRAINT caller_id_default_rules_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.caller_id_default_rules ADD CONSTRAINT caller_id_default_rules_caller_id_fkey FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id);

ALTER TABLE public.caller_id_numbers ADD CONSTRAINT caller_id_numbers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.caller_id_permissions ADD CONSTRAINT caller_id_permissions_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.caller_id_permissions ADD CONSTRAINT caller_id_permissions_caller_id_fkey FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id);

ALTER TABLE public.calls ADD CONSTRAINT calls_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.calls ADD CONSTRAINT calls_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);

ALTER TABLE public.calls ADD CONSTRAINT calls_caller_id_number_id_fkey FOREIGN KEY (caller_id_number_id) REFERENCES public.caller_id_numbers(id);

ALTER TABLE public.campaign_audit_log ADD CONSTRAINT campaign_audit_log_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);

ALTER TABLE public.campaign_calls ADD CONSTRAINT campaign_calls_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);

ALTER TABLE public.campaign_calls ADD CONSTRAINT campaign_calls_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_caller_id_id_fkey FOREIGN KEY (caller_id_id) REFERENCES public.caller_id_numbers(id);

ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.shopper_scripts(id);

ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id);

ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.capabilities_archived ADD CONSTRAINT capabilities_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);

ALTER TABLE public.compliance_restrictions ADD CONSTRAINT compliance_restrictions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.compliance_violations ADD CONSTRAINT compliance_violations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.compliance_violations ADD CONSTRAINT compliance_violations_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.confirmation_templates ADD CONSTRAINT confirmation_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.crm_object_links ADD CONSTRAINT crm_object_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.crm_object_links ADD CONSTRAINT crm_object_links_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);

ALTER TABLE public.crm_object_links ADD CONSTRAINT crm_object_links_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.crm_sync_log ADD CONSTRAINT crm_sync_log_export_bundle_id_fkey FOREIGN KEY (export_bundle_id) REFERENCES public.call_export_bundles(id);

ALTER TABLE public.crm_sync_log ADD CONSTRAINT crm_sync_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.crm_sync_log ADD CONSTRAINT crm_sync_log_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);

ALTER TABLE public.crm_sync_log ADD CONSTRAINT crm_sync_log_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.digest_items ADD CONSTRAINT digest_items_digest_fkey FOREIGN KEY (digest_id) REFERENCES public.digests(id);

ALTER TABLE public.digest_items ADD CONSTRAINT digest_items_decision_fkey FOREIGN KEY (attention_decision_id) REFERENCES public.attention_decisions(id);

ALTER TABLE public.digests ADD CONSTRAINT digests_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.disclosure_logs ADD CONSTRAINT disclosure_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.disclosure_logs ADD CONSTRAINT disclosure_logs_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.evidence_bundles ADD CONSTRAINT evidence_bundles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.evidence_bundles ADD CONSTRAINT evidence_bundles_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.evidence_bundles ADD CONSTRAINT evidence_bundles_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id);

ALTER TABLE public.evidence_bundles ADD CONSTRAINT evidence_bundles_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES public.evidence_manifests(id);

ALTER TABLE public.evidence_bundles ADD CONSTRAINT evidence_bundles_parent_bundle_id_fkey FOREIGN KEY (parent_bundle_id) REFERENCES public.evidence_bundles(id);

ALTER TABLE public.evidence_bundles ADD CONSTRAINT evidence_bundles_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.evidence_bundles(id);

ALTER TABLE public.evidence_manifests ADD CONSTRAINT evidence_manifests_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id);

ALTER TABLE public.evidence_manifests ADD CONSTRAINT evidence_manifests_parent_manifest_id_fkey FOREIGN KEY (parent_manifest_id) REFERENCES public.evidence_manifests(id);

ALTER TABLE public.evidence_manifests ADD CONSTRAINT evidence_manifests_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.evidence_manifests(id);

ALTER TABLE public.export_compliance_log ADD CONSTRAINT export_compliance_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.export_compliance_log ADD CONSTRAINT export_compliance_log_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.export_compliance_log ADD CONSTRAINT export_compliance_log_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.evidence_bundles(id);

ALTER TABLE public.external_entities ADD CONSTRAINT external_entities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.external_entity_identifiers ADD CONSTRAINT external_entity_identifiers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.external_entity_identifiers ADD CONSTRAINT external_entity_identifiers_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.external_entities(id);

ALTER TABLE public.external_entity_links ADD CONSTRAINT external_entity_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.external_entity_links ADD CONSTRAINT external_entity_links_source_entity_id_fkey FOREIGN KEY (source_entity_id) REFERENCES public.external_entities(id);

ALTER TABLE public.external_entity_links ADD CONSTRAINT external_entity_links_target_entity_id_fkey FOREIGN KEY (target_entity_id) REFERENCES public.external_entities(id);

ALTER TABLE public.external_entity_links ADD CONSTRAINT external_entity_links_identifier_id_fkey FOREIGN KEY (identifier_id) REFERENCES public.external_entity_identifiers(id);

ALTER TABLE public.external_entity_observations ADD CONSTRAINT external_entity_observations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.external_entity_observations ADD CONSTRAINT external_entity_observations_identifier_id_fkey FOREIGN KEY (identifier_id) REFERENCES public.external_entity_identifiers(id);

ALTER TABLE public.generated_reports ADD CONSTRAINT generated_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id);

ALTER TABLE public.generated_reports ADD CONSTRAINT generated_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.incidents ADD CONSTRAINT incidents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.incidents ADD CONSTRAINT incidents_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.integrations ADD CONSTRAINT integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.invoices ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.kpi_logs ADD CONSTRAINT kpi_logs_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.test_configs(id);

ALTER TABLE public.kpi_settings ADD CONSTRAINT kpi_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.legal_holds ADD CONSTRAINT legal_holds_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.media_sessions ADD CONSTRAINT media_sessions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.media_sessions ADD CONSTRAINT media_sessions_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);

ALTER TABLE public.monitored_numbers ADD CONSTRAINT monitored_numbers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.monitored_numbers ADD CONSTRAINT monitored_numbers_greeting_message_id_fkey FOREIGN KEY (greeting_message_id) REFERENCES public.stock_messages(id);

ALTER TABLE public.number_kpi_logs ADD CONSTRAINT number_kpi_logs_monitored_number_id_fkey FOREIGN KEY (monitored_number_id) REFERENCES public.monitored_numbers(id);

ALTER TABLE public.number_kpi_logs ADD CONSTRAINT number_kpi_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.number_kpi_snapshot ADD CONSTRAINT number_kpi_snapshot_monitored_number_id_fkey FOREIGN KEY (monitored_number_id) REFERENCES public.monitored_numbers(id);

ALTER TABLE public.number_kpi_snapshot ADD CONSTRAINT number_kpi_snapshot_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.oauth_tokens ADD CONSTRAINT oauth_tokens_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.integrations(id);

ALTER TABLE public.org_members ADD CONSTRAINT org_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.org_sso_configs ADD CONSTRAINT org_sso_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.qa_evaluation_disclosures ADD CONSTRAINT qa_evaluation_disclosures_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.qa_evaluation_disclosures ADD CONSTRAINT qa_evaluation_disclosures_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.recordings ADD CONSTRAINT recordings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.recordings ADD CONSTRAINT recordings_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);

ALTER TABLE public.recordings ADD CONSTRAINT recordings_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.report_access_log ADD CONSTRAINT report_access_log_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.generated_reports(id);

ALTER TABLE public.report_schedules ADD CONSTRAINT report_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.report_schedules ADD CONSTRAINT report_schedules_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id);

ALTER TABLE public.report_templates ADD CONSTRAINT report_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.retention_policies ADD CONSTRAINT retention_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.role_capabilities_archived ADD CONSTRAINT role_capabilities_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles_archived(id);

ALTER TABLE public.role_capabilities_archived ADD CONSTRAINT role_capabilities_capability_id_fkey FOREIGN KEY (capability_id) REFERENCES public.capabilities_archived(id);

ALTER TABLE public.roles_archived ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.scheduled_reports ADD CONSTRAINT scheduled_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id);

ALTER TABLE public.scheduled_reports ADD CONSTRAINT scheduled_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.scorecards ADD CONSTRAINT scorecards_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.scorecards ADD CONSTRAINT scorecards_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);

ALTER TABLE public.scored_recordings ADD CONSTRAINT scored_recordings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.scored_recordings ADD CONSTRAINT scored_recordings_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id);

ALTER TABLE public.scored_recordings ADD CONSTRAINT scored_recordings_scorecard_id_fkey FOREIGN KEY (scorecard_id) REFERENCES public.scorecards(id);

ALTER TABLE public.search_documents ADD CONSTRAINT search_documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.search_documents ADD CONSTRAINT search_documents_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.search_documents(id);

ALTER TABLE public.search_events ADD CONSTRAINT search_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.search_events ADD CONSTRAINT search_events_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.search_documents(id);

ALTER TABLE public.shopper_results ADD CONSTRAINT shopper_results_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.shopper_results ADD CONSTRAINT shopper_results_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);

ALTER TABLE public.shopper_results ADD CONSTRAINT shopper_results_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id);

ALTER TABLE public.shopper_results ADD CONSTRAINT shopper_results_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.shopper_scripts(id);

ALTER TABLE public.shopper_scripts ADD CONSTRAINT shopper_scripts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.sso_login_events ADD CONSTRAINT sso_login_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.sso_login_events ADD CONSTRAINT sso_login_events_sso_config_id_fkey FOREIGN KEY (sso_config_id) REFERENCES public.org_sso_configs(id);

ALTER TABLE public.stripe_events ADD CONSTRAINT stripe_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.stripe_invoices ADD CONSTRAINT stripe_invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.stripe_payment_methods ADD CONSTRAINT stripe_payment_methods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.stripe_subscriptions ADD CONSTRAINT stripe_subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.surveys ADD CONSTRAINT surveys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.test_configs ADD CONSTRAINT test_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.test_configs ADD CONSTRAINT test_configs_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);

ALTER TABLE public.test_frequency_config ADD CONSTRAINT test_frequency_config_monitored_number_id_fkey FOREIGN KEY (monitored_number_id) REFERENCES public.monitored_numbers(id);

ALTER TABLE public.test_results ADD CONSTRAINT test_results_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id);

ALTER TABLE public.test_results ADD CONSTRAINT test_results_tool_id_fkey FOREIGN KEY (tool_id) REFERENCES public.tools(id);

ALTER TABLE public.test_statistics ADD CONSTRAINT test_statistics_test_config_id_fkey FOREIGN KEY (test_config_id) REFERENCES public.test_configs(id);

ALTER TABLE public.test_statistics ADD CONSTRAINT test_statistics_system_id_fkey FOREIGN KEY (system_id) REFERENCES public.systems(id);

ALTER TABLE public.tool_access_archived ADD CONSTRAINT tool_access_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.tool_settings ADD CONSTRAINT tool_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.tool_team_members ADD CONSTRAINT tool_team_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.transcript_versions ADD CONSTRAINT transcript_versions_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES public.recordings(id);

ALTER TABLE public.transcript_versions ADD CONSTRAINT transcript_versions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.usage_limits ADD CONSTRAINT usage_limits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.usage_records ADD CONSTRAINT usage_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.voice_configs ADD CONSTRAINT voice_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.voice_configs ADD CONSTRAINT voice_configs_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.shopper_scripts(id);

ALTER TABLE public.voice_targets ADD CONSTRAINT voice_targets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.webhook_configs ADD CONSTRAINT webhook_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

ALTER TABLE public.webhook_failures ADD CONSTRAINT webhook_failures_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

--
-- Application-level user foreign keys: map original auth/next_auth references
-- to `public.users` in Neon (no Supabase auth schema). Add conservative FKs.
--
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.recordings
  ADD CONSTRAINT recordings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.scorecards
  ADD CONSTRAINT scorecards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.test_configs
  ADD CONSTRAINT test_configs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.test_results
  ADD CONSTRAINT test_results_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.tool_access_archived
  ADD CONSTRAINT tool_access_archived_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE public.tool_team_members
  ADD CONSTRAINT tool_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  ADD CONSTRAINT tool_team_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);

ALTER TABLE public.webrtc_sessions ADD CONSTRAINT webrtc_sessions_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls(id);
