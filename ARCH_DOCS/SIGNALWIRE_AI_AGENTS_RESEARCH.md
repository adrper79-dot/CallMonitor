# SignalWire AI Agents API Research
**Task 4.2: SignalWire API Integration Research**

**Date:** January 14, 2026  
**Status:** Research Complete - Implementation Guidance Needed

---

## Executive Summary

Based on research, SignalWire AI Agents can be integrated via multiple methods, but the **current codebase uses LaML (Twilio-compatible XML)**, while SignalWire AI Agents appear to use **SWML (SignalWire Markup Language)**. This creates an integration challenge that requires either:

1. **Hybrid approach**: Use LaML for calls, SWML for AI Agent calls
2. **SWML migration**: Migrate call flow to SWML (significant refactor)
3. **API-based attachment**: Use SignalWire REST API to attach agents programmatically (needs API verification)

---

## Research Findings

### 1. SignalWire AI Agents Architecture

**Three Integration Methods:**

#### A. SignalWire Markup Language (SWML)
- **Format**: JSON-based markup (different from LaML/XML)
- **AI Agent Node**: `<ai>` element with prompt and configuration
- **Example Structure**:
  ```json
  {
    "version": "1.0.0",
    "sections": {
      "main": [
        { "answer": {} },
        {
          "ai": {
            "prompt": { "text": "You are a translator..." },
            "SWAIG": {
              "functions": [...]
            }
          }
        }
      ]
    }
  }
  ```

#### B. Call Flow Builder (Visual Interface)
- Visual drag-and-drop interface
- Configure AI Agents per phone number or call flow
- **Not suitable for per-call programmatic attachment**

#### C. AI Agents SDK (Python)
- Server-side Python SDK
- Requires running Python service
- **Not suitable for Node.js/Next.js codebase**

---

### 2. Current Codebase Implementation

**Current Approach:**
- Uses **LaML** (Twilio-compatible XML) for call instructions
- LaML endpoint: `/api/voice/laml/outbound`
- Call initiation via SignalWire REST API: `POST /api/laml/2010-04-01/Accounts/{Project}/Calls.json`
- Webhook handler: `/api/webhooks/signalwire`

**Code Pattern:**
```typescript
// From startCallHandler.ts
const params = new URLSearchParams()
params.append('From', swNumber)
params.append('To', toNumber)
params.append('Url', `${env.NEXT_PUBLIC_APP_URL}/api/voice/laml/outbound`)
params.append('StatusCallback', `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`)

const swEndpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`
const swRes = await fetch(swEndpoint, {
  method: 'POST',
  headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: params
})
```

---

### 3. Integration Challenge

**Problem:**
- **LaML (current)**: XML-based, Twilio-compatible, does NOT support AI Agent nodes
- **SWML (AI Agents)**: JSON-based, SignalWire-native, supports `<ai>` nodes
- **Incompatibility**: Cannot embed SWML AI Agent in LaML XML

**Possible Solutions:**

#### Option 1: Hybrid Approach (Recommended for v1)
- **Standard calls**: Continue using LaML
- **Live translation calls**: Use SWML endpoint with AI Agent
- **Implementation**:
  - Create new SWML endpoint: `/api/voice/swml/outbound`
  - Detect live translation requirement in `startCallHandler`
  - Route to SWML endpoint instead of LaML for live translation calls
  - Generate SWML JSON with AI Agent configuration

**Pros:**
- Minimal changes to existing code
- Backward compatible
- Isolated to live translation feature

**Cons:**
- Dual markup language support
- More complex routing logic

#### Option 2: SWML Migration (Long-term)
- Migrate all call flows to SWML
- Unified markup language
- Full AI Agent support

**Pros:**
- Single markup language
- Future-proof
- Full SignalWire feature support

**Cons:**
- Major refactor required
- Risk to existing functionality
- Not suitable for v1 timeline

#### Option 3: API-Based Agent Attachment (Needs Verification)
- Research if SignalWire REST API supports attaching agents to existing calls
- Use call modification API (if exists)
- Attach agent after call initiation

**Pros:**
- Keep existing LaML implementation
- Programmatic control

**Cons:**
- **Unknown if API exists**
- Requires SignalWire support ticket/API verification
- May introduce latency (agent attachment after call start)

---

### 4. SWML Endpoint Structure (If Using Option 1)

**New Endpoint:** `/api/voice/swml/outbound`

**Request Flow:**
```
startCallHandler → Check for live translation
  ↓
