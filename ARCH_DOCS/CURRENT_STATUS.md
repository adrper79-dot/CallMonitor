# Word Is Bond - Current Status & Quick Reference

**Last Updated:** January 14, 2026  
**Version:** 1.4.0  
**Status:** ✅ Production Ready

---

## 🎯 **System Overview**

Word Is Bond is a voice operations platform for managing calls with modulations (recording, transcription, translation, surveys, secret shopper).

**Core Technology Stack:**
- **Frontend:** Next.js 14 (App Router) + React + TypeScript
- **Backend:** Next.js API Routes + Server Actions
- **Database:** Supabase (PostgreSQL)
- **Auth:** NextAuth.js with Supabase Adapter
- **Media Plane:** SignalWire (LaML for standard calls, SWML for AI Agents)
- **Intelligence:** AssemblyAI (transcription, translation - authoritative)
- **TTS:** ElevenLabs (text-to-speech + voice cloning for translated audio)
- **Live Translation:** SignalWire AI Agents (SWML - real-time, non-authoritative)
- **AI Survey Bot:** SignalWire AI Agents (SWML - inbound survey calls)
- **Email:** Resend (transactional emails + artifact delivery)

---

## 🚀 **Deployed Features**

### **✅ Core Features (Production)**
1. **Call Management** - Initiate, track, and manage voice calls
2. **Recording** - Auto-record with SignalWire
3. **Transcription** - Post-call via AssemblyAI
4. **Translation** - Post-call via AssemblyAI + OpenAI
5. **TTS Audio** - ElevenLabs audio generation for translations
6. **Voice Cloning** - Clone caller's voice for translated audio (ElevenLabs)
7. **After-call Surveys** - IVR surveys post-call
8. **Secret Shopper** - AI-powered call scoring
9. **Evidence Manifests** - Structured call evidence
10. **Email Artifacts** - Send recordings/transcripts/translations via email

### **✅ Live Translation (Preview - Business+ Plan)**
11. **Real-time Translation** - SignalWire AI Agents for live bi-directional translation
12. **Language Detection** - Auto-detect language switches
13. **Graceful Fallback** - Continue call without translation on failure

### **✅ AI Survey Bot (Business+ Plan)**
14. **Dynamic Survey Prompts** - Configurable questions per organization
15. **Inbound Call Handling** - SignalWire AI Agents for survey conversations
16. **Email Results** - Automated survey result delivery
17. **Conversation Capture** - Full transcript stored in ai_runs

### **✅ UI Features**
18. **Navigation Bar** - Global nav (Home, Voice, Settings, Tests)
19. **Voice Operations Page** - Call list, execution controls, detail view
20. **Settings Page** - Voice config UI with modulation toggles
21. **Test Dashboard** - Comprehensive test runner with visual KPIs (🔴🟡🟢)
22. **Bulk Call Upload** - CSV upload for batch test calls
23. **Email Artifacts Button** - Send call artifacts as email attachments

### **✅ Cal.com-Style Booking (Business+ Plan)**
24. **Scheduled Calls** - Book calls for future automatic execution
25. **Booking Management** - Create, update, cancel bookings
26. **Cron Auto-Originate** - Vercel Cron triggers calls at scheduled time
27. **Attendee Tracking** - Name, email, phone per booking

### **✅ Chrome Extension**
28. **Quick Call** - Make calls from browser popup
29. **Click-to-Call** - Auto-detect phone numbers on any webpage
30. **Context Menu** - Right-click to call/schedule
31. **Notifications** - Real-time call status updates

### **✅ Infrastructure**
32. **RBAC System** - Role-based access control (Owner, Admin, Operator, Viewer)
33. **Plan-based Capabilities** - Feature gating by organization plan
34. **Error Tracking** - Comprehensive error handling with audit logs
35. **Rate Limiting** - API endpoint rate limiting
36. **Idempotency** - Idempotency keys for safe retries
37. **Webhook Security** - Signature verification for external webhooks
38. **SignalWire Numbers API** - Manage inbound phone numbers

