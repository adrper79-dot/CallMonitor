# TypeScript Error Triage Plan

**Generated:** 2026-02-04  
**Total Errors:** 748 across 213 files  
**Priority:** HIGH - Fix before general availability

## Error Categories & Resolution Strategy

### 1. API Response Type Issues (High Priority - 50+ errors)

**Files:** `lib/apiClient.ts`, `hooks/useCallDetails.ts`, `hooks/useVoiceConfig.tsx`, `workers/src/routes/webrtc.ts`

**Problem:** `fetch()` responses typed as `unknown`, causing property access errors
**Solution:**

```typescript
// Before
const data = await res.json() // unknown
return data.user // Error: property doesn't exist

// After
const data = (await res.json()) as { user: User } // Type assertion
return data.user
```

**Action:** Add proper response type interfaces and type guards

---

### 2. Missing Module Imports (High Priority - 151 errors)

**File:** `dist_deploy/types/validator.ts`

**Problem:** Type validator references non-existent API route files
**Solution:** Update validator to match actual file structure or remove unused validations

---

### 3. Undefined Variables (Medium Priority - 25+ errors)

**Files:** `lib/services/callerIdService.ts`, `workers/src/routes/calls.ts`

**Problem:** Variables referenced before declaration or out of scope
**Examples:**

- `userId` vs `user_id` naming inconsistency
- `query` function undefined in service classes

**Solution:** Fix variable naming and add proper imports

---

### 4. CRM Provider Type Issues (Medium Priority - 33 errors)

**Files:** `lib/services/crmProviders/hubspot.ts`, `lib/services/crmProviders/salesforce.ts`

**Problem:** API responses from external services typed as `unknown`
**Solution:** Define proper interface types for HubSpot/Salesforce API responses

---

### 5. Database Query Result Types (Low Priority - 10+ errors)

**Files:** `tools/verify_evidence_bundle.ts`, `lib/pgClient.ts`

**Problem:** Query results typed incorrectly (expecting `.rows` property)
**Solution:** Update query result handling to match actual return types

---

## Implementation Plan

### Phase 1: Critical API Types (Week 1)

1. Define response interfaces for all API endpoints
2. Add type guards for external API responses
3. Fix undefined variable references

### Phase 2: Service Layer Types (Week 2)

1. Add proper types for CRM provider integrations
2. Fix database query result handling
3. Update service class imports

### Phase 3: Validation & Testing (Week 3)

1. Update type validator to match current API structure
2. Run full TypeScript compilation after each phase
3. Add type tests for critical paths

---

## Success Criteria

- **Target Error Count:** < 50 errors
- **Zero Critical Errors:** No runtime type errors in production
- **Type Safety:** All API responses properly typed
- **Maintainability:** Type definitions documented and reusable

---

## Risk Mitigation

- **Incremental Fixes:** Fix errors in small batches to avoid breaking changes
- **Type Guards:** Add runtime type checking for external API responses
- **Testing:** Run TypeScript compilation after each change
- **Documentation:** Update type definitions as they're created

---

_Generated from TypeScript compilation analysis_</content>
<parameter name="filePath">c:\Users\Ultimate Warrior\My project\gemini-project\ARCH_DOCS\TYPESCRIPT_ERROR_TRIAGE_PLAN.md
