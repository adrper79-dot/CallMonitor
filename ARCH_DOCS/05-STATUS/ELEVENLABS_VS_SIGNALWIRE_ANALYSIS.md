# ElevenLabs vs SignalWire Voice Analysis

**Date:** January 14, 2026  
**Status:** 🔴 **POTENTIAL VENDOR REDUNDANCY IDENTIFIED**  
**Question:** Why use ElevenLabs when SignalWire AI Agents have voice capabilities?

---

## 🎯 **Executive Summary**

**SHORT ANSWER:** You're paying for TWO voice services that have overlapping capabilities.

**Current Setup:**
- ✅ **SignalWire:** Live translation + AI Agents (NOT IMPLEMENTED)
- ✅ **ElevenLabs:** Post-call TTS + voice cloning (IMPLEMENTED)

**The Question:** Can SignalWire AI Agents replace ElevenLabs?

---

## 📊 **What Each Service Actually Does**

### **ElevenLabs (Currently Used)**

| Feature | Capability | Status | Use Case |
|---------|-----------|--------|----------|
| **Text-to-Speech** | High-quality voice synthesis | ✅ ACTIVE | Generate audio from translated text |
| **Voice Cloning** | Clone speaker's voice | ✅ PLANNED | Maintain voice characteristics in translation |
| **Multi-language** | 29 languages | ✅ ACTIVE | Speak translations in any language |
| **Timing** | POST-CALL processing | ✅ ACTIVE | After transcription/translation completes |
| **Output** | Audio files (MP3) | ✅ ACTIVE | Store in Supabase Storage |

**Current Flow:**
```
Call ends → AssemblyAI transcribes → 
OpenAI translates → ElevenLabs TTS → 
Audio file stored → User listens later
```

**Cost:** ~$99/month (Pro plan with voice cloning)

---

### **SignalWire AI Agents (NOT Currently Used)**

| Feature | Capability | Status | Use Case |
|---------|-----------|--------|----------|
| **Real-Time Translation** | Live bi-directional translation | ❌ NOT IMPLEMENTED | Translate during call |
| **Text-to-Speech** | AI-generated speech | ❌ NOT IMPLEMENTED | Speak translations in real-time |
| **Voice Configuration** | Multiple voice options | ❌ NOT IMPLEMENTED | Choose TTS voice |
| **Timing** | DURING-CALL processing | ❌ NOT IMPLEMENTED | Immediate (1-3 sec latency) |
| **Output** | Live RTP audio injection | ❌ NOT IMPLEMENTED | Spoken directly into call |

**Designed Flow (Not Built):**
```
During call → AI Agent listens → 
Translates immediately → Speaks → 
Caller hears in real-time
```

**Cost:** Already included in SignalWire Business Plan (~$500/mo)

---

## 🔍 **Key Differences**

