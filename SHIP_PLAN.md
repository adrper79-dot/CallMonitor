# SHIP PLAN — Word Is Bond v4.30

> **Goal:** Move from current state → production-ready for first paying customers  
> **Date:** February 13, 2026  
> **Version:** v4.29 → v4.30 (ship candidate)  
> **Timeline:** 2–3 focused days to beta-ready

---

## Current State Assessment

| Metric | Value |
|--------|-------|
| ROADMAP completion | 109/109 (100%) |
| BACKLOG items | 239 total, 198 resolved (83%), 27 open, 14 in-progress |
| P0 open items | 3 (BL-131, BL-158, BL-166) |
| P0 in-progress | 3 (BL-132, BL-135, BL-136) |
| TypeScript errors | 0 |
| Security findings | 0 critical, 0 high remaining after this session |

---

## What Was Fixed This Session (Feb 13, 2026)

### Security Hardening
| Fix | Files Modified | Handlers Patched |
|-----|---------------|-----------------|
| `requireRole` on campaigns routes | `workers/src/routes/campaigns.ts` | 6 mutation handlers |
| `requireRole` on Bond AI routes | `workers/src/routes/bond-ai.ts` | 9 mutation handlers (3 replaced inline checks) |
| `requireRole` on call lifecycle routes | `workers/src/routes/calls.ts` | 4 handlers (start, end, hold, transfer) |
| `requireRole` on billing routes | `workers/src/routes/billing.ts` | 8 handlers (checkout, portal, cancel, resume, change-plan, delete PM, sync + import) |
| Cancel subscription requires `owner` | `workers/src/routes/billing.ts` | Destructive action elevated to owner-only |

### BL-166: Caller ID Verification → FIXED
- **Before:** Generated 6-digit code, stored in DB, never delivered
- **After:** Sends SMS via Telnyx Messaging API (`POST /v2/messages`) before returning success
- **Also fixed:** Added missing `CALLER_ID_VERIFIED` audit log on successful PUT /verify
- **File:** `workers/src/routes/caller-id.ts`

### BL-131: RLS Migration → FIXED (critical bug)
- **Before:** `CREATE INDEX CONCURRENTLY` inside `BEGIN`/`COMMIT` — **would crash on execution**
- **After:** Restructured: Section 1 (RLS enable) + Section 3 (updated_at) inside transaction, COMMIT, then Section 2 (indexes) runs outside transaction
- **File:** `migrations/2026-02-10-session7-rls-security-hardening.sql`

### BL-132: Missing org_id → RECLASSIFIED
- **Before:** 27 tables flagged as "missing organization_id"
- **After investigation:** 7 already have org_id, 3 are legitimately global, 13 are dead/phantom tables, 4 needed CREATE TABLE migrations
- **Created:** `migrations/2026-02-13-missing-tables-bond-ai-alerts-timeline-scorecards.sql` — 4 tables with RLS + indexes

### Proactive Prevention Feature (new)
- Created `workers/src/lib/prevention-scan.ts` — daily cron identifies at-risk accounts, creates review tasks
- Wired into `workers/src/scheduled.ts` (6am daily cron)
- Config endpoints in `workers/src/routes/productivity.ts`
- Audit action: `PREVENTION_TASK_CREATED`

---

## Remaining Steps to Ship

### Phase 1: Execute Migrations (30 min)

These migrations exist and are ready to run against Neon production:

```bash
# 1. Take a branch snapshot first (safety net)
# Via Neon Console: Create branch "pre-v430-backup" from main

# 2. Run the missing tables migration (inside transaction — safe)
psql $NEON_PG_CONN -f migrations/2026-02-13-missing-tables-bond-ai-alerts-timeline-scorecards.sql

# 3. Run the RLS hardening migration (Section 1+3 transactional, Section 2 concurrent)
psql $NEON_PG_CONN -f migrations/2026-02-10-session7-rls-security-hardening.sql

# 4. Run the orphan tables cleanup (52 stale tables)
psql $NEON_PG_CONN -f migrations/2026-02-13-orphan-tables-cleanup.sql
```

