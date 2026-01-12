# Why We Keep Missing Issues - Root Cause Analysis

## Problem Statement
After 4+ review cycles, we're still finding issues (most recently: `business` plan type missing from TypeScript definitions, causing UI to not show live translation toggle).

## Root Causes Identified

### 1. **Lack of Systematic Cross-Reference Checking**
- **What happened:** We added `'business'` to FEATURE_PLANS but didn't check if it existed in the Plan type definition
- **Why it happened:** Reviews were file-by-file, not cross-referencing related definitions
- **Impact:** Type system allowed invalid state, UI logic couldn't match properly

### 2. **Incomplete Type System Validation**
- **What happened:** TypeScript didn't error because `FEATURE_PLANS` uses `Record<string, Plan[]>` but the array literal wasn't type-checked
- **Why it happened:** No compile-time check that all Plan values in arrays are valid Plan types
- **Impact:** Runtime mismatch between capability logic and type definitions

### 3. **Missing Integration Testing Mindset**
- **What happened:** Backend was tested in isolation, UI was tested in isolation, but not together
- **Why it happened:** Focused on "does this file work?" vs "does the system work end-to-end?"
- **Impact:** Integration bugs only found when trying to use the feature

### 4. **Documentation-Code Drift**
- **What happened:** ARCH_DOCS mentioned `business` plan, code implemented it, but TypeScript types didn't include it
- **Why it happened:** Multiple sources of truth, no single validation step
- **Impact:** Documentation said it worked, code partially worked, types were incomplete

### 5. **Review Scope Too Narrow**
- **What happened:** Each review focused on "live translation" files but not supporting infrastructure
- **Why it happened:** Assumed RBAC/type system was stable
- **Impact:** Infrastructure changes needed to support new features were missed

## Specific Gaps in Previous Reviews

### Review Cycle 1 (SWML Implementation)
✅ Checked: SWML syntax, endpoint logic, database schema
❌ Missed: Plan type definitions, capability type consistency

### Review Cycle 2 (Bug Fixes)
✅ Checked: SWML verbs, recording callbacks, webhook detection
❌ Missed: RBAC type system, UI integration with capabilities

### Review Cycle 3 (Authentication)
✅ Checked: API routes, headers, health endpoints
❌ Missed: Live translation UI visibility (assumed it was working)

### Review Cycle 4 (UI Discovery)
✅ Found: Missing `business` plan type
❌ Could have found earlier: If we tested UI integration in cycle 1

## What Should Have Been Done

### 1. **Type System Audit**
```typescript
// Should have checked:
1. Is 'business' in the Plan type? ❌ NO → FIX NEEDED
2. Are all FEATURE_PLANS values valid Plan types? ❌ NO → FIX NEEDED
3. Are all API_PERMISSIONS plans valid Plan types? ❌ NO → FIX NEEDED
```

### 2. **Cross-Reference Matrix**
| Where 'business' Should Exist | Status | Line | Fixed |
|-------------------------------|--------|------|-------|
| `Plan` type definition | ❌ Missing | lib/rbac.ts:11 | ✅ Now |
| `FEATURE_PLANS` | ✅ Present | lib/rbac.ts:27 | N/A |
| `API_PERMISSIONS` | ❌ Missing | lib/rbac.ts:156 | ✅ Now |
| `call-capabilities` route | ❌ Missing | app/api/call-capabilities/route.ts:78 | ✅ Now |

### 3. **Integration Testing Checklist**
- [ ] Backend returns `real_time_translation_preview: true` for business plan
- [ ] UI receives and displays toggle for business plan
- [ ] Toggle state persists to voice_configs
- [ ] Call routing uses SWML endpoint when enabled
- [ ] Webhook correctly detects live translation

### 4. **Dependency Graph**
```
Translation Feature
├── Database (recordings.has_live_translation) ✅
├── SWML Builder (lib/signalwire/swmlBuilder.ts) ✅
├── SWML Endpoint (app/api/voice/swml/outbound) ✅
├── Call Routing (app/actions/calls/startCallHandler) ✅
├── Webhook Detection (app/api/webhooks/signalwire) ✅
├── Capability Gating
│   ├── Feature Flag (lib/env-validation.ts) ✅
│   ├── RBAC Feature Plans (lib/rbac.ts) ⚠️ PARTIAL (missing type)
│   ├── Plan Type Definition (lib/rbac.ts) ❌ MISSING
│   └── Capability API (app/api/call-capabilities) ⚠️ PARTIAL
└── UI
    ├── CallModulations Component ✅
    └── Capability Fetch ❌ BROKEN (type mismatch)
```

## Prevention Strategy

### For Future Features:

1. **Create Dependency Graph First**
   - Map all systems that need updates
   - Check each node before marking feature complete

2. **Type System First**
   - Update type definitions FIRST
   - Then implement logic
   - TypeScript should catch mismatches

3. **Integration Test Driven**
   - Write end-to-end test scenario
   - Implement until test passes
   - Review should verify test passes

4. **Cross-Reference Checklist**
   - For any new enum value (like `business` plan):
     - ✓ Type definition updated?
     - ✓ All mappings updated?
     - ✓ All route handlers updated?
     - ✓ All UI components aware?

5. **Systematic Review Order**
   1. Type definitions & schemas
   2. Core business logic
   3. API routes & handlers
   4. UI components
   5. Integration points
   6. Error handling
   7. Documentation

## Why This Happened

**Human factors:**
- Assumption that existing systems (RBAC) were complete
- Focus on "new" code, not "supporting" code
- Sequential reviews instead of holistic system view
- No forcing function to check cross-references

**Process factors:**
- No integration testing in review process
- No type system validation step
- No checklist for new enum values
- Reviews were reactive (fix issues) vs proactive (prevent issues)

## Lesson Learned

**Adding a new plan tier requires:**
1. ✅ Type definition update (Plan type)
2. ✅ Feature mapping update (FEATURE_PLANS)
3. ✅ API permission update (API_PERMISSIONS)
4. ✅ Capability route update (call-capabilities)
5. ✅ Integration test (UI → API → DB)
6. ✅ Documentation update

**This should be a CHECKLIST, not a memory exercise.**

## Recommendation

Create `ARCH_DOCS/CHECKLISTS/` folder with:
- `NEW_PLAN_TIER.md` - Checklist for adding plan tiers
- `NEW_FEATURE.md` - Checklist for adding features
- `NEW_CAPABILITY.md` - Checklist for capability-gated features
- `REVIEW_PROCESS.md` - Systematic review order

Each checklist should be **exhaustive** and **checkable**.
