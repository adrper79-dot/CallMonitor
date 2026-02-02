# Translation Agent Implementation Plan
**Production-Ready Deployment for SignalWire AI Agents Live Translation**

**Date:** January 27, 2026  
**Version:** 2.0.0  
**Status:** Implemented (AI Role Compliant)  
**Architecture Reference:** Translation_Agent document (addendum design)

> **AI Role Policy Reference:** [AI_ROLE_POLICY.md](../01-CORE/AI_ROLE_POLICY.md)

---

## ⚠️ AI Role Policy Compliance

Per the AI Role Policy:

1. **Translation is a NEUTRAL SERVICE** - Accessibility support, not negotiation
2. **All calls include translation disclosure** - Parties know AI is translating
3. **Original language preserved** - Canonical record in original language
4. **Nuance disclaimer** - Parties understand translation may not be perfect

### Mandatory Disclosure

Every translation call MUST include:

```
"This call includes AI-powered real-time translation between [Language A] 
and [Language B]. Translation is provided to assist communication and may 
not capture every nuance. Please confirm understanding of important terms 
directly with the other party."
```

### Permitted Functions

| Function | Allowed | Notes |
|----------|---------|-------|
| Translate speech | ✅ Yes | Neutral accessibility service |
| Preserve original | ✅ Yes | Required for canonical record |
| Detect language | ✅ Yes | Technical capability |
| Interpret meaning | ❌ No | AI does not interpret intent |
| Negotiate terms | ❌ No | AI never negotiates |
| Summarize agreements | ❌ No | Humans declare outcomes |

---

## Executive Summary

This plan implements the SignalWire AI Agents addendum design for live bi-directional translation in v1, following strict architectural guardrails:

- ✅ **Execution only** — SignalWire AI Agent handles live STT/TTS/translation
- ✅ **Non-authoritative** — AssemblyAI remains canonical transcript source
- ✅ **Capability-gated** — Business plan + feature flag: `translation_live_assist_preview`
- ✅ **Replaceable** — Zero contract change when moving to FreeSWITCH v2
- ✅ **Minimal vendor lock-in** — All persistence and evidence stay in our stack

---

## Architecture Overview

### Data Flow (Canonical)

```
SignalWire AI Agent (live STT → LLM → TTS injection)
   ↓ (events + partial transcripts - non-authoritative)
COE (normalization + validation)
   ↓
AssemblyAI (canonical transcript + translation)
   ↓
Supabase (recordings, ai_runs, evidence_manifests)
```

### Key Principles

1. **SignalWire AI Agent executes only** — No ownership, no persistence, no scoring
2. **AssemblyAI is canonical** — All transcripts and evidence come from AssemblyAI
3. **Live output is ephemeral** — SignalWire AI output is non-authoritative
4. **Feature-flagged** — `translation_live_assist_preview` feature flag required
5. **Plan-gated** — Business plan or higher required

---

## Implementation Tasks

### Phase 1: Database & Schema (Foundation)

#### Task 1.1: Database Migration
**File:** `migrations/YYYY-MM-DD-add-live-translation-fields.sql`

**Actions:**
- Add `has_live_translation` column (boolean, default false, NOT NULL)
- Add `live_translation_provider` column (text, nullable)
- Add check constraint: `live_translation_provider IN ('signalwire') OR live_translation_provider IS NULL`

**SQL:**
```sql
ALTER TABLE recordings 
  ADD COLUMN has_live_translation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN live_translation_provider TEXT CHECK (live_translation_provider IN ('signalwire') OR live_translation_provider IS NULL);

COMMENT ON COLUMN recordings.has_live_translation IS 'Indicates if live translation was executed during the call (SignalWire AI Agent)';
COMMENT ON COLUMN recordings.live_translation_provider IS 'Provider that executed live translation (currently only signalwire)';
```

**Dependencies:** None  
**Estimated Time:** 30 minutes

---

#### Task 1.2: Update TOOL_TABLE_ALIGNMENT
**File:** `ARCH_DOCS/TOOL_TABLE_ALIGNMENT`

