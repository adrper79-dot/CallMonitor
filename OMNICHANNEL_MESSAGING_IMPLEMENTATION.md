# Omnichannel Messaging — Implementation Summary

**Feature:** SMS Inbound Processing for Omnichannel Communications  
**Version:** v4.30  
**Date:** February 14, 2026  
**Status:** ✅ IMPLEMENTED

## Overview

Implemented comprehensive SMS inbound processing via Telnyx webhooks with opt-out/opt-in management, account linking, and auto-reply support. This enables full omnichannel communications alongside existing voice and email capabilities.

## Files Modified

### 1. **workers/src/lib/audit.ts**
- **Added 7 new audit actions:**
  - `MESSAGE_RECEIVED` — Inbound SMS received
  - `MESSAGE_SENT` — Outbound SMS sent confirmation
  - `MESSAGE_DELIVERED` — SMS delivered to recipient
  - `MESSAGE_DELIVERY_FAILED` — SMS delivery failed
  - `OPT_OUT_REQUESTED` — Customer sent STOP keyword
  - `OPT_IN_CONFIRMED` — Customer sent START keyword
  - `AUTO_REPLY_SENT` — Automated reply sent

### 2. **workers/src/routes/webhooks.ts**
- **Added 4 new Telnyx webhook event handlers:**
  - `message.received` → `handleMessageReceived()`
  - `message.sent` → `handleMessageSent()` 
  - `message.delivered` → `handleMessageDelivered()`
  - `message.failed` → `handleMessageFailed()`

- **Implemented opt-out/opt-in processing:**
  - Detects keywords: STOP, UNSUBSCRIBE, QUIT, CANCEL, END, OPTOUT, REMOVE
  - Detects opt-in keywords: START, UNSTOP, YES, SUBSCRIBE
  - Updates `collection_accounts.sms_consent` field
  - Sends confirmation auto-replies
  - Creates audit trail

- **Account linking logic:**
  - Matches inbound SMS to accounts via phone number (E.164 normalized)
  - Links messages to active campaigns
  - Updates `last_contact_at` timestamp
  - Falls back to DID-based org lookup for orphaned messages

- **Auto-reply functionality:**
  - Opt-out confirmation: "You have been unsubscribed..."
  - Opt-in confirmation: "You have been subscribed..."
  - Uses Telnyx Messaging API v2

- **Error handling:**
  - Graceful degradation if messages table doesn't exist
  - Invalid phone formats logged but don't crash
  - Webhook signature verification (Ed25519)
  - Multi-tenant isolation enforced
  - Fire-and-forget audit logging

### 3. **migrations/2026-02-14-omnichannel-messaging.sql** (NEW)
Complete schema for omnichannel messaging:

#### Tables Created:
1. **messages** — Universal communications log
   - Stores SMS, email, and call summary messages
   - Links to accounts and campaigns
   - Tracks delivery status (pending → sent → delivered/failed)
   - Stores external message IDs for vendor tracking

2. **opt_out_requests** — Compliance audit trail
   - Tracks all opt-out and opt-in requests
   - Links to originating message
   - Supports manual opt-outs (not just keyword-based)
   - Queryable for compliance reporting

3. **auto_reply_templates** — Customizable responses
   - Org-specific auto-reply messages
   - Supports SMS and email channels
   - Trigger types: opt_out, opt_in, business_hours, generic
   - Optional send delays

#### Column Additions to collection_accounts:
- `sms_consent BOOLEAN DEFAULT true` — TCPA compliance flag
- `email_consent BOOLEAN DEFAULT true` — CAN-SPAM compliance flag
- `last_contact_at TIMESTAMPTZ` — Last inbound/outbound contact

## Architecture Compliance

