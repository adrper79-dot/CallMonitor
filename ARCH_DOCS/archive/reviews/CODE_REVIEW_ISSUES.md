# Code Review: Live Translation Implementation
**Date:** January 14, 2026  
**Reviewer:** AI Assistant  
**Scope:** Holistic review of live translation implementation vs ARCH_DOCS requirements

---

## Executive Summary

After comprehensive review of the codebase against ARCH_DOCS requirements, several **critical issues** and **potential incompatibilities** have been identified that may impede expected performance. These issues span SWML structure, call routing logic, webhook detection, and UI implementation.

---

## 🔴 Critical Issues

### 1. SWML Structure: Missing Dial Verb for Outbound Calls

**Location:** `lib/signalwire/swmlBuilder.ts:104-106`

**Issue:**
The SWML builder uses `{ answer: {} }` verb, which is appropriate for **inbound calls** but **incorrect for outbound calls**. For outbound calls, SignalWire needs to dial the destination number.

**Current Implementation:**
```typescript
const mainSection: Array<any> = [
  { answer: {} }  // ❌ Wrong for outbound calls
]
```

**Expected Behavior (per LaML pattern):**
The LaML endpoint uses `<Dial><Number>...</Number></Dial>` for outbound calls (see `app/api/voice/laml/outbound/route.ts:185-196`).

**Impact:** 
- Calls routed to SWML endpoint will fail to connect
- SignalWire may reject the SWML JSON or hang up immediately after answer
- Feature will not work as expected

**Fix Required:**
- Add `dial` verb to SWML structure for outbound calls
- May need to pass destination number to `buildSWML()` function
- Verify correct SWML syntax for dialing outbound numbers

**Reference:** 
- LaML implementation: `app/api/voice/laml/outbound/route.ts:185-196`
- ARCH_DOCS: Research shows `answer` verb in examples, but examples may be for inbound calls

---

### 2. SWML Voice Configuration: Structure Mismatch

**Location:** `lib/signalwire/swmlBuilder.ts:109-123`

**Issue:**
The SWML builder uses `languages` array format, but the research document example shows `voice: { provider: "elevenlabs", voice_id: "..." }` structure. Need to verify correct SWML syntax.

**Current Implementation:**
```typescript
aiConfig.languages = [
  {
    name: getLanguageName(...),
    code: agentConfig.agent.languages.primary,
    voice: getSignalWireVoiceId(...)  // String like "rime.spore"
  }
]
```

**Research Document Example:**
```json
"voice": {
  "provider": "elevenlabs",
  "voice_id": "en-US-Neural2-J"
}
```

**Impact:**
- Voice configuration may be incorrect
- AI Agent may not use intended voice
- Requires SignalWire API verification

**Fix Required:**
- Verify correct SWML syntax with SignalWire documentation
- May need to use `languages` array (as implemented) OR `voice` object structure
- Web search suggests `languages` array is correct, but `voice` object format may also be valid

---

### 3. SWML Recording Configuration: Incorrect Placement

**Location:** `lib/signalwire/swmlBuilder.ts:136-144`