**Actions:**
- Add `has_live_translation` and `live_translation_provider` to recordings GET
- Add `has_live_translation` and `live_translation_provider` to recordings PUT

**Dependencies:** Task 1.1  
**Estimated Time:** 15 minutes

---

### Phase 2: Error Handling & Feature Flags

#### Task 2.1: Error Catalog Updates
**File:** `lib/errors/errorCatalog.ts`

**Actions:**
- Add `LIVE_TRANSLATE_EXECUTION_FAILED` (MEDIUM severity)
  - User message: "Live translation encountered an issue. Post-call transcript is still available."
  - Category: EXTERNAL
  - Track KPI: true
- Add `LIVE_TRANSLATE_VENDOR_DOWN` (HIGH severity)
  - User message: "Live translation service is temporarily unavailable. Post-call transcript will be available."
  - Category: EXTERNAL
  - Track KPI: true
  - Should alert: true

**Dependencies:** None  
**Estimated Time:** 30 minutes

---

#### Task 2.2: Feature Flag Environment Variable
**File:** `lib/env-validation.ts`

**Actions:**
- Add `TRANSLATION_LIVE_ASSIST_PREVIEW` to ENV_VARS
  - Required: false
  - Default: false (when not set)
  - Description: "Enable live translation preview feature (SignalWire AI Agents)"

**Helper Function:**
```typescript
export function isLiveTranslationPreviewEnabled(): boolean {
  return process.env.TRANSLATION_LIVE_ASSIST_PREVIEW === 'true'
}
```

**Dependencies:** None  
**Estimated Time:** 20 minutes

---

#### Task 2.3: Update Error Handling Plan Documentation
**File:** `ARCH_DOCS/ERROR_HANDLING_PLAN.txt`

**Actions:**
- Verify error codes section includes new live translation errors
- Document error handling strategy for live translation failures

**Dependencies:** Task 2.1  
**Estimated Time:** 15 minutes

---

### Phase 3: Capability Gating & RBAC

#### Task 3.1: Update Call Capabilities API
**File:** `app/api/call-capabilities/route.ts`

**Actions:**
- Import `isLiveTranslationPreviewEnabled()` helper
- Add `real_time_translation_preview` to capabilities type
- Logic:
  - Check organization plan is 'business' or 'enterprise'
  - Check feature flag `TRANSLATION_LIVE_ASSIST_PREVIEW === 'true'`
  - Return `{ ...capabilities, real_time_translation_preview: boolean }`

**Code Pattern:**
```typescript
const plan = String(org.plan ?? '').toLowerCase()
const isBusinessPlan = ['business', 'enterprise'].includes(plan)
const isFeatureFlagEnabled = isLiveTranslationPreviewEnabled()
const canUseLiveTranslation = isBusinessPlan && isFeatureFlagEnabled

capabilities = {
  ...capabilities,
  real_time_translation_preview: canUseLiveTranslation
}
```

**Dependencies:** Task 2.2  
**Estimated Time:** 45 minutes

---

#### Task 3.2: Update RBAC Feature Plans
**File:** `lib/rbac.ts`

**Actions:**
- Add `'real_time_translation_preview': ['business', 'enterprise']` to FEATURE_PLANS
- Ensure role permissions support translation feature (already exists)

**Dependencies:** None  
**Estimated Time:** 15 minutes

---

### Phase 4: SignalWire AI Agent Integration

#### Task 4.1: Create SignalWire AI Agent Config Builder
**File:** `lib/signalwire/agentConfig.ts` (new file)

**Actions:**
- Create function to build SignalWire AI Agent configuration JSON
- Support dynamic substitution for:
  - `call_id` (from call)
  - `organization_id` (from org)
  - `translation_from` (from voice_configs)
  - `translation_to` (from voice_configs)
  - `detected_language` (optional, defaults to translation_from)

