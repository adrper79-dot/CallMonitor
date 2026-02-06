# ADR 001: Telnyx Over SignalWire for Telephony Provider

**Status**: Accepted
**Date**: 2026-02-06
**Deciders**: Engineering Team
**Tags**: telephony, infrastructure, vendor-selection

## Context

Wordis Bond is "The System of Record for Business Conversations" and requires a reliable telephony provider for:
- Outbound call origination
- WebRTC browser-based calling
- Call recording with media access
- Webhook notifications for call events
- PSTN connectivity with phone number management

The platform initially explored SignalWire for its AI Agent capabilities and LaML/SWML support. However, after research and prototyping, the team needed to make a final decision between SignalWire and Telnyx (and other providers like Twilio, Plivo).

SignalWire research documentation (`ARCH_DOCS/03-INFRASTRUCTURE/SIGNALWIRE_AI_AGENTS_RESEARCH.md`) revealed integration challenges:
- LaML (Twilio-compatible XML) vs SWML (SignalWire JSON) incompatibility
- AI Agents require SWML, but existing call flows used LaML
- Unclear programmatic API for attaching AI Agents to calls
- Hybrid approach would require maintaining two markup languages

## Decision

Use **Telnyx** as the primary telephony provider for all call functionality, including:
- SIP/VXML for call control
- WebRTC for browser-based calling
- Call recording with R2 bucket integration
- Webhook delivery for call events
- Phone number provisioning and management

Telnyx handles all telephony infrastructure while Wordis Bond maintains control over:
- Call metadata and business logic
- Recording storage and processing
- Transcription (AssemblyAI) and translation (OpenAI)
- Billing and usage tracking

## Rationale

### Key Factors in Choosing Telnyx

1. **WebRTC SDK Quality**: Telnyx provides a mature WebRTC SDK with excellent documentation and support for browser-based calling
2. **VXML Simplicity**: VXML (Voice XML) is simpler than managing LaML/SWML dual-markup approach
3. **API Design**: RESTful API with clear documentation, typesafe responses
4. **Pricing Model**: Transparent per-minute pricing, no hidden fees, cost-effective for our use case
5. **Media Plane Control**: Direct access to call recordings via webhooks, integrates cleanly with Cloudflare R2
6. **Webhook Reliability**: Documented webhook signatures for security, reliable delivery
7. **Phone Number Management**: Straightforward API for provisioning, configuration, and release
8. **No Vendor Lock-in**: Standard SIP/VXML means migration path exists if needed

### Technical Advantages

- **Static VXML**: We can serve VXML instructions via static Cloudflare Workers endpoints
- **Recording URLs**: Recordings delivered as signed URLs, easily copied to R2 for permanent storage
- **Call Control**: Fine-grained control over call flow without proprietary markup languages
- **DevEx**: Clear error messages, good SDK documentation, responsive support

### Business Considerations

- **Cost**: Significantly lower than Twilio for equivalent features
- **Scalability**: Proven at scale, edge presence globally
- **Compliance**: SOC 2 Type II certified, HIPAA-compliant options available
- **Support**: Good developer support, active community

## Consequences

### Positive
- Clean, simple API integration reduces development time
- Lower telephony costs compared to competitors
- WebRTC SDK works reliably in production (two-way audio confirmed working)
- No dual-markup maintenance burden (LaML + SWML)
- Webhook-based architecture fits well with Cloudflare Workers event model
- Recording integration with R2 is straightforward

