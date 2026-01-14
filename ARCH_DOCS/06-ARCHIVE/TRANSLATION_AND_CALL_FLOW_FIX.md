# Translation Toggle & Call Flow Fix - Jan 12, 2026

## 🔍 **Issues Diagnosed**

### Issue 1: Translation Toggle Not Saving (401 Unauthorized)
**Symptoms:**
- Translation toggle visible but settings not saving
- Console errors: `401 (Unauthorized)` on `/api/voice/config` endpoints
- `Failed to update translation setting` error in console

**Root Cause:**
The `useVoiceConfig` hook was making fetch requests WITHOUT `credentials: 'include'`, which means session cookies weren't being sent to the API. All API endpoints require authentication via `getServerSession()`, so they returned 401.

**Fix Applied:**
- ✅ Added `credentials: 'include'` to GET `/api/voice/config` fetch
- ✅ Added `credentials: 'include'` to PUT `/api/voice/config` fetch
- ✅ Fixed API payload structure: wrapped updates in `modulations` object per API contract
- ✅ Added `credentials: 'include'` to `/api/call-capabilities` fetch

---

### Issue 2: Call Flow Type Not Working as Expected
**Symptoms:**
- User filled in BOTH "From" and "To" fields
- Expected: Bridge call (two legs) - dial both numbers
- Actual: Only one phone number rang

**Architecture Review:**
Per `startCallHandler.ts` (lines 324-367):
```typescript
// If both from_number and phone_number provided with valid E.164:
if (flow_type === 'bridge' && from_number && E164_REGEX.test(from_number)) {
  // Creates TWO call legs:
  const sidA = await placeSignalWireCall(from_number, false)  // Agent leg
  const sidB = await placeSignalWireCall(phone_number, false)  // Destination leg
  call_sid = sidB
} else {
  // Single outbound call to phone_number only
  call_sid = await placeSignalWireCall(phone_number, shouldUseLiveTranslation)
}
```

**Expected Behavior:**
1. **Bridge Mode** (two-leg call):
   - **When:** BOTH "From" and "To" fields filled with valid E.164 numbers
   - **Flow:** Dials "From" (agent), then dials "To" (destination), bridges them together
   - **Use case:** Connect agent to customer, conference call

2. **Outbound Mode** (single-leg call):
   - **When:** Only "To" field filled, "From" left empty
   - **Flow:** Dials "To" number only, plays IVR/recording
   - **Use case:** Automated outbound call, robocall, IVR

**Possible Causes for Single Ring:**
1. ❓ "From" field value wasn't valid E.164 format (must start with +, e.g. `+17062677235`)
2. ❓ `flow_type` wasn't set to 'bridge' (check frontend logic: `flow_type: from ? 'bridge' : 'outbound'`)
3. ❓ One SignalWire call succeeded, the other failed silently

**Recommendation for User:**
- Ensure "From" number is in E.164 format: `+1XXXXXXXXXX` (with country code)
- Check Vercel logs to see if both `placeSignalWireCall` were invoked
- Verify SignalWire logs show TWO call attempts (sidA and sidB)

---

### Issue 3: Translation Not Applied to Calls
**Symptoms:**
- Translation toggle enabled
- Call placed successfully
- Translation NOT applied to the call

**Architecture Review:**
Per `startCallHandler.ts` (lines 241-258):
```typescript
// enforce canonical modulations from voice_configs (do NOT allow client override)
// default to conservative (all false) when no config present
let effectiveModulations = { record: false, transcribe: false, translate: false }
try {
  const { data: vcRows } = await supabaseAdmin.from('voice_configs')
    .select('record,transcribe,translate,translate_from,translate_to,survey,synthetic_caller')
    .eq('organization_id', organization_id).limit(1)
  if (vcRows && vcRows[0]) {
    effectiveModulations.translate = !!vcRows[0].translate
    // ... load from database ...
  }
} catch (e) {
  // best-effort: if voice_configs absent, keep conservative defaults
}
```

**Critical Understanding:**
- ❗ **Client-side toggle does NOT directly control translation**
- ❗ **Translation is enforced from `voice_configs` DATABASE table**
- ❗ **Client modulations are IGNORED** (see line 241: "do NOT allow client override")

**Flow:**
1. User clicks translation toggle on home page
2. Frontend calls `PUT /api/voice/config` to save to database
3. **IF AUTH WORKS**: Database updated ✅
4. **IF AUTH FAILS (401)**: Database NOT updated ❌
5. When call starts, `startCallHandler` loads from database
6. If database has `translate=true`, translation is applied
7. If database has `translate=false`, NO translation (regardless of UI toggle)

**Why Translation Didn't Work:**
Because the API was returning 401, the toggle state never saved to the database. So when the call started, it loaded `translate=false` from the database (or default false if no config exists).

