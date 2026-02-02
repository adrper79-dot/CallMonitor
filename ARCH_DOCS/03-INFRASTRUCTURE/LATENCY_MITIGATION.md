# Latency Mitigation Strategy for Media Pipeline

**Date:** 2026-01-31
**Context:** The architecture uses a "Serverless Glue" pattern (Telnyx -> Cloudflare Worker -> AssemblyAI -> ElevenLabs) which introduces hop latency.
**Goal:** Ensure glass-to-glass latency < 800ms for live translation.

## 1. The "Worker Glue" Risk
Each serverless invocation (Worker) introduces:
- Cold start overhead (low on Cloudflare, but non-zero)
- TCP/TLS handshake round-trips to upstream APIs
- Serialization/Deserialization overhead

## 2. Mitigation Strategies

### A. Durable Objects for "Warm" Connections (Recommended)
Instead of stateless Workers, use **Cloudflare Durable Objects (DO)** to maintain persistent WebSocket connections.

**Architecture:**
1. **Telnyx Webhook** spawns a unique DO instance for the `call_id`.
2. **DO Instance** opens persistent WebSockets to:
   - AssemblyAI (STT)
   - ElevenLabs (TTS)
   - OpenAI/DeepL (Translation)
3. **DO Instance** acts as a stateful router, piping binary frames directly between sockets without HTTP overhead.

**Benefit:** eliminating the TLS handshake on every audio chunk reduces latency by ~200-500ms per packet.

### B. Geo-Routing
Ensure Telnyx Media Anchors and Cloudflare Workers are in the same region.
- **Telnyx:** US-East (Virginia)
- **Cloudflare:** Configure `smart_placement` or pin DO to US-East.

### C. Optimistic Translation
Don't wait for "Final" transcript to translate.
- Translate "Partial" results for visual display.
- Only synthesize audio (TTS) on "Final" to avoid stutter.

### D. Protocol Optimization
- Use **MsgPack** instead of JSON for internal piping if possible.
- Use **TCP BBR** congestion control (Cloudflare default).

## 3. Implementation Plan (Future Phase)
1. POC a `CallRouter` Durable Object.
2. Benchmark "Stateless Worker" vs "Durable Object" RTT.
3. Migrate `api/voice/media-stream` to DO if latency > 1s.
