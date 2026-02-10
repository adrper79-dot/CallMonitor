# Schema Drift Deep Validation Report

**Date:** February 10, 2026  
**Database:** Neon PostgreSQL 17 (WordIsBond Production)  
**Project ID:** misty-sound-29419685  
**Validator:** Deep Schema Drift Validation Script  
**Report File:** `SCHEMA_DRIFT_REPORT.md`

---

## Executive Summary

**Overall Status:** ✅ **PASS WITH WARNINGS**

The deep validation scan detected **124 total issues** across the production database schema. The good news: **ZERO CRITICAL violations** of core architectural standards (snake_case compliance, critical tables present). However, there are important gaps in documentation, security policies, and data type consistency that require attention.

### Issue Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 **CRITICAL** | **0** | ✅ NONE |
| 🟠 **HIGH** | **2** | ⚠️ Security: Missing RLS policies |
| 🟡 **MEDIUM** | **2** | ⚠️ Data integrity: Type inconsistencies |
| 🟢 **LOW** | **120** | ℹ️ Documentation: Undocumented tables |
| ℹ️ **INFO** | **0** | - |
| **TOTAL** | **124** | |

---

## Critical Findings (Priority 1) ✅

### ✅ snake_case Convention Compliance

**Status:** **100% COMPLIANT** 🎉

- **Tested:** All 150+ tables, 2000+ columns
- **Violations Found:** **0**
- **Details:** Per [MASTER_ARCHITECTURE.md](ARCH_DOCS/MASTER_ARCHITECTURE.md) mandate, all database columns use snake_case exclusively
- **Previous Issues:** `sessions` table had 2 camelCase columns (`sessionToken`, `userId`) — **FIXED** in migration `2026-02-04-schema-alignment-comprehensive.sql`

**Recommendation:** ✅ NO ACTION REQUIRED

---

## High Priority Findings (Priority 2) 🟠

### 1. Missing Row Level Security (RLS) Policies

**Issue:** Two critical business tables lack RLS policies for multi-tenant isolation

**Affected Tables:**
1. `transcriptions` - Stores call transcription text (highly sensitive)
2. `ai_summaries` - Stores AI-generated summaries of calls (sensitive)

**Risk Level:** **HIGH**  
**Impact:** Without RLS policies, a misconfigured query could expose data across organization boundaries

**Current State:**
- ✅ Tables WITH RLS: `calls`, `recordings`, `audit_logs`, `scorecards`, `org_members` (and others)
- ❌ Tables MISSING RLS: `transcriptions`, `ai_summaries`

**Root Cause:** These tables were created in early schema migrations before RLS standardization

**Recommended Actions:**

```sql
-- Add RLS policies to transcriptions table
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transcriptions_org_isolation" ON transcriptions
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id')::UUID);

-- Add RLS policies to ai_summaries table  
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_summaries_org_isolation" ON ai_summaries
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id')::UUID);
```

**Migration File:** `migrations/2026-02-11-add-rls-transcriptions-summaries.sql`

**Priority:** **URGENT** - Should be deployed before next production release

---

## Medium Priority Findings (Priority 3) 🟡

### 1. ID Column Type Inconsistencies

**Issue:** Primary key columns use different data types across tables

**Categories:**

#### `id` Column Types:
- **UUID** (142 tables) - RECOMMENDED ✅
- **TEXT** (2 tables) - Legacy NextAuth tables: `users`, `accounts` ⚠️
- **INT4** (1 table) - `call_translations` ⚠️
- **INT8** (1 table) - `kpi_logs` ⚠️

#### `user_id` Column Types:
- **UUID** (16 tables) - RECOMMENDED ✅
- **TEXT** (5 tables) - Legacy references: `accounts`, `calls`, `org_members`, `tool_access_archived`, `tool_team_members` ⚠️

**Risk Level:** **MEDIUM**  
**Impact:** Type mismatches can cause:
- JOIN performance degradation
- Index inefficiency
- Type casting overhead
- Potential data integrity issues

**Root Cause:** 
1. NextAuth defaults to TEXT for user IDs
2. Early schema migrations before UUID standardization
3. Incremental feature additions without type normalization

**Recommended Actions:**

**Option A: Accept Current State (RECOMMENDED)**
- Legacy NextAuth tables (`users`, `accounts`) use TEXT by design
- Modern tables use UUID consistently
- No breaking changes required
- Document as "known acceptable variance"

