# Word Is Bond — Agentic Workflow Plan

**Created:** February 7, 2026  
**Purpose:** Define a structured, self-feeding agent + sub-agent system to systematically resolve all backlog items  
**Input:** [BACKLOG.md](../BACKLOG.md) — 31 items across 4 tiers

---

## Architecture: Producer-Consumer Agent Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT (Main)                  │
│  Reads BACKLOG.md → dispatches work → updates status         │
│  Enforces ARCH_DOCS rules on every change                    │
└──────────┬───────────────────────────────┬───────────────────┘
           │                               │
    ┌──────▼──────┐                 ┌──────▼──────┐
    │  DISCOVERY   │                │  EXECUTION   │
    │  SUB-AGENTS  │                │  SUB-AGENTS  │
    │  (Producers) │                │  (Consumers) │
    └──────┬──────┘                 └──────┬──────┘
           │                               │
           │  Append new items             │  Process items
           │  to BACKLOG.md                │  sequentially
           │                               │
    ┌──────▼──────────────────────────────▼───────┐
    │              BACKLOG.md (Shared Queue)        │
    │  Source of truth for all work items           │
    │  Status: [ ] → [~] → [x]                    │
    └──────────────────────────────────────────────┘
           │
    ┌──────▼──────┐
    │  VALIDATION  │
    │  SUB-AGENTS  │
    │  (Verifiers) │
    └─────────────┘
