# Complete Call Flow Analysis - All Types with Translation

**Date:** January 12, 2026  
**Purpose:** Visual representation of all call flows + gap analysis  
**Status:** 🚨 **CRITICAL GAPS IDENTIFIED**

---

## 🎯 **EXECUTIVE SUMMARY**

**What You Asked For:** Live caller-to-caller translation using ElevenLabs  
**What I Implemented:** Post-call translation audio generation  
**Gap:** Real-time translation NOT implemented  
**Required:** SignalWire AI Agent integration + ElevenLabs streaming

---

## 📊 **CALL FLOW TYPE 1: SINGLE-LEG CALL (No Translation)**

### **Current Implementation:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SINGLE-LEG CALL FLOW                          │
└─────────────────────────────────────────────────────────────────┘

USER (UI)
  │
  │ 1. Start Call (phone_number)
  ├──> startCallHandler.ts
  │      │
  │      │ 2. Create call record
  │      ├──> Supabase: INSERT calls
  │      │
  │      │ 3. Initiate SignalWire call
  │      ├──> SignalWire REST API
  │      │      - From: +1234567890
  │      │      - To: customer_number
  │      │      - Record: true ✅
  │      │      - Url: /api/voice/laml/outbound?callId=xxx
  │      │
  │      └──> Returns call_sid
  │
SignalWire (Media Plane)
  │
  │ 4. Fetch LaML instructions
  ├──> GET /api/voice/laml/outbound
  │      └──> Returns:
  │             <Response>
  │               <Pause length="3600"/>  ← Keeps call alive
  │               <Hangup/>
  │             </Response>
  │
  │ 5. Call executes (audio flows)
  │    RTP ←──→ Customer
  │
  │ 6. Call ends
  ├──> SignalWire records audio
  │
  │ 7. POST webhook (call completed + recording)
  ├──> POST /api/webhooks/signalwire
  │      │
  │      │ 8. Save recording URL
  │      ├──> Supabase: UPDATE calls (status = completed)
  │      │
  │      │ 9. Queue transcription
  │      ├──> AssemblyAI: Submit audio for transcription
  │      │
  │      └──> Returns 200 OK
  │
AssemblyAI (Intelligence Plane)
  │
  │ 10. Transcription complete
  ├──> POST /api/webhooks/assemblyai
  │      │
  │      │ 11. Save transcript
  │      ├──> Supabase: INSERT ai_runs (model = 'transcription')
  │      │
  │      └──> Returns 200 OK
  │
Database (Supabase)
  │
  └──> calls: status = completed ✅
       recordings: transcript_json populated ✅
       ai_runs: transcription completed ✅
```

**Status:** ✅ **WORKING** (as of fix on Jan 12, 2026)

---

## 📊 **CALL FLOW TYPE 2: BRIDGE CALL (Two-Legged, No Translation)**

### **Current Implementation:**

```
┌─────────────────────────────────────────────────────────────────┐
│                  BRIDGE CALL FLOW (Two-Legged)                   │
└─────────────────────────────────────────────────────────────────┘

USER (UI)
  │
  │ 1. Start Bridge Call
  ├──> startCallHandler.ts
  │      │
  │      │ 2. Create call record
  │      ├──> Supabase: INSERT calls
  │      │
  │      │ 3. Create conference name
  │      │    conference = `bridge-${callId}`
  │      │
  │      │ 4. Initiate LEG A (from_number)
  │      ├──> SignalWire REST API (Leg A)
  │      │      - From: company_number
  │      │      - To: from_number (Party A)
  │      │      - Url: /api/voice/laml/outbound?
  │      │              callId=xxx&
  │      │              conference=bridge-xxx&
  │      │              leg=1
  │      │
  │      │ 5. Initiate LEG B (to_number)
  │      ├──> SignalWire REST API (Leg B)
  │      │      - From: company_number
  │      │      - To: to_number (Party B)
  │      │      - Url: /api/voice/laml/outbound?
  │      │              callId=xxx&
  │      │              conference=bridge-xxx&
  │      │              leg=2
  │      │
  │      └──> Returns call_sids for both legs
  │
