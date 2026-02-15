# Vendor Documentation Registry

**TOGAF Phase:** D — Technology Architecture  
**Status:** Active  
**Last Updated:** February 14, 2026  
**Version:** 1.0

---

## Purpose

This document consolidates official vendor documentation links for all external technologies, services, and APIs used in the Word Is Bond platform. Use this as the authoritative source for vendor integration references.

---

## Core Infrastructure

### Cloudflare

| Service | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Cloudflare Pages** | Static UI hosting (Next.js export) | https://developers.cloudflare.com/pages/ |
| **Cloudflare Workers** | Edge API runtime (Hono framework) | https://developers.cloudflare.com/workers/ |
| **Cloudflare R2** | Object storage (recordings, evidence) | https://developers.cloudflare.com/r2/ |
| **Cloudflare KV** | Key-value store (sessions, rate limits) | https://developers.cloudflare.com/kv/ |
| **Cloudflare Queues** | Message queue (transcription processing) | https://developers.cloudflare.com/queues/ |
| **Cloudflare Hyperdrive** | Database connection pooling | https://developers.cloudflare.com/hyperdrive/ |
| **Cloudflare WAF** | Web Application Firewall | https://developers.cloudflare.com/waf/ |
| **Cloudflare Turnstile** | Bot protection | https://developers.cloudflare.com/turnstile/ |
| **Cloudflare Analytics** | Observability & metrics | https://developers.cloudflare.com/analytics/ |
| **Cloudflare Logpush** | Log export to SIEM | https://developers.cloudflare.com/logs/ |
| **Cloudflare Access** | Zero Trust access control | https://developers.cloudflare.com/cloudflare-one/ |

**Support:**
- Documentation: https://developers.cloudflare.com/
- Dashboard: https://dash.cloudflare.com/
- Status: https://www.cloudflarestatus.com/
- Community: https://community.cloudflare.com/

---

### Neon Database

| Component | Purpose | Official Documentation |
|-----------|---------|----------------------|
| **Neon PostgreSQL 17** | Primary database (serverless) | https://neon.tech/docs/introduction |
| **Neon Branching** | Dev/staging database copies | https://neon.tech/docs/guides/branching |
| **Neon RLS** | Row-level security policies | https://neon.tech/docs/guides/rls |
| **Neon API** | Programmatic database management | https://api-docs.neon.tech/reference/getting-started-with-neon-api |
| **Neon Connection Pooling** | Built-in connection management | https://neon.tech/docs/connect/connection-pooling |

**Key Features:**
- WebSocket connections (primary mode for Workers)
- TCP connections (via Hyperdrive for pooling)
- Serverless compute auto-scale
- Point-in-time recovery (PITR)
- HIPAA-eligible (with BAA)

**Support:**
- Documentation: https://neon.tech/docs
- API Reference: https://api-docs.neon.tech/
- Console: https://console.neon.tech/
- Status: https://neonstatus.com/
- Discord: https://discord.gg/neon

---

## Telephony & Communication

### Telnyx

| Service | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Call Control v2** | Outbound/inbound call management | https://developers.telnyx.com/docs/api/v2/call-control |
| **WebRTC** | Browser-based voice calls | https://developers.telnyx.com/docs/v2/webrtc |
| **SIP Trunking** | PSTN connectivity | https://developers.telnyx.com/docs/v2/sip-trunking |
| **Media Streams** | Real-time audio streaming (forking) | https://developers.telnyx.com/docs/api/v2/call-control/Call-Commands#CallFork |
| **Messaging API** | SMS send/receive | https://developers.telnyx.com/docs/api/v2/messaging |
| **Number Management** | DID provisioning & routing | https://developers.telnyx.com/docs/v2/numbers |
| **Webhooks** | Event notifications | https://developers.telnyx.com/docs/v2/development/webhooks |

**Integration Points:**
- Webhook URL: `https://wordisbond-api.adrper79.workers.dev/api/webhooks/telnyx`
- Authentication: API Key v2
- Phone Format: E.164 standard

**Support:**
- Documentation: https://developers.telnyx.com/
- Portal: https://portal.telnyx.com/
- Support: https://support.telnyx.com/
- Status: https://status.telnyx.com/

**Compliance:**
- TCPA Compliance Guide: https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts
- HIPAA BAA available on request

---

### Resend (Email Delivery)

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Send API** | Transactional email delivery | https://resend.com/docs/api-reference/emails/send-email |
| **Webhooks** | Email event notifications | https://resend.com/docs/dashboard/webhooks/introduction |
| **Domains** | Email authentication (DKIM, SPF) | https://resend.com/docs/dashboard/domains/introduction |