**Agent Config Structure:**
```typescript
interface SignalWireAgentConfig {
  agent: {
    name: string
    version: string
    languages: {
      primary: string
      secondary: string
      target: string
    }
    prompt: {
      system: string
      user: string
    }
    voice: {
      primary: string
      secondary: string
    }
    model: string
    temperature: number
    max_tokens: number
    timeout: number
  }
  execution: {
    type: string
    trigger: string
    on_event: string[]
  }
  metadata: {
    callmonitor_call_id: string
    callmonitor_org_id: string
    canonical_transcript_source: string
    feature_flag: string
  }
  fallback: {
    on_failure: string
    log_to: string
    notify: string
  }
}
```

**Reference:** Translation_Agent document, lines 272-326

**Dependencies:** None  
**Estimated Time:** 2 hours

---

#### Task 4.2: SignalWire API Integration Research
**Actions:**
- Research SignalWire AI Agents API documentation
- Determine exact API endpoint and request format for attaching agents
- Verify agent attachment happens during call initiation or via call modification
- Document API contract for team reference

**Note:** This may require SignalWire API exploration or support ticket

**Dependencies:** None  
**Estimated Time:** 2-4 hours (research dependent)

---

#### Task 4.3: Update Call Initiation Handler
**File:** `app/actions/calls/startCallHandler.ts`

