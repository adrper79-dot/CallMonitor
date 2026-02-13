# Architecture Decision Log (ADR)

**TOGAF Phase:** All Phases — Cross-Cutting  
**Version:** 1.0  
**Date:** February 13, 2026  
**Status:** Living Document

---

## ADR Template

```
### ADR-NNN: [Title]
- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Context:** What is the issue?
- **Decision:** What was decided?
- **Consequences:** What happens as a result?
- **Alternatives Considered:** What else was evaluated?
```

---

## Accepted Decisions

### ADR-001: Static Export over Server-Side Rendering
- **Date:** 2025-10-01
- **Status:** Accepted
- **Context:** Next.js supports SSR, SSG, and static export. Cloudflare Pages requires static assets or @cloudflare/next-on-pages adapter (complex, fragile).
- **Decision:** Use `output: 'export'` for pure static HTML/CSS/JS. All server logic lives in Cloudflare Workers.
- **Consequences:** No `getServerSideProps`, no `cookies()`, no `headers()`, no `app/api/` routes. Clean separation between UI and API.
- **Alternatives Considered:** SSR on Vercel (vendor lock-in), @cloudflare/next-on-pages (fragile adapter layer)

### ADR-002: Hono over Express for Workers API
- **Date:** 2025-10-01
- **Status:** Accepted
- **Context:** Workers need a lightweight HTTP framework. Express requires Node.js polyfills on Workers.
- **Decision:** Use Hono 4.7 — native Cloudflare Workers support, TypeScript-first, middleware-compatible.
- **Consequences:** Different framework from typical Node.js stacks; team needs Hono-specific knowledge.
- **Alternatives Considered:** Express (polyfill overhead), Itty Router (too minimal), bare Request/Response (no middleware)

### ADR-003: Neon Serverless over Supabase
- **Date:** 2025-10-15
- **Status:** Accepted
- **Context:** Need managed PostgreSQL compatible with Cloudflare Workers (WebSocket-based connections due to no raw TCP in Workers).
- **Decision:** Neon serverless with `@neondatabase/serverless` driver (uses WebSocket). Hyperdrive for TCP pooling when available.
- **Consequences:** Neon-first connection string order is mandatory (`NEON_PG_CONN || HYPERDRIVE`). Reversing causes HTTP 530.
- **Alternatives Considered:** Supabase (removed — SDK conflicts), PlanetScale (MySQL, not PostgreSQL), CockroachDB (cost)

### ADR-004: Custom Auth over NextAuth
- **Date:** 2025-11-01
- **Status:** Accepted
- **Context:** NextAuth requires server-side components (API routes, `cookies()`). Incompatible with static export.
- **Decision:** Build custom session-based auth in Workers. PBKDF2-SHA256 password hashing, session tokens in KV + PostgreSQL, CSRF protection.
- **Consequences:** More custom code but full control. No library version conflicts. Sessions are Bearer tokens, not cookies.
- **Alternatives Considered:** NextAuth (SSR dependency), Auth0 (cost, external redirect), Clerk (cost, external dependency)

### ADR-005: Telnyx over Twilio for Voice
- **Date:** 2025-11-15
- **Status:** Accepted
- **Context:** Need programmable voice with WebRTC, PSTN, call recording, AMD, and webhook-based call control.
- **Decision:** Telnyx Call Control v2 API with WebRTC via TelnyxRTC SDK. DIDs for branded outbound calling.
- **Consequences:** Telnyx-specific webhook payload format. Call Control v2 API for all operations. WebRTC mic device filtering required.
- **Alternatives Considered:** Twilio (2-3x more expensive), SignalWire (insufficient balance issues, less mature), Vonage (limited WebRTC)

### ADR-006: AI Router — Multi-Provider Strategy
- **Date:** 2026-01-15
- **Status:** Accepted
- **Context:** Single AI provider creates cost lock-in and availability risk. Different tasks have different complexity/cost profiles.
- **Decision:** Intelligent AI Router with complexity scoring (1-10). Groq (Llama 4 Scout) for simple tasks (score <7), Grok (xAI) for complex reasoning (score >=7), OpenAI (GPT-4o-mini) as universal fallback.
- **Consequences:** 38% cost reduction ($4,150/year at 10K ops/month). 3-provider redundancy. Complexity threshold tunable.
- **Alternatives Considered:** OpenAI-only (expensive), Groq-only (limited reasoning), Anthropic (cost)
- **Evidence:** [BAKEOFF_GROK_GROQ_ELEVENLABS.md](05-AI/BAKEOFF_GROK_GROQ_ELEVENLABS.md)

