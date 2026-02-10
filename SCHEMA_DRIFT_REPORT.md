# Schema Drift Validation Report

**Generated:** 2026-02-10T17:00:28.983Z
**Database:** Neon PostgreSQL 17 (WordIsBond Production)

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 0 |
| 🟠 HIGH | 2 |
| 🟡 MEDIUM | 2 |
| 🟢 LOW | 120 |
| ℹ️  INFO | 0 |
| **TOTAL** | **124** |

## HIGH Issues (2)

### 1. [MISSING_RLS] transcriptions

**Issue:** Critical table "transcriptions" missing RLS policies for multi-tenant isolation

### 2. [MISSING_RLS] ai_summaries

**Issue:** Critical table "ai_summaries" missing RLS policies for multi-tenant isolation

## MEDIUM Issues (2)

### 1. [TYPE_INCONSISTENCY] MULTIPLE

**Issue:** Column "id" has inconsistent data types across tables

**Details:**
```json
{
  "uuid": [
    "access_grants_archived",
    "ai_agent_audit_log",
    "ai_configs",
    "ai_runs",
    "ai_summaries",
    "alert_acknowledgements",
    "alerts",
    "api_keys",
    "artifact_provenance",
    "artifacts",
    "attention_decisions",
    "attention_events",
    "attention_policies",
    "audio_files",
    "audio_injections",
    "audit_logs",
    "auth_providers",
    "billing_events",
    "bond_ai_alert_rules",
    "bond_ai_alerts",
    "bond_ai_conversations",
    "bond_ai_messages",
    "booking_events",
    "call_confirmation_checklists",
    "call_confirmations",
    "call_export_bundles",
    "call_notes",
    "call_outcome_history",
    "call_outcomes",
    "call_sentiment_scores",
    "caller_id_default_rules",
    "caller_id_numbers",
    "caller_id_permissions",
    "caller_ids",
    "calls",
    "campaign_audit_log",
    "campaign_calls",
    "campaigns",
    "capabilities_archived",
    "carrier_status",
    "collection_accounts",
    "collection_csv_imports",
    "collection_payments",
    "collection_tasks",
    "compliance_restrictions",
    "compliance_violations",
    "confirmation_templates",
    "crm_object_links",
    "crm_sync_log",
    "dialer_agent_status",
    "digest_items",
    "digests",
    "disclosure_logs",
    "evidence_bundles",
    "evidence_manifests",
    "execution_contexts",
    "export_compliance_log",
    "external_entities",
    "external_entity_identifiers",
    "external_entity_links",
    "external_entity_observations",
    "generated_reports",
    "global_feature_flags",
    "incidents",
    "integrations",
    "invoices",
    "kpi_settings",
    "legal_holds",
    "login_attempts",
    "media_sessions",
    "monitored_numbers",
    "network_incidents",
    "number_kpi_logs",
    "number_kpi_snapshot",
    "oauth_tokens",
    "org_feature_flags",
    "org_members",
    "org_sso_configs",
    "organizations",
    "qa_evaluation_disclosures",
    "rbac_permissions",
    "recordings",
    "report_access_log",
    "report_schedules",
    "report_templates",
    "reports",
    "retention_policies",
    "roles_archived",
    "scheduled_reports",
    "scorecards",
    "scored_recordings",
    "search_documents",
    "search_events",
    "sentiment_alert_configs",
    "sessions",
    "shopper_campaigns_archive",
    "shopper_jobs_archive",
    "shopper_results",
    "shopper_scripts",
    "sso_login_events",
    "stock_messages",
    "stripe_events",
    "stripe_invoices",
    "stripe_payment_methods",
    "stripe_subscriptions",
    "subscriptions",
    "survey_responses",
    "surveys",
    "systems",
    "team_invites",
    "team_members",
    "teams",
    "test_configs",
    "test_frequency_config",
    "test_results",
    "test_statistics",
    "tool_access",
    "tool_access_archived",
    "tool_settings",
    "tool_team_members",
    "tools",
    "transcript_versions",
    "transcriptions",
    "tts_audio",
    "usage_limits",
    "usage_records",
    "usage_stats",
    "voice_configs",
    "voice_targets",
    "webhook_configs",
    "webhook_deliveries",
    "webhook_failures",
    "webhook_subscriptions",
    "webrtc_sessions"
  ],
  "text": [
    "accounts",
    "users"
  ],
  "int4": [
    "call_translations"
  ],
  "int8": [
    "kpi_logs"
  ]
}
```

