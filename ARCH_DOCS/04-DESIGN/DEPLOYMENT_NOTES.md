# Word Is Bond - Deployment Notes

**Last Updated:** January 13, 2026  
**Version:** 1.1.0  
**Status:** Production Ready

---

## 🚀 **Quick Deployment Checklist**

### **Pre-Deployment:**
- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] `npm run build` succeeds (all routes dynamic)
- [ ] `npm test` passes (98%+)
- [ ] SignalWire webhooks configured
- [ ] AssemblyAI webhooks configured

### **Post-Deployment:**
- [ ] `/api/health` returns OK
- [ ] `/test` dashboard shows green
- [ ] Test call works end-to-end
- [ ] Check Vercel logs for errors

---

## 🔧 **Environment Variables**

### **Required (All Environments)**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# SignalWire
SIGNALWIRE_PROJECT_ID=xxx
SIGNALWIRE_TOKEN=PTxxx                    # Or SIGNALWIRE_API_TOKEN
SIGNALWIRE_SPACE=xxx.signalwire.com
SIGNALWIRE_NUMBER=+15551234567            # E.164 format

# NextAuth
NEXTAUTH_SECRET=xxx                       # Minimum 32 characters
NEXTAUTH_URL=https://your-domain.com

# App URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### **Intelligence Services (Recommended)**

```bash
# AssemblyAI - For transcription
ASSEMBLYAI_API_KEY=xxx

# ElevenLabs - For TTS audio
ELEVENLABS_API_KEY=xxx
```

### **Optional Features**

```bash
# Live Translation Preview (Business+ plan)
TRANSLATION_LIVE_ASSIST_PREVIEW=true

# OpenAI - For translation service
OPENAI_API_KEY=xxx

# Resend - For transactional emails
RESEND_API_KEY=xxx

# Google OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

---

## 📦 **Build Requirements**

### **Critical: All API Routes Must Be Dynamic**

All 38 API routes in `/app/api/` require:

```typescript
export const dynamic = 'force-dynamic'
```

This is required because:
- Routes use `headers()`, `searchParams`, or `request.url`
- Next.js 14 App Router defaults to static generation
- Without this export, builds fail with static generation errors

**Verification:**
```bash
npm run build
# All routes should show ƒ (dynamic) in build output
```

### **Build Output Example:**
```
Route (app)                              Size     First Load JS
├ ƒ /api/voice/call                      0 B                0 B
├ ƒ /api/webhooks/signalwire             0 B                0 B
├ ƒ /api/health                          0 B                0 B
...
```

All API routes should show `ƒ` (function/dynamic).

---

## 🗄️ **Database Setup**

### **Run Migrations:**
```bash
# Using Supabase CLI
supabase db push

# Or manually
psql "$DATABASE_URL" -f migrations/*.sql
```

### **Key Tables:**
- `organizations` - Organization and plan data
- `users` - User accounts
- `org_members` - Organization membership and roles
- `calls` - Call records
- `recordings` - Recording metadata
- `voice_configs` - Voice configuration per organization
- `ai_runs` - AI processing jobs
- `audit_logs` - Audit trail

---

## 🔌 **Webhook Configuration**

### **SignalWire Webhooks**

Configure in SignalWire dashboard:
- **Voice Status URL:** `https://your-domain.com/api/webhooks/signalwire`
- **Method:** POST
- **Events:** All call status events

### **AssemblyAI Webhooks**

Configure when submitting transcription jobs:
- **Webhook URL:** `https://your-domain.com/api/webhooks/assemblyai`
- **Events:** Transcription completed

---

## 📊 **Verification Steps**

### **1. Health Check**
```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "signalwire": "ok",
    "assemblyai": "ok"
  }
}
```

### **2. Environment Check**
```bash
curl https://your-domain.com/api/health/env
```

All required variables should show `[SET]`.

### **3. Test Dashboard**
Navigate to `/test` and run all tests.
- All critical tests should pass (green)
- 98%+ pass rate expected

### **4. Test Call**
1. Navigate to `/`
2. Enter a valid phone number
3. Click "Start Call"
4. Verify call is placed and status updates

---

## 🌐 **Live Translation Feature**

### **Requirements:**
- Business or Enterprise plan
- Feature flag: `TRANSLATION_LIVE_ASSIST_PREVIEW=true`
- SignalWire AI Agents enabled on account

### **Enable:**
```bash
TRANSLATION_LIVE_ASSIST_PREVIEW=true
```

### **Verification:**
1. Go to `/settings`
2. Toggle "Live Translation (Preview)" should be visible
3. Select source and target languages
4. Place test call with translation enabled

### **Rollback:**
```bash
TRANSLATION_LIVE_ASSIST_PREVIEW=false
```

---

## 🚨 **Troubleshooting**

### **Build Fails with Static Generation Error**

**Error:** "couldn't be rendered statically because it used `headers`"

**Fix:** Ensure all API routes have:
```typescript
export const dynamic = 'force-dynamic'
```

### **Supabase Adapter Error During Build**

**Error:** "supabaseUrl is required"

**Fix:** The `lib/auth.ts` file should detect build phase:
```typescript
if (process.env.NEXT_PHASE === 'phase-production-build') {
  return undefined
}
```

### **SignalWire Calls Not Working**

**Check:**
1. `SIGNALWIRE_NUMBER` is set (E.164 format)
2. `SIGNALWIRE_TOKEN` or `SIGNALWIRE_API_TOKEN` is set
3. `SIGNALWIRE_SPACE` is correct
4. Webhooks are configured in SignalWire dashboard

### **401 Authentication Errors**

**Check:**
1. Both Supabase keys are set
2. `NEXTAUTH_SECRET` is at least 32 characters
3. `NEXTAUTH_URL` matches your domain

### **Tests Failing**

**Check:**
1. Run `npm test` for detailed output
2. Most failures are mock setup issues, not production code
3. Check `/test` dashboard for visual status

---

## 📈 **Monitoring**

### **Key Endpoints:**
- `/api/health` - System health
- `/api/health/env` - Environment validation
- `/api/errors/metrics` - Error KPIs

### **Logs:**
- Vercel dashboard for deployment logs
- Application logs for API errors
- SignalWire dashboard for call logs

### **Metrics to Watch:**
- Build success rate
- Test pass rate (target: 98%+)
- API response times
- Error rates by endpoint

---

## 🔒 **Security Notes**

### **Environment Variables:**
- Never commit `.env` files
- Use Vercel environment variables
- Rotate secrets periodically

### **API Security:**
- All webhooks verify signatures
- Rate limiting on all endpoints
- Idempotency keys prevent duplicate operations
- RLS enabled on Supabase

### **Audit Trail:**
- All significant actions logged
- Audit logs are immutable
- Available via `/api/audit-logs`

---

## 📚 **References**

- **Architecture:** `ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt`
- **Database Schema:** `ARCH_DOCS/01-CORE/Schema.txt`
- **Current Status:** `ARCH_DOCS/CURRENT_STATUS.md`
- **Issue Tracking:** `V4_Issues.txt`
- **SignalWire Docs:** https://developer.signalwire.com
- **AssemblyAI Docs:** https://www.assemblyai.com/docs

---

**Maintained by:** Development Team  
**Last Review:** January 13, 2026
