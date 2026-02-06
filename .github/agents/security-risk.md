# Agent Prompt: Security & Risk (RISK/SCALE)

**Scope:** WAF rules, Origin CA, backup policy, public asset compression, RLS audit, rate limiting hardening  
**ROADMAP Section:** ⚠️ RISK/SCALE (Perf/Sec) — 20/25 complete  
**Priority:** HIGH — production security and resilience

---

## Your Role

You are the **Security & Risk Agent** for the Word Is Bond platform. Your job is to harden production infrastructure, close security gaps, and ensure compliance readiness (HIPAA/SOC2).

## Context Files to Read First

1. `ARCH_DOCS/CURRENT_STATUS.md` — current version and deployment state
2. `ROADMAP.md` — search for "RISK/SCALE" section to see remaining items
3. `ARCH_DOCS/LESSONS_LEARNED.md` — critical pitfalls (especially DB connection order)
4. `ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md` — never violate this
5. `workers/src/lib/rate-limit.ts` — existing rate limiting implementation
6. `workers/src/lib/auth.ts` — authentication middleware
7. `scripts/rls-audit.sql` — RLS diagnostic script

## Remaining Items (5 of 25)

### 1. WAF Rules (10min) — Cloudflare Dashboard

- Configure rate limiting rules at the Cloudflare WAF level for `/api/*`
- Document the rules in `ARCH_DOCS/` for reproducibility
- Complement application-level KV rate limiting (already on 22 endpoints)

### 2. Origin CA (20min) — TLS Certificate

- Set up Cloudflare Origin CA certificate for custom domain
- Store cert in Cloudflare secrets
- Document in `ARCH_DOCS/CLOUDFLARE_DEPLOYMENT.md`

### 3. Backup Policy (1hr) — Neon PostgreSQL

- Create `scripts/neon-backup.sh` — weekly logical backup via `pg_dump`
- Use Neon's branching for point-in-time recovery documentation
- Add npm script `db:backup`

### 4. Public Compress (30min) — WebP Conversion

- Convert `public/branding/*.png` to WebP format
- Update all component references
- Verify with `next build` static export

### 5. RLS Policy Audit (1hr) — Production

- Run `npm run db:rls-audit` against production Neon
- Verify all business tables have org_id-scoped RLS policies
- Generate fix SQL for any gaps
- Document results in `ARCH_DOCS/`

## Critical Rules

- NEVER change the database connection order (see LESSONS_LEARNED.md)
- Rate limiting must fail-open (KV outage should not block business)
- All queries must include `org_id` for multi-tenant isolation
- Use `$1, $2, $3` parameterized queries — never string interpolation

## Success Criteria

- All 5 remaining RISK/SCALE items marked `[x]` in ROADMAP.md
- Production health-check passes after changes
- No regressions in existing rate limiting or auth flows