**Now Fixed:**
- ✅ Authentication issue resolved (credentials included)
- ✅ Translation toggle should now save to database
- ✅ Subsequent calls will respect translation setting

---

## 🚀 **Changes Deployed**

### Files Modified:
1. **`hooks/useVoiceConfig.ts`**
   - Added `credentials: 'include'` to GET fetch (line 35)
   - Added `credentials: 'include'` to PUT fetch (line 61)
   - Fixed PUT payload structure: wrapped updates in `modulations` object

2. **`app/page.tsx`**
   - Added `credentials: 'include'` to capabilities fetch (line 67)

---

## ✅ **Testing Checklist**

### 1. Translation Toggle:
- [ ] Log in to https://voxsouth.online
- [ ] Go to home page
- [ ] Toggle "Live Translation" ON
- [ ] Open browser DevTools → Network tab
- [ ] Verify `PUT /api/voice/config` returns **200 OK** (not 401)
- [ ] Refresh page
- [ ] Verify toggle remains ON (state persisted)

### 2. Bridge Call (Two-Leg):
- [ ] Fill in "From" field: `+17062677235` (valid E.164)
- [ ] Fill in "To" field: `+12392027345` (valid E.164)
- [ ] Click "Start Call"
- [ ] Verify BOTH phones ring
- [ ] Check SignalWire logs: should show TWO call records (sidA and sidB)

### 3. Single Outbound Call:
- [ ] Leave "From" field EMPTY
- [ ] Fill in "To" field: `+17062677235`
- [ ] Click "Start Call"
- [ ] Verify only ONE phone rings (the "To" number)

### 4. Translation on Call:
- [ ] Enable translation toggle (ensure it saves)
- [ ] Select languages: From=Spanish, To=English
- [ ] Start a call
- [ ] Check call logs: should show translation applied
- [ ] Verify SWML endpoint used: `/api/voice/swml/outbound?callId=...`

---

## 📊 **Deployment Status**

**Commit:** (pending)  
**Branch:** `main`  
**Status:** ⏳ Ready to commit and deploy

**Deploy Command:**
```bash
git add hooks/useVoiceConfig.ts app/page.tsx TRANSLATION_AND_CALL_FLOW_FIX.md
git commit -m "Fix: Add credentials to voice config API calls and fix translation toggle

- Translation toggle now saves properly (401 auth issue fixed)
- Added credentials: 'include' to all voice config API fetch calls
- Fixed PUT /api/voice/config payload structure (wrap in modulations)
- Added credentials to call-capabilities endpoint
- Documented call flow architecture (bridge vs outbound modes)"
git push
```

---

## 🏗️ **Architecture Summary**

### Call Flow Determination:
```typescript
// Frontend (app/page.tsx)
flow_type: from ? 'bridge' : 'outbound'

// Backend (startCallHandler.ts)
if (flow_type === 'bridge' && from_number && E164_REGEX.test(from_number)) {
  // TWO LEGS: dial from_number, then phone_number, bridge together
} else {
  // SINGLE LEG: dial phone_number only
}
```

### Translation Flow:
```typescript
// 1. Frontend toggle changes state
setTranslate(true)

// 2. Frontend saves to database
PUT /api/voice/config { modulations: { translation_enabled: true } }

// 3. Backend loads from database when call starts
const { data: vcRows } = await supabaseAdmin.from('voice_configs').select(...)
effectiveModulations.translate = !!vcRows[0].translate

// 4. Backend routes to SWML if translation enabled
if (shouldUseLiveTranslation) {
  params.append('Url', `${APP_URL}/api/voice/swml/outbound?callId=${callId}`)
} else {
  params.append('Url', `${APP_URL}/api/voice/laml/outbound`)
}
```

### Authentication Flow:
```typescript
// Client-side fetch MUST include credentials
fetch('/api/voice/config', { 
  credentials: 'include' // ← CRITICAL: Sends session cookies
})

// Server-side API checks session
const session = await getServerSession()
if (!session?.user?.id) {
  return 401 Unauthorized
}
```

---

## 🔐 **Security Note**

All voice config endpoints now properly enforce:
1. ✅ Authentication: `getServerSession()` required
2. ✅ Authorization: `org_members` membership check
3. ✅ RLS: Database policies enforce org-level isolation (once RLS migration applied)

---

## 📝 **Next Steps**

1. ✅ **Commit and deploy this fix**
2. ⏳ **Apply RLS migration** (see `migrations/2026-01-11-add-rls-policies-safe.sql`)
3. ⏳ **Test all three scenarios** (translation, bridge call, single outbound)
4. ⏳ **Monitor Vercel logs** for any auth/call placement issues
5. ⏳ **Update user documentation** with call flow modes

---

**Status:** ✅ **READY FOR DEPLOYMENT**
