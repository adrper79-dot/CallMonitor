# Translation Issues - Root Cause Analysis

**Date:** January 12, 2026  
**Status:** 🔴 **CRITICAL ISSUES FOUND**

---

## 🚨 **ISSUE #1: Feature Flag Not Set (CRITICAL)**

### **Problem:**
```bash
# Feature flag is NOT set:
TRANSLATION_LIVE_ASSIST_PREVIEW=true  # ← MISSING!
```

### **Impact:**
```typescript
// In startCallHandler.ts line 396:
const isFeatureFlagEnabled = isLiveTranslationPreviewEnabled()
// Returns: FALSE (because env var not set)

// Line 397:
const shouldUseLiveTranslation = 
  isBusinessPlan && 
  isFeatureFlagEnabled &&  // ← Always FALSE!
  effectiveModulations.translate === true && 
  !!effectiveModulations.translate_from && 
  !!effectiveModulations.translate_to

// Result: shouldUseLiveTranslation = FALSE
// Calls NEVER route to SWML endpoint
// Live translation NEVER activates!
```

### **Fix:**
```bash
# Add to .env.local:
TRANSLATION_LIVE_ASSIST_PREVIEW=true

# Add to Vercel environment variables:
TRANSLATION_LIVE_ASSIST_PREVIEW=true
```

---

## 🚨 **ISSUE #2: Architecture Mismatch - STT Provider**

### **Your Concern:**
> "AssemblyAI should be driving the STT, not GPT"

### **Current Implementation:**

```
LIVE TRANSLATION (Real-Time):
  Customer speaks → SignalWire STT → GPT-4o-mini (translation) → SignalWire TTS

POST-CALL (Canonical):
  Recording → AssemblyAI STT → OpenAI (translation) → ElevenLabs TTS
```

### **The Architecture Confusion:**

**What the Architecture Doc Says:**
```
"AssemblyAI is the canonical transcript source"
"SignalWire AI Agent is execution only, non-authoritative"
```

**What This Actually Means:**
- **LIVE:** SignalWire STT is ephemeral, non-authoritative (for real-time only)
- **POST-CALL:** AssemblyAI STT is canonical, authoritative (for records)

### **Why SignalWire Does STT for Live Translation:**

**Technical Reality:**
1. AssemblyAI processes recordings AFTER the call ends
2. AssemblyAI has ~30-60 second processing time
3. Live translation needs real-time STT (<500ms latency)
4. SignalWire AI Agent has built-in real-time STT

**Architecture Alignment:**
```
┌─────────────────────────────────────────────┐
│  LIVE Translation (Ephemeral)               │
│  SignalWire AI Agent:                       │
│    - STT: Real-time (non-authoritative)     │
│    - Translation: GPT-4o-mini               │
│    - TTS: SignalWire voices                 │
│  Status: Execution only, disposable         │
└─────────────────────────────────────────────┘
              ↓ (after call)
┌─────────────────────────────────────────────┐
│  POST-CALL (Canonical/Authoritative)        │
│  AssemblyAI:                                │
│    - STT: From recording (AUTHORITATIVE)    │
│  OpenAI:                                    │
│    - Translation: (AUTHORITATIVE)           │
│  ElevenLabs:                                │
│    - TTS: High-quality audio                │
│  Status: System of record                   │
└─────────────────────────────────────────────┘
```

**This is CORRECT per architecture!**

---

## 🔴 **ACTUAL PROBLEM: Feature Architecture Conflict**

### **The Real Issue:**

**If you want AssemblyAI to do LIVE STT, there are fundamental conflicts:**

```
Option A (Current): SignalWire AI Agent
  ✅ Real-time STT (~200-500ms)
  ✅ Works for live translation
  ❌ Non-authoritative (ephemeral)
  ❌ SignalWire vendor lock-in

Option B (Requested?): AssemblyAI for Live STT
  ❌ AssemblyAI doesn't do real-time STT
  ❌ Only processes recordings (30-60 sec delay)
  ❌ Can't be used for live translation
  ✅ Would be authoritative if it worked
```

### **Solution Options:**

#### **Option 1: Keep Current Architecture (RECOMMENDED)**
```
LIVE: SignalWire STT (ephemeral, for UX only)
POST-CALL: AssemblyAI STT (canonical, for records)
```

**Pros:**
- ✅ Works with current tech
- ✅ Aligns with architecture doc
- ✅ Low latency for live translation
- ✅ AssemblyAI remains canonical