---

## 📊 **System Health**

| Metric | Status | Notes |
|--------|--------|-------|
| **Build Status** | ✅ Success | Clean build, all routes dynamic |
| **TypeScript** | ✅ Compiles | No errors |
| **Test Pass Rate** | 98.5% (64/65) | 🟢 Excellent |
| **Critical Issues** | 0 | 🟢 All resolved |
| **Production Readiness** | ✅ Approved | Safe to deploy |

---

## 🔧 **Recent Updates (January 14, 2026)**

### **New Features Added (v1.3):**

1. **Cal.com-Style Booking** - Schedule calls for future execution
   - Create/update/cancel bookings via API
   - Vercel Cron auto-originates calls at scheduled time
   - Full booking → call → artifact audit trail
   - New endpoints: `/api/bookings`, `/api/cron/scheduled-calls`

2. **Chrome Extension** - Click-to-call from any webpage
   - Quick call from popup
   - Auto-detect phone numbers on pages
   - Right-click context menu
   - Settings page for customization

### **Previous Features (v1.2):**

3. **AI Survey Bot** - SignalWire AI Agents for inbound survey calls
   - Dynamic survey prompts per organization
   - Email results delivery via Resend
   - Full conversation capture in ai_runs table
   - New endpoints: `/api/voice/swml/survey`, `/api/survey/ai-results`

4. **Voice Cloning** - ElevenLabs voice cloning for translations
   - Clone caller's voice from recording
   - Use cloned voice for translated audio
   - New fields: `use_voice_cloning`, `cloned_voice_id`

5. **Email Artifacts** - Send call artifacts as email attachments
   - Recording, transcript, and translation files
   - Not links - actual file attachments
   - New endpoint: `/api/calls/[id]/email`

6. **SignalWire Numbers API** - Manage inbound phone numbers
   - List available numbers
   - Assign webhook URLs
   - New endpoint: `/api/signalwire/numbers`

### **Production Fixes (Post-Deploy):**

1. **Fixed `meta` column error** - `ai_runs` insert used non-existent `meta` column
   - Changed to use existing `output` column for translation metadata
   - Error: `Could not find the 'meta' column of 'ai_runs'`

2. **Fixed SignalWire webhook signature validation** - Updated to match Twilio/SignalWire format
   - Uses HMAC-SHA1 with Base64 encoding (not SHA256 hex)
   - Includes URL in signature validation
   - Added `SIGNALWIRE_SKIP_SIGNATURE_VALIDATION=true` fallback for proxy environments

3. **Supabase adapter warning** - Expected behavior, auth continues with Credentials provider
   - Warning is logged but doesn't affect functionality

### **Critical Fixes Applied (January 13):**

1. **Dynamic Route Exports** - Added `export const dynamic = 'force-dynamic'` to all 38 API routes
   - Fixes Next.js 14 static generation errors
   - All routes now properly rendered at request time

2. **Supabase Client Centralization** - Consolidated inline client creation to use `supabaseAdmin`
   - `app/api/audio/upload/route.ts`
   - `app/api/audio/transcribe/route.ts`
   - `app/api/tts/generate/route.ts`

3. **Auth Adapter Build Fix** - Added `NEXT_PHASE` check to prevent build-time initialization
   - `lib/auth.ts` - Deferred adapter creation during production build

4. **Test Mock Enhancement** - Fixed `NextResponse` mock to support constructor calls
   - `tests/setup.ts` - Class-based mock with static and instance methods

---

## 🗺️ **Architecture Summary**

### **Data Flow:**

