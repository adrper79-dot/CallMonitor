# Feature Implementation Plan — Word Is Bond v5.0

> **Generated:** 2026-02-09  
> **Baseline:** v4.29 · 109/109 roadmap · 396 passing tests  
> **Honest Timeline:** 10–15 weeks (not days)  
> **Execution Model:** Agent + Sub-Agent (Copilot-driven, human-approved)

---

## Table of Contents

1. [Execution Philosophy](#1-execution-philosophy)
2. [Dependency Graph & Build Order](#2-dependency-graph--build-order)
3. [Shared Infrastructure (Phase 0)](#3-shared-infrastructure-phase-0)
4. [Feature 1: Multi-Language Live Translation (1 week)](#4-feature-1-multi-language-live-translation)
5. [Feature 2: Real-Time Sentiment & Objection Detection (2 weeks)](#5-feature-2-real-time-sentiment--objection-detection)
6. [Feature 3: Hybrid AI Toggle (3 weeks)](#6-feature-3-hybrid-ai-toggle)
7. [Feature 4: Predictive Dialer (3 weeks)](#7-feature-4-predictive-dialer)
8. [Feature 5: IVR Payment Collection (3 weeks)](#8-feature-5-ivr-payment-collection)
9. [Cross-Cutting Concerns](#9-cross-cutting-concerns)
10. [Test Strategy](#10-test-strategy)
11. [Rollout & Feature Flags](#11-rollout--feature-flags)
12. [Risk Registry](#12-risk-registry)

---

## 1. Execution Philosophy

### Agent/Sub-Agent Model

Each feature follows a 4-phase agent workflow:

```
AGENT (Feature Owner)
  ├── SUB-AGENT 1: Schema & Migration
  │     └── Creates migration SQL, Zod schemas, types
  ├── SUB-AGENT 2: Backend Route Handler
  │     └── Implements Hono routes following golden path
  ├── SUB-AGENT 3: Webhook & Event Plumbing
  │     └── Extends webhooks.ts with new event handlers
  ├── SUB-AGENT 4: Frontend Components
  │     └── React components, hooks, API client calls
  ├── SUB-AGENT 5: Tests & Error Debugging
  │     └── Unit tests, integration tests, error chain validation
  └── AGENT: Integration Verification
        └── End-to-end smoke test, feature registry, deploy check
```

### Golden Path (Every Route Handler)

Per ARCH_DOCS, every endpoint MUST follow:

```
requireAuth() → validateBody() → getDb() → try { query(org_id=$1) → writeAuditLog() → return } finally { db.end() }
```

### Non-Negotiable Standards

| Rule                                                         | Enforcement                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `c.env.NEON_PG_CONN \|\| c.env.HYPERDRIVE?.connectionString` | DB connection order — never reversed                                          |
| `organization_id` in every WHERE                             | Multi-tenant isolation                                                        |
| `$1, $2, $3` parameterized queries                           | No SQL interpolation                                                          |
| `apiGet/apiPost/apiPut/apiDelete`                            | Client-side API calls (no raw fetch)                                          |
| `old_value` / `new_value`                                    | Audit log DB columns; TypeScript interface uses `before` / `after` properties |
| No server-side code in Next.js                               | Static export only                                                            |
| Rate limiter on every mutating endpoint                      | KV-backed sliding window                                                      |
| Zod schema on every POST/PUT body                            | Zero-trust validation                                                         |
| Feature registry entry for every feature                     | `tests/production/feature-registry.test.ts`                                   |

---

## 2. Dependency Graph & Build Order

```
Phase 0: Shared Infrastructure (3 days)
    │
    ▼
Phase 1: Multi-Language ────────────────────── (1 week)
    │   ✅ 90% infrastructure exists
    │   Only needs: UI polish, language detection, expanded codec support
    │
    ▼
Phase 2: Sentiment & Objection ─────────────── (2 weeks)
    │   🟡 40% infrastructure exists
    │   Has: OpenAI sentiment prompt, AssemblyAI transcription
    │   Needs: Real-time pipeline, scoring DB, alert system, dashboard
    │
    ▼
Phase 3: Hybrid AI Toggle ─────────────────── (3 weeks)
    │   🔴 10% infrastructure exists
    │   Has: voice_configs.ai_agent_*, ElevenLabs TTS, call placement
    │   Needs: Full autopilot engine, state machine, gather/speak loop
    │
    ├── Phase 4a: Predictive Dialer ────────── (3 weeks, parallel-safe)
    │   🔴 5% infrastructure exists
    │   Has: campaigns table, campaign_calls table, call placement
    │   Needs: Queue engine, pacing algorithm, AMD handling, agent pool
    │
    └── Phase 4b: IVR Payments ─────────────── (3 weeks, parallel-safe)
        🔴 5% infrastructure exists
        Has: Stripe integration, collection_accounts, payment recording
        Needs: DTMF gather, IVR flow engine, PCI compliance, hold/bridge
```

**Critical Dependency:** Phase 3 (Hybrid AI) MUST precede Phases 4a/4b because the autopilot engine's `gather` + `speak` loop is the foundation for both the dialer's AMD handling and IVR's DTMF collection.

---

## 3. Shared Infrastructure (Phase 0)

**Duration:** 3 days  
**Agent:** Infrastructure Agent

### Sub-Agent 0A: New Telnyx Webhook Event Handlers

**File:** `workers/src/routes/webhooks.ts`  
**Current State:** Handles 5 events (call.initiated, call.answered, call.hangup, call.recording.saved, call.transcription)  
**Must Add:**

| Event                                     | Used By                    | Implementation                               |
| ----------------------------------------- | -------------------------- | -------------------------------------------- |
| `call.gather.ended`                       | IVR Payments, Hybrid AI    | Parse DTMF digits, route to flow handler     |
| `call.speak.ended`                        | Hybrid AI, IVR             | Signal TTS completion, advance state machine |
| `call.machine.detection.ended`            | Predictive Dialer          | AMD result → skip/connect/voicemail          |
| `call.bridged`                            | Hybrid AI (human takeover) | Record bridge timestamp, update call state   |
| `call.dtmf.received`                      | IVR Payments (fallback)    | Individual digit handler for real-time DTMF  |
| `streaming.started` / `streaming.stopped` | Sentiment (future)         | Real-time audio stream lifecycle             |

**Pattern per event (follows existing switch dispatch in webhooks.ts):**

```typescript
case 'call.gather.ended': {
  const { digits, status, call_control_id } = payload.data
  // Dispatch to registered flow handler based on call metadata
  await handleGatherResult(db, callControlId, digits, status, c.env)
  break
}
```

**Tests:** 1 test per event × 6 events = 6 tests minimum  
**Error Handling:** Unknown event types log warning + return 200 (never reject Telnyx webhooks)

### Sub-Agent 0B: New Rate Limiters

**File:** `workers/src/lib/rate-limit.ts`  
**Pattern:** Match existing `rateLimit({ limit, windowSeconds, prefix })` from rate-limit.ts

| Limiter                     | Limit  | Window | Prefix         | Used By           |
| --------------------------- | ------ | ------ | -------------- | ----------------- |
| `sentimentRateLimit`        | 30/min | 60     | `rl:sentiment` | Sentiment API     |
| `ivrRateLimit`              | 10/min | 60     | `rl:ivr`       | IVR payment flow  |
| `predictiveDialerRateLimit` | 5/min  | 60     | `rl:dialer`    | Dialer queue ops  |
| `aiToggleRateLimit`         | 10/min | 60     | `rl:ai-toggle` | AI mode switching |
| `gatherRateLimit`           | 20/min | 60     | `rl:gather`    | DTMF collection   |

### Sub-Agent 0C: New Audit Actions

**File:** `workers/src/lib/audit.ts`  
**Pattern:** Add to existing `AuditAction` enum object

```typescript
// Sentiment (colon separator matches existing convention: call:started, billing:checkout_created)
SENTIMENT_ANALYZED: 'sentiment:analyzed',
SENTIMENT_ALERT_TRIGGERED: 'sentiment:alert_triggered',
OBJECTION_DETECTED: 'sentiment:objection_detected',

// AI Toggle
AI_MODE_ACTIVATED: 'ai_mode:activated',
AI_MODE_HUMAN_TAKEOVER: 'ai_mode:human_takeover',
AI_SCRIPT_EXECUTED: 'ai_mode:script_executed',

// Predictive Dialer
DIALER_QUEUE_STARTED: 'dialer:queue_started',
DIALER_QUEUE_PAUSED: 'dialer:queue_paused',
DIALER_CALL_CONNECTED: 'dialer:call_connected',
DIALER_AMD_DETECTED: 'dialer:amd_detected',

// IVR Payments
IVR_FLOW_STARTED: 'ivr:flow_started',
IVR_PAYMENT_INITIATED: 'ivr:payment_initiated',
IVR_PAYMENT_COMPLETED: 'ivr:payment_completed',
IVR_PAYMENT_FAILED: 'ivr:payment_failed',
IVR_DTMF_COLLECTED: 'ivr:dtmf_collected',

// Multi-Language
LANGUAGE_DETECTED: 'language:detected',
TRANSLATION_CONFIG_UPDATED: 'translation:config_updated',
```

### Sub-Agent 0D: New Zod Schemas

**File:** `workers/src/lib/schemas.ts`  
**Pattern:** Match existing schema patterns (e164Phone, uuid, nonEmptyString)

```typescript
// Sentiment
export const SentimentConfigSchema = z.object({
  enabled: z.boolean(),
  alert_threshold: z.number().min(-1).max(1).default(-0.5),
  objection_keywords: z.array(z.string().max(100)).max(50).optional(),
  alert_webhook_url: z.string().url().max(2000).optional(),
})

// AI Toggle
export const AIToggleSchema = z.object({
  call_id: z.string().uuid(),
  mode: z.enum(['ai', 'human']),
  reason: z.string().max(500).optional(),
})

// Predictive Dialer
export const DialerQueueSchema = z.object({
  campaign_id: z.string().uuid(),
  pacing_mode: z.enum(['preview', 'progressive', 'predictive']).default('progressive'),
  max_concurrent: z.number().int().min(1).max(50).default(5),
  abandon_rate_limit: z.number().min(0).max(0.05).default(0.03),
})

// IVR Payments
export const IVRFlowSchema = z.object({
  account_id: z.string().uuid(),
  flow_type: z.enum(['payment', 'balance_check', 'callback_request']),
  language: z.string().max(5).default('en'),
})

// Language Detection
export const LanguageDetectionSchema = z.object({
  call_id: z.string().uuid(),
  auto_detect: z.boolean().default(true),
  preferred_language: z.string().max(5).optional(),
})
```

### Sub-Agent 0E: CORS Header Updates

**File:** `workers/src/index.ts`  
**Section:** CORS config `allowHeaders` and `exposeHeaders`

**Add to `allowHeaders`:**

- `X-Sentiment-Score`
- `X-AI-Mode`
- `X-Dialer-Session`
- `X-IVR-Flow-Id`

**Add to `exposeHeaders`:**

- `X-Sentiment-Score`
- `X-AI-Mode`
- `X-Dialer-Session`
- `X-IVR-Flow-Id`

---

## 4. Feature 1: Multi-Language Live Translation

**Duration:** 1 week (5 working days)  
**Difficulty:** ★☆☆☆☆ — Infrastructure 90% exists  
**Risk:** LOW

### What Already Exists

| Component                         | File                                       | Status                           |
| --------------------------------- | ------------------------------------------ | -------------------------------- |
| Translation processor             | `workers/src/lib/translation-processor.ts` | ✅ Full pipeline                 |
| OpenAI translation                | `workers/src/lib/translation-processor.ts` | ✅ GPT-4o-mini                   |
| 10 language codes                 | `workers/src/lib/translation-processor.ts` | ✅ en/es/fr/de/zh/ja/pt/it/ko/ar |
| voice_configs.translate_from/to   | `migrations/neon_public_schema_pass1.sql`  | ✅ DB columns exist              |
| voice_configs.live_translate      | Same                                       | ✅ Boolean flag exists           |
| ElevenLabs eleven_multilingual_v2 | TTS route                                  | ✅ Multi-language TTS            |
| VoiceConfigSchema.translate_mode  | `workers/src/lib/schemas.ts`               | ✅ 'post_call' \| 'live'         |
| call_translations table           | DB                                         | ✅ Stores translated segments    |

### What's Missing (The 10%)

| Gap                         | Agent Task                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| Auto language detection     | Sub-Agent 1A: Detect language from first 3 transcription segments |
| Language selection UI       | Sub-Agent 1B: Dropdown in voice config panel                      |
| Translation quality metrics | Sub-Agent 1C: DB column + dashboard widget                        |
| RTL language support (ar)   | Sub-Agent 1D: CSS + component adjustments                         |
| SSE delivery optimization   | Sub-Agent 1E: Debounce rapid translations                         |

### Sub-Agent 1A: Auto Language Detection

**Files to modify:**

- `workers/src/lib/translation-processor.ts` — Add `detectLanguage()` function
- `workers/src/routes/voice.ts` — New endpoint `POST /voice/detect-language`

**Implementation:**

```
1. Buffer first 3 transcription segments from Telnyx webhook
2. Send concatenated text to OpenAI: "What language is this? Return ISO 639-1 code only."
3. If confidence > 0.8, auto-set translate_from on voice_configs
4. Emit SSE event: { type: 'language_detected', code: 'es' }
5. Write audit log: AuditAction.LANGUAGE_DETECTED
```

**Migration:** None needed (columns exist)

**Tests:**

```
- detectLanguage('Hola, ¿cómo estás?') → 'es'
- detectLanguage('Hello there') → 'en'
- detectLanguage('') → null (graceful fallback)
- Integration: Telnyx transcription webhook → auto-detect → config update
```

### Sub-Agent 1B: Language Selection UI

**Files to create/modify:**

- `components/voice/LanguageSelector.tsx` — New component
- `components/voice/VoiceConfigPanel.tsx` — Add language dropdown
- `hooks/useVoiceConfig.tsx` — Add language state

**No server code** — all API calls via `apiPut('/api/voice/config', { modulations: { translate_from, translate_to, live_translate } })`

### Sub-Agent 1C: Translation Quality Metrics

**Migration:**

```sql
ALTER TABLE call_translations ADD COLUMN IF NOT EXISTS quality_score NUMERIC(3,2);
ALTER TABLE call_translations ADD COLUMN IF NOT EXISTS detected_language TEXT;
```

**Route addition in voice.ts:**

```
GET /voice/translation-stats → aggregate quality_score by language pair
```

### Sub-Agent 1D: RTL Support

**Files:** `app/globals.css` + `components/voice/TranslationOverlay.tsx`

- Add `dir="rtl"` when target language is `ar`
- Right-align translation text
- Mirror layout for Arabic segments

### Sub-Agent 1E: SSE Debounce

**File:** `workers/src/lib/translation-processor.ts`

- Buffer translations within 500ms window
- Send batched SSE payload to reduce connection overhead

### Feature 1 Test Matrix

| Test                                    | Type        | File                                           |
| --------------------------------------- | ----------- | ---------------------------------------------- |
| detectLanguage accuracy (10 languages)  | Unit        | `tests/unit/translation.test.ts`               |
| Translation pipeline e2e                | Integration | `tests/integration/translation.test.ts`        |
| VoiceConfigSchema with translate fields | Unit        | `tests/unit/schemas.test.ts`                   |
| Language selector rendering             | Component   | `tests/components/LanguageSelector.test.tsx`   |
| RTL layout for Arabic                   | Snapshot    | `tests/components/TranslationOverlay.test.tsx` |
| SSE debounce timing                     | Unit        | `tests/unit/sse-debounce.test.ts`              |
| Feature registry: multi-language        | Production  | `tests/production/feature-registry.test.ts`    |

---

## 5. Feature 2: Real-Time Sentiment & Objection Detection

**Duration:** 2 weeks (10 working days)  
**Difficulty:** ★★★☆☆ — 40% exists  
**Risk:** MEDIUM

### What Already Exists

| Component                            | File                                       | Status                               |
| ------------------------------------ | ------------------------------------------ | ------------------------------------ |
| POST /ai/analyze with sentiment type | `workers/src/routes/ai-llm.ts`             | ✅ But POST-CALL only                |
| AssemblyAI transcription webhook     | `workers/src/routes/webhooks.ts`           | ✅ Receives transcripts              |
| Telnyx call.transcription event      | `workers/src/routes/webhooks.ts`           | ✅ Real-time segments                |
| OpenAI GPT-4o-mini integration       | `workers/src/routes/ai-llm.ts`             | ✅ Chat/analyze endpoints            |
| translation-processor.ts pipeline    | `workers/src/lib/translation-processor.ts` | ✅ Taps into real-time transcription |

### What Must Be Built

| Component                            | Effort | Agent        |
| ------------------------------------ | ------ | ------------ |
| Real-time sentiment scoring pipeline | 3 days | Sub-Agent 2A |
| Sentiment DB tables + migration      | 1 day  | Sub-Agent 2B |
| Objection keyword detection          | 1 day  | Sub-Agent 2C |
| Alert/reroute system                 | 2 days | Sub-Agent 2D |
| Dashboard sentiment widget           | 2 days | Sub-Agent 2E |
| Test suite                           | 1 day  | Sub-Agent 2F |

### Sub-Agent 2A: Real-Time Sentiment Pipeline

**New file:** `workers/src/lib/sentiment-processor.ts`

**Architecture (mirrors translation-processor.ts pattern):**

```
Telnyx call.transcription event
    │
    ▼
webhooks.ts: case 'call.transcription'
    │
    ├── (existing) handleCallTranscription() → translation pipeline
    │
    └── (NEW) handleSentimentAnalysis()
          │
          ▼
    sentiment-processor.ts
          │
          ├── 1. Buffer last 3 transcript segments (sliding window)
          ├── 2. POST to OpenAI GPT-4o-mini:
          │     System: "Score sentiment -1.0 to 1.0. Detect objections."
          │     Return: { score: number, objections: string[], escalation: boolean }
          ├── 3. INSERT INTO call_sentiment_scores
          ├── 4. If score < org.alert_threshold → trigger alert
          └── 5. SSE push: { type: 'sentiment_update', score, objections }
```

**Key Design Decision:** Sentiment analysis runs PARALLEL to translation, not sequential. Both tap into the same `call.transcription` webhook event. This is exactly how `translation-processor.ts` works — the webhook dispatches, the processor runs independently.

**Rate Limiting:** Score every 3rd transcription segment (not every segment) to control OpenAI costs. At ~1 segment/3 seconds, this means one sentiment score every ~9 seconds.

**Error Handling Chain:**

```
OpenAI timeout (5s) → return last known score (cache in KV)
OpenAI 429 → exponential backoff, return cached score
OpenAI error → log warning, skip segment, continue pipeline
DB insert fail → log error, continue (sentiment is advisory, not blocking)
```

### Sub-Agent 2B: Sentiment DB Schema

**New migration:** `migrations/2026-02-09-sentiment-scoring.sql`

```sql
-- Real-time sentiment scores per call segment
CREATE TABLE IF NOT EXISTS call_sentiment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  transcript_text TEXT,
  score NUMERIC(4,3) NOT NULL CHECK (score >= -1.0 AND score <= 1.0),
  objections JSONB DEFAULT '[]',
  escalation_recommended BOOLEAN DEFAULT FALSE,
  model_used TEXT DEFAULT 'gpt-4o-mini',
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentiment_call_id ON call_sentiment_scores(call_id);
CREATE INDEX idx_sentiment_org_score ON call_sentiment_scores(organization_id, score);
CREATE INDEX idx_sentiment_escalation ON call_sentiment_scores(organization_id, escalation_recommended)
  WHERE escalation_recommended = TRUE;

-- Aggregate sentiment per call (materialized for dashboards)
CREATE TABLE IF NOT EXISTS call_sentiment_summary (
  call_id UUID PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  avg_score NUMERIC(4,3),
  min_score NUMERIC(4,3),
  max_score NUMERIC(4,3),
  total_segments INTEGER DEFAULT 0,
  objection_count INTEGER DEFAULT 0,
  escalation_triggered BOOLEAN DEFAULT FALSE,
  escalation_triggered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentiment_summary_org ON call_sentiment_summary(organization_id, avg_score);

-- Sentiment alert configuration per org
CREATE TABLE IF NOT EXISTS sentiment_alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  alert_threshold NUMERIC(4,3) DEFAULT -0.5,
  objection_keywords JSONB DEFAULT '[]',
  alert_channels JSONB DEFAULT '["dashboard"]',
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Sub-Agent 2C: Objection Keyword Detection

**File:** `workers/src/lib/sentiment-processor.ts` (same file as 2A)

**Logic:**

```
1. Maintain per-org objection keyword list (from sentiment_alert_configs.objection_keywords)
2. On each transcription segment, scan for keyword matches (case-insensitive)
3. Keyword match + negative sentiment score → flag as objection
4. Default keywords (if org hasn't configured): ["cancel", "lawsuit", "attorney", "complaint", "supervisor", "manager", "refuse", "dispute", "unfair", "illegal"]
5. Objections stored in call_sentiment_scores.objections JSONB
```

### Sub-Agent 2D: Alert & Reroute System

**New file:** `workers/src/lib/sentiment-alerts.ts`

**Trigger conditions (configurable per org):**

```
1. score < alert_threshold for 3+ consecutive segments → "sustained negative"
2. objection keyword detected + score < -0.3 → "objection alert"
3. escalation_recommended = true from OpenAI → "AI-recommended escalation"
```

**Alert delivery (multi-channel):**

```
Dashboard → SSE push with alert payload
Webhook → POST to org's configured sentiment_alert_configs.webhook_url
Audit → writeAuditLog(AuditAction.SENTIMENT_ALERT_TRIGGERED)
```

**Reroute Script (organic fit):**

- Uses existing `ai-llm.ts` `/analyze` endpoint with new analysis_type: `objection_response`
- Returns suggested de-escalation script to operator's dashboard
- Does NOT auto-execute (AI is notary/stenographer per AI_ROLE_POLICY.md)

**Compliance Note:** Per AI_ROLE_POLICY.md, AI observes and recommends. It NEVER autonomously reroutes a call. The operator sees the alert and decides.

### Sub-Agent 2E: Dashboard Sentiment Widget

**New files:**

- `components/analytics/SentimentGauge.tsx` — Real-time score display
- `components/analytics/SentimentTimeline.tsx` — Score over call duration
- `components/analytics/ObjectionBadge.tsx` — Keyword alert badges

**Integration point:** `components/dashboard/DashboardContent.tsx` or `app/analytics/page.tsx`

**Data flow:** `apiGet('/api/sentiment/live/:callId')` → SSE stream → React state → gauge render

### Sub-Agent 2F: Test Suite

| Test                                 | Type        | Assertions                                      |
| ------------------------------------ | ----------- | ----------------------------------------------- |
| Sentiment score parsing              | Unit        | Score range validation, JSONB structure         |
| OpenAI prompt response format        | Unit        | Mock response → parsed correctly                |
| Keyword match (10 defaults + custom) | Unit        | Case-insensitive, partial match                 |
| Alert threshold triggering           | Integration | 3 consecutive negatives → alert fired           |
| Webhook delivery on alert            | Integration | Mock webhook receives payload                   |
| Dashboard gauge rendering            | Component   | Score color mapping (-1=red, 0=yellow, 1=green) |
| Rate limiting (30/min)               | Integration | 31st request → 429                              |
| Error chain: OpenAI timeout          | Unit        | Falls back to cached score                      |
| Migration idempotency                | DB          | Run migration twice → no errors                 |
| Feature registry entry               | Production  | sentiment feature registered                    |

---

## 6. Feature 3: Hybrid AI Toggle

**Duration:** 3 weeks (15 working days)  
**Difficulty:** ★★★★★ — Only 10% exists  
**Risk:** HIGH — New Telnyx commands, state machine, real-time control

### What Already Exists

| Component                          | File                       | Status                      |
| ---------------------------------- | -------------------------- | --------------------------- |
| voice_configs.ai_agent_prompt      | DB schema                  | ✅ Column exists (unused)   |
| voice_configs.ai_agent_model       | DB schema                  | ✅ Column exists (unused)   |
| voice_configs.ai_agent_temperature | DB schema                  | ✅ Column exists (unused)   |
| voice_configs.ai_features_enabled  | DB schema                  | ✅ Boolean flag (unused)    |
| ElevenLabs TTS (multi-language)    | TTS route                  | ✅ Can speak any text       |
| OpenAI GPT-4o-mini chat            | `ai-llm.ts`                | ✅ Can generate responses   |
| Telnyx POST /v2/calls              | `voice.ts`                 | ✅ Can place calls          |
| Telnyx speak command               | `voice.ts`                 | ✅ Can speak on active call |
| WebRTCProvider (human takeover)    | `hooks/WebRTCProvider.tsx` | ✅ Can connect human        |

### What Must Be Built

| Component                | Effort | Agent        |
| ------------------------ | ------ | ------------ |
| AI Call State Machine    | 4 days | Sub-Agent 3A |
| Gather/Speak Loop Engine | 3 days | Sub-Agent 3B |
| Human Takeover Protocol  | 2 days | Sub-Agent 3C |
| AI Prompt Management     | 2 days | Sub-Agent 3D |
| Frontend Toggle Controls | 2 days | Sub-Agent 3E |
| Test Suite               | 2 days | Sub-Agent 3F |

### Sub-Agent 3A: AI Call State Machine

**New file:** `workers/src/lib/ai-call-engine.ts`

**State Machine:**

```
IDLE → AI_GREETING → AI_LISTENING → AI_THINKING → AI_SPEAKING → AI_LISTENING (loop)
                                                                         │
                                                          HUMAN_REQUESTED ──→ BRIDGING → HUMAN_ACTIVE
                                                                                              │
                                                                                        CALL_ENDED
```

**States stored in:** KV namespace (`AI_CALL_STATE:{call_control_id}`)

**State transitions driven by Telnyx webhook events:**

```
call.answered        → AI_GREETING (speak greeting via Telnyx)
call.speak.ended     → AI_LISTENING (start gather for DTMF or speech)
call.gather.ended    → AI_THINKING (send to OpenAI for response)
OpenAI response      → AI_SPEAKING (speak response via Telnyx or ElevenLabs)
operator toggle      → HUMAN_REQUESTED (stop gather, bridge to WebRTC)
call.bridged         → HUMAN_ACTIVE
call.hangup          → CALL_ENDED
```

**KV State Schema:**

```json
{
  "state": "AI_LISTENING",
  "call_control_id": "...",
  "organization_id": "...",
  "conversation_history": [
    { "role": "system", "content": "You are a collections agent..." },
    { "role": "assistant", "content": "Hello, this is..." },
    { "role": "user", "content": "Who is this?" }
  ],
  "turn_count": 3,
  "started_at": "2026-02-09T...",
  "ai_model": "gpt-4o-mini",
  "temperature": 0.3,
  "transfer_requested": false
}
```

### Sub-Agent 3B: Gather/Speak Loop

**Telnyx API commands to implement:**

```typescript
// 1. GATHER (listen for speech/DTMF)
POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/gather
{
  "input_type": "speech",          // or "dtmf" or "speech_dtmf"
  "speech_timeout": "auto",
  "language": "en",
  "inter_digit_timeout": 5,
  "maximum_digits": null,          // null = speech mode
  "client_state": base64(JSON.stringify({ flow: 'ai_dialog', turn: N }))
}

// 2. SPEAK (TTS response)
POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/speak
{
  "payload": "Thank you for your payment. Your remaining balance is...",
  "voice": "female",
  "language": "en-US",
  "client_state": base64(JSON.stringify({ flow: 'ai_dialog', turn: N+1 }))
}

// 3. Alternative: Use ElevenLabs for higher quality TTS
// Generate audio → Telnyx play_audio command
POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/play_audio
{
  "audio_url": "https://r2.wordisbond.com/tts/{hash}.mp3",
  "client_state": base64(...)
}
```

**Loop logic (in ai-call-engine.ts):**

```
1. Speak AI response (Telnyx speak or ElevenLabs → play_audio)
2. Wait for call.speak.ended webhook
3. Start gather (speech mode)
4. Wait for call.gather.ended webhook
5. Extract speech transcription from gather result
6. Append to conversation_history in KV
7. POST to OpenAI for next response
8. Speak AI response (loop to step 1)
```

**Fail-safe:** If no gather response within 30 seconds → speak "Are you still there?" → restart gather. After 3 consecutive silences → "I'll transfer you to a team member" → bridge to agent.

### Sub-Agent 3C: Human Takeover Protocol

**Trigger:** Operator clicks "Take Over" button in dashboard

**API:** `POST /api/voice/ai-toggle` with `{ call_id, mode: 'human' }`

**Flow:**

```
1. Validate call_id belongs to org (standard auth + org_id check)
2. Read KV state → verify current state is AI_*
3. Send Telnyx gather cancel (if active)
4. Speak: "One moment, I'm connecting you with a team member"
5. Bridge call to operator's WebRTC connection
6. Update KV state → HUMAN_ACTIVE
7. writeAuditLog(AuditAction.AI_MODE_HUMAN_TAKEOVER)
8. Push SSE event to dashboard: { type: 'mode_changed', mode: 'human' }
```

**Reverse (human → AI) is NOT supported in v1.** Once a human takes over, they stay on. This avoids confusing the caller.

### Sub-Agent 3D: AI Prompt Management

**Files:**

- `workers/src/routes/voice.ts` — Extend `PUT /voice/config` to save ai_agent_prompt
- `components/voice/AIPromptEditor.tsx` — New component

**Prompt template system:**

```
System prompt = org's ai_agent_prompt (from voice_configs)
+ Context injection: "The caller's name is {name}. Balance due: ${balance}. Account status: {status}."
+ Guardrails: "Never promise specific legal outcomes. Never negotiate payment amounts below the balance due. Always offer to transfer to a human."
```

**Prompt is stored in** `voice_configs.ai_agent_prompt` (column already exists)

### Sub-Agent 3E: Frontend Toggle Controls

**Files:**

- `components/voice/AIToggleButton.tsx` — New component
- `hooks/useActiveCall.ts` — Add `aiMode` state + `toggleAIMode()` method
- `components/voice/CallControls.tsx` — Add AI toggle to control bar

**UI States:**

```
AI Active (green robot icon, pulsing) → Click → "Transfer to Human" confirmation → Human Active
Human Active (blue headset icon) → AI button greyed out (no reverse in v1)
```

### Sub-Agent 3F: Test Suite

| Test                                 | Type        | Assertions                                |
| ------------------------------------ | ----------- | ----------------------------------------- |
| State machine transitions (7 states) | Unit        | Each valid transition + invalid rejection |
| Gather/speak loop (3 turns)          | Integration | Mock Telnyx API, verify request sequence  |
| Human takeover flow                  | Integration | KV state update + bridge command sent     |
| OpenAI conversation history          | Unit        | Context window management (max 20 turns)  |
| Fail-safe: 3 silences → transfer     | Integration | Timer-driven state change                 |
| Telnyx gather.ended parsing          | Unit        | Extract speech text from payload          |
| Telnyx speak.ended handling          | Unit        | Advance state machine                     |
| AI prompt injection safety           | Unit        | No prompt injection via caller speech     |
| WebRTC bridge on takeover            | Integration | WebRTCProvider receives call              |
| KV state TTL cleanup                 | Unit        | State expires after 2 hours               |
| Rate limiter: 10 toggles/min         | Integration | 11th toggle → 429                         |
| Feature registry entry               | Production  | hybrid_ai feature registered              |

---

## 7. Feature 4: Predictive Dialer

**Duration:** 3 weeks (15 working days)  
**Difficulty:** ★★★★★ — 5% exists  
**Risk:** HIGH — Queue management, pacing algorithms, agent pool  
**Depends On:** Phase 3 (gather/speak/AMD from AI Toggle)

### What Already Exists

| Component                      | File                              | Status                                 |
| ------------------------------ | --------------------------------- | -------------------------------------- |
| campaigns table                | DB schema                         | ✅ Has status, target_list, schedule   |
| campaign_calls table           | DB schema                         | ✅ Has status, attempt_number, outcome |
| Telnyx POST /v2/calls          | `voice.ts`                        | ✅ Can place calls                     |
| call.machine.detection webhook | webhooks.ts                       | ❌ Not handled (added in Phase 0)      |
| campaigns CRUD routes          | `workers/src/routes/campaigns.ts` | ✅ Basic CRUD                          |

### What Must Be Built

| Component                 | Effort | Agent        |
| ------------------------- | ------ | ------------ |
| Dialer Queue Engine       | 4 days | Sub-Agent 4A |
| Pacing Algorithm          | 3 days | Sub-Agent 4B |
| AMD Handling              | 2 days | Sub-Agent 4C |
| Agent Pool & Assignment   | 3 days | Sub-Agent 4D |
| Frontend Dialer Dashboard | 2 days | Sub-Agent 4E |
| Test Suite                | 1 day  | Sub-Agent 4F |

### Sub-Agent 4A: Dialer Queue Engine

**New file:** `workers/src/lib/dialer-engine.ts`

**Architecture:**

```
Campaign activation
    │
    ▼
Load target_list from campaigns table
    │
    ▼
Score & sort accounts (balance_due DESC, last_contacted_at ASC)
    │
    ▼
Push to KV queue: DIALER_QUEUE:{campaign_id}
    │
    ▼
Scheduled handler (every 5s) pops N items from queue
    │
    ├── For each item: POST /v2/calls with answering_machine_detection: 'detect'
    ├── Track in campaign_calls with status: 'calling'
    └── Wait for webhook events
```

**Queue data in KV:**

```json
{
  "campaign_id": "...",
  "queue": [
    { "account_id": "...", "phone": "+15551234567", "priority": 0.95, "attempts": 0 },
    { "account_id": "...", "phone": "+15559876543", "priority": 0.82, "attempts": 1 }
  ],
  "active_calls": 3,
  "max_concurrent": 5,
  "status": "running"
}
```

**Pacing modes:**

```
preview:     Show account info → agent clicks "Dial" → place call
progressive: Auto-dial when agent becomes available (1:1 ratio)
predictive:  Over-dial based on answer rate (requires abandon rate < 3%)
```

### Sub-Agent 4B: Pacing Algorithm

**File:** `workers/src/lib/dialer-engine.ts`

**Progressive pacing (v1 — safest):**

```
available_agents = count of idle WebRTC connections
active_calls = count of campaign_calls WHERE status = 'calling'
dial_count = available_agents - active_calls
if dial_count > 0 → place dial_count calls
```

**Predictive pacing (v2 — after data accumulates):**

```
answer_rate = answered_calls / total_calls (rolling 1-hour window)
avg_handle_time = avg(ended_at - started_at) for completed calls
predicted_available = agents * (1 - utilization_rate)
dial_count = predicted_available / answer_rate
abandon_check = if abandon_rate > 3% → throttle to progressive
```

### Sub-Agent 4C: AMD Handling

**Webhook event:** `call.machine.detection.ended` (registered in Phase 0)

**Decision tree:**

```
result = 'human'     → connect to available agent (bridge)
result = 'machine'   → leave voicemail via speak command, then hangup
result = 'not_sure'  → connect to agent (err on side of human)
result = 'fax'       → hangup immediately, mark as 'fax' disposition
```

**Voicemail script:** Uses org's ai_agent_prompt or default: "Hello, this is a call regarding your account with {org_name}. Please call us back at {callback_number}."

### Sub-Agent 4D: Agent Pool & Assignment

**New migration:** `migrations/2026-02-09-dialer-agent-pool.sql`

```sql
CREATE TABLE IF NOT EXISTS dialer_agent_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  campaign_id UUID REFERENCES campaigns(id),
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('offline', 'available', 'on_call', 'wrap_up', 'break')),
  current_call_id UUID REFERENCES calls(id),
  last_call_ended_at TIMESTAMPTZ,
  wrap_up_seconds INTEGER DEFAULT 30,
  calls_handled INTEGER DEFAULT 0,
  shift_started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dialer_agent_org_status
  ON dialer_agent_status(organization_id, status);
CREATE INDEX idx_dialer_agent_campaign
  ON dialer_agent_status(campaign_id) WHERE campaign_id IS NOT NULL;
```

**Agent lifecycle:**

```
Login → available → call connected → on_call → call ended → wrap_up (30s) → available
                                                                     │
                                                               break (manual)
```

### Sub-Agent 4E: Frontend Dialer Dashboard

**New files:**

- `app/campaigns/dialer/page.tsx` — Dialer view
- `components/campaigns/DialerControls.tsx` — Start/pause/stop queue
- `components/campaigns/DialerStats.tsx` — Real-time metrics
- `components/campaigns/AgentStatusBoard.tsx` — Agent pool status

**Metrics displayed:**

```
Active Calls: 3/5
Queue Remaining: 47
Answer Rate: 62%
Avg Handle Time: 4:23
Abandon Rate: 1.2%
Agents Available: 2 | On Call: 3 | Wrap Up: 1
```

### Sub-Agent 4F: Test Suite

| Test                                    | Type        | Assertions                          |
| --------------------------------------- | ----------- | ----------------------------------- |
| Queue pop/push operations               | Unit        | FIFO ordering, priority sort        |
| Progressive pacing (3 agents, 1 active) | Unit        | Dials 2 calls                       |
| Predictive pacing with abandon guard    | Unit        | Throttles at 3%                     |
| AMD: human → bridge                     | Integration | Mock Telnyx, verify bridge command  |
| AMD: machine → voicemail → hangup       | Integration | Speak + hangup sequence             |
| Agent status transitions                | Unit        | Valid transitions only              |
| Campaign start → queue load             | Integration | Targets loaded in priority order    |
| Campaign pause → no new dials           | Integration | Queue frozen, active calls continue |
| Concurrent call limit enforcement       | Unit        | Never exceeds max_concurrent        |
| KV queue TTL cleanup                    | Unit        | Stale queues cleaned after 24h      |
| Feature registry entry                  | Production  | predictive_dialer registered        |

---

## 8. Feature 5: IVR Payment Collection

**Duration:** 3 weeks (15 working days)  
**Difficulty:** ★★★★★ — 5% exists  
**Risk:** VERY HIGH — PCI compliance, financial transactions, DTMF security  
**Depends On:** Phase 3 (gather/speak from AI Toggle)

### What Already Exists

| Component                 | File                             | Status                      |
| ------------------------- | -------------------------------- | --------------------------- |
| Stripe checkout flow      | `workers/src/routes/billing.ts`  | ✅ Full pipeline            |
| Stripe webhook handler    | `workers/src/routes/webhooks.ts` | ✅ HMAC verified            |
| collection_accounts table | DB                               | ✅ balance_due, payments    |
| collection_payments table | DB                               | ✅ stripe_payment_id column |
| billing_events table      | DB                               | ✅ Event tracking           |
| Idempotency middleware    | `workers/src/lib/idempotency.ts` | ✅ Prevents double-charge   |
| ElevenLabs TTS            | TTS route                        | ✅ For spoken confirmations |

### What Must Be Built

| Component                      | Effort | Agent        |
| ------------------------------ | ------ | ------------ |
| IVR Flow Engine                | 4 days | Sub-Agent 5A |
| DTMF Gather Integration        | 2 days | Sub-Agent 5B |
| Stripe PaymentIntent for Phone | 3 days | Sub-Agent 5C |
| Payment Confirmation TTS       | 1 day  | Sub-Agent 5D |
| PCI Compliance Layer           | 3 days | Sub-Agent 5E |
| Frontend IVR Config            | 1 day  | Sub-Agent 5F |
| Test Suite                     | 1 day  | Sub-Agent 5G |

### Sub-Agent 5A: IVR Flow Engine

**New file:** `workers/src/lib/ivr-flow-engine.ts`

**IVR Menu Tree:**

```
GREETING → "Press 1 to make a payment. Press 2 to check your balance. Press 3 to speak with an agent."
    │
    ├── DTMF 1 → PAYMENT_FLOW
    │     ├── "Your balance is $X. Press 1 to pay in full. Press 2 to enter a custom amount."
    │     ├── DTMF 1 → FULL_PAYMENT → Stripe → CONFIRMATION
    │     └── DTMF 2 → CUSTOM_AMOUNT → "Enter amount in dollars followed by pound" → Stripe → CONFIRMATION
    │
    ├── DTMF 2 → BALANCE_CHECK
    │     └── "Your current balance is $X. Press 1 to make a payment. Press 9 to return."
    │
    └── DTMF 3 → TRANSFER_TO_AGENT
          └── Bridge to available agent (uses dialer agent pool if available)
```

**Flow state in KV:** `IVR_FLOW:{call_control_id}`

```json
{
  "state": "PAYMENT_AMOUNT_INPUT",
  "call_control_id": "...",
  "account_id": "...",
  "organization_id": "...",
  "balance_due": 250.0,
  "amount_entered": null,
  "payment_intent_id": null,
  "flow_started_at": "2026-02-09T..."
}
```

### Sub-Agent 5B: DTMF Gather for Payments

**Telnyx gather command (payment amount):**

```typescript
POST /v2/calls/{call_control_id}/actions/gather
{
  "input_type": "dtmf",
  "minimum_digits": 1,
  "maximum_digits": 7,        // Max $99,999.99
  "terminating_digit": "#",
  "timeout_millis": 15000,
  "inter_digit_timeout": 5000,
  "client_state": base64({ flow: 'ivr_payment', step: 'amount_input' })
}
```

**call.gather.ended handler (in webhooks.ts Phase 0 dispatch):**

```
1. Parse digits from payload
2. Look up flow state from KV
3. Validate amount (> 0, <= balance_due)
4. If valid → create Stripe PaymentIntent
5. If invalid → speak error + re-gather
```

### Sub-Agent 5C: Stripe PaymentIntent for Phone Payments

**New route:** `POST /api/ivr/payment` in new file `workers/src/routes/ivr.ts`

**Flow:**

```
1. Create Stripe PaymentIntent:
   - amount: entered_amount * 100 (cents)
   - currency: 'usd'
   - metadata: { account_id, call_id, organization_id, ivr: true }
   - payment_method_types: ['card'] (for future: phone keypad card entry)

2. For v1: Generate Stripe payment link, speak it as URL
   - "To complete your payment, please visit [spelled-out URL] on your phone"
   - Alternative: SMS the payment link to caller's number

3. Hold call while waiting for payment webhook:
   - Play hold music via Telnyx play_audio
   - Stripe webhook: payment_intent.succeeded → resume call

4. On success:
   - INSERT INTO collection_payments (method: 'ivr', stripe_payment_id)
   - UPDATE collection_accounts SET balance_due = balance_due - amount
   - Speak confirmation: "Payment of $X received. Your new balance is $Y."
   - writeAuditLog(AuditAction.IVR_PAYMENT_COMPLETED)
```

**Idempotency:** Use existing `idempotency()` middleware on POST /ivr/payment. PaymentIntent creation is idempotent via Stripe's idempotency key.

### Sub-Agent 5D: Payment Confirmation TTS

**Uses ElevenLabs** (already integrated) for high-quality spoken confirmations:

```
Templates:
- "Your payment of [amount] dollars has been successfully processed."
- "Your remaining balance is [balance] dollars."
- "A receipt has been sent to your phone."
- "Thank you for your payment. Goodbye."
```

**TTS caching:** Same KV+R2 pattern as existing TTS route (7-day TTL). Common amounts ($50, $100, $250, $500) pre-cached.

### Sub-Agent 5E: PCI Compliance Layer

**Critical:** IVR payment systems handling card data must comply with PCI DSS.

**v1 Approach (PCI-safe — no card data touches our system):**

```
- Stripe Payment Links: Card entry happens on Stripe's hosted page
- SMS delivery: Send payment link to caller's phone via Telnyx SMS
- Our system NEVER receives or stores card numbers
- This is PCI SAQ A compliant (simplest level)
```

**v2 Approach (future — requires PCI SAQ D):**

```
- DTMF card entry via Telnyx gather
- Digits sent directly to Stripe via secure tokenization
- Requires DTMF masking in call recordings
- Requires network segmentation documentation
- DO NOT IMPLEMENT IN V1
```

**Recording pause during payment:**

```
When IVR state enters PAYMENT_FLOW:
1. Telnyx pause_recording command
2. Process payment
3. Telnyx resume_recording command
4. Audit log: recording_paused_for_payment
```

### Sub-Agent 5F: Frontend IVR Config

**Files:**

- `components/settings/IVRPaymentConfig.tsx` — Enable/disable, greeting text, hold music URL
- Integration into `app/settings/page.tsx`

### Sub-Agent 5G: Test Suite

| Test                              | Type        | Assertions                              |
| --------------------------------- | ----------- | --------------------------------------- |
| IVR flow state machine (6 states) | Unit        | Valid transitions, invalid rejection    |
| DTMF amount parsing               | Unit        | "15000#" → $150.00, "0#" → rejected     |
| Stripe PaymentIntent creation     | Integration | Mock Stripe, verify amount/metadata     |
| Payment webhook → balance update  | Integration | collection_accounts.balance_due reduced |
| Idempotency: duplicate payment    | Integration | Same idempotency key → single charge    |
| Recording pause during payment    | Integration | Telnyx pause/resume commands sent       |
| Hold music while waiting          | Integration | play_audio command sent                 |
| Timeout: no payment in 5 min      | Integration | Speak timeout message, end flow         |
| SMS payment link delivery         | Integration | Telnyx SMS API called                   |
| PCI: no card data in logs         | Security    | Grep all log outputs for PAN patterns   |
| Feature registry entry            | Production  | ivr_payments registered                 |

---

## 9. Cross-Cutting Concerns

### 9A: Error Handling Chain (Every Feature)

> **⚠️ POOL LEAK PREVENTION (LESSONS_LEARNED #2 — 147+ handlers fixed):**  
> Every Sub-Agent creating route handlers MUST use `const db = getDb(c.env)` BEFORE the try block,  
> and `await db.end()` INSIDE the finally block. No exceptions. This was the second most expensive  
> systemic bug in the codebase. Copy the pattern below exactly.

Every new pipeline MUST implement this error chain:

```typescript
try {
  // Business logic
} catch (error) {
  if (error instanceof ZodError) {
    return c.json({ error: 'Validation failed', details: error.issues }, 400)
  }
  if (error.code === '23505') {
    // unique_violation
    return c.json({ error: 'Duplicate resource' }, 409)
  }
  if (error.code === '23503') {
    // foreign_key_violation
    return c.json({ error: 'Referenced resource not found' }, 404)
  }
  logger.error('Route handler error', {
    route: c.req.path,
    method: c.req.method,
    error: error?.message,
    stack: error?.stack,
  })
  return c.json({ error: 'Internal server error' }, 500)
} finally {
  await db.end() // ALWAYS close connection
}
```

### 9B: Feature Flags

**File:** `tests/production/feature-registry.test.ts`

**New entries to add:**

```typescript
{
  id: 'multi_language_v2',
  name: 'Multi-Language Live Translation v2',
  category: 'voice',
  routeFile: 'workers/src/routes/voice.ts',
  endpoints: ['GET /api/voice/detect-language', 'GET /api/voice/translation-stats'],
  status: 'active'
},
{
  id: 'sentiment_analysis',
  name: 'Real-Time Sentiment Analysis',
  category: 'ai',
  routeFile: 'workers/src/routes/sentiment.ts',
  endpoints: ['GET /api/sentiment/live/:callId', 'GET /api/sentiment/config', 'PUT /api/sentiment/config'],
  status: 'active'
},
{
  id: 'hybrid_ai_toggle',
  name: 'Hybrid AI Toggle',
  category: 'voice',
  routeFile: 'workers/src/routes/voice.ts',
  endpoints: ['POST /api/voice/ai-toggle', 'GET /api/voice/ai-state/:callId'],
  status: 'active'
},
{
  id: 'predictive_dialer',
  name: 'Predictive Dialer',
  category: 'campaigns',
  routeFile: 'workers/src/routes/dialer.ts',
  endpoints: ['POST /api/dialer/start', 'POST /api/dialer/pause', 'POST /api/dialer/stop', 'GET /api/dialer/stats'],
  status: 'active'
},
{
  id: 'ivr_payments',
  name: 'IVR Payment Collection',
  category: 'collections',
  routeFile: 'workers/src/routes/ivr.ts',
  endpoints: ['POST /api/ivr/start', 'POST /api/ivr/payment', 'GET /api/ivr/status/:callId'],
  status: 'active'
}
```

### 9C: New Route Registration

**File:** `workers/src/index.ts`

```typescript
import { sentimentRoutes } from './routes/sentiment'
import { dialerRoutes } from './routes/dialer'
import { ivrRoutes } from './routes/ivr'

app.route('/api/sentiment', sentimentRoutes)
app.route('/api/dialer', dialerRoutes)
app.route('/api/ivr', ivrRoutes)
```

### 9D: New Environment Bindings

**File:** `wrangler.jsonc` — KV namespace bindings needed:

```
AI_CALL_STATE     — AI call state machine (Phase 3)
DIALER_QUEUE      — Dialer queue data (Phase 4)
IVR_FLOW_STATE    — IVR flow state (Phase 5)
SENTIMENT_CACHE   — Cached sentiment scores (Phase 2)
```

These MAY share the existing KV namespace with prefixed keys, or be separate namespaces for isolation.

### 9E: Scheduled Handler Extensions

**File:** `workers/src/scheduled.ts`

```
Every 5 seconds:  Dialer pacing check (pop queue, place calls)
Every 1 minute:   Sentiment cache cleanup (expired scores)
Every 5 minutes:  IVR flow timeout check (abandon stale flows)
Every 1 hour:     Dialer stats aggregation
```

---

## 10. Test Strategy

### Test Pyramid Per Feature

```
                    ┌─────────────┐
                    │  E2E (2-3)  │  Playwright: Full user flow
                   ─┤             ├─
                  / │             │ \
                 /  └─────────────┘  \
                /   ┌─────────────┐   \
               /    │Integration  │    \
              ─────┤│  (5-8)     │├─────
             /      │             │      \
            /       └─────────────┘       \
           /        ┌─────────────┐        \
          /         │  Unit (15+) │         \
         ───────────┤             ├───────────
                    │             │
                    └─────────────┘
```

### Total New Tests (Estimated)

| Feature           | Unit   | Integration | E2E    | Total   |
| ----------------- | ------ | ----------- | ------ | ------- |
| Multi-Language v2 | 8      | 4           | 2      | 14      |
| Sentiment         | 12     | 6           | 2      | 20      |
| Hybrid AI Toggle  | 15     | 8           | 3      | 26      |
| Predictive Dialer | 12     | 6           | 2      | 20      |
| IVR Payments      | 12     | 7           | 2      | 21      |
| **Total**         | **59** | **31**      | **11** | **101** |

### Error Debugging Framework

Every feature agent MUST validate:

```
1. Happy path: Normal flow succeeds
2. Auth failure: Missing/invalid token → 401
3. Org isolation: Wrong org_id → empty result (not 403)
4. Validation failure: Bad input → 400 with Zod details
5. DB error: Connection failure → 500 with log (not leak)
6. Rate limit: Exceed limit → 429 with retry-after
7. Concurrency: Parallel requests → idempotent result
8. Timeout: External API timeout → graceful degradation
9. Audit trail: Action logged with correct old_value/new_value
10. Connection cleanup: db.end() called in finally block
```

---

## 11. Rollout & Feature Flags

### Progressive Rollout Plan

```
Week 1:  Multi-Language v2 → deploy to all orgs (low risk, existing infra)
Week 3:  Sentiment Analysis → deploy behind feature flag (org opt-in)
Week 6:  Hybrid AI Toggle → deploy behind feature flag + plan tier gate (pro+)
Week 9:  Predictive Dialer → deploy behind feature flag + plan tier gate (business+)
Week 12: IVR Payments → deploy behind feature flag + plan tier gate (enterprise)
```

### Feature Gating

Use existing `features` table pattern:

```sql
-- Check if feature is enabled for org
SELECT enabled FROM org_features
WHERE organization_id = $1 AND feature_key = $2
```

### Tier Requirements

| Feature           | Starter | Pro | Business | Enterprise |
| ----------------- | ------- | --- | -------- | ---------- |
| Multi-Language    | ✅      | ✅  | ✅       | ✅         |
| Sentiment         | ❌      | ✅  | ✅       | ✅         |
| Hybrid AI Toggle  | ❌      | ✅  | ✅       | ✅         |
| Predictive Dialer | ❌      | ❌  | ✅       | ✅         |
| IVR Payments      | ❌      | ❌  | ❌       | ✅         |

---

## 12. Risk Registry

| Risk                                           | Impact                | Probability | Mitigation                                    |
| ---------------------------------------------- | --------------------- | ----------- | --------------------------------------------- |
| Telnyx gather command latency > 5s             | Caller hangs up       | Medium      | Pre-buffer TTS audio, use ElevenLabs cache    |
| OpenAI rate limit during sentiment scoring     | Missed sentiment data | Medium      | KV cache, score every 3rd segment             |
| Stripe PaymentIntent timeout during IVR        | Payment stuck         | Low         | 5-min timeout + retry link via SMS            |
| AMD false positive (human detected as machine) | Lost call             | Medium      | Default to "not_sure" → connect to agent      |
| Predictive dialer abandon rate > 3%            | FCC/TCPA violation    | High        | Hard cap at 3%, auto-throttle to progressive  |
| AI prompt injection via caller speech          | Security breach       | Medium      | Sanitize gather results, limit context window |
| PCI audit finding on IVR payments              | Legal exposure        | Low (v1)    | v1 uses Stripe Payment Links only, SAQ A      |
| KV state corruption (race condition)           | Flow stuck            | Medium      | Atomic KV operations, TTL auto-cleanup        |
| WebRTC bridge failure during AI takeover       | Caller abandoned      | Medium      | Fallback: transfer to PSTN number             |
| Translation quality for rare languages         | User complaint        | Low         | Quality score tracking, human review flag     |

---

## Summary: Total Effort

| Phase     | Feature               | Duration      | New Files               | DB Migrations     | New Tests     |
| --------- | --------------------- | ------------- | ----------------------- | ----------------- | ------------- |
| 0         | Shared Infrastructure | 3 days        | 0 new, 5 modified       | 0                 | 6             |
| 1         | Multi-Language v2     | 1 week        | 3 new, 4 modified       | 1                 | 14            |
| 2         | Sentiment & Objection | 2 weeks       | 5 new, 3 modified       | 1                 | 20            |
| 3         | Hybrid AI Toggle      | 3 weeks       | 4 new, 5 modified       | 0 (columns exist) | 26            |
| 4         | Predictive Dialer     | 3 weeks       | 4 new, 3 modified       | 1                 | 20            |
| 5         | IVR Payments          | 3 weeks       | 4 new, 4 modified       | 0 (tables exist)  | 21            |
| **Total** |                       | **~13 weeks** | **20 new, 24 modified** | **3 migrations**  | **107 tests** |

**Post-implementation baseline:** v5.0 · 114/114+ roadmap · ~500+ tests

---

_This plan was generated from deep infrastructure mapping of the actual codebase — not aspirational estimates. Every file path, Telnyx command, DB column, and Zod schema referenced in this document has been verified against the current v4.29 codebase._
