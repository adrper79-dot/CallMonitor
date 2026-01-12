# Live Translation Feature - Deployment Notes

**Feature:** SignalWire AI Agents Live Translation (Preview)  
**Date:** January 14, 2026  
**Status:** Implementation Complete - Pending SignalWire API Verification

---

## Environment Variables

### Required for Feature

Add the following environment variable to enable the live translation preview feature:

```bash
TRANSLATION_LIVE_ASSIST_PREVIEW=true
```

**Default:** `false` (feature disabled when not set)

**Usage:**
- Set to `true` to enable live translation preview for Business/Enterprise plan organizations
- Set to `false` or omit to disable the feature globally
- Feature is capability-gated (requires Business plan + feature flag)

---

## Database Migration

Run the following migration to add live translation tracking columns:

```bash
psql "$DATABASE_URL" -f migrations/2026-01-14-add-live-translation-fields.sql
```

**Migration adds:**
- `recordings.has_live_translation` (boolean, default false)
- `recordings.live_translation_provider` (text, nullable, check constraint)

**Rollback (if needed):**
```sql
ALTER TABLE recordings DROP COLUMN IF EXISTS has_live_translation;
ALTER TABLE recordings DROP COLUMN IF EXISTS live_translation_provider;
DROP INDEX IF EXISTS idx_recordings_has_live_translation;
```

---

## Feature Flag Deployment

### Staged Rollout

1. **Phase 1: Internal Testing**
   - Set `TRANSLATION_LIVE_ASSIST_PREVIEW=true` for test/staging environments
   - Verify SWML endpoint works with SignalWire test account
   - Test capability gating (Business plan only)
   - Verify webhook handler sets `has_live_translation` flag

2. **Phase 2: Beta Users**
   - Enable feature flag for specific Business plan organizations
   - Monitor error rates and KPI metrics
   - Verify AssemblyAI canonical transcripts still work correctly

3. **Phase 3: General Availability**
   - Enable feature flag globally
   - Monitor for issues
   - Collect user feedback

### Rollback Procedure

If issues occur, disable the feature by setting:

```bash
TRANSLATION_LIVE_ASSIST_PREVIEW=false
```

This will:
- Disable the capability for all organizations
- Prevent routing to SWML endpoint
- Calls will continue using standard LaML endpoint
- No data loss or corruption

---

## SignalWire Configuration

### Prerequisites

- SignalWire account with AI Agents enabled
- SignalWire project credentials configured
- Webhook endpoint accessible: `/api/webhooks/signalwire`

### Verification Steps

1. **Verify SWML Support**
   - Test SWML JSON syntax with SignalWire account
   - Confirm AI Agent node structure is correct
   - Verify voice IDs are supported

2. **Test SWML Endpoint**
   - Call `/api/voice/swml/outbound?callId={test-id}` manually
   - Verify JSON response format
   - Check error handling for missing configs

3. **Test Call Flow**
   - Place test call with translation enabled
   - Verify routing to SWML endpoint
   - Check webhook events are received
   - Verify `has_live_translation` flag is set

---

## Monitoring

### Key Metrics

Monitor the following KPIs:

1. **Error Rates**
   - `LIVE_TRANSLATE_EXECUTION_FAILED` frequency
   - `LIVE_TRANSLATE_VENDOR_DOWN` frequency
   - SWML endpoint error rate

2. **Feature Usage**
   - Number of calls with live translation enabled
   - Capability check success/failure rate
   - Organization adoption rate

3. **System Health**
   - SWML endpoint response times
   - SignalWire API call success rate
   - Webhook processing latency

### Dashboards

- Error metrics: `/api/errors/metrics`
- KPI tracking: Monitor error catalog KPIs
- Application logs: Check for SWML endpoint errors

---

## Troubleshooting

### Common Issues

1. **Feature Not Available**
   - Check feature flag: `TRANSLATION_LIVE_ASSIST_PREVIEW=true`
   - Verify organization plan is Business or Enterprise
   - Check capability API response: `/api/call-capabilities?orgId={org-id}`

2. **SWML Endpoint Errors**
   - Check application logs for SWML endpoint errors
   - Verify voice_configs has `translate=true` and language codes set
   - Test endpoint manually: `GET /api/voice/swml/outbound`

3. **Live Translation Not Working**
   - Verify SignalWire account has AI Agents enabled
   - Check SWML JSON syntax is correct
   - Verify call is routed to SWML endpoint (check logs)
   - Check SignalWire webhooks are being received

4. **Webhook Handler Issues**
   - Check `has_live_translation` flag is being set
   - Verify webhook detection logic (plan + feature flag + voice_configs)
   - Check database for flag updates

---

## Support

For issues related to:
- **SignalWire API**: Contact SignalWire support
- **Feature functionality**: Check application logs and error metrics
- **Database issues**: Review migration logs and schema

---

## References

- Implementation Summary: `ARCH_DOCS/IMPLEMENTATION_SUMMARY.md`
- SignalWire Research: `ARCH_DOCS/SIGNALWIRE_AI_AGENTS_RESEARCH.md`
- Error Handling: `ARCH_DOCS/ERROR_HANDLING_PLAN.txt`
- Translation Agent Design: `ARCH_DOCS/Translation_Agent`
