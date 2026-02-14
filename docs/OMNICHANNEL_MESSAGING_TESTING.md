# Omnichannel Messaging — Testing Guide

**Feature:** SMS Inbound Processing  
**Version:** v4.30  
**Date:** February 14, 2026

## Prerequisites

Before testing, ensure:

1. ✅ Migration applied: `migrations/2026-02-14-omnichannel-messaging.sql`
2. ✅ Environment variables set:
   - `TELNYX_API_KEY` — Your Telnyx API key
   - `TELNYX_PUBLIC_KEY` — Your Telnyx public key (Ed25519)
   - `TELNYX_NUMBER` — Your Telnyx phone number (E.164 format)
3. ✅ Workers API deployed: `npm run api:deploy`
4. ✅ Telnyx webhook configured:
   - URL: `https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx`
   - Events: `message.received`, `message.sent`, `message.delivered`, `message.failed`

## Test Suite

### Test 1: Basic Inbound SMS (Account Match)

**Objective:** Verify inbound SMS links to existing account

**Setup:**
1. Create test account in Collections CRM:
   ```sql
   INSERT INTO collection_accounts (
     id, organization_id, name, balance_due, primary_phone, created_by
   ) VALUES (
     gen_random_uuid(), 
     '<your-org-id>', 
     'Test Customer', 
     100.00, 
     '+15551234567',  -- Replace with your test number
     '<your-user-id>'
   );
   ```

**Test Steps:**
1. Send SMS from `+15551234567` to your Telnyx number
2. Message text: "Hello, I have a question about my account"

**Expected Results:**
- ✅ Webhook received (status 200)
- ✅ Message stored in `messages` table:
  ```sql
  SELECT * FROM messages 
  WHERE from_number = '+15551234567' 
  ORDER BY created_at DESC LIMIT 1;
  ```
- ✅ `account_id` matches test account
- ✅ `direction` = 'inbound', `channel` = 'sms', `status` = 'received'
- ✅ `last_contact_at` updated on account:
  ```sql
  SELECT last_contact_at FROM collection_accounts WHERE id = '<test-account-id>';
  ```
- ✅ Audit log created:
  ```sql
  SELECT * FROM audit_logs 
  WHERE action = 'message:received' 
  ORDER BY created_at DESC LIMIT 1;
  ```

---

### Test 2: Opt-Out Flow (STOP Keyword)

**Objective:** Verify TCPA opt-out compliance

**Setup:**
- Use same test account from Test 1
- Verify `sms_consent` is currently `true`

**Test Steps:**
1. Send SMS from `+15551234567` to your Telnyx number
2. Message text: "STOP"

**Expected Results:**
- ✅ Webhook received (status 200)
- ✅ `sms_consent` set to `false`:
  ```sql
  SELECT sms_consent FROM collection_accounts WHERE id = '<test-account-id>';
  ```
- ✅ Auto-reply SMS received on your phone:
  - Text: "You have been unsubscribed from SMS messages. Reply START to opt back in."
  - From: Your Telnyx number
- ✅ Message stored in `messages` table
- ✅ Audit logs created:
  - `message:received` (inbound STOP)
  - `message:opt_out_requested` (consent revoked)
  - `message:auto_reply_sent` (confirmation sent)
  ```sql
  SELECT action, new_value FROM audit_logs 
  WHERE resource_id = '<test-account-id>' 
  ORDER BY created_at DESC LIMIT 3;
  ```
- ✅ `opt_out_requests` entry created:
  ```sql
  SELECT * FROM opt_out_requests 
  WHERE account_id = '<test-account-id>' 
  ORDER BY created_at DESC LIMIT 1;
  ```

---

### Test 3: Opt-In Flow (START Keyword)

**Objective:** Verify opt-in re-subscription

**Setup:**
- Use opted-out account from Test 2
- Verify `sms_consent` is currently `false`

**Test Steps:**
1. Send SMS from `+15551234567` to your Telnyx number
2. Message text: "START"

