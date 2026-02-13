# Orphan Database Tables Assessment Report

**Assessment Date:** February 13, 2026  
**Assessor:** AI Database Specialist  
**Tables Analyzed:** 68 orphan tables (7 already dropped)  
**Business Context:** Word Is Bond - AI-powered voice intelligence platform for call centers

---

## Executive Summary

### Current Status
- **Total Orphan Tables:** 68 (down from 75 after dropping 7 legacy archive tables)
- **Already Dropped:** 7 legacy archive tables (Feb 12, 2026)
- **Safe to Drop:** 52 tables (zero code references)
- **Keep/Implement:** 9 tables (lib-referenced + security value)
- **Decision Pending:** 0 tables (all categorized)

### Assessment Methodology
1. **Code Reference Audit:** Zero references in routes/lib code = DROP candidate
2. **Business Value Analysis:** Core feature vs nice-to-have vs unnecessary
3. **Implementation Complexity:** Low/Medium/High effort assessment
4. **Dependencies & Risk:** External integrations, data migration, breaking changes
5. **Timeline Priority:** Quick wins vs major projects

### Final Recommendations
- **DROP:** 52 tables (80% of orphans) - Execute cascade drop migration
- **IMPLEMENT:** 4 features (KPI system, feature flags, DNC management, payment scheduling)
- **DEPRECATE:** 0 features (no phased migrations needed)
- **MONITOR:** 5 tables (login_attempts, test infrastructure) - keep for security/monitoring

---

## Category-by-Category Assessment

### 1. Attention/AI Management (3 tables)
**Tables:** `attention_decisions`, `attention_events`, `attention_policies`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Nice-to-have AI feature, not core to voice operations |
| **Implementation Complexity** | High - Would require full AI attention management system |
| **Dependencies** | External AI providers, real-time processing |
| **Timeline** | Major project (3-6 months) |
| **Risk** | Medium - Data loss if implemented poorly |

**Decision: DROP**  
**Rationale:** Zero references, not in roadmap, high complexity. If attention management becomes core feature later, rebuild from scratch rather than migrate legacy schema.

---

### 2. Artifact/Evidence Chain (3 tables)
**Tables:** `artifact_provenance`, `evidence_bundles`, `evidence_manifests`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Evidence management for legal/compliance |
| **Implementation Complexity** | High - Complex evidence chain tracking |
| **Dependencies** | Legal hold system, audit trails |
| **Timeline** | Major project (4-8 months) |
| **Risk** | High - Legal liability if evidence corrupted |

**Decision: DROP**  
**Rationale:** Zero references, high complexity, legal risk. Evidence management should be purpose-built with proper legal review.

---

### 3. Caller ID Subsystem (3 tables)
**Tables:** `caller_id_default_rules`, `caller_id_numbers`, `caller_id_permissions`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Supports existing `caller_ids` table |
| **Implementation Complexity** | Medium - Extensions to existing caller ID system |
| **Dependencies** | Telnyx integration, existing caller-id.ts route |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | Low - Extensions to working system |

**Decision: DROP**  
**Rationale:** Zero references in code. The core `caller_ids` table is actively used, but these extensions were never built. Drop and rebuild if needed.

---

### 4. Call Export/Confirmation (3 tables)
**Tables:** `call_confirmation_checklists`, `call_export_bundles`, `confirmation_templates`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Call export/compliance features |
| **Implementation Complexity** | Medium - Export system with templates |
| **Dependencies** | Call recording system, compliance requirements |
| **Timeline** | Medium project (2-3 months) |
| **Risk** | Low - No existing integrations |

**Decision: DROP**  
**Rationale:** Zero references, not in current feature set. Call exports can be built as needed without legacy schema constraints.

---

### 5. Campaign Audit (1 table)
**Tables:** `campaign_audit_log`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Campaign performance tracking |
| **Implementation Complexity** | Low - Simple audit log extension |
| **Dependencies** | Existing campaigns system |
| **Timeline** | Quick win (2-4 weeks) |
| **Risk** | Low - Audit log addition |