### 2. [TYPE_INCONSISTENCY] MULTIPLE

**Issue:** Column "user_id" has inconsistent data types across tables

**Details:**
```json
{
  "uuid": [
    "access_grants_archived",
    "alert_acknowledgements",
    "audit_logs",
    "bond_ai_conversations",
    "booking_events",
    "caller_id_default_rules",
    "caller_id_permissions",
    "campaign_audit_log",
    "compliance_violations",
    "dialer_agent_status",
    "report_access_log",
    "sessions",
    "sso_login_events",
    "team_members",
    "tool_access",
    "webrtc_sessions"
  ],
  "text": [
    "accounts",
    "calls",
    "org_members",
    "tool_access_archived",
    "tool_team_members"
  ]
}
```

## LOW Issues (120)

### 1. [UNDOCUMENTED_TABLE] access_grants_archived

**Issue:** Table "access_grants_archived" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 2. [UNDOCUMENTED_TABLE] ai_agent_audit_log

**Issue:** Table "ai_agent_audit_log" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 3. [UNDOCUMENTED_TABLE] ai_configs

**Issue:** Table "ai_configs" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 4. [UNDOCUMENTED_TABLE] ai_runs

**Issue:** Table "ai_runs" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "21"
}
```

### 5. [UNDOCUMENTED_TABLE] alert_acknowledgements

**Issue:** Table "alert_acknowledgements" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 6. [UNDOCUMENTED_TABLE] alerts

**Issue:** Table "alerts" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 7. [UNDOCUMENTED_TABLE] api_keys

**Issue:** Table "api_keys" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "10"
}
```

### 8. [UNDOCUMENTED_TABLE] artifact_provenance

**Issue:** Table "artifact_provenance" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "15"
}
```

### 9. [UNDOCUMENTED_TABLE] artifacts

**Issue:** Table "artifacts" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 10. [UNDOCUMENTED_TABLE] attention_decisions

**Issue:** Table "attention_decisions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 11. [UNDOCUMENTED_TABLE] attention_events

**Issue:** Table "attention_events" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 12. [UNDOCUMENTED_TABLE] attention_policies

**Issue:** Table "attention_policies" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "11"
}
```

### 13. [UNDOCUMENTED_TABLE] audio_files

**Issue:** Table "audio_files" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 14. [UNDOCUMENTED_TABLE] audio_injections

**Issue:** Table "audio_injections" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 15. [UNDOCUMENTED_TABLE] auth_providers

**Issue:** Table "auth_providers" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 16. [UNDOCUMENTED_TABLE] billing_events

**Issue:** Table "billing_events" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 17. [UNDOCUMENTED_TABLE] bond_ai_alert_rules

**Issue:** Table "bond_ai_alert_rules" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

### 18. [UNDOCUMENTED_TABLE] bond_ai_alerts

**Issue:** Table "bond_ai_alerts" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

### 19. [UNDOCUMENTED_TABLE] bond_ai_conversations

**Issue:** Table "bond_ai_conversations" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 20. [UNDOCUMENTED_TABLE] bond_ai_messages

**Issue:** Table "bond_ai_messages" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 21. [UNDOCUMENTED_TABLE] booking_events

**Issue:** Table "booking_events" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "21"
}
```

### 22. [UNDOCUMENTED_TABLE] call_confirmation_checklists

**Issue:** Table "call_confirmation_checklists" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 23. [UNDOCUMENTED_TABLE] call_confirmations

**Issue:** Table "call_confirmations" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "15"
}
```

### 24. [UNDOCUMENTED_TABLE] call_export_bundles

