# Word Is Bond — Agentic Workflow Plan

**Created:** February 7, 2026  
**Last Updated:** February 8, 2026  
**Purpose:** Define a structured, self-feeding agent + sub-agent system to systematically resolve all backlog items  
**Input:** [BACKLOG.md](../BACKLOG.md) — 43 items across 4 tiers + 9 new critical items

---

## Core Operating Principles

### 1. Sequential Processing Order

- **ALWAYS** process items in numerical order (BL-001, BL-002, BL-003...)
- **NEVER** skip ahead or work on items out of sequence
- **ONLY** mark next item `[~]` when previous item is `[x]`

### 2. Best Practices Enforcement

- **ALWAYS** use modern TypeScript patterns and idioms
- **ALWAYS** follow DRY principles and avoid code duplication
- **ALWAYS** implement proper error handling and validation
- **ALWAYS** use parameterized queries and secure coding practices
- **NEVER** use deprecated APIs or anti-patterns

### 3. ARCH_DOCS Standards Compliance

- **ALWAYS** adhere to ARCH_DOCS standards and patterns
- **ONLY** deviate from standards if they are provably incorrect or obsolete
- **ALWAYS** document any standard updates with justification
- **ALWAYS** maintain consistency with established patterns

### 4. Elegant Code Requirements

- **ALWAYS** write clean, readable, maintainable code
- **ALWAYS** use descriptive variable and function names
- **ALWAYS** add appropriate comments for complex logic
- **ALWAYS** follow consistent formatting and style
- **NEVER** write "clever" code that sacrifices clarity

### 5. Documentation Standards

- **ALWAYS** document results, summaries, and lessons learned
- **ALWAYS** update BACKLOG.md with new issues discovered
- **ALWAYS** maintain accurate status tracking
- **ALWAYS** provide clear rationale for decisions and changes

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

**Responsibility:** Sequence work, enforce design rules, dispatch sub-agents, document results  
**Rules:**

- Always reads BACKLOG.md before dispatching
- Marks items `[~]` before starting, `[x]` when verified
- Enforces ARCH_DOCS design principles on every change
- Never deploys without running `npm run build` first
- Documents all results, summaries, lessons learned, and new issues
- Maintains sequential processing order (BL-001 → BL-002 → BL-003...)
- Uses only best practices and elegant code patterns

### 2. DISCOVERY Sub-Agents (Producers)

**Responsibility:** Find NEW issues during execution and append to BACKLOG.md bottom  
**Trigger:** Run as side-effects during execution work  
**Documentation Requirements:**

- **ALWAYS** add new issues to bottom of BACKLOG.md list
- **ALWAYS** provide detailed descriptions with impact assessment
- **ALWAYS** categorize appropriately (🔴 CRITICAL, 🟠 HIGH, etc.)
- **ALWAYS** include source attribution and root cause analysis

**Types:**

- **TS Error Scanner:** Runs `get_errors` after each batch of fixes, identifies new errors
- **Build Verifier:** Runs `npm run build` after changes, captures new failures
- **Pattern Scanner:** Greps for anti-patterns (raw fetch, console.log, missing db.end, etc.)
- **Dependency Auditor:** Checks for unused/outdated packages

### 3. EXECUTION Sub-Agents (Consumers)

**Responsibility:** Fix one backlog item at a time, following ARCH_DOCS patterns with elegant code  
**Rules:**

- Takes EXACTLY ONE `[ ]` item from BACKLOG.md
- Reads relevant source files and understands context
- Applies fix following ARCH_DOCS patterns and best practices
- Uses elegant, maintainable code with proper error handling
- Runs `get_errors` on affected files
- Documents implementation details and any challenges encountered
- Reports result back to Orchestrator with lessons learned

### 4. VALIDATION Sub-Agents (Verifiers)

**Responsibility:** Verify fixes don't introduce regressions, document findings  
**Trigger:** After each execution batch  
**Documentation Requirements:**

- **ALWAYS** document validation results and any issues found
- **ALWAYS** provide specific error messages and line numbers
- **ALWAYS** suggest remediation steps for any regressions
- **ALWAYS** update BACKLOG.md with any new issues discovered

**Checks:**

- TypeScript compile (`get_errors`)
- Build passes (`npm run build`)
- No new anti-patterns introduced
- ARCH_DOCS rules not violated
- Functional testing of fixed features

---

## Documentation Requirements

### Results Documentation Standards

**ALL agents MUST document:**

1. **Results Summary**
   - What was accomplished
   - Success/failure status
   - Impact assessment
   - Time/effort metrics

2. **Technical Details**
   - Files modified
   - Code changes made
   - Patterns used
   - Challenges overcome

3. **Lessons Learned**
   - What worked well
   - What could be improved
   - Best practices discovered
   - Pitfalls to avoid

4. **New Issues/Backlog Items**
   - Any new problems discovered
   - Regression issues introduced
   - Follow-up work identified
   - Enhancement opportunities

### Documentation Locations

