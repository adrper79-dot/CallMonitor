# Word Is Bond — Architecture Documentation

**Last Updated:** February 14, 2026  
**Version:** 4.65 — ARCH_DOCS Reorganization (92→43 files, zero stale refs)  
**Status:** Production Deployed (Cloudflare Pages + Workers API)

> **"The System of Record for Business Conversations"**  
> _Company: Latimer + Woods Tech LLC_

---

## CRITICAL STANDARDS (Read First)

- **[01-CORE/DATABASE_CONNECTION_STANDARD.md](01-CORE/DATABASE_CONNECTION_STANDARD.md)** — Neon before Hyperdrive. Never reverse.
- **[02-FEATURES/TELNYX_WEBRTC_STANDARD.md](02-FEATURES/TELNYX_WEBRTC_STANDARD.md)** — WebRTC mic filtering required for two-way audio
- **[01-CORE/AI_ROLE_POLICY.md](01-CORE/AI_ROLE_POLICY.md)** — AI operates as notary/stenographer, never autonomous

---

## Quick Navigation

### Gospel Docs (start here):
- **[MASTER_ARCHITECTURE.md](MASTER_ARCHITECTURE.md)** — Complete system design, data flows, security
- **[03-INFRASTRUCTURE/CLOUDFLARE_DEPLOYMENT.md](03-INFRASTRUCTURE/CLOUDFLARE_DEPLOYMENT.md)** — Hybrid deployment (Pages + Workers)
- **[01-CORE/FINAL_STACK.md](01-CORE/FINAL_STACK.md)** — Production tech stack (edge-first)
- **[CURRENT_STATUS.md](CURRENT_STATUS.md)** — Live system status, health metrics
- **[06-REFERENCE/QUICK_REFERENCE.md](06-REFERENCE/QUICK_REFERENCE.md)** — One-page cheat sheet
- **[../ROADMAP.md](../ROADMAP.md)** — Development roadmap

### Folder Structure:

```
ARCH_DOCS/
├── 00-README.md              ← You are here
├── CURRENT_STATUS.md         ← Live system status
├── MASTER_ARCHITECTURE.md    ← System gospel
│
├── 01-CORE/                  ← Standards, policies, contracts
│   ├── AI_ROLE_POLICY.md
│   ├── ARTIFACT_AUTHORITY_CONTRACT.md
│   ├── CLIENT_API_GUIDE.md
│   ├── DATABASE_CONNECTION_STANDARD.md
│   ├── DATABASE_SCHEMA_REGISTRY.md
│   ├── FINAL_STACK.md
│   ├── SCHEMA_DRIFT_QUICK_ACTIONS.md
│   └── SYSTEM_OF_RECORD_COMPLIANCE.md
│
├── 02-FEATURES/              ← Feature specifications
│   ├── BOOKING_SCHEDULING.md
│   ├── COLLECTIONS_CRM.md
│   ├── FUTURE_INTEGRATIONS.md
│   ├── LIVE_TRANSLATION_CALL_FLOW.md
│   ├── SECRET_SHOPPER_INFRASTRUCTURE.md
│   └── TELNYX_WEBRTC_STANDARD.md
│
├── 03-INFRASTRUCTURE/        ← Deployment, security, operations
│   ├── CLOUDFLARE_DEPLOYMENT.md
│   ├── LOAD_TESTING_GUIDE.md
│   ├── MONITORING.md
│   ├── SECURITY_HARDENING.md
│   └── TELNYX_ACCOUNT_TIER.md
│
├── 04-DESIGN/                ← UX, design system, patterns
│   ├── DATA_FETCHING_PATTERNS.md
│   ├── DESIGN_SYSTEM.md
│   ├── UI_REBUILD_BLUEPRINT.md
│   └── UX_WORKFLOW_PATTERNS.md
│
├── 05-AI/                    ← AI/ML architecture & costs
│   ├── AI_ROUTER_ARCHITECTURE.md
│   ├── BAKEOFF_GROK_GROQ_ELEVENLABS.md
│   └── COST_OPTIMIZATION_STRATEGY.md
│
├── 06-REFERENCE/             ← Quick refs, testing, validation
│   ├── CODEBASE_REFERENCE.md
│   ├── DEPLOYMENT_RUNBOOK.md
│   ├── FEATURE_GATING.md
│   ├── QUICK_REFERENCE.md
│   ├── TESTING.md
│   └── VALIDATION_PROCESS.md
│
├── DECISIONS/                ← Architecture Decision Records
│   ├── 000-use-architecture-decision-records.md
│   ├── 001-telnyx-over-signalwire.md
│   ├── 002-custom-auth-over-nextauth.md
│   └── MIGRATION_CHANGELOG.md
│
└── LESSONS_LEARNED/          ← Institutional knowledge
    ├── MAIN.md
    ├── NAV_OVERHAUL_QA_REPORT.md
    ├── SECURITY_AUDIT.md
    ├── TELNYX_TRANSCRIPTION_API.md
    └── TYPESCRIPT_BUILD_BUG.md
```