**Issue:** Table "call_export_bundles" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "11"
}
```

### 25. [UNDOCUMENTED_TABLE] call_notes

**Issue:** Table "call_notes" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 26. [UNDOCUMENTED_TABLE] call_outcome_history

**Issue:** Table "call_outcome_history" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "7"
}
```

### 27. [UNDOCUMENTED_TABLE] call_sentiment_scores

**Issue:** Table "call_sentiment_scores" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "11"
}
```

### 28. [UNDOCUMENTED_TABLE] call_sentiment_summary

**Issue:** Table "call_sentiment_summary" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "10"
}
```

### 29. [UNDOCUMENTED_TABLE] call_translations

**Issue:** Table "call_translations" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

### 30. [UNDOCUMENTED_TABLE] caller_id_default_rules

**Issue:** Table "caller_id_default_rules" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 31. [UNDOCUMENTED_TABLE] caller_id_numbers

**Issue:** Table "caller_id_numbers" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "17"
}
```

### 32. [UNDOCUMENTED_TABLE] caller_id_permissions

**Issue:** Table "caller_id_permissions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 33. [UNDOCUMENTED_TABLE] caller_ids

**Issue:** Table "caller_ids" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 34. [UNDOCUMENTED_TABLE] campaign_audit_log

**Issue:** Table "campaign_audit_log" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 35. [UNDOCUMENTED_TABLE] campaign_calls

**Issue:** Table "campaign_calls" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "17"
}
```

### 36. [UNDOCUMENTED_TABLE] capabilities_archived

**Issue:** Table "capabilities_archived" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "4"
}
```

### 37. [UNDOCUMENTED_TABLE] carrier_status

**Issue:** Table "carrier_status" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "10"
}
```

### 38. [UNDOCUMENTED_TABLE] collection_accounts

**Issue:** Table "collection_accounts" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "22"
}
```

### 39. [UNDOCUMENTED_TABLE] collection_csv_imports

**Issue:** Table "collection_csv_imports" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 40. [UNDOCUMENTED_TABLE] collection_payments

**Issue:** Table "collection_payments" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "10"
}
```

### 41. [UNDOCUMENTED_TABLE] collection_tasks

**Issue:** Table "collection_tasks" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 42. [UNDOCUMENTED_TABLE] compliance_restrictions

**Issue:** Table "compliance_restrictions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 43. [UNDOCUMENTED_TABLE] compliance_violations

**Issue:** Table "compliance_violations" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 44. [UNDOCUMENTED_TABLE] confirmation_templates

**Issue:** Table "confirmation_templates" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

### 45. [UNDOCUMENTED_TABLE] crm_object_links

**Issue:** Table "crm_object_links" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 46. [UNDOCUMENTED_TABLE] crm_sync_log

**Issue:** Table "crm_sync_log" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "16"
}
```

### 47. [UNDOCUMENTED_TABLE] dialer_agent_status

**Issue:** Table "dialer_agent_status" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "11"
}
```

### 48. [UNDOCUMENTED_TABLE] digest_items

**Issue:** Table "digest_items" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 49. [UNDOCUMENTED_TABLE] digests

**Issue:** Table "digests" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 50. [UNDOCUMENTED_TABLE] disclosure_logs

**Issue:** Table "disclosure_logs" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 51. [UNDOCUMENTED_TABLE] evidence_manifests

**Issue:** Table "evidence_manifests" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

### 52. [UNDOCUMENTED_TABLE] execution_contexts

**Issue:** Table "execution_contexts" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "4"
}
```

### 53. [UNDOCUMENTED_TABLE] export_compliance_log

**Issue:** Table "export_compliance_log" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 54. [UNDOCUMENTED_TABLE] external_entities

**Issue:** Table "external_entities" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "11"
}
```

### 55. [UNDOCUMENTED_TABLE] external_entity_identifiers

