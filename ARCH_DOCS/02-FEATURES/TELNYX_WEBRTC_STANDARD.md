# Telnyx WebRTC Implementation Standard

**Status**: ✅ Production Working  
**Last Updated**: 2026-02-05  
**SDK Version**: TelnyxRTC v2.25.17

## TL;DR

**For two-way audio in WebRTC calls, ALWAYS enumerate audio devices and filter out virtual microphones (Steam, VB-Audio, etc.). Browser defaults to virtual devices instead of hardware.**

```typescript
// ✅ CORRECT - Enumerate and select real microphone
const devices = await navigator.mediaDevices.enumerateDevices()
const audioInputs = devices.filter(d => d.kind === 'audioinput')
const virtualKeywords = ['steam', 'virtual', 'vb-audio', 'voicemeeter', 'cable']
const realMic = audioInputs.find(d => !virtualKeywords.some(kw => d.label.toLowerCase().includes(kw)))

const audioConstraint = realMic ? {
  deviceId: { exact: realMic.deviceId },
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
} : true

// Use in TelnyxRTC.newCall()
const call = await client.newCall({
  destinationNumber: phoneNumber,
  callerNumber: callerId,
  audio: audioConstraint
})
```

---

## Architecture Overview

### TelnyxRTC SDK (Client-Side WebRTC)

**Connection Method**: JWT-based authentication via `/api/webrtc/token` endpoint

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| `TelnyxRTC` client | WebRTC connection management | `hooks/useWebRTC.ts` |
| Token endpoint | JWT generation | `workers/src/routes/webrtc.ts` |
| Call state events | Real-time updates | `telnyx.notification` events |
| Audio device selection | Hardware microphone detection | Device enumeration + filtering |

### Key Differences from SignalWire

| Aspect | SignalWire (Old) | TelnyxRTC (Current) |
|--------|------------------|---------------------|
| **Authentication** | SIP username/password | JWT token |
| **Calling Method** | Server-side dial + SIP bridge | Client-side `newCall()` |
| **Event Handling** | SIP INVITE/BYE | `telnyx.notification` with `callUpdate` |
| **SDK** | SIP.js | @telnyx/webrtc v2.25.17 |
| **Connection** | SIP registration | JWT connection |

---

## Critical Requirements

### 1. JWT Token Authentication

**Endpoint**: `POST /api/webrtc/token`

**Request**: Empty body (credentials from environment)

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "caller_id": "+13048534096"
}
```

**Implementation**:
```typescript
// workers/src/routes/webrtc.ts
const token = await telnyxClient.token.create({
  connection_id: c.env.TELNYX_CONNECTION_ID
})
return { token: token.token, caller_id: c.env.TELNYX_NUMBER }
```

> [!IMPORTANT]
> Telnyx returns plain JWT string, NOT JSON. Do NOT try to parse as JSON.

### 2. Client-Side Calling

**Method**: `TelnyxRTC.newCall()`

```typescript
const call = await client.newCall({
  destinationNumber: phoneNumber,
  callerNumber: callerId,
  audio: audioConstraint
})
```

> [!IMPORTANT]
> Do NOT use server-side Call Control API. Use client-side `newCall()` method.

### 3. Call State Event Handling

**Event Type**: `telnyx.notification`

**Event Structure**:
```typescript
{
  type: 'callUpdate',
  call: {
    state: 'new' | 'requesting' | 'trying' | 'early' | 'active' | 'hangup' | 'destroy',
    // ... other call properties
  }
}
```

**State Flow**:
```
new → requesting → trying → early → active → hangup → destroy
```

**Implementation**:
```typescript
client.on('telnyx.notification', (notification) => {
  if (notification.type === 'callUpdate') {
    const { state } = notification.call
    // Handle state changes
  }
})
```

### 4. Microphone Device Selection (CRITICAL)

**Problem**: Browser defaults to virtual microphones like "Steam Streaming Microphone"

**Solution**: Enumerate devices and filter out virtual ones

**Virtual Device Keywords**:
- `steam`
- `virtual`
- `vb-audio`
- `voicemeeter`
- `cable`

**Implementation**:
```typescript
// Enumerate on component mount
useEffect(() => {
  navigator.mediaDevices.enumerateDevices().then(devices => {
    const audioInputs = devices.filter(d => d.kind === 'audioinput')
    console.log('[Telnyx] === AVAILABLE AUDIO INPUT DEVICES ===', audioInputs)
  })
}, [])

// Select real microphone in makeCall()
const devices = await navigator.mediaDevices.enumerateDevices()
const audioInputs = devices.filter(d => d.kind === 'audioinput')
const virtualKeywords = ['steam', 'virtual', 'vb-audio', 'voicemeeter', 'cable']
const realMic = audioInputs.find(d => {
  const label = d.label.toLowerCase()
  return !virtualKeywords.some(kw => label.includes(kw))
})

