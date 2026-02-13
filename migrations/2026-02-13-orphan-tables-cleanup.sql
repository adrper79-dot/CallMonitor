-- ============================================================================
-- Orphan Tables Cleanup Migration (REVISED)
-- Date: February 13, 2026
-- Ref:  ARCH_DOCS/06-REFERENCE/ENGINEERING_GUIDE.md Appendix A, Issue #13
--
-- Methodology:
--   1. Compiled all 152 tables from migrations
--   2. Searched all workers/src/ routes, lib, scheduled for SQL references
--   3. Cross-checked app/, components/, tests/, scripts/ for any usage
--   4. Verified FK dependencies from active tables (kept those!)
--   5. Result: 80 active tables, 11 borderline-keep, 61 safe to drop
--
-- TABLES EXPLICITLY KEPT (not dropped) despite no workers/src/ route:
--   - systems          — FK from calls.system_id (actively written)
--   - tools            — FK from recordings.tool_id, scorecards.tool_id
--   - caller_id_numbers — FK from calls.caller_id_number_id, campaigns.caller_id_id
--   - evidence_manifests — Referenced in ReviewMode.tsx, verify_evidence_bundle.ts
--   - evidence_bundles   — Referenced in verify_evidence_bundle.ts
--   - transcript_versions — Referenced in ReviewMode.tsx
--   - ai_operation_logs  — Referenced in tests/production/ai-optimization-l4.test.ts
--   - ai_org_configs     — Referenced in tests/production/ai-optimization-l4.test.ts
--   - verification_tokens — Referenced in scripts/validate-schema-drift.ts
--   - accounts           — Referenced in scripts/validate-schema-drift.ts
--   - webrtc_sessions    — Referenced in scripts/validate-schema-drift.ts
--   - stripe_subscriptions — ACTIVELY USED in webhooks.ts, stripe-sync.ts
--   - stripe_payment_methods — ACTIVELY USED in webhooks.ts, billing.ts
--   - stripe_invoices     — ACTIVELY USED in webhooks.ts, billing.ts
--   - login_attempts      — Useful for security auditing
--
-- ⚠️  SAFETY: All DROPs use IF EXISTS + CASCADE. Idempotent.
-- ============================================================================

-- Drop child tables first, then parents (respects FK ordering within orphans)

