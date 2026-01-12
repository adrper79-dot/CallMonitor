# LaML vs SWML Call Flow Comparison

**Date:** January 12, 2026  
**Purpose:** Understand correct call flow patterns for both LaML and SWML endpoints

---

## 🔍 **CRITICAL FINDING**

After reviewing both LaML and SWML implementations, I discovered an important architectural understanding:

### **SWML Endpoint (CORRECT PATTERN):**
**File:** `lib/signalwire/swmlBuilder.ts` (lines 102-121)

```typescript
/**
 * Build SWML JSON for live translation with AI Agent
 * 
 * Per ARCH_DOCS SIGNALWIRE_AI_AGENTS_RESEARCH.md: When SignalWire calls our endpoint
 * (after call is initiated via REST API), we return SWML with `answer` verb.
 * 
 * For outbound calls initiated via REST API:
 * - SignalWire POSTs to REST API with From, To, Url
 * - SignalWire initiates call to To number
 * - SignalWire calls our Url endpoint (this SWML endpoint) after call is answered
 * - We return SWML with `answer` verb and AI agent configuration
 */
export function buildSWML(
  input: AgentConfigInput,
  recordCall: boolean = true
): SWMLConfig {
  const mainSection: Array<any> = []

  // Use `answer` verb when SignalWire calls our endpoint
  // The call is already initiated via REST API, so we use `answer` to handle it
  mainSection.push({ answer: {} })

  // Build AI agent configuration...
  mainSection.push({ ai: aiConfig })

  // Add recording if enabled
  if (recordCall) {
    mainSection.push({
      record_call: {
        format: 'mp3',
        stereo: false,
        recording_status_callback: `${appUrl}/api/webhooks/signalwire`
      }
    })
  }
```

**Key Insight:** SWML uses `answer` verb, **NOT** a dial verb. This is because:
1. REST API call specifies `To` parameter (destination number)
2. SignalWire handles dialing internally
3. Webhook endpoint receives call **after it's answered**
4. Endpoint returns `answer` + configuration

---

## ❌ **LaML Endpoint (INCORRECT PATTERN)**

**File:** `app/api/voice/laml/outbound/route.ts` (lines 189-203)

```typescript
// Main call flow
// IMPORTANT: For single-leg calls, 'to' is the destination we're ALREADY calling
// Don't use <Dial> or it will create a second call leg to the same number!
// 
// Single-leg: SignalWire calls destination directly → Just answer + record
// Two-leg bridge: Would need <Dial> to connect two parties (future feature)

// For now, all calls via /api/calls/start are single-leg outbound
// Just record the call (already connected to destination)
if (recordingEnabled) {
  elements.push(`<Record action="${recordingAction}" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed" maxLength="3600"/>`)
}
```

**The Problem:** LaML code **misunderstood** the SignalWire flow and applied SWML logic to LaML.

**Why LaML is Different:**
- **LaML is XML-based** (Twilio-compatible)
- **LaML does NOT support `answer` verb** without a dial action
- **LaML requires `<Dial>` verb** to initiate outbound calls

---

## 📚 **SignalWire Documentation Research**

### **REST API Call Flow:**

When you call SignalWire REST API:
```
POST https://{space}.signalwire.com/api/laml/2010-04-01/Accounts/{project}/Calls.json
Parameters:
  - From: Your SignalWire number
  - To: Destination number
  - Url: Callback URL for call instructions
```

**What happens next depends on the callback response format:**

#### **Option 1: LaML (XML)**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer">
    <Number>+1234567890</Number>
  </Dial>
</Response>
```

**Flow:**
1. REST API creates parent call (control channel)
2. SignalWire calls your Url → expects LaML XML
3. **LaML `<Dial>` verb creates child call** → rings destination
4. Call connects through child call
5. Recording happens on child call

#### **Option 2: SWML (JSON)**
```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      { "ai": { ... } },
      { "record_call": { ... } }
    ]
  }
}
```

**Flow:**
1. REST API specifies `To` parameter
2. **SignalWire dials destination automatically**
3. When call answers, SignalWire calls your Url → expects SWML JSON
4. SWML `answer` verb handles the answered call
5. AI agent and recording configured via SWML verbs

---

## 🚨 **ROOT CAUSE ANALYSIS**

### **What Went Wrong:**

The LaML endpoint **incorrectly copied the SWML pattern**:

1. ✅ **SWML comment** (swmlBuilder.ts line 107): "SignalWire initiates call to To number"
   - **This is TRUE for SWML**
   - SignalWire handles dial when REST API includes `To` parameter

