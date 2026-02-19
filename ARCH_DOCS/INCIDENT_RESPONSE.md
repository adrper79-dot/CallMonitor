# Incident Response Runbook — Word Is Bond

**Version:** 1.0  
**Created:** February 18, 2026  
**Owner:** Platform Operations  
**Applies To:** `wordisbond-api` (Cloudflare Workers) + `wordis-bond.com` (CF Pages) + Neon PG 17

---

## Severity Definitions

| Level | Name | Definition | Response SLA | Example |
|-------|------|------------|-------------|---------|
| **P0** | Critical | Complete service outage OR data loss/corruption | Immediate — 15 min | API returns 5xx for all requests; DB unreachable; PII data exposure |
| **P1** | Major | Core feature unavailable for >50% of users | 1 hour | Voice calls failing; Stripe webhooks not processing; auth loop |
| **P2** | Minor | Feature degraded or broken for subset of users | 4 hours | Transcriptions failing; campaign emails not sending; analytics wrong |
| **P3** | Low | Non-critical bug, cosmetic, single user report | Next business day | UI display error; minor copy issue; a single user can't log in |

---

## P0 — Critical Response Protocol

### Step 1: Assess (< 5 minutes)
```bash
# 1. Check API health
curl -s https://wordisbond-api.adrper79.workers.dev/api/health | jq .

# 2. Check CF Worker status via tail
npx wrangler tail wordisbond-api --format pretty --config workers/wrangler.toml

# 3. Check Neon DB connectivity
node -e "const {Client} = require('pg'); const c = new Client({connectionString: process.env.NEON_PG_CONN}); c.connect().then(() => c.query('SELECT 1')).then(() => { console.log('DB OK'); c.end() }).catch(e => console.error('DB FAIL:', e.message))"

# 4. Check CF Pages status
curl -s -o /dev/null -w "%{http_code}" https://wordis-bond.com/
```

### Step 2: Rollback Workers (< 10 minutes)

**Option A: Roll back to previous Workers deployment**
```bash
# List recent deployments
npx wrangler deployments list --config workers/wrangler.toml

# Roll back to previous version (replace VERSION_ID with actual ID)
npx wrangler rollback VERSION_ID --config workers/wrangler.toml
```

**Option B: Roll back via CF Dashboard**
1. Cloudflare Dashboard → Workers & Pages → `wordisbond-api`
2. Deployments tab → Select previous deployment → "Rollback"

### Step 3: Rollback Pages (< 5 minutes)
1. Cloudflare Dashboard → Workers & Pages → `wordisbond`
2. Deployments tab → Find last known-good deployment → "Rollback to this deployment"

### Step 4: DB Rollback via Neon PITR (< 30 minutes)
```bash
# Step A: Create a Neon branch from a point before the incident
# Neon Console → Branching → New Branch → From timestamp: [time before incident]
# OR use CLI:
npx neonctl branches create --project-id <PROJECT_ID> --name incident-restore-$(date +%Y%m%d) --timestamp "2026-02-18T10:00:00Z"

# Step B: Verify the branch looks correct
# Neon Console → Branch → Connection string → copy

# Step C: Update NEON_PG_CONN secret to point at restore branch
npx wrangler secret put NEON_PG_CONN --config workers/wrangler.toml
# (paste branch connection string when prompted)

# Step D: Redeploy workers to pick up new secret
npm run api:deploy

# Step E: Once verified, promote branch to main via Neon Console
# Neon Console → Branch → "Set as Primary"
```

### Step 5: Communicate
- Update `status.wordis-bond.com` with incident note
- Email affected customers from `noreply@wordis-bond.com`
- Post-mortem within 48 hours

---

## P1 — Major Incident Protocol

### Voice/Telnyx Outage
```bash
# Check Telnyx status
curl -s https://status.telnyx.com/api/v2/status.json | jq '.status.description'

# Telnyx webhook not receiving events — check signature header
npx wrangler tail wordisbond-api --format json | grep -i "telnyx"

# If Telnyx API keys rotated — update secret:
npx wrangler secret put TELNYX_API_KEY --config workers/wrangler.toml
npx wrangler secret put TELNYX_WEBHOOK_SECRET --config workers/wrangler.toml
npm run api:deploy
```

### Stripe Webhook Not Processing
```bash
# Verify Stripe webhook secret
npx wrangler secret put STRIPE_WEBHOOK_SECRET --config workers/wrangler.toml

# Check webhook delivery in Stripe Dashboard
# Stripe → Developers → Webhooks → wordisbond endpoint → Recent deliveries

# Re-process failed events (Stripe Dashboard → re-send)
```

### Auth Loop / Users Can't Log In
```bash
# Check JWT secret hasn't changed
npx wrangler secret list --config workers/wrangler.toml

# If AUTH_SECRET changed, all existing tokens are invalid
# Options: (A) restore old AUTH_SECRET value, or (B) accept forced re-login
npx wrangler secret put AUTH_SECRET --config workers/wrangler.toml
npm run api:deploy
```