**Expected Results:**
- ✅ Webhook received (status 200)
- ✅ `sms_consent` set to `true`:
  ```sql
  SELECT sms_consent FROM collection_accounts WHERE id = '<test-account-id>';
  ```
- ✅ Auto-reply SMS received:
  - Text: "You have been subscribed to SMS updates. Reply STOP to unsubscribe."
- ✅ Audit logs:
  - `message:received` (inbound START)
  - `message:opt_in_confirmed` (consent granted)
  - `message:auto_reply_sent`

---

### Test 4: Orphaned Message (Unknown Number)

**Objective:** Verify graceful handling of unknown senders

**Test Steps:**
1. Send SMS from unknown number (not in `collection_accounts`) to your Telnyx number
2. Message text: "Who is this?"

**Expected Results:**
- ✅ Webhook received (status 200)
- ✅ Message stored in `messages` table:
  ```sql
  SELECT * FROM messages 
  WHERE from_number = '+15559999999'  -- Unknown number
  ORDER BY created_at DESC LIMIT 1;
  ```
- ✅ `account_id` is `NULL` (orphaned message)
- ✅ `organization_id` resolved via DID lookup (if configured)
- ✅ Warning logged: "No account match for inbound SMS (orphaned message)"
- ✅ No crash or error response

---

### Test 5: Signature Verification (Security Test)

**Objective:** Verify webhook authentication

**Test Steps:**
1. Send POST request to `/webhooks/telnyx` with invalid signature:
   ```bash
   curl -X POST https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx \
     -H "Content-Type: application/json" \
     -H "telnyx-timestamp: 1234567890" \
     -H "telnyx-signature-ed25519: invalid_signature" \
     -d '{
       "data": {
         "event_type": "message.received",
         "payload": {
           "id": "test",
           "from": {"phone_number": "+15551234567"},
           "to": [{"phone_number": "+15559876543"}],
           "text": "Test"
         }
       }
     }'
   ```

**Expected Results:**
- ✅ HTTP 401 Unauthorized
- ✅ Response body: `{"error": "Invalid signature"}`
- ✅ No message stored in database
- ✅ Warning logged: "Invalid Telnyx webhook signature"

---

### Test 6: Malformed Webhook Payload

**Objective:** Verify robust error handling

**Test Steps:**
1. Send POST request with invalid JSON:
   ```bash
   curl -X POST https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx \
     -H "Content-Type: application/json" \
     -d '{"invalid": json}'
   ```

**Expected Results:**
- ✅ HTTP 400 Bad Request
- ✅ Response body: `{"error": "Invalid JSON body"}`
- ✅ No database writes
- ✅ Warning logged

---

### Test 7: Outbound SMS Status Updates

**Objective:** Verify message.sent and message.delivered webhooks

**Setup:**
1. Send outbound SMS via API:
   ```bash
   curl -X POST https://wordisbond-api.adrper79.workers.dev/api/messages/send \
     -H "Authorization: Bearer <your-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "+15551234567",
       "body": "Test outbound SMS",
       "type": "notification"
     }'
   ```
2. Note the Telnyx `message_id` from response

**Test Steps:**
1. Wait for Telnyx to fire `message.sent` webhook
2. Wait for Telnyx to fire `message.delivered` webhook

**Expected Results:**
- ✅ `message.sent` webhook updates message status:
  ```sql
  SELECT status, sent_at FROM messages 
  WHERE external_message_id = '<telnyx-msg-id>';
  ```
  - `status` = 'sent'
  - `sent_at` has timestamp

- ✅ `message.delivered` webhook updates status:
  ```sql
  SELECT status, delivered_at FROM messages 
  WHERE external_message_id = '<telnyx-msg-id>';
  ```
  - `status` = 'delivered'
  - `delivered_at` has timestamp

- ✅ Audit logs for both events

---

### Test 8: Failed Message Delivery

**Objective:** Verify message.failed webhook handling

**Setup:**
1. Send SMS to invalid number (e.g., +1999999999)
2. Note the `message_id`

**Test Steps:**
1. Wait for Telnyx to fire `message.failed` webhook