### ADR-007: AI as Notary — No Autonomous Actions
- **Date:** 2025-12-01
- **Status:** Accepted
- **Context:** AI in regulated call centers must not create legal liability. Autonomous AI making calls, confirming payments, or modifying evidence violates FDCPA and introduces unpredictable risk.
- **Decision:** AI operates strictly as notary/stenographer/compliance officer. It observes, records, and assists — never initiates calls, confirms outcomes, or modifies evidence.
- **Consequences:** All AI outputs are marked as "preview" (non-evidentiary). Human agent must confirm/seal all actions.
- **Alternatives Considered:** Autonomous AI agent (regulatory risk), Semi-autonomous with human approval (complexity)
- **Evidence:** [AI_ROLE_POLICY.md](01-CORE/AI_ROLE_POLICY.md)

### ADR-008: Snake Case — Universal Naming Convention
- **Date:** 2025-10-01
- **Status:** Accepted
- **Context:** Mixed naming conventions (camelCase JS, snake_case SQL) cause mapping bugs and query failures.
- **Decision:** snake_case for everything: database columns, API response keys, TypeScript interfaces for API data.
- **Consequences:** Matches PostgreSQL convention natively. No ORM mapping layer. Frontend uses snake_case for API types.
- **Alternatives Considered:** camelCase (JS convention but mismatches DB), auto-mapping (complexity, bugs)

### ADR-009: Cloudflare R2 over S3 for Recording Storage
- **Date:** 2025-11-01
- **Status:** Accepted
- **Context:** Call recordings and evidence bundles need object storage. Workers have native R2 bindings.
- **Decision:** Cloudflare R2 for all file storage (recordings, transcripts, evidence bundles). Native Workers bindings, S3-compatible API.
- **Consequences:** Zero egress fees. Native Workers integration. S3 migration path if needed.
- **Alternatives Considered:** AWS S3 (egress costs, cross-cloud latency), GCS (Google lock-in), Backblaze B2 (limited integrations)

### ADR-010: ElevenLabs → Groq Voice Migration
- **Date:** 2026-01-20
- **Status:** Accepted
- **Context:** ElevenLabs TTS costs $0.30/1K chars. Groq offers competitive TTS at $0.05/1K chars (83% cheaper). Quality acceptable for call center use cases.
- **Decision:** Migrate primary TTS to Groq. Retain ElevenLabs as premium fallback for voice cloning scenarios.
- **Consequences:** 83% TTS cost reduction. Groq API latency acceptable (p50 ~340ms). ElevenLabs still available for high-fidelity needs.
- **Evidence:** [COST_OPTIMIZATION_STRATEGY.md](05-AI/COST_OPTIMIZATION_STRATEGY.md)

### ADR-011: Row-Level Security on All Business Tables
- **Date:** 2026-01-25
- **Status:** Accepted
- **Context:** Multi-tenant SaaS requires database-level isolation beyond application WHERE clauses. A single missed `organization_id` filter leaks cross-tenant data.
- **Decision:** Enable PostgreSQL RLS on all business tables (50+). Policies enforce `organization_id = current_setting('app.org_id')`. Application middleware sets session variable before queries.
- **Consequences:** Defense-in-depth: even if application code has a bug, DB rejects cross-tenant reads. Performance impact negligible with proper indexes.
- **Alternatives Considered:** Application-only filtering (risk of bypass), separate databases per tenant (cost/complexity)

### ADR-012: Stripe for Billing over Custom Implementation
- **Date:** 2025-11-15
- **Status:** Accepted
- **Context:** SaaS billing requires subscription management, usage tracking, invoicing, tax handling, payment retry, and PCI compliance.
- **Decision:** Stripe Billing with webhook-driven event processing. Plans defined in Stripe, mirrored in local DB for feature gating.
- **Consequences:** Stripe handles PCI compliance, payment retries, tax calculation. Webhook processing must be idempotent.
- **Alternatives Considered:** Custom billing (PCI liability), Paddle (limited flexibility), LemonSqueezy (limited enterprise features)

---

## Decision Principles

When making new architecture decisions, apply these criteria:

1. **Edge-first** — Can it run on Cloudflare Workers/Pages?
2. **Compliance-safe** — Does it create regulatory exposure?
3. **Cost-aware** — What's the unit economics at 10K/100K/1M scale?
4. **Audit-friendly** — Is the decision and its rationale recorded?
5. **Vendor-portable** — Can we migrate away if needed?

---

## References

- [ARCHITECTURE_VISION.md](ARCHITECTURE_VISION.md) — Architecture principles and constraints
- [01-CORE/FINAL_STACK.md](01-CORE/FINAL_STACK.md) — Technology stack decisions
- [05-AI/BAKEOFF_GROK_GROQ_ELEVENLABS.md](05-AI/BAKEOFF_GROK_GROQ_ELEVENLABS.md) — AI provider evaluation data
