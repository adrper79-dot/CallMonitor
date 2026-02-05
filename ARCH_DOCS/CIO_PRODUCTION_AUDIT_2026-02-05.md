# 🏛️ CIO Production Audit — Wordis Bond

**Date:** February 5, 2026  
**Auditor:** Shrewd Savvy CIO  
**Verdict:** ⛔ **NOT PRODUCTION READY** — 5 Critical, 7 High-priority issues  
**Estimated Sprint to Production:** 3–4 weeks (2 devs)

---

## Executive Summary

**Wordis Bond** — "The System of Record for Business Conversations" by Latimer + Woods Tech LLC — is an ambitious, feature-rich voice operations platform. The architecture is sound (Next.js static → Cloudflare Pages, Hono API → Cloudflare Workers, Neon Postgres). The schema is thorough (113+ public tables, immutable evidence patterns, full-text search, compliance tracking). The feature surface is impressive for a pre-revenue product.

**However, the system has critical security vulnerabilities, dead code sprawl, and integration gaps that disqualify it from handling real customer data.** The issues below are not architectural — the bones are good — but the code has accumulated security shortcuts, dual-write zombies, and unfinished integrations that must be resolved before any customer sees this system.

---

## 🔴 CRITICAL — Must Fix Before Any Customer Touches This

### C1. Database Credentials Committed to Git
- **File:** `workers/wrangler.toml` → `localConnectionString` contains full Neon production credentials in plaintext
- **Impact:** Anyone with repo access (including GitHub if public) has full database read/write
- **Fix:** Remove from file, rotate the Neon password immediately, add to `.gitignore`, use `wrangler secret put` exclusively
- **Effort:** 30 min + credential rotation

### C2. Password Hashing Is SHA-256 (Not bcrypt/argon2)
- **File:** `workers/src/lib/auth.ts` → `hashPassword()` uses single-round SHA-256 + random salt
- `bcryptjs` is in `package.json` but **not used** in Workers auth
- **Impact:** If DB is ever compromised, all passwords are trivially crackable with GPU attacks
- **Fix:** Replace with `bcryptjs.hash()` (already a dependency). Migrate existing hashes with "hash on next login" pattern
- **Effort:** 2 hours

### C3. CSRF Validation Is Theater
- **File:** `workers/src/routes/auth.ts` — CSRF endpoint generates a token, but the login endpoint only checks if *any* token is present — never compares it to the issued one
- **Impact:** Any random string passes CSRF validation. Cross-site request forgery attacks are possible
- **Fix:** Store CSRF token server-side (KV or session), validate exact match on submission
- **Effort:** 2 hours

### C4. Stripe Webhook Signature Not Verified
- **File:** `workers/src/routes/webhooks.ts` — `stripe.webhooks.constructEvent()` is commented out. Raw body is parsed without signature check
- **Impact:** Anyone can forge Stripe events → free subscriptions, billing manipulation
- **Fix:** Uncomment and implement `constructEvent()` with webhook signing secret
- **Effort:** 1 hour

### C5. Telnyx Webhook Has No Signature Verification
- **File:** `workers/src/routes/webhooks.ts` — `/webhooks/telnyx` accepts any POST body
- **Impact:** Forged call events, fake recordings, phantom call completions
- **Fix:** Implement Telnyx webhook signature verification (HMAC-SHA256)
- **Effort:** 1 hour

---

## 🟠 HIGH — Fix Before Real Customers

### H1. Zero Input Validation (Zod)
- **Scope:** 0 of 23 worker route files use Zod for request validation
- Every endpoint does manual `await c.req.json()` with unchecked destructuring
- Signup accepts any email format. Phone numbers aren't validated. Payloads aren't size-limited
- **Fix:** Add Zod schemas to all POST/PUT endpoints (start with auth, calls, voice, webhooks)
- **Effort:** 8 hours across all routes

### H2. Session Token in JSON Response Body (XSS Vector)
- `POST /api/auth/callback/credentials` returns `sessionToken` in JSON → stored in `localStorage` by frontend
- HttpOnly cookie is also set but frontend prefers the localStorage path
- **Impact:** Any XSS vulnerability leaks the session token
- **Fix:** Use HttpOnly cookies exclusively, remove token from JSON response, add `SameSite=Strict`
- **Effort:** 4 hours (requires frontend AuthProvider refactor)

