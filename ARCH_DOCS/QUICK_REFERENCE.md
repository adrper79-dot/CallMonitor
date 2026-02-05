# Quick Reference - Word Is Bond

**Version:** 1.5.0 | **Date:** February 5, 2026 | **Status:** ✅ Production Ready (Bond AI + Team Management)

---

## 🚀 **Essential URLs**

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Quick call form + bulk upload |
| Voice Operations | `/voice` | Call management |
| Teams | `/teams` | Team/department management ⭐ NEW |
| Settings | `/settings` | Voice config + toggles |
| Tests | `/test` | System health dashboard |
| Admin Auth | `/admin/auth` | Admin authentication |

---

## 📞 **How to Make a Call**

### **Single Call:**
1. Go to `/`
2. Enter phone number (+E.164 format)
3. Click "Start Call"

### **Bulk Calls:**
1. Go to `/`
2. Click "📋 Bulk Upload"
3. Download template
4. Fill CSV with phone numbers
5. Upload & click "Start Bulk Calls"

```mermaid
flowchart TD
    A[User visits /] --> B[Enter phone number<br/>+E.164 format]
    B --> C[Click Start Call]
    C --> D[UI calls /api/calls/start]
    D --> E[Workers API validates auth]
    E --> F[Workers calls Telnyx API]
    F --> G[Telnyx initiates call]
    G --> H[Call connects to recipient]
    H --> I[Audio streams to AssemblyAI<br/>for transcription]
    I --> J[Real-time transcription<br/>displayed in UI]
    J --> K[Call completes]
    K --> L[Recording saved to R2]
    L --> M[Full transcript stored<br/>in database]
```

---

## 🌐 **Live Translation Setup**

### **Requirements:**
- ✅ Business or Enterprise plan
- ✅ Feature flag: `TRANSLATION_LIVE_ASSIST_PREVIEW=true`
- ✅ Translation enabled in settings
- ✅ Languages configured (From/To)

### **Where to Configure:**
1. Go to `/settings`
2. Toggle "Live Translation (Preview)"
3. Select From language (e.g., English)
4. Select To language (e.g., Spanish)
5. Done!

```mermaid
flowchart TD
    A[User enables Live Translation<br/>in /settings] --> B[UI calls /api/settings/update]
    B --> C[Workers validates Business/Enterprise plan]
    C --> D[Workers checks feature flag<br/>TRANSLATION_LIVE_ASSIST_PREVIEW]
    D --> E[Settings saved to database]
    E --> F[During call: Audio streams<br/>to AssemblyAI + OpenAI]
    F --> G[Real-time translation generated]
    G --> H[Translated text sent to ElevenLabs]
    H --> I[AI voice synthesis in target language]
    I --> J[Synthesized audio injected<br/>into live call stream]
```

---

## � **Bond AI Assistant (3-Tier System)** ⭐ **NEW**

### **Tier 1: Chat Widget**
- **Access:** Floating chat button (bottom-right) on all authenticated pages
- **Features:** Conversation history, context-aware responses
- **Data Sources:** Organization stats, KPI data, test results, call context

### **Tier 2: Proactive Alerts**
- **Access:** Dashboard alerts panel
- **Features:** Configurable rules (KPI breach, compliance, volume spike)
- **Management:** Severity filtering, bulk acknowledge, real-time feed

### **Tier 3: Call Co-Pilot**
- **Access:** Integrated into call detail view during/after calls
- **Features:** Real-time guidance, quick actions (compliance check, objection tips, script check, closing guidance)

```mermaid
flowchart TD
    A[User clicks Bond AI chat button] --> B[Widget opens with conversation history]
    B --> C[User asks question or selects quick action]
    C --> D[AI fetches context: org stats, KPIs, recent calls]
    D --> E[OpenAI GPT-4o-mini generates response]
    E --> F[Response displayed with latency indicator]
    F --> G[Conversation saved to bond_ai_conversations table]
```