**Cons:**
- ⚠️ Two different STT sources
- ⚠️ Live transcript might differ from canonical

---

#### **Option 2: Use AssemblyAI Real-Time API (NEW OPTION)**

**AssemblyAI offers a real-time STT API!**

```
LIVE: AssemblyAI Real-Time STT → GPT-4o-mini → ElevenLabs TTS
POST-CALL: AssemblyAI Recording STT (same provider!)
```

**Pros:**
- ✅ Single STT provider (AssemblyAI for both)
- ✅ Consistent transcripts
- ✅ No SignalWire vendor lock-in for STT
- ✅ Better quality (AssemblyAI > SignalWire STT)

**Cons:**
- ⚠️ Requires custom integration (no SignalWire AI Agent)
- ⚠️ Need to build: WebSocket → AssemblyAI RT → Translation → TTS → Media Streams
- ⚠️ Higher complexity
- ⚠️ 1-2 weeks implementation

**Architecture:**
```
┌──────────────────────────────────────────────────┐
│  SignalWire Media Streams (audio only)           │
└──────────────────────────────────────────────────┘
              ↓ WebSocket (audio stream)
┌──────────────────────────────────────────────────┐
│  Our Real-Time Translation Service               │
│  ┌────────────────────────────────────────────┐  │
│  │  1. Audio → AssemblyAI Real-Time STT       │  │
│  │     └─> "Hola, ¿cómo estás?"             │  │
│  │                                            │  │
│  │  2. Text → GPT-4o-mini Translation        │  │
│  │     └─> "Hello, how are you?"            │  │
│  │                                            │  │
│  │  3. Text → ElevenLabs TTS                 │  │
│  │     └─> Audio stream                      │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
              ↓ WebSocket (audio stream back)
┌──────────────────────────────────────────────────┐
│  SignalWire Media Streams (inject audio)         │
└──────────────────────────────────────────────────┘
```

---

#### **Option 3: No Live Translation, Post-Call Only**
```
LIVE: No translation (original audio only)
POST-CALL: AssemblyAI STT → OpenAI → ElevenLabs
```

**Pros:**
- ✅ Simple
- ✅ AssemblyAI is only STT provider
- ✅ Authoritative from day one

**Cons:**
- ❌ No real-time translation during calls
- ❌ Users can't communicate in real-time

---

## 📊 **COMPARISON TABLE**

| Aspect | Current (SW AI Agent) | Option 2 (AssemblyAI RT) | Option 3 (Post-Call Only) |
|--------|----------------------|-------------------------|--------------------------|
| **Live Translation** | ✅ YES | ✅ YES | ❌ NO |
| **STT Provider (Live)** | SignalWire | AssemblyAI | N/A |
| **STT Provider (Post)** | AssemblyAI | AssemblyAI | AssemblyAI |
| **Single STT Source** | ❌ NO | ✅ YES | ✅ YES |
| **Latency** | ~200-500ms | ~300-600ms | N/A |
| **Implementation** | ✅ Done (needs flag) | ⏳ 1-2 weeks | ✅ Done |
| **Complexity** | Low | High | Very Low |
| **Cost** | Low | Medium | Low |
| **Quality** | Good | Excellent | Excellent |

---

## 🔍 **CURRENT IMPLEMENTATION REVIEW**

### **Files Checked:**

1. ✅ **`app/actions/calls/startCallHandler.ts`**
   - Line 396: `isLiveTranslationPreviewEnabled()` check
   - Line 397: `shouldUseLiveTranslation` logic
   - Line 427: Routes to SWML if enabled
   - **Status:** Logic is CORRECT
   - **Problem:** Feature flag returns FALSE

2. ✅ **`lib/env-validation.ts`**
   - Line 83: Feature flag definition
   - Line 166: `isLiveTranslationPreviewEnabled()` function
   - **Status:** Code is CORRECT
   - **Problem:** Env var not set

3. ✅ **`app/api/voice/swml/outbound/route.ts`**
   - Lines 100-107: Gets voice_configs
   - Lines 149-157: Builds SWML with languages
   - **Status:** Code is CORRECT
   - **Would work if:** Feature flag enabled

4. ✅ **`lib/signalwire/agentConfig.ts`**
   - Lines 103-147: Agent configuration
   - Line 121: `model: 'gpt-4o-mini'` (for translation, not STT!)
   - Line 139: `canonical_transcript_source: 'assemblyai'`
   - **Status:** Code is CORRECT
   - **Note:** GPT is for TRANSLATION, not STT