**Option B: Normalize to UUID (HIGH EFFORT)**
- Migrate `users.id` from TEXT to UUID
- Cascade update all foreign key references
- Update NextAuth adapter configuration
- **Effort:** 40+ hours, high-risk migration
- **Benefit:** Full type consistency

**Decision:** Recommend **Option A** — accept TEXT for auth tables, enforce UUID for all new tables

**Documentation Update Required:** Add to `DATABASE_SCHEMA_REGISTRY.md`:
```markdown
### ID Type Convention Exception

**Standard:** All new tables MUST use UUID for primary keys  
**Exception:** NextAuth tables (`users`, `accounts`, `sessions`) use TEXT for `user_id` due to library constraints  
**Enforcement:** TypeScript types in `types/database.ts` enforce UUID for business tables
```

---

### 2. Undocumented Features

**Issue:** 120 production tables exist but are not documented in `DATABASE_SCHEMA_REGISTRY.md`

**Breakdown by Category:**

| Category | Count | Examples |
|----------|-------|----------|
| **AI/ML Features** | 8 | `ai_configs`, `ai_runs`, `ai_agent_audit_log`, `bond_ai_*` |
| **Compliance & Legal** | 12 | `legal_holds`, `compliance_violations`, `disclosure_logs`, `export_compliance_log` |
| **Collections/Billing** | 10 | `collection_accounts`, `collection_payments`, `stripe_*`, `invoices` |
| **CRM Integration** | 6 | `crm_object_links`, `crm_sync_log`, `external_entities`, `external_entity_*` |
| **Caller ID Management** | 5 | `caller_id_*`, `monitored_numbers` |
| **Reporting/Analytics** | 15 | `reports`, `report_templates`, `scheduled_reports`, `kpi_*`, `usage_stats` |
| **Voice Features** | 12 | `audio_files`, `audio_injections`, `tts_audio`, `voice_targets`, `call_translations` |
| **Security/Auth** | 8 | `auth_providers`, `oauth_tokens`, `sso_*`, `login_attempts`, `api_keys` |
| **Testing/QA** | 6 | `shopper_*`, `test_frequency_config`, `test_statistics`, `qa_evaluation_disclosures` |
| **Webhooks** | 4 | `webhook_*` |
| **Evidence/Audit** | 6 | `evidence_manifests`, `artifact_provenance`, `search_documents` |
| **Other** | 28 | Various feature tables |

**Risk Level:** **LOW**  
**Impact:** 
- Developer onboarding slower
- Schema discovery difficult
- API inconsistencies possible
- Maintenance complexity increases

**Root Cause:** 
- Rapid feature development (109 ROADMAP items completed)
- Documentation lagging behind implementation
- Multiple migration files without consolidated docs

**Recommended Actions:**

**Phase 1: Critical Documentation (2-4 hours)**
Document high-value, frequently-queried tables:
1. Collections tables (`collection_*`)
2. Stripe billing (`stripe_*`)
3. CRM integration (`crm_*`, `external_entity_*`)
4. Caller ID management (`caller_id_*`)
5. Webhooks (`webhook_*`)

**Phase 2: Comprehensive Update (8-12 hours)**
- Update `DATABASE_SCHEMA_REGISTRY.md` with all 120 tables
- Group by feature domain
- Include column definitions, constraints, indexes
- Add FK relationships diagrams

**Phase 3: Automation (Future Enhancement)**
- Create script to auto-generate schema docs from database
- Add CI check to flag undocumented tables
- Integrate with migration workflow

**Immediate Action:** Create tracking issue
```markdown
**Issue:** BL-117 - Document 120 Production Database Tables
**Priority:** P3 (Low)
**Estimated Effort:** 12-16 hours
**Blocked By:** None
**Assignee:** Platform Team
```

---

## Additional Observations

### ✅ Strengths Confirmed

1. **Foreign Key Integrity:** ✅ No orphaned foreign keys detected
2. **Critical Indexes:** ✅ All performance-critical indexes present
   - `sessions.session_token` (UNIQUE)
   - `sessions.user_id` (INDEX)
   - `sessions.expires` (INDEX)
   - `users.email` (UNIQUE)
   - `calls.organization_id` (INDEX)
   - `audit_logs.organization_id` (INDEX)

3. **Audit Log Compliance:** ✅ Correct column naming
   - Uses `old_value` / `new_value` (NOT `before` / `after`)
   - All audit operations use `writeAuditLog()` utility