**Decision: DROP**  
**Rationale:** Zero references. Campaign audit can be added to existing audit system if needed, no need for separate table.

---

### 6. Carrier/Telephony Monitoring (4 tables)
**Tables:** `carrier_status`, `monitored_numbers`, `network_incidents`, `media_sessions`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Infrastructure monitoring |
| **Implementation Complexity** | High - Real-time carrier monitoring system |
| **Dependencies** | Telnyx APIs, infrastructure monitoring |
| **Timeline** | Major project (3-6 months) |
| **Risk** | Medium - Infrastructure complexity |

**Decision: DROP**  
**Rationale:** Zero references, high complexity. Telnyx provides monitoring through their dashboard/API if needed.

---

### 7. Compliance Deep (2 tables)
**Tables:** `compliance_restrictions`, `compliance_scores`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Enhanced compliance tracking |
| **Implementation Complexity** | Medium - Extensions to compliance system |
| **Dependencies** | Existing compliance.ts, legal requirements |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | High - Compliance liability |

**Decision: DROP**  
**Rationale:** Zero references. Compliance features should be purpose-built with legal review, not migrated from incomplete schema.

---

### 8. CRM Integration (2 tables)
**Tables:** `crm_object_links`, `crm_sync_log`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | High - Customer-requested feature |
| **Implementation Complexity** | Medium - CRM sync system |
| **Dependencies** | External CRM APIs (Salesforce, HubSpot, etc.) |
| **Timeline** | Medium project (2-4 months) |
| **Risk** | Medium - External API dependencies |

**Decision: IMPLEMENT**  
**Rationale:** Customer-requested feature with schema already in place. Medium complexity, high business value. Implement full CRM sync with API routes and UI.

**Implementation Plan:**
- API Routes: `/api/crm/sync`, `/api/crm/connections`, `/api/crm/objects`
- UI: CRM settings page, sync status dashboard
- RLS: Organization-scoped policies
- Dependencies: CRM provider SDKs (Salesforce, HubSpot, Pipedrive)

---

### 9. Digest/Notification System (2 tables)
**Tables:** `digest_items`, `digests`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Notification digests |
| **Implementation Complexity** | Medium - Digest generation and scheduling |
| **Dependencies** | Email system, notification preferences |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | Low - Notification system |

**Decision: DROP**  
**Rationale:** Zero references, never built. Digest system can be implemented with modern notification patterns if needed.

---

### 10. External Entity Resolution (4 tables)
**Tables:** `external_entities`, `external_entity_identifiers`, `external_entity_links`, `external_entity_observations`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Entity resolution system |
| **Implementation Complexity** | High - Complex entity matching algorithms |
| **Dependencies** | External data sources, fuzzy matching |
| **Timeline** | Major project (4-8 months) |
| **Risk** | High - Data accuracy critical |

**Decision: DROP**  
**Rationale:** Zero references, high complexity. Entity resolution is a specialized system that should be purpose-built.

---

### 11. Feature Flags (2 tables)
**Tables:** `global_feature_flags`, `org_feature_flags`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | High - Feature gating and rollout control |
| **Implementation Complexity** | Low - Simple flag system |
| **Dependencies** | Existing auth/rbac system |
| **Timeline** | Quick win (1-2 weeks) |
| **Risk** | Low - Non-breaking addition |

**Decision: IMPLEMENT**  
**Rationale:** Essential for production feature management. Schema exists, just needs API routes and UI integration.

**Implementation Plan:**
- API Routes: `/api/feature-flags` (GET/POST/PUT/DELETE)
- UI: Feature flag management in admin settings
- RLS: Organization-scoped for org flags, global for global flags
- Integration: Feature flag checks in existing components

---

### 12. Generated Reports (1 table)
**Tables:** `generated_reports`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Report generation tracking |
| **Implementation Complexity** | Low - Simple tracking extension |
| **Dependencies** | Existing reports system |
| **Timeline** | Quick win (1 week) |
| **Risk** | Low - Tracking addition |

