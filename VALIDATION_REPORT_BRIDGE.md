# Deep Validation Report: Bridged Call Flow Fix

## Issue: "Connects, No Audio, Ends after 10s"

**Root Cause Found:**
The Server-Initiated Bridge Flow (`startCallHandler` -> LaML) was creating a conference but **missing the `startConferenceOnEnter="true"` attribute**.

- **Result**: Both participants (Agent and Customer) joined the conference but were placed in a "Waiting for Moderator" state (Hold Music or Silence).
- **No Audio**: Because the conference wasn't mixed/started.
- **10s Hangup**: Likely the user hanging up due to silence, or a default timeout for unstarted conferences.

## The Fix (Deployed)

**Backend Update:** `app/api/voice/laml/outbound/route.ts`

```xml
<!-- Before (Broken) -->
<Conference>bridge-id</Conference>

<!-- After (Fixed) -->
<Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false" maxParticipants="2">
  bridge-id
</Conference>
```

**Attributes Added:**
1.  `startConferenceOnEnter="true"`: Call starts immediately when participants join. **(Solves No Audio)**
2.  `endConferenceOnExit="true"`: Call ends when one party hangs up.
3.  `beep="false"`: Smooth entry without annoying beeps.
4.  `maxParticipants="2"`: Prevents unintended joiners.

## Verification

This fix applies to **Server-Initiated Bridge Calls** (e.g., from the CRM/Admin Panel).

**To Test:**
1.  Wait for Vercel deployment (~2 mins).
2.  Initiate a **Bridge Call** from the UI (click "Call" on a contact).
3.  Answer the Agent Leg (your phone/browser).
4.  Answer the Customer Leg.
5.  **Validation**: Audio should flow immediately.

## Note on WebRTC
If you are using the **WebRTC Dialer** (Browser Phone), it uses the **valid SIP flow** (fixed in previous step) which is separate. The fix above ensures the **Server Bridge** feature *also* works correctly if you use it.