### H3. Pool Not Closed After Query (Connection Leak)
- `workers/src/lib/db.ts` → `getDb()` creates a `Pool` per call but never closes it
- Neon serverless requires explicit `pool.end()` within the request handler
- **Impact:** Connection exhaustion under load → cascading 500 errors
- **Fix:** Wrap in `using` pattern or close in `finally` block. Or switch to single `neon()` tagged template (no pool needed)
- **Effort:** 2 hours

### H4. Billing Routes Return Hardcoded Fake Data
- `workers/src/routes/billing.ts` returns `plan: "Pro"` for all users regardless of Stripe state
- Subscription manager, invoice history, and payment method UI all operate on stub data
- **Impact:** Users see fake plan info. No actual billing enforcement
- **Fix:** Connect to Stripe API, implement `createCheckoutSession`, `cancelSubscription`, `listInvoices`
- **Effort:** 2–3 days

### H5. Build Ignores TypeScript Errors and ESLint Errors
- `next.config.js` → `ignoreBuildErrors: true` + `ignoreDuringBuilds: true`
- **Impact:** Type errors and lint violations silently ship to production
- **Fix:** Turn off `ignoreBuildErrors`, fix all type errors, remove `ignoreDuringBuilds`
- **Effort:** 4–8 hours to fix existing errors, then enforce

### H6. 57 `console.log` in Workers Production Code
- `auth.ts` alone has 24 — logging PII (emails, user IDs, password validation results, full session objects)
- **Impact:** PII leak through Cloudflare Logs → compliance violation
- **Fix:** Replace with structured logger that redacts PII, or remove entirely
- **Effort:** 3 hours

### H7. Four Zombie Auth Schemas in the Database
| Schema | Tables | Status |
|--------|--------|--------|
| `public.users` + `public.sessions` | Active | ✅ Primary — Workers auth uses this |
| `authjs.users` + `authjs.sessions` | Zombie | ⚠️ Written to during signup, cleaned by cron |
| `next_auth.users` + `next_auth.sessions` | Dead | ❌ Unused, occupying space |
| `neon_auth.user` + `neon_auth.session` | Provisioned | ❌ Never integrated |
| `auth.*` (Supabase GoTrue) | Legacy | ❌ Supabase remnant, 20 tables |

- Signup dual-writes to `authjs.users` unnecessarily
- Cron job cleans `authjs.sessions` and `authjs.verification_tokens` — wasted compute
- **Fix:** Remove dual-write from signup, drop `authjs`, `next_auth`, `neon_auth` schemas, remove Supabase `auth` schema if not needed
- **Effort:** 4 hours

---

## 🟡 MEDIUM — Tech Debt & Code Quality

### M1. Legacy SignalWire Code Still Present
- 3 SignalWire packages in `package.json` (`@signalwire/js`, `@signalwire/realtime-api`, `@signalwire/webrtc`)
- `contexts/SignalWireContext.tsx` still exists
- `lib/signalwire/` directory still present
- Tests reference `SIGNALWIRE_*` env vars
- **Status:** Telnyx is the current telephony provider. SignalWire is dead code
- **Fix:** Remove all SignalWire packages, contexts, lib, test references
- **Effort:** 2 hours

### M2. `_api_to_migrate/` Directory Still Present
- Contains dead NextAuth route handler that returns 404
- Should have been deleted when auth migrated to Workers
- **Fix:** Delete `app/_api_to_migrate/` entirely
- **Effort:** 5 minutes

### M3. API Client Has Double-Prefix Bug
- `lib/api-client.ts` — Several methods construct URLs like `` `${API_BASE}/api/auth/session` `` where `API_BASE` already includes the full workers URL
- **Impact:** Some frontend API calls may break with malformed URLs (double `https://...`)
- **Fix:** Audit all `apiGet`/`apiPost`/`apiPut` call sites, ensure no double-prefix
- **Effort:** 2 hours

### M4. R2 Signed URLs Not Implemented
- `recordings.ts` serves recording URLs without presigned access
- **Impact:** Recording URLs are either publicly accessible or return 403
- **Fix:** Implement R2 `createPresignedUrl()` with expiry
- **Effort:** 2 hours

### M5. No Error Boundaries in React Components
- Zero `ErrorBoundary` wrappers found in the component tree
- A single unhandled error in voice-operations crashes the entire page
- **Fix:** Add `ErrorBoundary` at route level and around critical components
- **Effort:** 2 hours

