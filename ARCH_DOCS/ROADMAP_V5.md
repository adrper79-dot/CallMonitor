# Word Is Bond — Strategic Roadmap v5

**Version:** 5.0 | **Date:** February 14, 2026  
**Status:** Plan approved, execution in progress  
**Target:** Beta launch with 5-10 agencies in 4-6 weeks  
**Pricing:** $80/user/month | **Market:** Georgia/Atlanta mid-market collection agencies

---

## Four Pillars

### Pillar 1: AI Copilot in the Cockpit

**Goal:** Real-time AI assistance during live calls — the "co-pilot" that makes every agent a top performer.

| Week | Deliverable | Status |
|------|-------------|--------|
| 1 | Bond AI Copilot sidebar in Cockpit (backend: `bond-ai.ts` exists) | Backend ready, UI wiring needed |
| 1 | Groq real-time sentiment analysis on active calls | Backend ready (`ai-router.ts`) |
| 2 | Grok-powered objection handling suggestions | Integration needed |
| 2 | Live compliance alerts (FDCPA violation detection) | Backend ready (`compliance-checker.ts`) |
| 3 | Smart script recommendations based on account history | New feature |
| 3 | Post-call summary auto-generation | Transcription pipeline exists |
| 4 | Payment negotiation AI (suggests optimal payment plans) | `PlanBuilder` component exists |

**Existing assets:** `components/bond-ai/BondAICopilot.tsx`, `components/bond-ai/BondAIChat.tsx`, `workers/src/routes/bond-ai.ts`, `workers/src/routes/ai-router.ts`

**Key metric:** Time-to-right-party-contact reduction, payments-per-hour increase

---

### Pillar 2: Self-Service Debtor Portal

**Goal:** Let debtors make payments, set up plans, and communicate without agent involvement — the "AI Closer."

| Week | Deliverable | Status |
|------|-------------|--------|
| 1 | `/portal` route with debtor auth (magic link via Resend) | New |
| 1 | Stripe Elements payment form | Stripe integration exists |
| 2 | Payment plan self-setup (templates from `collection_tasks`) | Schema exists |
| 2 | Grok-powered chat for debtor FAQs | AI infrastructure exists |
| 3 | Promise-to-pay self-service with calendar picker | Booking system exists |
| 3 | Dispute filing portal (integrates with `/compliance/disputes`) | Route exists |
| 4 | Communication preferences & opt-out management | DNC system exists |

**Revenue impact:** Self-service portals recover 15-25% of balances without agent time. Cal.com-style scheduling already proven.

**Key metric:** Self-service payment rate, average resolution time

---

### Pillar 3: Compliance Dashboard & Metrics Marketing

**Goal:** Turn compliance from a cost center into a selling point. "We don't just collect — we prove we collect right."

| Week | Deliverable | Status |
|------|-------------|--------|
| 1 | Compliance scorecard on manager dashboard | Compliance routes exist |
| 1 | FDCPA/TCPA violation trend charts | Analytics pipeline exists |
| 2 | Exportable compliance reports (PDF/CSV) | Reports system exists |
| 2 | Call recording audit trail with AI flagging | Recording + AI exists |
| 3 | Secret Shopper automated QA campaigns | Backend exists (`shopper.ts`) |
| 3 | Compliance comparison vs industry benchmarks | New content |
| 4 | Marketing assets: "Compliance-First Collections" landing content | Case studies page exists |

**Competitive edge:** No competitor in the mid-market combines AI + compliance-first positioning. Skit.ai focuses on enterprise, Moveo.AI on chatbots. Our niche: compliance-obsessed AI voice intelligence.

---

### Pillar 4: Beta Positioning & Go-to-Market

**Goal:** 5-10 beta agencies onboarded with white-glove support. Atlanta/Georgia fintech scene as launchpad.