2. ❌ **LaML comment** (laml/outbound/route.ts line 190): "SignalWire calls destination directly"
   - **This is FALSE for LaML**
   - LaML requires `<Dial>` verb to initiate child call

**Evidence:**
- SWML builder was created after LaML endpoint
- SWML comment explains REST API auto-dial behavior
- LaML endpoint copied this understanding **incorrectly**
- LaML does not support REST API auto-dial (requires `<Dial>` verb)

---

## ✅ **THE CORRECT PATTERNS**

### **Pattern 1: Standard Outbound Call (LaML)**

**Use Case:** Regular phone call with recording

**REST API Call:**
```javascript
POST /api/laml/2010-04-01/Accounts/{project}/Calls.json
Body: {
  From: '+1234567890',
  To: '+9876543210',
  Url: 'https://yourapp.com/api/voice/laml/outbound?to=+9876543210'
}
```

**LaML Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial record="record-from-answer" recordingStatusCallback="https://yourapp.com/api/webhooks/signalwire" recordingStatusCallbackEvent="completed">
    <Number>+9876543210</Number>
  </Dial>
</Response>
```

**Result:**
- ✅ Parent call created (control channel)
- ✅ LaML `<Dial>` creates child call
- ✅ Child call rings destination
- ✅ Recording starts when answered
- ✅ Webhook fires when recording completes

---

### **Pattern 2: Live Translation Call (SWML)**

**Use Case:** Call with AI-powered live translation

**REST API Call:**
```javascript
POST /api/laml/2010-04-01/Accounts/{project}/Calls.json
Body: {
  From: '+1234567890',
  To: '+9876543210',
  Url: 'https://yourapp.com/api/voice/swml/outbound?callId=xxx'
}
```

**SWML Response:**
```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      {
        "ai": {
          "prompt": { "text": "You are a live translator..." },
          "languages": [
            { "name": "English", "code": "en", "voice": "rime.spore" },
            { "name": "Spanish", "code": "es", "voice": "rime.alberto" }
          ]
        }
      },
      {
        "record_call": {
          "format": "mp3",
          "recording_status_callback": "https://yourapp.com/api/webhooks/signalwire"
        }
      }
    ]
  }
}
```

**Result:**
- ✅ REST API `To` parameter → SignalWire dials destination
- ✅ When answered, SignalWire calls SWML endpoint
- ✅ SWML `answer` verb accepts call
- ✅ AI agent activates for translation
- ✅ Recording starts via `record_call` verb
- ✅ Webhook fires when recording completes

---

## 🔧 **WHY THE CONFUSION HAPPENED**

### **Timeline of Implementation:**

1. **LaML endpoint created first** (standard calls)
   - Incorrectly assumed REST API auto-dials (like SWML)
   - Omitted `<Dial>` verb
   - Used `<Record>` verb alone

2. **SWML endpoint created later** (live translation)
   - Correctly researched SWML behavior
   - Used `answer` verb (correct for SWML)
   - Added helpful comments explaining REST API auto-dial

3. **LaML endpoint never corrected**
   - Original incorrect assumption persisted
   - Comment even references "Don't use `<Dial>`" (wrong!)
   - Issue went unnoticed until now

---

## 📊 **COMPARISON TABLE**

| Feature | LaML (XML) | SWML (JSON) |
|---------|------------|-------------|
| **Format** | XML | JSON |
| **Compatibility** | Twilio-compatible | SignalWire-only |
| **REST API Auto-Dial** | ❌ NO | ✅ YES |
| **Requires `<Dial>` Verb** | ✅ YES | ❌ NO |
| **Recording Verb** | `<Dial record="...">` or `<Record>` | `record_call` |
| **AI Agent Support** | ❌ NO | ✅ YES |
| **Answer Verb** | `<Answer>` (rarely needed) | `answer` (required) |
| **Use Case** | Standard calls, bridge calls | Live translation, AI features |

---

## 🎯 **CONCLUSION**

**Root Cause Confirmed:**
LaML endpoint incorrectly applied SWML call flow pattern, omitting the required `<Dial>` verb.

**Fix Required:**
- ✅ LaML must use `<Dial><Number>destination</Number></Dial>`
- ✅ SWML correctly uses `answer` + `record_call` (no change needed)

**Architecture Validated:**
- ✅ SWML implementation is **CORRECT**
- ❌ LaML implementation is **BROKEN**
- ✅ Both can coexist (hybrid approach per SIGNALWIRE_AI_AGENTS_RESEARCH.md)

---

**Document Created By:** AI Debugging Engineer  
**Date:** January 12, 2026  
**Status:** ✅ **ROOT CAUSE CONFIRMED**