If live translation enabled:
  → POST SignalWire Calls API with Url pointing to /api/voice/swml/outbound
  ↓
SignalWire calls /api/voice/swml/outbound
  ↓
Generate SWML JSON with AI Agent configuration
  ↓
Return SWML JSON (Content-Type: application/json)
```

**SignalWire REST API Call:**
```typescript
// Same endpoint, but different URL parameter
params.append('Url', `${env.NEXT_PUBLIC_APP_URL}/api/voice/swml/outbound?callId=${callId}`)
// SignalWire will call this URL and expect SWML JSON response
```

**SWML Response Format:**
```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      {
        "ai": {
          "prompt": {
            "text": "You are a live, real-time translator for phone calls..."
          },
          "model": "gpt-4o-mini",
          "temperature": 0.3,
          "max_tokens": 150,
          "voice": {
            "provider": "elevenlabs",
            "voice_id": "en-US-Neural2-J"
          }
        }
      }
    ]
  }
}
```

---

### 5. Webhook Events

**Standard SignalWire Webhooks (Already Implemented):**

**CallStatus Events:**
- `initiated` - Call initiated
- `ringing` - Call ringing
- `answered` - Call answered
- `completed` - Call completed
- `failed` - Call failed
- `busy` - Busy signal
- `no-answer` - No answer

**RecordingStatus Events:**
- `in-progress` - Recording started
- `completed` - Recording completed
- `absent` - Recording absent
- `failed` - Recording failed

**AI Agent Events (Research Needed):**
- Unknown if SignalWire emits specific AI Agent events
- May need to track agent status via call metadata
- **Recommendation**: Use existing call status events, add metadata flags

---

### 6. Implementation Recommendations

#### Immediate Actions (v1):

1. **Verify SWML Support**
   - Test if SignalWire accepts SWML JSON responses
   - Verify AI Agent node syntax
   - Test with your SignalWire account

2. **Create SWML Endpoint** (if Option 1 chosen)
   - Create `/api/voice/swml/outbound` endpoint
   - Generate SWML JSON with AI Agent configuration
   - Use agent config builder utility (already created)

3. **Update Call Initiation**
   - Add logic to detect live translation requirement
   - Route to SWML endpoint instead of LaML
   - Pass call metadata via query parameters

4. **Webhook Handler Updates**
   - Add detection for live translation calls
   - Set `has_live_translation` flag on recordings
   - Handle agent-specific events (if any)

#### Questions for SignalWire Support:

1. **Can AI Agents be attached to calls via REST API programmatically?**
   - Or must they be configured in Call Flow Builder?

2. **Does SignalWire support SWML for outbound calls?**
   - Or is SWML only for inbound calls?

3. **Can we use LaML for calls with AI Agents?**
   - Or must we use SWML?

4. **What webhook events are emitted for AI Agent calls?**
   - Agent started, agent stopped, translation events?

5. **What is the exact SWML syntax for translation agents?**
   - Language configuration
   - Voice selection
   - Model configuration

---

### 7. Alternative: Phone Number Configuration

**If programmatic attachment is not possible:**
- Configure AI Agent at phone number level via Call Flow Builder
- All calls from that number use the agent
- **Limitation**: Cannot enable/disable per-call
- **Not suitable for**: Capability-gated feature

---

## Next Steps

1. **Contact SignalWire Support**
   - Submit support ticket with integration questions
   - Request API documentation for AI Agent attachment
   - Verify SWML support for outbound calls

2. **Test SWML Endpoint**
   - Create test endpoint with SWML JSON
   - Test with SignalWire test account
   - Verify AI Agent node syntax

3. **Decision Point**
   - Based on SignalWire response, choose integration method
   - Implement chosen approach (Option 1, 2, or 3)
   - Update implementation plan

---

## References

- SignalWire AI Agents Documentation: https://developer.signalwire.com/call-flow-builder/ai-agent/
- SignalWire SWML Documentation: (needs verification)
- SignalWire LaML Compatibility: https://developer.signalwire.com/compatibility-api/
- Current Implementation: `app/api/voice/laml/outbound/route.ts`
- Call Initiation: `app/actions/calls/startCallHandler.ts`

---

**Research Status:** Complete  
**Implementation Status:** Pending SignalWire API verification  
**Recommended Approach:** Option 1 (Hybrid LaML/SWML) after API verification