**Expected Results:**
- ✅ Message status updated to 'failed':
  ```sql
  SELECT status, error_message FROM messages 
  WHERE external_message_id = '<telnyx-msg-id>';
  ```
- ✅ `error_message` populated with Telnyx error details
- ✅ Audit log: `message:delivery_failed`

---

### Test 9: Multi-Tenant Isolation

**Objective:** Verify org boundary enforcement

**Setup:**
1. Create two test orgs: Org A and Org B
2. Create account in Org A with phone `+15551111111`
3. Create account in Org B with phone `+15552222222`

**Test Steps:**
1. Send SMS from `+15551111111` to Telnyx number
2. Verify message linked to Org A account only
3. Query Org B database:
   ```sql
   SELECT * FROM messages 
   WHERE organization_id = '<org-b-id>' 
   AND from_number = '+15551111111';
   ```

**Expected Results:**
- ✅ No results (cross-tenant leak prevented)
- ✅ Message visible only in Org A:
  ```sql
  SELECT * FROM messages 
  WHERE organization_id = '<org-a-id>' 
  AND from_number = '+15551111111';
  ```

---

## Performance Testing

### Load Test: Webhook Throughput

**Tool:** Apache Bench or Artillery

**Test:**
```bash
ab -n 1000 -c 10 -T 'application/json' \
  -H "telnyx-timestamp: $(date +%s)" \
  -H "telnyx-signature-ed25519: <valid-signature>" \
  -p webhook_payload.json \
  https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx
```

**Metrics:**
- ✅ Requests/sec > 100
- ✅ p95 latency < 500ms
- ✅ Error rate < 0.1%
- ✅ No database connection exhaustion

---

## Monitoring Checklist

### Cloudflare Logs
```bash
wrangler tail wordisbond-api --format=pretty
```

**Watch for:**
- ✅ "Inbound SMS received" (successful processing)
- ⚠️ "Invalid Telnyx webhook signature" (security issue)
- ⚠️ "No account match for inbound SMS" (orphaned messages)
- ❌ "Failed to store inbound SMS" (schema issue)

### Database Queries

**Message Volume:**
```sql
SELECT 
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
  COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM messages
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Opt-Out Rate:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE sms_consent = false) * 100.0 / COUNT(*) as opt_out_rate_pct
FROM collection_accounts
WHERE organization_id = '<your-org-id>';
```

**Orphaned Messages:**
```sql
SELECT COUNT(*) as orphaned_count
FROM messages
WHERE account_id IS NULL
AND created_at > NOW() - INTERVAL '7 days';
```

---

## Troubleshooting

### Issue: Webhooks not received
**Check:**
1. Telnyx webhook URL configured correctly
2. Firewall/security rules allow Telnyx IPs
3. Workers deployed successfully: `wrangler deployments list`

### Issue: Signature verification failing
**Check:**
1. `TELNYX_PUBLIC_KEY` matches Telnyx portal value
2. Key is base64-encoded (not raw bytes)
3. Timestamp not stale (< 5 minutes old)

### Issue: Messages not linking to accounts
**Check:**
1. Phone numbers in E.164 format: `+15551234567` (not `555-123-4567`)
2. `primary_phone` or `secondary_phone` matches exactly
3. Account not soft-deleted: `is_deleted = false`

### Issue: Auto-replies not sending
**Check:**
1. `TELNYX_API_KEY` environment variable set
2. Telnyx account has sufficient balance
3. Sending number is verified/approved in Telnyx
4. Rate limits not exceeded

---

## Cleanup (After Testing)

```sql
-- Delete test messages
DELETE FROM messages WHERE account_id = '<test-account-id>';

-- Delete test opt-out requests
DELETE FROM opt_out_requests WHERE account_id = '<test-account-id>';

-- Delete test audit logs
DELETE FROM audit_logs WHERE resource_id = '<test-account-id>';

-- Delete test account
DELETE FROM collection_accounts WHERE id = '<test-account-id>';
```

---

**Test Status:** ⏳ Pending Execution  
**Last Updated:** February 14, 2026  
**Next Review:** Post-Production Deployment
