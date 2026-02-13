# Database Table Audit — Complete Inventory

> Generated from migration files + route cross-reference analysis
> Sources: `migrations/neon_public_schema_pass1.sql` (canonical), 12+ incremental migrations, 48 route files

---

## Summary

| Metric | Count |
|--------|-------|
| **Total tables (CREATE TABLE found)** | 146 |
| **Tables implied by RLS migration only** | 22 |
| **Grand total (all known)** | 168 |
| **Tables with RLS enabled** | 51 |
| **Actively referenced in routes** | ~64 |
| **Orphan tables (no route reference)** | ~104 |

---

## 1. Complete Numbered Table List

### Legend

- **RLS** = Row-Level Security enabled (✅ yes / ❌ no)
- **Status** = `ACTIVE` (queried in route files) / `ORPHAN` (no route reference found)
- **Routes** = Which route file(s) reference this table in SQL queries

---

### A. Canonical Tables — `neon_public_schema_pass1.sql` (110 tables)

| # | Table | RLS | Status | Route File(s) |
|---|-------|-----|--------|----------------|
| 1 | `access_grants_archived` | ❌ | ORPHAN | — |
| 2 | `accounts` | ❌ | ORPHAN | — (NextAuth OAuth table, not directly queried) |
| 3 | `ai_agent_audit_log` | ❌ | ACTIVE | bond-ai.ts |
| 4 | `ai_runs` | ❌ | ACTIVE | analytics.ts |
| 5 | `alert_acknowledgements` | ❌ | ORPHAN | — |
| 6 | `alerts` | ❌ | ORPHAN | — (see `bond_ai_alerts` & `scorecard_alerts` instead) |
| 7 | `artifact_provenance` | ❌ | ORPHAN | — |
| 8 | `artifacts` | ✅ | ORPHAN | — |
| 9 | `attention_decisions` | ❌ | ORPHAN | — |
| 10 | `attention_events` | ❌ | ORPHAN | — |
| 11 | `attention_policies` | ❌ | ORPHAN | — |
| 12 | `audit_logs` | ❌ | ACTIVE | audit.ts, analytics.ts, test.ts |
| 13 | `booking_events` | ❌ | ACTIVE | bookings.ts |
| 14 | `call_confirmation_checklists` | ❌ | ORPHAN | — |
| 15 | `call_confirmations` | ✅ | ACTIVE | calls.ts |
| 16 | `call_export_bundles` | ❌ | ORPHAN | — |
| 17 | `call_notes` | ❌ | ACTIVE | calls.ts, productivity.ts |
| 18 | `caller_id_default_rules` | ❌ | ACTIVE | caller-id.ts |
| 19 | `caller_id_numbers` | ❌ | ACTIVE | caller-id.ts |
| 20 | `caller_id_permissions` | ❌ | ACTIVE | caller-id.ts |
| 21 | `calls` | ✅ | ACTIVE | calls.ts, webhooks.ts, voice.ts, webrtc.ts, manager.ts, dialer.ts, usage.ts, reports.ts, ai-toggle.ts, ivr.ts, productivity.ts, sentiment.ts, live-translation.ts, test.ts |
| 22 | `campaign_audit_log` | ❌ | ORPHAN | — |
| 23 | `campaign_calls` | ✅ | ACTIVE | dialer.ts, productivity.ts |
| 24 | `campaigns` | ✅ | ACTIVE | dialer.ts |
| 25 | `capabilities_archived` | ❌ | ORPHAN | — |
| 26 | `carrier_status` | ❌ | ORPHAN | — |
| 27 | `compliance_restrictions` | ❌ | ORPHAN | — |
| 28 | `compliance_violations` | ❌ | ACTIVE | compliance.ts |
| 29 | `confirmation_templates` | ❌ | ORPHAN | — |
| 30 | `crm_object_links` | ❌ | ORPHAN | — |
| 31 | `crm_sync_log` | ❌ | ORPHAN | — |
| 32 | `digest_items` | ❌ | ORPHAN | — |
| 33 | `digests` | ❌ | ORPHAN | — |
| 34 | `disclosure_logs` | ❌ | ORPHAN | — (mentioned in webhooks.ts comment only) |
| 35 | `evidence_bundles` | ❌ | ORPHAN | — |
| 36 | `evidence_manifests` | ❌ | ORPHAN | — |
| 37 | `execution_contexts` | ❌ | ORPHAN | — |
| 38 | `export_compliance_log` | ❌ | ORPHAN | — |
| 39 | `external_entities` | ❌ | ORPHAN | — |
| 40 | `external_entity_identifiers` | ❌ | ORPHAN | — |
| 41 | `external_entity_links` | ❌ | ORPHAN | — |
| 42 | `external_entity_observations` | ❌ | ORPHAN | — |
| 43 | `generated_reports` | ❌ | ORPHAN | — |
| 44 | `global_feature_flags` | ❌ | ORPHAN | — |
| 45 | `incidents` | ❌ | ORPHAN | — |
| 46 | `integrations` | ❌ | ORPHAN | — |
| 47 | `invoices` | ❌ | ORPHAN | — (billing.ts /invoices endpoint queries `billing_events`, not this table) |
| 48 | `kpi_logs` | ❌ | ORPHAN | — |
| 49 | `kpi_settings` | ❌ | ORPHAN | — |
| 50 | `legal_holds` | ❌ | ACTIVE | retention.ts |
| 51 | `login_attempts` | ❌ | ORPHAN | — |
| 52 | `media_sessions` | ❌ | ORPHAN | — |
| 53 | `monitored_numbers` | ❌ | ORPHAN | — |
| 54 | `network_incidents` | ❌ | ORPHAN | — |
| 55 | `number_kpi_logs` | ❌ | ORPHAN | — |
| 56 | `number_kpi_snapshot` | ❌ | ORPHAN | — |
| 57 | `oauth_tokens` | ❌ | ORPHAN | — |
| 58 | `org_feature_flags` | ❌ | ORPHAN | — |
| 59 | `org_members` | ✅ | ACTIVE | auth.ts, team.ts, teams.ts, organizations.ts, test.ts |
| 60 | `org_sso_configs` | ❌ | ORPHAN | — |
| 61 | `organizations` | ✅ | ACTIVE | auth.ts, billing.ts, webhooks.ts, organizations.ts, onboarding.ts, rbac-v2.ts, usage.ts, teams.ts, live-translation.ts, call-capabilities.ts, test.ts |
| 62 | `qa_evaluation_disclosures` | ❌ | ORPHAN | — |
| 63 | `recordings` | ✅ | ACTIVE | recordings.ts, calls.ts, usage.ts, webhooks.ts, test.ts |
| 64 | `report_access_log` | ❌ | ORPHAN | — |
| 65 | `report_schedules` | ❌ | ACTIVE | reports.ts |
| 66 | `report_templates` | ❌ | ORPHAN | — |
| 67 | `retention_policies` | ❌ | ACTIVE | retention.ts |
| 68 | `role_capabilities_archived` | ❌ | ORPHAN | — |
| 69 | `roles_archived` | ❌ | ORPHAN | — |
| 70 | `scheduled_reports` | ❌ | ORPHAN | — |
| 71 | `scorecards` | ❌ | ACTIVE | scorecards.ts, test.ts |
| 72 | `scored_recordings` | ❌ | ACTIVE | analytics.ts |
| 73 | `search_documents` | ❌ | ORPHAN | — |
| 74 | `search_events` | ❌ | ORPHAN | — |
| 75 | `sessions` | ❌ | ACTIVE | auth.ts, test.ts, admin-metrics.ts |
| 76 | `shopper_campaigns_archive` | ❌ | ORPHAN | — |
| 77 | `shopper_jobs_archive` | ❌ | ORPHAN | — |
| 78 | `shopper_results` | ❌ | ACTIVE | shopper.ts |
| 79 | `shopper_scripts` | ❌ | ACTIVE | shopper.ts |
| 80 | `sso_login_events` | ❌ | ORPHAN | — |
| 81 | `stock_messages` | ❌ | ORPHAN | — |
| 82 | `stripe_events` | ❌ | ACTIVE | webhooks.ts |
| 83 | `stripe_invoices` | ❌ | ORPHAN | — |
| 84 | `stripe_payment_methods` | ❌ | ORPHAN | — |
| 85 | `stripe_subscriptions` | ❌ | ORPHAN | — |
| 86 | `subscriptions` | ❌ | ORPHAN | — |
| 87 | `surveys` | ✅ | ACTIVE | surveys.ts |
| 88 | `systems` | ❌ | ORPHAN | — |
| 89 | `team_invites` | ✅ | ACTIVE | team.ts |
| 90 | `test_configs` | ❌ | ORPHAN | — |
| 91 | `test_frequency_config` | ❌ | ORPHAN | — |
| 92 | `test_results` | ❌ | ORPHAN | — |
| 93 | `test_statistics` | ❌ | ORPHAN | — |
| 94 | `tool_access` | ✅ | ORPHAN | — |
| 95 | `tool_access_archived` | ❌ | ORPHAN | — |
| 96 | `tool_settings` | ❌ | ORPHAN | — |
| 97 | `tool_team_members` | ❌ | ORPHAN | — |
| 98 | `tools` | ❌ | ORPHAN | — |
| 99 | `transcript_versions` | ❌ | ORPHAN | — |
| 100 | `usage_limits` | ❌ | ORPHAN | — |
| 101 | `usage_records` | ❌ | ORPHAN | — |
| 102 | `users` | ✅ | ACTIVE | auth.ts, team.ts, billing.ts, users.ts, manager.ts, admin-metrics.ts, test.ts |
| 103 | `verification_tokens` | ❌ | ORPHAN | — |
| 104 | `voice_configs` | ✅ | ACTIVE | voice.ts, webhooks.ts, calls.ts, ai-toggle.ts, webrtc.ts, test.ts, internal.ts |
| 105 | `voice_targets` | ❌ | ACTIVE | voice.ts |
| 106 | `webhook_configs` | ❌ | ORPHAN | — |
| 107 | `webhook_deliveries` | ❌ | ACTIVE | webhooks.ts |
| 108 | `webhook_failures` | ❌ | ACTIVE | reliability.ts |
| 109 | `webhook_subscriptions` | ❌ | ACTIVE | webhooks.ts |
| 110 | `webrtc_sessions` | ✅ | ORPHAN | — |