### Negative
- No built-in AI Agent capabilities (SignalWire's strength) - we implement our own with OpenAI
- Must build custom voice bot logic instead of using SignalWire's Call Flow Builder
- Learning curve for VXML (though documentation is good)
- Dependency on single vendor for critical telephony infrastructure

### Neutral
- SignalWire code remains in codebase as legacy/research (`ARCH_DOCS/03-INFRASTRUCTURE/SIGNALWIRE_AI_AGENTS_RESEARCH.md`)
- Could theoretically use SignalWire for specific AI-heavy use cases in future
- VXML knowledge is transferable to other providers if migration needed

## Alternatives Considered

### Alternative 1: SignalWire
- **Description**: Use SignalWire for telephony with AI Agents for live translation and survey bots
- **Pros**:
  - Built-in AI Agent capabilities
  - Call Flow Builder for visual configuration
  - Twilio-compatible LaML support
  - SWML for advanced features
- **Cons**:
  - Dual markup language complexity (LaML + SWML)
  - Unclear programmatic API for per-call agent attachment
  - Higher complexity for standard call flows
  - Less mature WebRTC SDK documentation
  - Research revealed integration challenges (see `SIGNALWIRE_AI_AGENTS_RESEARCH.md`)
- **Why Rejected**: Complexity overhead not justified when we can build equivalent AI features with OpenAI + ElevenLabs TTS

### Alternative 2: Twilio
- **Description**: Industry-standard telephony provider with TwiML markup
- **Pros**:
  - Market leader, proven reliability
  - Extensive documentation and community
  - Rich feature set
  - Strong WebRTC support
- **Cons**:
  - Significantly higher cost per minute
  - TwiML similar complexity to SWML
  - Vendor lock-in concerns
  - Over-engineered for our needs
- **Why Rejected**: Cost prohibitive for high-volume call usage, feature bloat

### Alternative 3: Plivo
- **Description**: Cost-effective Twilio alternative with similar API
- **Pros**:
  - Lower cost than Twilio
  - Good API documentation
  - PLIVO XML similar to TwiML
- **Cons**:
  - Less mature WebRTC support
  - Smaller community and ecosystem
  - Fewer edge locations than Telnyx
  - Less proven at scale
- **Why Rejected**: WebRTC support not as mature as Telnyx, similar pricing without clear advantages

### Alternative 4: Build Own SIP Infrastructure (FreeSWITCH)
- **Description**: Self-hosted FreeSWITCH for complete telephony control
- **Pros**:
  - Complete control over media plane
  - No per-minute costs
  - Ultimate flexibility
- **Cons**:
  - Massive operational burden
  - SIP complexity and security concerns
  - PSTN carrier agreements required
  - No clear ROI for current scale
- **Why Rejected**: Premature optimization, too much operational complexity for current stage

## Implementation

### Code Locations
- **WebRTC Client**: `hooks/useWebRTC.ts` - Telnyx WebRTC SDK integration
- **Call Placement**: `lib/telnyx/callPlacer.ts` - Outbound call API
- **Webhooks**: `workers/src/routes/webhooks.ts` - Telnyx event processing
- **Voice Config**: `workers/src/routes/voice.ts` - VXML generation
- **Caller ID**: `workers/src/routes/caller-id.ts` - Phone number management

### Key Configuration
- Environment variables:
  - `TELNYX_API_KEY` - API authentication
  - `TELNYX_PUBLIC_KEY` - WebRTC public key
  - `TELNYX_SIP_USERNAME` / `TELNYX_SIP_PASSWORD` - SIP credentials
- Webhook endpoints:
  - `/api/webhooks/telnyx` - Call events (started, answered, completed)
  - `/api/voice/vxml` - VXML instruction delivery

### Migration Timeline
- Initial research: SignalWire exploration (documented in `SIGNALWIRE_AI_AGENTS_RESEARCH.md`)
- Decision: Switch to Telnyx (based on WebRTC quality and VXML simplicity)
- Implementation: Telnyx SDK integration, webhook handlers, VXML endpoints
- Status: Production deployed, two-way audio working (verified 2026-02-06)

### Dead Code Cleanup
SignalWire-related code remains in codebase as:
- Research documentation: `ARCH_DOCS/03-INFRASTRUCTURE/SIGNALWIRE_AI_AGENTS_RESEARCH.md`
- No active SignalWire API calls in production code
- Could be removed in future cleanup sprint

## References

- [Telnyx Documentation](https://developers.telnyx.com/)
- [Telnyx WebRTC SDK](https://developers.telnyx.com/docs/v2/webrtc)
- [SignalWire Research](../03-INFRASTRUCTURE/SIGNALWIRE_AI_AGENTS_RESEARCH.md)
- [TELNYX_WEBRTC_STANDARD.md](../02-FEATURES/TELNYX_WEBRTC_STANDARD.md) - WebRTC implementation standards
- [Git Commit: Telnyx WebRTC standard](https://github.com/search?q=repo%3A%2F%2F+Telnyx+WebRTC+standard)
- [Lessons Learned](../LESSONS_LEARNED.md) - Production deployment lessons
