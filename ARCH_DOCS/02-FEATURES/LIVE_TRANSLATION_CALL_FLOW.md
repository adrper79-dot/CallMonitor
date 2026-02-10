# Live Voice Translation — Complete Call Flow

**Last Updated:** February 9, 2026  
**Status:** ✅ Production  
**Telnyx API Version:** Call Control v2  
**Compliance:** Telnyx Real-Time Transcription API

---

## Overview

Live voice translation enables real-time translation of phone conversations using:

1. **Telnyx Call Control v2** — Telephony + native real-time transcription
2. **OpenAI GPT-4o-mini** — Translation engine
3. **Server-Sent Events (SSE)** — UI delivery
4. **PostgreSQL (`call_translations`)** — Persistence layer

**Latency:** ~2-3 seconds per utterance (Telnyx transcription → OpenAI translation → DB → SSE)

---

## Prerequisites

### 1. Voice Config Setup

```sql
-- voice_configs table must have these columns:
SELECT
  live_translate,      -- boolean: enable live translation
  transcribe,          -- boolean: enable transcription (alternative to live_translate)
  translate_from,      -- varchar: source language (e.g., 'en')
  translate_to,        -- varchar: target language (e.g., 'es')
  record               -- boolean: enable call recording
FROM voice_configs
WHERE organization_id = $1;
```

### 2. Organization Plan

- **Required:** `business` or `enterprise` plan
- **Check:** `SELECT plan FROM organizations WHERE id = $1`
- **Enforcement:** `live-translation.ts` GET /stream endpoint

### 3. Environment Variables

```bash
TELNYX_API_KEY=KEY...
TELNYX_CALL_CONTROL_APP_ID=...
TELNYX_NUMBER=+1...
TELNYX_PUBLIC_KEY=base64...     # For webhook signature verification
OPENAI_API_KEY=sk-...
API_BASE_URL=https://wordisbond-api.adrper79.workers.dev
```

### 4. Database Tables

```sql
-- Stores live translation segments
CREATE TABLE call_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id),
  organization_id UUID REFERENCES organizations(id),
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language VARCHAR(10),
  target_language VARCHAR(10),
  segment_index INT NOT NULL,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_call_translations_call_id ON call_translations(call_id, segment_index);
```

---

## Call Flow: Step-by-Step

### Phase 1: Call Initiation (Frontend → API → Telnyx)

```
┌──────────┐
│  Client  │ POST /api/voice/call
│  (React) │ { to, from, live_translate: true }
└────┬─────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ workers/src/routes/voice.ts                            │
│ - requireAuth() → verify session                       │
│ - Get organization_id from session                     │
│ - Query voice_configs for live_translate flag          │
│ - Validate E.164 phone number format                   │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ Build Telnyx Call Payload                              │
│                                                         │
│ const callPayload = {                                  │
│   to: '+1234567890',            // customer number     │
│   from: env.TELNYX_NUMBER,      // Telnyx DID          │
│   connection_id: env.TELNYX_CALL_CONTROL_APP_ID,      │
│   webhook_url: `${env.API_BASE_URL}/api/webhooks/...`,│
│   webhook_url_method: 'POST',                          │
│                                                         │
│   // CRITICAL: Enable real-time transcription          │
│   transcription: true,                                 │
│   transcription_config: {                              │
│     transcription_engine: 'B',  // Telnyx native       │
│     transcription_tracks: 'both' // inbound + outbound│
│   }                                                     │
│ }                                                       │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ POST https://api.telnyx.com/v2/calls                   │
│ Authorization: Bearer ${TELNYX_API_KEY}                │
│ Body: callPayload                                      │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ Telnyx Response                                        │
│ {                                                       │
│   data: {                                               │
│     call_control_id: "v3:...",  // CRITICAL ID         │
│     call_session_id: "...",                            │
│     call_leg_id: "..."                                 │
│   }                                                     │
│ }                                                       │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ INSERT INTO calls (                                    │
│   organization_id,                                     │
│   call_control_id,      // Store for webhook matching  │
│   call_sid,             // call_session_id             │
│   from_number,                                         │
│   to_number,                                           │
│   status,               // 'initiated'                 │
│   created_at                                           │
│ ) VALUES (...)                                         │
│ RETURNING id;                                          │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ Return to Client                                       │
│ { success: true, callId, call_control_id }            │
└────────────────────────────────────────────────────────┘
```

**Telnyx Compliance Check:**

