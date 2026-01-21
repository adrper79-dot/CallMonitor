# Conference Auto-Disconnect Investigation

## Issue
Bridge calls connect both parties but disconnect seconds later **without anyone hanging up**.

## Fix Applied: Smart Conference Termination

**File:** `/app/api/voice/laml/webrtc-conference/route.ts`

```typescript
const endOnExit = leg === 'pstn' ? 'true' : 'false'
```

- **PSTN leg exits** → `endConferenceOnExit="true"` → End conference
- **Browser leg exits** → `endConferenceOnExit="false"` → Keep conference open

### Added Diagnostics
```xml
statusCallback="{appUrl}/api/webhooks/signalwire?conferenceEvent=true&conferenceId={id}"
statusCallbackEvent="start end join leave"
```

This will log ALL conference events to help debug WHY the call is disconnecting.

## Next: Check Webhook Logs

After making a test call, check logs for:
```
[webrtc-conference] Conference settings
[signalwire-webhook] conferenceEvent=true
```

Look for:
- Which leg is exiting first?
-  Any errors before disconnect?
- Conference "leave" events?

## Possible Root Causes (If Fix Doesn't Work)

1. **Timeout somewhere**: Check SignalWire call settings
2. **Webhook error**: SignalWire webhook may be doing something on `connected` status
3. **Network issue**: One leg actually IS disconnecting briefly
4. **Ice candidates failing**: WebRTC connection not fully established

## Test Instructions

1. Make a bridge call
2. When both phones answer, **do not hang up**
3. Wait to see if it auto-disconnects
4. Check logs for conference events
5. Report findings

**If it still disconnects:** We'll need to see the webhook logs to determine exact cause.