let audioConstraint: boolean | MediaTrackConstraints = true
if (realMic && realMic.deviceId) {
  audioConstraint = {
    deviceId: { exact: realMic.deviceId },
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
  console.log('[Telnyx] Using real microphone:', realMic.label)
}
```

---

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `TELNYX_API_KEY` | API authentication | `KEY...` |
| `TELNYX_CONNECTION_ID` | Credential connection ID | `2887319279378629637` |
| `TELNYX_NUMBER` | Outbound caller ID | `+13048534096` |

---

## Code Implementation

### Hook: `hooks/useWebRTC.ts`

```typescript
import { TelnyxRTC } from '@telnyx/webrtc'

export function useWebRTC() {
  const [client, setClient] = useState<TelnyxRTC | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const currentCallRef = useRef<any>(null)

  // Device enumeration on mount
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      console.log('[Telnyx] === AVAILABLE AUDIO INPUT DEVICES ===', audioInputs)
    })
  }, [])

  const connect = async () => {
    try {
      const response = await fetch('/api/webrtc/token')
      const { token, caller_id } = await response.json()

      const telnyxClient = new TelnyxRTC({ token })
      telnyxClient.on('telnyx.ready', () => setIsConnected(true))
      telnyxClient.on('telnyx.notification', handleNotification)
      telnyxClient.connect()
      setClient(telnyxClient)
    } catch (error) {
      console.error('[Telnyx] Connection failed:', error)
    }
  }

  const makeCall = async (phoneNumber: string) => {
    if (!client) return

    // Find real microphone
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter(d => d.kind === 'audioinput')
    const virtualKeywords = ['steam', 'virtual', 'vb-audio', 'voicemeeter', 'cable']
    const realMic = audioInputs.find(d => {
      const label = d.label.toLowerCase()
      return !virtualKeywords.some(kw => label.includes(kw))
    })

    let audioConstraint: boolean | MediaTrackConstraints = true
    if (realMic && realMic.deviceId) {
      audioConstraint = {
        deviceId: { exact: realMic.deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
      console.log('[Telnyx] Using real microphone:', realMic.label)
    }

    try {
      const call = await client.newCall({
        destinationNumber: phoneNumber,
        callerNumber: caller_id, // from token response
        audio: audioConstraint
      })
      currentCallRef.current = call
      return call
    } catch (error) {
      console.error('[Telnyx] Call failed:', error)
    }
  }

  const hangUp = () => {
    if (currentCallRef.current) {
      currentCallRef.current.hangup()
      currentCallRef.current = null
    }
  }

  const handleNotification = (notification: any) => {
    if (notification.type === 'callUpdate') {
      const { state } = notification.call
      console.log('[Telnyx] Call state:', state)
      // Handle state changes...
    }
  }

  return { connect, makeCall, hangUp, isConnected }
}
```

### Token Endpoint: `workers/src/routes/webrtc.ts`

```typescript
import { Telnyx } from 'telnyx'

export async function POST(c: Context) {
  const telnyxClient = new Telnyx(c.env.TELNYX_API_KEY)

  try {
    const token = await telnyxClient.token.create({
      connection_id: c.env.TELNYX_CONNECTION_ID
    })

    return c.json({
      token: token.token, // Plain JWT string
      caller_id: c.env.TELNYX_NUMBER
    })
  } catch (error) {
    return c.json({ error: 'Token generation failed' }, 500)
  }
}
```

---

## Testing Checklist

### Pre-Flight
- [ ] `TELNYX_CONNECTION_ID` is valid (2887319279378629637)
- [ ] `TELNYX_NUMBER` is verified caller ID (+13048534096)
- [ ] Token endpoint returns valid JWT + caller_id
- [ ] Browser has microphone permissions

### Test Flow
1. [ ] Load page → Click "Connect" → Console shows "telnyx.ready"
2. [ ] Check console for audio device enumeration logs
3. [ ] Enter phone number → Click "Call"
4. [ ] Console shows "Using real microphone: [device name]" (NOT Steam)
5. [ ] Call state progresses: new → requesting → trying → early → active
6. [ ] Phone rings → answer it
7. [ ] Audio flows bidirectionally (both directions working)
8. [ ] Hang up → state goes to hangup → destroy

### Audio Debugging
- [ ] Check console for `[Telnyx] === LOCAL AUDIO DEBUG ===`
- [ ] Verify `enabled=true`, `muted=false`, `readyState=live`
- [ ] Confirm device label shows real hardware (not virtual)
- [ ] Test with different microphones if available

---

## Troubleshooting

### One-Way Audio (Can Hear Them, They Can't Hear You)

**Cause**: Browser selected virtual microphone (Steam Streaming Microphone, etc.)

**Symptoms**: Call connects, remote audio works, local audio track shows wrong device

**Fix**: Implement device enumeration and filtering (see code above)

### Call Fails to Connect

**Cause**: Invalid JWT token or connection ID

**Fix**:
- Verify `TELNYX_CONNECTION_ID` is correct
- Check token endpoint returns valid JWT
- Ensure `TELNYX_API_KEY` has proper permissions

### No Audio Device Available

**Cause**: No microphone permissions or hardware issues

**Fix**:
- Check browser microphone permissions
- Verify audio devices are connected
- Test with different browser

### Call State Stuck

**Cause**: Missing event handlers for `telnyx.notification`

**Fix**: Ensure all state transitions are handled in event listener

### Token Parse Error

**Cause**: Trying to parse JWT as JSON

**Fix**: Telnyx returns plain JWT string, use as-is

---

## Files

| File | Purpose |
|------|---------|
| `hooks/useWebRTC.ts` | TelnyxRTC client hook with device selection |
| `workers/src/routes/webrtc.ts` | JWT token generation endpoint |
| `ARCH_DOCS/02-FEATURES/TELNYX_WEBRTC_STANDARD.md` | This document |

---

## Migration Notes

**From SignalWire to TelnyxRTC**:
- Replace SIP.js with @telnyx/webrtc
- Change authentication from SIP credentials to JWT
- Switch from server-side dial to client-side newCall()
- Update event handling from SIP to telnyx.notification
- Add microphone device enumeration (critical for audio)

**Breaking Changes**:
- No more SIP registration flow
- Different event structure
- Client-side calling only
- JWT authentication required</content>
<parameter name="filePath">c:\Users\Ultimate Warrior\My project\gemini-project\ARCH_DOCS\02-FEATURES\TELNYX_WEBRTC_STANDARD.md