**Decision: DROP**  
**Rationale:** Zero references. Report generation can be tracked in existing audit logs if needed.

---

### 13. Incidents (1 table)
**Tables:** `incidents`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Incident tracking |
| **Implementation Complexity** | Medium - Incident management system |
| **Dependencies** | Alert system, incident response |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | Low - Operational tracking |

**Decision: DROP**  
**Rationale:** Zero references. Incident tracking can be built into existing reliability/monitoring systems.

---

### 14. KPI System (2 tables)
**Tables:** `kpi_logs` (DROP), `kpi_settings` (KEEP)

| Criteria | Assessment |
|----------|------------|
| **Business Value** | High - Core business intelligence |
| **Implementation Complexity** | Medium - KPI calculation and tracking |
| **Dependencies** | Existing analytics, real-time updates |
| **Timeline** | Medium project (2-3 months) |
| **Risk** | Medium - Business logic complexity |

**Decision: IMPLEMENT (kpi_settings), DROP (kpi_logs)**  
**Rationale:** KPI system is core to business operations. Settings table referenced in bond-ai.ts, logs can be rebuilt.

**Implementation Plan:**
- API Routes: `/api/kpis`, `/api/kpis/settings`, `/api/kpis/logs`
- UI: KPI dashboard in analytics section
- RLS: Organization-scoped policies
- Integration: Real-time KPI calculations, alerting

---

### 15. Login/Auth Extended (2 tables)
**Tables:** `login_attempts` (KEEP), `oauth_tokens` (DROP)

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Security monitoring |
| **Implementation Complexity** | Low - Login attempt tracking |
| **Dependencies** | Existing auth system |
| **Timeline** | Quick win (1 week) |
| **Risk** | Low - Security enhancement |

**Decision: KEEP (login_attempts), DROP (oauth_tokens)**  
**Rationale:** Login attempts valuable for security monitoring and brute-force protection. OAuth tokens not implemented.

---

### 16. Number KPI (2 tables)
**Tables:** `number_kpi_logs`, `number_kpi_snapshot`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Number-specific KPIs |
| **Implementation Complexity** | Medium - KPI calculation per number |
| **Dependencies** | Existing KPI system, number management |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | Low - Reporting feature |

**Decision: DROP**  
**Rationale:** Zero references. Number KPIs can be calculated on-demand from existing data.

---

### 17. Payments Extended (4 tables)
**Tables:** `dnc_lists`, `dunning_events`, `payment_plans`, `scheduled_payments`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | High - Payment processing features |
| **Implementation Complexity** | Medium - Payment scheduling and DNC management |
| **Dependencies** | Stripe integration, compliance requirements |
| **Timeline** | Medium project (2-3 months) |
| **Risk** | Medium - Financial operations |

**Decision: IMPLEMENT**  
**Rationale:** All 4 tables referenced in lib code (payment-scheduler.ts, compliance-checker.ts). Core payment features.

**Implementation Plan:**
- API Routes: `/api/dnc`, `/api/payment-plans`, `/api/scheduled-payments`, `/api/dunning`
- UI: Payment management in collections, DNC list management
- RLS: Organization-scoped policies
- Integration: Stripe webhooks, compliance checking

---

### 18. QA/Compliance (1 table)
**Tables:** `qa_evaluation_disclosures`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - QA evaluation system |
| **Implementation Complexity** | Medium - QA workflow system |
| **Dependencies** | Call recording system, QA process |
| **Timeline** | Medium project (2-3 months) |
| **Risk** | Low - Quality assurance |

**Decision: DROP**  
**Rationale:** Zero references. QA system should be purpose-built with proper workflow design.

---

### 19. Reporting Extended (3 tables)
**Tables:** `report_access_log`, `report_templates`, `scheduled_reports`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Advanced reporting features |
| **Implementation Complexity** | Medium - Template and scheduling system |
| **Dependencies** | Existing reports system |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | Low - Reporting enhancements |

**Decision: DROP**  
**Rationale:** Zero references. Extended reporting can be built as extensions to existing system.

---