SignalWire (Media Plane - LEG A)
  │
  │ 6a. Fetch LaML for Leg A
  ├──> GET /api/voice/laml/outbound?conference=bridge-xxx&leg=1
  │      └──> Returns:
  │             <Response>
  │               <Dial>
  │                 <Conference record="record-from-answer"
  │                             recordingStatusCallback="/api/webhooks/signalwire"
  │                             recordingStatusCallbackEvent="completed">
  │                   bridge-xxx
  │                 </Conference>
  │               </Dial>
  │             </Response>
  │
SignalWire (Media Plane - LEG B)
  │
  │ 6b. Fetch LaML for Leg B
  ├──> GET /api/voice/laml/outbound?conference=bridge-xxx&leg=2
  │      └──> Returns: (same LaML as Leg A)
  │
  │ 7. Both legs join conference
  │    Party A ←──────→ Conference ←──────→ Party B
  │                      │
  │                      └──> SignalWire mixes audio
  │
  │ 8. Conference records audio
  │    (Only ONE recording, not two!)
  │
  │ 9. Call ends
  ├──> POST webhook (conference recording)
  ├──> POST /api/webhooks/signalwire
  │      │
  │      │ 10. Save recording + queue transcription
  │      └──> (same flow as single-leg)
  │
Database (Supabase)
  └──> calls: status = completed ✅
       recordings: ONE recording for both legs ✅
```

**Status:** ✅ **WORKING** (as of fix on Jan 12, 2026)

---

## 📊 **CALL FLOW TYPE 3: POST-CALL TRANSLATION** 

### **Current Implementation (What I Just Added):**

```
┌─────────────────────────────────────────────────────────────────┐
│              POST-CALL TRANSLATION WITH AUDIO                    │
│              (ElevenLabs - AFTER call ends)                      │
└─────────────────────────────────────────────────────────────────┘

[... Call completes normally (Type 1 or 2) ...]
  │
AssemblyAI Webhook
  │
  │ 1. Transcription complete
  ├──> POST /api/webhooks/assemblyai
  │      │
  │      │ 2. Save transcript
  │      ├──> Supabase: ai_runs (model = 'transcription')
  │      │      └──> transcript_json = {"text": "Hola, ¿cómo estás?"}
  │      │
  │      │ 3. Check if translation enabled
  │      ├──> voice_configs.translate === true?
  │      │      │
  │      │      └──> YES
  │      │
  │      │ 4. Create translation job
  │      ├──> Supabase: ai_runs (model = 'translation', status = 'pending')
  │      │
  │      │ 5. Queue translation
  │      └──> Call translation.translateText()
  │
Translation Service (app/services/translation.ts)
  │
  │ 6. Translate text
  ├──> OpenAI API: "Translate: Hola, ¿cómo estás?"
  │      └──> Returns: "Hello, how are you?"
  │
  │ 7. Generate audio ✨ NEW!
  ├──> ElevenLabs API: generateSpeech("Hello, how are you?", "en")
  │      └──> Returns: audio stream (MP3)
  │
  │ 8. Upload audio to storage
  ├──> Supabase Storage: upload('translations/xxx.mp3', audioBuffer)
  │      └──> Returns: public URL
  │
  │ 9. Update translation record
  ├──> Supabase: UPDATE ai_runs
  │      output = {
  │        translated_text: "Hello, how are you?",
  │        translated_audio_url: "https://...mp3", ← NEW!
  │        tts_provider: "elevenlabs"               ← NEW!
  │      }
  │
UI (components/voice/TranslationView.tsx)
  │
  │ 10. Display translation
  └──> Shows:
         - Original text: "Hola, ¿cómo estás?"
         - Translated text: "Hello, how are you?"
         - 🔊 Audio player ← NEW!
```

**Status:** ✅ **WORKING** (just implemented)  
**But:** This is POST-CALL, not LIVE translation!

---

## 📊 **CALL FLOW TYPE 4: LIVE TRANSLATION (SignalWire AI Agent)**

### **REQUIRED BUT NOT IMPLEMENTED:**

```
┌─────────────────────────────────────────────────────────────────┐
│           LIVE TRANSLATION (Real-Time, Caller-to-Caller)         │
│           SignalWire AI Agent + ElevenLabs TTS                   │
│           🚨 NOT YET IMPLEMENTED 🚨                              │
└─────────────────────────────────────────────────────────────────┘

