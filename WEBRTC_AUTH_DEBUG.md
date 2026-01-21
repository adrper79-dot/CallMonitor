# WebRTC Architecture Analysis - Fabric vs Relay Incompatibility

## Critical Discovery

**The Fabric API and @signalwire/js SDK are INCOMPATIBLE**

### Current State
- ✅ Fabric API generates token: `wrtc_*` 
- ✅ Token reaches browser
- ❌ `@signalwire/js` v3.29 **does not support Fabric tokens**
- ❌ SDK expects Relay JWT tokens (format: `eyJ*`)

### Why It's Failing

```
Server: Fabric API → wrtc_token
   ↓
Browser: @signalwire/js SDK → expects eyJ_token (Relay JWT)
   ↓
SignalWire: REJECT - "invalid token"
```

## Solutions

### Option A: Revert to Relay REST API ✅ RECOMMENDED
Go back to the original `/api/relay/rest/jwt` endpoint.

**Why**: The `@signalwire/js` SDK v3 was built for Relay, not Fabric.

**Implementation**:
```typescript
// Revert app/api/webrtc/session/route.ts L76
const jwtResponse = await fetch(
  `https://${signalwireDomain}/api/relay/rest/jwt`,
  {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resource: sessionId,
      expires_in: 3600
    })
  }
)
return { token: data.jwt_token }  // eyJ* format
```

### Option B: Switch to Fabric Video SDK
Use SignalWire's Video SDK instead of the legacy Voice SDK.

**Issue**: Complete rewrite required. Different product/pricing.

### Option C: Project-Based Auth (No Token)
Skip token generation, use project credentials directly.

```typescript
// useWebRTC.ts
const client = await SignalWire({
  project: SIGNALWIRE_PROJECT_ID,
  token: SIGNALWIRE_TOKEN
})
```

**Issue**: Requires exposing credentials to browser (security risk).

## Recommendation

**REVERT TO RELAY REST API**

The original `/api/relay/rest/jwt` approach was correct for the SDK version in use. The 401 error was likely due to:
1. Invalid credentials
2. Account permissions
3. API endpoint configuration

**NOT** because the API was deprecated.

## Next Action

1. Revert to Relay JWT
2. Verify SignalWire credentials
3. Test manually: `curl -X POST https://{space}.signalwire.com/api/relay/rest/jwt -u "PROJECT_ID:TOKEN" -d '{"resource":"test"}'`