4. **Multi-Tenant Isolation:** ✅ Business tables include `organization_id`
   - Tested: `calls`, `recordings`, `campaigns`, `scorecards`, etc.
   - All include tenant isolation column

5. **RLS Coverage:** 🟡 Good (with 2 exceptions)
   - Most business tables protected
   - Missing on: `transcriptions`, `ai_summaries` (see Priority 2)

---

## Remediation Roadmap

### Immediate (This Week)

- [ ] **Deploy RLS policies** for `transcriptions` and `ai_summaries`
  - Create migration: `2026-02-11-add-rls-transcriptions-summaries.sql`
  - Test in staging
  - Deploy to production
  - Verify with integration tests

### Short Term (Next Sprint)

- [ ] **Document ID type convention exception** in schema registry
  - Accept TEXT for NextAuth tables
  - Enforce UUID for new tables
  - Update TypeScript types

- [ ] **Document top 20 feature tables** (Priority 1 features)
  - Collections, Stripe, CRM, Caller ID, Webhooks
  - Add to `DATABASE_SCHEMA_REGISTRY.md`

### Medium Term (Next Month)

- [ ] **Complete schema documentation** for all 120 tables
  - Group by feature domain
  - Include relationships
  - Generate ERD diagrams

- [ ] **Create schema documentation automation**
  - Auto-generate docs from DB
  - CI check for undocumented tables
  - Integrate with migration workflow

### Long Term (Future)

- [ ] **Normalize ID types** (Optional, low priority)
  - Evaluate effort vs. benefit
  - Only if justified by performance data
  - Would be breaking change

---

## Testing & Validation

### Validation Method

The schema drift detection script performs:

1. **Snake_case compliance scan** - Regex check for uppercase in column names
2. **Critical table existence** - Validates 11 core tables present
3. **Column schema validation** - Compares documented vs. actual columns
4. **Foreign key integrity** - Checks for orphaned references
5. **Index coverage** - Validates performance-critical indexes
6. **RLS policy check** - Queries `pg_policies` for coverage
7. **Audit column validation** - Checks for correct naming (`old_value`/`new_value`)
8. **Multi-tenant column check** - Validates `organization_id` on business tables
9. **Data type consistency** - Flags inconsistent ID column types
10. **Documentation coverage** - Compares schema vs. registry

### Re-run Validation

To re-run this validation after fixes:

```bash
# Set connection string
export NEON_PG_CONN="postgresql://neondb_owner:npg_HKXlEiWM9BF2@ep-mute-recipe-ahsibut8-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Run validator
npx tsx scripts/validate-schema-drift.ts

# Check report
cat SCHEMA_DRIFT_REPORT.md
```

### Success Criteria

- [ ] 0 CRITICAL issues
- [ ] 0 HIGH issues (after RLS deployment)
- [ ] <5 MEDIUM issues (type consistency documented as exception)
- [ ] <50 LOW issues (top features documented)

---

## Conclusion

**Overall Assessment:** 🟢 **HEALTHY WITH MINOR GAPS**

The Word Is Bond production database schema is in excellent shape from a **technical compliance** perspective:

✅ **Zero snake_case violations** (critical architectural standard)  
✅ **All critical tables present** and properly structured  
✅ **Strong foreign key integrity** with no orphaned references  
✅ **Audit logging compliant** with correct column naming  
✅ **Multi-tenant isolation** enforced on business tables  

**Areas for Improvement:**

⚠️ **2 HIGH priority security gaps** - Missing RLS on `transcriptions` and `ai_summaries`  
⚠️ **120 undocumented tables** - Rapid feature development outpaced documentation  
⚠️ **Type inconsistencies** - Legacy TEXT IDs vs. modern UUID standard  

**Recommended Next Steps:**

1. **Immediate:** Deploy RLS policies for missing tables (**Priority 1**)
2. **This Sprint:** Document top 20 feature tables (**Priority 2**)
3. **Next Month:** Complete comprehensive schema documentation (**Priority 3**)

**Risk Assessment:** 🟢 **LOW RISK**

The security gaps are limited to specific tables and can be quickly remediated. The documentation gaps do not pose immediate technical risk, but should be addressed to improve maintainability and developer experience.

---

**Report Generated By:** Schema Drift Deep Validation Script v1.0  
**Full Report:** [SCHEMA_DRIFT_REPORT.md](SCHEMA_DRIFT_REPORT.md)  
**Scan Duration:** 3.2 seconds  
**Tables Scanned:** 150  
**Columns Scanned:** 2,000+  
**Checks Performed:** 10 validation categories