**43 files. Zero stale vendor references. No duplicate numbering.**

---

## Current System Status

| Metric | Value | Status |
|--------|-------|--------|
| **Architecture** | Hybrid (Pages + Workers) | Deployed |
| **UI** | https://wordis-bond.com | Live |
| **API** | https://wordisbond-api.adrper79.workers.dev | Live |
| **Navigation** | 3 Role Shells (agent/manager/admin) + Cockpit | Active |
| **RBAC** | 9 roles, unified vocabulary | Enforced |
| **Tables** | 96 (61 active, 35 orphan) | Needs cleanup |
| **RLS** | 5/96 tables | App-code isolation |
| **Tests** | 850+ (753 pass, 53 new nav/RBAC) | Green |
| **API Routes** | 48 route files, 120+ endpoints | Operational |
| **AI** | Groq (primary LLM) + Grok (TTS) | 38% cost savings |
- ✅ Grok Voice (TTS) - **NEW**
- ✅ OpenAI (LLM + TTS)
- ✅ ElevenLabs (Premium TTS)
- ✅ Resend (Email)
- ✅ Custom Workers Auth (PBKDF2 + KV sessions)
- ✅ Stripe (Billing/Webhooks)

**Recent Additions (Feb 11, 2026):**

- ✅ **AI Optimization** — Smart routing, 38% cost reduction
- ✅ **Security Hardening** — RLS on 39+ tables, PII redaction
- ✅ **Collections Module** — CSV import, analytics, payment tracking
- ✅ **Onboarding Flow** — 5-step guided setup with trial activation
- ✅ **Data Fetching Hooks** — useApiQuery, useSSE for real-time data

**Previous Additions (Jan 17, 2026):**

- ✅ Campaign Manager (3 new tables, 6 endpoints, full UI)
- ✅ Report Builder (4 new tables, 4 endpoints, full UI)
- ✅ Analytics Dashboard (Complete with 5 tabs)

---

## 📚 **Documentation by Category**

### **01-CORE** - System Architecture

Essential documents defining system design:

- **FULL_SYSTEM_ARCHITECTURE.md** - Complete architecture with site maps, diagrams, data flows (NEW)
- **GAP_ANALYSIS.md** - Comprehensive gap analysis with resolution plan (NEW)
- **GRAPHICAL_ARCHITECTURE.md** - Mermaid diagrams for system visualization
- **MASTER_ARCHITECTURE.txt** - Core system architecture, data flow, contracts
- **Schema.txt** - Database schema with all tables and relationships
- **ERROR_HANDLING_PLAN.txt** - Error handling strategy and patterns
- **TOOL_TABLE_ALIGNMENT** - Tool-to-table mapping and boundaries
- **CLIENT_API_GUIDE.md** - Client-side API development guide (credentials, patterns)
- **SYSTEM_OF_RECORD_COMPLIANCE.md** - Evidence integrity and custody requirements

**When to read:** Understanding system design, onboarding new developers, planning work

---

### **02-FEATURES** - Feature Documentation

Detailed guides for major features:

- **[COLLECTIONS_MODULE.md](02-FEATURES/COLLECTIONS_MODULE.md)** ⭐ **NEW** - Bulk debt collection management
- **BOOKING_SCHEDULING.md** - Cal.com-style booking & scheduling
- **CHROME_EXTENSION.md** - Browser extension for click-to-call
- **AI_SURVEY_BOT.md** - AI-powered inbound survey calls
- **Translation_Agent** - Live translation architecture and implementation
- **TRANSLATION_AGENT_IMPLEMENTATION_PLAN.md** - Implementation roadmap
- **SECRET_SHOPPER_INFRASTRUCTURE.md** - Secret shopper feature design
- **SHOPPER_PLAN.md** - Secret shopper implementation plan
- **BULK_UPLOAD_FEATURE.md** - Bulk phone upload for batch calls
- **TEST_DASHBOARD.md** - Test dashboard with visual KPIs
- **NAVIGATION_SETTINGS_IMPLEMENTATION.md** - Nav bar and settings UI