✅ **Database Connection Order:** Uses `getDb(c.env)` with correct precedence  
✅ **Multi-Tenant Isolation:** All queries include `organization_id` WHERE clause  
✅ **Parameterized Queries:** All SQL uses `$1, $2, $3` (no string interpolation)  
✅ **Audit Logging:** Uses `old_value`/`new_value` (not before/after)  
✅ **Error Handling:** Graceful degradation, DLQ for webhook failures  
✅ **Webhook Security:** Ed25519 signature verification (existing pattern)  
✅ **Fire-and-Forget Logging:** Non-blocking audit writes with KV fallback  

## Environment Variables Required

```bash
# Existing (already configured)
TELNYX_API_KEY=KEY...                    # For sending SMS
TELNYX_PUBLIC_KEY=ABC123...              # For webhook signature verification

# Optional (for dedicated messaging profile)
TELNYX_MESSAGING_PROFILE_ID=...          # If using separate profile for SMS
```

## API Endpoints (No Changes)
The existing webhook endpoint handles all events:
```
POST /api/webhooks/telnyx
```

No new public API routes were added (webhooks are inbound only).

## Testing Recommendations

### 1. **Webhook Integration Tests**
```bash
# Test inbound SMS webhook
curl -X POST https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -H "telnyx-timestamp: $(date +%s)" \
  -H "telnyx-signature-ed25519: <signature>" \
  -d '{
    "data": {
      "event_type": "message.received",
      "payload": {
        "id": "msg_123",
        "from": { "phone_number": "+15551234567" },
        "to": [{ "phone_number": "+15559876543" }],
        "text": "Hello from customer",
        "received_at": "2026-02-14T12:00:00Z"
      }
    }
  }'
```

### 2. **Opt-Out Flow Test**
1. Send inbound SMS with text "STOP" to a known account
2. Verify `collection_accounts.sms_consent = false`
3. Verify auto-reply sent: "You have been unsubscribed..."
4. Verify audit log entries created

### 3. **Opt-In Flow Test**
1. Send inbound SMS with text "START" from opted-out number
2. Verify `collection_accounts.sms_consent = true`
3. Verify auto-reply sent: "You have been subscribed..."
4. Verify audit log entries created

### 4. **Account Linking Test**
1. Send inbound SMS from known `primary_phone`
2. Verify message linked to correct account_id
3. Verify `last_contact_at` updated
4. Verify message stored in messages table

### 5. **Orphaned Message Test**
1. Send inbound SMS from unknown number to known DID
2. Verify message stored with organization_id but account_id = null
3. Verify warning logged
4. Verify no crash

### 6. **Error Handling Tests**
- Invalid Telnyx signature → 401 Unauthorized
- Malformed JSON → 400 Bad Request
- Messages table doesn't exist → Graceful degradation (logged warning)
- Database connection failure → DLQ storage

## Database Migration Steps

**IMPORTANT:** Run migration BEFORE deploying code changes.

```bash
# 1. Review migration file
cat migrations/2026-02-14-omnichannel-messaging.sql

# 2. Apply to Neon database
psql $NEON_DATABASE_URL -f migrations/2026-02-14-omnichannel-messaging.sql

# 3. Verify tables created
psql $NEON_DATABASE_URL -c "\\dt messages"
psql $NEON_DATABASE_URL -c "\\dt opt_out_requests"
psql $NEON_DATABASE_URL -c "\\dt auto_reply_templates"

# 4. Verify collection_accounts columns added
psql $NEON_DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'collection_accounts' AND column_name IN ('sms_consent', 'email_consent', 'last_contact_at');"
```

## Deployment Checklist

- [ ] Review all code changes
- [ ] Run migration on Neon database
- [ ] Verify environment variables set (TELNYX_API_KEY, TELNYX_PUBLIC_KEY)
- [ ] Deploy Workers API: `npm run api:deploy`
- [ ] Run health check: `npm run health-check`
- [ ] Configure Telnyx webhook URL in Telnyx portal:
  - URL: `https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx`
  - Events: `message.received`, `message.sent`, `message.delivered`, `message.failed`
  - Public key: Same as used for call webhooks
