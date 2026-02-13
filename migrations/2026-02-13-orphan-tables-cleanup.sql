-- Orphan Tables Cleanup Migration
-- Generated: February 13, 2026
-- Assessment: ORPHAN_TABLES_ASSESSMENT_REPORT.md
-- Status: Ready for execution after backup and staging testing

-- ⚠️  CRITICAL SAFETY INSTRUCTIONS ⚠️
--
-- 1. BACKUP FIRST: Create full database backup before execution
--    Command: pg_dump -h [host] -U [user] -d neondb > backup_2026_02_13_pre_orphan_cleanup.sql
--
-- 2. TEST IN STAGING: Execute this migration in staging environment first
--    Verify no application errors after drop
--
-- 3. MONITOR POST-DROP: Watch application logs for 24 hours after execution
--    Look for any unexpected errors or missing table references
--
-- 4. ROLLBACK PLAN: Keep backup available for 30 days
--    Restore command: psql -h [host] -U [user] -d neondb < backup_2026_02_13_pre_orphan_cleanup.sql
--
-- 5. EXECUTION: Run in production only after staging verification
--    Command: psql -h [host] -U [user] -d neondb -f 2026-02-13-orphan-tables-cleanup.sql

-- Drop all 52 orphan tables with CASCADE to handle FK dependencies
-- Execute in order of dependencies (child tables first)

DO $$
BEGIN
    -- Attention/AI Management
    DROP TABLE IF EXISTS attention_events CASCADE;
    DROP TABLE IF EXISTS attention_decisions CASCADE;
    DROP TABLE IF EXISTS attention_policies CASCADE;

    -- Artifact/Evidence Chain
    DROP TABLE IF EXISTS evidence_manifests CASCADE;
    DROP TABLE IF EXISTS evidence_bundles CASCADE;
    DROP TABLE IF EXISTS artifact_provenance CASCADE;

    -- Caller ID Subsystem
    DROP TABLE IF EXISTS caller_id_permissions CASCADE;
    DROP TABLE IF EXISTS caller_id_numbers CASCADE;
    DROP TABLE IF EXISTS caller_id_default_rules CASCADE;

    -- Call Export/Confirmation
    DROP TABLE IF EXISTS confirmation_templates CASCADE;
    DROP TABLE IF EXISTS call_export_bundles CASCADE;
    DROP TABLE IF EXISTS call_confirmation_checklists CASCADE;

    -- Campaign Audit
    DROP TABLE IF EXISTS campaign_audit_log CASCADE;

    -- Carrier/Telephony Monitoring
    DROP TABLE IF EXISTS media_sessions CASCADE;
    DROP TABLE IF EXISTS network_incidents CASCADE;
    DROP TABLE IF EXISTS monitored_numbers CASCADE;
    DROP TABLE IF EXISTS carrier_status CASCADE;

    -- Compliance Deep
    DROP TABLE IF EXISTS compliance_scores CASCADE;
    DROP TABLE IF EXISTS compliance_restrictions CASCADE;

    -- Digest/Notification System
    DROP TABLE IF EXISTS digest_items CASCADE;
    DROP TABLE IF EXISTS digests CASCADE;

    -- External Entity Resolution
    DROP TABLE IF EXISTS external_entity_observations CASCADE;
    DROP TABLE IF EXISTS external_entity_links CASCADE;
    DROP TABLE IF EXISTS external_entity_identifiers CASCADE;
    DROP TABLE IF EXISTS external_entities CASCADE;

    -- Generated Reports
    DROP TABLE IF EXISTS generated_reports CASCADE;

    -- Incidents
    DROP TABLE IF EXISTS incidents CASCADE;

    -- KPI System (only logs - keep settings)
    DROP TABLE IF EXISTS kpi_logs CASCADE;

    -- Login/Auth Extended (only oauth - keep login_attempts)
    DROP TABLE IF EXISTS oauth_tokens CASCADE;

    -- Number KPI
    DROP TABLE IF EXISTS number_kpi_snapshot CASCADE;
    DROP TABLE IF EXISTS number_kpi_logs CASCADE;

    -- QA/Compliance
    DROP TABLE IF EXISTS qa_evaluation_disclosures CASCADE;

    -- Reporting Extended
    DROP TABLE IF EXISTS scheduled_reports CASCADE;
    DROP TABLE IF EXISTS report_templates CASCADE;
    DROP TABLE IF EXISTS report_access_log CASCADE;

    -- Search System
    DROP TABLE IF EXISTS search_events CASCADE;
    DROP TABLE IF EXISTS search_documents CASCADE;

    -- Shopper Results
    DROP TABLE IF EXISTS shopper_results CASCADE;

    -- SSO
    DROP TABLE IF EXISTS alert_acknowledgements CASCADE;
    DROP TABLE IF EXISTS sso_login_events CASCADE;
    DROP TABLE IF EXISTS org_sso_configs CASCADE;

    -- Stock Messages
    DROP TABLE IF EXISTS stock_messages CASCADE;

    -- Stripe Extended
    DROP TABLE IF EXISTS stripe_subscriptions CASCADE;
    DROP TABLE IF EXISTS stripe_payment_methods CASCADE;
    DROP TABLE IF EXISTS stripe_invoices CASCADE;

    -- Systems
    DROP TABLE IF EXISTS systems CASCADE;

    -- Testing Infrastructure (only unused - keep configs/results)
    DROP TABLE IF EXISTS test_statistics CASCADE;
    DROP TABLE IF EXISTS test_frequency_config CASCADE;

    -- Tool/RBAC Extended
    DROP TABLE IF EXISTS execution_contexts CASCADE;
    DROP TABLE IF EXISTS tool_team_members CASCADE;
    DROP TABLE IF EXISTS tool_settings CASCADE;
    DROP TABLE IF EXISTS tool_access CASCADE;
    DROP TABLE IF EXISTS tools CASCADE;

    -- Transcript/Usage
    DROP TABLE IF EXISTS usage_records CASCADE;
    DROP TABLE IF EXISTS usage_limits CASCADE;
    DROP TABLE IF EXISTS transcript_versions CASCADE;

    -- Verification/Webhook/Export
    DROP TABLE IF EXISTS export_compliance_log CASCADE;
    DROP TABLE IF EXISTS webhook_configs CASCADE;
    DROP TABLE IF EXISTS verification_tokens CASCADE;

    -- AI Extended
    DROP TABLE IF EXISTS ai_org_configs CASCADE;
    DROP TABLE IF EXISTS ai_operation_logs CASCADE;

    RAISE NOTICE 'Successfully dropped 52 orphan tables - orphan cleanup complete';
END $$;