USER (UI)
  │
  │ 1. Start Call with LIVE translation
  ├──> startCallHandler.ts
  │      │
  │      │ 2. Check capabilities
  │      ├──> /api/call-capabilities
  │      │      └──> real_time_translation_preview: true?
  │      │           (requires Business plan + feature flag)
  │      │
  │      │ 3. Get language settings
  │      ├──> voice_configs
  │      │      - translation_from: "es" (Spanish)
  │      │      - translation_to: "en" (English)
  │      │
  │      │ 4. Build AI Agent config
  │      ├──> signalwire/agentConfig.ts
  │      │      └──> Returns SWML JSON with:
  │      │           - Language detection
  │      │           - Translation prompts
  │      │           - TTS voices
  │      │
  │      │ 5. Initiate call with AI Agent
  │      ├──> SignalWire REST API
  │      │      - From: +1234567890
  │      │      - To: customer_number
  │      │      - Url: /api/voice/swml/outbound?callId=xxx
  │      │      - AI_AGENT_CONFIG: {...} ← NEW!
  │      │
  │      └──> Returns call_sid
  │
SignalWire AI Agent (Media Plane + Intelligence)
  │
  │ 6. Fetch SWML instructions
  ├──> GET /api/voice/swml/outbound
  │      └──> Returns SWML JSON:
  │           {
  │             "sections": {
  │               "main": [
  │                 {"answer": {}},
  │                 {"ai": {
  │                   "prompt": {
  │                     "text": "Real-time translator: es → en"
  │                   },
  │                   "post_prompt": {
  │                     "temperature": 0.3,
  │                     "top_p": 0.8
  │                   },
  │                   "languages": ["es-MX", "en-US"],
  │                   "params": {
  │                     "record_call": true,
  │                     "engine": "gpt-4o-mini"
  │                   }
  │                 }}
  │               ]
  │             }
  │           }
  │
  │ 7. AI Agent activates
  │    ┌──────────────────────────────────────┐
  │    │  SignalWire AI Agent Pipeline:       │
  │    │                                       │
  │    │  Customer speaks (Spanish)            │
  │    │      ↓                                │
  │    │  [STT] → "Hola, ¿cómo estás?"       │
  │    │      ↓                                │
  │    │  [Language Detection] → Spanish      │
  │    │      ↓                                │
  │    │  [LLM Translation] → GPT-4o-mini     │
  │    │      ↓                                │
  │    │  "Hello, how are you?"               │
  │    │      ↓                                │
  │    │  [TTS] → SignalWire's built-in TTS   │
  │    │      ↓                                │
  │    │  [Audio Injection] → Play to agent   │
  │    │                                       │
  │    │  (Reverse flow for agent → customer) │
  │    └──────────────────────────────────────┘
  │
  │ 8. Real-time audio flow
  │    Customer (Spanish) ─────┐
  │                             ├──> AI Agent ──> Agent (English)
  │    Customer (hears English) ←─── AI Agent ←── Agent (Spanish)
  │
  │ 9. Call recording (with translations)
  │    SignalWire records mixed audio
  │
  │ 10. Call ends
  ├──> POST webhook
  ├──> POST /api/webhooks/signalwire
  │      │
  │      │ 11. Mark as live translation
  │      ├──> Supabase: UPDATE recordings
  │      │      - has_live_translation = true
  │      │      - live_translation_provider = 'signalwire'
  │      │
  │      │ 12. Queue CANONICAL transcription
  │      ├──> AssemblyAI (AUTHORITATIVE source)
  │      │
  │      └──> Returns 200 OK
  │
AssemblyAI (Canonical Source)
  │
  │ 13. Post-call transcription + translation
  ├──> (Same as Type 3 - POST-CALL flow)
  │
  └──> ai_runs: AUTHORITATIVE transcript
       (SignalWire AI output is ephemeral, non-authoritative)
```

**Status:** 🚨 **NOT IMPLEMENTED**  
**Priority:** HIGH if you want live translation

---

## 📊 **CALL FLOW TYPE 5: LIVE TRANSLATION with ELEVENLABS**

### **IDEAL IMPLEMENTATION (What You're Asking For):**

```
┌─────────────────────────────────────────────────────────────────┐
│     LIVE TRANSLATION - ENHANCED WITH ELEVENLABS TTS              │
│     (Best Quality - Not Yet Implemented)                         │
└─────────────────────────────────────────────────────────────────┘

[... Same as Type 4, but replace SignalWire TTS with ElevenLabs ...]