**Events:**
- `email.sent`, `email.delivered`, `email.bounced`, `email.opened`, `email.clicked`, `email.complained`

**Support:**
- Documentation: https://resend.com/docs
- Dashboard: https://resend.com/dashboard
- Status: https://resend.com/status

**Compliance:**
- CAN-SPAM Act: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- Unsubscribe handling: One-click unsubscribe (RFC 8058)

---

## AI & Machine Learning

### AssemblyAI

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Real-Time Transcription** | Live call transcription via WebSocket | https://www.assemblyai.com/docs/walkthroughs#realtime-streaming-transcription |
| **Async Transcription** | Batch audio file processing | https://www.assemblyai.com/docs/walkthroughs#transcribing-an-audio-file |
| **Speaker Diarization** | Speaker identification | https://www.assemblyai.com/docs/speech-to-text/speaker-diarization |
| **PII Redaction** | Automatic sensitive data removal | https://www.assemblyai.com/docs/audio-intelligence/pii-redaction |
| **Sentiment Analysis** | Call sentiment detection | https://www.assemblyai.com/docs/audio-intelligence/sentiment-analysis |

**Key Specs:**
- WebSocket endpoint: `wss://api.assemblyai.com/v2/realtime/ws`
- Sample rate: 16kHz recommended
- Audio format: PCM16, mulaw, alaw
- Latency: <2 seconds for real-time

**Support:**
- Documentation: https://www.assemblyai.com/docs
- API Reference: https://www.assemblyai.com/docs/api-reference
- Status: https://status.assemblyai.com/

---

### Grok (xAI)

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Grok API** | Advanced AI reasoning (Bond AI) | https://docs.x.ai/docs |
| **Chat Completions** | Conversational AI | https://docs.x.ai/api-reference/chat-completions |

**Models:**
- `grok-beta` — Latest production model
- Context window: 131,072 tokens
- Output: 8,192 tokens max

**Support:**
- Documentation: https://docs.x.ai/
- Console: https://console.x.ai/
- Status: https://status.x.ai/

---

### Groq

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Llama 3.3 70B** | Cost-optimized AI tasks | https://console.groq.com/docs/models |
| **Llama 4 Scout** | Translation & simple tasks | https://console.groq.com/docs/models |
| **Inference Speed** | Low-latency LLM (500+ tokens/sec) | https://groq.com/ |

**Key Features:**
- Ultra-fast inference (LPU architecture)
- OpenAI-compatible API
- Cost: ~90% cheaper than GPT-4

**Support:**
- Documentation: https://console.groq.com/docs
- Console: https://console.groq.com/
- Pricing: https://groq.com/pricing/

---

### OpenAI

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **GPT-4o-mini** | Fallback LLM | https://platform.openai.com/docs/models/gpt-4o-mini |
| **Chat Completions** | Conversational AI | https://platform.openai.com/docs/api-reference/chat |
| **Embeddings** | Semantic search | https://platform.openai.com/docs/guides/embeddings |

**Models Used:**
- `gpt-4o-mini` — Primary fallback
- Context: 128K tokens
- Structured outputs supported

**Support:**
- Documentation: https://platform.openai.com/docs
- API Reference: https://platform.openai.com/docs/api-reference
- Status: https://status.openai.com/

---

### ElevenLabs

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Text-to-Speech** | Voice synthesis for translation | https://elevenlabs.io/docs/api-reference/text-to-speech |
| **Voice Cloning** | Custom voice creation | https://elevenlabs.io/docs/voicelab/instant-voice-cloning |
| **Streaming** | Real-time audio generation | https://elevenlabs.io/docs/api-reference/streaming |

**Key Specs:**
- Latency: ~300ms first chunk
- Output formats: MP3, PCM, mulaw
- Languages: 29+ supported

**Support:**
- Documentation: https://elevenlabs.io/docs
- Dashboard: https://elevenlabs.io/app
- Pricing: https://elevenlabs.io/pricing

---

## Payment Processing

### Stripe

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Payment Intents** | One-time payments | https://stripe.com/docs/payments/payment-intents |
| **Subscriptions** | Recurring billing | https://stripe.com/docs/billing/subscriptions/overview |
| **Usage Metering** | Pay-as-you-go billing | https://stripe.com/docs/billing/subscriptions/usage-based |
| **Webhooks** | Payment event notifications | https://stripe.com/docs/webhooks |
| **Customer Portal** | Self-service billing management | https://stripe.com/docs/billing/subscriptions/integrating-customer-portal |

**Webhook Events:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Security:**
- Webhook signature verification: HMAC-SHA256
- PCI DSS Level 1 compliant

**Support:**
- Documentation: https://stripe.com/docs
- Dashboard: https://dashboard.stripe.com/
- Status: https://status.stripe.com/