### **API Endpoints:**
- `POST /api/bond-ai/chat` - Send message, get AI response
- `GET /api/bond-ai/conversations` - Get conversation history
- `GET /api/bond-ai/alerts` - Get active alerts
- `POST /api/bond-ai/copilot` - Get call-specific guidance

---

## 👥 **Team Management** ⭐ **NEW**

### **Access:** `/teams` page

### **Features:**
1. **Create Teams** - Add departments/squads/regions with managers
2. **Manage Members** - Add/remove team members with role assignment
3. **Multi-Org Switching** - Switch between organizations (if member of multiple)
4. **Role Management** - Assign viewer/agent/manager/compliance/admin/owner roles

### **RBAC v2 Permissions:**
- **Viewer:** Read-only access to calls and reports
- **Agent:** Can make/receive calls, view own data
- **Manager:** Manage team, view all data, create reports
- **Compliance:** Audit access, scorecards, compliance reports
- **Admin:** Full admin except org deletion/transfer
- **Owner:** Full control including org management

```mermaid
flowchart TD
    A[Go to /teams] --> B[Create team with name, type, manager]
    B --> C[Add members from org user list]
    C --> D[Assign team roles: lead/member/observer]
    D --> E[Members get appropriate permissions]
    E --> F[Team appears in sidebar navigation]
```

### **API Endpoints:**
- `GET /api/teams` - List user's teams
- `POST /api/teams` - Create new team
- `GET /api/teams/:id/members` - Get team members
- `POST /api/teams/:id/members` - Add member to team
- `GET /api/teams/my-orgs` - List user's organizations
- `POST /api/teams/switch-org` - Switch active organization

---

## �🧪 **Run Tests**

### **Via UI:**
1. Go to `/test`
2. Click "▶️ Run All Tests"
3. Review results (🔴🟡🟢)

### **Via CLI:**
```bash
npm test              # Unit tests (Vitest)
npm run build         # Production build
npx tsc --noEmit      # TypeScript check
```

### **Current Test Status:**
- **Pass Rate:** 98.5% (64/65 tests)
- **Test Files:** 14
- **Known Issues:** 1 mock setup issue in integration test

---

## 📁 **Key Files**

### **Most Important:**
- `ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt` - System design
- `ARCH_DOCS/01-CORE/Schema.txt` - Database schema
- `ARCH_DOCS/02-FEATURES/Translation_Agent` - Live translation guide
- `V4_Issues.txt` - Current status & fixes

### **Feature Docs:**
- `ARCH_DOCS/02-FEATURES/BULK_UPLOAD_FEATURE.md` - Bulk upload
- `ARCH_DOCS/02-FEATURES/TEST_DASHBOARD.md` - Test system
- `ARCH_DOCS/02-FEATURES/SECRET_SHOPPER_INFRASTRUCTURE.md` - Scoring

### **Core Services:**
- `app/services/elevenlabs.ts` - TTS service
- `app/services/translation.ts` - Translation service
- `lib/pgClient.ts` - Database client (Neon)
- `lib/auth.ts` - Authentication (Custom Workers Auth)
- `lib/rbac.ts` - Client-safe RBAC (planSupportsFeature)
- `lib/rbac-server.ts` - Server-only RBAC (requireRole)
- `lib/api/utils.ts` - API helpers (requireAuth, requireRole)

---

## 🔐 **Plans & Permissions**

| Plan | Recording | Transcription | Translation | Live Translation | Survey | Scoring |
|------|-----------|---------------|-------------|------------------|--------|---------|
| Free/Base | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pro/Standard | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Global | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Business | ✅ | ✅ | ✅ | ✅ (Preview) | ✅ | ✅ |
| Enterprise | ✅ | ✅ | ✅ | ✅ (Preview) | ✅ | ✅ |

---

## 🔧 **Environment Variables**

