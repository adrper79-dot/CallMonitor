# AI Optimization Deployment Checklist
**Status:** Ready to Deploy ✅
**Date:** 2026-02-11

---

## ✅ Pre-Deployment (COMPLETED)

- [x] Groq LLM client created
- [x] Grok Voice TTS client created
- [x] PII redaction layer implemented
- [x] Prompt sanitization implemented
- [x] Smart routing logic created
- [x] Database migration prepared
- [x] Environment variables configured
- [x] Business cost analysis completed
- [x] HuggingFace evaluation done
- [x] Security best practices documented
- [x] **API keys rotated** (after exposure incident)

---

## 🚀 Deployment Steps (DO THESE NOW)

### Step 1: Sign Up for New Services ⏳

#### Groq Account
1. Go to: https://console.groq.com
2. Sign up with your email
3. Navigate to API Keys
4. Create new API key
5. **Keep this window open** (you'll need it next)

#### Grok Account (xAI)
1. Go to: https://x.ai/api
2. Sign up (may require waitlist approval)
3. Navigate to API section
4. Generate API key
5. **Keep this window open**

**Note:** If Grok is not available yet (waitlist), skip for now. System will fall back to OpenAI TTS.

---

### Step 2: Add API Keys Securely ⏳

```powershell
# Run in PowerShell (Windows)
cd "C:\Users\Ultimate Warrior\My project\gemini-project\workers"

# Add Groq key
npx wrangler secret put GROQ_API_KEY
# Paste your Groq key when prompted, press Enter

# Add Grok key (if available)
npx wrangler secret put GROK_API_KEY
# Paste your Grok key when prompted, press Enter

# Verify secrets are set
npx wrangler secret list
```

**Expected output:**
```
GROQ_API_KEY: ****
GROK_API_KEY: ****
OPENAI_API_KEY: ****
...
```

---

### Step 3: Run Database Migration ⏳

```powershell
# Make sure DATABASE_URL is set
echo $env:DATABASE_URL

# If not set, add it:
$env:DATABASE_URL = "your-database-connection-string"

# Run migration
cd "C:\Users\Ultimate Warrior\My project\gemini-project"
psql $env:DATABASE_URL -f migrations/2026-02-11-unified-ai-config.sql
```

**Expected output:**
```
CREATE TABLE
CREATE INDEX
...
Migration complete:
  - ai_org_configs: X rows
  - ai_operation_logs: 0 rows
  - Functions created: increment_ai_usage, reset_monthly_ai_usage, check_ai_quota
  - RLS policies enabled
```

**Verification:**
```powershell
# Check tables were created
psql $env:DATABASE_URL -c "SELECT COUNT(*) FROM ai_org_configs;"
psql $env:DATABASE_URL -c "\d ai_org_configs"  # Show table structure
```

---

### Step 4: Deploy to Production ⏳

#### Option A: Automated Script (Recommended)
```powershell
cd "C:\Users\Ultimate Warrior\My project\gemini-project"
.\deploy-ai-optimization.ps1
```

#### Option B: Manual Steps
```powershell
# Install dependencies
npm install

# Type check
cd workers
npm run build

# Deploy
npm run deploy

# Monitor logs
npx wrangler tail
```

---

### Step 5: Verify Deployment ⏳

#### 5.1 Check Logs
```powershell
cd workers
npx wrangler tail
```

**Look for:**
- ✅ "AI task routed" messages
- ✅ "provider: groq" for translations
- ✅ "Grok Voice TTS successful" for TTS
- ❌ No errors related to missing API keys

#### 5.2 Test Translation
Make a test API call:
```powershell
# Test health endpoint first
curl https://wordisbond-api.adrper79.workers.dev/api/health

# Test translation (if you have test credentials)
# Use Postman or your test suite
```

#### 5.3 Check Cost Tracking
```sql
-- Connect to database
psql $env:DATABASE_URL

-- Check AI operations
SELECT
  provider,
  operation_type,
  COUNT(*) as operations,
  SUM(cost_usd) as total_cost,
  AVG(latency_ms) as avg_latency
FROM ai_operation_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY provider, operation_type;

-- Expected output:
-- provider | operation_type | operations | total_cost | avg_latency
-- ---------|----------------|------------|------------|------------
-- groq     | translation    | 5          | 0.00050    | 250
-- grok     | tts            | 5          | 0.02500    | 800
```

---

## 📊 Success Criteria

After 24 hours, verify:

- [ ] **Cost Reduction:** AI costs are 60-70% lower
  ```sql
  SELECT
    DATE(created_at) as date,
    SUM(cost_usd) as daily_cost
  FROM ai_operation_logs
  GROUP BY DATE(created_at)
  ORDER BY date DESC
  LIMIT 7;
  ```

- [ ] **Provider Mix:** 70-80% of operations use Groq/Grok
  ```sql
  SELECT
    provider,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
  FROM ai_operation_logs
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY provider;
  ```

- [ ] **No Errors:** <1% error rate
  ```sql
  SELECT
    COUNT(*) FILTER (WHERE success = false) * 100.0 / COUNT(*) as error_rate
  FROM ai_operation_logs
  WHERE created_at > NOW() - INTERVAL '24 hours';
  ```

- [ ] **PII Redaction:** Active on all operations
  ```sql
  SELECT
    COUNT(*) FILTER (WHERE pii_redacted = true) as redacted_count,
    SUM(pii_entities_count) as total_entities_redacted
  FROM ai_operation_logs
  WHERE created_at > NOW() - INTERVAL '24 hours';
  ```

---

## 🔄 Rollback Plan (If Needed)

### If Groq/Grok causes issues:

```powershell
# Disable via environment variable
cd workers

# Option 1: Update wrangler.toml
# Set: AI_PROVIDER_GROQ_ENABLED = false
# Set: AI_PROVIDER_GROK_ENABLED = false

# Option 2: Remove secrets (forces fallback)
npx wrangler secret delete GROQ_API_KEY
npx wrangler secret delete GROK_API_KEY

# Redeploy
npm run deploy
```

System will automatically fall back to:
- OpenAI for translation/chat
- ElevenLabs for TTS

---

## 📈 Post-Deployment Monitoring (First Week)

### Daily Checks:

```powershell
# Check AI costs
psql $env:DATABASE_URL -c "
SELECT
  DATE(created_at) as date,
  provider,
  SUM(cost_usd) as cost,
  COUNT(*) as operations
FROM ai_operation_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), provider
ORDER BY date DESC, provider;
"

# Check for quota breaches
psql $env:DATABASE_URL -c "
SELECT
  org_id,
  monthly_usage_usd,
  monthly_ai_budget_usd,
  (monthly_usage_usd / monthly_ai_budget_usd * 100) as percent_used
FROM ai_org_configs
WHERE monthly_usage_usd > monthly_ai_budget_usd * 0.8
ORDER BY percent_used DESC;
"

# Check error rates by provider
psql $env:DATABASE_URL -c "
SELECT
  provider,
  COUNT(*) FILTER (WHERE success = true) as success,
  COUNT(*) FILTER (WHERE success = false) as errors,
  COUNT(*) FILTER (WHERE success = false) * 100.0 / COUNT(*) as error_rate
FROM ai_operation_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;
"
```

### Weekly Review:

1. **Cost Analysis:**
   - Compare this week vs last week AI costs
   - Target: 60-70% reduction

2. **Quality Check:**
   - Review sample translations for accuracy
   - Check TTS audio quality
   - Monitor user feedback/complaints

3. **Performance:**
   - Average latency should be <2 seconds for voice-to-voice
   - Error rate should be <1%

---

## 🎯 Next Phase: Pricing Changes

**After 1 week of stable operation:**

### 1. Prepare Announcement Email
```
Subject: Platform Upgrades + New Pricing

We've upgraded our AI infrastructure with:
- 5x faster translation
- Enhanced security (PII protection)
- Better voice quality

New pricing effective [DATE + 30 days]:
- Starter: $79/mo (was $49)
- Pro: $299/mo (was $199)
- Business: $699/mo (was $499)

Your current rate is locked for 90 days.
```

### 2. Update Pricing Page
- Edit `app/pricing/page.tsx`
- Update to new prices
- Add "Grandfather clause" notice

### 3. Update Stripe
- Create new price IDs
- Keep old plans active for existing customers
- Set migration date

---

## 📞 Support & Troubleshooting

### Common Issues:

**Issue: "Groq API key invalid"**
```powershell
# Verify key is set
npx wrangler secret list

# Re-add key
npx wrangler secret put GROQ_API_KEY
```

**Issue: "Migration failed - table already exists"**
```sql
-- Drop and recreate (CAREFUL - data loss)
DROP TABLE IF EXISTS ai_operation_logs;
DROP TABLE IF EXISTS ai_org_configs;

-- Re-run migration
psql $env:DATABASE_URL -f migrations/2026-02-11-unified-ai-config.sql
```

**Issue: "Type errors during build"**
```powershell
# Update TypeScript definitions
cd workers
npm install --save-dev @types/node

# Rebuild
npm run build
```

---

## ✅ Final Checklist

Before marking this as complete:

- [ ] Groq account created + API key added
- [ ] Grok account created + API key added (or skipped if waitlist)
- [ ] Database migration run successfully
- [ ] Deployment completed without errors
- [ ] Logs show "provider: groq" or "provider: grok"
- [ ] AI costs are tracking in `ai_operation_logs` table
- [ ] No critical errors in last 24 hours
- [ ] Cost reduction verified (60-70% lower)

---

**Status:** Ready to Deploy ✅
**Next Action:** Run `.\deploy-ai-optimization.ps1`
**Estimated Time:** 30-45 minutes
**Expected Result:** 70% AI cost reduction + enhanced security

---

## 🚦 Phase 0 Pre-Customer Gate (CIO/COO/CLO)

**Do not onboard first paying customer until all items below are checked.**

### Item 0.1 — Logpush → Axiom (CIO)
- [ ] Set `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `AXIOM_API_TOKEN`, `AXIOM_DATASET` as shell env vars
- [ ] Run `bash scripts/setup-logpush.sh` — creates/updates CF Logpush job to Axiom
- [ ] Verify logs appear in Axiom: app.axiom.co → Datasets → wordisbond-workers
- [ ] Set `AXIOM_API_TOKEN` as Workers secret: `echo $AXIOM_API_TOKEN | npx wrangler secret put AXIOM_API_TOKEN --config workers/wrangler.toml`

### Item 0.2 — Uptime Monitoring (CIO) — FREE STACK
**Do not pay $30/mo for BetterStack yet. Use this free stack instead:**

#### 0.2a — HTTP uptime monitor: Freshping (free, 1-min interval)
- [ ] Create account at https://freshping.io (free — 50 monitors, 1-min check interval)
- [ ] Add check: URL = `https://wordisbond-api.adrper79.workers.dev/health/ready`
  - Check type: HTTP
  - Expected status: 200
  - Keyword: `"ok"`
  - Alert: email on 2 consecutive failures
- [ ] Add second check: `https://wordis-bond.com/status` (verifies Pages is up)

#### 0.2b — Cron heartbeat: healthchecks.io (free, 20 monitors)
- [ ] Create account at https://healthchecks.io (free — 20 checks, email alerts)
- [ ] Create a new check:
  - Name: `wordisbond-crons`
  - Period: 5 minutes (tightest cron interval)
  - Grace: 2 minutes
- [ ] Copy the ping URL (format: `https://hc-ping.com/<uuid>`)
- [ ] Set as Workers secret:
  ```powershell
  echo "https://hc-ping.com/<your-uuid>" | npx wrangler secret put CRON_HEARTBEAT_URL --config workers/wrangler.toml
  ```
- [ ] After next cron run (≤5 min), verify healthchecks.io shows green

**Upgrade to BetterStack when:** You have paying customers and need SMS on-call + multi-region checks.

### Item 0.3 — Neon PITR (CIO)
- [ ] Set `NEON_API_KEY` and `NEON_PROJECT_ID` as shell env vars
- [ ] Run `bash scripts/verify-neon-pitr.sh` — exits 1 if PITR not enabled
- [ ] If script fails: upgrade Neon project to Launch ($19/mo) or Scale ($69/mo)
- [ ] Re-run script until it exits 0: "PITR is ENABLED — 7-day recovery window."

### Item 0.4 — Status Page (COO) — BUILT-IN (no cost)
**Status page is built into the app at `/status` — no external service needed.**

- [ ] Deploy using standard deploy chain (see Step 4):
  ```powershell
  npm run api:deploy && npm run build && npm run pages:deploy
  ```
- [ ] Verify status page is live: https://wordis-bond.com/status
  - Should show all 4 services (database, kv, r2, telnyx) as Operational
  - Auto-refreshes every 60 seconds
  - "Status" link is now always visible in homepage footer → `/status`
- [ ] Add to Freshping as a second check (URL: `https://wordis-bond.com/status`, keyword: `"Operational"`)

The `/status` page is a client-side React component that fetches `/health` from the Workers API.
If Pages goes down, the static assets are unavailable — but that's a Cloudflare infrastructure event,
not an application issue. Good enough for pre-revenue monitoring.

### Item 0.5 — E&O + Cyber Insurance (CLO)
**Required before first enterprise deal. Start application immediately — lead time 2-4 weeks.**

Recommended coverage:
| Policy | Minimum Coverage | Est. Annual Premium |
|--------|-----------------|---------------------|
| Errors & Omissions (E&O) | $1,000,000 | $3,000–$6,000 |
| Cyber Liability | $2,000,000 | $3,000–$6,000 |
| General Liability | $1,000,000 | $1,000–$2,000 |
| **Total** | | **$7,000–$14,000/yr** |

Brokers to contact:
- **Embroker** (tech startups, online) — https://home.embroker.com
- **CoverWallet** (AIG / Aon) — https://www.coverwallet.com
- **Vouch** (VC-backed startups) — https://www.vouch.us

Documents needed:
- [ ] Business formation docs (LLC)
- [ ] Revenue projection (12 months)
- [ ] Description of platform (FDCPA compliance SaaS, not a debt collector)
- [ ] Security practices summary (pull from `ARCH_DOCS/SECURITY_AUDIT_REPORT_2026-02-12.json`)

**Critical framing:** WIB is a **SaaS compliance tool** used by debt collectors — NOT a debt collector itself. This classification keeps premiums lower and avoids FDCPA professional liability exclusions.

- [ ] E&O policy bound and certificate on file
- [ ] Cyber Liability policy bound and certificate on file
