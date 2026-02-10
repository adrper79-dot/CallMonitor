# Telnyx Translation Quick Start Guide

**Created:** February 10, 2026  
**Purpose:** Enable and test live call translation feature  
**Prerequisites:** Telnyx Call Control App, OpenAI API Key  
**Time Required:** 15 minutes

---

## Problem Statement

**User Report:** "I don't believe translation is working"

**Root Cause:** Translation feature is **correctly implemented** in code but **disabled in database** via configuration flag.

**Location:** `workers/src/routes/webhooks.ts` lines 761-769

```typescript
const translationConfig = await getTranslationConfig(db, orgId)
if (!translationConfig || !translationConfig.live_translate) {
  return  // ← Exits here if disabled!
}
```

**Fix:** Enable `live_translate` flag in `voice_configs` table.

---

## Step 1: Enable Translation (SQL Method)

### Connect to Neon Database

```bash
# Using psql
psql $(npx wrangler secret get NEON_PG_CONN)

# Or using Neon dashboard SQL editor
# https://console.neon.tech/app/projects/YOUR_PROJECT_ID
```

### Check Current Config

```sql
SELECT 
  organization_id,
  live_translate,
  transcribe,
  translate_from,
  translate_to,
  voice_to_voice
FROM voice_configs
WHERE organization_id = 'YOUR_ORG_ID';
```

**Expected Result:**
- If row exists with `live_translate = false` → Translation disabled ❌
- If row doesn't exist → Translation not configured ❌

### Enable Translation

```sql
-- For existing config:
UPDATE voice_configs 
SET 
  live_translate = true,
  transcribe = true,
  translate_from = 'en',  -- Source language (English)
  translate_to = 'es'     -- Target language (Spanish)
WHERE organization_id = 'YOUR_ORG_ID';

-- For new config:
INSERT INTO voice_configs (
  organization_id, 
  live_translate, 
  transcribe, 
  translate_from, 
  translate_to,
  voice_to_voice
) VALUES (
  'YOUR_ORG_ID',
  true,
  true,
  'en',
  'es',
  false  -- Set to true for voice-to-voice (requires ElevenLabs)
)
ON CONFLICT (organization_id) DO UPDATE 
SET 
  live_translate = true,
  transcribe = true,
  translate_from = EXCLUDED.translate_from,
  translate_to = EXCLUDED.translate_to;
```

### Verify Update

```sql
SELECT * FROM voice_configs WHERE organization_id = 'YOUR_ORG_ID';
```

**Expected Result:**
```
organization_id       | YOUR_ORG_ID
live_translate        | true         ← MUST BE TRUE
transcribe            | true         ← MUST BE TRUE
translate_from        | en
translate_to          | es
voice_to_voice        | false
record                | true
```

---

## Step 2: Enable Translation (API Method)

### Using API Endpoint

```bash
# Update voice configuration via API
curl -X PUT https://wordisbond-api.adrper79.workers.dev/api/voice/config \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "live_translate": true,
    "transcribe": true,
    "translate_from": "en",
    "translate_to": "es",
    "voice_to_voice": false
  }'
```

### Verify via API

```bash
curl https://wordisbond-api.adrper79.workers.dev/api/voice/config \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

---

## Step 3: Test Translation End-to-End

### A. Place Test Call

```bash
# Via API
curl -X POST https://wordisbond-api.adrper79.workers.dev/api/voice/call \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "+15551234567",
    "from_number": "+17062677235",
    "flow_type": "direct"
  }'

# Response:
{
  "success": true,
  "call_id": "uuid-here",
  "call_sid": "telnyx-call-id"
}
```

### B. Monitor Webhook Events

```bash
# In separate terminal, tail worker logs
npx wrangler tail --format pretty

# Look for these events:
# ✅ call.initiated
# ✅ call.answered
# ✅ call.transcription ← KEY EVENT (triggers translation)
# ✅ call.hangup
```

### C. Verify Transcriptions Received

```sql
-- Check calls table
SELECT 
  id, 
  status, 
  to_number, 
  answered_at,
  ended_at
FROM calls 
WHERE id = 'CALL_ID_FROM_STEP_A';

