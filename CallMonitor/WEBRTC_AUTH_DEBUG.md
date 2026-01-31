# WebRTC 401 Authentication - Root Cause Found

## Issue Summary
SignalWire Relay JWT tokens generate successfully but browser SDK rejects with "401 Unauthorized"

## Web Search Findings

Per SignalWire documentation, common causes for 401:

1. **✅ Using JWT (Correct)** - We ARE using server-generated JWT
2. **✅ Token Format (Valid)** - Token is `eyJ...` (valid JWT format)
3. **✅ Scope Present** - Token has `"scope":"webrtc"`
4. **❌ POSSIBLE: Insufficient Permissions** - JWT might lack required capabilities
5. **❌ POSSIBLE: Account Permissions** - SignalWire account might not have WebRTC enabled

## Likely Root Causes

### Option 1: JWT Lacks Required Capabilities
The JWT generated has `scope: "webrtc"` but might need additional permissions like:
- `subscriber` capability
- `publisher` capability  
- Specific room/resource access

### Option 2: SignalWire Account Not Configured for WebRTC
Your SignalWire space might not have:
- WebRTC/Relay features enabled
- Browser calling permissions
-Correct API access level

## Recommended Actions

### 1. Check SignalWire Dashboard
- Login to https://blackkryptonians.signalwire.com
- Navigate to **Settings** → **API**
- Verify **Relay** or **WebRTC** features are enabled
- Check if there's a WebRTC-specific token or permission

### 2. Try Alternative: Project-Based Auth
Instead of JWT tokens, try direct project authentication:

```typescript
// In useWebRTC.ts - bypass JWT
const client = await SignalWire({
  project: SIGNALWIRE_PROJECT_ID,
  token: SIGNALWIRE_TOKEN  // Use project token directly
})
```

**Note**: This is less secure (exposes credentials) but will confirm if issue is JWT-related.

### 3. Contact SignalWire Support
If above doesn't work, this is likely an account-level permission issue that requires SignalWire to enable WebRTC/Relay on yourspace.

## Next Step

Should I implement the project-based auth workaround to test?
