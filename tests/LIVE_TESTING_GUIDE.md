# Live E2E Testing Guide — Word Is Bond Platform

## Overview

This guide covers comprehensive live end-to-end testing of the voice intelligence platform using **real SignalWire phone numbers** and **production-like environments**.

### Philosophy: No Mocks Unless Necessary

> "no mock testing unless its a test for something that doesn't REQUIRE live testing"

All voice, API, and database interactions use live services to validate the complete user experience.

---

## Test Infrastructure

### Test Users

| User ID | Email | Phone | Role | Password |
|---------|-------|-------|------|----------|
| `test-user-001` | test-user-001@wordis-bond.com | +1 (202) 771-1933 | Owner | TestPass123! |
| `test-user-002` | test-user-002@wordis-bond.com | +1 (203) 298-7277 | Admin | TestPass123! |

**Organization**: `test-org-001` (Test Organization)

### SignalWire Configuration

```env
Project ID: ca1fd3cb-bd2d-4cad-a2b3-589c9fd2c624
Space: blackkryptonians.signalwire.com
Token: PT43c47e95180c2ca50ff967e52be1a860ae41a7c51fec8407
AI Agent: 5786c423-864f-4b39-a77a-595de3b5cfdd
```

**Phone Numbers**:
- Primary (+12027711933): ID `50bd6fb6-85f7-48e6-959f-199b37809707`
- Secondary (+12032987277): ID `ae0e07df-3b2c-4415-8a9d-533d5639b7a5`

---

## Setup Instructions

### 1. Create Test Users

Run the provisioning script to create test users, organization, and phone number configurations:

```powershell
# PowerShell
$env:NEON_PG_CONN = (Get-Content .env.production | Select-String "DATABASE_URL").ToString().Split("=")[1]
psql $env:NEON_PG_CONN -f tests/setup-test-users.sql
```

```bash
# Bash
export NEON_PG_CONN=$(grep DATABASE_URL .env.production | cut -d '=' -f2)
psql $NEON_PG_CONN -f tests/setup-test-users.sql
```

**Verification**:
```sql
SELECT id, email, name FROM users WHERE id LIKE 'test-user-%';
SELECT id, name FROM organizations WHERE id = 'test-org-001';
SELECT phone_number, capabilities FROM phone_numbers WHERE organization_id = 'test-org-001';
```

### 2. Configure Environment

Ensure `tests/.env.production` has all SignalWire credentials (already done):

```env
TEST_ORG_ID=test-org-001
TEST_USER_ID=test-user-001
SIGNALWIRE_PROJECT_ID=ca1fd3cb-bd2d-4cad-a2b3-589c9fd2c624
SIGNALWIRE_SPACE=blackkryptonians.signalwire.com
SIGNALWIRE_TOKEN=PT43c47e95180c2ca50ff967e52be1a860ae41a7c51fec8407
# ... (see tests/.env.production for full config)
```

### 3. Enable Live Voice Tests

```powershell
# Enable LIVE phone calls during tests
$env:ENABLE_LIVE_VOICE_TESTS = "true"
$env:TEST_CALL_DURATION = "30"  # seconds
```

⚠️ **WARNING**: Setting `ENABLE_LIVE_VOICE_TESTS=true` will:
- Make real phone calls via SignalWire
- Incur telephony costs (~$0.01/min)
- Send actual SMS messages
- Create real recordings/transcriptions

**Default**: Live calls are **disabled** (tests run structure validation only).

---

## Test Suites

### Voice E2E Tests (`voice-e2e.test.ts`)

Validates complete call lifecycle with real SignalWire integration:

**Scenarios Covered**:
1. **Outbound Call Journey**:
   - Initiate call from +12027711933 to +12032987277
   - Verify call appears in history
   - Check recording/transcription enablement

2. **Bridged Call Flow**:
   - Create bridge between two phone numbers
   - Verify both call legs (customer + agent)
   - Confirm multi-user visibility

3. **Post-Call Artifacts**:
   - Recording availability check
   - Transcription generation (AssemblyAI webhook)
   - AI summary creation (GPT-4 analysis)

4. **Outcome Tracking**:
   - Declare call outcome (agreed/disputed/unclear)
   - Add notes to call
   - Retrieve complete call details

5. **Analytics Dashboard**:
   - KPI calculations (duration, completion rate)
   - Report generation (JSON/CSV export)

**Run Tests**:
```powershell
# Structure validation only (no live calls)
npm run test:production -- voice-e2e

# WITH live SignalWire calls
$env:ENABLE_LIVE_VOICE_TESTS = "true"
npm run test:production -- voice-e2e
```

### Expected Test Flow