### B. Tables from Incremental Migrations (36 tables)

| # | Table | Migration Source | RLS | Status | Route File(s) |
|---|-------|-----------------|-----|--------|----------------|
| 111 | `caller_ids` | runtime-ddl-consolidation | ❌ | ACTIVE | caller-id.ts |
| 112 | `auth_providers` | runtime-ddl-consolidation | ❌ | ACTIVE | admin.ts |
| 113 | `reports` | runtime-ddl-consolidation | ❌ | ACTIVE | reports.ts |
| 114 | `tts_audio` | runtime-ddl-consolidation | ❌ | ACTIVE | tts.ts, ai-router.ts |
| 115 | `audio_files` | runtime-ddl-consolidation | ❌ | ACTIVE | audio.ts |
| 116 | `transcriptions` | runtime-ddl-consolidation | ❌ | ACTIVE | audio.ts |
| 117 | `ai_configs` | runtime-ddl-consolidation | ❌ | ACTIVE | ai-config.ts |
| 118 | `collection_accounts` | collections-crm | ✅ | ACTIVE | collections.ts, webhooks.ts, ivr.ts, productivity.ts |
| 119 | `collection_payments` | collections-crm | ✅ | ACTIVE | collections.ts, ivr.ts, manager.ts |
| 120 | `collection_tasks` | collections-crm | ✅ | ACTIVE | collections.ts, productivity.ts |
| 121 | `collection_csv_imports` | collections-crm | ✅ | ACTIVE | collections.ts |
| 122 | `call_sentiment_scores` | v5-features | ❌ | ACTIVE | sentiment.ts |
| 123 | `call_sentiment_summary` | v5-features | ❌ | ACTIVE | sentiment.ts |
| 124 | `sentiment_alert_configs` | v5-features | ❌ | ACTIVE | sentiment.ts |
| 125 | `dialer_agent_status` | v5-features | ❌ | ACTIVE | dialer.ts |
| 126 | `call_outcomes` | schema-alignment | ❌ | ACTIVE | calls.ts |
| 127 | `call_outcome_history` | schema-alignment | ❌ | ACTIVE | calls.ts |
| 128 | `ai_summaries` | schema-alignment | ✅ | ACTIVE | calls.ts, usage.ts |
| 129 | `usage_stats` | schema-alignment | ❌ | ORPHAN | — (referenced in internal.ts as literal, not a query) |
| 130 | `billing_events` | schema-alignment | ❌ | ACTIVE | webhooks.ts, billing.ts, admin-metrics.ts |
| 131 | `ai_org_configs` | unified-ai-config | ❌ | ORPHAN | — |
| 132 | `ai_operation_logs` | unified-ai-config | ❌ | ORPHAN | — |
| 133 | `inbound_phone_numbers` | post-transcription-pipeline | ✅ | ACTIVE | webhooks.ts |
| 134 | `dnc_lists` | compliance-and-payment-gaps | ✅ | ORPHAN | — |
| 135 | `compliance_scores` | compliance-and-payment-gaps | ✅ | ORPHAN | — |
| 136 | `compliance_events` | compliance-and-payment-gaps | ✅ | ORPHAN | — (mentioned in webhooks.ts comment only) |
| 137 | `scheduled_payments` | compliance-and-payment-gaps | ✅ | ORPHAN | — |
| 138 | `payment_plans` | compliance-and-payment-gaps | ✅ | ORPHAN | — |
| 139 | `dunning_events` | compliance-and-payment-gaps | ✅ | ORPHAN | — |
| 140 | `objection_rebuttals` | audio-intelligence | ✅ | ACTIVE | productivity.ts |
| 141 | `note_templates` | audio-intelligence | ✅ | ACTIVE | productivity.ts |
| 142 | `audio_injections` | voice_to_voice_translation | ✅ | ACTIVE | webhooks.ts |
| 143 | `call_translations` | audit-remediation | ❌ | ACTIVE | webhooks.ts, live-translation.ts |
| 144 | `teams` | audit-remediation | ❌ | ACTIVE | teams.ts, test.ts |
| 145 | `team_members` | audit-remediation | ❌ | ACTIVE | teams.ts, test.ts |
| 146 | `survey_responses` | audit-remediation | ❌ | ACTIVE | analytics.ts |