| Week | Deliverable | Status |
|------|-------------|--------|
| 1 | 5-step onboarding wizard (plan → number → compliance → import → first call) | Partially built |
| 1 | Terms of Service + Privacy Policy pages | Done (this session) |
| 2 | Product tour system activation (`components/tour/`) | Built, needs wiring |
| 2 | Bug reporter + feedback mechanism | Done (this session) |
| 2 | Vertical landing pages (collections, legal, healthcare, property, government) | Pages exist, hidden |
| 3 | API documentation polish (`/api-docs`) | Page exists |
| 3 | Pricing page finalization (`/pricing`) | Page exists |
| 4 | Beta agreement template + onboarding email sequences | New |
| 4 | Analytics Engine integration for public metrics | Cloudflare AE available |

---

## Architecture Health Summary

| Area | Score | Notes |
|------|-------|-------|
| **Code Quality** | A | 2 P1 violations fixed, all core security rules clean |
| **Error Handling** | A- | 8 missing error boundaries added this session |
| **Documentation** | A | ARCH_DOCS reorganized: 92→43 files, zero stale refs |
| **Test Coverage** | B+ | 850+ tests, 53 new nav/RBAC tests, 55 pre-existing failures |
| **Database** | B | 96 tables, 35 orphan tables need cleanup, 5/96 RLS |
| **Feature Exposure** | C+ | 16 hidden API routes, 7 hidden pages — need wiring |
| **Onboarding** | C | Missing compliance step, team invite, payment method |
| **Legal** | B+ | TOS + Privacy now exist, need consent capture at signup |

## Backlog — Prioritized Offenses

### P0 (Block beta launch)
1. Wire `newNav` feature flag to `true` by default — entire new UX is gated behind disabled flag
2. Add compliance configuration step to onboarding (FDCPA calling hours, DNC, disclosures)
3. Add team invite step to onboarding
4. Link TOS/Privacy in signup footer + require consent checkbox
5. Wire Bond AI Copilot into Cockpit sidebar

### P1 (Required for first billing cycle)
6. Expose hidden vertical pages in marketing nav (collections, legal, healthcare, etc.)
7. Wire IVR payment route (`ivr.ts`) into admin settings
8. Wire live translation UI (`live-translation.ts` route exists)
9. Expose recordings management UI (`recordings.ts` route exists)  
10. Expose caller ID management UI (`caller-id.ts` route exists)
11. Activate product tour system (`components/tour/`)
12. Server-persist onboarding completion (currently localStorage only)

### P2 (Polish for paid customers)
13. Clean up 35 orphan database tables (or document as reserved)
14. Add RLS to remaining tables (currently 5/96)
15. Wire secret shopper campaigns UI (`shopper.ts` route exists)
16. Wire TTS demo/testing UI (`tts.ts` route exists)
17. Wire usage metering dashboard (`usage.ts` route exists)
18. Wire reliability metrics UI (`reliability.ts` route exists)
19. Build notification center (beyond toast-only)
20. Build user profile preferences page (timezone, theme, display name)

---

## Success Metrics (4-week targets)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Beta agencies onboarded | 5-10 | Org count in DB |
| Self-service payment rate | 15%+ | Portal conversions / total balances |
| Compliance score | 95%+ | FDCPA/TCPA violation rate < 5% |
| Agent productivity uplift | 20%+ | Calls/hour with AI copilot vs without |
| Recovery rate improvement | 20-35% | $ recovered per campaign vs industry avg |
| MTTR (bugs) | < 24h | Time from bug report to deploy |

## Cost Estimates (Monthly at 10 agencies, ~100 users)

| Service | Cost | Notes |
|---------|------|-------|
| Cloudflare (Pages + Workers + R2 + KV) | $25 | Free tier covers most |
| Neon PostgreSQL (Scale plan) | $69 | 10GB storage, autoscaling |
| Telnyx (voice minutes) | ~$500 | $0.01/min, est. 50k min/mo |
| Groq (AI inference) | ~$100 | Ultra-fast, per-token billing |
| Stripe (payment processing) | 2.9% + $0.30 | Per transaction |
| Resend (email) | $20 | 50k emails/mo |
| **Total infrastructure** | **~$714/mo** | |
| **Revenue (100 users × $80)** | **$8,000/mo** | |
| **Gross margin** | **~91%** | |
