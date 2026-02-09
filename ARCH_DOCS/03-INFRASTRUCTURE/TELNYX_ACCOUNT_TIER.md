# Telnyx Account Configuration

**Last Updated:** 2026-02-09  
**Responsible:** Platform Engineering

---

## Account Overview

**Account Type:** ⚠️ **TRIAL / DEVELOPER TIER** (to be confirmed)  
**Account ID:** _(retrieve from Telnyx Portal > Account Settings)_  
**Signup Date:** _(to be documented)_

---

## Current Configuration

### Credentials

- **API Key:** Stored in Cloudflare Workers secret `TELNYX_API_KEY`
- **Phone Number:** `+13048534096` (outbound caller ID)
- **Call Control Application ID:** `2887320532385006766` (for bridge calls)
- **Credential Connection ID:** `28873192...` (for WebRTC browser calls)

### Webhook Endpoints

- **Primary:** `https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx`
- **Configured Events:**
  - `call.answered`
  - `call.hangup`
  - `call.recording.saved`
  - `call.transcription` (if enabled)

---

## Rate Limits & Quotas

### 🚨 Known Limits (February 2026)

**Issue Encountered:** `"You have exceeded the number of dials per hour allowed for your account."`

- **Error Type:** HTTP 429 (rate limit)
- **First Occurrence:** 2026-02-09 during bridge call testing
- **Account Behavior:** Blocks call attempts when hourly dial limit exceeded

### Suspected Limits (Trial Tier)

**⚠️ UNCONFIRMED - Requires Telnyx Support Ticket**

- **Outbound Calls:** ~10-20 dials per hour (typical trial limit)
- **Concurrent Calls:** 1-5 simultaneous active calls
- **API Rate Limit:** Unknown (general Telnyx API: 100 req/sec)
- **Daily Call Volume:** Unknown

### Production Tier Estimates (Pay-As-You-Go)

**For Production Launch:**

- **Outbound Calls:** Unlimited (pay per minute)
- **Concurrent Calls:** 10-100+ (tier-dependent)
- **API Rate Limit:** 100+ req/sec
- **Cost:** ~$0.01-$0.02 per minute + $0.50-$2.00/month per phone number

---

## Upgrade Path

### When to Upgrade

**Immediate Actions Required:**

1. ✅ **Contact Telnyx Support** to confirm current tier and limits
2. ✅ **Upgrade to Pay-As-You-Go** if still on trial
3. ✅ **Add payment method** to avoid service interruptions

### Trigger Conditions

Upgrade if any of the following occur:

- ✅ Receiving `HTTP 429` rate limit errors (happening now)
- ⚠️ Call volume exceeds 100 calls/day
- ⚠️ Need for concurrent calls (>2 simultaneous)
- ⚠️ Production launch (real customer traffic)

### Upgrade Process

1. **Log into Telnyx Portal:** https://portal.telnyx.com
2. **Navigate to:** Billing > Upgrade Account
3. **Add Payment Method:** Credit card or ACH
4. **Select Tier:** Pay-As-You-Go (recommended for MVP)
5. **Enable Features:**
   - Call recording
   - Transcription (if needed)
   - Call Control API
6. **Verify Limits Updated:** Test a series of calls to confirm rate limits lifted

---

## Monitoring & Alerts

### Current Implementation

**✅ Code-Level Handling (as of 2026-02-09):**

- `workers/src/routes/voice.ts` — Detects `HTTP 429` and returns user-friendly error
- `workers/src/routes/webrtc.ts` — Detects `HTTP 429` and returns user-friendly error
- **Error Response:**
  ```json
  {
    "error": "Call service rate limit exceeded. Please try again in 1 minute.",
    "code": "TELNYX_RATE_LIMIT",
    "retry_after": 60
  }
  ```

### Missing Monitoring (Roadmap)

**TODO:**

- [ ] Daily cron job to check Telnyx account balance via `/v2/account/balance`
- [ ] Alert if balance < $50
- [ ] Weekly usage report (call volume, costs, concurrent peak)
- [ ] Slack/email notification if `HTTP 429` or `HTTP 402` detected

---

## Emergency Procedures

### If Rate Limit Errors Occur

1. **Check Telnyx Portal:** Verify account status and tier
2. **Temporary Mitigation:** Implement client-side retry with exponential backoff (60s delay)
3. **Escalate:** Contact Telnyx support via portal ticket
4. **Long-term Fix:** Upgrade account tier

### If Payment Errors Occur (`HTTP 402`)

1. **Check Billing:** Telnyx Portal > Billing > Payment Methods
2. **Add Funds:** Top up balance or update payment method
3. **Verify Services:** Test call after payment cleared

---

## Support Contacts

- **Telnyx Support Portal:** https://support.telnyx.com
- **Email:** support@telnyx.com
- **Phone:** +1 (312) 775-2100
- **Account Manager:** _(to be assigned after upgrade)_

---

## Action Items

**Priority 1 (Immediate):**

- [ ] **Log into Telnyx Portal** and document current account tier
- [ ] **Confirm rate limits** with Telnyx support (open ticket)
- [ ] **Upgrade to Pay-As-You-Go** if currently on trial
- [ ] **Add payment method** to avoid service interruptions

**Priority 2 (This Week):**

- [ ] **Test call limits** after upgrade (make 10+ calls in succession)
- [ ] **Document confirmed limits** in this file
- [ ] **Set up balance monitoring** (cron job checking `/v2/account/balance`)

**Priority 3 (Before Production):**

- [ ] **Load test voice infrastructure** (concurrent calls, volume)
- [ ] **Establish cost baseline** ($/call, $/month)
- [ ] **Set up billing alerts** (Telnyx Portal > Billing > Alerts)

---

## Related Documentation

- [Voice Routes](../02-FEATURES/VOICE_ARCHITECTURE.md)
- [Rate Limiting](./RATE_LIMITING.md)
- [Error Handling](../01-CORE/ERROR_HANDLING.md)

---

**Next Review:** After Telnyx support confirms account details  
**Owner:** Platform Engineering  
**Stakeholders:** Product, Finance