```
User (Browser)
  ↓ HTTP POST
Next.js API Route (/api/voice/call)
  ↓
startCallHandler (Server Action)
  ↓
Supabase (calls, voice_configs, org_members)
  ↓
SignalWire API (LaML or SWML)
  ↓
Phone Call Initiated
  ↓ [During Call]
SignalWire AI Agent (if live translation)
  ↓ [Webhooks]
/api/webhooks/signalwire (status updates)
  ↓ [Post-Call]
AssemblyAI (transcription + translation - authoritative)
  ↓ [Webhooks]
/api/webhooks/assemblyai (transcript + translations)
  ↓
ElevenLabs (TTS audio for translations)
  ↓
Supabase (recordings, translations, evidence_manifests)
```

### **Key Contracts:**

1. **UI → API → Table:** All writes go through API routes
2. **SignalWire → Webhook:** External events trigger webhooks
3. **AssemblyAI → Webhook:** Async intelligence processing
4. **Non-authoritative Live Output:** SignalWire AI events are ephemeral
5. **Authoritative Record:** AssemblyAI transcripts are canonical
6. **Dynamic Rendering:** All API routes use `export const dynamic = 'force-dynamic'`

---

## 📁 **Codebase Structure**

```
gemini-project/
├── app/
│   ├── api/              - API routes (38 routes, all dynamic)
│   │   ├── voice/        - Call management (8 routes)
│   │   ├── webhooks/     - External webhooks (3 routes)
│   │   ├── auth/         - Authentication (3 routes)
│   │   ├── health/       - Health checks (5 routes)
│   │   ├── calls/        - Call operations (5 routes)
│   │   └── [others]/     - Additional endpoints
│   ├── actions/          - Server actions
│   ├── services/         - Business logic services
│   │   ├── elevenlabs.ts - TTS service
│   │   ├── translation.ts - Translation service
│   │   ├── scoring.ts    - Shopper scoring
│   │   └── [others]/     - Additional services
│   └── [pages]/          - Page routes
├── components/
│   ├── voice/            - Voice-specific components
│   ├── ui/               - Shared UI components
│   └── [others]/         - Feature components
├── lib/
│   ├── signalwire/       - SignalWire integrations
│   ├── supabaseAdmin.ts  - Centralized Supabase client
│   ├── auth.ts           - NextAuth configuration
│   ├── env-validation.ts - Environment validation
│   ├── rateLimit.ts      - Rate limiting
│   ├── idempotency.ts    - Idempotency handling
│   └── [utilities]/      - Shared utilities
├── hooks/                - React hooks
├── types/                - TypeScript types
├── tests/                - Test suites (14 files, 65 tests)
├── migrations/           - Database migrations (33 files)
└── ARCH_DOCS/            - Architecture documentation
```

---

## 🔐 **RBAC & Permissions**

### **User Roles:**
- **Owner** - Full access
- **Admin** - Manage organization and calls
- **Operator** - Execute calls, view data
- **Viewer** - Read-only access

### **Plans & Capabilities:**
- **Base/Free** - Basic calling
- **Pro/Standard** - + Recording, Transcription
- **Global** - + Translation (post-call)
- **Business** - + Live Translation (Preview)
- **Enterprise** - + All features

### **Feature Flags:**
- `TRANSLATION_LIVE_ASSIST_PREVIEW` - Enable live translation for Business+ plans

---

## 🌐 **API Endpoints (42 Total)**

### **Voice Operations (10 routes):**
- `POST /api/voice/call` - Initiate call
- `POST /api/voice/bulk-upload` - Bulk call upload
- `GET /api/voice/config` - Get voice config
- `PUT /api/voice/config` - Update voice config
- `GET /api/voice/script` - Get LaML script
- `POST /api/voice/laml/outbound` - LaML callback
- `POST /api/voice/swml/outbound` - SWML callback
- `GET /api/voice/targets` - List voice targets
- `POST /api/voice/targets` - Create voice target
- `DELETE /api/voice/targets` - Delete voice target

### **Webhooks (3 routes):**
- `POST /api/webhooks/signalwire` - SignalWire status updates
- `POST /api/webhooks/assemblyai` - AssemblyAI transcripts
- `POST /api/webhooks/survey` - Survey responses