### Transcription Queue Backup
```bash
# Check queue depth in CF Dashboard
# Cloudflare → Workers & Pages → Queues → wordisbond-transcription → Metrics

# Force-consumer by increasing retries or triggering manual batch
# DLQ consumer will mark failed transcriptions and alert automatically
# Check DLQ: wordisbond-transcription-dlq metrics in CF Dashboard
```

---

## P2 — Degraded Feature Protocol

### Campaign Emails Not Sending
```bash
# Check Resend API key
npx wrangler secret list --config workers/wrangler.toml | grep RESEND

# Check Resend dashboard for bounces/failures
# app.resend.com → Emails → filter by domain wordis-bond.com

# Resend rate limits: 100 emails/day on free tier → upgrade if needed
```

### Analytics Data Wrong
```bash
# Check for failed aggregation cron (runs daily at midnight)
npx wrangler tail wordisbond-api --format json | grep "cron\|aggregat"

# Manually trigger aggregation (POST to internal endpoint)
curl -X POST https://wordisbond-api.adrper79.workers.dev/api/internal/usage-aggregation \
  -H "Authorization: Bearer $PLATFORM_ADMIN_TOKEN"
```

---

## Deployment Commands Reference

```bash
# Full deploy chain (use this for production releases)
npm run api:deploy          # Workers first
npm run build               # Next.js static export
npm run pages:deploy        # Pages second
npm run health-check        # Verify

# Workers only (backend hotfix)
npm run api:deploy

# Verify Workers deployment
npx wrangler deployments list --config workers/wrangler.toml

# Live log stream
npx wrangler tail wordisbond-api --format pretty --config workers/wrangler.toml

# List secrets (names only, no values)
npx wrangler secret list --config workers/wrangler.toml

# Update a secret
npx wrangler secret put SECRET_NAME --config workers/wrangler.toml

# TypeScript check before deploy (catches regressions)
cd workers && npx tsc --noEmit && cd ..
```

---

## Database Operations Reference

```bash
# Run pending migrations
npm run db:migrate

# Check which migrations are applied
npm run db:migrate:status

# Preview pending migrations (no apply)
npm run db:migrate:dry

# Manual backup now
npm run db:backup

# Check tables in production (requires NEON_PG_CONN env var)
node -e "const {Client} = require('pg'); const c = new Client({connectionString: process.env.NEON_PG_CONN}); c.connect().then(() => c.query(\"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename\")).then(r => { r.rows.forEach(row => console.log(row.tablename)); c.end() })"
```

---

## Neon PITR Restore Steps (Detailed)

> Use this when data corruption or accidental deletion requires restoring to a point in time.

1. **Identify the restore point** — determine the timestamp before the incident (use logs, audit trail, customer reports)

2. **Create a Recovery Branch**
   - Neon Console → Project → Branches → **New Branch**
   - Branch from: [timestamp before incident] e.g., `2026-02-18T09:45:00Z`
   - Name: `incident-restore-YYYYMMDD`

3. **Verify the branch** — connect to the new branch and confirm data looks correct:
   ```bash
   psql "<BRANCH_CONNECTION_STRING>" -c "SELECT COUNT(*) FROM calls WHERE created_at > NOW() - INTERVAL '1 day'"
   ```

4. **Redirect Workers to recovery branch** — update `NEON_PG_CONN` secret:
   ```bash
   npx wrangler secret put NEON_PG_CONN --config workers/wrangler.toml
   npm run api:deploy
   ```

5. **Verify production** — run health check + smoke test

6. **Promote to primary** — once confirmed correct, in Neon Console: Branch → **Set as Primary**

7. **Archive the old branch** — do NOT delete until 7 days post-incident for forensic review

---

## Post-Incident Actions

- [ ] Update `ARCH_DOCS/EIB_FINDINGS_TRACKER.md` with incident record
- [ ] Add lessons learned entry to `ARCH_DOCS/LESSONS_LEARNED.md`
- [ ] Update `status.wordis-bond.com` with resolution note
- [ ] Customer notification if data was at risk or service was down > 30 minutes
- [ ] Root cause analysis within 48 hours
- [ ] Fix root cause in code/config and test before re-deploy

---

## Contacts & Resources

| Resource | URL |
|----------|-----|
| Neon Console | https://console.neon.tech |
| Cloudflare Dashboard | https://dash.cloudflare.com |
| Telnyx Dashboard | https://portal.telnyx.com |
| Stripe Dashboard | https://dashboard.stripe.com |
| Resend Dashboard | https://app.resend.com |
| AssemblyAI Dashboard | https://app.assemblyai.com |
| CF Workers Status | https://www.cloudflarestatus.com |
| Telnyx Status | https://status.telnyx.com |
| Neon Status | https://neonstatus.com |
