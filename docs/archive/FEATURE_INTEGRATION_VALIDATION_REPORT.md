# Feature Integration Validation Report
**Date:** January 16, 2026  
**Scope:** Deep validation of feature configuration vs. execution integration

---

## Executive Summary

This report documents features where **UI configuration exists but execution integration is incomplete or broken**. Similar to the survey feature issue, these features allow users to configure settings, but those settings aren't properly used during call execution.

**Critical Finding:** Of 7 major call modulation features examined, **3 have significant integration gaps**.

---

## Feature Status Overview

| Feature | UI Config | DB Storage | Execution | Status |
|---------|-----------|------------|-----------|--------|
| **Recording** | ✅ Complete | ✅ Complete | ✅ Complete | ✅ **WORKING** |
| **Transcription** | ✅ Complete | ✅ Complete | ✅ Complete | ✅ **WORKING** |
| **Translation** | ✅ Complete | ✅ Complete | ✅ Complete | ✅ **WORKING** |
| **After-Call Survey** | ✅ Complete | ✅ Complete | ⚠️ **PARTIAL** | ⚠️ **BROKEN** |
| **Secret Shopper** | ✅ Complete | ✅ Complete | ⚠️ **PARTIAL** | ⚠️ **BROKEN** |
| **Voice Cloning** | ✅ Complete | ✅ Complete | ❌ **NONE** | ❌ **NOT IMPLEMENTED** |
| **Caller ID Mask** | ✅ Complete | ✅ Complete | ✅ Complete | ✅ **WORKING** |

---

## Issue #1: After-Call Survey (ALREADY DOCUMENTED)

**Severity:** 🔴 HIGH  
**Status:** Documented in [SURVEY_INVOCATION_VALIDATION_REPORT.md](SURVEY_INVOCATION_VALIDATION_REPORT.md)

**Summary:**
- User can configure survey questions in UI
- Questions stored in `voice_configs.survey_prompts`
- LaML generator ignores custom questions and uses hardcoded question
- Survey flag not passed through execution pipeline

---

## Issue #2: Secret Shopper (Synthetic Caller) - Hardcoded Script

**Severity:** 🟡 MEDIUM-HIGH  
**Impact:** Users can't use custom shopper scripts for outbound calls

### Problem Description

Users can:
1. ✅ Create secret shopper scripts via `ShopperScriptManager` UI
2. ✅ Store scripts in `shopper_scripts` table
3. ✅ Link scripts to `voice_configs.script_id`

BUT:
❌ **Outbound LaML generator uses hardcoded script instead of database script**

### Evidence

**File:** [app/api/voice/laml/outbound/route.ts](app/api/voice/laml/outbound/route.ts) Line 96-108

```typescript
// Secret Shopper script
if (voiceConfig?.synthetic_caller) {
  const script = 'Hello, I\'m calling to inquire about your services. Do you have any availability this week?'
  const scriptLines = script.split(/\n|\|/).filter(line => line.trim())
  
  for (let i = 0; i < scriptLines.length; i++) {
    const line = scriptLines[i].trim()
    if (line) {
      elements.push(`<Say voice="alice">${escapeXml(line)}</Say>`)
      if (i < scriptLines.length - 1) {
        elements.push('<Pause length="2"/>')
      }
    }
  }
}
```

**The script is HARDCODED** - it never reads from:
- `voice_configs.shopper_script`
- `voice_configs.script_id` → `shopper_scripts` table

### Related Files (Evidence of Unused Infrastructure)

1. **UI Component**: [components/voice/ShopperScriptManager.tsx](components/voice/ShopperScriptManager.tsx)
   - Complete script editor with TTS provider, persona, expected outcomes
   - Users can create/edit/save scripts
   - Scripts successfully saved to database

2. **Database Table**: `shopper_scripts`
   - Stores script content, persona, TTS settings, scoring criteria
   - Migration: [migrations/2026-01-14-add-shopper-scripts.sql](migrations/2026-01-14-add-shopper-scripts.sql)

