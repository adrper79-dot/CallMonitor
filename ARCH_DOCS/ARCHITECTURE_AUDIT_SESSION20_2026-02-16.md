# Architecture Cohesion & Design Mastery Audit — Session 20

**Date:** February 16, 2026  
**Scope:** ARCH_DOCS intent alignment, live Neon schema cohesion, codebase contract integrity, defect triage/remediation, obsolete artifact cleanup  
**Method:** Multi-agent research + targeted remediation + production deployment validation

---

## 1) Objective & Standards Ingest

This audit used ARCH_DOCS as the governing baseline, with emphasis on:

- Static-export Next.js constraints (`output: 'export'`, no server-side Next APIs)
- Worker-only API boundary under `workers/src/routes/*`
- Auth + RBAC (`requireAuth` and `requireRole` where privilege escalation exists)
- Multi-tenant isolation (`organization_id` scoping)
- Parameterized SQL only
- Canonical utility usage (`getDb`, `writeAuditLog`, rate-limit middleware)
- Documentation and backlog as system-of-record for architecture drift

Primary references ingested:

- `ARCH_DOCS/CURRENT_STATUS.md`
- `ARCH_DOCS/MASTER_ARCHITECTURE.md`
- `ARCH_DOCS/LESSONS_LEARNED.md`
- `BACKLOG.md`

---

## 2) Live Neon Ingest (Production)

Neon project inspected:

- **Project:** `WordIsBond` (`misty-sound-29419685`)
- **Default branch:** `production` (`br-nameless-truth-ahjrrkzv`)
- **PostgreSQL:** 17

Schema checks were executed against live production for cohesion validation.

Validated table presence included:

- `collection_accounts`
- `collection_callbacks`
- `collection_notes`
- `collection_payments`

Validated key column reality (live):

- `collection_notes` uses `created_by` (not `user_id`)
- `collection_callbacks` uses `scheduled_for`
- `collection_accounts` uses `last_contacted_at`, `promise_date`
- `collection_payments` uses `amount`, `created_at`

---

## 3) Multi-Agent Findings Summary

Two subagents were run:

1. **Standards defect scan agent** (architecture + runtime risk)
2. **Obsolete artifact scan agent** (safe cleanup opportunities)

### High-confidence issues identified

- Unauthorized execution path in `/api/test/run-all`
- Frontend API contract drift on several paths
- Collections note insert/schema mismatch (`user_id` vs `created_by`)
- Potential connection hygiene concerns with ad-hoc audit DB clients
- Integration hook endpoint-family drift (`/integrations*` paths)
- Ambiguous multi-org session org selection pattern in auth resolver

---

## 4) Repairs Implemented in This Session

### Security / Access control

- `workers/src/routes/test.ts`
  - `/api/test/run-all` now uses `requireRole(c, 'admin')`
  - Unauthorized callers receive 403 response

### Runtime contract fixes (frontend)

- `components/settings/CrmFieldMapper.tsx`
  - `/bond-ai/chat` → `/api/bond-ai/chat`

- `components/cockpit/QuickActionModals.tsx`
  - `/api/payments/link` → `/api/payments/links`

### Collections schema cohesion fixes

- `workers/src/routes/collections.ts`
  - `collection_notes` insert now writes `created_by`
  - `/daily-stats` aligned with live schema and hardened:
    - uses `last_contacted_at`, `promise_date`
    - checks table existence via `to_regclass` for safe fallback behavior
    - integrates `collection_callbacks` due-today count when present
  - `/callbacks` now prefers `collection_callbacks` + account join and falls back to legacy `promise_date` source when needed

### DB hygiene improvements

- `workers/src/routes/quickbooks.ts`
- `workers/src/routes/google-workspace.ts`
  - Removed `writeAuditLog(getDb(...))` ad-hoc pattern
  - Added scoped audit DB clients with explicit `db.end()` in `finally`

### RBAC consistency

- `workers/src/routes/organizations.ts`
  - `GET /:id` now enforces `requireRole(c, 'admin')` to match endpoint intent

---

## 5) Deployment & Runtime Validation

Workers deployed successfully after fixes.

- **Version:** `08ec024e-bb43-438b-93a7-0880271ac942`

Live probes validated:

- `POST /api/test/run-all` (unauthenticated) now returns **403** (expected)
- Collections endpoints no longer fail at unauthenticated entrypoint level (auth-gated response path validated)

---

## 6) Obsolete Cleanup Performed

Removed obsolete local artifacts:

- `simulation-results.log`
- `nul` (Windows reserved-name artifact, removed via long-path literal cleanup)

Conservative cleanup posture maintained for tracked report/doc artifacts pending explicit retention policy decision.

---

## 7) Remaining Open Risks / Queue (Backlog-linked)

See newly added backlog items:

- `BL-243` — Integration hooks endpoint remap to canonical `/api/*` contracts
- `BL-244` — Deterministic organization binding in session resolver (`auth.ts`)
- `BL-245` — Settlement route contract mismatch (`/api/settlements`)
- `BL-247` — Stale simulator references in docs

These are open by design and should be handled in the next remediation pass.

---

## 8) Lessons Learned (Session 20)

1. **Route shape drift is one of the highest-frequency runtime regressions** in this codebase; endpoint linting or route contract tests would catch this early.
2. **Live schema validation should precede all SQL edits** (especially in collections and productivity modules) to avoid latent 500s.
3. **Fire-and-forget audit writes still require connection lifecycle discipline** even when errors are intentionally non-fatal.
4. **Admin-only operational routes must never have fallback unauthenticated execution paths**, even for internal testing utilities.

---

## 9) Agent/Subagent Execution Pattern Used

- Parent agent orchestrated standards ingest, DB introspection, and patch/deploy flow.
- Subagent A specialized in standards conformance defect detection.
- Subagent B specialized in obsolete artifact and dead-code risk ranking.
- Parent agent merged, verified, and applied only high-confidence remediations.

This pattern reduced false positives while preserving delivery speed.

---

## 10) Open Questions for Next Pass

1. Should `useIntegrations.ts` and `useCrmIntegration.ts` be unified behind a generated API client contract to prevent path drift?
2. Should `collection_callbacks` become the single source of truth (and deprecate `promise_date` callback semantics), with a migration/backfill strategy?
3. Should we add a CI contract test that verifies every frontend `/api/*` path maps to a mounted Worker route?
4. Should session records carry an explicit active organization context to eliminate `LIMIT 1` org ambiguity permanently?

---

## 11) Recommended Next Iteration (Repair → Repeat)

1. Implement `BL-243` endpoint remap + response adapters
2. Implement `BL-244` deterministic session org resolution
3. Resolve `BL-245` settlements contract by route creation or frontend rewire
4. Complete `BL-247` documentation cleanup
5. Run production test subset + post-deploy health check

This completes one full **audit → repair → document** cycle and establishes the next queue for continuous architecture cohesion.