### C. Tables Referenced Only in RLS Hardening Migration (no CREATE TABLE found — may exist via runtime DDL or unsearched migrations)

| # | Table | RLS | Status | Route File(s) |
|---|-------|-----|--------|----------------|
| 147 | `ai_call_events` | ✅ | ORPHAN | — |
| 148 | `bond_ai_copilot_contexts` | ✅ | ORPHAN | — |
| 149 | `collection_calls` | ✅ | ORPHAN | — |
| 150 | `collection_letters` | ✅ | ORPHAN | — |
| 151 | `compliance_monitoring` | ✅ | ORPHAN | — |
| 152 | `crm_contacts` | ✅ | ORPHAN | — |
| 153 | `crm_interactions` | ✅ | ORPHAN | — |
| 154 | `customer_history` | ✅ | ORPHAN | — |
| 155 | `disposition_outcomes` | ✅ | ORPHAN | — |
| 156 | `disposition_workflows` | ✅ | ORPHAN | — |
| 157 | `email_logs` | ✅ | ORPHAN | — |
| 158 | `ivr_sessions` | ✅ | ORPHAN | — |
| 159 | `org_roles` | ✅ | ORPHAN | — |
| 160 | `plan_usage_limits` | ✅ | ORPHAN | — |
| 161 | `role_permissions` | ✅ | ORPHAN | — |
| 162 | `sip_trunks` | ✅ | ORPHAN | — |
| 163 | `telnyx_call_events` | ✅ | ORPHAN | — |
| 164 | `usage_meters` | ✅ | ORPHAN | — |
| 165 | `verification_codes` | ✅ | ORPHAN | — |
| 166 | `webrtc_credentials` | ✅ | ORPHAN | — |
| 167 | `webhook_event_types` | ✅ | ORPHAN | — |
| 168 | `webhook_retry_history` | ✅ | ORPHAN | — |

