# WebRTC Webhook Behavior Reference

**Last Updated**: 2026-01-21

## Overview

This document explains expected webhook behavior for the WebRTC-PSTN bridge implementation.

---

## SignalWire Webhooks

### Action Webhook (`/api/webhooks/signalwire`)

Called when `<Dial>` completes. Receives form data with:

| Field            | Description                   | Example                                    |
| ---------------- | ----------------------------- | ------------------------------------------ |
| `DialCallStatus` | Outcome of dial               | `completed`, `no-answer`, `busy`, `failed` |
| `DialCallSid`    | SignalWire call SID           | `CA...`                                    |
| `CallDuration`   | Total call duration (seconds) | `45`                                       |
| `AnsweredBy`     | AMD result (if enabled)       | `human`, `machine`, `fax`                  |
| `HangupBy`       | Who hung up                   | `caller`, `callee`, `system`               |

**Recording Fields** (only if `record="record-from-answer"` is set):

- `RecordingUrl` - URL to download recording
- `RecordingSid` - SignalWire recording ID
- `RecordingDuration` - Recording length in seconds

### Recording Status Webhook

Called when recording processing completes (if `recordingStatusCallback` is set).

---

## Expected Log Patterns

### Normal Call Without Recording

```
[WARN] SignalWire webhook: Call completed but NO RECORDING FIELDS
```

**Status**: ✅ Expected if `record` attribute not set in LAML  
**Action**: None needed (or add recording to LAML)

### Normal Call With Recording

```
[INFO] SignalWire webhook: Recording artifact detected
[INFO] SignalWire webhook: created recording
```

**Status**: ✅ Expected with `record="record-from-answer"`

### AssemblyAI Transcription

```
[WARN] AssemblyAI webhook: Payload missing text, fetching from API
```

**Status**: ✅ Expected - webhook sends status first, full text via API poll  
**Action**: Verify transcript saved to DB after fetch

### Translation Too Short

```
[WARN] translation: recording too short for voice cloning
```

**Status**: ✅ Expected for calls <10 seconds  
**Action**: None - voice cloning requires minimum duration

---

## Performance Issues

### Timeout on `/api/audit-logs`

```
GET 504 wordis-bond.com /api/audit-logs
Vercel Runtime Timeout Error: Task timed out after 300 seconds
```

**Cause**: Slow DB query in `ensure user organization setup`  
**Fix**:

1. Add timing logs to identify slow query
2. Optimize Supabase indexes
3. Cache user org setup

---

## Troubleshooting

### No Recording URL in Webhook

**Check**:

1. LAML has `record="record-from-answer"` or `record="record-from-ringing"`
2. Call duration >0 seconds
3. SignalWire recording feature enabled for project

### Webhook Not Received

**Check**:

1. `action` URL is publicly accessible
2. `NEXT_PUBLIC_APP_URL` is correct
3. Vercel logs for incoming POST to `/api/webhooks/signalwire`

### Recording Not Transcribed

**Check**:

1. `ASSEMBLYAI_API_KEY` is set
2. Organization plan is not "free"
3. `voice_configs.transcribe` is `true`
4. Check `ai_runs` table for errors

---

## AI Translation Limitations

### cXML Parse Error 12100

**Error**: `Document parse error` when using `<Connect><AI>` verb

**Cause**: `<AI>` verb not supported in Compatibility API for outbound calls

**Current Workaround**:

- `/api/voice/swml/translation` returns basic `<Say>` fallback
- Call connects without real-time translation
- Post-call transcription + translation still works via AssemblyAI

**Future Fix**:

- Implement via SignalWire Realtime API + AI Agent SDK
- Use server-side orchestration instead of LAML
- See `ARCH_DOCS/02-FEATURES/LIVE_TRANSLATION_FLOW.md` for architecture