```
📞 Voice E2E Tests - Live SignalWire Integration
   Primary Number: +12027711933
   Secondary Number: +12032987277
   Live Calls: ENABLED
   Organization: test-org-001

✓ User can initiate outbound call to test number
  📞 Call initiated: CA1234567890abcdef
     From: +12027711933
     To: +12032987277

✓ Call appears in user call history
  ✅ Call found in history (status: in-progress)

⏳ Waiting for call to end...

✓ Recording becomes available after call ends
  🎙️  Recording available:
     URL: https://api.signalwire.com/api/laml/2010-04-01/.../Recordings/RE...
     Duration: 32s
     Status: completed

✓ Transcription is generated from recording
  📝 Transcription available:
     Length: 1234 chars
     Confidence: 0.87
     Status: completed

✓ AI summary is generated from transcription
  🤖 AI Summary available:
     Customer called regarding product inquiry. Agent provided...
     Confidence: high
     Sentiment: positive

✓ User can declare call outcome
  ✅ Outcome declared: agreed
     Confidence: high

✓ Call metrics are updated in analytics
  📊 KPIs:
     Total calls: 42
     Avg duration: 145s
     Completion rate: 89%
```

---

## Test Scenarios by User Journey

### Agent Making Outbound Call

1. **Login** → `/api/auth/login` with test-user-001 credentials
2. **Select Phone** → Use +12027711933 (primary)
3. **Dial** → POST `/api/calls/start` to +12032987277
4. **Monitor** → WebSocket connection for real-time status
5. **Record** → Recording starts automatically (enabled: true)
6. **End Call** → POST `/api/calls/{id}/hangup`
7. **Review** → GET `/api/calls/{id}` with recording URL
8. **Transcribe** → AssemblyAI webhook processes audio
9. **Summarize** → AI generates summary from transcript
10. **Declare Outcome** → POST `/api/calls/{id}/outcomes`

### Customer Receiving Bridge Call

1. **Inbound Ring** → SignalWire dials +12032987277
2. **Answer** → Customer picks up
3. **Bridge Established** → SignalWire conference (customer + agent)
4. **Dual Recording** → Both legs recorded separately
5. **Call Transfer** → (Optional) Agent transfers to supervisor
6. **Post-Call** → Transcription + AI summary for both legs

### Multi-User Collaboration

1. **User 1** initiates bridge call
2. **User 2** sees call in their dashboard (agent leg)
3. **User 2** adds notes during call
4. **Call Ends** → Both users see full history
5. **Shared Analytics** → Organization-level KPIs updated

---

## Debugging Live Tests

### View SignalWire Logs

```powershell
# Check recent calls in SignalWire dashboard
Start-Process "https://blackkryptonians.signalwire.com/voice/calls"
```

### Database Queries

```sql
-- Recent calls from test org
SELECT id, call_sid, direction, status, duration, created_at 
FROM calls 
WHERE organization_id = 'test-org-001' 
ORDER BY created_at DESC 
LIMIT 10;

-- Call with all artifacts
SELECT 
  c.id,
  c.call_sid,
  c.status,
  cr.recording_url,
  t.text AS transcript,
  ai.summary_text
FROM calls c
LEFT JOIN call_recordings cr ON cr.call_id = c.id
LEFT JOIN transcriptions t ON t.call_id = c.id
LEFT JOIN ai_summaries ai ON ai.call_id = c.id
WHERE c.id = 'YOUR_CALL_ID';

-- Bridge calls
SELECT 
  b.id AS bridge_id,
  c1.call_sid AS customer_sid,
  c2.call_sid AS agent_sid,
  b.status
FROM bridges b
JOIN calls c1 ON c1.bridge_id = b.id AND c1.leg_type = 'customer'
JOIN calls c2 ON c2.bridge_id = b.id AND c2.leg_type = 'agent'
WHERE b.organization_id = 'test-org-001';
```

### API Health Check

```powershell
# Test API connectivity
$headers = @{
  "Authorization" = "Bearer YOUR_SESSION_TOKEN"
}
Invoke-RestMethod -Uri "https://wordisbond-api.adrper79.workers.dev/api/health" -Headers $headers
```

---

## Cost Management

### Telephony Costs (SignalWire)

- **Outbound calls**: ~$0.0085/min (US)
- **Inbound calls**: ~$0.0085/min + $1.00/mo per number
- **SMS**: ~$0.0075/message
- **Recording storage**: ~$0.0025/min

**Estimated Test Suite Cost**: ~$0.50/run (assuming 30-second test calls)

### AI Processing Costs

- **Transcription** (AssemblyAI): ~$0.00025/second = $0.015/min
- **AI Summary** (OpenAI GPT-4): ~$0.03/1K tokens ≈ $0.05/call
- **Translation** (Groq Mixtral): Minimal (~$0.001/call)

**Estimated AI Cost**: ~$0.07/call

### Total E2E Test Cost

**Per Full Test Run**: ~$0.60 (2-3 calls with full processing)

💡 **Tip**: Keep `ENABLE_LIVE_VOICE_TESTS=false` during development, enable only for final validation.

---

## Cleanup After Testing

