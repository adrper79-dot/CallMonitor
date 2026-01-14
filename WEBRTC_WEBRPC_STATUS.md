# WebRTC/WebRPC Status

## ❌ **NOT CURRENTLY IMPLEMENTED**

**Current Setup**: SignalWire REST API (server-side calling only)

---

## 🔍 **What You Have Now**

### **SignalWire REST API** ✅
- Server makes calls via SignalWire REST API
- User clicks button → Server initiates call → Phone rings
- **Pros**: Simple, reliable, works on all devices
- **Cons**: No browser-based calling, can't use computer mic/speakers

### **Flow**:
```
User clicks "Make Call" button
  ↓
POST /api/voice/call
  ↓
startCallHandler (server)
  ↓
SignalWire REST API
  ↓
Call initiated to phone
```

---

## 🚀 **WebRTC vs WebRPC**

### **WebRTC (Browser-Based)**
**What it is**: Direct peer-to-peer calling from browser
- Uses computer microphone and speakers
- No phone required
- Like Zoom/Google Meet

**Requirements**:
- Signaling server
- STUN/TURN servers
- WebRTC peer connection setup
- Media stream handling

**Effort**: High (2-3 days of development)

### **WebRPC (SignalWire's Browser SDK)**
**What it is**: SignalWire's simplified browser calling
- Click-to-call from browser
- Uses SignalWire's infrastructure
- Still records/transcribes on SignalWire side

**Requirements**:
- SignalWire Fabric client SDK
- JWT token generation for auth
- Frontend integration

**Effort**: Medium (1 day of development)

---

## ✅ **Recommendation: Add WebRPC**

If you want browser-based calling with your computer headset:

### **Implementation Plan:**

1. **Install SignalWire SDK**
```bash
npm install @signalwire/js
```

2. **Create JWT endpoint** (`/api/signalwire/token`)
```typescript
// Generate JWT for browser client
import jwt from 'jsonwebtoken'

export async function POST(req: Request) {
  const ctx = await requireAuth()
  if (ctx instanceof NextResponse) return ctx
  
  const token = jwt.sign(
    {
      sub: ctx.userId,
      iss: process.env.SIGNALWIRE_PROJECT_ID,
      jti: uuidv4()
    },
    process.env.SIGNALWIRE_API_TOKEN,
    { expiresIn: '1h' }
  )
  
  return success({ token })
}
```

3. **Add browser calling component**
```typescript
import { SignalWire } from '@signalwire/js'

const client = await SignalWire({
  token: await getToken(),
  rootElement: document.getElementById('sw-widget')
})

// Make call from browser
await client.dial({
  to: phoneNumber,
  nodeId: 'your-node-id'
})
```

4. **Integrate with existing recording/transcription**
- Calls still go through SignalWire
- Still get recordings, transcripts, etc.
- Just initiated from browser instead of server

**Would you like me to implement WebRPC?**

---

## 🔧 **Current Issue to Fix First**

Before adding WebRPC, we need to fix the authentication issue on `/api/voice/call`.

**Problem**: Session not being read properly  
**Fix**: Use `requireAuth()` helper for consistent authentication

**Deploying fix now...**

---

## Summary

| Feature | Status |
|---------|--------|
| SignalWire REST API | ✅ Implemented |
| Server-side calling | ✅ Working |
| WebRTC (peer-to-peer) | ❌ Not implemented |
| WebRPC (SignalWire browser) | ❌ Not implemented |
| Computer mic/speakers | ❌ Not available (need WebRPC) |

**Current**: Calls go to actual phones via SignalWire  
**To add**: Browser-based calling with computer audio (requires WebRPC integration)