**Issue:** Table "external_entity_identifiers" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "15"
}
```

### 56. [UNDOCUMENTED_TABLE] external_entity_links

**Issue:** Table "external_entity_links" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 57. [UNDOCUMENTED_TABLE] external_entity_observations

**Issue:** Table "external_entity_observations" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 58. [UNDOCUMENTED_TABLE] generated_reports

**Issue:** Table "generated_reports" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "16"
}
```

### 59. [UNDOCUMENTED_TABLE] global_feature_flags

**Issue:** Table "global_feature_flags" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "4"
}
```

### 60. [UNDOCUMENTED_TABLE] incidents

**Issue:** Table "incidents" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 61. [UNDOCUMENTED_TABLE] integrations

**Issue:** Table "integrations" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "15"
}
```

### 62. [UNDOCUMENTED_TABLE] invoices

**Issue:** Table "invoices" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "7"
}
```

### 63. [UNDOCUMENTED_TABLE] kpi_logs

**Issue:** Table "kpi_logs" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 64. [UNDOCUMENTED_TABLE] kpi_settings

**Issue:** Table "kpi_settings" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 65. [UNDOCUMENTED_TABLE] legal_holds

**Issue:** Table "legal_holds" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "16"
}
```

### 66. [UNDOCUMENTED_TABLE] login_attempts

**Issue:** Table "login_attempts" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "5"
}
```

### 67. [UNDOCUMENTED_TABLE] media_sessions

**Issue:** Table "media_sessions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 68. [UNDOCUMENTED_TABLE] monitored_numbers

**Issue:** Table "monitored_numbers" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 69. [UNDOCUMENTED_TABLE] network_incidents

**Issue:** Table "network_incidents" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "10"
}
```

### 70. [UNDOCUMENTED_TABLE] number_kpi_logs

**Issue:** Table "number_kpi_logs" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "7"
}
```

### 71. [UNDOCUMENTED_TABLE] number_kpi_snapshot

**Issue:** Table "number_kpi_snapshot" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "10"
}
```

### 72. [UNDOCUMENTED_TABLE] oauth_tokens

**Issue:** Table "oauth_tokens" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 73. [UNDOCUMENTED_TABLE] org_feature_flags

**Issue:** Table "org_feature_flags" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

### 74. [UNDOCUMENTED_TABLE] org_sso_configs

**Issue:** Table "org_sso_configs" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "32"
}
```

### 75. [UNDOCUMENTED_TABLE] qa_evaluation_disclosures

**Issue:** Table "qa_evaluation_disclosures" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 76. [UNDOCUMENTED_TABLE] rbac_permissions

**Issue:** Table "rbac_permissions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 77. [UNDOCUMENTED_TABLE] report_access_log

**Issue:** Table "report_access_log" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "5"
}
```

### 78. [UNDOCUMENTED_TABLE] report_schedules

**Issue:** Table "report_schedules" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "7"
}
```

### 79. [UNDOCUMENTED_TABLE] report_templates

**Issue:** Table "report_templates" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

### 80. [UNDOCUMENTED_TABLE] reports

**Issue:** Table "reports" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 81. [UNDOCUMENTED_TABLE] role_capabilities_archived

**Issue:** Table "role_capabilities_archived" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "2"
}
```

### 82. [UNDOCUMENTED_TABLE] roles_archived

**Issue:** Table "roles_archived" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "4"
}
```

### 83. [UNDOCUMENTED_TABLE] scheduled_reports

**Issue:** Table "scheduled_reports" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "16"
}
```

### 84. [UNDOCUMENTED_TABLE] scored_recordings

**Issue:** Table "scored_recordings" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 85. [UNDOCUMENTED_TABLE] search_documents

**Issue:** Table "search_documents" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "18"
}
```

### 86. [UNDOCUMENTED_TABLE] search_events

**Issue:** Table "search_events" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "11"
}
```

### 87. [UNDOCUMENTED_TABLE] sentiment_alert_configs

**Issue:** Table "sentiment_alert_configs" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 88. [UNDOCUMENTED_TABLE] shopper_campaigns_archive

**Issue:** Table "shopper_campaigns_archive" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 89. [UNDOCUMENTED_TABLE] shopper_jobs_archive