### M6. No Rate Limiting on Auth Endpoints
- Login endpoint has no brute-force protection
- Signup has no rate limiting
- **Fix:** Implement KV-backed rate limiter (`lib/rateLimit.ts` exists but unused in Workers)
- **Effort:** 3 hours

### M7. 30-Day Session Expiry (No Refresh Token)
- Sessions live for 30 days with no rotation
- For a compliance-grade product, this is excessive
- **Fix:** Implement 24h access token + 7-day refresh token with rotation
- **Effort:** 4 hours

---

## 🟢 LOW — Future Improvements

| # | Issue | Effort |
|---|-------|--------|
| L1 | Enable Sentry in Workers (configured but not verified) | 1h |
| L2 | WAF rules in Cloudflare Dashboard (rate limit `/api/*`) | 30m |
| L3 | Implement Neon backup verification script | 1h |
| L4 | Add Playwright E2E tests for critical flows | 8h |
| L5 | Consolidate dependency versions (root vs workers `package.json`) | 1h |
| L6 | WebP conversion for public assets | 30m |
| L7 | Generate OpenAPI spec from Zod schemas (once Zod is added) | 2h |
| L8 | Implement idempotency keys for webhook delivery | 2h |

---

## 📊 Database Health Assessment

### Live Project: `WordIsBond` (misty-sound-29419685)
- **PostgreSQL:** v17
- **Branch:** `production` (primary, default)
- **Compute:** 0.25–2 CU, auto-suspend: 0s (always on)
- **Storage:** ~42 MB
- **Compute Used:** 70,322 seconds (~19.5 hours)
- **Region:** aws-us-east-1

### Schema Statistics
| Schema | Tables | Purpose | Verdict |
|--------|--------|---------|---------|
| `public` | 113 | Application data | ✅ Active |
| `auth` | 20 | Supabase GoTrue (legacy) | ⚠️ Drop if not using Supabase auth |
| `authjs` | 4 | NextAuth (zombie dual-write) | 🗑️ Remove |
| `next_auth` | 4 | NextAuth (dead) | 🗑️ Remove |
| `neon_auth` | 9 | Neon Auth (never integrated) | 🗑️ Remove |
| `storage` | 9 | Supabase Storage (legacy) | ⚠️ Evaluate — using R2 now |
| `realtime` | 10 | Supabase Realtime (legacy) | 🗑️ Remove |
| `graphql` | 7 functions | Supabase PostgREST/GraphQL | 🗑️ Remove |
| `extensions` | views/funcs | pg_stat_statements | ✅ Keep |

### Observations
- **Index coverage is excellent** — every foreign key has an index, query patterns are well-indexed
- **Immutable data patterns** — triggers prevent update/delete on evidence, audit, and observation tables ✅
- **Full-text search** — `search_documents` with GIN index on `tsvector` ✅
- **No RLS policies found** — multi-tenant isolation is code-level only (org_id WHERE clauses)
- **Stale realtime messages** — `realtime.messages_2026_01_*` are stale partitioned tables from Supabase

### Recommended Database Actions
1. **Drop zombie schemas:** `authjs`, `next_auth`, `neon_auth`, `realtime`, `graphql`
2. **Evaluate Supabase schemas:** `auth`, `storage` — if fully migrated to Workers + R2, drop them
3. **Add RLS policies** on `calls`, `recordings`, `voice_configs` for defense-in-depth
4. **Consider partitioning** `audit_logs` and `calls` by date for future scale

---

## 🤖 STRATEGIC RECOMMENDATION: Application-Side AI Assistant

### What You Need
Your customers are organizations that make business calls (property management, legal, healthcare, government). When they have issues, they shouldn't have to call *you*. The platform should help them.

### Proposed: "Bond AI" — In-App Customer Intelligence Agent

**Tier 1: Contextual Help (Build First — 1 week)**
- Floating chat widget on every page
- Pre-loaded with product documentation, feature guides, and troubleshooting
- Uses OpenAI (already integrated) with a system prompt grounded in your ARCH_DOCS
- Answers "How do I set up a campaign?", "Why did my call fail?", "How do I add a team member?"
- **Database-backed:** Query `calls` table to explain specific call failures to the user

**Tier 2: Proactive Issue Detection (Build Second — 2 weeks)**
- Analyze failed calls, low scores, and compliance violations automatically
- Surface alerts: "3 calls failed today due to invalid caller ID — fix it here →"
- Weekly digest emails: "Your team made 47 calls this week. 3 had compliance issues."
- Uses existing `alerts`, `incidents`, `digests` tables (already in your schema!)