```sql
-- Soft-delete test calls
UPDATE calls 
SET is_deleted = true, deleted_at = NOW() 
WHERE organization_id = 'test-org-001';

-- Remove test recordings (optional)
DELETE FROM call_recordings 
WHERE call_id IN (
  SELECT id FROM calls WHERE organization_id = 'test-org-001'
);

-- Clear transcriptions
DELETE FROM transcriptions 
WHERE call_id IN (
  SELECT id FROM calls WHERE organization_id = 'test-org-001'
);

-- Clear AI summaries
DELETE FROM ai_summaries 
WHERE call_id IN (
  SELECT id FROM calls WHERE organization_id = 'test-org-001'
);
```

⚠️ **DO NOT DELETE**:
- Test users (`test-user-001`, `test-user-002`)
- Test organization (`test-org-001`)
- Phone number configurations

These are reusable across test runs.

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: E2E Voice Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1' # Weekly on Monday 6am UTC

jobs:
  voice-e2e:
    runs-on: ubuntu-latest
    env:
      ENABLE_LIVE_VOICE_TESTS: true
      NEON_PG_CONN: ${{ secrets.NEON_DATABASE_URL }}
      SIGNALWIRE_TOKEN: ${{ secrets.SIGNALWIRE_TOKEN }}
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:production -- voice-e2e
```

---

## What Else Can We Confirm?

### Additional Test Scenarios

1. **Compliance & Recording Consent**:
   - Voice prompt: "This call may be recorded..."
   - User consent tracking in DB
   - Automatic recording disablement by region

2. **Multi-Language Support**:
   - Spanish caller → English transcript (Groq translation)
   - French agent → English summary
   - RTL language rendering (Arabic, Hebrew)

3. **Call Quality Metrics**:
   - Latency measurement (dial → answer)
   - Audio quality score (MOS)
   - Packet loss detection

4. **Error Recovery**:
   - Network drop → automatic reconnect
   - Failed transcription → retry with fallback provider
   - Payment failure → graceful degradation

5. **Security Validation**:
   - Session token expiry → 401 rejection
   - Cross-org call access → 403 forbidden
   - SQL injection attempts → parameterized query protection

6. **Performance Under Load**:
   - 10 concurrent calls per user
   - 100 calls/minute organization limit
   - Rate limiting enforcement (429 responses)

7. **Webhook Reliability**:
   - SignalWire status callbacks
   - AssemblyAI transcription completion
   - Idempotency key validation

8. **Data Integrity**:
   - Audit logs for all mutations
   - Call duration accuracy (billed vs actual)
   - Timezone handling (UTC storage, local display)

---

## Success Criteria

✅ **Functional Completeness**:
- [ ] Outbound calls initiate successfully
- [ ] Bridge calls connect both parties
- [ ] Recordings are captured and accessible
- [ ] Transcriptions are accurate (>80% confidence)
- [ ] AI summaries are relevant
- [ ] Call outcomes are declarable
- [ ] Analytics KPIs update correctly

✅ **User Experience**:
- [ ] API response times <500ms (p95)
- [ ] Call setup time <3 seconds
- [ ] No dropped calls during test
- [ ] UI reflects real-time status
- [ ] Notifications are timely

✅ **Data Integrity**:
- [ ] No duplicate call records
- [ ] Foreign key constraints enforced
- [ ] Soft-delete preserves history
- [ ] Audit logs capture all actions

✅ **Security**:
- [ ] Authentication required for all endpoints
- [ ] Multi-tenant isolation verified
- [ ] Rate limiting prevents abuse
- [ ] Sensitive data encrypted at rest

---

## Troubleshooting

### "Session token not found"

```powershell
# Recreate session
$session = Invoke-RestMethod -Uri "https://wordisbond-api.adrper79.workers.dev/api/auth/login" -Method POST -Body (@{
  email = "test-user-001@wordis-bond.com"
  password = "TestPass123!"
} | ConvertTo-Json) -ContentType "application/json"

$env:TEST_SESSION_TOKEN = $session.sessionToken
```

### "Phone number not provisioned"

Check SignalWire dashboard → ensure +12027711933 and +12032987277 are active and assigned to project `ca1fd3cb-bd2d-4cad-a2b3-589c9fd2c624`.

### "Transcription never completes"

Verify AssemblyAI webhook URL is configured in Workers:
```
https://wordisbond-api.adrper79.workers.dev/webhooks/assemblyai
```

Check Workers logs:
```powershell
npx wrangler tail
```

---

## Next Steps

1. **Expand Test Coverage**: Add scenarios for call transfers, hold music, voicemail
2. **Load Testing**: Use k6 to simulate 100 concurrent calls
3. **Chaos Engineering**: Introduce network failures, database timeouts
4. **Accessibility Testing**: Screen reader compatibility, keyboard navigation
5. **Mobile App E2E**: Extend to React Native voice calling

---

**Last Updated**: 2026-02-11  
**Test Users Valid Until**: Never (permanent test accounts)  
**SignalWire Credit Balance**: Check dashboard before large test runs
