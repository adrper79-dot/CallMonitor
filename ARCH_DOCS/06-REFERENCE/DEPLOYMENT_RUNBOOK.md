# Deployment Runbook - Word Is Bond Platform

**Version:** 1.1
**Date:** February 18, 2026
**Status:** Production Ready

---

## Overview

This runbook provides step-by-step deployment procedures for the Word Is Bond platform. The platform uses a **hybrid Cloudflare architecture** with automated CI/CD pipelines.

**Architecture Summary:**

- **UI:** Next.js 15 static export → Cloudflare Pages
- **API:** Hono 4.7 → Cloudflare Workers
- **Database:** Neon PostgreSQL 17 with Hyperdrive
- **Storage:** Cloudflare R2
- **CDN:** Cloudflare CDN (global distribution)

---

## Deployment Pipeline

### Automated CI/CD (GitHub Actions)

**Triggers:**

- Push to `main` branch
- Pull request merges
- Manual dispatch

**Pipeline Stages:**

1. **Lint & Test** (`npm run lint && npm test`)
2. **Deploy Workers** (`npm run api:deploy`)
3. **Build Static UI** (`npm run build`)
4. **Deploy Pages** (`npm run pages:deploy`)
5. **Health Check** (`npm run health-check`)
6. **Rollback** (if health check fails)

### Manual Deployment

#### Prerequisites

```bash
# Install dependencies
npm ci

# Verify environment
npm run env:verify

# Run tests
npm test
```

#### Step 1: Deploy API (Workers) First

```bash
# Deploy to Cloudflare Workers
npm run api:deploy

# Verify deployment
curl -X GET "https://wordisbond-api.adrper79.workers.dev/health"
```

#### Step 2: Deploy UI (Pages) Second

```bash
# Build static export
npm run build

# Deploy to Cloudflare Pages
npm run pages:deploy

# Verify deployment
curl -X GET "https://wordis-bond.com"
```

#### Step 3: Health Check

```bash
# Run comprehensive health check
npm run health-check

# Check key endpoints
curl -X GET "https://wordisbond-api.adrper79.workers.dev/health"
curl -X POST "https://wordisbond-api.adrper79.workers.dev/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

---

## Environment Management

### Environment Variables

**Required Variables:**

```bash
# Workers secrets (server-side only)
NEON_PG_CONN=postgresql://...
AUTH_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
TELNYX_API_KEY=...
OPENAI_API_KEY=...
ASSEMBLYAI_API_KEY=...
RESEND_API_KEY=...
CRM_ENCRYPTION_KEY=...

# Workers bindings (configured in wrangler.toml, not secret values)
HYPERDRIVE=<binding>
KV=<binding>
R2=<binding>
TRANSCRIPTION_QUEUE=<binding>

# Pages variables (build/static only)
NEXT_PUBLIC_API_BASE_URL=https://wordisbond-api.adrper79.workers.dev
NEXT_PUBLIC_APP_URL=https://wordis-bond.com

# CI/deployment context (GitHub Actions or local shell)
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

### Secret Placement Standard

For this architecture (static Next.js on Pages + runtime API on Workers), backend secrets belong in **Workers secrets**, not Pages.

| Variable Type | Location | Notes |
| --- | --- | --- |
| Database/auth/provider secrets | Workers secrets | Includes `NEON_PG_CONN`, `AUTH_SECRET`, provider keys, webhook secrets |
| Runtime service bindings | Workers bindings | `HYPERDRIVE`, `KV`, `R2`, `TRANSCRIPTION_QUEUE` |
| Public build-time values | Pages vars (`NEXT_PUBLIC_*`) | Safe for browser exposure only |
| Backend secrets in Pages | Prohibited | Remove immediately to avoid drift/confusion |

### Secret Audit & Cleanup

```bash
# Audit Pages secrets (production)
npx wrangler pages secret list --project-name wordisbond

# Audit Pages secrets (preview)
npx wrangler pages secret list --project-name wordisbond --env preview

# Audit Workers secrets
npx wrangler secret list --config workers/wrangler.toml

# Remove misplaced Pages secret
npx wrangler pages secret delete <SECRET_NAME> --project-name wordisbond
```

Current baseline: `wordisbond` Pages production secrets are empty; keep them empty unless a true static build variable is required.