**When to read:** Implementing or debugging specific features

---

### **03-INFRASTRUCTURE** - Infrastructure & Deployment

Infrastructure, media plane, and external integrations:

- **[SECURITY_HARDENING.md](03-INFRASTRUCTURE/SECURITY_HARDENING.md)** ⭐ **NEW** - RLS, PII redaction, multi-tenant isolation
- **[CLOUDFLARE_COMPLIANCE.md](03-INFRASTRUCTURE/CLOUDFLARE_COMPLIANCE.md)** - Cloudflare security best practices
- **[CLOUDFLARE_DEPLOYMENT.md](03-INFRASTRUCTURE/CLOUDFLARE_DEPLOYMENT.md)** - Cloudflare Pages deployment guide
- **MEDIA_PLANE_ARCHITECTURE.txt** - Media plane design (⚠️ historical — SignalWire/FreeSWITCH era)
- **FREESWITCH_RUNBOOK.md** - FreeSWITCH operations guide (⚠️ historical)
- **media_plane_diagram.md** - Visual architecture diagrams
- **SIGNALWIRE_AI_AGENTS_RESEARCH.md** - SignalWire AI Agent capabilities (⚠️ historical — vendor replaced by Telnyx)

**When to read:** Deploying, scaling, security hardening, or infrastructure changes

---

### **04-DESIGN** - Design & Principles

UX design principles and deployment guidelines:

- **UX_DESIGN_PRINCIPLES.txt** - UI/UX standards and patterns
- **DEPLOYMENT_NOTES.md** - Deployment checklist and configuration

**When to read:** Building UI, deploying to production

---

### **04-GUIDES** - Implementation Guides

**Developer Guides:**

- **[DATA_FETCHING_PATTERNS.md](04-GUIDES/DATA_FETCHING_PATTERNS.md)** ⭐ **NEW** - useApiQuery, useSSE hooks
- **[ONBOARDING_FLOW.md](04-GUIDES/ONBOARDING_FLOW.md)** - User onboarding implementation

**When to read:** Implementing new features, learning patterns

---

### **05-AI-OPTIMIZATION** ⭐ **NEW** - AI Cost Optimization

**Strategic AI initiatives:**

- **[AI_ROUTER_ARCHITECTURE.md](05-AI-OPTIMIZATION/AI_ROUTER_ARCHITECTURE.md)** - Smart provider routing (38% savings)
- **[COST_OPTIMIZATION_STRATEGY.md](05-AI-OPTIMIZATION/COST_OPTIMIZATION_STRATEGY.md)** - Comprehensive cost reduction strategy
- **PROVIDER_COMPARISON.md** - Groq vs OpenAI vs Grok analysis (coming soon)

**When to read:** AI integration, cost optimization, provider selection

---

### **05-REFERENCE** - Reference Materials

**Agent-Optimized Refs:**

- **[DB_SCHEMA_REFERENCE.md](05-REFERENCE/DB_SCHEMA_REFERENCE.md)** - Tables, rels, ERD, queries
- **[CODEBASE_REFERENCE.md](05-REFERENCE/CODEBASE_REFERENCE.md)** - Key funcs/modules/routes
- **[DESIGN_REFERENCE.md](05-REFERENCE/DESIGN_REFERENCE.md)** - UI system, topologies

**Other:**

- **evidence_manifest_sample.json** - Evidence structure
- **JSON_MAPPING** - Field mappings
- **[TAILWIND_SHADCN.md](05-REFERENCE/TAILWIND_SHADCN.md)** - UI tech

**When to read:** Quick lookups, agent context

---

### **archive/** - Historical Documents

Historical reviews, fixes, and completed implementations:

#### **archive/reviews/** - Code Reviews (Historical)

- Systematic review documents
- Holistic review iterations
- Test validation results

#### **archive/fixes/** - Issue Fixes (Resolved)

- **CLIENT_FETCH_CREDENTIALS_FIX.md** - 401 errors from missing `credentials: 'include'` (Jan 2026)
- Authentication 401 fixes (Supabase apikey header)
- Type duplication root cause analysis
- Translation toggle visibility fix
- SignalWire number missing fix
- Missed issues analysis