```

---

## Agent Roles

### 1. ORCHESTRATOR (Main Agent)

**Responsibility:** Sequence work, enforce design rules, dispatch sub-agents  
**Rules:**
- Always reads BACKLOG.md before dispatching
- Marks items `[~]` before starting, `[x]` when verified
- Enforces ARCH_DOCS design principles on every change
- Never deploys without running `npm run build` first
- Logs results to BACKLOG.md and LESSONS_LEARNED.md

### 2. DISCOVERY Sub-Agents (Producers)

**Responsibility:** Find NEW issues during execution and append to BACKLOG.md  
**Trigger:** Run as side-effects during execution work  
**Types:**
- **TS Error Scanner:** Runs `get_errors` after each batch of fixes, identifies new errors
- **Build Verifier:** Runs `npm run build` after changes, captures new failures
- **Pattern Scanner:** Greps for anti-patterns (raw fetch, console.log, missing db.end, etc.)
- **Dependency Auditor:** Checks for unused/outdated packages

### 3. EXECUTION Sub-Agents (Consumers)

**Responsibility:** Fix one backlog item at a time, following ARCH_DOCS patterns  
**Rules:**
- Takes EXACTLY ONE `[ ]` item from BACKLOG.md
- Reads relevant source files
- Applies fix following ARCH_DOCS patterns
- Runs `get_errors` on affected files
- Reports result back to Orchestrator

### 4. VALIDATION Sub-Agents (Verifiers)

**Responsibility:** Verify fixes don't introduce regressions  
**Trigger:** After each execution batch  
**Checks:**
- TypeScript compile (`get_errors`)
- Build passes (`npm run build`)
- No new anti-patterns introduced
- ARCH_DOCS rules not violated

---

## Execution Phases

### Phase 1: TypeScript Compile Fixes (BL-001 → BL-010)

**Goal:** Zero compile errors  
**Sequence:** (order matters — dependencies between items)

```
Step 1: BL-004 — Fix z.record() calls (9 schema errors, no dependencies)
Step 2: BL-003 — Add Hono Variables type for session (20+ errors cleared)
Step 3: BL-001 — Fix writeAuditLog return type (6 files × .catch() errors)
Step 4: BL-010 — Add logger import to bond-ai.ts (2 errors)
Step 5: BL-008 — Fix db scope in team.ts finally blocks (2 errors)
Step 6: BL-009 — Type Telnyx API responses in webrtc.ts (4 errors)
Step 7: BL-002 — Audit all writeAuditLog call sites for correct property names
Step 8: BL-027 — Fix ai-transcribe.ts audit log properties
→ VALIDATION: Run get_errors — expect 0 compile errors
→ DISCOVERY: Scan for any NEW errors introduced
```

### Phase 2: Security Hardening (BL-005 → BL-007)

**Goal:** Close all security gaps  
**Sequence:**

```
Step 1: BL-005 — Add AssemblyAI webhook HMAC verification
Step 2: BL-006 — Add org_id scoping to AssemblyAI webhook UPDATE
Step 3: BL-007 — Add auth to health sub-endpoints OR remove cross-tenant data
→ VALIDATION: Build passes, no new errors
→ DISCOVERY: Check for similar patterns in other webhook handlers
```

### Phase 3: Audit Log Coverage (BL-019)

**Goal:** 100% audit coverage on all write operations  
**Strategy:** Sub-agent processes one route file at a time, adds writeAuditLog() to each POST/PUT/DELETE handler  

```
Batch 1: scorecards.ts, surveys.ts, campaigns.ts (high-value mutations)
Batch 2: retention.ts, compliance.ts, shopper.ts (compliance-critical)
Batch 3: teams.ts, organizations.ts, bond-ai.ts (user management)
Batch 4: ai-config.ts, audio.ts, webrtc.ts, ai-llm.ts (AI/media)
Batch 5: reports.ts, caller-id.ts, admin.ts, test.ts, reliability.ts (remaining)
→ Add new AuditAction constants as needed
→ VALIDATION: Grep all route files for writeAuditLog coverage
→ DISCOVERY: Check for missing finally{db.end()} in same files
```

### Phase 4: Feature Completions (BL-011 → BL-018)

**Goal:** Wire up stub implementations to real services  
**Sequence:** (ordered by user impact)

```
Step 1: BL-011 + BL-012 — Wire Telnyx Call Control for start/end calls
Step 2: BL-013 — Implement transcription retry with AssemblyAI
Step 3: BL-014 — Implement R2 pre-signed URLs for recordings
Step 4: BL-015 — Wire audio transcription to AssemblyAI
Step 5: BL-016 — Fix TTS error handling
Step 6: BL-017 — Implement storage usage calculation
Step 7: BL-018 — Audit and disable/implement broken frontend features
→ VALIDATION: Smoke test each feature endpoint
→ DISCOVERY: Check for related TODO/FIXME items
```

### Phase 5: Infrastructure & Polish (BL-020 → BL-031)

**Goal:** Close remaining gaps  
**Sequence:**

```
Step 1: BL-023 — Implement session refresh tokens
Step 2: BL-029 — Add "how-it-works" scroll target
Step 3: BL-022 — Split lib/ into sub-modules
Step 4: BL-030 — Expand billing UI
Step 5: BL-031 — Build webhook config UI
Manual: BL-020 (WAF rules), BL-024 (R2 credential rotation)
Deferred: BL-021 (Playwright), BL-026 (Workers CI)
```

---

## ARCH_DOCS Compliance Checklist (Applied to EVERY Change)

Every execution sub-agent MUST verify these before marking an item `[x]`:

- [ ] DB connection: `getDb(c.env)` BEFORE try block, `db.end()` in finally
- [ ] Connection order: `NEON_PG_CONN || HYPERDRIVE` (never reversed)
- [ ] Session access: `session.organization_id` and `session.user_id` (snake_case)
- [ ] Multi-tenant: Every query includes `organization_id` in WHERE
- [ ] Parameterized SQL: `$1, $2, $3` only — never string interpolation
- [ ] Audit logging: `writeAuditLog()` on all mutations (fire-and-forget)
- [ ] Audit columns: Interface uses `before`/`after`, maps to `old_value`/`new_value`
- [ ] Rate limiting: Mutation endpoints have rate limit middleware
- [ ] API client: Frontend uses `apiGet/apiPost/apiPut/apiDelete` — never raw fetch
- [ ] Static export: No server-side code in Next.js (no getServerSideProps, no cookies(), no headers())
- [ ] Structured logging: Use `logger` from `workers/src/lib/logger.ts` — no console.log
- [ ] Error responses: Never leak `err.message` or stack traces to clients
- [ ] CORS: Custom headers added to both `allowHeaders` and `exposeHeaders`

---

## Results Documentation

After each phase, update:

1. **BACKLOG.md** — Mark items `[x]`, add any new items discovered
2. **ARCH_DOCS/CURRENT_STATUS.md** — Update version, recent fixes
3. **ARCH_DOCS/LESSONS_LEARNED.md** — Document any new patterns or pitfalls
4. **ROADMAP.md** — Update progress counters if applicable

---

## Success Criteria

| Metric | Target | Current |
|--------|--------|---------|
| TypeScript compile errors | 0 | 63 |
| Security gaps (CRITICAL) | 0 | 3 |
| Audit log coverage | 100% of write ops | ~50% |
| Backlog items resolved | 31/31 | 0/31 |
| Build status | ✅ PASS | ⚠️ (TS errors) |
