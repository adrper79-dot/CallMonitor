# WebRTC 401 Fix Applied

## Change Summary

✅ **Migrated to SignalWire Fabric API**

### What Changed

| Before | After |
|--------|-------|
| `/api/relay/rest/jwt` (deprecated) | `/api/fabric/subscribers` (modern) |
| `jwt_token` response field | `token` response field |
| `resource: sessionId` | `name: sessionId` |
| `expires_in: 3600` | `expires_in_seconds: 3600` |

### File Modified
`app/api/webrtc/session/route.ts` (Lines 72-125)

### Key Improvements

1. **Modern API**: Uses SignalWire Fabric instead of deprecated Relay REST
2. **Better Permissions**: Explicit `scopes: ['webrtc']` 
3. **Metadata Tracking**: Includes `user_id` and `organization_id`
4. **Channel Config**: Explicit audio/video settings

### Request Format
```typescript
POST https://{space}.signalwire.com/api/fabric/subscribers
{
  name: "{sessionId}",
  channels: { audio: true, video: false },
  scopes: ["webrtc"],
  expires_in_seconds: 3600,
  meta: { user_id, organization_id }
}
```

### Response Format
```json
{
  "id": "subscriber-id",
  "token": "fabric-token-here",
  ...
}
```

## Status: ✅ READY TO TEST

Please retry WebRTC connection. The 401 error should be resolved.