3. **API**: [app/api/shopper/scripts/route.ts](app/api/shopper/scripts/route.ts)
   - GET endpoint returns scripts from database
   - POST endpoint creates/updates scripts
   - Working correctly

4. **SWML Builder**: [lib/signalwire/shopperSwmlBuilder.ts](lib/signalwire/shopperSwmlBuilder.ts)
   - Fully functional builder for AI-powered shopper calls
   - Used by `/api/voice/swml/shopper` endpoint
   - **Only used for INBOUND calls to dedicated shopper numbers**

### Why It's Broken

**Same pattern as survey issue:**

```
User creates script in UI → Script stored in DB → 
Script linked to voice_config → User enables synthetic_caller →
LaML generator sees synthetic_caller=true →
❌ Uses hardcoded script instead of user's script
```

The LaML generator:
1. ✅ Correctly reads `voice_configs.synthetic_caller` flag
2. ❌ Never reads `voice_configs.script_id`
3. ❌ Never queries `shopper_scripts` table
4. ❌ Uses hardcoded default script

### Workaround That Exists

**FOR INBOUND CALLS ONLY:**
- [app/api/voice/swml/shopper/route.ts](app/api/voice/swml/shopper/route.ts) endpoint
- Reads scripts from `shopper_scripts` table correctly
- Generates proper SWML with custom scripts
- **Only triggered when calling a dedicated shopper number**

So the infrastructure is complete for INBOUND, but not used for OUTBOUND.

### Fix Required

**File:** [app/api/voice/laml/outbound/route.ts](app/api/voice/laml/outbound/route.ts)

**Current** (Line 96):
```typescript
if (voiceConfig?.synthetic_caller) {
  const script = 'Hello, I\'m calling to inquire about your services...'
```

**Required**:
```typescript
if (voiceConfig?.synthetic_caller) {
  let script = 'Hello, I\'m calling to inquire about your services. Do you have any availability this week?'
  
  // Try to load custom script from database
  try {
    if (voiceConfig.script_id) {
      const { data: scriptRows } = await supabaseAdmin
        .from('shopper_scripts')
        .select('script_text')
        .eq('id', voiceConfig.script_id)
        .eq('organization_id', organizationId)
        .limit(1)
      
      if (scriptRows?.[0]?.script_text) {
        script = scriptRows[0].script_text
        logger.info('LaML outbound: loaded custom shopper script', { scriptId: voiceConfig.script_id })
      }
    } else if (voiceConfig.shopper_script) {
      // Fallback: check voice_configs.shopper_script field
      script = voiceConfig.shopper_script
      logger.info('LaML outbound: using inline shopper script from voice_configs')
    }
  } catch (err) {
    logger.warn('LaML outbound: failed to load custom script, using default', err)
  }
  
  const scriptLines = script.split(/\n|\|/).filter(line => line.trim())
  // ... rest of code
}
```

### Testing Checklist

- [ ] Create shopper script in ShopperScriptManager UI
- [ ] Link script to voice_configs via script_id
- [ ] Enable "Secret Shopper" toggle
- [ ] Place outbound call
- [ ] Verify LaML includes CUSTOM script (not hardcoded)
- [ ] Check call recording contains custom script content
- [ ] Verify scoring uses script's expected_outcomes

---

## Issue #3: Voice Cloning - NOT IMPLEMENTED for Live Calls

**Severity:** 🔴 HIGH  
**Impact:** Feature advertised but not functional for live translation

### Problem Description

**UI allows users to:**
1. ✅ Enable "Voice Cloning" toggle (in [CallModulations.tsx](components/voice/CallModulations.tsx) Line 290+)
2. ✅ Save `use_voice_cloning: true` to `voice_configs` table
3. ✅ See toggle persisted across sessions

**BUT:**
❌ **Voice cloning is ONLY used for post-call translation audio, NOT live translation**

### What Works (Post-Call Translation)

**File:** [app/services/translation.ts](app/services/translation.ts) Line 83-125

