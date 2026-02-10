# Live Translation Test Setup

## Prerequisites

1. **Get Session Token from Browser**

   ```bash
   # After signing into https://voxsouth.online
   # Open browser DevTools → Application → Cookies
   # Copy value of: wb-session-token
   ```

2. **Create `.dev.vars` File (if not exists)**

   ```bash
   cp .dev.vars.example .dev.vars
   ```

3. **Add Required Environment Variables**
   ```bash
   # Add to .dev.vars:
   WB_SESSION_TOKEN=your_token_from_browser
   OPENAI_API_KEY=sk-...
   API_BASE_URL=https://wordisbond-api.adrper79.workers.dev
   TELNYX_NUMBER=+1...
   ```

## Run Test

```bash
npm run test:translation
```

## What It Tests

### ✅ Step 1: Prerequisites

- Verifies OPENAI_API_KEY is set
- Validates session authentication
- Checks organization plan (business/enterprise)
- Ensures voice config has `live_translate: true`

### ✅ Step 2: Webhook Simulation

- Creates a test call via API
- Simulates Telnyx `call.transcription` events
- Tests OpenAI translation processor directly
- Processes 3 sample transcripts:
  - "Hello, how are you today?"
  - "I need help with my account."
  - "Can you transfer me to billing?"

### ✅ Step 3: Database Verification

- Confirms call record exists
- Shows SQL query to check `call_translations` table

### ✅ Step 4: SSE Stream Test

- Opens SSE connection to `/api/voice/translate/stream`
- Listens for translation events (10s timeout)
- Logs received segments

### ✅ Step 5: Cleanup

- Provides SQL commands for manual cleanup
- Preserves test data for inspection

## Expected Output

```
████████████████████████████████████████████████████████████
  LIVE TRANSLATION FLOW TEST
  2026-02-09T...
████████████████████████████████████████████████████████████

============================================================
STEP 1: Verify Prerequisites
============================================================
✅ OPENAI_API_KEY present: sk-proj-...
✅ Session valid: { userId: '...', orgId: '...', plan: 'business' }
✅ Voice config: { live_translate: true, translate_from: 'en', translate_to: 'es' }

============================================================
STEP 2: Simulate Telnyx call.transcription Webhook
============================================================
📞 Creating test call...
✅ Test call created: { callId: '...', call_control_id: 'v3:...' }

📨 Simulating call.transcription webhook...
   Segment 1: Hello, how are you today?
   🔄 Translation Processor Test
      Input: Hello, how are you today?
      Output: Hola, ¿cómo estás hoy?
      ✅ Translation successful
      ⏱️  Latency: ~42 tokens
      💾 Would insert into call_translations table

...

✅ All transcription segments processed

============================================================
STEP 3: Verify Database Entries
============================================================
🔍 Checking call record...
✅ Call record found: { id: '...', status: 'initiated', ... }

💡 To verify call_translations table manually:
   SELECT * FROM call_translations WHERE call_id = '...';

============================================================
STEP 4: Test SSE Stream Delivery
============================================================
📡 Opening SSE stream for call: ...
   Status: 200 OK
   ✅ Stream connected
   ⏳ Listening for events (10 second timeout)...

   📨 Event: translation
   📦 Data: { original: 'Hello, how are you today?...', translated: 'Hola, ¿cómo estás hoy?...', segment: 0 }
   ...

   ✅ Received 3 translation events

============================================================
STEP 5: Cleanup Test Data
============================================================
💡 Manual cleanup required:
   DELETE FROM call_translations WHERE call_id = '...';
   DELETE FROM calls WHERE id = '...';

████████████████████████████████████████████████████████████
  TEST RESULTS
████████████████████████████████████████████████████████████

  Prerequisites:     ✅ PASS
  Webhook Sim:       ✅ PASS
  Database:          ✅ PASS
  SSE Stream:        ✅ PASS
  Cleanup:           ✅ PASS

  Overall:           ✅ ALL TESTS PASSED

████████████████████████████████████████████████████████████
```

## Troubleshooting

### ❌ "WB_SESSION_TOKEN not set"

- Get token from browser after signing in
- Add to `.dev.vars` file

### ❌ "Session check failed"

- Token may be expired
- Sign in again and get fresh token

### ❌ "Organization plan is not business/enterprise"

- SSE stream will return 403
- Update organization plan in database

### ❌ "No translations received from stream"

- Check if translations were written to DB:
  ```sql
  SELECT * FROM call_translations WHERE call_id = 'your_call_id';
  ```
- Verify call status is not already "completed"
- Check Workers logs: `npm run api:tail`

### ❌ "OpenAI API failed"

- Verify OPENAI_API_KEY is valid
- Check API quota/billing

## Real Webhook Testing

To test with actual Telnyx webhooks:

1. **Make a real call:**

   ```bash
   curl -X POST https://wordisbond-api.adrper79.workers.dev/api/voice/call \
     -H "Cookie: wb-session-token=YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"to": "+12025551234", "from": "+1YOUR_TELNYX_NUMBER"}'
   ```

2. **Monitor webhook delivery:**

   ```bash
   npm run api:tail
   ```

3. **Check Telnyx Portal:**
   - Go to Mission Control → Webhooks
   - View delivery logs for `call.transcription` events
   - Verify 200 responses from API

4. **Monitor SSE stream in browser:**
   - Make call from Voice Operations page
   - Click "Live Translation" tab
   - Watch real-time translations appear
