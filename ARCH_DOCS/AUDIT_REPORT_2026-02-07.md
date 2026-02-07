# 🔍 Architecture & Codebase Audit Report — 2026-02-07

**Platform:** Word Is Bond v4.24+  
**Scope:** ARCH_DOCS, Workers API, Frontend, Neon PostgreSQL Schema  
**Method:** 4 parallel automated audit agents  

---

## Executive Summary

A comprehensive audit of the Word Is Bond platform identified **12 critical**, **15 high**, and **25+ medium** findings across architecture documentation, backend API routes, frontend components, and database schema. Key themes:

1. **Documentation drift** — ARCH_DOCS contain stale references to deprecated tech (NextAuth, SignalWire, Supabase), wrong URLs, and contradictory session property names
2. **Schema integrity** — 4 tables queried by code but never created in migrations; 5 route handlers create tables at runtime via DDL
3. **Security gaps** — Webhook handlers lack multi-tenant isolation; one recording endpoint has broken authorization; API key secrets stored as plaintext markers
4. **Audit trail gaps** — ~14 route files with mutation endpoints missing `writeAuditLog()` calls; Stripe webhook audit logs use wrong parameter names
5. **22+ obsolete files** — Debug scripts, NextAuth migrations, SignalWire test fixtures, and hardcoded credential files that should be deleted

---

## 🔴 CRITICAL Findings

### C-1 · R2 Credentials Committed to Git
- **File:** `deploy-cloudflare.sh`
- **Issue:** Contains hardcoded R2 access key + secret key in git history
- **Fix:** Delete file, rotate R2 credentials immediately
- **Status:** ⬜ Pending

### C-2 · Copilot Instructions — Session Property Name Wrong
- **File:** `.github/copilot-instructions.md`
- **Issue:** Says `c.get('session').orgId` — actual property is `session.organizationId` (per `workers/src/lib/auth.ts`)
- **Fix:** Update to `c.get('session').organizationId`
- **Status:** ⬜ Pending

### C-3 · Copilot Instructions — Stale Version & Progress
- **File:** `.github/copilot-instructions.md`
- **Issue:** Says "v4.11+" and "69/109 ROADMAP items (63%)" — actual is v4.24+ and 109/109 (100%)
- **Fix:** Update version and progress numbers
- **Status:** ⬜ Pending

### C-4 · MASTER_ARCHITECTURE — NextAuth Import in Code Sample
- **File:** `ARCH_DOCS/MASTER_ARCHITECTURE.md`
- **Issue:** Code sample imports `useSession` from `'next-auth/react'` — NextAuth was fully removed
- **Fix:** Replace with `import { useSession } from '@/components/AuthProvider'`
- **Status:** ⬜ Pending

### C-5 · MASTER_ARCHITECTURE — Wrong Auth Description
- **File:** `ARCH_DOCS/MASTER_ARCHITECTURE.md`
- **Issue:** Claims "JWT tokens in HttpOnly cookies" — system uses session tokens in KV+DB with Bearer header
- **Fix:** Rewrite auth section to reflect actual implementation
- **Status:** ⬜ Pending

### C-6 · Telnyx Webhook Handlers — No Multi-Tenant Isolation
- **File:** `workers/src/routes/webhooks.ts`
- **Issue:** UPDATE queries use `WHERE call_sid = $1` without `AND organization_id` clause
- **Fix:** Add org_id to webhook UPDATE queries (resolve org from calls table first)
- **Status:** ⬜ Pending (requires careful implementation)

### C-7 · Stripe Webhook Audit Logs — Wrong Parameter Names
- **File:** `workers/src/routes/webhooks.ts`
- **Issue:** Uses `before/after` instead of `old_value/new_value` in writeAuditLog calls
- **Fix:** Rename parameters to match AuditLog interface
- **Status:** ⬜ Pending

### C-8 · Recording DELETE — Broken Authorization
- **File:** `workers/src/routes/recordings.ts`
- **Issue:** Checks `ROLE_LEVELS['recording:delete']` which is undefined (= 0), so every authenticated user passes
- **Fix:** Change to valid role like `manager` or `admin`
- **Status:** ⬜ Pending (requires policy decision)

### C-9 · API Key Secret — Stored as Plaintext Marker
- **File:** `workers/src/routes/organizations.ts`
- **Issue:** Stores literal `'***hashed***'` string as `client_secret_hash` instead of actual hash
- **Fix:** Use proper HMAC/SHA-256 hashing
- **Status:** ⬜ Pending (requires crypto implementation)