### D. Tables Discovered in Routes Without Migration Match (runtime-created or missed)

| # | Table | RLS | Status | Route File(s) |
|---|-------|-----|--------|----------------|
| 169 | `bond_ai_alerts` | ❌ | ACTIVE | bond-ai.ts, test.ts |
| 170 | `scorecard_alerts` | ❌ | ACTIVE | scorecards.ts |

---

## 2. RLS Summary — 51 Tables with Row-Level Security

All RLS policies follow the pattern:
```sql
USING (organization_id = current_setting('app.current_org_id', true)::UUID)
```

| Source Migration | Tables |
|-----------------|--------|
| `session7-rls-security-hardening.sql` (39) | ai_call_events, ai_summaries, artifacts, bond_ai_copilot_contexts, call_confirmations, campaigns, campaign_calls, collection_accounts, collection_calls, collection_csv_imports, collection_letters, collection_payments, collection_tasks, compliance_monitoring, crm_contacts, crm_interactions, customer_history, disposition_outcomes, disposition_workflows, email_logs, ivr_sessions, org_members, org_roles, plan_usage_limits, recordings, role_permissions, sip_trunks, surveys, team_invites, telnyx_call_events, tool_access, usage_meters, users, verification_codes, voice_configs, webrtc_credentials, webrtc_sessions, webhook_event_types, webhook_retry_history |
| `neon_schema.sql` / `neon_ready_for_editor.sql` (3 unique) | organizations, calls, recordings (overlaps: org_members, artifacts) |
| `post-transcription-pipeline.sql` (1) | inbound_phone_numbers |
| `compliance-and-payment-gaps.sql` (6) | dnc_lists, compliance_scores, compliance_events, scheduled_payments, payment_plans, dunning_events |
| `audio-intelligence-and-productivity.sql` (2) | objection_rebuttals, note_templates |
| `voice_to_voice_translation.sql` (1) | audio_injections |