### **Required:**
```bash
DATABASE_URL=postgres://user:pass@ep-host.region.aws.neon.tech/neondb
NEON_PG_CONN=postgres://user:pass@ep-host.region.aws.neon.tech/neondb
# Supabase keys removed (Legacy)
TELNYX_API_KEY=xxx
TELNYX_PUBLIC_KEY=xxx
# SignalWire keys removed (Legacy)
# Custom Auth (Workers API)
AUTH_SECRET=xxx                       # Session signing secret
NEXT_PUBLIC_API_URL=https://wordisbond-api.adrper79.workers.dev
```

### **Recommended:**
```bash
ASSEMBLYAI_API_KEY=xxx
ELEVENLABS_API_KEY=xxx
```

### **Optional:**
```bash
TRANSLATION_LIVE_ASSIST_PREVIEW=true
RESEND_API_KEY=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

---

## 🛠️ **Common Tasks**

### **Check System Health:**
```bash
# Via API
curl https://your-domain.com/api/health

# Via UI
Go to /test
```

### **Update Organization Plan:**
```sql
UPDATE organizations SET plan = 'business' WHERE id = 'org-id';
```

### **Enable Live Translation:**
```bash
# 1. Set env var
TRANSLATION_LIVE_ASSIST_PREVIEW=true

# 2. Update org plan to business/enterprise
# 3. Go to /settings and toggle on
```

### **Run Database Migration:**
```bash
supabase db push
```

### **Check Build:**
```bash
npm run build
```

---

## 🐛 **Troubleshooting**

### **Translation toggle not visible:**
- Check plan is Business or Enterprise
- Verify feature flag enabled
- Check `/settings` page (not `/voice`)

### **401 Auth errors:**
- **Client-side:** Verify ALL `fetch()` calls include `credentials: 'include'`
- Use `lib/apiClient.ts` helpers (apiGet, apiPost, etc.) which include credentials automatically
- **Server-side:** Verify Supabase keys configured correctly
- Check both `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
- Ensure `apikey` header included for Supabase Admin API calls

### **Build fails with static generation error:**
- All API routes should have `export const dynamic = 'force-dynamic'`
- Check `V4_Issues.txt` for list of fixed files

### **Tests failing:**
- Run `npm test` to see details
- Check `/test` dashboard for visual status
- Most test failures are mock setup issues, not production code

### **Telnyx calls not working:**
- Verify `TELNYX_API_KEY` is set
- Check webhook settings in Telnyx Portal
- Verify Number is assigned to Connection

### **One-way audio in WebRTC calls:**
- **Cause:** Browser selected virtual microphone (Steam, VB-Audio, etc.)
- **Check:** Console should show `[Telnyx] Using real microphone: [device name]`
- **Fix:** Ensure device enumeration filters out virtual devices
- **Test:** Go to `/voice-operations` → Connect → Make call → Check console logs

### **Telnyx webhook 401 errors:**
- Verify Public Key signature validation
- Ensure `TELNYX_PUBLIC_KEY` is correct

### **API route 500 errors (RBAC/Auth):**
- Ensure API routes import `requireRole` from `@/lib/rbac-server` (NOT `@/lib/rbac`)
- Use `session.user.id` and `session.user.organizationId` from RBACSession
- `org_members` is the source of truth for user-org relationships (not `users` table)
- Always use NextAuth `getServerSession(authOptions)`, not Supabase Auth

### **Client component importing server code:**
- If build fails with "Module not found: nodemailer":
- Check that client components only import from `lib/rbac.ts` (not `lib/rbac-server.ts`)
- `lib/rbac.ts` is client-safe (planSupportsFeature, canAccessFeature)
- `lib/rbac-server.ts` is server-only (requireRole)

---

## 📊 **API Endpoints Quick Reference**