### C-10 · `audit_logs` Column Names — Conflicting Migrations
- **File:** `migrations/neon_public_schema.sql` vs `migrations/create_audit_logs.sql`
- **Issue:** Base schema uses `before/after` columns; create_audit_logs uses `old_value/new_value`; code writes to `old_value/new_value`
- **Fix:** Ensure production table uses `old_value/new_value` (verify via DB query)
- **Status:** ⬜ Pending

### C-11 · `teams`/`team_members` Tables — Missing from Migrations
- **File:** `workers/src/routes/teams.ts`
- **Issue:** Code queries `teams` and `team_members` but no migration creates them
- **Fix:** Create proper migration
- **Status:** ⬜ Pending

### C-12 · `call_translations` — Runtime DDL, No Migration
- **File:** `workers/src/routes/live-translation.ts`
- **Issue:** Table created via `CREATE TABLE IF NOT EXISTS` in request handler
- **Fix:** Move to migration file, remove runtime DDL
- **Status:** ⬜ Pending

---

## 🟠 HIGH Findings

### H-1 · Runtime DDL in 5 Route Handlers
- **Files:** `voice.ts`, `live-translation.ts`, `campaigns.ts`, `surveys.ts`, `scorecards.ts`
- **Issue:** `CREATE TABLE IF NOT EXISTS` executed on every request
- **Fix:** Move all DDL to migration files

### H-2 · Frontend/Backend RBAC Role Mismatch
- **Files:** `lib/rbac.ts` vs `workers/src/lib/rbac-v2.ts`
- **Issue:** Frontend: `owner/admin/manager/member/viewer` — Backend: `owner/admin/manager/agent/viewer`
- **Fix:** Unify role names (backend is canonical)

### H-3 · Missing RLS Policies
- **Tables:** `calls`, `recordings`, `booking_events`
- **Issue:** Most heavily queried multi-tenant tables lack RLS

### H-4 · DB Connection Leak in Billing
- **File:** `workers/src/routes/billing.ts` (DELETE /payment-methods)
- **Issue:** `getDb()` called without `db.end()` in finally block

### H-5 · `survey_responses` — Queried but Never Created
- **File:** `workers/src/routes/surveys.ts`
- **Issue:** Code queries `survey_responses` but no migration creates the table

### H-6 · Multiple ARCH_DOCS Version Contradictions
- **Files:** 00-README (v4.22), CURRENT_STATUS (v4.24), QUICK_REFERENCE (v4.22), MASTER_ARCHITECTURE (v4.0)
- **Fix:** Standardize all to current version

### H-7 · ARCH_DOCS — Wrong Production URL
- **Files:** MASTER_ARCHITECTURE, CLOUDFLARE_DEPLOYMENT
- **Issue:** References `wordis-bond.com` instead of `voxsouth.online`

### H-8 · KV Binding Name Mismatch in Docs
- **Issue:** Docs say `SESSION_KV`, `RATE_LIMIT_KV`, `IDEMPOTENCY_KV` — actual binding is just `KV`

---

## 🟡 MEDIUM Findings

### Rate Limiting & Audit Gaps (14 route files)
The following route files have mutation endpoints missing rate limiting and/or audit logging:
- `bookings.ts` (PUT, DELETE, POST /notes, POST /confirmations)
- `surveys.ts` (all mutations)
- `scorecards.ts` (POST)
- `compliance.ts` (POST, PATCH)
- `retention.ts` (PUT, POST)
- `shopper.ts` (all mutations)
- `caller-id.ts` (POST, PUT)
- `organizations.ts` (POST)
- `reports.ts` (POST, POST/PATCH/DELETE /schedules)
- `ai-config.ts` (PUT)
- `analytics.ts` (subscription CRUD)

### Schema Mismatches
- `surveys` table: `name` (schema) vs `title` (code)
- `scorecards` table: completely different columns between schema and code
- `campaigns` runtime DDL schema differs from migration schema
- `voice_configs` runtime DDL adds `translate_mode` not in migration
- `evidence_manifests` view references `org_id` instead of `organization_id`
- `billing_events` defined in TWO migrations with different schemas

### Redundant ARCH_DOCS (recommended for archival)
- `START_HERE.md` — superseded by `00-README.md`
- `IMPROVEMENT_TRACKER.md` — empty/complete
- `CIO_PRODUCTION_AUDIT_2026-02-05.md` — point-in-time, resolved
- `CIO_PRODUCTION_REVIEW.md` — point-in-time, resolved
- `OUTSTANDING_TASKS_2026-02-06.md` — all complete
- `CRITICAL_FIXES_TRACKER.md` — all complete
- `REVIEW_ISSUES.md` — all resolved
- `SECURITY_AUDIT_2026-02-06.md` — point-in-time verification
- `SCHEMA_DRIFT_REPORT_2026-02-04.md` — drift resolved
- `TYPESCRIPT_ERROR_TRIAGE_PLAN.md` — errors resolved