### Tables MISSING RLS That Likely Need It

These tables contain org-scoped data but have **no RLS**:

| Table | Reasoning |
|-------|-----------|
| `audit_logs` | Contains org-specific audit trails |
| `billing_events` | Contains org billing data |
| `call_outcomes` / `call_outcome_history` | Child of calls (org-scoped) |
| `call_notes` | Child of calls (org-scoped) |
| `call_translations` | Child of calls (org-scoped) |
| `call_sentiment_scores` / `call_sentiment_summary` | Child of calls (org-scoped) |
| `caller_id_numbers` / `caller_id_permissions` / `caller_id_default_rules` / `caller_ids` | Org-scoped telephony config |
| `ai_configs` / `ai_org_configs` | Org-scoped AI config |
| `auth_providers` | Org-scoped SSO config |
| `teams` / `team_members` | Org-scoped team structure |
| `report_schedules` / `reports` | Org-scoped reporting |
| `webhook_subscriptions` / `webhook_deliveries` / `webhook_failures` | Org-scoped webhook config |
| `stripe_events` / `stripe_invoices` | Org billing artifacts |
| `transcriptions` / `audio_files` / `tts_audio` | Org-scoped media |
| `scorecards` / `scored_recordings` | Org-scoped QA data |

---

## 3. Orphan Tables — No Route References (~104 tables)