**Issue:**
Recording is added as a separate `record` verb after the `ai` verb. For outbound calls, recording should likely be configured as part of the `dial` verb (similar to LaML's `Dial record="record-from-answer"`).

**Current Implementation:**
```typescript
mainSection.push({ ai: aiConfig })
if (recordCall) {
  mainSection.push({
    record: {
      format: 'mp3',
      stereo: false
    }
  })
}
```

**Expected Pattern (per LaML):**
LaML uses `<Dial record="record-from-answer" recordingStatusCallback="...">` - recording is part of the Dial verb, not separate.

**Impact:**
- Recording may not work correctly
- May record the wrong audio stream
- Webhook callbacks may not fire correctly

**Fix Required:**
- Verify SWML syntax for recording in dial context
- May need to configure recording as part of dial verb
- Research SignalWire SWML documentation for recording configuration

---

### 4. Webhook Detection: Heuristic-Based, Not Authoritative

**Location:** `app/api/webhooks/signalwire/route.ts:142-172`

**Issue:**
The webhook handler uses a **heuristic** to detect if a call used live translation (checks plan + feature flag + voice_configs). This is not authoritative - it doesn't know if the call was **actually routed to SWML endpoint**.

**Current Implementation:**
```typescript
// Heuristic: Check voice_configs + organization plan + feature flag
let hasLiveTranslation = false
if (isBusinessPlan && isFeatureFlagEnabled) {
  const voiceConfig = vcRows?.[0]
  if (voiceConfig?.translate === true && ...) {
    hasLiveTranslation = true  // ❌ Assumes, doesn't verify
  }
}
```

**Problem:**
- If routing logic changes, webhook detection may be wrong
- If call fails to route to SWML (e.g., routing bug), flag may still be set
- No authoritative way to know if SWML endpoint was actually called

**Impact:**
- `has_live_translation` flag may be set incorrectly
- Analytics/metrics may be inaccurate
- Debugging issues will be difficult

**Fix Options:**
1. **Option A:** Store metadata in calls table when routing to SWML (add `uses_swml_endpoint` boolean field)
2. **Option B:** Check SWML endpoint logs (not reliable)
3. **Option C:** Accept heuristic (document limitation)

**Recommendation:** Option A - Store authoritative flag in calls table

---

### 5. SWML Endpoint: Missing Destination Number

**Location:** `app/api/voice/swml/outbound/route.ts:145-155`

**Issue:**
The SWML endpoint builds SWML without knowing the destination phone number. For outbound calls, SWML needs to dial the destination, but we don't pass the `To` number to `buildSWML()`.

**Current Implementation:**
```typescript
const swmlConfig = buildSWML(
  {
    callId: finalCallId,
    organizationId,
    translationFrom: voiceConfig.translate_from,
    translationTo: voiceConfig.translate_to
  },
  voiceConfig.record === true
)
// ❌ Missing: destination phone number
```

**Impact:**
- Cannot add `dial` verb with destination number
- Calls will not connect to destination
- Feature will fail

**Fix Required:**
- Extract `To` number from SignalWire payload (`payload.To ?? payload.to`)
- Pass destination number to `buildSWML()` function
- Update `buildSWML()` to include dial verb with destination

---

### 6. SWML Fallback: Invalid SWML Structure

**Location:** `app/api/voice/swml/outbound/route.ts:114-124, 132-142`

**Issue:**
When translation is not enabled or feature flag is disabled, the endpoint returns SWML with `{ answer: {} }, { ai: {...} }, { hangup: {} }`. This structure:
- Uses `answer` verb (wrong for outbound)
- Includes AI agent with error message (confusing UX)
- Immediately hangs up (call fails)

**Current Implementation:**
```typescript
const fallbackSWML = {
  version: '1.0.0',
  sections: {
    main: [
      { answer: {} },
      { ai: { prompt: { text: 'Translation not configured...' } } },
      { hangup: {} }  // ❌ Call will hang up immediately
    ]
  }
}
```

**Problem:**
- If routing logic incorrectly routes a call to SWML endpoint, the call will fail
- Better to return minimal SWML that still allows call to proceed
- Or: This shouldn't happen (routing logic should prevent it), but defensive coding needed

**Impact:**
- Calls routed to SWML incorrectly will fail
- Poor user experience
- Difficult to debug

**Fix Required:**
- If SWML endpoint is called incorrectly, return minimal working SWML (dial destination, no AI agent)
- Or: Return error and let SignalWire handle (may not work)
- Verify routing logic prevents this scenario

---

## 🟡 Medium Priority Issues

### 7. Call Routing: Timing Issue with callId

**Location:** `app/actions/calls/startCallHandler.ts:88-89`

**Issue:**
The `placeSignalWireCall()` function references `callId` variable, but `callId` is defined **later** in the function (line 288). The function is defined before `callId` is available.

**Current Implementation:**
```typescript
const placeSignalWireCall = async (toNumber: string, useLiveTranslation: boolean = false) => {
  // ...
  if (useLiveTranslation && callId) {  // ❌ callId not in scope yet
    params.append('Url', `${env.NEXT_PUBLIC_APP_URL}/api/voice/swml/outbound?callId=${encodeURIComponent(callId)}`)
  }
}
// callId defined later at line 288
```

**Analysis:**
Actually, `callId` is defined in the outer scope (`let callId: string | null = null` at line 38), so this should work. However, it's a closure dependency that could be confusing.

**Fix:** None needed (works as-is), but consider passing callId as parameter for clarity

---

### 8. UI: Capabilities Hook May Not Be Used

**Location:** `components/voice/CallModulations.tsx:76`

**Issue:**
The component fetches capabilities but only uses `capabilities.real_time_translation_preview` for display logic. The translate toggle itself is still controlled by `mods['translate']` from `voice_configs`, not from a separate live translation toggle.

**Current Implementation:**
- Capabilities are fetched correctly
- Badge is shown when `capabilities.real_time_translation_preview === true`
- But translate toggle is still the same toggle (not separate)

**Analysis:**
Per ARCH_DOCS, live translation is **not a separate toggle** - it's enabled automatically when:
- `translate=true` in voice_configs
- `real_time_translation_preview` capability is enabled
- Business plan + feature flag

So the UI implementation appears correct - the badge is shown, and the translate toggle controls both post-call translation AND live translation (when capability allows).

**Fix:** None needed (implementation is correct per ARCH_DOCS)

---

### 9. SWML Endpoint: Unused Variable

**Location:** `app/api/voice/swml/outbound/route.ts:69, 157`

**Issue:**
Line 69 declares `const foundCallId = callRows[0].id` but never uses it. Line 157 calls `swmlToJson()` but doesn't use the result.

**Impact:** Minor code quality issue, no functional impact

**Fix:** Remove unused variable, or remove unused function call

---

## 🟢 Low Priority / Documentation Issues

### 10. SignalWire API Endpoint: LaML vs SWML

**Location:** `app/actions/calls/startCallHandler.ts:97`

**Issue:**
The SignalWire API endpoint URL still uses `/api/laml/2010-04-01/Accounts/...` even when routing to SWML endpoint. This may be correct (LaML API accepts both LaML and SWML responses based on the `Url` parameter), but needs verification.

**Current Implementation:**
```typescript
const swEndpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`
// ✅ Still uses /laml/ endpoint, but Url parameter points to SWML endpoint
```

**Analysis:**
This appears correct - SignalWire uses the same REST API endpoint, but the `Url` parameter determines what markup language the endpoint returns. No fix needed, but document this behavior.

---

### 11. Voice ID Mapping: Placeholder Values

**Location:** `lib/signalwire/swmlBuilder.ts:72-96`

**Issue:**
Voice ID mapping uses placeholder format (`rime.spore`, `rime.alberto`, etc.). These need verification with SignalWire documentation.

**Impact:** Voices may not work correctly until verified

**Fix:** Verify voice IDs with SignalWire support/documentation

---

## Summary of Required Fixes

### Must Fix (Blocking):

1. **SWML Structure - Add Dial Verb** (Issue #1)
   - Add dial verb to SWML for outbound calls
   - Pass destination number to buildSWML()
   - Verify SWML syntax

2. **SWML Endpoint - Extract Destination** (Issue #5)
   - Extract `To` number from SignalWire payload
   - Pass to buildSWML() function
   - Update buildSWML() signature

3. **SWML Recording - Correct Configuration** (Issue #3)
   - Verify recording syntax for SWML
   - May need to configure as part of dial verb

### Should Fix (Important):

4. **Webhook Detection - Store Authoritative Flag** (Issue #4)
   - Add `uses_swml_endpoint` field to calls table
   - Set flag when routing to SWML
   - Use flag in webhook handler

5. **SWML Fallback - Improve Error Handling** (Issue #6)
   - Return minimal working SWML instead of hanging up
   - Better error messages

### Nice to Have:

6. **Code Quality** (Issue #9)
   - Remove unused variables
   - Clean up code

---

## Next Steps

1. **SignalWire API Verification** (Critical)
   - Verify SWML syntax for outbound calls with dial verb
   - Verify recording configuration syntax
   - Verify voice ID format

2. **Fix SWML Structure** (Critical)
   - Update buildSWML() to include dial verb
   - Pass destination number
   - Test with SignalWire

3. **Improve Webhook Detection** (Important)
   - Consider storing authoritative flag
   - Or document heuristic limitation

---

## Testing Recommendations

1. **Unit Tests:**
   - Test buildSWML() with various inputs
   - Test SWML JSON structure
   - Test voice ID mapping

2. **Integration Tests:**
   - Test call routing to SWML endpoint
   - Test webhook detection logic
   - Test fallback scenarios

3. **SignalWire Testing:**
   - Test actual call with SWML endpoint
   - Verify dial verb works
   - Verify recording works
   - Verify AI agent attaches correctly

---

**Review Status:** Complete  
**Critical Issues:** 3 (must fix before deployment)  
**Medium Issues:** 3 (should fix)  
**Low Issues:** 3 (nice to have)