SignalWire AI Agent Pipeline (Modified):
  │
  Customer speaks (Spanish)
      ↓
  [STT] → "Hola, ¿cómo estás?"
      ↓
  [Language Detection] → Spanish
      ↓
  [LLM Translation] → GPT-4o-mini
      ↓
  "Hello, how are you?"
      ↓
  [ElevenLabs TTS] ← ✨ REPLACE SignalWire TTS!
      - Better voice quality
      - More natural prosody
      - Voice cloning possible
      ↓
  [Stream to SignalWire Media Streams]
      ↓
  [Audio Injection] → Play to agent

**Implementation Requirements:**
1. SignalWire AI Agent for STT + Translation
2. ElevenLabs Streaming API for TTS
3. SignalWire Media Streams for audio injection
4. WebSocket handling for real-time streaming
```

**Status:** 🚨 **NOT IMPLEMENTED**  
**Complexity:** ⭐⭐⭐⭐☆ (Advanced)  
**Timeline:** 1-2 weeks

---

## 🔍 **LANGUAGE DETECTION LOGIC**

### **Current Implementation:**

```typescript
// In voice_configs table:
{
  translation_from: "es",  // Source language
  translation_to: "en",    // Target language
  translate: true          // Enable translation
}

// Language detection happens in:
// 1. AssemblyAI (automatic language detection)
// 2. SignalWire AI Agent (if configured - NOT IMPLEMENTED)
// 3. Manual selection by user (voice_configs)
```

### **For Live Translation (Required):**

```typescript
// In signalwire/agentConfig.ts (NOT YET CREATED):
function buildAgentConfig(params: {
  callId: string
  organizationId: string
  translationFrom: string  // From voice_configs
  translationTo: string    // From voice_configs
}): SignalWireAgentConfig {
  return {
    agent: {
      languages: {
        primary: params.translationFrom || "auto",  // Auto-detect if not specified
        target: params.translationTo
      },
      prompt: {
        system: `You are a real-time translator. 
                 Detect the speaker's language automatically.
                 Translate from ${params.translationFrom} to ${params.translationTo}.
                 Preserve tone and intent.`
      },
      // ...
    }
  }
}
```

**Language Detection Flow:**
```
1. User selects languages in Settings → voice_configs
2. Call starts → Agent receives language config
3. First speech detected → AI Agent detects actual language
4. If detected ≠ configured → Use detected language
5. Translate in real-time
```

---

## 🚨 **CRITICAL GAPS IDENTIFIED**

### **Gap #1: No Live Translation Implementation**
**What's Missing:**
- ✅ Post-call translation with audio (just added)
- ❌ Real-time translation during calls
- ❌ SignalWire AI Agent integration
- ❌ SWML endpoint working correctly
- ❌ Language detection in real-time

**Impact:** Users CANNOT translate calls in real-time

---

### **Gap #2: ElevenLabs for Post-Call Only**
**What Was Implemented:**
- ✅ ElevenLabs generates audio AFTER call ends
- ✅ Audio stored and played in UI

**What's Missing:**
- ❌ ElevenLabs streaming during live calls
- ❌ Integration with SignalWire Media Streams
- ❌ Real-time audio injection

**Impact:** High-quality voice only available post-call

---

### **Gap #3: Incomplete SWML Implementation**
**Files Exist:**
- ✅ `app/api/voice/swml/outbound/route.ts` (exists)
- ✅ `lib/signalwire/swmlBuilder.ts` (exists)

**Problems:**
- ❌ Not tested with live translation
- ❌ AI Agent config not dynamic (hard-coded)
- ❌ No language parameter passing
- ❌ No capability gating

**Impact:** Live translation route exists but may not work

---

### **Gap #4: No Capability Gating**
**Required (per architecture):**
- Business plan + feature flag
- `TRANSLATION_LIVE_ASSIST_PREVIEW` env var
- Capability API returns `real_time_translation_preview`

**Current Status:**
- ❌ Feature flag exists but not checked in call flow
- ❌ Capability API doesn't return live translation capability
- ❌ UI doesn't show live translation toggle

**Impact:** Can't control who gets live translation

---

### **Gap #5: No Language Detection in Live Calls**
**Required:**
- Auto-detect caller's language
- Switch languages mid-call
- Fall back to configured language

**Current Status:**
- ❌ No detection logic in AI Agent
- ❌ Languages hard-coded or missing
- ❌ No fallback strategy

**Impact:** Wrong language translation

---

## 📋 **ISSUES LIST**

### **Issue #1: Wrong Feature Implemented**
**Severity:** 🔴 **CRITICAL**  
**Description:** Implemented POST-call audio instead of LIVE translation  
**Fix Required:** Implement SignalWire AI Agent integration  
**Timeline:** 2-3 days  
**Files Affected:**
- `app/actions/calls/startCallHandler.ts` (add AI Agent logic)
- `lib/signalwire/agentConfig.ts` (create)
- `app/api/voice/swml/outbound/route.ts` (fix)

---

### **Issue #2: SWML Route Untested**
**Severity:** 🟡 **HIGH**  
**Description:** SWML endpoint exists but not verified for live translation  
**Fix Required:** Test and fix SWML generation  
**Timeline:** 1 day  
**Files Affected:**
- `app/api/voice/swml/outbound/route.ts`
- `lib/signalwire/swmlBuilder.ts`

---

### **Issue #3: Missing Capability Gating**
**Severity:** 🟡 **HIGH**  
**Description:** No Business plan + feature flag check for live translation  
**Fix Required:** Add capability checks  
**Timeline:** 4 hours  
**Files Affected:**
- `app/api/call-capabilities/route.ts`
- `components/voice/CallModulations.tsx`
- `lib/rbac.ts`

---

### **Issue #4: ElevenLabs Not Used in Live Calls**
**Severity:** 🟠 **MEDIUM**  
**Description:** ElevenLabs only used post-call, not during calls  
**Fix Required:** Implement ElevenLabs streaming API + Media Streams  
**Timeline:** 1-2 weeks  
**Files Affected:**
- `app/services/elevenlabs.ts` (add streaming)
- New file: `app/services/realtimeTranslation.ts`

---

### **Issue #5: No Language Auto-Detection**
**Severity:** 🟠 **MEDIUM**  
**Description:** Languages must be pre-configured, no auto-detection  
**Fix Required:** Add detection logic to AI Agent config  
**Timeline:** 4 hours  
**Files Affected:**
- `lib/signalwire/agentConfig.ts`

---

### **Issue #6: Missing Schema Fields**
**Severity:** 🟢 **LOW**  
**Description:** Need `has_live_translation` in recordings table  
**Fix Required:** Run migration  
**Timeline:** 30 minutes  
**Files Affected:**
- New file: `migrations/2026-01-12-add-live-translation-fields.sql`

---

## ✅ **WHAT WORKS NOW**

1. ✅ **Single-leg calls** - Record + transcribe
2. ✅ **Bridge calls** - Two parties in conference
3. ✅ **Post-call translation** - Text translation via OpenAI
4. ✅ **Post-call audio** - ElevenLabs generates audio (NEW!)
5. ✅ **Audio playback** - UI plays translated audio (NEW!)
6. ✅ **Recording** - SignalWire records all calls

---

## 🚨 **WHAT DOESN'T WORK**

1. ❌ **Live translation** - Real-time translation during calls
2. ❌ **Caller-to-caller translation** - A speaks Spanish, B hears English
3. ❌ **Language auto-detection** - In real-time
4. ❌ **ElevenLabs live streaming** - High-quality voice during calls
5. ❌ **Capability gating** - Business plan restriction

---

## 🎯 **RECOMMENDED FIX PRIORITY**

### **Phase 1: Implement Live Translation (1 week)**
1. Create SignalWire AI Agent config builder
2. Fix SWML endpoint for live translation
3. Add capability gating
4. Test with manual languages
5. Deploy and test

### **Phase 2: Add ElevenLabs Live Streaming (2 weeks)**
1. Implement ElevenLabs streaming API
2. Integrate with SignalWire Media Streams
3. WebSocket handling
4. Test quality and latency

### **Phase 3: Language Auto-Detection (3 days)**
1. Add detection to AI Agent
2. Fallback logic
3. UI indicators

---

## 📞 **NEXT STEPS**

**Immediate (Today):**
1. Review this document
2. Confirm you want LIVE translation (not just post-call audio)
3. Decide on priority: SignalWire TTS (fast) vs ElevenLabs streaming (quality)

**Then:**
1. I'll implement SignalWire AI Agent integration
2. Fix SWML endpoint
3. Add capability gating
4. Test live translation

**Want me to start?** 🚀