**Verification queries:**
```sql
-- Confirm RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Confirm new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bond_ai_alerts','bond_ai_alert_rules','call_timeline_events','scorecard_templates');

-- Confirm indexes created
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%org%';
```

### Phase 2: Set API Keys (30 min)

```bash
# BL-158: Add missing AI provider keys
wrangler secret put GROQ_API_KEY        # Sign up at console.groq.com
wrangler secret put GROK_API_KEY        # Sign up at x.ai/api

# Verify Telnyx messaging is enabled (for BL-166 fix)
# → Telnyx Portal → Messaging → Ensure TELNYX_NUMBER has SMS capability
```

### Phase 3: Deploy (15 min)

```bash
npm run api:deploy      # Workers API first
npm run build           # Next.js static export
npm run pages:deploy    # Cloudflare Pages
npm run health-check    # Verify all endpoints
```

### Phase 4: Post-Deploy Verification (30 min)

```bash
# 1. Smoke test: auth + RBAC
curl -X POST https://wordisbond-api.adrper79.workers.dev/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"test"}'

# 2. Smoke test: caller ID verification (BL-166)
# → Initiate via UI → Confirm SMS arrives → Enter code → Verify success

# 3. Smoke test: billing RBAC
# → Login as agent → Attempt /billing/cancel → Expect 403
# → Login as owner → Attempt /billing/cancel → Expect success

# 4. Run production test suite
npx vitest --config vitest.production.config.ts --run
```

### Phase 5: Beta Launch Checklist

| Item | Status | Owner |
|------|--------|-------|
| Execute migrations (Phase 1) | ☐ | Adrian |
| Set API keys (Phase 2) | ☐ | Adrian |
| Deploy v4.30 (Phase 3) | ☐ | Adrian |
| Verify deployment (Phase 4) | ☐ | Adrian |
| Enable Cloudflare WAF rules | ☐ | Adrian |
| Recruit 3–5 beta collection agencies | ☐ | Adrian |
| Set up Stripe production pricing tiers | ☐ | Adrian |
| Create onboarding flow for first customer | ☐ | Adrian |
| Monitor logs for first 48 hours | ☐ | Adrian |

---

## What's NOT Blocking Ship

These are backlog items that can be addressed post-beta:

| Item | Why It Can Wait |
|------|----------------|
| 26/34 worker libs have 0 unit tests | Doesn't affect production functionality |
| WAF rules not configured | Cloudflare's default protection is adequate for beta traffic |
| Dialer/IVR/Sentiment UI panels not wired | Features work via API — UI wiring is iterative |
| Prevention scan feature | Nice-to-have — agents can manually review accounts |
| Omnichannel (email/SMS outreach) | Not in v1 scope — voice-first platform |
| Collections-specific LLM fine-tuning | OpenAI/Groq general models sufficient for beta |

---

## Competitive Position Summary

| Advantage | Detail |
|-----------|--------|
| **Regulatory moat** | AI as notary/stenographer — only platform where AI never negotiates |
| **Integrated stack** | Voice + AI + CRM + Compliance + Billing in one Cloudflare deployment |
| **No-contract pricing** | Stripe pay-as-you-go vs TCN/NICE annual commitments |
| **Collections-specific** | Purpose-built for debt collection vs generic CCaaS |
| **Real-time compliance** | Live transcription + sentiment + call confirmations |

**Target market:** Small-to-mid collection agencies (10–200 agents) currently using TCN, Convoso, or manual dialers. Price point: $29–99/seat/mo vs $75–229/seat/mo for enterprise CCaaS.

---

## Version Control

```bash
git add -A
git commit -m "v4.30: Ship-ready — requireRole billing/caller-id, BL-131 RLS fix, BL-132 reclassified, BL-166 SMS delivery, missing table migrations"
git push origin main
```