**Tier 3: Voice AI Co-Pilot (Future — 1 month)**
- Real-time guidance during active calls (confirmation prompts, compliance reminders)
- Post-call auto-summary with suggested outcome declarations
- "Smart Shopper" — AI evaluates call quality in real-time, not just post-call
- Leverages existing `ai_summaries`, `ai_runs`, `shopper_results` tables

### Technical Architecture
```
┌──────────────────────────────────────────────────────┐
│                    BOND AI                            │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Chat Widget  │  │ Alert Engine │  │ Call Co-Pilot│ │
│  │ (Tier 1)     │  │ (Tier 2)     │  │ (Tier 3)     │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │        │
│  ┌──────▼─────────────────▼──────────────────▼──────┐│
│  │              OpenAI API (GPT-4o-mini)             ││
│  │              + RAG over ARCH_DOCS + DB            ││
│  └──────────────────────┬────────────────────────────┘│
│                          │                             │
│  ┌──────────────────────▼────────────────────────────┐│
│  │  Workers Route: POST /api/ai/chat                  ││
│  │  - Auth-gated (session required)                   ││
│  │  - Context: user's org, recent calls, config       ││
│  │  - Rate limited: 20 msgs/min per user              ││
│  └────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### Implementation Plan
| Component | Route | Table | Effort |
|-----------|-------|-------|--------|
| Chat Widget (React) | — | — | 2 days |
| AI Chat API | `POST /api/ai/chat` | `ai_runs` | 1 day |
| Knowledge Base Loader | — | System prompts from ARCH_DOCS | 1 day |
| Proactive Alerts | Cron job | `alerts`, `incidents` | 2 days |
| Digest Emails | Cron job + Resend | `digests`, `digest_items` | 2 days |

---

## 👥 STRATEGIC RECOMMENDATION: Team Management Improvements

### Current State
- Basic invite system exists (`team_invites` table, invite/accept flow)
- Roles: `owner`, `admin`, `viewer` (3 tiers)
- Team page in Settings shows members and pending invites
- No team activity feeds, no role granularity, no department/team grouping

### What's Missing for Production-Grade Team Management

#### 1. Role Granularity (RBAC Enhancement)
Current roles are too coarse. A compliance officer shouldn't need admin access.

| Role | Current | Proposed Capabilities |
|------|---------|----------------------|
| `owner` | Full access | Full access + billing + delete org |
| `admin` | Full access | Manage team + settings + campaigns |
| `manager` | ❌ Missing | View all calls + assign targets + run reports |
| `agent` | ❌ Missing | Make/receive calls + view own calls only |
| `compliance` | ❌ Missing | View compliance reports + evidence + audit logs (read-only) |
| `viewer` | Read-only | View dashboards + reports (no PII) |

**Implementation:** Extend `org_members.role` enum, update RBAC middleware in Workers, add permission matrix to `rbac.ts`

#### 2. Team Structure (Departments)
For organizations with 10+ agents, flat team lists don't scale.

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);
```

#### 3. Activity Feed
- Who made what calls, when
- Who changed what settings
- Who invited/removed team members
- **Table:** `audit_logs` already captures this — just need a filtered view in the UI

#### 4. Org Switching
- Users can belong to multiple organizations (already supported via `org_members`)
- Need UI to switch active org context
- Need API to set `currentOrganization` in session

#### 5. SSO Enforcement
- `org_sso_configs` table exists with 32 columns — schema is ready
- Implementation needed: SAML/OIDC flow in Workers auth
- Critical for enterprise customers (healthcare, government verticals)

---

## 📋 Production Sprint Plan

### Week 1 — Security (BLOCKER)
| Task | Est. | Owner |
|------|------|-------|
| Rotate Neon credentials, remove from git | 30m | DevOps |
| Implement bcrypt password hashing + migration | 3h | Backend |
| Fix CSRF validation (server-side token compare) | 2h | Backend |
| Implement Stripe webhook signature verification | 1h | Backend |
| Implement Telnyx webhook signature verification | 1h | Backend |
| Remove `console.log` from Workers (replace with structured logger) | 3h | Backend |
| Session tokens: switch to HttpOnly cookies only | 4h | Full-stack |
| **Week 1 Total** | **~15h** | |