5. ✅ **`lib/signalwire/swmlBuilder.ts`**
   - Lines 111-175: Builds SWML JSON
   - Lines 124-149: AI agent configuration
   - **Status:** Code is CORRECT

### **Verdict:**
**ALL CODE IS CORRECT!** The only issue is the feature flag not being set.

---

## 🎯 **CLARIFICATION: GPT vs STT**

### **Current Flow (CORRECT):**

```
Customer speaks Spanish:
  "Hola, ¿cómo estás?"
      ↓
  SignalWire AI Agent STT (built-in)
      ↓
  TEXT: "Hola, ¿cómo estás?"
      ↓
  GPT-4o-mini (TRANSLATION only, not STT!)
      ↓
  TEXT: "Hello, how are you?"
      ↓
  SignalWire TTS
      ↓
  AUDIO: "Hello, how are you?"
      ↓
  Agent hears English
```

**GPT-4o-mini is doing TRANSLATION, not STT!**

### **Where STT Happens:**

**LIVE (Non-Authoritative):**
- **Provider:** SignalWire AI Agent (built-in STT)
- **Purpose:** Real-time translation
- **Status:** Ephemeral, disposable

**POST-CALL (Authoritative):**
- **Provider:** AssemblyAI
- **Purpose:** Canonical transcript
- **Status:** System of record

**This is architecturally correct!**

---

## 🚀 **RECOMMENDED FIXES**

### **Immediate Fix (5 minutes):**

#### **Step 1: Enable Feature Flag**

**Local (.env.local):**
```bash
TRANSLATION_LIVE_ASSIST_PREVIEW=true
```

**Vercel (Production):**
```
Settings → Environment Variables → Add:
Name: TRANSLATION_LIVE_ASSIST_PREVIEW
Value: true
```

#### **Step 2: Restart Development Server**
```bash
npm run dev
```

#### **Step 3: Test**
1. Go to Settings
2. Enable Translation
3. Set: Spanish → English
4. Make call
5. Check logs for: `"shouldUseLiveTranslation: true"`

---

### **Medium-Term Decision (THIS WEEK):**

**Choose Architecture:**

#### **Option A: Keep Current (RECOMMENDED)**
- **Action:** Just enable feature flag
- **Timeline:** Today
- **Result:** Live translation works with SignalWire STT

#### **Option B: Switch to AssemblyAI Real-Time**
- **Action:** Implement custom real-time pipeline
- **Timeline:** 1-2 weeks
- **Result:** Single STT provider (AssemblyAI for both live and post-call)

#### **Option C: Post-Call Only**
- **Action:** Disable live translation
- **Timeline:** Today
- **Result:** Translation available after call only

---

## 📋 **QUESTIONS FOR YOU**

### **Q1: Feature Flag**
**Will you enable `TRANSLATION_LIVE_ASSIST_PREVIEW=true` now?**

### **Q2: STT Provider**
**Which architecture do you prefer?**

**A) Current (SignalWire STT live, AssemblyAI post-call)**
- ✅ Works today
- ✅ Low latency
- ⚠️ Two STT sources

**B) AssemblyAI Real-Time (AssemblyAI for both live and post-call)**
- ⏳ 1-2 weeks to implement
- ✅ Single STT provider
- ✅ Better consistency

**C) Post-Call Only (AssemblyAI only)**
- ✅ Works today
- ❌ No live translation

### **Q3: Testing**
**Want me to help you test the current implementation after enabling the flag?**

---

## 🎯 **MY RECOMMENDATION**

**Step 1: Enable flag and test current implementation TODAY**
- See if SignalWire STT quality is acceptable
- Check if dual-STT architecture is a real problem
- Make informed decision based on real data

**Step 2: Based on test results:**
- **If STT quality is good:** Ship it! ✅
- **If consistency is critical:** Implement AssemblyAI RT option

**Don't optimize prematurely!** Test first! 🚀

---

## 📞 **NEXT STEPS**

1. Enable `TRANSLATION_LIVE_ASSIST_PREVIEW=true`
2. Run migration (if not done)
3. Make test call
4. Evaluate:
   - Does live translation work?
   - Is STT quality acceptable?
   - Is dual-provider a problem?
5. Decide on architecture

**Ready to enable the flag and test?** ✨