```typescript
if (useVoiceCloning && recordingUrl) {
  try {
    const recordingResponse = await fetch(recordingUrl)
    if (recordingResponse.ok) {
      const recordingBuffer = Buffer.from(await recordingResponse.arrayBuffer())
      
      if (recordingBuffer.length > 50000) {
        const cloneResult = await cloneVoice(
          recordingBuffer,
          `call-${callId}-${Date.now()}`,
          `Cloned voice for translation run ${translationRunId}`
        )
        clonedVoiceId = cloneResult.voiceId
        voiceIdToUse = clonedVoiceId
        usedVoiceCloning = true
      }
    }
  } catch (cloneError) {
    logger.error('translation: voice cloning failed, falling back to default voice', cloneError)
  }
}

const audioStream = await generateSpeech(translatedText, toLanguage, voiceIdToUse)
```

✅ **This works:** ElevenLabs clones voice and generates post-call translation MP3

### What Doesn't Work (Live Translation)

**For live translation during calls:**
- Uses SignalWire SWML AI Agents
- [app/api/voice/swml/translation/route.ts](app/api/voice/swml/translation/route.ts) endpoint
- **No voice cloning capability**
- Always uses default SignalWire TTS voices

**File:** [lib/signalwire/translationSwmlBuilder.ts](lib/signalwire/translationSwmlBuilder.ts)
- No voice cloning parameter
- No ElevenLabs integration
- Just passes `voice` param (language code like 'en', 'de')

### The Architecture Conflict

**Two Separate Translation Systems:**

| System | When | Voice | Technology | Status |
|--------|------|-------|------------|--------|
| **Post-Call** | After call ends | ✅ Can clone | ElevenLabs | ✅ Working |
| **Live** | During call | ❌ No clone | SignalWire | ✅ Working (no clone) |

**User expectation:** "Voice Cloning" toggle applies to ALL translation

**Reality:** Only applies to post-call translation audio files

### Why This Matters

**From UI perspective:**
- Toggle appears under "Translation" section
- No indication it only works for post-call
- Users expect voice cloning during live calls

**From architecture docs:**
- [ARCH_DOCS/05-STATUS/ELEVENLABS_VS_SIGNALWIRE_ANALYSIS.md](ARCH_DOCS/05-STATUS/ELEVENLABS_VS_SIGNALWIRE_ANALYSIS.md) asks:
  > "Can SignalWire AI Agents clone/mimic the caller's voice during live translation?"
  
  **Answer: UNKNOWN** - needs vendor confirmation

### Current State

**ElevenLabs Integration:**
- ✅ Complete implementation in [app/services/elevenlabs.ts](app/services/elevenlabs.ts)
- ✅ Voice cloning working for post-call
- ✅ 29 languages supported
- ⚠️ **NOT used for live calls**

**SignalWire AI Agents:**
- ✅ Complete SWML generation
- ✅ Live translation working
- ❌ No voice cloning capability documented
- ❌ Uses generic TTS voices

### Fix Options

**Option 1: Disable Voice Cloning Toggle for Live Translation**
- Remove toggle when translation is enabled
- Show message: "Voice cloning available for post-call translation audio only"
- Set user expectations correctly

**Option 2: Research SignalWire Voice Capabilities**
- Contact SignalWire support
- Ask about AI Agent voice cloning/preservation
- If possible, implement for live calls
- If not possible, go with Option 1

**Option 3: Hybrid Approach**
- Keep toggle but add clarification text
- "Voice cloning applies to post-call translation audio. Live translation uses standard voices."

### UI Issue to Fix

**File:** [components/voice/CallModulations.tsx](components/voice/CallModulations.tsx) Line 290+

**Current:**
```tsx
{/* Voice cloning - only show when translation is enabled */}
{checked && (
  <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
    <div>
      <span className="text-xs font-medium text-gray-700">Voice Cloning</span>
      <p className="text-xs text-gray-500">Clone caller voice</p>
    </div>
```

**Should be:**
```tsx
{/* Voice cloning - only show when translation is enabled */}
{checked && (
  <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
    <div>
      <span className="text-xs font-medium text-gray-700">Voice Cloning</span>
      <p className="text-xs text-gray-500">Clone caller voice (post-call audio only)</p>
    </div>
```