### Week 2 — Data Integrity & Billing
| Task | Est. | Owner |
|------|------|-------|
| Fix DB connection leak (Pool.end() or switch to neon()) | 2h | Backend |
| Add Zod validation to auth, calls, voice, webhooks | 8h | Backend |
| Connect billing routes to Stripe API (real data) | 16h | Backend |
| Drop zombie auth schemas (authjs, next_auth, neon_auth) | 2h | DBA |
| Remove SignalWire dependencies and dead code | 2h | Cleanup |
| Delete `_api_to_migrate/` directory | 10m | Cleanup |
| Fix API client double-prefix bug | 2h | Frontend |
| **Week 2 Total** | **~32h** | |

### Week 3 — Quality & Resilience
| Task | Est. | Owner |
|------|------|-------|
| Enable TypeScript strict build (fix type errors) | 8h | Full-stack |
| Add Error Boundaries to React components | 2h | Frontend |
| Implement KV-backed rate limiting on auth endpoints | 3h | Backend |
| Implement R2 presigned URLs for recordings | 2h | Backend |
| Add Sentry to Workers (edge init) | 1h | DevOps |
| Configure WAF rules in Cloudflare Dashboard | 30m | DevOps |
| Implement Bond AI Tier 1 (chat widget + API) | 24h | Full-stack |
| **Week 3 Total** | **~40h** | |

### Week 4 — Polish & Launch
| Task | Est. | Owner |
|------|------|-------|
| E2E test: sign up → create org → make call → view recording | 4h | QA |
| E2E test: Stripe checkout → subscription active → plan enforced | 4h | QA |
| Enhanced team roles (manager, agent, compliance) | 8h | Backend |
| Proactive alerts (Bond AI Tier 2) | 16h | Full-stack |
| Security audit (self-serve or contracted) | 8h | Security |
| Production launch checklist sign-off | 2h | CIO |
| **Week 4 Total** | **~42h** | |

---

## 🎯 What Else Do We Need? (CIO's Strategic View)

### Before First Paying Customer
1. ✅ **Working voice calls** — Done (Telnyx WebRTC + Call Control)
2. ⛔ **Working billing** — Stripe stubs must become real
3. ⛔ **Security hardened** — 5 critical items above
4. ⛔ **One complete E2E flow tested** — Sign up → Subscribe → Call → Record → Transcribe → Evidence
5. 🟡 **Usage enforcement** — Free tier limits must actually block (currently no enforcement)

### Before 10 Customers
6. **Bond AI Tier 1** — Customers self-serve their own issues
7. **Enhanced RBAC** — Managers and agents need proper role separation
8. **SSO** — Enterprise customers will require it
9. **Data retention automation** — Cron jobs to enforce retention policies

### Before 100 Customers
10. **Bond AI Tier 2** — Proactive alerts and weekly digests
11. **Team/department grouping** — Flat member lists don't scale
12. **Org switching** — Multi-org users need context switching
13. **CRM integrations** — Salesforce, HubSpot connectors (tables exist, implementation pending)
14. **Load testing** — Verify Workers handle concurrent call load

### Before 1,000 Customers
15. **Bond AI Tier 3** — Real-time call co-pilot
16. **SOC 2 certification** — Compliance tables are ready, need policy enforcement
17. **HIPAA compliance** — Neon supports HIPAA flag, need to enable
18. **Multi-region** — Additional Workers and Neon branches in EU/APAC
19. **White-label support** — Custom branding per organization

---

## Summary Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | 9/10 | Solid hybrid edge architecture |
| **Schema Design** | 9/10 | Thorough, well-indexed, immutable patterns |
| **Feature Breadth** | 8/10 | Impressive for pre-revenue |
| **Security** | 3/10 | 5 critical vulnerabilities |
| **Code Quality** | 5/10 | 57 console.logs, no Zod, connection leaks |
| **Billing** | 1/10 | Completely stubbed |
| **Testing** | 4/10 | 123 unit tests pass, 0 E2E, 87 skipped |
| **Documentation** | 8/10 | ARCH_DOCS are thorough |
| **Production Readiness** | ⛔ 4/10 | Security + billing must be fixed |

**Bottom Line:** The architecture is excellent. The schema is enterprise-grade. The feature set is ambitious and largely implemented. But the security posture and billing integration are dealbreakers. Fix the 5 critical items in Week 1, then the 7 high items in Week 2, and this system is ready for its first paying customer by Week 4.

---

*"The system captures commitments. Let's make sure it can keep its own." — CIO*