#### **archive/implementations/** - Completed Work

- Live translation completion notes
- Implementation summaries
- Issues fixed summaries

**When to read:** Understanding historical context, troubleshooting similar issues

---

## 🚀 **Quick Start Guides**

### **For Agents/New Developers:**

- Use 05-REFERENCE/ new refs for DB/code/design overviews.

1. Read `CURRENT_STATUS.md` for system overview
2. Read `01-CORE/MASTER_ARCHITECTURE.txt`
3. Review `01-CORE/Schema.txt`
4. Check `QUICK_REFERENCE.md` for common tasks

### **For Feature Development:**

1. Check `02-FEATURES/` for existing feature docs
2. Follow patterns in `01-CORE/MASTER_ARCHITECTURE.txt`
3. Review `01-CORE/ERROR_HANDLING_PLAN.txt`
4. All API routes live in `workers/src/routes/` (Hono handlers)

### **For Debugging:**

1. Check `ARCH_DOCS/LESSONS_LEARNED.md` for known pitfalls
2. Check feature-specific docs in `02-FEATURES/`
3. Review `archive/fixes/` for similar issues
4. Consult `01-CORE/ERROR_HANDLING_PLAN.txt`

### **For Deployment:**

1. Read `04-DESIGN/DEPLOYMENT_NOTES.md`
2. Check environment variables in `QUICK_REFERENCE.md`
3. Verify via `/api/health` endpoint
4. Check `/test` dashboard

---

## 🎯 **Key Documents Summary**

| Document                         | Purpose                | Audience      | Status               |
| -------------------------------- | ---------------------- | ------------- | -------------------- |
| CURRENT_STATUS.md                | System status & gaps   | All           | ✅ Current           |
| FULL_SYSTEM_ARCHITECTURE.md      | Complete architecture  | All devs      | ⚠️ Historical (v1.x) |
| GAP_ANALYSIS.md                  | Gap analysis & roadmap | Product/Dev   | ✅ NEW               |
| QUICK_REFERENCE.md               | Cheat sheet            | All           | ✅ Current           |
| MASTER_ARCHITECTURE.txt          | Core system design     | All devs      | ✅ Current           |
| Schema.txt                       | Database schema        | Backend devs  | ✅ Current           |
| BOOKING_SCHEDULING.md            | Cal.com-style booking  | Feature devs  | ✅ Complete          |
| CHROME_EXTENSION.md              | Browser extension      | Feature devs  | ✅ Complete          |
| AI_SURVEY_BOT.md                 | AI Survey Bot          | Feature devs  | ✅ Complete          |
| Translation_Agent                | Live translation       | Feature devs  | ✅ Complete          |
| SECRET_SHOPPER_INFRASTRUCTURE.md | Secret shopper         | Feature devs  | ✅ Complete          |
| UX_DESIGN_PRINCIPLES.txt         | UI/UX standards        | Frontend devs | ✅ Current           |
| V5_Issues.txt                    | Current fixes          | DevOps        | ✅ Current           |
| FREESWITCH_RUNBOOK.md            | Media ops              | DevOps        | 🟡 Future            |

---

## 🔧 **Recent Updates (February 11, 2026)**

### **v4.47: AI Optimization + Security Hardening**

1. ✅ **AI Provider Consolidation** — 4 providers → 2 core (Groq + OpenAI)
2. ✅ **Smart Routing** — 38% cost reduction via complexity-based routing
3. ✅ **Security Hardening** — RLS on 39+ tables, PII redaction active
4. ✅ **New Features** — Collections module, onboarding flow, data fetching hooks
5. ✅ **Cost Controls** — Per-organization AI quotas with hard limits
6. ✅ **Type Migration** — Zero-downtime ID standardization (INTEGER→UUID, UUID→TEXT)

### **v4.21–4.22: CIO Audit + Legacy Vendor Purge (Feb 7, 2026)**

1. ✅ **CIO Production Audit** — 7 critical fixes (RBAC, webhooks, pool leaks, health check)
2. ✅ **Legacy Vendor Purge** — 100% clean of SignalWire/Supabase/NextAuth in active source
3. ✅ **40+ garbage files deleted** — test scripts, stale migrations, build artifacts
4. ✅ **apiClient TS fix** — 8 `unknown` type errors resolved

### **Historical: v1.x Features (January 2026)**