-- Expected: status = 'completed' or 'in_progress'
```

### D. Verify Translations Stored

```sql
-- Check call_translations table
SELECT 
  id,
  call_id,
  original_text,
  translated_text,
  source_language,
  target_language,
  segment_index,
  confidence,
  timestamp,
  speaker
FROM call_translations
WHERE call_id = 'CALL_ID_FROM_STEP_A'
ORDER BY segment_index ASC;

-- Expected: Rows with translations
-- original_text: English
-- translated_text: Spanish
```

**Example Output:**
```
id                  | uuid-1
call_id             | CALL_ID_FROM_STEP_A
original_text       | Hello, how can I help you?
translated_text     | Hola, ¿cómo puedo ayudarte?
source_language     | en
target_language     | es
segment_index       | 0
confidence          | 0.97
timestamp           | 2026-02-10 10:30:15
speaker             | customer
```

### E. Test SSE Streaming Endpoint

```bash
# Connect to live translation stream
curl -N https://wordisbond-api.adrper79.workers.dev/api/voice/live-translation/CALL_ID \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Response (SSE format):
# data: {"type":"translation","segment_index":0,"original":"Hello","translated":"Hola","confidence":0.95}
#
# data: {"type":"translation","segment_index":1,"original":"How are you?","translated":"¿Cómo estás?","confidence":0.98}
```

---

## Step 4: Run L3/L4 Tests

### Prerequisites

```bash
# Set environment variables
export RUN_VOICE_TESTS=1
export TEST_AGENT_PHONE="+17062677235"
export TEST_CUSTOMER_PHONE="+15551234567"
export OPENAI_API_KEY="sk-..."
export TELNYX_API_KEY="KEY..."
export TELNYX_PUBLIC_KEY="..." # For signature verification tests
```

### Run Bridge Call Tests

```bash
# Execute bridge call flow tests
npm run test:production -- bridge-call-flow.test.ts

# Expected: 30+ tests passing
# ✅ Bridge call initiation
# ✅ E.164 validation
# ✅ AMD disabled for agent
# ✅ Status transitions
# ✅ Customer call creation
# ✅ Transcription routing
```

### Run Translation Pipeline Tests

```bash
# Execute translation pipeline tests
npm run test:production -- translation-pipeline.test.ts

# Expected: 40+ tests passing
# ✅ Config flag controls
# ✅ OpenAI integration (incurs API charges)
# ✅ Database storage
# ✅ SSE streaming
# ✅ Voice-to-voice TTS
# ✅ Error handling
```

### Run AMD Tests

```bash
# Execute AMD tests
npm run test:production -- amd.test.ts

# Expected: 25+ tests passing
# ✅ AMD enabled for direct calls
# ✅ AMD disabled for bridge agent leg
# ✅ Status storage
# ✅ Webhook handling
# ✅ Performance characteristics
```

### Run All Voice Tests

```bash
# Execute all voice-related tests
npm run test:production -- --grep "voice|translation|bridge|amd"

# WARNING: This will:
# - Make real Telnyx API calls (costs money)
# - Make real OpenAI API calls (costs money)
# - Require actual phone numbers
```

---

## Supported Languages

### Standard Language Codes

| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | Source/Target |
| `es` | Spanish | Source/Target |
| `fr` | French | Source/Target |
| `de` | German | Source/Target |
| `it` | Italian | Source/Target |
| `pt` | Portuguese | Source/Target |
| `zh` | Chinese | Source/Target |
| `ja` | Japanese | Source/Target |
| `ko` | Korean | Source/Target |
| `ar` | Arabic | Source/Target |

### Example Configurations

```sql
-- English → Spanish
UPDATE voice_configs SET translate_from = 'en', translate_to = 'es';

-- Spanish → English
UPDATE voice_configs SET translate_from = 'es', translate_to = 'en';

