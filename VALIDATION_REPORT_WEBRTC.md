# Deep Validation Force: WebRTC & Call Flow

## "Is this a valid call flow?"

**The previous state was INVALID.**
It had two fatal mismatches:
1.  **Architecture Mismatch**: The Frontend (`useWebRTC`) was using the *Legacy* Relay SDK, but the Backend was incorrectly configured to return *SIP* credentials. This caused the 500 Error (`Session creation failed` / `token missing`).
2.  **Flow Mismatch (Bridge vs SIP)**: The backend "Bridge" flow (`startCallHandler`) creates a conference and dials **two PSTN numbers** (Agent + Customer). This is a "Click-to-Call" flow where the agent answers on their *physical phone*, not the browser. The user expected the browser to be the audio source.

## The Fix: Validated SIP Flow

I have migrated the application to a **Valid SIP-over-WebSockets Flow**:

1.  **Frontend (Fixed)**: 
    - Replaced `hooks/useWebRTC.ts` with a pure `SIP.js` implementation.
    - Connects directly to `wss://blackkryptonians.signalwire.com` as user `web-rtc01`.
    - Handles audio directly in the browser via `<audio>` element (Peer-to-Peer media).
    
2.  **Backend (Fixed)**:
    - Updated `/api/webrtc/session` to return the necessary SIP Credentials (including Password) securely to authenticated users.
    - Fixed SWML/LaML 12100 Parse Error (unrelated hangup issue).

3.  **The New Flow**:
    - User clicks "Call" in `WebRTCDialer`.
    - Browser sends `SIP INVITE` directly to `+1...` via SignalWire.
    - SignalWire connects Browser Audio <--> Gateway <--> Customer.
    - **No Server-Side Bridge Required** for simple outbound calls.

## Verification Checklist

1.  **Refresh Page** (Hard Refresh).
2.  **Click "Enable Browser Calling"**:
    - Should verify "Registered" in console.
    - Status: **Ready** (Green).
3.  **Place Call**:
    - Audio should be audible immediately.
    - Call should stay connected > 10s.

## Remaining Risks
- **Network**: Ensure no firewall blocks WSS (WebSocket Secure) port 443/5061.
- **Permissions**: Ensure Microphone permission is granted.