- ✅ `transcription: true` (boolean, not object)
- ✅ `transcription_config.transcription_engine: 'B'` (Telnyx native engine)
- ✅ `transcription_tracks: 'both'` (captures both inbound + outbound audio)
- ✅ Per [Telnyx Call Control v2 Docs](https://developers.telnyx.com/docs/api/v2/call-control/Call-Commands#CreateCall): `transcription` is a boolean flag, `transcription_config` is a separate object

---

### Phase 2: Call Progress (Telnyx Webhooks → API)

#### Webhook: `call.initiated`

```
┌──────────┐
│ Telnyx   │ POST /api/webhooks/telnyx
│ Platform │ event_type: "call.initiated"
└────┬─────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ workers/src/routes/webhooks.ts                         │
│ - Verify Ed25519 signature (TELNYX_PUBLIC_KEY)        │
│ - UPDATE calls SET status = 'initiated'                │
│   WHERE call_control_id = payload.call_control_id      │
└────────────────────────────────────────────────────────┘
```

#### Webhook: `call.answered`

```
┌──────────┐
│ Telnyx   │ POST /api/webhooks/telnyx
│ Platform │ event_type: "call.answered"
└────┬─────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ workers/src/routes/webhooks.ts                         │
│ - UPDATE calls SET status = 'in_progress',             │
│                    answered_at = NOW()                 │
│ - AI Role Disclosure (if live_translate enabled):     │
│   POST /v2/calls/{call_control_id}/actions/speak       │
│   "This call uses AI-assisted live translation..."     │
└────────────────────────────────────────────────────────┘
```

---

### Phase 3: Real-Time Transcription Pipeline (Telnyx → OpenAI → DB)

#### Webhook: `call.transcription` (Critical Event)

```
┌──────────┐
│ Telnyx   │ POST /api/webhooks/telnyx
│ Platform │ event_type: "call.transcription"
│          │ Fires for EACH utterance during call
└────┬─────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ workers/src/routes/webhooks.ts                         │
│ handleCallTranscription(env, db, payload)              │
│                                                         │
│ Extract:                                                │
│ - call_control_id (matches to DB call)                 │
│ - transcription_data.transcript (text)                 │
│ - transcription_data.confidence (0.0-1.0)              │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ Query: SELECT id, organization_id                      │
│        FROM calls                                       │
│        WHERE call_control_id = $1                       │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ getTranslationConfig(db, organization_id)              │
│ - SELECT translate_from, translate_to, live_translate  │
│ - If NOT live_translate: EXIT (skip translation)       │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ Determine segment_index                                │
│ SELECT COALESCE(MAX(segment_index), -1) + 1            │
│ FROM call_translations                                 │
│ WHERE call_id = $1                                     │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ workers/src/lib/translation-processor.ts               │
│ translateAndStore(db, OPENAI_API_KEY, {                │
│   callId,                                               │
│   organizationId,                                       │
│   originalText: transcript,                            │
│   sourceLanguage: 'en',                                │
│   targetLanguage: 'es',                                │
│   segmentIndex,                                        │
│   confidence                                           │
│ })                                                      │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ POST https://api.openai.com/v1/chat/completions        │
│ {                                                       │
│   model: "gpt-4o-mini",                                │
│   messages: [{                                          │
│     role: "system",                                     │
│     content: "Translate English to Spanish..."         │
│   }, {                                                  │
│     role: "user",                                       │
│     content: "Hello, how are you?"                     │
│   }],                                                   │
│   temperature: 0.1,                                    │
│   max_tokens: 500                                      │
│ }                                                       │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ OpenAI Response                                        │
│ { choices: [{ message: {                               │
│   content: "Hola, ¿cómo estás?"                        │
│ }}]}                                                    │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ INSERT INTO call_translations (                        │
│   call_id,                                             │
│   organization_id,                                     │
│   original_text,                                       │
│   translated_text,                                     │
│   source_language,                                     │
│   target_language,                                     │
│   segment_index,                                       │
│   confidence,                                          │
│   created_at                                           │
│ ) VALUES (...)                                         │
└────────────────────────────────────────────────────────┘
```

**Latency Breakdown:**

- Telnyx transcription delivery: ~0.5-1.0s after utterance
- OpenAI translation: ~0.3-0.5s
- DB write: ~0.05s
- **Total webhook processing:** ~1-2s

---

### Phase 4: SSE Stream Delivery (API → Frontend)

```
┌──────────┐
│  Client  │ GET /api/voice/translate/stream?callId=...
│  (React) │ Accept: text/event-stream
└────┬─────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ workers/src/routes/live-translation.ts                 │
│ - requireAuth()                                         │
│ - Plan gating: business/enterprise only                │
│ - Verify call ownership                                │
│ - writeAuditLog(LIVE_TRANSLATION_STARTED)             │
└────┬───────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ streamSSE(c, async (stream) => {                       │
│   let lastSegmentIndex = -1                            │
│                                                         │
│   while (true) {  // Poll every 1 second               │
│     const db = getDb(env)  // Fresh connection         │
│                                                         │
│     // Check call status                               │
│     const status = await db.query(                     │
│       'SELECT status FROM calls WHERE id = $1',        │
│       [callId]                                         │
│     )                                                   │
│     if (status === 'completed') {                      │
│       stream.writeSSE({ event: 'done' })               │
│       break                                            │
│     }                                                   │
│                                                         │
│     // Fetch new segments                              │
│     const newSegments = await db.query(                │
│       `SELECT * FROM call_translations                 │
│        WHERE call_id = $1                              │
│          AND segment_index > $2                        │
│        ORDER BY segment_index ASC`,                    │
│       [callId, lastSegmentIndex]                       │
│     )                                                   │
│                                                         │
│     // Stream each new segment                         │
│     for (const seg of newSegments.rows) {              │
│       stream.writeSSE({                                │
│         event: 'translation',                          │
│         data: JSON.stringify({                         │
│           id: seg.id,                                  │
│           original_text: seg.original_text,            │
│           translated_text: seg.translated_text,        │
│           source_language: seg.source_language,        │
│           target_language: seg.target_language,        │
│           timestamp: seg.created_at,                   │
│           segment_index: seg.segment_index             │
│         })                                             │
│       })                                                │
│       lastSegmentIndex = seg.segment_index             │
│     }                                                   │
│                                                         │
│     await db.end()                                     │
│     await sleep(1000)  // Poll every 1 second          │
│   }                                                     │
│ })                                                      │
└────────────────────────────────────────────────────────┘
```

**Frontend (LiveTranslationPanel.tsx):**

```typescript
// Uses apiFetch (Bearer token + API URL resolution)
const response = await apiFetch(`/api/voice/translate/stream?callId=${callId}`, {
  headers: { Accept: 'text/event-stream' },
})

const reader = response.body?.getReader()
const decoder = new TextDecoder()

// Parse SSE stream
while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const text = decoder.decode(value)
  const lines = text.split('\n')

  for (const line of lines) {
    if (line.startsWith('event: translation')) {
      // Next line is data:
      const dataLine = lines[lines.indexOf(line) + 1]
      const segment = JSON.parse(dataLine.slice(6))

      // Add to UI
      setSegments((prev) => [...prev, segment])
    }
  }
}
```

**SSE Latency:** ~1s poll interval = up to 1s delay between DB insert and UI delivery

**Total End-to-End Latency:** ~2-3s from utterance to UI display

---

### Phase 5: Call Termination

```
┌──────────┐
│ Telnyx   │ POST /api/webhooks/telnyx
│ Platform │ event_type: "call.hangup"
└────┬─────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ UPDATE calls SET                                       │
│   status = 'completed',                                │
│   ended_at = NOW(),                                    │
│   hangup_cause = payload.hangup_cause                  │
│ WHERE call_control_id = $1                             │
└────────────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ SSE stream detects status = 'completed'                │
│ - Sends event: 'done'                                  │
│ - Closes stream                                        │
└────────────────────────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────────────────┐
│ LiveTranslationPanel.tsx                               │
│ - setStatus('ended')                                   │
│ - Displays final translation count                     │
│ - Preserves segments for review                        │
└────────────────────────────────────────────────────────┘
```

---

## Telnyx API Compliance Verification

### ✅ Call Creation (Per Telnyx Docs)

```javascript
// CORRECT (our implementation)
{
  to: '+1234567890',
  from: '+19876543210',
  connection_id: 'xxx',
  transcription: true,              // Boolean flag
  transcription_config: {           // Separate object
    transcription_engine: 'B',      // 'B' = Telnyx native
    transcription_tracks: 'both'    // 'inbound' | 'outbound' | 'both'
  }
}

// INCORRECT (v4.28 bug — fixed)
{
  transcription: {                  // ❌ Was an object
    engine: 'telnyx',
    tracks: 'both'
  }
}
```

### ✅ Webhook Event Types

| Event                  | Handler                   | Purpose                                       |
| ---------------------- | ------------------------- | --------------------------------------------- |
| `call.initiated`       | `handleCallInitiated`     | Record call start                             |
| `call.answered`        | `handleCallAnswered`      | Update status, play AI disclosure             |
| `call.transcription`   | `handleCallTranscription` | **CRITICAL** — Real-time translation pipeline |
| `call.hangup`          | `handleCallHangup`        | Finalize call record                          |
| `call.recording.saved` | `handleRecordingSaved`    | Download recording to R2                      |

### ✅ Transcription Event Payload

```json
{
  "data": {
    "event_type": "call.transcription",
    "payload": {
      "call_control_id": "v3:xxx",
      "call_session_id": "xxx",
      "transcription_data": {
        "transcript": "Hello, how are you?",
        "confidence": 0.95
      }
    }
  }
}
```

**Our Handler:**

```typescript
const transcript = transcription_data?.transcript || payload.transcript || ''
const confidence = transcription_data?.confidence || payload.confidence || 0.9
```

✅ Handles both nested and flat structures for compatibility

---

## Troubleshooting

### Live Translation Not Working — Diagnostic Checklist

#### 1. Check Voice Config

```sql
SELECT live_translate, transcribe, translate_from, translate_to
FROM voice_configs
WHERE organization_id = 'xxx';
```

- `live_translate` must be `true`
- `translate_from` and `translate_to` must be valid language codes

#### 2. Check Organization Plan

```sql
SELECT plan FROM organizations WHERE id = 'xxx';
```

- Must be `business` or `enterprise`

#### 3. Verify Telnyx Call Creation

```bash
# Check API logs for call creation
curl -H "Authorization: Bearer $TELNYX_API_KEY" \
  https://api.telnyx.com/v2/calls/{call_control_id}
```

- Confirm `transcription: true` in call details
- Check `transcription_config` matches our payload

#### 4. Check Webhook Delivery

```bash
# Telnyx webhook logs (Telnyx Portal → Webhooks)
# Look for call.transcription events
# Verify 200 responses from our webhook endpoint
```

#### 5. Verify OpenAI API Key

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### 6. Check DB Table

```sql
SELECT COUNT(*) FROM call_translations WHERE call_id = 'xxx';
```

- Should have rows if transcription is working
- Check `created_at` timestamps for latency

#### 7. SSE Stream Test

```bash
curl -H "Cookie: wb-session-token=xxx" \
  -H "Accept: text/event-stream" \
  https://wordisbond-api.adrper79.workers.dev/api/voice/translate/stream?callId=xxx
```

- Should receive `event: translation` lines
- Check for `event: error` if issues

#### 8. Common Failures

| Symptom                         | Root Cause                                    | Fix                          |
| ------------------------------- | --------------------------------------------- | ---------------------------- |
| No `call.transcription` events  | `transcription: false` or config object wrong | Check voice.ts call payload  |
| Webhook 500 errors              | Missing `OPENAI_API_KEY`                      | Verify env var in Workers    |
| SSE 403                         | Plan check failing                            | Upgrade org to business plan |
| Empty translations              | `live_translate = false` in DB                | Update voice_configs         |
| Translations delayed 5+ seconds | SSE poll interval too slow                    | Already optimized to 1s      |

---

## Performance Optimization

### Current Latency Budget

| Stage                | Latency   | Optimization                           |
| -------------------- | --------- | -------------------------------------- |
| Telnyx transcription | 0.5-1.0s  | **Not controllable** (Telnyx native)   |
| OpenAI translation   | 0.3-0.5s  | Use `gpt-4o-mini`, `temperature: 0.1`  |
| DB write             | ~0.05s    | Single INSERT, no SELECT first         |
| SSE poll interval    | 1.0s      | **Trade-off:** Lower = more DB queries |
| **Total**            | **~2-3s** | Within acceptable range for live calls |

### Potential Improvements

1. **Reduce SSE poll to 500ms** (double DB load, halve latency)
2. **Use Postgres LISTEN/NOTIFY** (requires pg_notify trigger on INSERT)
3. **WebSocket instead of SSE** (requires Durable Objects for connection state)
4. **OpenAI streaming API** (incremental translation — complex to implement)

**Current Decision:** 1s poll is optimal balance of latency vs DB load for Cloudflare Workers

---

## Related Documentation

- [ARCH_DOCS/02-FEATURES/LIVE_TRANSLATION_FLOW.md](../02-FEATURES/LIVE_TRANSLATION_FLOW.md) — Original architecture
- [ARCH_DOCS/LESSONS_LEARNED_2026-02-09_TELNYX_TRANSCRIPTION_API.md](../LESSONS_LEARNED_2026-02-09_TELNYX_TRANSCRIPTION_API.md) — Transcription API fix
- [workers/src/routes/voice.ts](../../workers/src/routes/voice.ts) — Call creation
- [workers/src/routes/webhooks.ts](../../workers/src/routes/webhooks.ts) — Telnyx event handlers
- [workers/src/routes/live-translation.ts](../../workers/src/routes/live-translation.ts) — SSE stream
- [workers/src/lib/translation-processor.ts](../../workers/src/lib/translation-processor.ts) — OpenAI integration
- [components/voice/LiveTranslationPanel.tsx](../../components/voice/LiveTranslationPanel.tsx) — Frontend UI

---

**End of Call Flow Documentation**