### High-Value Orphans (have schema, likely planned features)

| Table | Category | Notes |
|-------|----------|-------|
| `integrations` | CRM | Full table schema, no route CRUD |
| `crm_contacts` / `crm_interactions` / `crm_object_links` / `crm_sync_log` | CRM | CRM integration tables, no routes |
| `customer_history` | CRM | Customer timeline, unused |
| `collection_calls` / `collection_letters` | Collections | Sub-features of collections, unused |
| `disposition_outcomes` / `disposition_workflows` | Dialer | Call disposition system, no routes |
| `email_logs` | Communication | Email tracking, unused |
| `ivr_sessions` | IVR | IVR session tracking, unused |
| `incidents` / `network_incidents` | Operations | Incident management, unused |
| `search_documents` / `search_events` | Search | Full-text search infrastructure, unused |
| `evidence_bundles` / `evidence_manifests` | Legal/Compliance | Evidence packaging, unused |
| `kpi_logs` / `kpi_settings` / `number_kpi_*` | Analytics | KPI tracking infrastructure, unused |
| `digests` / `digest_items` | Notifications | Digest/summary system, unused |
| `attention_decisions` / `attention_events` / `attention_policies` | AI | Attention management system, unused |
| `compliance_scores` / `compliance_events` / `compliance_monitoring` | Compliance | Advanced compliance tracking, unused |
| `dnc_lists` | Compliance | Do-Not-Call list, unused |
| `payment_plans` / `scheduled_payments` / `dunning_events` | Billing | Payment plan system, unused |
| `ai_org_configs` / `ai_operation_logs` / `ai_call_events` | AI | Unified AI config, unused |

### Archive/Legacy Orphans (safe to ignore or drop)

| Table | Notes |
|-------|-------|
| `access_grants_archived` | Archived RBAC data |
| `capabilities_archived` | Archived capability system |
| `role_capabilities_archived` | Archived role-capability mappings |
| `roles_archived` | Archived roles |
| `shopper_campaigns_archive` | Archived shopper campaigns |
| `shopper_jobs_archive` | Archived shopper jobs |
| `tool_access_archived` | Archived tool access |

### System/Config Orphans (may be used internally but not via routes)

| Table | Notes |
|-------|-------|
| `accounts` | NextAuth OAuth accounts table |
| `verification_tokens` / `verification_codes` | Auth verification |
| `login_attempts` | Brute-force tracking |
| `sso_login_events` / `org_sso_configs` | SSO infrastructure |
| `oauth_tokens` | OAuth token storage |
| `global_feature_flags` / `org_feature_flags` | Feature flag system |
| `org_roles` / `role_permissions` | RBAC tables (may use rbac-v2.ts logic without direct SQL) |
| `webhooks_event_types` | Webhook type registry |
| `usage_limits` / `usage_records` / `usage_meters` / `usage_stats` / `plan_usage_limits` | Usage tracking infrastructure |
| `stripe_subscriptions` / `stripe_payment_methods` / `stripe_invoices` / `invoices` / `subscriptions` | Billing metadata (managed via Stripe API, not direct queries) |
| `systems` | System registry |
| `carrier_status` / `monitored_numbers` | Telephony monitoring |
| `sip_trunks` / `webrtc_credentials` | Telephony infrastructure |
| `media_sessions` / `webrtc_sessions` | Real-time media tracking |

---

## 4. Active Tables — Route Cross-Reference (~66 tables)

