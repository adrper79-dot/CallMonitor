# Telnyx API Transcription Parameter Change - February 9, 2026

## Issue Summary

**Date:** February 9, 2026  
**Impact:** High - All voice calls with live translation enabled were failing with 500 errors  
**Root Cause:** Telnyx Call Control v2 `POST /v2/calls` expects `transcription` as a **boolean** and config in a separate `transcription_config` object — we were passing an object to `transcription` directly  
**Resolution:** Changed `transcription` to `true` (boolean) and moved engine/tracks config to `transcription_config` with correct property names `transcription_engine`/`transcription_tracks`

## Technical Details

### Before (Broken)
```typescript
callPayload.transcription = {
  transcription_engine: 'B',    // ❌ Wrong structure — transcription must be boolean
  transcription_tracks: 'both', // ❌ Config belongs in transcription_config
}
```

### After (Fixed)
```typescript
callPayload.transcription = true  // ✅ Boolean to enable transcription
callPayload.transcription_config = {
  transcription_engine: 'B',      // ✅ Engine config in transcription_config
  transcription_tracks: 'both',   // ✅ Tracks config in transcription_config
}
```

## Files Modified

- `workers/src/routes/voice.ts` - POST /api/voice/call endpoint
- `workers/src/routes/calls.ts` - POST /api/calls/start endpoint
- `workers/src/routes/webrtc.ts` - POST /api/webrtc/call endpoint

## Error Message

```
"The 'transcription' parameter is invalid. Please consult the documentation."
```

## Impact Assessment

- **Affected Endpoints:** `/api/voice/call`, `/api/calls/start` when live translation enabled
- **User Impact:** Calls failed immediately with 500 error, preventing any voice functionality
- **Business Impact:** Complete outage of voice calling features for users with live translation enabled

## Prevention Measures

1. **API Monitoring:** Implement automated testing of Telnyx API parameter formats
2. **Version Pinning:** Consider pinning to specific Telnyx API versions if available
3. **Error Handling:** Add specific error detection for parameter validation failures
4. **Documentation:** Keep local copy of working API examples for quick reference

## Timeline

- **Detected:** February 9, 2026 - User reported 500 error on voice calls
- **Root Cause Identified:** Telnyx API parameter name change
- **Fix Applied:** Updated parameter names to `engine`/`tracks`
- **Deployed:** February 9, 2026
- **Verified:** Health check passed, API functional

## Lessons Learned

1. **API SDK as Source of Truth:** Always check the official SDK type definitions (`telnyx-node`) for the correct parameter shapes — not guesses or AI-generated docs
2. **Parameter Types Matter:** `transcription` is a **boolean**, not an object. Config goes in `transcription_config` as a separate property
3. **Error Messages:** "parameter is invalid" from Telnyx means the parameter **type** is wrong, not just the value
4. **Testing:** Need automated integration tests that validate actual Telnyx API responses

## Related Issues

- BL-107: Paid API rate limiters (ElevenLabs/Telnyx) - completed earlier today
- BL-108: Mutation endpoint rate limiters - completed earlier today
- BL-109: V5 migration pending - next priority item

---

# Telnyx Bridge Call Implementation - February 9, 2026

## Issue Summary

**Date:** February 9, 2026  
**Impact:** High - Bridge calls only connected agent, customer phone never rang  
**Root Cause:** Incorrect Telnyx Call Control v2 API usage — used `dial` action on existing call instead of creating separate calls and using `bridge` action  
**Resolution:** Implemented proper bridge flow using separate call creation and bridge action

## Technical Details

### Before (Broken)
```typescript
// Wrong: dial action on existing call doesn't create separate call leg
await fetch(`https://api.telnyx.com/v2/calls/${call_control_id}/actions/dial`, {
  body: JSON.stringify({ to: customer_number })
})
```

### After (Fixed)
```typescript
// Step 1: Create separate call to customer
const customerCallResponse = await fetch('https://api.telnyx.com/v2/calls', {
  body: JSON.stringify({
    to: customer_number,
    connection_id: TELNYX_CALL_CONTROL_APP_ID,  // Critical: Use Call Control App ID
    // ... other params
  })
})

// Step 2: Bridge the two calls
await fetch(`https://api.telnyx.com/v2/calls/${agent_call_id}/actions/bridge`, {
  body: JSON.stringify({ call_control_id: customer_call_id })
})
```

## Files Modified

- `workers/src/routes/webhooks.ts` - `handleCallAnswered` function bridge logic
- `workers/src/routes/voice.ts` - Call record creation (added `call_control_id` column)

## Root Cause Analysis

1. **Wrong API Action:** `dial` action on existing call doesn't create separate call legs
2. **Wrong Connection ID:** Used `TELNYX_CONNECTION_ID` (WebRTC) instead of `TELNYX_CALL_CONTROL_APP_ID` (API)
3. **Missing DB Columns:** `hangup_cause` and `answered_at` columns missing, causing webhook 500s
4. **Silent Failures:** Poor error logging masked API failures

## Impact Assessment

- **Affected Feature:** Bridge calls (agent → customer connection)
- **User Impact:** Agent phone rang but customer never received call
- **Business Impact:** Bridge calling feature completely broken

## Prevention Measures

1. **API Documentation Review:** Always verify Telnyx API actions create intended call flows
2. **Environment Variable Validation:** Test all required env vars are accessible in webhook context
3. **Database Schema Sync:** Ensure webhook handlers have all required DB columns
4. **Comprehensive Logging:** Log API requests/responses and environment state
5. **Integration Testing:** Test complete call flows end-to-end

## Timeline

- **Detected:** February 9, 2026 - Bridge calls only ringing agent phone
- **Root Cause Identified:** Incorrect Telnyx API usage and missing DB columns
- **Fix Applied:** Implemented proper separate call creation + bridge action
- **Deployed:** February 9, 2026
- **Verified:** Bridge calls now connect both parties

## Lessons Learned

1. **Telnyx Call Control v2 Bridge Flow:** Requires separate calls + bridge action, not dial action
2. **Connection ID Types:** `TELNYX_CONNECTION_ID` (WebRTC) ≠ `TELNYX_CALL_CONTROL_APP_ID` (API)
3. **Webhook Error Handling:** Silent failures mask critical issues — comprehensive logging essential
4. **Database-Webhook Sync:** Webhook handlers must have all referenced DB columns
5. **API Action Semantics:** `dial` ≠ `bridge` — understand what each action actually does</content>
<parameter name="filePath">c:\Users\Ultimate Warrior\My project\gemini-project\ARCH_DOCS\LESSONS_LEARNED_2026-02-09_TELNYX_TRANSCRIPTION_API.md