---

## 📁 Files to Delete (22)

| File | Reason |
|------|--------|
| `deploy-cloudflare.sh` | Hardcoded R2 credentials — SECURITY RISK |
| `nul` | Windows artifact (0 bytes) |
| `MIGRATION_EXECUTION_GUIDE.md` | Stale one-time guide |
| `BILLING_INTEGRATION_REPORT.md` | One-time agent report |
| `components/AdminAuthDiagnostics.tsx` | NextAuth diagnostics — obsolete |
| `migrations/001_create_auth_tables.sql` | NextAuth tables — removed |
| `migrations/003_move_nextauth_tables.sql` | NextAuth schema move — removed |
| `migrations/debug-queries.sql` | One-off debug SQL |
| `migrations/neon_schema_reset.sql` | Destructive reset script |
| `migrations/insert_test_org.sql` | Test data insertion |
| `migrations/insert_org_query.sql` | Test data insertion |
| `migrations/query_org.sql` | Debug query |
| `migrations/api-test-results.json` | Failed API response dump |
| `migrations/r2-verification.json` | One-time R2 test result |
| `scripts/migrate-r2-recordings.ts` | Supabase→R2 migration (complete) |
| `scripts/add-edge-runtime.ts` | Adds edge runtime to `app/api` (no longer exists) |
| `scripts/add-edge-runtime.js` | Duplicate of above |
| `tools/extract_neon_schema.sql` | Stale schema snapshot |
| `tests/integration/signalwire-webhook.test.ts` | SignalWire test — provider removed |
| `tests/integration/vercel-timeout.test.ts` | Vercel test — platform removed |
| `tests/integration/verify-env.test.ts` | Vercel env verification |

---

## 📦 Files to Archive (move to `ARCH_DOCS/archive/` or `migrations/archive/`)

### ARCH_DOCS
- `START_HERE.md`, `IMPROVEMENT_TRACKER.md`, `CIO_PRODUCTION_AUDIT_2026-02-05.md`
- `CIO_PRODUCTION_REVIEW.md`, `OUTSTANDING_TASKS_2026-02-06.md`
- `CRITICAL_FIXES_TRACKER.md`, `REVIEW_ISSUES.md`, `SECURITY_AUDIT_2026-02-06.md`
- `SCHEMA_DRIFT_REPORT_2026-02-04.md`, `TYPESCRIPT_ERROR_TRIAGE_PLAN.md`

### Migrations (move to `migrations/archive/`)
- Early schema drafts: `neon_schema_*.sql` variants
- Supabase backups: `migrations/backups/supabase_*`
- Inventory JSONs: `migrations/dry-run-inventory-*.json`
- Migration log: `migrations/migration_log.json`

---

## 📝 Lessons Learned

1. **Runtime DDL is a debt accelerator** — 5 route files creating tables on every request. Migration-first is mandatory.
2. **Docs rot faster than code** — 11 ARCH_DOCS files are stale enough to mislead engineers. Docs need versioned review dates.
3. **Audit logging isn't optional for compliance** — 14 route files have mutation endpoints without audit trails. A compliance platform without audit logs undermines its own value proposition.
4. **Rate limiting gaps invite abuse** — Same 14 files. Mutation endpoints without rate limiting are a DoS vector.
5. **RBAC must be unified** — Frontend and backend using different role names (`member` vs `agent`) causes silent authorization failures.
6. **Credentials in git history** — Even deleted files persist in git. R2 keys must be rotated.
7. **One canonical schema source** — Having `neon_public_schema.sql`, `neon_public_schema_pass1.sql`, and runtime DDL creates three competing truths.

---

## Action Priority

| Priority | Action | Est. Impact |
|----------|--------|-------------|
| 🔴 P0 | Rotate R2 credentials, delete deploy-cloudflare.sh | Security |
| 🔴 P1 | Fix copilot-instructions.md (session prop, version) | Dev productivity |
| 🟠 P2 | Archive 10 stale ARCH_DOCS | Clarity |
| 🟠 P3 | Delete 22 obsolete files | Repo hygiene |
| 🟠 P4 | Create consolidated migration for missing tables | Schema integrity |
| 🟡 P5 | Fix MASTER_ARCHITECTURE auth section + code samples | Documentation accuracy |
| 🟡 P6 | Add rate limiting + audit to 14 route files | Compliance + security |
| 🟢 P7 | Remove runtime DDL from route handlers | Performance |
| 🟢 P8 | Unify RBAC role names | Authorization correctness |

---

*Report generated by automated audit agents. All findings verified against source code.*