| Table | Route Files |
|-------|-------------|
| `ai_agent_audit_log` | bond-ai.ts |
| `ai_configs` | ai-config.ts |
| `ai_runs` | analytics.ts |
| `ai_summaries` | calls.ts, usage.ts |
| `audio_files` | audio.ts |
| `audio_injections` | webhooks.ts |
| `auth_providers` | admin.ts |
| `billing_events` | webhooks.ts, billing.ts, admin-metrics.ts |
| `bond_ai_alerts` | bond-ai.ts, test.ts |
| `booking_events` | bookings.ts |
| `call_confirmations` | calls.ts |
| `call_notes` | calls.ts, productivity.ts |
| `call_outcomes` | calls.ts |
| `call_outcome_history` | calls.ts |
| `call_sentiment_scores` | sentiment.ts |
| `call_sentiment_summary` | sentiment.ts |
| `call_translations` | webhooks.ts, live-translation.ts |
| `caller_id_default_rules` | caller-id.ts |
| `caller_id_numbers` | caller-id.ts |
| `caller_id_permissions` | caller-id.ts |
| `caller_ids` | caller-id.ts |
| `calls` | calls.ts, webhooks.ts, voice.ts, webrtc.ts, manager.ts, dialer.ts, usage.ts, reports.ts, ai-toggle.ts, ivr.ts, productivity.ts, sentiment.ts, live-translation.ts, test.ts |
| `campaign_calls` | dialer.ts, productivity.ts |
| `campaigns` | dialer.ts |
| `collection_accounts` | collections.ts, webhooks.ts, ivr.ts, productivity.ts |
| `collection_csv_imports` | collections.ts |
| `collection_payments` | collections.ts, ivr.ts, manager.ts |
| `collection_tasks` | collections.ts, productivity.ts |
| `compliance_violations` | compliance.ts |
| `dialer_agent_status` | dialer.ts |
| `inbound_phone_numbers` | webhooks.ts |
| `legal_holds` | retention.ts |
| `note_templates` | productivity.ts |
| `objection_rebuttals` | productivity.ts |
| `org_members` | auth.ts, team.ts, teams.ts, organizations.ts, test.ts |
| `organizations` | auth.ts, billing.ts, webhooks.ts, organizations.ts, onboarding.ts, rbac-v2.ts, usage.ts, teams.ts, live-translation.ts, call-capabilities.ts, test.ts |
| `recordings` | recordings.ts, calls.ts, usage.ts, webhooks.ts, test.ts |
| `report_schedules` | reports.ts |
| `reports` | reports.ts |
| `retention_policies` | retention.ts |
| `scorecard_alerts` | scorecards.ts |
| `scorecards` | scorecards.ts, test.ts |
| `scored_recordings` | analytics.ts |
| `sentiment_alert_configs` | sentiment.ts |
| `sessions` | auth.ts, test.ts, admin-metrics.ts |
| `shopper_results` | shopper.ts |
| `shopper_scripts` | shopper.ts |
| `stripe_events` | webhooks.ts |
| `survey_responses` | analytics.ts |
| `surveys` | surveys.ts |
| `team_invites` | team.ts |
| `team_members` | teams.ts, test.ts |
| `teams` | teams.ts, test.ts |
| `transcriptions` | audio.ts |
| `tts_audio` | tts.ts, ai-router.ts |
| `users` | auth.ts, team.ts, billing.ts, users.ts, manager.ts, admin-metrics.ts, test.ts |
| `voice_configs` | voice.ts, webhooks.ts, calls.ts, ai-toggle.ts, webrtc.ts, test.ts, internal.ts |
| `voice_targets` | voice.ts |
| `webhook_deliveries` | webhooks.ts |
| `webhook_failures` | reliability.ts |
| `webhook_subscriptions` | webhooks.ts |
| `audit_logs` | audit.ts, analytics.ts, test.ts |

---

## 5. Recommendations

### Immediate Actions
1. **RLS Gap**: 20+ org-scoped active tables lack RLS protection — prioritize `audit_logs`, `billing_events`, `teams`, `call_outcomes`, `transcriptions`
2. **DROP candidates**: 7 `_archived` tables can be reviewed for deletion
3. **Route coverage**: `bond_ai_alerts` and `scorecard_alerts` need CREATE TABLE migration if not present

### Technical Debt
- 104 orphan tables represent significant schema bloat
- Many orphans are from planned features (CRM, advanced compliance, KPIs, digests) that were never wired to routes
- Consider a schema pruning migration to DROP confirmed-unused tables after backup
