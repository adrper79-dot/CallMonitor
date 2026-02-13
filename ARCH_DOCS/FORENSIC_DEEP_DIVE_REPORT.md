# FORENSIC DEEP-DIVE REPORT — Word Is Bond Platform

**Date:** February 13, 2026  
**Version Audited:** v4.64  
**Methodology:** Multi-agent forensic analysis — codebase crawl, static security audit, market benchmarking  
**Scope:** 48 API route files, 79 page routes, 144 DB tables, 120+ endpoints, 5 AI providers, Stripe billing, Telnyx voice

---

## Table of Contents

1. [Current Standing](#1-current-standing)
2. [Unknowns & Risks](#2-unknowns--risks)
3. [IT Security & Scalability Focus](#3-it-security--scalability-focus)
4. [Business & Market Focus](#4-business--market-focus)
5. [Next Steps](#5-next-steps)

---

## 1. Current Standing

### Platform Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| **IT Security** | **5.5 / 10** | 4 critical vulns, 6 high vulns. Auth works but has timing side-channel + double-pool. RLS policies exist on paper but `getDb()` never passes `orgId`. Internal routes have zero auth. |
| **Scalability** | **5.0 / 10** | Double DB pool per request (H-3) + rate limiter opens raw connections (C-1) = connection exhaustion at ~25 concurrent users. R2 egress unoptimized. No CDN caching for recordings. |
| **Compliance Infrastructure** | **9.0 / 10** | Immutable evidence chain, 12/12 SoR criteria, FDCPA/TCPA real-time checking, 7-year audit trail. Best-in-class for the price tier. |
| **AI Capability** | **6.0 / 10** | Strong cost optimization (38-83% savings). Co-pilot is advisory-only — categorically behind agentic competitors. No ML scoring. |
| **Product Completeness** | **5.5 / 10** | Voice-only. No SMS/email campaigns, no debtor self-service portal, no credit bureau integration, no SSO. 75 orphan tables, 19 hidden pages, dormant product tours. |
| **Market Readiness** | **6.0 / 10** | $80/user validated by Kolleno/Aktos. Compliance moat is real. But missing mid-market table-stakes (digital channels, consumer portal, agentic AI). |
| **Code Quality** | **7.0 / 10** | Clean architecture (Hono + static Next.js), centralized utilities, Zod validation, structured logging. Undermined by wiring gaps, double-pool pattern, and 75 orphan tables. |
| **DevOps / CI** | **7.5 / 10** | Build GREEN, 123+ tests passing, schema drift checking, backup scripts, health endpoints. No automated E2E pipeline, no SOC 2 process. |
| **OVERALL IT** | **6.0 / 10** | Solid foundation with critical security holes that must close before beta. |
| **OVERALL BUSINESS** | **5.5 / 10** | Unique compliance moat but missing the two capabilities driving 2026 collections revenue: agentic AI and digital-first channels. |

### Competitive Position Map

```
                    HIGH Automation
                         │
           Skit.ai ●     │    ● Moveo.AI
         InDebted ●      │    ● Tratta
                         │
  LOW Compliance ────────┼──────── HIGH Compliance
                         │
          Finvi ●        │    ★ WIB ← HERE
          Aktos ●        │    ● Prodigal
                         │
                    LOW Automation
```

**WIB sits in "High Compliance, Low Automation"** — the most compliance-hardened platform in its price tier, but lacking the automation that drives recovery uplift.

### Competitor Comparison Table

| Capability | WIB | Moveo.AI | Skit.ai | Tratta | Prodigal | Kolleno | InDebted |
|---|---|---|---|---|---|---|---|
| Real-time transcription | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| AI call co-pilot | ✅ Advisory | ✅ Autonomous | ✅ Autonomous | ❌ | ✅ Predictive | ❌ | ✅ Autonomous |
| Compliance engine | ✅ Best-in-tier | ✅ | ✅ | ⚠️ Basic | ✅ Predictive | ⚠️ Basic | ⚠️ Basic |
| Immutable evidence/SoR | ✅ **MOAT** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Debtor self-service portal | ❌ | ❌ | ❌ | ✅ 25% uplift | ❌ | ✅ | ✅ |
| SMS/Email campaigns | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Predictive dialer | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Payment plans | ✅ | ❌ | ❌ | ✅ Self-serve | ❌ | ✅ | ✅ |
| ML likelihood scoring | ❌ Heuristic | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Credit bureau reporting | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SSO/SAML | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Price (per user/mo) | $80 | $150+ | Enterprise | $100+ | $200+ | $80+ | Enterprise |
| **Agentic AI** | ❌ Blocked | ✅ 35% uplift | ✅ 2-5x close | ❌ | ✅ Predictive | ❌ | ✅ |

---

## 2. Unknowns & Risks

### Critical Unknowns (Must Verify Before Beta)

- **RLS hardening migration execution status unknown.** `migrations/2026-02-10-session7-rls-security-hardening.sql` targets 39 tables with RLS. File exists on disk. Whether it was applied to production Neon is UNCONFIRMED. If not applied, zero RLS enforcement on 30+ tables.
- **`getDb()` never receives `orgId` in route handlers.** Even if RLS policies are active in Postgres, `SET LOCAL app.current_org_id` is never called, making RLS policies effectively decorative. This means multi-tenant data isolation relies entirely on `WHERE organization_id = $1` clauses — any missing WHERE is a cross-tenant leak.
- **Internal monitoring routes have zero authentication.** `/api/internal/cron-health`, `/api/internal/webhook-dlq`, `/api/internal/schema-health` are publicly accessible. The DLQ endpoint exposes full Telnyx/Stripe/AssemblyAI webhook payloads including PII.
- **Rate limiter opens raw `pg.Client` on every rate-limited request.** Under brute-force attack, the rate limiter itself becomes the DoS amplifier — each rejected request opens a DB connection, exhausting Neon's 100-300 connection limit.
- **PBKDF2 password verification uses `===` (timing-vulnerable).** A `timingSafeEqual()` function exists in the codebase but isn't used for password comparison.
- **75 of 144 database tables have no active route references.** Whether these are migration artifacts, future-planned, or dead weight is unknown per-table.
- **Product tour system: 4 tours built, only 1 wired.** `VOICE_TOUR`, `DASHBOARD_TOUR`, `SETTINGS_TOUR` are defined but never imported. First-run experience is incomplete.
- **Bond AI Copilot partially wired.** `BondAIChat` is in sidebar. `BondAICopilot` is NOT embedded in any call view. `BondAIAlertsPanel` has no nav entry.

### Strategic Risks

- **AI Role Policy is a strategic ceiling.** The explicit "notary/stenographer" policy blocks agentic AI. Competitors offering autonomous negotiation report 35% recovery uplift. This is the single largest revenue gap.
- **Voice-only in a digital-first market.** Reg F (2021) explicitly permits digital-first collections. 60%+ of 2026 collections start digital. No SMS/email campaign engine exists.
- **AssemblyAI single-vendor dependency.** No transcription fallback. An outage kills the entire voice intelligence pipeline.
- **$80/user × 10 users × 10 agencies = $96K ARR.** This doesn't cover AI inference costs at scale without Groq optimization. Plan for $120-150/user by GA.
- **No SOC 2 Type II certification.** Any agency with 20+ seats will ask. Process takes 6-12 months.
- **Georgia-only GTM limits network effects.** Collections software benefits from cross-agency benchmarking and shared intelligence.

---

## 3. IT Security & Scalability Focus

### Phase 1 — Pre-Beta Critical Fixes (Week 1-2)

| # | Finding | Severity | Fix | Effort | ROI |
|---|---------|----------|-----|--------|-----|
| 1 | **C-1: Rate limiter DB connection per request** | CRITICAL | Remove test-org DB lookup from rate limiter. Use KV flag set at login. | 1h | Prevents DoS amplification — platform survival |
| 2 | **C-2: Internal routes zero auth** | CRITICAL | Add `X-Internal-Key` secret header validation or `requireAuth` + admin role check. | 30m | Closes PII exposure — compliance survival |
| 3 | **C-4: PBKDF2 timing side-channel** | CRITICAL | Replace `===` with existing `timingSafeEqual()` in password verification. | 15m | Closes attack vector — trivial fix, maximum impact |
| 4 | **C-3: RLS context never set** | CRITICAL | Change all `getDb(c.env)` to `getDb(c.env, session.organization_id)` in authenticated routes. Create wrapper middleware. | 4h | Activates 39-table RLS policies — multi-tenant isolation |
| 5 | **H-3: Double DB pool per request** | HIGH | Refactor `verifySession` to accept shared `DbClient` or use request-scoped middleware. | 3h | Halves connection usage — 2x capacity at zero cost |
| 6 | **H-2: No max_tokens cap on AI router** | HIGH | Add `Math.min(body.max_tokens \|\| 4096, 4096)` in Grok/OpenAI calls. | 30m | Prevents $1K+/hr cost explosion |
| 7 | **M-4: DB before Stripe sig verification** | MEDIUM | Move `getDb()` after webhook signature verification succeeds. | 15m | Prevents DB exhaustion via unsigned webhook spam |

**Phase 1 Total Effort: ~10 hours**  
**Phase 1 Impact: Closes all 4 critical + 3 high-severity vulns**

### Phase 2 — Pre-Beta High Priority (Week 2-3)

| # | Finding | Severity | Fix | Effort | ROI |
|---|---------|----------|-----|--------|-----|
| 8 | **H-1: Session token in JSON body** | HIGH | Remove token from JSON response. Rely on HttpOnly cookie for browsers, `X-Session-Token` header for API clients. | 1h | Reduces token leakage surface |
| 9 | **H-4: CSRF fallback token never stored** | HIGH | Return 503 when KV fails instead of unusable fallback token. | 30m | Prevents CSRF confusion |
| 10 | **H-5: Full PII in KV DLQ (7-day)** | HIGH | Strip PII from DLQ payloads. Store metadata + hash only. | 2h | TCPA/HIPAA compliance |
| 11 | **H-6: 100K char AI input** | HIGH | Cap summarize to 20K chars, analyze to 30K chars. Add per-org daily token budget. | 30m | Prevents AI cost abuse |
| 12 | **M-5: Cron errors swallowed** | MEDIUM | Re-throw after logging in `handleScheduled`. | 15m | Makes cron failures visible in Cloudflare dashboard |
| 13 | **M-6: Multi-org user locked to first org** | MEDIUM | Add `org_context` to sessions or `X-Org-Context` header. | 3h | Enables multi-org users (future enterprise feature) |
| 14 | **Verify RLS migration execution** | CRITICAL | Run `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=true` against production. | 15m | Confirms whether 39-table RLS is actually active |

**Phase 2 Total Effort: ~8 hours**

### Phase 3 — Scale Hardening (Week 3-4)

| # | Finding | Severity | Fix | Effort | ROI |
|---|---------|----------|-----|--------|-----|
| 15 | **M-1: WebRTC credential orphaning** | MEDIUM | Cache credential in KV keyed by `webrtc:${user_id}`, 55-min TTL. Add cleanup cron. | 2h | Prevents Telnyx credential exhaustion |
| 16 | **M-2: R2 egress cost bomb** | MEDIUM | Serve recordings via R2 custom domain. Generate presigned URLs with short TTL. Add `Cache-Control`. | 2h | Saves $3.6K/mo at scale (10K users) |
| 17 | **M-3: Fingerprint uses Origin header** | MEDIUM | Remove Origin from fingerprint. Use UA + Accept-Language + Sec-CH-UA. | 1h | Fixes session breaks across subdomains |
| 18 | **M-7: Rate limiter fails open on KV** | MEDIUM | Add in-memory per-isolate fallback counter. Log KV failures at error level. | 2h | Defense-in-depth during KV incidents |
| 19 | **L-1: Test routes in production** | LOW | Gate behind `platform_role === 'super_admin'` check. | 15m | Reduces diagnostic info exposure |
| 20 | **L-4: Idempotency key includes timestamp** | LOW | Remove `Date.now()` from WebRTC dial idempotency key. | 5m | Makes idempotency actually idempotent |

**Phase 3 Total Effort: ~8 hours**

### IT Scoring Breakdown

| Area | Current | After Phase 1 | After Phase 3 | Target |
|------|---------|---------------|---------------|--------|
| Authentication | 5/10 | 7/10 | 8/10 | 9/10 |
| Data Isolation (RLS) | 3/10 | 8/10 | 9/10 | 9/10 |
| Rate Limiting | 4/10 | 7/10 | 8/10 | 9/10 |
| Connection Management | 3/10 | 7/10 | 8/10 | 9/10 |
| AI Cost Controls | 5/10 | 8/10 | 9/10 | 9/10 |
| Monitoring/Observability | 6/10 | 7/10 | 8/10 | 9/10 |
| **Weighted IT Score** | **5.5/10** | **7.5/10** | **8.5/10** | **9/10** |

---

## 4. Business & Market Focus

### Revenue Gap Analysis

| Gap | Annual Impact (per agency) | Difficulty | Priority |
|-----|---------------------------|------------|----------|
| No agentic AI negotiation | $100K-400K unrealized recovery | Hard | Strategic |
| No debtor self-service portal | $30-80K cost savings | Medium | Phase 2 |
| Voice-only (no SMS/email) | $50-150K missed digital collections | Medium | Phase 2 |
| No ML-driven scoring | $20-50K improved prioritization | Medium | Phase 3 |
| Product tours dormant | $10-30K reduced churn | Easy | Phase 1 |
| **Total gap vs. fully-featured competitor** | **$210K-$710K/agency/year** | | |

### Phase 1 — Beta Launch Essentials (Week 1-4)

| # | Action | Impact | Effort | Metric |
|---|--------|--------|--------|--------|
| 1 | **Wire 3 remaining product tours** | First-run experience complete | 4h | Tour completion rate > 60% |
| 2 | **Wire Bond AI Copilot into call views** | AI assistance visible during calls | 4h | Co-pilot usage per call > 30% |
| 3 | **Wire Bond AI Alerts Panel** | Proactive agent coaching activated | 2h | Alert click-through rate |
| 4 | **Enable `NEXT_PUBLIC_NEW_NAV` flag** | New 3-shell UX goes live | 1h | Navigation task completion time -40% |
| 5 | **Lead GTM with evidence/compliance** | Differentiated positioning | Marketing | *"Only platform with court-admissible evidence at $80/user"* |
| 6 | **Rename/repurpose `shopper.ts`** | Removes internal confusion | 1h | Clean route semantics |

**Phase 1 Business Impact: Complete product experience for beta agencies. Unlocks compliance-first positioning.**

### Phase 2 — Market Gap Closure (Month 2-3)

| # | Action | Impact | Effort | Metric |
|---|--------|--------|--------|--------|
| 7 | **Build consumer payment portal** | Debtor self-service → 25% resolution uplift | 3 weeks | Self-service resolution rate |
| 8 | **Add SMS campaign engine** | Digital-first channel (Telnyx already supports SMS) | 2 weeks | Digital contact rate > 40% |
| 9 | **Introduce "supervised autonomy" for Bond AI** | AI drafts responses, agent approves with 1-click | 2 weeks | Response time -50%, close rate +15% |
| 10 | **Build AssemblyAI fallback** | Transcription resilience (Deepgram or Whisper) | 1 week | 99.9% transcription availability |

**Phase 2 Business Impact: Closes 3 of 4 critical market gaps. Moves WIB from "Low Automation" quadrant toward center.**

### Phase 3 — Mid-Market Readiness (Month 4-6)

| # | Action | Impact | Effort | Metric |
|---|--------|--------|--------|--------|
| 11 | **Replace heuristic scorer with ML** | Data-driven prioritization | 4 weeks | Collector efficiency +20% |
| 12 | **Credit bureau integration (E-OSCAR/Metro 2)** | Table-stakes for agencies >$1M placements | 6 weeks | Bureau reporting automation |
| 13 | **SSO/SAML** | Required for 20+ seat agencies | 2 weeks | Enterprise deal qualification |
| 14 | **Start SOC 2 Type II process** | Mid-market sales requirement (6-12 month process) | Ongoing | Certification timeline |
| 15 | **Price increase to $120-150/user** | Revenue sustainability at scale | Pricing exercise | ARPU +50-87% |

**Phase 3 Business Impact: Qualifies WIB for 20-50 seat mid-market deals. Enables price increase.**

### Business Scoring Breakdown

| Area | Current | After Phase 1 | After Phase 2 | After Phase 3 |
|------|---------|---------------|---------------|---------------|
| Product Completeness | 5.5/10 | 6.5/10 | 8.0/10 | 9.0/10 |
| Market Differentiation | 7/10 | 8/10 | 8.5/10 | 9/10 |
| Revenue Potential | 4/10 | 5/10 | 7/10 | 8.5/10 |
| Competitive Position | 5/10 | 6/10 | 7.5/10 | 8.5/10 |
| GTM Readiness | 5/10 | 7/10 | 8/10 | 9/10 |
| **Weighted Business Score** | **5.5/10** | **6.5/10** | **7.8/10** | **8.8/10** |

### Unit Economics at Scale

| Metric | 10 Users (Beta) | 100 Users | 500 Users |
|--------|-----------------|-----------|-----------|
| MRR | $800 | $8,000 | $40,000+ |
| Infrastructure (Cloudflare + Neon + AI) | ~$714/mo | ~$2,100/mo | ~$8,500/mo |
| Gross Margin | ~11% | ~74% | ~79% |
| AI cost per user (Groq-optimized) | ~$12/mo | ~$8/mo | ~$5/mo |
| **Sustainable?** | ❌ Not viable | ✅ Healthy | ✅ Strong |

*Note: $80/user is a penetration price. At 100+ users with Phase 3 features, $120-150/user is justified and competitive.*

---

## 5. Next Steps

### Immediate (This Week)

1. **Fix C-1 through C-4** — Four critical security vulns, ~6 hours total. Non-negotiable before any beta user touches the system.
2. **Verify RLS migration** — Run one SQL query against production Neon to confirm 39-table RLS is active.
3. **Fix H-3 (double pool)** — Halves DB connection usage. 3 hours.

### Before Beta Launch (Week 2-4)

4. **Complete Phase 1 IT fixes** — Total ~10 hours. Closes all critical/high vulns.
5. **Wire product tours, Bond AI Copilot, Alerts Panel** — ~10 hours. Completes the product experience.
6. **Enable new navigation flag** — 1 hour. Activates the 3-shell UX.
7. **Set GTM messaging** — Lead with compliance/evidence moat, not features.

### Post-Beta (Month 2-6)

8. **Consumer payment portal + SMS campaigns** — Closes the two biggest market gaps.
9. **Supervised autonomy for Bond AI** — Bridge between advisory and autonomous.
10. **SOC 2 Type II + SSO** — Begin the 6-12 month certification.

### Decision Required: AI Role Policy

The current "notary/stenographer" policy explicitly blocks autonomous AI negotiation. This is the single largest revenue gap ($100K-400K/agency/year) vs. competitors. Options:

- **A) Maintain strict policy** — Accept voice-intelligence + compliance niche positioning. Target agencies that value defensibility over recovery uplift.
- **B) Introduce "supervised autonomy"** — AI drafts negotiation responses within guardrails. Every commitment requires human approval. Preserves compliance posture while unlocking ~15-35% recovery uplift.
- **C) Full agentic mode (opt-in)** — Highest revenue potential, highest compliance risk. Requires fine-tuned models + regulatory review.

**Recommendation:** Option B. It's the pragmatic middle ground. The immutable evidence infrastructure already supports logging AI actions with full provenance. "Supervised autonomy" is a unique market position: *"AI-assisted negotiation with court-admissible evidence of every decision."*

---

## Appendix: Finding Reference

| ID | Severity | Area | Summary |
|----|----------|------|---------|
| C-1 | CRITICAL | Rate Limiter | DB connection per rate-limited request → DoS amplifier |
| C-2 | CRITICAL | Internal Routes | Zero auth on monitoring/DLQ/replay endpoints |
| C-3 | CRITICAL | RLS | `getDb()` called without orgId → RLS policies inactive |
| C-4 | CRITICAL | Auth | PBKDF2 timing side-channel via `===` |
| H-1 | HIGH | Auth | Session token in JSON body → leakage vector |
| H-2 | HIGH | AI Router | No max_tokens cap → cost explosion |
| H-3 | HIGH | DB | Double pool per request → connection exhaustion |
| H-4 | HIGH | CSRF | Fallback token never stored → unusable |
| H-5 | HIGH | Webhooks | Full PII payloads in KV DLQ for 7 days |
| H-6 | HIGH | AI LLM | 100K char input → $1K+/hr abuse potential |
| M-1 | MEDIUM | WebRTC | Orphaned credentials, no reuse/cleanup |
| M-2 | MEDIUM | R2 | Egress cost bomb at scale ($3.6K/mo) |
| M-3 | MEDIUM | Auth | Fingerprint uses Origin (breaks across subdomains) |
| M-4 | MEDIUM | Webhooks | DB pool opened before Stripe sig verification |
| M-5 | MEDIUM | Cron | Errors swallowed, silent failures |
| M-6 | MEDIUM | Auth | Multi-org user locked to first org |
| M-7 | MEDIUM | Rate Limit | Fails open on KV outage → no protection |
| M-8 | MEDIUM | Workers | PBKDF2 CPU time under load |
| L-1 | LOW | Test | Test routes in prod |
| L-2 | LOW | CORS | Preview URL wildcard |
| L-3 | LOW | Signup | Silent org creation failure |
| L-4 | LOW | WebRTC | Idempotency key includes timestamp |
| L-5 | LOW | Auth | Legacy hash timing attack |

---

*Report generated by multi-agent forensic analysis. All findings based on static code review — no production data was accessed.*