| Aspect | ElevenLabs | SignalWire AI Agents |
|--------|-----------|---------------------|
| **Timing** | POST-CALL (minutes later) | LIVE (seconds) |
| **Voice Quality** | ⭐⭐⭐⭐⭐ Best-in-class | ⭐⭐⭐⭐ Very good |
| **Voice Cloning** | ✅ Yes (maintain speaker's voice) | ❓ **UNKNOWN** |
| **Use Case** | Audio artifacts for review | Real-time conversation assist |
| **Integration** | Async/batch | Real-time/streaming |
| **Authority** | Can be canonical | Ephemeral/non-authoritative |

---

## ❓ **The Critical Unknown: SignalWire Voice Cloning**

**Question:** Can SignalWire AI Agents clone/mimic the caller's voice during live translation?

### **What We Know:**
✅ SignalWire AI Agents can do real-time TTS  
✅ SignalWire AI Agents support multiple voice configurations  
✅ SignalWire AI Agents can detect language and adapt  

### **What We DON'T Know:**
❓ Can they clone the original speaker's voice characteristics?  
❓ Can they maintain tone, pitch, and speaking style?  
❓ Do they have voice preservation across languages?  

**Need to verify:**
- SignalWire AI Agents documentation
- SignalWire support/sales confirmation
- Test implementation

---

## 🎯 **Three Architectural Scenarios**

### **Scenario 1: SignalWire Has Voice Cloning**

**IF SignalWire AI Agents CAN clone voices:**

✅ **ELIMINATE ElevenLabs entirely**

**New Architecture:**
```
DURING CALL (SignalWire AI Agent):
- Listen to speaker's voice
- Clone voice characteristics
- Translate speech
- Speak translation in cloned voice
- Real-time (1-3 seconds)

AFTER CALL (AssemblyAI):
- Generate canonical transcript
- Store for evidence/audit
- No audio generation needed (happened live)
```

**Benefits:**
- ✅ ONE vendor instead of two
- ✅ Live translation (better UX)
- ✅ Save $99/month (ElevenLabs cost)
- ✅ Simpler architecture

**Trade-offs:**
- ⚠️ No post-call audio artifacts (only live)
- ⚠️ Voice quality might be slightly lower
- ⚠️ Vendor lock-in to SignalWire

---

### **Scenario 2: SignalWire Does NOT Have Voice Cloning**

**IF SignalWire AI Agents CANNOT clone voices:**

✅ **USE BOTH (Current Architecture is Correct)**

**Why Keep Both:**
```
DURING CALL (SignalWire AI Agent):
- Real-time translation
- Generic TTS voice
- Immediate conversation assist

AFTER CALL (ElevenLabs):
- High-quality TTS
- Voice cloning from recording
- Premium audio artifacts for review/evidence
```

**Benefits:**
- ✅ Best of both worlds
- ✅ Live assist (SignalWire)
- ✅ Premium quality post-call (ElevenLabs)
- ✅ Voice preservation (ElevenLabs)

**Trade-offs:**
- ⚠️ Two vendors (more cost)
- ⚠️ More complex architecture
- ⚠️ Duplicate capabilities (TTS)

---

### **Scenario 3: SignalWire Has "Good Enough" Voice Matching**

**IF SignalWire AI Agents have BASIC voice matching (not cloning):**

⚠️ **STRATEGIC CHOICE REQUIRED**

**Option A: Drop ElevenLabs**
- Accept "good enough" voice quality
- Prioritize simplicity + cost savings
- Suitable for most use cases

**Option B: Keep Both**
- Use SignalWire for live assist
- Use ElevenLabs for premium post-call artifacts
- Suitable for high-value clients who need best quality

---

## 💰 **Cost Analysis**

### **Current Setup (If You Keep Both):**
```
SignalWire Business Plan:     $500/month
ElevenLabs Pro Plan:          $99/month
TOTAL:                        $599/month
```

### **If SignalWire Can Replace ElevenLabs:**
```
SignalWire Business Plan:     $500/month
TOTAL:                        $500/month

SAVINGS:                      $99/month = $1,188/year
```

### **Additional Considerations:**
- **ElevenLabs Character Limits:** Pro plan has 100,000 chars/month
- **SignalWire Usage:** Included in Business plan (no extra per-minute charges for AI Agent)
- **Scaling:** SignalWire scales with call volume automatically

---

## 🔍 **Current Implementation Status**

### **ElevenLabs Integration:**

**Implemented:**
✅ Post-call TTS for translations  
✅ Audio upload to Supabase Storage  
✅ Audio player in UI  
✅ 29 language support  

**Files:**
- ❌ **NOT FOUND:** `app/services/elevenlabs.ts` (mentioned in docs but not in codebase)
- ❌ **NOT FOUND:** Any `.ts` files importing ElevenLabs

**Status:** 🔴 **DOCUMENTED BUT NOT IMPLEMENTED**

### **SignalWire AI Agents:**

**Status:** ❌ **NOT IMPLEMENTED**

---

## 🚨 **CRITICAL FINDING**

**ElevenLabs is NOT actually implemented in your codebase!**

Grep search for ElevenLabs in `.ts` files returned:
```
No files with matches found
```

**What This Means:**
- 📝 ElevenLabs is documented extensively
- 📝 Schema has `use_voice_cloning`, `cloned_voice_id` fields
- ❌ No actual ElevenLabs service integration exists
- ❌ No TTS generation happening

**Implication:**
You're planning TWO features that aren't implemented:
1. SignalWire AI Agents (live translation)
2. ElevenLabs (post-call TTS)

---

## 🎯 **RECOMMENDATION**

### **Path Forward:**

**Step 1: Research SignalWire Voice Capabilities**
- Contact SignalWire support/sales
- Ask: "Do AI Agents support voice cloning or voice characteristic preservation?"
- Request: Live demo of AI Agent translation with voice options

**Step 2A: IF SignalWire Has Voice Cloning**
- ✅ **Implement SignalWire AI Agents ONLY**
- ❌ **Skip ElevenLabs entirely**
- ✅ Save $99/month + reduce complexity

**Step 2B: IF SignalWire Does NOT Have Voice Cloning**
- ✅ **Implement SignalWire AI Agents** (live translation)
- ✅ **Implement ElevenLabs** (post-call premium TTS with voice cloning)
- ✅ Position as tiered feature:
  - **Business Plan:** Live translation (SignalWire voice)
  - **Enterprise Plan:** Live translation + premium post-call audio (ElevenLabs cloned voice)

---

## 📋 **Action Items**

### **Immediate (This Week):**
1. [ ] **Research:** Contact SignalWire about voice cloning capabilities
2. [ ] **Verify:** Check if SignalWire Business plan includes AI Agent voice features
3. [ ] **Test:** If possible, test SignalWire AI Agent voice quality in sandbox

### **After Research (Next Week):**
4. [ ] **Decide:** Keep ElevenLabs or skip based on SignalWire capabilities
5. [ ] **Document:** Update architecture with decision rationale
6. [ ] **Implement:** Start with chosen solution (SignalWire only or both)

---

## 🔗 **References**

- Your Architecture: `ARCH_DOCS/02-FEATURES/Translation_Agent`
- ElevenLabs Plan: `ARCH_DOCS/06-ARCHIVE/ELEVENLABS_IMPLEMENTATION_COMPLETE.md`
- SignalWire Research: `ARCH_DOCS/03-INFRASTRUCTURE/SIGNALWIRE_AI_AGENTS_RESEARCH.md`
- Schema: `voice_configs.use_voice_cloning`, `voice_configs.cloned_voice_id`

---

## 💡 **Bottom Line**

**You're asking the right question.**

If SignalWire AI Agents can do voice cloning/preservation, then **ElevenLabs is redundant** and adds:
- Extra cost ($99/month)
- Extra complexity (two vendor integrations)
- Extra latency (post-call processing)

**But:** If SignalWire CANNOT do voice cloning, then ElevenLabs provides unique value for premium voice quality.

**Next Step:** Contact SignalWire and ask about AI Agent voice capabilities.