- **BACKLOG.md**: Status updates, new items, progress tracking
- **CURRENT_STATUS.md**: System state changes, version updates
- **LESSONS_LEARNED.md**: Technical lessons, pattern documentation
- **ARCH_DOCS**: Standard updates, architectural changes

---

## Execution Phases

### Phase 0: New Critical Issues (BL-035 → BL-043) — PRIORITY

**Goal:** Address critical issues from comprehensive audit  
**Sequence:** (order matters — data integrity first)

```
Step 1: BL-035 — Fix 4 orphaned users (database integrity)
Step 2: BL-036 — Debug and restore audit logging
Step 3: BL-037 — Add primary key to tool_access table
Step 4: BL-038 — Update translation documentation
Step 5: BL-039 — Fix JSON syntax error
Step 6: BL-040 — Fix React hooks dependencies
Step 7: BL-041 — Escape HTML entities in JSX
Step 8: BL-042 — Remove console statements
Step 9: BL-043 — Fix accessibility violations
→ VALIDATION: Run comprehensive audit checks
→ DISCOVERY: Identify any additional issues
```

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

## Current Status Tracking

### Items Being Worked On

- **None currently active** - All items in `[ ]` open status

### Completed Items

- **29/43 items resolved** (67% complete)
- All original 34 items processed
- 9 new critical items added from comprehensive audit

### Sequential Processing Status

- **Next Item:** BL-035 (orphaned users fix)
- **Blockers:** None identified
- **Priority Focus:** Database integrity and security issues

---

## Success Criteria

| Metric                    | Target            | Current | Status         |
| ------------------------- | ----------------- | ------- | -------------- |
| TypeScript compile errors | 0                 | 0       | ✅ ACHIEVED    |
| Security gaps (CRITICAL)  | 0                 | 3       | 🔴 NEEDS WORK  |
| Database integrity issues | 0                 | 3       | 🔴 NEEDS WORK  |
| Audit log coverage        | 100% of write ops | ~50%    | 🟡 PARTIAL     |
| Documentation accuracy    | 100%              | 95%     | 🟡 MINOR GAPS  |
| Code quality warnings     | 0                 | 103     | 🟡 NEEDS WORK  |
| Backlog items resolved    | 43/43             | 29/43   | 🟡 IN PROGRESS |
| Build status              | ✅ PASS           | ✅ PASS | ✅ ACHIEVED    |

---

## Assessment Results & Updates Summary

### Comprehensive Audit Completed (February 8, 2026)

**Audit Scope:** ARCH_DOCS soundness, codebase quality, live database integrity  
**Findings:** 9 new critical issues identified requiring immediate attention

### New Issues Added to Backlog

**🔴 Critical Database Issues (BL-035, BL-036, BL-037):**

- 4 orphaned users violating multi-tenant isolation
- Complete lack of audit log entries (0 records)
- Missing primary key constraint on tool_access table

**🟠 High Priority Issues (BL-038, BL-039):**

- Outdated documentation referencing legacy SignalWire architecture
- JSON syntax error in validation project configuration

**🟡 Quality Issues (BL-040, BL-041, BL-042, BL-043):**

- 103 React hooks dependency warnings
- 50+ unescaped HTML entities in JSX
- 8 console statements in production code
- Accessibility violations with invalid ARIA attributes

### Updated Agent Instructions

**Sequential Processing:** Enforced strict numerical order (BL-001 → BL-043)  
**Best Practices:** Mandatory modern patterns, DRY principles, secure coding  
**ARCH_DOCS Compliance:** Required unless standards proven incorrect  
**Elegant Code:** Clean, readable, maintainable code with proper documentation  
**Documentation Standards:** Comprehensive results, summaries, lessons learned, new issues

### Current System State

**Production Readiness:** 88% (excellent foundation, critical fixes needed)  
**Architecture:** 95% (hybrid Pages+Workers well-executed)  
**Security:** 95% (comprehensive measures, minor gaps)  
**Code Quality:** 82% (functional but needs cleanup)  
**Documentation:** 90% (one critical inaccuracy fixed)

### Next Steps

1. **Immediate Priority:** Process BL-035 (orphaned users) through BL-043 sequentially
2. **Focus Areas:** Database integrity, security hardening, code quality
3. **Validation:** Run comprehensive checks after each phase
4. **Documentation:** Update all status files with progress and lessons learned

### Lessons Learned from Assessment

**Strengths Confirmed:**

- Excellent architectural foundation with proper separation of concerns
- Comprehensive security measures and compliance features
- Successful migration from legacy vendors (SignalWire → Telnyx)
- Robust deployment pipeline and health monitoring

**Areas for Improvement:**

- Need more rigorous pre-deployment validation
- Database integrity checks should be automated
- Documentation maintenance requires dedicated process
- Code quality linting should be more strict

**Process Improvements:**

- Comprehensive audits should be scheduled quarterly
- Agent workflow should include validation phases
- Documentation standards need enforcement mechanisms
- Sequential processing prevents conflicts and ensures completeness