---

## Frontend & Development

### Next.js 15

| Component | Purpose | Official Documentation |
|-----------|---------|----------------------|
| **App Router** | File-based routing | https://nextjs.org/docs/app |
| **Static Export** | Pre-rendered HTML (output: 'export') | https://nextjs.org/docs/app/building-your-application/deploying/static-exports |
| **Server Components** | NOT USED (static export only) | N/A |
| **Metadata API** | SEO & social cards | https://nextjs.org/docs/app/api-reference/functions/generate-metadata |

**Constraints:**
- ❌ No `getServerSideProps`, `getStaticProps`, `getStaticPaths`
- ❌ No API routes in `/app/api/`
- ❌ No `cookies()`, `headers()`, dynamic imports
- ✅ Static generation only

**Support:**
- Documentation: https://nextjs.org/docs
- GitHub: https://github.com/vercel/next.js
- Learn: https://nextjs.org/learn

---

### Hono 4.7

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Routing** | API endpoint definitions | https://hono.dev/api/routing |
| **Middleware** | Auth, CORS, rate limiting | https://hono.dev/api/middleware |
| **Validation** | Zod schema integration | https://hono.dev/helpers/validation |
| **Cloudflare Workers** | Edge runtime integration | https://hono.dev/getting-started/cloudflare-workers |

**Key Features:**
- Ultra-fast routing (trie-based)
- TypeScript type inference
- Zero dependencies
- Cloudflare Workers native

**Support:**
- Documentation: https://hono.dev/
- GitHub: https://github.com/honojs/hono
- Discord: https://discord.gg/hono

---

### React 19

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **React 19** | UI library | https://react.dev/ |
| **TypeScript** | Type safety | https://react.dev/learn/typescript |
| **Hooks** | State management | https://react.dev/reference/react |

**Support:**
- Documentation: https://react.dev/
- GitHub: https://github.com/facebook/react

---

### TailwindCSS 4

| Component | Purpose | Official Documentation |
|-----------|---------|----------------------|
| **Utility Classes** | CSS framework | https://tailwindcss.com/docs |
| **Dark Mode** | Theme switching | https://tailwindcss.com/docs/dark-mode |
| **Responsive Design** | Mobile-first breakpoints | https://tailwindcss.com/docs/responsive-design |

**Support:**
- Documentation: https://tailwindcss.com/docs
- GitHub: https://github.com/tailwindlabs/tailwindcss

---

### shadcn/ui

| Component | Purpose | Official Documentation |
|-----------|---------|----------------------|
| **Component Library** | Radix UI + Tailwind components | https://ui.shadcn.com/ |
| **Accessibility** | ARIA-compliant patterns | https://ui.shadcn.com/docs/components |

**Key Components Used:**
- Button, Dialog, Select, Table, Toast, Badge, Card, Tabs

**Support:**
- Documentation: https://ui.shadcn.com/
- GitHub: https://github.com/shadcn/ui

---

## Validation & Testing

### Zod

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Schema Validation** | Runtime type checking | https://zod.dev/ |
| **TypeScript Integration** | Infer types from schemas | https://zod.dev/?id=type-inference |

**Support:**
- Documentation: https://zod.dev/
- GitHub: https://github.com/colinhacks/zod

---

### Vitest

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **Unit Testing** | Fast test runner | https://vitest.dev/ |
| **Coverage** | Code coverage reporting | https://vitest.dev/guide/coverage |

**Support:**
- Documentation: https://vitest.dev/
- GitHub: https://github.com/vitest-dev/vitest

---

### Playwright

| Feature | Purpose | Official Documentation |
|---------|---------|----------------------|
| **E2E Testing** | Browser automation | https://playwright.dev/ |
| **Multi-Browser** | Chromium, Firefox, WebKit | https://playwright.dev/docs/browsers |

**Support:**
- Documentation: https://playwright.dev/
- GitHub: https://github.com/microsoft/playwright

---

## Standards & Protocols

### Standards Implemented

| Standard | Purpose | Official Specification |
|----------|---------|----------------------|
| **E.164** | International phone number format | https://en.wikipedia.org/wiki/E.164 |
| **Ed25519** | Webhook signature verification | https://tools.ietf.org/html/rfc8032 |
| **HMAC-SHA256** | Webhook HMAC signing | https://tools.ietf.org/html/rfc2104 |
| **JWT** | Token-based authentication | https://jwt.io/ |
| **WebRTC** | Real-time communication | https://webrtc.org/ |
| **WebSocket** | Bidirectional communication | https://datatracker.ietf.org/doc/html/rfc6455 |
| **OAuth 2.0** | Authorization framework | https://oauth.net/2/ |
| **OpenAPI 3.1** | API specification | https://spec.openapis.org/oas/v3.1.0 |
| **RFC 8058** | One-click unsubscribe | https://datatracker.ietf.org/doc/html/rfc8058 |

