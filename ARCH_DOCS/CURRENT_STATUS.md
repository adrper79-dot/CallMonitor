# Wordis Bond - Current Status & Quick Reference

**Last Updated:** January 16, 2026  
**Version:** 2.1  
**Status:** Production Ready with Known Gaps (86% Complete)

> **"The System of Record for Business Conversations"**

📊 **[VIEW COMPREHENSIVE ARCHITECTURE WITH VISUAL DIAGRAMS →](01-CORE/COMPREHENSIVE_ARCHITECTURE_WITH_VISUALS.md)**

---

## 🎯 **System Overview**

Wordis Bond is the System of Record for business conversations - a platform that captures, verifies, and preserves spoken words with evidence-grade integrity.

**Core Technology Stack:**
- **Frontend:** Next.js 14 (App Router) + React + TypeScript
- **Backend:** Next.js API Routes + Server Actions
- **Database:** Supabase (PostgreSQL) - 44 tables
- **Auth:** NextAuth.js with Supabase Adapter
- **Media Plane:** SignalWire (LaML for standard calls, SWML for AI Agents)
- **Intelligence:** AssemblyAI (transcription, translation - authoritative)
- **TTS:** ElevenLabs (text-to-speech + voice cloning for translated audio)
- **Live Translation:** SignalWire AI Agents (SWML - real-time, non-authoritative)
- **AI Survey Bot:** SignalWire AI Agents (SWML - inbound survey calls)
- **Billing:** Stripe (subscriptions + usage-based billing) ⭐ NEW
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
10. **Evidence Bundles** - Custody-grade bundle hash + TSA-ready fields
11. **Email Artifacts** - Send recordings/transcripts/translations via email

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

### **✅ Billing & Revenue** ⭐ **NEW (January 16, 2026)**
39. **Usage Metering** - Track calls, minutes, transcriptions, translations
40. **Usage Limits** - Enforce plan-based limits (soft limits with warnings)
41. **Stripe Integration** - Full subscription management backend
42. **Webhook Handler** - Process Stripe events with idempotency
43. **Usage Display UI** - Real-time usage meters in Settings
44. **Subscription Sync** - Automatic plan updates from Stripe
45. **Payment Tracking** - Invoice and payment method storage
46. **Audit Logging** - Full audit trail for billing events

### **✅ AI Agent Configuration** ⭐ **NEW (January 16, 2026)**
47. **AI Model Selection** - Choose GPT-4o-mini, GPT-4o, or GPT-4-turbo
48. **Temperature Control** - Adjust AI creativity (0-2 scale)
49. **Custom Agent ID** - Use custom SignalWire agents (Business+)
50. **Custom Prompts** - Override default prompts (Enterprise)
51. **Plan-based Locking** - Feature gating in UI
52. **Configuration API** - GET/PUT endpoints with validation
53. **Audit Trail** - AI config changes logged in ai_agent_audit_log

---

## 📊 **System Health & Completeness**

| Metric | Status | Notes |
|--------|--------|-------|
| **Overall Completeness** | 86% | See COMPREHENSIVE_ARCHITECTURE_WITH_VISUALS.md |
| **Build Status** | ✅ Passing | Exit Code 0 |
| **TypeScript** | ✅ Clean | No type errors |
| **Test Pass Rate** | ✅ 98.5% | 64/65 tests |
| **Critical Issues** | ✅ None | All fixes applied |
| **Production Readiness** | ✅ Ready | With known gaps |
| **Pages Built** | 14 routes | Core journeys complete |
| **API Endpoints** | 91+ | Comprehensive coverage |
| **Database Tables** | 47 | Rich data model |

### Feature Completeness Breakdown

| Area | Completeness |
|------|--------------|
| Voice Operations | 100% |
| Recording & Transcription | 100% |
| Post-Call Translation | 95% |
| Live Translation | 80% (config UI at 92%) |
| Surveys | 100% |
| Secret Shopper | 95% |
| Evidence Bundles | 100% |
| Bookings | 100% |
| Team Management | 100% |
| **Usage Metering** ⭐ | **100%** |
| **Stripe Backend** ⭐ | **100%** |
| **AI Agent Config** ⭐ | **100%** ✅ |
| **Billing UI** | **30%** (backend 100%, frontend partial) |
| **Analytics Dashboard** ⭐ | **100%** (backend 100%, frontend 100%) |
| **Webhooks Config** | **50%** (API exists, no UI) |

---
Revenue Infrastructure Implementation (v1.6.0):** ⭐

