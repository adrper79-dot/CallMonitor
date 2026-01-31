# Deployment Runbook

## Prerequisites

- Vercel account (or alternative hosting)
- Supabase project
- SignalWire account
- AssemblyAI account
- Environment variables configured

---

## Environment Variables

Required environment variables (see `lib/env-validation.ts`):

```bash
# SignalWire
SIGNALWIRE_PROJECT_ID=xxx
SIGNALWIRE_TOKEN=xxx
SIGNALWIRE_SPACE=xxx.signalwire.com

# AssemblyAI
ASSEMBLYAI_API_KEY=xxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# NextAuth
NEXTAUTH_SECRET=xxx (min 32 chars)
NEXTAUTH_URL=https://your-domain.com

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional
OPENAI_API_KEY=xxx (for translation)
SENTRY_DSN=xxx (for error tracking)
ALLOWED_ORIGINS=https://your-domain.com
```

---

## Database Setup

1. Run migrations in order:
   ```bash
   psql "$DATABASE_URL" -f migrations/2026-01-09-add-call-sid-to-calls.sql
   psql "$DATABASE_URL" -f migrations/2026-01-10-add-voice-configs.sql
   psql "$DATABASE_URL" -f migrations/2026-01-11-add-login-attempts.sql
   psql "$DATABASE_URL" -f migrations/2026-01-12-add-voice-support-tables.sql
   ```

2. Verify tables exist:
   - `calls`, `recordings`, `voice_configs`
   - `voice_targets`, `campaigns`, `surveys`
   - `ai_runs`, `evidence_manifests`
   - `audit_logs`, `login_attempts`

---

## Supabase Storage Setup

1. Create `recordings` bucket:
   ```sql
   -- Run in Supabase SQL editor
   INSERT INTO storage.buckets (id, name, public)
   VALUES ('recordings', 'recordings', false);
   ```

2. Set up RLS policies (see `app/services/recordingStorage.ts`)

---

## Webhook Configuration

### SignalWire

1. Go to SignalWire Space → Webhooks
2. Set webhook URL: `https://your-domain.com/api/webhooks/signalwire`
3. Enable events:
   - Call Status
   - Recording Status

### AssemblyAI

1. Set webhook URL in transcription requests: `https://your-domain.com/api/webhooks/assemblyai`
2. Webhook is automatically included in transcription API calls

---

## Deployment Steps

### Vercel

1. Connect repository to Vercel
2. Set environment variables
3. Deploy

### Manual

```bash
npm install
npm run build
npm start
```

---

## Post-Deployment

1. **Verify health checks:**
   ```bash
   curl https://your-domain.com/api/health
   ```

2. **Test webhook endpoints:**
   - Use SignalWire/AssemblyAI webhook test tools

3. **Monitor logs:**
   - Vercel dashboard
   - Supabase logs
   - Error tracking (Sentry if configured)

---

## Troubleshooting

### Calls not starting
- Check SignalWire credentials
- Verify webhook URL is accessible
- Check `/api/health` endpoint

### Transcriptions not completing
- Verify AssemblyAI API key
- Check webhook URL in AssemblyAI dashboard
- Review `/api/webhooks/assemblyai` logs

### Database errors
- Verify Supabase connection
- Check RLS policies
- Review migration status

---

## Monitoring

- Health checks: `/api/health`
- Error metrics: `/api/errors/metrics`
- Environment validation: `/api/health/env`

---

## Security Checklist

- [ ] Service role key not exposed to client
- [ ] Webhook signatures validated
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] RBAC enforced on all endpoints
- [ ] Audit logging enabled

---

## Rollback Plan

1. Revert to previous Vercel deployment
2. Check database migrations (may need manual rollback)
3. Verify webhook URLs point to correct version

---

## Support

See `docs/API.md` for API documentation.
See `ARCH_DOCS/` for architecture details.