### **Call Management (5 routes):**
- `GET /api/calls` - List calls
- `GET /api/calls/[id]` - Get call details
- `POST /api/calls/start` - Start call
- `POST /api/calls/recordModulationIntent` - Record modulation intent
- `GET /api/call-capabilities` - Get org capabilities

### **Health & Admin (10 routes):**
- `GET /api/health` - System health check
- `GET /api/health/env` - Environment check
- `GET /api/health/user` - User lookup
- `GET /api/health/auth-adapter` - Auth adapter check
- `GET /api/health/auth-providers` - Auth provider check
- `POST /api/auth/signup` - User signup
- `POST /api/auth/unlock` - Account unlock
- `POST /api/_admin/signup` - Admin signup
- `GET /api/_admin/auth-providers` - Admin auth providers

### **Surveys (3 routes):**
- `GET /api/surveys` - List surveys
- `POST /api/surveys` - Create/update survey
- `DELETE /api/surveys` - Delete survey

### **Other (11 routes):**
- `GET /api/audit-logs` - Audit log access
- `GET /api/campaigns` - Campaign list
- `GET /api/shopper/scripts` - Shopper scripts
- `GET /api/recordings/[id]` - Recording access
- `GET /api/rbac/context` - RBAC context
- `POST /api/realtime/subscribe` - Real-time subscription
- `GET /api/users/[userId]/organization` - User organization
- `POST /api/tts/generate` - TTS generation (ElevenLabs)
- `POST /api/audio/upload` - Audio upload
- `POST /api/audio/transcribe` - Audio transcription
- `GET /api/errors/metrics` - Error metrics

---

## 🧪 **Testing**

### **Test Suites:**
- **Unit Tests:** 50+ tests (Vitest)
- **Integration Tests:** 14+ tests
- **Test Files:** 14 files
- **Pass Rate:** 98.5% (64/65)

### **Test Results Summary:**
```
✅ tests/unit/ErrorBoundary.test.tsx (6 tests)
✅ tests/integration/webhookFlow.test.ts (2 tests)
✅ tests/unit/rateLimit.test.ts (3 tests)
✅ tests/unit/errorHandling.test.ts (9 tests)
✅ tests/integration/startCallFlow.test.ts (2 tests)
✅ tests/unit/evidenceManifest.test.ts (2 tests)
✅ tests/unit/idempotency.test.ts (4 tests)
✅ tests/unit/rbac.test.ts (23 tests)
✅ tests/unit/scoring.test.ts (2 tests)
✅ tests/unit/startCallHandler.test.ts (1 test)
✅ tests/unit/startCallHandler.enforce.test.ts (1 test)
✅ tests/unit/webhookSecurity.test.ts (5 tests)
✅ tests/unit/translation.test.ts (3 tests)
✅ tests/integration/callExecutionFlow.test.ts (1/2 tests) - 1 mock setup issue
```

### **Test Dashboard:**
- Location: `/test`
- Visual KPIs: 🔴🟡🟢
- Real-time execution
- 18 comprehensive tests

---

## 🚀 **Deployment**