### **Historical: v1.x Features (January 2026)**

3. ✅ **AI Survey Bot** - Inbound calls (now via Telnyx)
4. ✅ **Voice Cloning** - Clone caller's voice for translations (ElevenLabs)
5. ✅ **Email Artifacts** - Send recordings/transcripts/translations as attachments
6. ✅ **Inbound Numbers API** - Manage inbound phone numbers (now via Telnyx)

### **Historical Codebase Fixes (January 13):**

> ⚠️ These fixes applied to the v1.x architecture (Supabase/NextAuth/Next.js API routes). All have been superseded by the Workers migration.

### **Documentation Updates:**

- ✅ Updated `CURRENT_STATUS.md` with v4.22 status
- ✅ All ARCH_DOCS reviewed and stale content flagged/fixed

---

## 📝 **Document Lifecycle**

### **Active Documents:**

- Located in numbered folders (01-05)
- Updated with code changes
- Required reading for development

### **Archived Documents:**

- Located in `archive/`
- Historical reference only
- Not required reading
- Useful for context/troubleshooting

---

## 🔄 **Maintenance**

### **When to Update:**

- Major architecture changes → Update `01-CORE/`
- New features → Add to `02-FEATURES/`
- Infrastructure changes → Update `03-INFRASTRUCTURE/`
- Resolved issues → Move to `archive/fixes/`
- Completed reviews → Move to `archive/reviews/`
- Status changes → Update `CURRENT_STATUS.md`

### **Archive Policy:**

- Code review documents → Archive after addressed
- Fix notes → Archive after merged
- Implementation notes → Archive after deployed
- Iteration documents → Archive after finalized

---

## 🎉 **Changelog**

### **v1.5 - January 16, 2026:**

- ✅ Added `FULL_SYSTEM_ARCHITECTURE.md` - Complete architecture with graphical diagrams
- ✅ Added `GAP_ANALYSIS.md` - Comprehensive gap analysis with resolution plan
- ✅ Updated `GRAPHICAL_ARCHITECTURE.md` with references
- ✅ Updated `CURRENT_STATUS.md` with gap tracking
- ✅ Fixed translation validation issues (phone state, live/post-call translation)
- ✅ Completed survey implementation (DTMF display, analytics, webhooks, question types, locales)
- ✅ API endpoint count updated (~50 routes)
- ✅ Overall completeness tracked: 82%

### **v1.4 - January 14, 2026:**

- ✅ TOGAF Architecture Development Method (ADM) compliance review
- ✅ Added `voice_targets` and `surveys` tables to Schema.txt
- ✅ Updated API endpoint count (38 → 42)
- ✅ Added ARCHITECTURE_COMPLIANCE_REVIEW.md
- ✅ SOC 2 control mapping verified
- ✅ Feature count updated (22 → 26)

### **v1.3 - January 14, 2026:**

- ✅ Added Survey Builder and Voice Target Manager components
- ✅ Added Cal.com-Style Booking feature
- ✅ Added Chrome Extension documentation
- ✅ UI overhaul with Jetsons design system

### **v1.2 - January 14, 2026:**

- ✅ Added AI Survey Bot feature
- ✅ Added Voice Cloning integration
- ✅ Added Email Artifacts delivery
- ✅ Added SignalWire Numbers API

### **v1.1 - January 13, 2026:**

- ✅ Updated all documentation for current codebase state
- ✅ Added service configuration verification
- ✅ Updated test pass rates (98.5%)
- ✅ Added API route count (38 dynamic routes)
- ✅ Added V4_Issues.txt reference

### **v1.0 - January 12, 2026:**

- ✅ Reorganized ARCH_DOCS into logical structure
- ✅ Archived 20+ historical documents
- ✅ Consolidated duplicate reviews
- ✅ Added comprehensive index

---

## 📞 **Support**

**Questions about:**

- Current status → See `CURRENT_STATUS.md`
- Quick help → See `QUICK_REFERENCE.md`
- Architecture → See `01-CORE/MASTER_ARCHITECTURE.txt`
- Features → See `02-FEATURES/`
- Deployment → See `04-DESIGN/DEPLOYMENT_NOTES.md`
- Recent fixes → See `V4_Issues.txt`
- Historical issues → See `archive/`

---

**Maintained by:** Development Team  
**Last Review:** January 16, 2026  
**Next Review:** After Phase 1 gap resolution
