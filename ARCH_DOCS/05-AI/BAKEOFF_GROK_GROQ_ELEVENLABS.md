## AI Bakeoff Summary — Groq (LLM) + Grok (WS Voice) + ElevenLabs (TTS backup)

### Scope
- Benchmarked translation (text), TTS-only, and translation→TTS pipelines.
- Providers: Groq (translation), Grok realtime WS voice (primary TTS), OpenAI (baseline text), ElevenLabs (backup TTS).
- Concurrency targets: LLM 10; TTS 20 (Grok), ElevenLabs throttled to 5.

### Environment & Endpoints
- Grok WS URL: wss://api.x.ai/v1/realtime (with model query default to `grok-2-latest`).
- Grok voice default: `Ara` (PCM 24 kHz output).
- ElevenLabs voice: as configured via `ELEVENLABS_VOICE_ID`; REST endpoint; throttle to 5 concurrent.
- Secrets: `GROQ_API_KEY`, `GROK_VOICE_API_KEY`, `GROK_VOICE_URL`, `GROK_VOICE_VOICE`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `OPENAI_API_KEY` (optional baseline).

### Test Results (latest run)
- Translation: Groq p50 ~336–439 ms / p95 ~358–465 (100% ok). OpenAI p50 ~688–734 / p95 ~782–954 (100% ok).
- TTS: Grok p50 ~2.0–2.3s / p95 ~2.3–2.7s (100% ok, ~287–323 KB avg audio). ElevenLabs p50 ~1.15–1.22s / p95 ~1.19–1.21s (100% ok when capped at 5; 429s if uncapped >5).
- Pipelines: Groq+Grok p50 ~2.8–3.1s / p95 ~3.0–3.2s (100% ok, ~404 KB avg). OpenAI+ElevenLabs p50 ~1.8–2.0s / p95 ~2.0–2.2s (100% ok with throttle).
- Report artifact: artifacts/ai-bakeoff-report.json.

### Decisions
- Translation: **Groq** as primary.
- Chat: **Grok** primary; keep router fallback to GPT/Claude (cost/health-aware) in Workers.
- TTS: **Grok** primary; **ElevenLabs** as backup only, hard-capped at 5 concurrent.
- Concurrency policy: Grok TTS up to 20; ElevenLabs TTS throttled to 5 with queue/backoff.
- Keep **AssemblyAI** for ASR/diarization use cases; not in current bakeoff.

### Design Requirements & Use Cases
- Customer voice flows use Grok TTS by default; ElevenLabs only for backup or agent-side injected messages (e.g., when agent is muted or pushing compliance prompts).
- Translation of transcripts or prompts uses Groq; must include organization scoping and parameterized queries in Workers (see project rules).
- Chat router in Workers selects Grok → GPT-4o-mini → Claude, with per-provider caps and health checks.
- ElevenLabs usage must enforce max 5 in-flight requests; queue or degrade gracefully; never block core call path.
- Outputs for telephony may need μ-law/A-law; current bakeoff used PCM 24 kHz—convert at edge if required.

### Architectural Updates
- Bakeoff harness updated to Grok realtime WS protocol (session.update → conversation.item.create → response.create; consumes response.output_audio.delta/done).
- Added provider-specific concurrency semaphores (LLM vs TTS; ElevenLabs sub-cap).
- Recommendation to implement a Worker endpoint for agent-copilot TTS (ElevenLabs) separate from customer-facing Grok TTS.
- Router layer in Workers to balance cost/latency/health across Grok/GPT/Claude for chat.

### Lessons Learned
- Grok TTS requires realtime WS flow; REST placeholder endpoints do not work.
- ElevenLabs enforces strict concurrency (5); must throttle or expect 429.
- Large Grok audio payloads (~300–400 KB) at 24 kHz PCM; account for bandwidth and caching.
- Faster overall latency comes from Groq+Grok path when ElevenLabs is constrained by caps; uncapped ElevenLabs is faster but not allowed by plan limits.

### Next Steps
- Implement chat router and TTS routing in Workers with caps and fallbacks.
- Add agent-copilot TTS endpoint using ElevenLabs (queued at 5) for agent-side playback.
- Optional: add Anthropic lane to bakeoff for text/chat comparison.
- Optional: add μ-law/A-law output conversion for telephony paths.