-- Multi-lingual call center (French → English)
UPDATE voice_configs SET translate_from = 'fr', translate_to = 'en';
```

---

## Voice-to-Voice Translation (Advanced)

### Enable TTS Synthesis

```sql
UPDATE voice_configs 
SET voice_to_voice = true
WHERE organization_id = 'YOUR_ORG_ID';
```

**Requirements:**
- ElevenLabs API key configured (`ELEVENLABS_API_KEY`)
- Cloudflare R2 storage for audio files
- Additional Telnyx API calls for audio injection

**How It Works:**
1. Telnyx sends transcription → OpenAI translates
2. Translation text → ElevenLabs TTS → Audio file
3. Audio uploaded to R2 → URL sent to Telnyx
4. Telnyx plays audio into call via `/calls/:id/actions/playback_start`

**Performance:**
- Typical latency: 2-4 seconds (transcription → audio playback)
- Use for: High-value calls where natural voice is critical
- Skip for: High-volume campaigns (text translation is faster)

---

## Troubleshooting

### Translation Not Appearing

**Check 1: Configuration Enabled?**
```sql
SELECT live_translate, transcribe FROM voice_configs WHERE organization_id = 'YOUR_ORG_ID';
-- Both must be true
```

**Check 2: Telnyx Transcription Webhooks?**
```bash
# Monitor webhook logs
npx wrangler tail --format pretty | grep "call.transcription"

# If no events → Check Telnyx Call Control App webhook URL
# Should be: https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx
```

**Check 3: OpenAI API Key Valid?**
```bash
# Test OpenAI API directly
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

**Check 4: Database Rows?**
```sql
SELECT COUNT(*) FROM call_translations WHERE call_id = 'YOUR_CALL_ID';
-- Should be > 0 if translation occurred
```

### SSE Stream Not Connecting

**Check 1: Authentication**
```bash
# Verify session token is valid
curl https://wordisbond-api.adrper79.workers.dev/api/voice/config \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return 200, not 401
```

**Check 2: CORS Headers**
```bash
# Check headers
curl -I https://wordisbond-api.adrper79.workers.dev/api/voice/live-translation/CALL_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected:
# content-type: text/event-stream
# cache-control: no-cache
# connection: keep-alive
```

### Signature Verification Failing

**Check 1: Public Key Configured**
```bash
# Verify env var set
npx wrangler secret list | grep TELNYX_PUBLIC_KEY
```

**Check 2: Webhook Source**
```bash
# Ensure webhooks come from Telnyx IPs
# See: https://developers.telnyx.com/docs/v2/development/webhooks
```

---

## Cost Estimation

### Telnyx Costs (Per Call)

- **Outbound call:** $0.01/minute
- **Transcription:** $0.05/minute
- **Total:** ~$0.06/minute for transcribed call

### OpenAI Costs (Per Translation)

- **GPT-4o-mini:** $0.00015/1K input tokens, $0.00060/1K output tokens
- **Average translation:** ~100 tokens → $0.00007 per segment
- **10-minute call:** ~60 segments → $0.0042

### ElevenLabs Costs (Voice-to-Voice Only)

- **Standard voice:** ~$0.30/1K characters
- **10-minute call:** ~3K characters → $0.90

### Example: 100 Calls/Month

**Text Translation Only:**
- Telnyx: 100 calls × 5 min avg × $0.06/min = $30
- OpenAI: 100 calls × $0.02 = $2
- **Total:** $32/month

**Voice-to-Voice:**
- Telnyx: $30
- OpenAI: $2
- ElevenLabs: 100 calls × $0.90 = $90
- **Total:** $122/month

---

## References

- **Telnyx Integration Audit:** [ARCH_DOCS/TELNYX_INTEGRATION_AUDIT.md](TELNYX_INTEGRATION_AUDIT.md)
- **Translation Pipeline Code:** [workers/src/lib/translation-processor.ts](../workers/src/lib/translation-processor.ts)
- **Webhook Handler:** [workers/src/routes/webhooks.ts](../workers/src/routes/webhooks.ts) (lines 682-850)
- **Voice API:** [workers/src/routes/voice.ts](../workers/src/routes/voice.ts)
- **SSE Endpoint:** [workers/src/routes/live-translation.ts](../workers/src/routes/live-translation.ts)

---

## Next Steps

1. ✅ **Enable translation** via SQL or API (Step 1-2 above)
2. ✅ **Place test call** and verify translations appear (Step 3)
3. ✅ **Run L3/L4 tests** to validate full pipeline (Step 4)
4. 📊 **Monitor production** for transcription webhook events
5. 📈 **Scale up** to production traffic gradually

**Need Help?**
- Check [TELNYX_INTEGRATION_AUDIT.md](TELNYX_INTEGRATION_AUDIT.md) for detailed findings
- Review test files for code examples
- Monitor `npx wrangler tail` for real-time debugging