### Testing Reality Check

- [ ] Enable voice cloning toggle
- [ ] Place call with live translation
- [ ] **Verify:** Live call uses generic TTS voice (not cloned)
- [ ] Wait for post-call translation
- [ ] **Verify:** Post-call MP3 uses cloned voice ✅
- [ ] **Conclusion:** Feature is misleadingly named/described

---

## Issue #4: Voice Config Fields Not Queried in LaML Generator

**Severity:** 🟡 MEDIUM  
**Impact:** Multiple configuration fields exist but aren't used

### Unused Fields in LaML Outbound

**File:** [app/api/voice/laml/outbound/route.ts](app/api/voice/laml/outbound/route.ts) Line 64

**Query:**
```typescript
.select('record, transcribe, translate, translate_from, translate_to, survey, synthetic_caller, survey_prompts, survey_webhook_email')
```

**Fields in Schema but NOT Queried:**
- `script_id` - For loading shopper scripts (Issue #2)
- `shopper_script` - Fallback script text
- `shopper_persona` - Voice characteristics
- `shopper_voice` - TTS voice selection
- `use_voice_cloning` - Post-call only (Issue #3)
- `cloned_voice_id` - ElevenLabs voice ID
- `survey_voice` - AI survey bot voice
- `survey_inbound_number` - Dedicated survey number
- `caller_id_mask` - Custom caller ID (✅ queried elsewhere)

**Why This Is a Problem:**
- Schema expanded with new fields
- Fields successfully saved from UI
- But execution code never updated to read them

### Pattern Analysis

All broken features follow the same pattern:
1. ✅ UI component created
2. ✅ Database migration added
3. ✅ API endpoint saves to DB
4. ❌ **Execution code not updated**
5. ❌ **LaML/SWML generator doesn't read new fields**

This suggests a **process gap** where:
- Frontend changes are complete
- Backend storage is complete
- But the "last mile" (call execution) isn't updated

---

## Working Features (For Comparison)

### ✅ Caller ID Mask - WORKING CORRECTLY

**File:** [app/actions/calls/startCallHandler.ts](app/actions/calls/startCallHandler.ts) Line 136-151

```typescript
// Check for caller ID mask (custom display number)
let fromNumber = swNumber
try {
  const { data: vcRows } = await supabaseAdmin
    .from('voice_configs')
    .select('caller_id_mask, caller_id_verified')
    .eq('organization_id', organization_id)
    .limit(1)
  
  const callerIdMask = vcRows?.[0]?.caller_id_mask
  const isVerified = vcRows?.[0]?.caller_id_verified
  
  // Only use mask if it's set and verified
  if (callerIdMask && (isVerified || callerIdMask.startsWith('+1'))) {
    fromNumber = callerIdMask
    logger.info('placeSignalWireCall: using caller ID mask', { masked: true, verified: isVerified })
  }
} catch (e) {
  // Best effort - continue with default number
}

params.append('From', fromNumber)
```

**Why This Works:**
- ✅ Field queried at execution time
- ✅ Value extracted and used immediately
- ✅ Applied to SignalWire API call
- ✅ Proper error handling

**This is the pattern to follow for fixes.**

### ✅ Recording - WORKING CORRECTLY

**Multiple layers ensure recording:**
1. REST API: `Record=true` parameter (Line 238)
2. LaML: `<Record>` verb (Line 87)
3. Conference: `record="record-from-answer"` attribute (Line 170)

### ✅ Translation - WORKING CORRECTLY

**File:** [app/actions/calls/startCallHandler.ts](app/actions/calls/startCallHandler.ts) Line 169-195

```typescript
// Get translation language settings from voice_configs
let translateFrom: string | null = null
let translateTo: string | null = null
try {
  const { data: vcRows } = await supabaseAdmin
    .from('voice_configs')
    .select('translate_from, translate_to')
    .eq('organization_id', organization_id)
    .limit(1)
  if (vcRows?.[0]) {
    translateFrom = vcRows[0].translate_from || null
    translateTo = vcRows[0].translate_to || null
  }
} catch (e) {
  logger.warn('Failed to fetch translation languages', e as Error)
}

// Fail if language codes are not configured
if (!translateFrom || !translateTo) {
  const e = new AppError({ 
    code: 'TRANSLATION_LANGUAGES_REQUIRED', 
    message: 'Translation requires source and target languages to be configured',
    user_message: 'Please configure translation languages before placing a translated call', 
    severity: 'HIGH' 
  })
  throw e
}
```

**Why This Works:**
- ✅ Reads config at execution time
- ✅ Validates required fields
- ✅ Routes to appropriate endpoint (SWML vs LaML)
- ✅ Error handling for missing config

---

## Root Cause Analysis

### Common Pattern

All broken features share:
1. **Complete UI** - Users can configure
2. **Complete Storage** - Data saved to DB
3. **Complete API** - CRUD operations work
4. **Incomplete Execution** - Call flow doesn't use config

### Why This Happened

**Hypothesis:** Feature development was done in phases:
- **Phase 1:** UI + Database (complete)
- **Phase 2:** API endpoints (complete)
- **Phase 3:** Call execution integration (**INCOMPLETE**)

The "plumbing" exists, but the final connection wasn't made.

### Impact Severity by Feature

| Feature | User Impact | Business Impact | Fix Complexity |
|---------|-------------|-----------------|----------------|
| Survey | HIGH - Can't use custom questions | HIGH - Core feature broken | LOW - 2 file changes |
| Secret Shopper | MEDIUM - Can't use custom scripts | MEDIUM - Limits testing scenarios | LOW - 2 file changes |
| Voice Cloning | LOW - Still works for post-call | LOW - Expectation mismatch | LOW - UI text change |

---

## Recommended Fix Priority

### 🔴 Priority 1: After-Call Survey
- **Why:** Core feature customers expect
- **Impact:** High - unusable with hardcoded questions
- **Effort:** Low - see SURVEY_INVOCATION_VALIDATION_REPORT.md
- **Timeline:** 1-2 hours

### 🟡 Priority 2: Secret Shopper Scripts
- **Why:** Premium feature for QA/testing
- **Impact:** Medium - limits customization
- **Effort:** Low - same pattern as survey fix
- **Timeline:** 1-2 hours

### 🟢 Priority 3: Voice Cloning UX
- **Why:** Avoid user confusion
- **Impact:** Low - feature works, just mislabeled
- **Effort:** Very Low - text change only
- **Timeline:** 15 minutes

---

## Success Criteria

**After fixes, verify:**
- [ ] Custom survey questions appear in LaML
- [ ] Custom shopper scripts used in outbound calls
- [ ] Voice cloning toggle description clarifies post-call only
- [ ] All config fields from voice_configs properly read at execution time
- [ ] No more "hardcoded fallbacks" in LaML generator

---

## Related Documents

- [SURVEY_INVOCATION_VALIDATION_REPORT.md](SURVEY_INVOCATION_VALIDATION_REPORT.md) - Detailed survey analysis
- [ARCH_DOCS/02-FEATURES/AI_SURVEY_BOT.md](ARCH_DOCS/02-FEATURES/AI_SURVEY_BOT.md) - Survey architecture
- [ARCH_DOCS/02-FEATURES/SECRET_SHOPPER_INFRASTRUCTURE.md](ARCH_DOCS/02-FEATURES/SECRET_SHOPPER_INFRASTRUCTURE.md) - Shopper design
- [ARCH_DOCS/05-STATUS/ELEVENLABS_VS_SIGNALWIRE_ANALYSIS.md](ARCH_DOCS/05-STATUS/ELEVENLABS_VS_SIGNALWIRE_ANALYSIS.md) - Voice cloning research

---

## Conclusion

**3 of 7 major features have integration gaps** where UI configuration exists but execution doesn't use it. All follow the same pattern: complete frontend/backend, incomplete execution integration. Fixes are straightforward and follow existing patterns from working features (caller ID mask, translation).

**Immediate action:** Fix survey and shopper script issues using working features as templates.