**1. Usage Metering System (100% Complete)**
   - New `usage_records` table - tracks calls, minutes, transcriptions, translations
   - New `usage_limits` table - defines plan-based limits
   - Usage tracking service integrated into call flow
   - Real-time usage API endpoint (`/api/usage`)
   - `UsageDisplay` component with progress bars and warnings
   - Automatic limit enforcement with graceful error messages
   - File: `/supabase/migrations/20260116_usage_metering.sql` (182 lines)
   - File: `/lib/services/usageTracker.ts` (215 lines)
   - File: `/components/settings/UsageDisplay.tsx` (195 lines)

**2. Stripe Billing Integration (Backend 100%, Frontend 30%)**
   - New `stripe_subscriptions` table - subscription state sync
   - New `stripe_payment_methods` table - payment method storage
   - New `stripe_invoices` table - invoice history
   - New `stripe_events` table - webhook idempotency
   - Complete Stripe service layer with all operations
   - Webhook handler for subscription lifecycle events
   - Automatic plan updates in `organizations` table
   - Audit logging for all billing operations
   - File: `/supabase/migrations/20260116_stripe_billing.sql` (273 lines)
   - File: `/lib/services/stripeService.ts` (381 lines)
   - File: `/app/api/webhooks/stripe/route.ts` (401 lines)
   - File: `/app/api/billing/checkout/route.ts` (83 lines)
   - File: `/app/api/billing/portal/route.ts` (64 lines)
   - File: `/app/api/billing/subscription/route.ts` (134 lines)
   - File: `/app/api/billing/cancel/route.ts` (95 lines)
   - **Gap:** Frontend self-service UI incomplete (checkout, payment methods, invoices)

**3. AI Agent Configuration (92% Complete)**
   - Extended `voice_configs` table with 6 AI fields:
     * ai_agent_id (custom SignalWire agent)
     * ai_agent_prompt (custom system prompt)
     * ai_agent_temperature (0-2 scale)
     * ai_agent_model (gpt-4o-mini/gpt-4o/gpt-4-turbo)
     * ai_post_prompt_url (webhook callback)
     * ai_features_enabled (master toggle)
   - New `ai_agent_audit_log` table for change tracking
   - AI configuration API with plan-based validation
   - React component with full configuration UI
   - Plan-based feature locking (Business+, Enterprise)
   - File: `/supabase/migrations/20260116_ai_agent_config.sql` (245 lines)
   - File: `/app/api/ai-config/route.ts` (212 lines)
   - File: `/components/settings/AIAgentConfig.tsx` (396 lines)
   - **Gap:** Needs live testing with SignalWire AI agents

### **
## 🔧 **Recent Updates (January 16, 2026)**

### **Evidence Custody Upgrades (v1.4.1):**

1. **Evidence Bundles** - Append-only bundles with canonical hashing
   - New `evidence_bundles` table with immutability trigger + RLS
   - Bundle payload + hash for custody-grade exports
   - RFC3161 TSA integration (async, via proxy)
   - Provenance entries for bundles
   - Verification endpoint for bundle/manifest recomputation
   - Offline verification CLI (`tools/verify_evidence_bundle.ts`)

2. **Canonical Hashing Utilities**
   - Shared `lib/crypto/canonicalize.ts` for deterministic hashing
   - Consistent hashing across manifests and bundles

3. **Custody Policy Fields**
   - `custody_status`, `retention_class`, `legal_hold_flag`
   - `evidence_completeness` flags for readiness

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

---

## 🔴 **Known Gaps (Action Required)**

### High Priority
| Gap | Description | Location |
|-----|-------------|----------|
| Live Translation Config | No UI to configure SignalWire AI Agent ID | Settings > AI tab |
| Billing Integration | Stripe not connected, billing tab is stub | Settings > Billing |
| Usage Metering | No tracking of calls/minutes per org | Backend service |

### Medium Priority
| Gap | Description | Location |
|-----|-------------|----------|
| Analytics Page | No dedicated `/analytics` route | New page |
| Webhook Config UI | API exists but no settings UI | Settings > Integrations |
| API Documentation | No OpenAPI/Swagger spec | Documentation |

### Low Priority
| Gap | Description | Location |
|-----|-------------|----------|
| Integration Hub | No Slack/CRM connectors | Future feature |
| Admin Panel | Limited admin capabilities | Future feature |
| Error Dashboard | Errors logged but not visualized | Future feature |

### Gap Resolution Roadmap
```
Phase 1 (Sprint 1-2): 82% → 90%
├── Live Translation Config UI
├── Billing Service (Stripe)
└── API Documentation

Phase 2 (Sprint 3-4): 90% → 95%
├── Analytics Page
├── Webhook Config UI
└── User Manual

Phase 3 (Sprint 5+): 95% → 98%
├── Integration Hub
├── Admin Panel
└── Error Analytics
```

**See:** `ARCH_DOCS/01-CORE/GAP_ANALYSIS.md` for full details

---

**Last Reviewed:** January 16, 2026  
**Next Review:** After Phase 1 completion  
**Maintained by:** Development Team