**Issue:** Table "shopper_jobs_archive" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "12"
}
```

### 90. [UNDOCUMENTED_TABLE] shopper_results

**Issue:** Table "shopper_results" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "17"
}
```

### 91. [UNDOCUMENTED_TABLE] shopper_scripts

**Issue:** Table "shopper_scripts" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "17"
}
```

### 92. [UNDOCUMENTED_TABLE] sso_login_events

**Issue:** Table "sso_login_events" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "16"
}
```

### 93. [UNDOCUMENTED_TABLE] stock_messages

**Issue:** Table "stock_messages" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 94. [UNDOCUMENTED_TABLE] stripe_events

**Issue:** Table "stripe_events" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 95. [UNDOCUMENTED_TABLE] stripe_invoices

**Issue:** Table "stripe_invoices" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "16"
}
```

### 96. [UNDOCUMENTED_TABLE] stripe_payment_methods

**Issue:** Table "stripe_payment_methods" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

### 97. [UNDOCUMENTED_TABLE] stripe_subscriptions

**Issue:** Table "stripe_subscriptions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "18"
}
```

### 98. [UNDOCUMENTED_TABLE] subscriptions

**Issue:** Table "subscriptions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 99. [UNDOCUMENTED_TABLE] survey_responses

**Issue:** Table "survey_responses" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "7"
}
```

### 100. [UNDOCUMENTED_TABLE] surveys

**Issue:** Table "surveys" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 101. [UNDOCUMENTED_TABLE] systems

**Issue:** Table "systems" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 102. [UNDOCUMENTED_TABLE] team_members

**Issue:** Table "team_members" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "5"
}
```

### 103. [UNDOCUMENTED_TABLE] teams

**Issue:** Table "teams" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "11"
}
```

### 104. [UNDOCUMENTED_TABLE] test_frequency_config

**Issue:** Table "test_frequency_config" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 105. [UNDOCUMENTED_TABLE] test_statistics

**Issue:** Table "test_statistics" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "19"
}
```

### 106. [UNDOCUMENTED_TABLE] tool_access

**Issue:** Table "tool_access" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "7"
}
```

### 107. [UNDOCUMENTED_TABLE] tool_access_archived

**Issue:** Table "tool_access_archived" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 108. [UNDOCUMENTED_TABLE] tool_settings

**Issue:** Table "tool_settings" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "6"
}
```

### 109. [UNDOCUMENTED_TABLE] tool_team_members

**Issue:** Table "tool_team_members" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "10"
}
```

### 110. [UNDOCUMENTED_TABLE] tools

**Issue:** Table "tools" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "4"
}
```

### 111. [UNDOCUMENTED_TABLE] transcript_versions

**Issue:** Table "transcript_versions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "13"
}
```

### 112. [UNDOCUMENTED_TABLE] tts_audio

**Issue:** Table "tts_audio" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "9"
}
```

### 113. [UNDOCUMENTED_TABLE] usage_limits

**Issue:** Table "usage_limits" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "7"
}
```

### 114. [UNDOCUMENTED_TABLE] usage_records

**Issue:** Table "usage_records" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "10"
}
```

### 115. [UNDOCUMENTED_TABLE] usage_stats

**Issue:** Table "usage_stats" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 116. [UNDOCUMENTED_TABLE] voice_targets

**Issue:** Table "voice_targets" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 117. [UNDOCUMENTED_TABLE] webhook_configs

**Issue:** Table "webhook_configs" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "8"
}
```

### 118. [UNDOCUMENTED_TABLE] webhook_deliveries

**Issue:** Table "webhook_deliveries" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "15"
}
```

### 119. [UNDOCUMENTED_TABLE] webhook_failures

**Issue:** Table "webhook_failures" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "21"
}
```

### 120. [UNDOCUMENTED_TABLE] webhook_subscriptions

**Issue:** Table "webhook_subscriptions" exists but not documented in DATABASE_SCHEMA_REGISTRY.md

**Details:**
```json
{
  "column_count": "14"
}
```

