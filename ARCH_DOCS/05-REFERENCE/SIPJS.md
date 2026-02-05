# SIP.js WebRTC Guide (SignalWire Integration)

## Versions
- `sip.js`: ^0.21.2
- `@signalwire/webrtc`: ^3.14.1 (unused? SIP.js direct)

## Key Concepts
- SIP User Agent for browser WebRTC calls.
- Connects to SignalWire SIP domain via WSS.
- Server-side PSTN dial → inbound INVITE to browser SIP UA.
- Bidirectional audio: local mic + remote PSTN.

## Core Hook: useWebRTC(organizationId: string | null)
- `hooks/useWebRTC.ts`
- Requires orgId (session.user.organizationId)
- Status: disconnected → registered → on_call

## Flow
1. **connect()**: Fetch /api/webrtc/session → SIP creds (username/pw/domain/wss/ice)
2. getUserMedia(audio)
3. SIP.UserAgent(transport: wss://signalwire...)
4. Registerer.register()
5. **makeCall(phone)**: POST /api/webrtc/dial → server dials PSTN
6. Inbound INVITE → accept() + addTrack localStream + ontrack remote audio

## Key Code Examples

### SIP Session Fetch
```ts
const sessionRes = await apiPost('/api/webrtc/session')  // {sip_username, sip_password, sip_domain, websocket_url, ice_servers}
```

### UserAgent Creation
```ts
const userAgent = new UserAgent({
  uri: `sip:${sip_username}@${sip_domain}`,
  transportOptions: { server: websocket_url },
  authorizationUsername: sip_username,
  authorizationPassword: sip_password,
  sessionDescriptionHandlerFactoryOptions: { peerConnectionConfiguration: { iceServers } }
})
await userAgent.start()
```

### Incoming Call Handler (delegate.onInvite)
```ts
onInvite: (invitation) => {
  invitation.accept({ sessionDescriptionHandlerOptions: { constraints: { audio: true } } })
  // Add local tracks
  localStream.getTracks().forEach(track => sdh.peerConnection.addTrack(track, localStream))
  // Remote audio
  sdh.peerConnection.ontrack = (e) => remoteAudio.srcObject = new MediaStream([e.track])
}
```

### Dial Out
```ts
const makeCall = async (phoneNumber: string) => {
  await apiPost('/api/webrtc/dial', { phone_number: phoneNumber, sessionId })
  // Wait for inbound INVITE
}
```

## Best Practices
- Cleanup: userAgent.stop(), unregister, stream.stop()
- Audio: autoplay remote, addTrack local for bidirectional.
- Errors: console.log SIP states.
- Mute: localStream tracks.enabled = false

## Troubleshooting
- "Organization ID required": Add org_members.
- No audio: Check addTrack/ontrack, autoplay policy.
- Register fail: Creds/ice_servers from /webrtc/session.
- Tail logs: wrangler tail wordisbond-api /api/webrtc/*

See hooks/useWebRTC.ts full impl.