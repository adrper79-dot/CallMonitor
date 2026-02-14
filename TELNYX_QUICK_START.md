# Telnyx Call Control v2 Integration - Quick Start Guide

## Prerequisites

✅ Telnyx account with Call Control application configured
✅ Environment variables set in Cloudflare Workers
✅ Database schema migrated (calls, campaign_calls, dialer_agent_status tables)
✅ Worker deployed to production

## Environment Variables Checklist

Verify these are set in Cloudflare Workers:

```bash
# Check via Wrangler
wrangler secret list --name wordisbond-api

# Required secrets:
TELNYX_API_KEY                 # ✅ Your Telnyx API key
TELNYX_PUBLIC_KEY              # ✅ Ed25519 public key from portal
TELNYX_CONNECTION_ID           # ✅ Call Control app connection ID
TELNYX_NUMBER                  # ✅ Your verified outbound number
API_BASE_URL                   # ✅ https://wordisbond-api.adrper79.workers.dev
NEON_PG_CONN                   # ✅ PostgreSQL connection string
```

## Deployment Steps

### 1. Deploy Workers API
```bash
cd workers
npm run deploy

# Or from root:
npm run api:deploy
```

### 2. Verify Deployment
```bash
# Health check
curl https://wordisbond-api.adrper79.workers.dev/health

# Telnyx config check
curl https://wordisbond-api.adrper79.workers.dev/api/webrtc/debug
```

Expected response:
```json
{
  "configured": true,
  "connectionId": "conn_****",
  "hasApiKey": true,
  "hasNumber": true
}
```

### 3. Configure Telnyx Webhooks

**In Telnyx Portal:**
1. Navigate to Call Control Application
2. Set Webhook URL: `https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx`
3. Enable events:
   - call.initiated
   - call.answered
   - call.hangup
   - call.machine_detection.ended
   - call.recording.saved
   - call.transcription
4. Copy Ed25519 Public Key
5. Save to Cloudflare Secret:
   ```bash
   wrangler secret put TELNYX_PUBLIC_KEY --name wordisbond-api
   # Paste the public key when prompted
   ```

### 4. Test Call Creation

Using curl:
```bash
# Get auth token first (authenticate via API)
export TOKEN="your-bearer-token-here"

# Create test call
curl -X POST https://wordisbond-api.adrper79.workers.dev/api/calls \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+15551234567",
    "enable_amd": true,
    "recording_enabled": true,
    "metadata": {"test": true}
  }'
```

Expected response:
```json
{
  "success": true,
  "call": {
    "id": "uuid-here",
    "status": "initiated",
    "call_control_id": "v3:...",
    "to_number": "+15551234567",
    ...
  },
  "telnyx": {
    "call_control_id": "v3:...",
    "call_session_id": "..."
  }
}
```

### 5. Monitor Webhooks

In one terminal:
```bash
wrangler tail wordisbond-api --format=pretty
```

In another terminal, make a test call and watch for:
- ✅ `call.initiated` webhook received
- ✅ `call.answered` webhook received
- ✅ `call.machine_detection.ended` webhook received
- ✅ `call.hangup` webhook received

## Testing Scenarios

### Scenario 1: Human Answer + Agent Connection
1. Create call to a phone you can answer
2. Answer the call
3. Verify AMD detects "human"
4. Check agent status in `dialer_agent_status` table
5. Verify call bridges to agent

### Scenario 2: Voicemail Detection
1. Create call to a number with voicemail
2. Let it go to voicemail
3. Verify AMD detects "machine"
4. Verify voicemail message plays
5. Call auto-hangs up after message

### Scenario 3: Campaign Integration
1. Create campaign in UI
2. Add targets to `campaign_calls` table
3. Start dialer via campaign controls
4. Verify calls are created automatically
5. Check campaign stats update

## Database Verification

After making test calls:

```sql
-- Check call records
SELECT 
  id,
  status,
  call_control_id,
  amd_status,
  from_number,
  to_number,
  answered_at,
  ended_at,
  hangup_cause
FROM calls
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check audit logs
SELECT 
  action,
  resource_type,
  resource_id,
  new_value->>'amd_result' as amd_result,
  new_value->>'status' as status,
  created_at
FROM audit_logs
WHERE resource_type = 'call'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check agent status (if using dialer)
SELECT 
  user_id,
  status,
  current_call_id,
  last_call_ended_at
FROM dialer_agent_status
WHERE organization_id = 'your-org-id';
```

