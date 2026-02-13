# Feature Validation Process — Word Is Bond Platform

**Version:** 1.0  
**Created:** February 8, 2026  
**Status:** Active  
**Owner:** Engineering Team

## 1. Overview

This document defines the **standardized process** for validating, testing, and confirming every feature in the Word Is Bond platform. The process is designed to be executed by both human engineers and AI agents (agentic flow).

## 2. Validation Levels

Every feature must pass through **four validation levels** before it's confirmed operational:

### Level 1 — Route Reachability (L1)

- **What:** Verify the HTTP endpoint exists and responds (not 404)
- **How:** Unauthenticated GET/POST to each route
- **Pass:** Status ≠ 404 (401/403 = route exists, requires auth)
- **Fail:** Status = 404 (route not deployed)
- **Tool:** `tests/production/api-live.test.ts`

### Level 2 — Auth Gate Verification (L2)

- **What:** Verify auth middleware correctly protects endpoints
- **How:** Unauthenticated request → expect 401; Authenticated request → expect 200/201
- **Pass:** Unauthenticated = 401, Authenticated = 2xx
- **Fail:** Unauthenticated gets 2xx (security hole) or Authenticated gets 401 (auth broken)
- **Tool:** `tests/production/feature-validation.test.ts`

### Level 3 — Functional Correctness (L3)

- **What:** Verify the feature does what it's supposed to do
- **How:** Authenticated CRUD operations with valid data
- **Pass:** Expected response shape and data
- **Fail:** Wrong response, missing fields, DB inconsistency
- **Tool:** `tests/production/feature-validation.test.ts`

### Level 4 — Cross-Cutting Concerns (L4)

- **What:** Verify audit logging, tenant isolation, rate limiting, CORS
- **How:** Check audit_logs table after mutations; verify org scoping
- **Pass:** Audit entry exists with correct action; data is org-scoped
- **Fail:** Missing audit trail; cross-tenant data leak
- **Tool:** `tests/production/feature-validation.test.ts`

## 3. Feature Registry

The **Feature Registry** (`tests/production/feature-registry.ts`) is the single source of truth for all features. Each entry defines:

```typescript
interface FeatureDefinition {
  id: string // Unique feature identifier
  name: string // Human-readable name
  category: FeatureCategory
  routeFile: string // workers/src/routes/<file>.ts
  endpoints: EndpointDef[]
  requiresAuth: boolean
  requiresPlan?: string // Plan tier gate (free/starter/pro/business/enterprise)
  dbTables: string[] // Database tables used
  auditActions: string[] // Expected audit log actions
  dependencies: string[] // Other features this depends on
  status: 'active' | 'beta' | 'deprecated'
}
```

## 4. Agentic Flow

The validation system uses a **three-tier agent architecture**:

### Orchestrator Agent (Level 0)

- Reads the Feature Registry
- Spawns sub-agents for each validation level
- Collects results and generates reports
- Decides pass/fail and recommends actions
- **File:** `scripts/validate-all.ts`

### Validation Agents (Level 1)

- One agent per validation level (L1-L4)
- Executes tests for ALL features at that level
- Reports results to orchestrator
- **Files:** Individual test suites in `tests/production/`

### Feature Agents (Level 2)

- One agent per feature when deep investigation needed
- Runs all 4 levels for a single feature
- Used for debugging failures
- **Invoked:** When L1/L2/L3 agent reports failure

## 5. Validation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                        │
│  1. Load Feature Registry                                   │
│  2. Check API health                                        │
│  3. Authenticate (get session token)                        │
│  4. Dispatch validation levels                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐  ┌───────────┐  ┌──────────┐
   │ L1: Route│  │ L2: Auth  │  │ L3: Func │
   │ Reach    │  │ Gate      │  │ Test     │
   │          │  │           │  │          │
   │ 172 eps  │  │ 172 eps   │  │ per feat │
   └────┬─────┘  └─────┬─────┘  └─────┬────┘
        │              │              │
        └──────────────┴──────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  L4: Cross-Cut  │
              │  Audit, RBAC,   │
              │  Tenant ISO     │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  REPORT CARD    │
              │  ✅ 35/37 PASS  │
              │  ⚠️  2/37 WARN  │
              │  ❌ 0/37 FAIL  │
              └─────────────────┘
```

## 6. Running Validations

### Full Suite (All Features, All Levels)

```bash
npm run test:validate          # Run complete validation
npm run test:validate:quick    # L1 + L2 only (fast)
```

### Single Feature

```bash
npm run test:validate -- --feature=live-translation
npm run test:validate -- --feature=voice-config
```

### Single Level

```bash
npm run test:prod:api          # L1: Route reachability
npm run test:validate:auth     # L2: Auth gates
npm run test:validate:func     # L3: Functional
npm run test:validate:audit    # L4: Cross-cutting
```

## 7. Report Format

Every validation run produces a structured report:

```json
{
  "timestamp": "2026-02-08T16:30:00Z",
  "duration_ms": 45000,
  "api_version": "4.24",
  "overall": "PASS",
  "features": {
    "voice-config": { "l1": "PASS", "l2": "PASS", "l3": "PASS", "l4": "PASS" },
    "live-translation": { "l1": "PASS", "l2": "PASS", "l3": "PASS", "l4": "PASS" },
    "calls": { "l1": "PASS", "l2": "PASS", "l3": "WARN", "l4": "PASS" }
  },
  "failures": [],
  "warnings": ["calls: L3 response time 1800ms (expected <1000ms)"]
}
```

## 8. Continuous Validation

- **On Deploy:** Orchestrator runs L1+L2 automatically
- **Nightly:** Full L1-L4 suite via cron
- **On Feature Build:** Feature-specific L1-L4 before merge
- **Manually:** Any level, any feature, anytime