**Actions:**
- Import agent config builder
- Import capability check helper
- In `placeSignalWireCall()` function:
  - Check if live translation requested (modulations.translate === true)
  - Check capability: call `/api/call-capabilities` or inline check
  - If enabled, attach SignalWire AI Agent config to call
  - Handle agent attachment failure gracefully (log, don't fail call)

**Code Pattern:**
```typescript
// In placeSignalWireCall(), after building base params
if (shouldAttachLiveTranslationAgent(modulations, organization_id)) {
  const agentConfig = buildAgentConfig({
    callId,
    organizationId: organization_id,
    translationFrom: modulations.translate_from,
    translationTo: modulations.translate_to
  })
  // Attach agent config to SignalWire call params
  // Exact implementation depends on SignalWire API (Task 4.2)
}
```

**Fallback Strategy:**
- If agent attachment fails, log error with `LIVE_TRANSLATE_EXECUTION_FAILED`
- Continue call without live translation
- Post-call transcript will still be available via AssemblyAI

**Dependencies:** Task 4.1, Task 4.2, Task 3.1  
**Estimated Time:** 3-4 hours

---

#### Task 4.4: Update SignalWire Webhook Handler
**File:** `app/api/webhooks/signalwire/route.ts`

**Actions:**
- When recording created/started event received:
  - Check if call had live translation agent attached (metadata or call context)
  - Update recordings table: `has_live_translation = true, live_translation_provider = 'signalwire'`
- Handle agent failure events (if SignalWire emits them)
  - Log error with appropriate error code
  - Don't fail call processing

**Dependencies:** Task 1.1, Task 4.3  
**Estimated Time:** 1-2 hours

---

### Phase 5: UI Updates

#### Task 5.1: Update CallModulations Component
**File:** `components/voice/CallModulations.tsx`

**Actions:**
- Add `real_time_translation_preview` to capability type
- Fetch capability from `/api/call-capabilities`
- Add live translation toggle (separate from post-call translation)
- Show "(Preview)" badge next to toggle
- Disable toggle if capability not enabled
- Show tooltip: "Live translation is immediate. Post-call transcripts are authoritative."

**UI Pattern:**
```tsx
<Switch
  id="live-translation"
  checked={modulations.live_translation ?? false}
  disabled={!capabilities.real_time_translation_preview}
  onCheckedChange={(checked) => onChange({ ...modulations, live_translation: checked })}
/>
<Label htmlFor="live-translation">
  Real-time Translation {capabilities.real_time_translation_preview && <Badge variant="secondary">Preview</Badge>}
</Label>
<Tooltip>
  <TooltipTrigger>ℹ️</TooltipTrigger>
  <TooltipContent>
    Live translation is immediate. Post-call transcripts are authoritative.
  </TooltipContent>
</Tooltip>
```

**Dependencies:** Task 3.1  
**Estimated Time:** 2 hours

---

#### Task 5.2: Update Voice Config API (if needed)
**File:** `app/api/voice/config/route.ts`

**Actions:**
- Verify current implementation supports `translate_from` and `translate_to`
- No changes needed (already implemented)

**Dependencies:** None  
**Estimated Time:** 15 minutes (verification only)

---

### Phase 6: Testing & Validation

#### Task 6.1: Unit Tests for Agent Config Builder
**File:** `tests/unit/signalwire/agentConfig.test.ts` (new file)

**Actions:**
- Test config generation with various language combinations
- Test dynamic substitution
- Test error handling for missing required fields
- Test config structure matches SignalWire API expectations

**Dependencies:** Task 4.1  
**Estimated Time:** 2 hours

---

#### Task 6.2: Integration Tests for Live Translation Flow
**File:** `tests/integration/liveTranslationFlow.test.ts` (new file)

**Actions:**
- Test capability gating (Business plan + feature flag)
- Test agent attachment during call initiation
- Test fallback behavior when agent attachment fails
- Test webhook handler updates recordings table
- Verify AssemblyAI still processes canonical transcript

**Dependencies:** Task 4.3, Task 4.4  
**Estimated Time:** 4-6 hours

---

#### Task 6.3: Error Handling Tests
**File:** `tests/unit/errors/liveTranslationErrors.test.ts` (new file)

**Actions:**
- Test error codes are properly cataloged
- Test error messages are user-friendly
- Test KPI tracking for new error codes

**Dependencies:** Task 2.1  
**Estimated Time:** 1 hour

---

#### Task 6.4: Capability API Tests
**File:** `tests/unit/api/callCapabilities.test.ts` (update existing)

**Actions:**
- Test `real_time_translation_preview` capability is returned correctly
- Test plan gating (only Business/Enterprise)
- Test feature flag gating
- Test both conditions must be met

**Dependencies:** Task 3.1  
**Estimated Time:** 1-2 hours

---

### Phase 7: Documentation & Deployment

#### Task 7.1: Update MASTER_ARCHITECTURE.txt (Verify)
**File:** `ARCH_DOCS/MASTER_ARCHITECTURE.txt`

**Actions:**
- Verify section 2.1 "SignalWire AI Agents – Live Translation Execution" is present
- Verify all key principles and data flow are documented
- Add implementation status note if needed

**Status:** Already present in document (lines 14-118)

**Dependencies:** None  
**Estimated Time:** 15 minutes (verification only)

---

#### Task 7.2: Create Implementation Runbook
**File:** `docs/LIVE_TRANSLATION_RUNBOOK.md` (new file)

**Actions:**
- Document feature flag deployment process
- Document SignalWire API configuration requirements
- Document troubleshooting guide
- Document rollback procedure

**Dependencies:** Task 4.2  
**Estimated Time:** 2 hours

---

#### Task 7.3: Environment Variables Documentation
**File:** Update deployment docs with new environment variable

**Actions:**
- Add `TRANSLATION_LIVE_ASSIST_PREVIEW=false` to environment variable list
- Document feature flag usage in production

**Dependencies:** Task 2.2  
**Estimated Time:** 15 minutes

---

## Implementation Checklist

### Pre-Implementation
- [ ] Review SignalWire AI Agents API documentation
- [ ] Verify SignalWire account has AI Agents feature enabled
- [ ] Set up test SignalWire space for development
- [ ] Review Translation_Agent document with team

### Database
- [ ] Create and test migration script
- [ ] Verify migration rollback plan
- [ ] Update TOOL_TABLE_ALIGNMENT document

### Backend
- [ ] Implement error catalog updates
- [ ] Implement feature flag helper
- [ ] Implement capability API updates
- [ ] Implement agent config builder
- [ ] Implement call initiation integration
- [ ] Implement webhook handler updates

### Frontend
- [ ] Update CallModulations component
- [ ] Test UI with feature flag disabled/enabled
- [ ] Verify accessibility (WCAG compliance)

### Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual testing in development
- [ ] Test with Business plan organization
- [ ] Test fallback behavior

### Deployment
- [ ] Deploy to staging
- [ ] Verify staging deployment
- [ ] Update production environment variables (flag = false initially)
- [ ] Deploy to production
- [ ] Enable feature flag for test organization
- [ ] Monitor error logs and KPIs
- [ ] Gradual rollout

---

## Risk Assessment & Mitigation

### Risk 1: SignalWire AI Agents API Changes
**Impact:** HIGH  
**Probability:** MEDIUM  
**Mitigation:**
- Research API documentation thoroughly
- Create abstraction layer (agent config builder)
- Test with SignalWire support if needed

### Risk 2: Agent Attachment Failure Causes Call Failure
**Impact:** HIGH  
**Probability:** LOW  
**Mitigation:**
- Implement graceful fallback (continue without agent)
- Log errors but don't fail call
- Post-call transcript still available

### Risk 3: Feature Flag Misconfiguration
**Impact:** MEDIUM  
**Probability:** LOW  
**Mitigation:**
- Default to false (disabled)
- Document environment variable clearly
- Verify in staging before production

### Risk 4: Performance Impact on Call Initiation
**Impact:** MEDIUM  
**Probability:** LOW  
**Mitigation:**
- Agent attachment should be async/non-blocking
- Monitor call initiation latency
- Implement timeout for agent attachment

---

## Success Criteria

1. ✅ Live translation can be enabled via UI toggle (Business plan + feature flag)
2. ✅ SignalWire AI Agent is attached to calls when enabled
3. ✅ Recordings table is updated with `has_live_translation` flag
4. ✅ AssemblyAI still processes canonical transcripts (unchanged)
5. ✅ Error handling works correctly (failures don't break calls)
6. ✅ Feature flag controls feature availability
7. ✅ All tests pass
8. ✅ Documentation is complete

---

## Timeline Estimate

**Total Estimated Time:** 20-30 hours

- Phase 1 (Database): 1 hour
- Phase 2 (Error Handling): 1.5 hours
- Phase 3 (Capability Gating): 1.5 hours
- Phase 4 (SignalWire Integration): 8-12 hours (depends on API research)
- Phase 5 (UI Updates): 2.5 hours
- Phase 6 (Testing): 8-10 hours
- Phase 7 (Documentation): 2.5 hours

**Recommended Sprint Planning:**
- Week 1: Phases 1-3 (Foundation)
- Week 2: Phase 4 (SignalWire Integration) + start Phase 6
- Week 3: Phase 5 (UI) + complete Phase 6 (Testing) + Phase 7 (Documentation)

---

## Post-Deployment Monitoring

1. **Error Tracking:**
   - Monitor `LIVE_TRANSLATE_EXECUTION_FAILED` error frequency
   - Monitor `LIVE_TRANSLATE_VENDOR_DOWN` error frequency
   - Set up alerts for high error rates

2. **Performance Metrics:**
   - Call initiation latency (with/without agent)
   - Agent attachment success rate
   - Call completion rate (should be unchanged)

3. **Usage Metrics:**
   - Number of calls with live translation enabled
   - Feature adoption rate (Business plan orgs)
   - User feedback

4. **Data Integrity:**
   - Verify `has_live_translation` flag accuracy
   - Verify AssemblyAI transcripts still generated
   - Verify evidence manifests still generated correctly

---

## References

- Translation_Agent document (ARCH_DOCS/Translation_Agent)
- MASTER_ARCHITECTURE.txt (section 2.1)
- ERROR_HANDLING_PLAN.txt
- TOOL_TABLE_ALIGNMENT
- SignalWire AI Agents API documentation (external)

---

**Document Status:** Draft for Review  
**Last Updated:** January 11, 2026  
**Next Review:** Before implementation start
