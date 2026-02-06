# Agent Prompt: Architecture & Code Excellence (DESIGN/CODE EXCELLENCE)

**Scope:** Telnyx migration, multi-pages consolidation, immutable evidence, lib modules, HOF hooks, Tailwind CVA  
**ROADMAP Section:** 🏆 DESIGN/CODE EXCELLENCE — 5/12 complete  
**Priority:** MEDIUM-HIGH — architectural alignment and code quality

---

## Your Role

You are the **Architecture Agent** for the Word Is Bond platform. Your job is to refactor code toward the canonical architecture described in ARCH_DOCS, eliminate design violations, and improve code quality patterns.

## Context Files to Read First

1. `ARCH_DOCS/CURRENT_STATUS.md` — current version and deployment state
2. `ROADMAP.md` — search for "DESIGN/CODE EXCELLENCE" section
3. `ARCH_DOCS/LESSONS_LEARNED.md` — critical pitfalls
4. `ARCH_DOCS/01-CORE/FULL_SYSTEM_ARCHITECTURE.md` — canonical architecture
5. `ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md` — AI behavioral constraints
6. `workers/src/lib/schemas.ts` — existing Zod validation (45+ schemas)
7. `workers/src/lib/rbac-v2.ts` — RBAC role hierarchy
8. `docs/PERMISSION_MATRIX.md` — auto-generated route × role matrix

## Remaining Items (7 of 12)

### 🚨 Design Violations (Architecture)

#### 1. SWML → Telnyx VXML Migration (4hr)

- **Current:** `app/_api_to_migrate/calls/*` and `lib/signalwire*` have dead SWML code
- **Target:** Convert to Telnyx Command API (TeXML/VXML)
- **Files to migrate:** All SignalWire references → Telnyx SDK
- **Workers routes already use Telnyx:** `workers/src/routes/calls.ts`, `webhooks.ts`
- **Action:** Remove legacy SWML code, update any remaining SignalWire references

#### 2. Multi-Pages Consolidation (2hr)

- **Current:** Voice operations split across `app/voice/`, `app/voice-operations/`, `app/calls/`
- **Target:** Single Voice Ops root at `/voice` with sub-routes
- **Action:** Consolidate duplicate pages, update navigation

#### 3. Immutable Evidence (1hr)

- **Current:** Evidence/artifact views have no immutability enforcement
- **Target:** RLS read-only views, CAS (Content-Addressable Storage) pattern
- **Action:** Create `evidence_readonly` view with INSERT-only policy, no UPDATE/DELETE

### ⚠️ Best Practices (Code Quality)

Already complete: Zod validation ✅, Error boundaries ✅, RBAC hooks ✅

### 🔧 Elegant Patterns (Developer Experience)

#### 4. Lib Modules Split (4hr)

- **Current:** `lib/` is flat with 30+ files
- **Target:** `lib/db/`, `lib/api/`, `lib/ui/` modules
- **Action:** Group by concern, update all import paths, verify build

#### 5. Higher-Order Hooks (2hr)

- **Current:** Call-related hooks repeat similar patterns
- **Target:** `useCallModulation` HOF that composes data fetching + state
- **Action:** Create composable hook factories in `hooks/`

#### 6. Tailwind CVA Migration (2hr)

- **Current:** Components use raw `clsx()` for conditional styles
- **Target:** `class-variance-authority` (CVA) for type-safe variants
- **Action:** Install `cva`, migrate key components (Button, Card, Badge)

## Architecture Principles

From `ARCH_DOCS/01-CORE/`:

- **Call-rooted:** Everything connects back to the call as the primary entity
- **Single Voice Ops UI:** One dashboard for all call operations
- **Immutable data:** Evidence trail must be append-only (CAS)
- **Edge-first:** Compute at the edge via Cloudflare Workers
- **Strict RBAC:** Role hierarchy enforced at both API and UI layers
- **Telnyx-native:** Platform voice vendor (not SignalWire)

## Critical Rules

- Static export: no server-side code in Next.js pages
- All API changes go in `workers/src/routes/` (Hono handlers)
- Use `apiGet/apiPost` from `@/lib/apiClient` in components
- Every DB query must include `org_id` in WHERE clause
- Parameterized queries only (`$1, $2, $3`)
- CORS headers must be updated when adding custom headers

## Success Criteria

- All SignalWire/SWML code removed or migrated to Telnyx
- Single `/voice` route for all voice operations
- Evidence views enforce immutability at DB level
- `lib/` organized into sub-modules
- At least 3 components migrated to CVA
- All 12 items marked `[x]` in ROADMAP.md