### Environment Promotion

**Development → Staging → Production:**

1. **Dev Deploy:** Automatic on push to `develop` branch
2. **Staging Deploy:** Manual approval required
3. **Prod Deploy:** Requires PR review + approval

---

## Rollback Procedures

### Automatic Rollback (CI/CD)

If health check fails, pipeline automatically:

1. Reverts Workers deployment
2. Reverts Pages deployment
3. Sends alert to #devops Slack channel

### Manual Rollback

#### Rollback Workers

```bash
# List versions
wrangler deployments list

# Rollback to previous version
wrangler deployments rollback <deployment-id>
```

#### Rollback Pages

```bash
# Via Cloudflare Dashboard
# Or via wrangler
wrangler pages deployment rollback <deployment-id>
```

---

## Monitoring & Alerting

### Health Checks

**Endpoints:**

- `/api/health` - Database, KV, R2 connectivity
- `/api/health/detailed` - Full system status

**Checks Performed:**

- Database connection (Neon/Hyperdrive)
- KV storage access
- R2 storage access
- External API connectivity
- Worker cold start performance

### Alerting

**Sentry Integration:**

- Error tracking for both UI and API
- Performance monitoring
- Release tracking

**Logpush:**

- Workers logs → Cloudflare Logpush → Analytics
- Custom metrics and events

---

## Database Migrations

### Migration Process

**Before Deployment:**

```bash
# Backup database
pg_dump --format=custom --compress=9 > backup_$(date +%Y%m%d_%H%M%S).dump

# Run migrations locally
npm run db:migrate
```

**During Deployment:**

```bash
# Migrations run automatically in CI/CD
# Zero-downtime migrations only
npm run db:migrate:safe
```

### Rollback Migrations

```bash
# List applied migrations
npm run db:migrate:status

# Rollback specific migration
npm run db:migrate:down <migration-name>
```

---

## Performance Benchmarks

### Target Performance

| Metric           | Target | Current |
| ---------------- | ------ | ------- |
| **Page Load**    | <2s    | 1.2s    |
| **API Response** | <500ms | 120ms   |
| **Cold Start**   | <3s    | 800ms   |
| **Uptime**       | 99.9%  | 99.95%  |

### Load Testing

```bash
# Run Artillery tests
npm run test:load

# Test scenarios:
# - 100 concurrent calls
# - 1000 API requests/min
# - Voice call simulation
```

---

## Security Deployment

### Pre-Deployment Security

**Automated Checks:**

- Dependency vulnerability scan
- Secret leakage detection
- Code security analysis

**Manual Reviews:**

- Security team approval for production
- Penetration testing results
- Compliance audit status

### Post-Deployment

**Security Monitoring:**

- WAF rule effectiveness
- Rate limiting performance
- Authentication success rates

---

## Incident Response

### Deployment Failure

1. **Immediate:** Stop deployment pipeline
2. **Assess:** Check health check logs
3. **Rollback:** Automatic or manual rollback
4. **Investigate:** Root cause analysis
5. **Fix:** Address issues in codebase
6. **Redeploy:** After fixes verified

### Production Incident

1. **Alert:** PagerDuty notification
2. **Assess:** Check monitoring dashboards
3. **Mitigate:** Enable maintenance mode if needed
4. **Rollback:** If caused by recent deployment
5. **Communicate:** Update stakeholders
6. **Resolve:** Fix and redeploy

---

## Maintenance Windows

### Scheduled Maintenance

**Monthly (1st Sunday, 2-4 AM EST):**

- Database maintenance
- Security updates
- Performance optimizations

**Emergency Maintenance:**

- As needed for critical security issues
- Announced 24h in advance when possible

---

## Contact Information

**Development Team:**

- #devops Slack channel
- devops@wordisbond.com

**On-Call Engineer:**

- PagerDuty rotation
- Emergency: +1-555-0100

**Vendor Support:**

- Cloudflare: enterprise@cloudflare.com
- Neon: support@neon.tech
- Telnyx: support@telnyx.com
  </content>
  <parameter name="filePath">c:\Users\Ultimate Warrior\My project\gemini-project\ARCH_DOCS\04-GUIDES\DEPLOYMENT_RUNBOOK.md