- [ ] Test inbound SMS to a known number
- [ ] Test opt-out flow (send "STOP")
- [ ] Test opt-in flow (send "START")
- [ ] Verify audit logs created
- [ ] Monitor Cloudflare logs for any errors

## Success Metrics

✅ **Webhook Processing:**
- POST /webhooks/telnyx handles `message.*` events
- Signature verification passes
- Zero 500 errors on valid webhooks

✅ **Message Storage:**
- Inbound SMS stored in messages table
- Messages linked to accounts by phone number
- Organization isolation maintained

✅ **Opt-Out Compliance:**
- STOP keyword disables `sms_consent`
- Auto-reply confirmation sent
- Audit trail created

✅ **Opt-In Processing:**
- START keyword enables `sms_consent`
- Auto-reply confirmation sent
- Audit trail created

✅ **Error Resilience:**
- Invalid signatures rejected (401)
- Malformed payloads logged (400)
- Database errors don't crash webhook handler
- Messages table missing → graceful degradation

## Next Steps (Future Enhancements)

1. **Frontend UI Components:**
   - Message timeline view in account detail page
   - Opt-out status indicator
   - Manual opt-out button (for phone/email opt-outs)
   - Message composer (send SMS from UI)

2. **Advanced Auto-Replies:**
   - Business hours detection
   - Custom templates per organization
   - Template variables ({{name}}, {{balance}}, etc.)
   - A/B testing for auto-replies

3. **Analytics Dashboard:**
   - SMS delivery metrics
   - Opt-out rate tracking
   - Response rate analysis
   - Cost tracking (Telnyx usage)

4. **Email Integration:**
   - Extend handlers to support `email.*` events from Resend
   - Unified inbox (SMS + Email + Call notes)
   - Email templates

5. **Two-Way Conversations:**
   - Agent inbox for responding to inbound SMS
   - Conversation threading (group by account)
   - Read receipts
   - Typing indicators

## Known Limitations

1. **Auto-Reply Customization:**
   - Currently hardcoded messages
   - Future: Use `auto_reply_templates` table

2. **Business Hours:**
   - No business hours detection yet
   - All inbound messages processed immediately

3. **Phone Number Normalization:**
   - Basic E.164 normalization (assumes US +1 if 10 digits)
   - Future: Use libphonenumber for international support

4. **DNC List Integration:**
   - Opt-outs update `sms_consent` but don't sync to external DNC lists
   - Future: Sync to Telnyx's DNC list

5. **Rate Limiting:**
   - Webhook rate limits applied per IP
   - No per-account SMS send rate limits yet

## Support & Troubleshooting

**Issue:** Inbound SMS not appearing in messages table  
**Solution:** Check messages table exists, verify webhook URL configured in Telnyx

**Issue:** Auto-replies not sending  
**Solution:** Verify TELNYX_API_KEY set, check Telnyx account balance, check logs

**Issue:** Messages not linking to accounts  
**Solution:** Verify phone numbers in E.164 format, check primary_phone/secondary_phone match

**Issue:** Webhook signature verification failing  
**Solution:** Verify TELNYX_PUBLIC_KEY matches Telnyx portal, check timestamp not stale

**Issue:** Orphaned messages (no account_id)  
**Solution:** Expected for unknown numbers — review DID mapping in inbound_phone_numbers

## References

- **Telnyx Messaging API:** https://developers.telnyx.com/docs/api/v2/messaging
- **Telnyx Webhooks:** https://developers.telnyx.com/docs/v2/messaging/webhooks
- **TCPA Compliance:** https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts
- **CAN-SPAM Act:** https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

---

**Implementation by:** GitHub Copilot (Claude Sonnet 4.5)  
**Date:** February 14, 2026  
**Reviewed:** Pending  
**Status:** ✅ Ready for Testing