---

## Compliance Frameworks

| Framework | Purpose | Official Resource |
|-----------|---------|------------------|
| **SOC 2 Type II** | Security & availability controls | https://www.aicpa.org/soc4so |
| **HIPAA** | Healthcare data protection | https://www.hhs.gov/hipaa/ |
| **TCPA** | Telephone consumer protection | https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts |
| **CAN-SPAM** | Email marketing compliance | https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business |
| **GDPR** | EU data protection | https://gdpr.eu/ |
| **PCI DSS** | Payment card security | https://www.pcisecuritystandards.org/ |

---

## Integration Patterns

### Webhook Signature Verification

**Telnyx:** Ed25519 signature
- Docs: https://developers.telnyx.com/docs/v2/development/webhooks#signature-verification

**Stripe:** HMAC-SHA256
- Docs: https://stripe.com/docs/webhooks/signatures

**Resend:** Standard bearer token
- Docs: https://resend.com/docs/dashboard/webhooks/event-structure

---

## Monitoring & Observability

### Cloudflare Analytics

- **Workers Analytics:** https://developers.cloudflare.com/workers/observability/analytics-engine/
- **Pages Analytics:** https://developers.cloudflare.com/pages/platform/analytics/
- **Logpush:** https://developers.cloudflare.com/logs/logpush/

### Neon Monitoring

- **Query Insights:** https://neon.tech/docs/guides/query-performance
- **Metrics API:** https://neon.tech/docs/manage/metrics

---

## Version Pinning (Production Stack)

| Technology | Version | Rationale |
|------------|---------|-----------|
| Next.js | 15.5.7 | Latest stable (static export) |
| React | 19.2.4 | Latest stable |
| TypeScript | 5.9.3 | Latest stable |
| Hono | 4.7.x | Cloudflare Workers compatible |
| Tailwind CSS | 4.1.18 | Latest stable |
| Neon PostgreSQL | 17 | Latest major version |
| Cloudflare Workers Runtime | Latest | Auto-managed |
| Node.js | 24.12.0 | LTS (local dev only) |

---

## Vendor BAA Requirements (HIPAA Compliance)

### BAA Confirmed
- ✅ Neon Database (Enterprise plan)
- ✅ Cloudflare (Enterprise plan)
- ✅ Telnyx (on request)

### BAA Pending Verification
- ⚠️ AssemblyAI (confirm BAA status)
- ⚠️ ElevenLabs (confirm BAA status)
- ⚠️ Resend (no PHI transmitted)

### No BAA Required
- ❌ Grok/xAI (no PHI transmitted)
- ❌ Groq (no PHI transmitted)
- ❌ OpenAI (no PHI transmitted)
- ❌ Stripe (payment data only, PCI DSS)

---

## Support Contacts

| Vendor | Support Channel | SLA (if applicable) |
|--------|----------------|---------------------|
| Cloudflare | Enterprise Support Ticket | 1-hour response (SEV-1) |
| Neon | Discord + Email | 24-hour response |
| Telnyx | Portal + Email | 4-hour response |
| Stripe | Email + Chat | 24-hour response |
| AssemblyAI | Email | Best effort |
| Grok/xAI | Email | Best effort |
| Groq | Discord | Best effort |
| OpenAI | Email | Best effort |
| ElevenLabs | Email | Best effort |
| Resend | Email | Best effort |

---

## Disaster Recovery Resources

| Vendor | Status Page | Incident History |
|--------|-------------|------------------|
| Cloudflare | https://www.cloudflarestatus.com/ | Public incidents |
| Neon | https://neonstatus.com/ | Public incidents |
| Telnyx | https://status.telnyx.com/ | Public incidents |
| Stripe | https://status.stripe.com/ | Public incidents |
| AssemblyAI | https://status.assemblyai.com/ | Public incidents |
| OpenAI | https://status.openai.com/ | Public incidents |

---

## Updates & Changelog

| Date | Change | Updated By |
|------|--------|------------|
| 2026-02-14 | Initial vendor documentation registry | Architecture Team |

---

## Related Documents

- [FINAL_STACK.md](../01-CORE/FINAL_STACK.md) - Canonical technology stack
- [INTEGRATION_CONTEXT.md](../03-INFRASTRUCTURE/INTEGRATION_CONTEXT.md) - System-of-systems diagram
- [NETWORK_TOPOLOGY.md](../03-INFRASTRUCTURE/NETWORK_TOPOLOGY.md) - Infrastructure architecture

---

**Maintenance:** Review quarterly or when new vendors are onboarded.