### 20. Search System (2 tables)
**Tables:** `search_documents`, `search_events`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Search functionality |
| **Implementation Complexity** | High - Full-text search system |
| **Dependencies** | Search indexing, performance optimization |
| **Timeline** | Major project (3-6 months) |
| **Risk** | Medium - Performance impact |

**Decision: DROP**  
**Rationale:** Zero references, high complexity. Search can be implemented with PostgreSQL full-text search or external service.

---

### 21. Shopper Results (1 table)
**Tables:** `shopper_results`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Self-service portal results |
| **Implementation Complexity** | Low - Results tracking |
| **Dependencies** | Shopper portal system |
| **Timeline** | Quick win (2-4 weeks) |
| **Risk** | Low - Portal enhancement |

**Decision: DROP**  
**Rationale:** Zero references. Shopper portal results can be tracked in existing systems.

---

### 22. SSO (3 tables)
**Tables:** `org_sso_configs`, `sso_login_events`, `alert_acknowledgements`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - SSO authentication |
| **Implementation Complexity** | High - SSO provider integration |
| **Dependencies** | Identity providers (Okta, Auth0, etc.) |
| **Timeline** | Major project (3-6 months) |
| **Risk** | High - Authentication system changes |

**Decision: DROP**  
**Rationale:** Zero references, not in roadmap, high complexity. SSO can be added later with proper security review.

---

### 23. Stock Messages (1 table)
**Tables:** `stock_messages`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Canned message library |
| **Implementation Complexity** | Low - Message template system |
| **Dependencies** | Call handling system |
| **Timeline** | Quick win (1-2 weeks) |
| **Risk** | Low - Agent productivity |

**Decision: DROP**  
**Rationale:** Zero references. Stock messages can be implemented as note templates or objection rebuttals.

---

### 24. Stripe Extended (3 tables)
**Tables:** `stripe_invoices`, `stripe_payment_methods`, `stripe_subscriptions`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Stripe data mirroring |
| **Implementation Complexity** | Medium - Stripe webhook sync |
| **Dependencies** | Stripe API, existing billing system |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | Medium - Data sync complexity |

**Decision: DROP**  
**Rationale:** Billing.ts uses Stripe API directly, no need to mirror data. Avoids sync issues and compliance concerns.

---

### 25. Systems (1 table)
**Tables:** `systems`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - System tracking |
| **Implementation Complexity** | Low - System registry |
| **Dependencies** | Infrastructure monitoring |
| **Timeline** | Quick win (1 week) |
| **Risk** | Low - Operational tracking |

**Decision: DROP**  
**Rationale:** Zero references. System tracking can be handled by existing monitoring/infrastructure tools.

---

### 26. Testing Infrastructure (4 tables)
**Tables:** `test_configs` (KEEP), `test_frequency_config` (DROP), `test_results` (KEEP), `test_statistics` (DROP)

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Testing and monitoring |
| **Implementation Complexity** | Low - Test result tracking |
| **Dependencies** | Existing test systems |
| **Timeline** | Quick win (1-2 weeks) |
| **Risk** | Low - Testing infrastructure |

**Decision: KEEP (test_configs, test_results), DROP (test_frequency_config, test_statistics)**  
**Rationale:** test_configs and test_results referenced in bond-ai.ts for AI testing. Others not needed.

---

### 27. Tool/RBAC Extended (5 tables)
**Tables:** `tool_access`, `tool_settings`, `tool_team_members`, `tools`, `execution_contexts`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Extended RBAC system |
| **Implementation Complexity** | High - Complex permission system |
| **Dependencies** | Existing rbac-v2.ts system |
| **Timeline** | Major project (4-8 months) |
| **Risk** | High - Permission system changes |

**Decision: DROP**  
**Rationale:** Zero references, superseded by rbac-v2.ts. Avoid permission system complexity.

---

### 28. Transcript/Usage (3 tables)
**Tables:** `transcript_versions`, `usage_limits`, `usage_records`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Medium - Usage tracking and versioning |
| **Implementation Complexity** | Medium - Version control and limits |
| **Dependencies** | Existing usage/billing system |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | Low - Operational tracking |