## Troubleshooting

### Issue: Calls stuck in "initiated"
**Symptoms:** Status never updates to "in_progress"

**Causes:**
- Telnyx webhooks not reaching API
- Webhook signature verification failing
- Firewall blocking Telnyx IPs

**Solutions:**
```bash
# 1. Verify webhook URL in Telnyx portal
# 2. Check webhook signature verification:
wrangler tail wordisbond-api | grep "signature"

# 3. Test webhook manually:
curl -X POST https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d '{"data": {"event_type": "call.initiated", "payload": {}}}'
```

### Issue: AMD Result "not_sure"
**Symptoms:** All calls returning `amd_status = 'not_sure'`

**Causes:**
- Short voicemail greetings
- Background noise
- Poor audio quality

**Solution:**
Adjust AMD config in `calls.ts`:
```typescript
answering_machine_detection_config: {
  after_greeting_silence_millis: 1000,  // Increase
  greeting_duration_millis: 4000,       // Increase
  total_analysis_time_millis: 6000,    // Increase
  initial_silence_millis: 2000,        // Increase
}
```

### Issue: No agents available
**Symptoms:** Calls queue but never connect

**Check agent status:**
```sql
SELECT user_id, status FROM dialer_agent_status
WHERE organization_id = 'your-org-id';
```

**Solution:**
```sql
-- Set agent to available
UPDATE dialer_agent_status
SET status = 'available', updated_at = NOW()
WHERE user_id = 'agent-user-id';
```

### Issue: Webhook signature fails
**Symptoms:** "Invalid signature" in logs

**Solution:**
```bash
# Re-fetch public key from Telnyx portal
# Update Cloudflare secret:
wrangler secret put TELNYX_PUBLIC_KEY --name wordisbond-api
```

## Monitoring Dashboard Queries

### Real-Time Call Stats
```sql
SELECT 
  status,
  COUNT(*) 
FROM calls
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

### AMD Accuracy
```sql
SELECT 
  amd_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM calls
WHERE amd_status IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY amd_status;
```

### Agent Performance
```sql
SELECT 
  u.email,
  das.status,
  das.last_call_ended_at,
  COUNT(c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '1 hour') as calls_last_hour
FROM dialer_agent_status das
LEFT JOIN users u ON u.id = das.user_id
LEFT JOIN calls c ON c.created_by = das.user_id
WHERE das.organization_id = 'your-org-id'
GROUP BY u.email, das.status, das.last_call_ended_at;
```

### Webhook Delivery Health
```bash
# Live webhook monitoring
wrangler tail wordisbond-api --format=pretty | grep "Telnyx webhook"

# Count webhook events by type
psql $DATABASE_URL -c "
SELECT 
  new_value->>'event_type' as event,
  COUNT(*)
FROM audit_logs
WHERE action LIKE '%call%'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY new_value->>'event_type';
"
```

## Performance Benchmarks

**Expected Latencies:**
- Call initiation: < 500ms
- Webhook processing: < 200ms
- AMD detection: 3-5 seconds
- DB update: < 100ms

**Capacity:**
- Concurrent calls: Limited by Telnyx account
- Webhook throughput: 1000+ req/s (Cloudflare Workers)
- DB connections: Managed by Neon autoscaling

## Next Steps

✅ Complete integration testing
✅ Enable for select users (beta)
✅ Monitor AMD accuracy over 24 hours
✅ Tune AMD config based on results
✅ Scale to full production
✅ Document edge cases
✅ Train support team

## Support

**Logs:**
- Cloudflare: `wrangler tail wordisbond-api`
- Telnyx: Portal → Call Control → Webhook Logs
- Database: `psql $DATABASE_URL`

**Escalation:**
- Telnyx Support: support@telnyx.com
- Internal: Check ARCH_DOCS/LESSONS_LEARNED.md

**Documentation:**
- [Telnyx API Docs](https://developers.telnyx.com/docs/api/v2/call-control)
- [Integration Summary](./TELNYX_INTEGRATION_SUMMARY.md)
- [Architecture Docs](./ARCH_DOCS/)