### **Most Used:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/voice/call` | POST | Start a call |
| `/api/voice/config` | GET/PUT | Voice configuration |
| `/api/calls` | GET | List calls |
| `/api/health` | GET | System health |
| `/api/call-capabilities` | GET | Check org capabilities |
| `/api/organizations/current` | GET | Current org + subscription |
| `/api/billing/subscription` | GET | Subscription status |
| `/api/billing/invoices` | GET | Invoice history |
| `/api/billing/payment-methods` | GET | Payment methods |

### **Webhooks:**
| Endpoint | Source | Purpose |
|----------|--------|---------|
| `/api/webhooks/telnyx` | Telnyx | Call status updates |
| `/api/webhooks/assemblyai` | AssemblyAI | Transcription results |
| `/api/webhooks/survey` | Internal | Survey responses |

---

## ️ **Best Practices**

### **Logging - Use Centralized Logger:**
```typescript
// ✅ CORRECT - Use centralized logger
import { logger } from '@/lib/logger'

logger.error('Operation failed', error, { context: 'value' })
logger.warn('Deprecated feature used', { feature: 'name' })
logger.info('Operation completed', { result: 'success' })
logger.debug('Debug info', { data: object })

// ❌ WRONG - Never use console directly
console.error('Error:', err)  // DON'T DO THIS
console.log('Debug:', data)   // DON'T DO THIS
```

### **API Error Responses - Use Centralized Helpers:**
```typescript
// ✅ CORRECT - Use ApiErrors helpers
import { ApiErrors, apiSuccess } from '@/lib/errors/apiHandler'

return ApiErrors.unauthorized()       // 401
return ApiErrors.notFound('Campaign') // 404
return ApiErrors.badRequest('Invalid') // 400
return apiSuccess({ data })           // 200

// ❌ WRONG - Don't use raw error objects
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })  // DON'T DO THIS
```

### **Client Fetch - Always Include Credentials:**
```typescript
// ✅ CORRECT - Include credentials
const res = await fetch('/api/endpoint', { credentials: 'include' })

// ✅ BETTER - Use apiClient helpers
import { apiGet, apiPost } from '@/lib/apiClient'
const data = await apiGet('/api/endpoint')
```

---

## �📚 **Documentation Index**

### **Start Here:**
1. `00-README.md` - Full navigation guide
2. `CURRENT_STATUS.md` - System overview
3. `QUICK_REFERENCE.md` - This file

### **Core Docs:**
- `01-CORE/` - Architecture, schema, error handling
- `02-FEATURES/` - Feature-specific guides
- `03-INFRASTRUCTURE/` - Deployment & infrastructure
- `04-DESIGN/` - UX principles & deployment
- `05-REFERENCE/` - Sample data & references

### **Historical:**
- `archive/reviews/` - Past code reviews
- `archive/fixes/` - Resolved issues
- `archive/implementations/` - Completed work

---

## 🎯 **Build & Deploy Checklist**

### **Pre-Deployment:**
- [ ] `npm run build` succeeds
- [ ] `npm test` passes (98%+)
- [ ] `npm test` passes (98%+)
- [ ] All env vars set in Cloudflare Pages
- [ ] Webhooks configured in SignalWire/AssemblyAI

### **Post-Deployment:**
- [ ] `/api/health` returns OK
- [ ] `/test` dashboard shows green
- [ ] Test call works
- [ ] Check Cloudflare logs for errors

---

## 💡 **Tips**

- **Finding features?** Check navigation bar (🏠📞⚙️🧪)
- **Need help?** Read `00-README.md` for full index
- **Historical context?** Browse `archive/` folders
- **API details?** Check `01-CORE/MASTER_ARCHITECTURE.txt`
- **Current fixes?** See `V4_Issues.txt`

---

## 📊 **System Stats**

| Metric | Value |
|--------|-------|
| **API Routes** | 38 (all dynamic) |
| **Features Deployed** | 22 |
| **Tests Passing** | 64/65 (98.5%) |
| **Documentation Pages** | 40+ |
| **Build Status** | ✅ Clean |

---

**🚀 Everything you need in one place!**