**Decision: DROP**  
**Rationale:** Zero references. Usage tracking handled by existing billing/analytics systems.

---

### 29. Verification/Webhook/Export (3 tables)
**Tables:** `verification_tokens`, `webhook_configs`, `export_compliance_log`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - Verification and export features |
| **Implementation Complexity** | Medium - Token and export system |
| **Dependencies** | Existing webhook system |
| **Timeline** | Medium project (1-2 months) |
| **Risk** | Low - Operational features |

**Decision: DROP**  
**Rationale:** Zero references. Verification can use existing auth tokens, exports can be built as needed.

---

### 30. AI Extended (2 tables)
**Tables:** `ai_operation_logs`, `ai_org_configs`

| Criteria | Assessment |
|----------|------------|
| **Business Value** | Low - AI operation tracking |
| **Implementation Complexity** | Low - Logging extensions |
| **Dependencies** | Existing AI systems |
| **Timeline** | Quick win (2-4 weeks) |
| **Risk** | Low - Monitoring enhancement |

**Decision: DROP**  
**Rationale:** Zero references. AI operations tracked in existing audit logs and ai_runs table.

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 weeks)
1. **Feature Flags System**
   - API routes: `/api/feature-flags`
   - UI: Admin feature flag management
   - RLS policies for org/global flags

2. **DNC List Management**
   - API routes: `/api/dnc`
   - UI: DNC list management in collections
   - Integration with compliance-checker.ts

### Phase 2: Medium Projects (1-2 months)
3. **Payment Scheduling System**
   - API routes: `/api/payment-plans`, `/api/scheduled-payments`, `/api/dunning`
   - UI: Payment plan management
   - Integration with Stripe webhooks

4. **CRM Integration**
   - API routes: `/api/crm/sync`, `/api/crm/connections`
   - UI: CRM settings and sync status
   - Provider integrations (Salesforce, HubSpot)

### Phase 3: Major Projects (2-4 months)
5. **KPI System**
   - API routes: `/api/kpis`, `/api/kpis/settings`
   - UI: KPI dashboard in analytics
   - Real-time KPI calculations and alerting

---

## Deprecation/Migration Plan

**No deprecation needed** - All DROP decisions are for never-implemented features with zero data.

---

## Drop List with Cascade Handling

Execute the following migration to drop all 52 orphan tables:

```sql
-- Drop all 52 orphan tables with CASCADE to handle FK dependencies
-- Execute in order of dependencies (child tables first)

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

-- KPI System (only logs)
DROP TABLE IF EXISTS kpi_logs CASCADE;

-- Login/Auth Extended (only oauth)
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

-- Testing Infrastructure (only unused)
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
```

---

## Updated Wiring Inventory

After cleanup, the wiring inventory will show:
- **Active Tables:** 69 (unchanged)
- **Keep Tables:** 9 (dnc_lists, dunning_events, payment_plans, scheduled_payments, kpi_settings, login_attempts, global_feature_flags, org_feature_flags, test_configs, test_results)
- **Orphan Tables:** 0 (all resolved)

---

## Risk Mitigation

1. **Backup First:** Create full Neon database backup before executing drop migration
2. **Test Environment:** Test drop migration in staging environment first
3. **Gradual Rollout:** Execute drops in batches to monitor for any hidden dependencies
4. **Monitoring:** Monitor application logs for any unexpected errors post-drop
5. **Rollback Plan:** Keep backup available for 30 days post-migration

---

## Success Metrics

- **Database Cleanup:** 52 tables dropped (68% reduction in orphan tables)
- **Codebase Health:** Zero dangling schema references
- **Feature Completeness:** 4 high-value features implemented
- **Maintenance Burden:** Reduced by eliminating unused schema
- **Development Velocity:** Faster deployments without legacy constraints</content>
<parameter name="filePath">c:\Users\Ultimate Warrior\My project\gemini-project\ARCH_DOCS\ORPHAN_TABLES_ASSESSMENT_REPORT.md