### **Environment Variables Required:**
```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# SignalWire (Required)
SIGNALWIRE_PROJECT_ID=xxx
SIGNALWIRE_TOKEN=PTxxx                    # Or SIGNALWIRE_API_TOKEN
SIGNALWIRE_SPACE=xxx.signalwire.com
SIGNALWIRE_NUMBER=+15551234567

# NextAuth (Required)
NEXTAUTH_SECRET=xxx                       # Min 32 characters
NEXTAUTH_URL=https://your-domain.com

# App URL (Required)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Intelligence Services (Recommended)
ASSEMBLYAI_API_KEY=xxx
ELEVENLABS_API_KEY=xxx

# Optional Features
TRANSLATION_LIVE_ASSIST_PREVIEW=true

# Email (Optional)
RESEND_API_KEY=xxx

# Auth Providers (Optional)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

### **Deployment Checklist:**
1. ✅ All environment variables configured in Vercel
2. ✅ Database migrations applied
3. ✅ SignalWire webhooks configured
4. ✅ AssemblyAI webhooks configured
5. ✅ Build succeeds (all routes dynamic)
6. ✅ Test dashboard shows 98.5%+ pass rate
7. ✅ RBAC permissions verified

---

## 📝 **Service Integrations**

| Service | Purpose | Status | Notes |
|---------|---------|--------|-------|
| **Supabase** | Database + Storage | ✅ Configured | PostgreSQL + File storage |
| **SignalWire** | Voice calls | ✅ Configured | LaML + SWML support |
| **AssemblyAI** | Transcription | ✅ Configured | Authoritative transcripts |
| **ElevenLabs** | TTS | ✅ Configured | Translation audio |
| **Resend** | Email | ✅ Configured | Transactional emails |
| **NextAuth** | Authentication | ✅ Configured | Email + Credentials + Google |

---

## 🎯 **Quick Links**

### **For Developers:**
- **Architecture:** `01-CORE/MASTER_ARCHITECTURE.txt`
- **Database:** `01-CORE/Schema.txt`
- **Live Translation:** `02-FEATURES/Translation_Agent`

### **For Users:**
- **Main Page:** `/` - Single or bulk call initiation
- **Voice Operations:** `/voice` - Call management
- **Settings:** `/settings` - Voice configuration
- **Tests:** `/test` - System health dashboard

### **For DevOps:**
- **Deployment:** `04-DESIGN/DEPLOYMENT_NOTES.md`
- **Infrastructure:** `03-INFRASTRUCTURE/MEDIA_PLANE_ARCHITECTURE.txt`
- **V4 Issues:** `/V4_Issues.txt` - Current fix status

---

## 📈 **Metrics**

| Metric | Value | Status |
|--------|-------|--------|
| **Total Features** | 26 | 🟢 |
| **API Endpoints** | 42 | 🟢 |
| **Test Pass Rate** | 98.5% | 🟢 |
| **Build Status** | Clean | 🟢 |
| **Documentation Pages** | 45+ | 🟢 |
| **Supported Plans** | 6 | 🟢 |
| **Supported Languages** | 100+ | 🟢 |

---

## 🎉 **Key Achievements**

1. ✅ **Live Translation** - Real-time bi-directional translation with SignalWire AI
2. ✅ **Complete UI** - Navigation, settings, test dashboard
3. ✅ **Bulk Operations** - CSV upload for batch testing
4. ✅ **TTS Integration** - ElevenLabs audio for translations
5. ✅ **Type Safety** - Centralized API response types
6. ✅ **Test Infrastructure** - Comprehensive testing with visual KPIs
7. ✅ **Production Ready** - 98.5% test pass rate, clean build, zero critical issues
8. ✅ **Dynamic Routes** - All 38 API routes properly configured for Next.js 14

---

## 📞 **Support & Documentation**

**Quick Help:**
- New developer? → Read `00-README.md` then `01-CORE/MASTER_ARCHITECTURE.txt`
- Feature question? → Check `02-FEATURES/`
- Deployment issue? → See `04-DESIGN/DEPLOYMENT_NOTES.md`
- Historical context? → Browse `archive/`
- Current fixes? → See `/V4_Issues.txt`

**Documentation Index:** `00-README.md`

---

## 🔄 **Maintenance**

**Keep Current:**
- Core architecture docs (01-CORE)
- Feature docs (02-FEATURES)
- Infrastructure docs (03-INFRASTRUCTURE)

**Archive When:**
- Code reviews are addressed → `archive/reviews/`
- Issues are fixed → `archive/fixes/`
- Implementations are deployed → `archive/implementations/`

---

**Last Reviewed:** January 13, 2026  
**Next Review:** Quarterly or on major releases  
**Maintained by:** Development Team