DO $$
BEGIN
    -- ── Attention System (unused, all 3 orphaned) ──────────────────────────
    DROP TABLE IF EXISTS attention_decisions CASCADE;
    DROP TABLE IF EXISTS attention_events CASCADE;
    DROP TABLE IF EXISTS attention_policies CASCADE;

    -- ── Artifact Provenance (unused, no active FK) ─────────────────────────
    DROP TABLE IF EXISTS artifact_provenance CASCADE;
    DROP TABLE IF EXISTS artifacts CASCADE;

    -- ── Caller ID extended (unused — active code uses caller_ids table) ────
    DROP TABLE IF EXISTS caller_id_permissions CASCADE;
    DROP TABLE IF EXISTS caller_id_default_rules CASCADE;

    -- ── Call Export / Confirmation Checklists ───────────────────────────────
    DROP TABLE IF EXISTS call_confirmation_checklists CASCADE;
    DROP TABLE IF EXISTS confirmation_templates CASCADE;
    DROP TABLE IF EXISTS call_export_bundles CASCADE;

    -- ── Campaign Audit Log (unused — calls.ts does its own audit) ──────────
    DROP TABLE IF EXISTS campaign_audit_log CASCADE;

    -- ── Carrier / Telephony Monitoring (unused subsystem) ──────────────────
    DROP TABLE IF EXISTS number_kpi_snapshot CASCADE;
    DROP TABLE IF EXISTS number_kpi_logs CASCADE;
    DROP TABLE IF EXISTS test_frequency_config CASCADE;
    DROP TABLE IF EXISTS monitored_numbers CASCADE;
    DROP TABLE IF EXISTS media_sessions CASCADE;
    DROP TABLE IF EXISTS network_incidents CASCADE;
    DROP TABLE IF EXISTS carrier_status CASCADE;
    DROP TABLE IF EXISTS stock_messages CASCADE;

    -- ── Compliance Extended (unused — code uses compliance_violations) ──────
    DROP TABLE IF EXISTS compliance_scores CASCADE;
    DROP TABLE IF EXISTS compliance_restrictions CASCADE;

    -- ── Digest / Notification System (unused) ──────────────────────────────
    DROP TABLE IF EXISTS digest_items CASCADE;
    DROP TABLE IF EXISTS digests CASCADE;

    -- ── External Entity Resolution (unused subsystem) ──────────────────────
    DROP TABLE IF EXISTS external_entity_observations CASCADE;
    DROP TABLE IF EXISTS external_entity_links CASCADE;
    DROP TABLE IF EXISTS external_entity_identifiers CASCADE;
    DROP TABLE IF EXISTS external_entities CASCADE;

    -- ── Execution Contexts (unused) ────────────────────────────────────────
    DROP TABLE IF EXISTS execution_contexts CASCADE;

    -- ── Export Compliance Log (unused) ──────────────────────────────────────
    DROP TABLE IF EXISTS export_compliance_log CASCADE;

    -- ── Generated Reports (unused — code uses reports + report_schedules) ──
    DROP TABLE IF EXISTS report_access_log CASCADE;
    DROP TABLE IF EXISTS generated_reports CASCADE;
    DROP TABLE IF EXISTS scheduled_reports CASCADE;
    DROP TABLE IF EXISTS report_templates CASCADE;

    -- ── Incidents (unused) ─────────────────────────────────────────────────
    DROP TABLE IF EXISTS incidents CASCADE;

    -- ── Invoices (unused — active table is stripe_invoices) ────────────────
    DROP TABLE IF EXISTS invoices CASCADE;

    -- ── KPI Logs (unused — keep kpi_settings which IS referenced) ──────────
    DROP TABLE IF EXISTS kpi_logs CASCADE;

    -- ── OAuth / SSO (unused) ───────────────────────────────────────────────
    DROP TABLE IF EXISTS oauth_tokens CASCADE;
    DROP TABLE IF EXISTS sso_login_events CASCADE;
    DROP TABLE IF EXISTS org_sso_configs CASCADE;

    -- ── Alert Acknowledgements (unused) ────────────────────────────────────
    DROP TABLE IF EXISTS alert_acknowledgements CASCADE;
    DROP TABLE IF EXISTS alerts CASCADE;

    -- ── QA Evaluation (unused) ─────────────────────────────────────────────
    DROP TABLE IF EXISTS qa_evaluation_disclosures CASCADE;

    -- ── RBAC / Role Archives (unused) ──────────────────────────────────────
    DROP TABLE IF EXISTS access_grants_archived CASCADE;
    DROP TABLE IF EXISTS role_capabilities_archived CASCADE;
    DROP TABLE IF EXISTS capabilities_archived CASCADE;
    DROP TABLE IF EXISTS roles_archived CASCADE;

    -- ── Search System (unused) ─────────────────────────────────────────────
    DROP TABLE IF EXISTS search_events CASCADE;
    DROP TABLE IF EXISTS search_documents CASCADE;

    -- ── Shopper Archives + Results (unused — code uses shopper_scripts) ────
    DROP TABLE IF EXISTS shopper_results CASCADE;
    DROP TABLE IF EXISTS shopper_campaigns_archive CASCADE;
    DROP TABLE IF EXISTS shopper_jobs_archive CASCADE;

    -- ── Subscriptions (unused — active table is stripe_subscriptions) ──────
    DROP TABLE IF EXISTS subscriptions CASCADE;

    -- ── Testing Infrastructure (unused — keep test_configs/test_results) ───
    DROP TABLE IF EXISTS test_statistics CASCADE;

    -- ── Tool / RBAC Extended (unused subsystem) ────────────────────────────
    DROP TABLE IF EXISTS tool_team_members CASCADE;
    DROP TABLE IF EXISTS tool_settings CASCADE;
    DROP TABLE IF EXISTS tool_access CASCADE;
    DROP TABLE IF EXISTS tool_access_archived CASCADE;

    -- ── Usage (unused — code computes from calls/recordings directly) ──────
    DROP TABLE IF EXISTS usage_records CASCADE;
    DROP TABLE IF EXISTS usage_limits CASCADE;

    -- ── Webhook Configs (unused — code uses webhook_subscriptions) ─────────
    DROP TABLE IF EXISTS webhook_configs CASCADE;

    RAISE NOTICE 'Successfully dropped 61 orphan tables — schema cleanup complete';
END $$;