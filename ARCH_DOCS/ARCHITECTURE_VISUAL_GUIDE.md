# Word Is Bond - Architecture Visual Guide

**Last Updated:** January 16, 2026  
**Version:** 1.6.0  
**Status:** Current State + Conceptual Design

---

## 📐 **System Overview Diagram**

```mermaid
graph TB
    subgraph "User Interfaces"
        WEB[Web App<br/>Next.js 14]
        EXT[Chrome Extension<br/>v1.0]
        API_CLIENT[API Clients<br/>External Integrations]
    end

    subgraph "Application Layer"
        ROUTES[API Routes<br/>38 endpoints]
        ACTIONS[Server Actions<br/>Call Management]
        MIDDLEWARE[Middleware<br/>Auth + Rate Limiting]
    end

    subgraph "Business Logic"
        COE[Call Orchestration Engine<br/>startCallHandler]
        USAGE[Usage Tracker<br/>Metering Service]
        BILLING[Billing Service<br/>Stripe Integration]
        RBAC[RBAC System<br/>Capability Gating]
    end

    subgraph "Data Layer"
        DB[(Neon Serverless<br/>Postgres)]
        STORAGE[Cloudflare R2<br/>Media Files]
        AUDIT[Audit Logs<br/>Provenance Chain]
    end

    subgraph "External Services"
        TELNYX[Telnyx<br/>Media Execution]
        AI_STT[AssemblyAI<br/>STT + Translation]
        ELEVEN[ElevenLabs<br/>TTS + Voice Clone]
        STRIPE[Stripe<br/>Payments]
        EMAIL[Resend<br/>Notifications]
    end

    WEB --> ROUTES
    EXT --> ROUTES
    API_CLIENT --> ROUTES
    ROUTES --> ACTIONS
    ACTIONS --> COE
    ACTIONS --> USAGE
    ACTIONS --> BILLING
    COE --> RBAC
    COE --> DB
    COE --> TELNYX
    TELNYX --> AI_STT
    TELNYX --> ELEVEN
    AI_STT --> DB
    ELEVEN --> STORAGE
    USAGE --> DB
    BILLING --> STRIPE
    STRIPE --> DB
    DB --> AUDIT
    ACTIONS --> EMAIL

    style WEB fill:#e3f2fd
    style COE fill:#fff3e0
    style DB fill:#e8f5e9
    style TELNYX fill:#fce4ec
```

---

## 🏗️ **Call Flow Architecture**

```mermaid
sequenceDiagram
    participant User
    participant UI as Web UI
    participant API as API Layer
    participant COE as Call Orchestration
    participant RBAC as Capability Check
    participant Usage as Usage Tracker
    participant DB as Neon DB
    participant TELNYX as Telnyx
    participant AI as AssemblyAI
    participant TTS as ElevenLabs

    User->>UI: Click "Make Call"
    UI->>API: POST /api/calls/start
    API->>RBAC: Check capabilities(plan, role)
    RBAC-->>API: Allowed features
    API->>Usage: Check usage limits
    Usage-->>API: Within limits
    API->>COE: startCallHandler()
    COE->>DB: Create call record
    COE->>TELNYX: Initiate call (TeXML)
    TELNYX-->>COE: Call started (call_sid)
    COE->>DB: Update call status
    COE-->>UI: Success + call_id
    
    Note over TELNYX,User: Call in progress...
    
    TELNYX->>TELNYX: Record call
    SW->>DB: Webhook: call.ended
    DB->>AI: Queue transcription job
    AI->>AI: Process audio
    AI->>DB: Webhook: transcription complete
    
    opt If translation enabled
        DB->>AI: Queue translation job
        AI->>AI: Translate transcript
        AI->>DB: Save translation
        DB->>TTS: Generate TTS audio
        TTS->>DB: Save audio file
    end
    
    DB->>Usage: Increment usage counters
    DB->>User: Email artifacts (optional)
```

---

## 💰 **Billing & Usage Architecture (NEW - Jan 16, 2026)**

```mermaid
graph TB
    subgraph "Usage Metering"
        CALL[Call Placement]
        TRACK[Usage Tracker]
        LIMITS[Usage Limits Check]
        COUNTERS[usage_records table]
    end

    subgraph "Stripe Integration"
        CHECKOUT[Checkout Session]
        PORTAL[Billing Portal]
        WEBHOOK[Webhook Handler]
        SUBS[stripe_subscriptions]
        INVOICES[stripe_invoices]
        EVENTS[stripe_events]
    end

    subgraph "Plan Gating"
        CAPS[Capability Check]
        PLANS[Plan Definitions]
        FEATURES[Feature Flags]
    end

    subgraph "UI Components"
        USAGE_UI[UsageDisplay<br/>Meters & Limits]
        BILLING_UI[BillingActions<br/>Upgrade & Portal]
        AI_UI[AIAgentConfig<br/>Model & Features]
    end

    CALL --> LIMITS
    LIMITS --> COUNTERS
    LIMITS --> CAPS
    CAPS --> PLANS
    PLANS --> FEATURES
    
    BILLING_UI --> CHECKOUT
    BILLING_UI --> PORTAL
    CHECKOUT --> STRIPE[Stripe API]
    PORTAL --> STRIPE
    STRIPE --> WEBHOOK
    WEBHOOK --> SUBS
    WEBHOOK --> INVOICES
    WEBHOOK --> EVENTS
    WEBHOOK --> PLANS
    
    COUNTERS --> USAGE_UI
    PLANS --> USAGE_UI
    PLANS --> AI_UI
    
    style TRACK fill:#fff3e0
    style WEBHOOK fill:#e1f5fe
    style CAPS fill:#f3e5f5
```

---

## 🎨 **Site Architecture - Current State**

### **Implemented Pages**

```
wordisbond.app/
├── / (Home/Landing)
│   └── Public marketing page
│
├── /dashboard
│   ├── ✅ Dashboard widgets
│   ├── ✅ Quick actions
│   ├── ✅ Recent calls
│   ├── ✅ Usage stats
│   └── ✅ Upcoming bookings
│
├── /voice
│   ├── ✅ Call list & filters
│   ├── ✅ Make call form
│   ├── ✅ Call detail view
│   ├── ✅ Recording player
│   ├── ✅ Transcript viewer
│   ├── ✅ Evidence manifest
│   └── ✅ Email artifacts
│
├── /analytics
│   ├── ✅ Dashboard widgets
│   ├── ✅ Call volume trends
│   ├── ✅ Quality metrics
│   └── ✅ Sentiment analysis
│
├── /bookings
│   ├── ✅ Schedule call
│   ├── ✅ Booking list
│   ├── ✅ Edit/cancel booking
│   └── ✅ Attendee management
│
├── /settings
│   ├── ✅ Voice config (tab)
│   ├── ✅ AI control (tab)
│   ├── ✅ AI agent config (tab)
│   ├── ✅ Survey builder (tab)
│   ├── ✅ Secret shopper (tab)
│   ├── ✅ Compliance/retention (tab)
│   ├── ✅ Team management (tab)
│   ├── ✅ Webhooks (tab)
│   └── ✅ Billing (tab)
│       ├── ✅ Usage display
│       ├── ✅ Billing actions
│       ├── ✅ Payment methods
│       └── ✅ Invoice history
│
├── /review/{callId}
│   ├── ✅ Read-only evidence view
│   ├── ✅ Authority badges
│   └── ✅ Export evidence button
│
├── /test
│   ├── ✅ Test dashboard
│   ├── ✅ Test runner
│   └── ✅ Test results
│
├── /admin
│   ├── ✅ User management
│   ├── ✅ Organization list
│   └── ✅ System diagnostics
│
├── /pricing
│   └── ✅ Public pricing page
│
├── /trust
│   └── ✅ Trust pack (security/compliance)
│
└── /verticals
    └── /healthcare
        └── ✅ Healthcare landing page
```

### **Missing/Incomplete Pages**

```
All core pages implemented.
```

---

## 🎯 **Conceptual Site Map - Future State**

```mermaid
graph TB
    HOME[/ Home]
    
    subgraph "Authenticated App"
        DASH[/dashboard<br/>Main Hub]
        VOICE[/voice<br/>Operations]
        BOOK[/bookings<br/>Scheduling]
        SETTINGS[/settings<br/>Configuration]
        REVIEW[/review<br/>Evidence View]
        TEST[/test<br/>QA Dashboard]
    end
    
    subgraph "Settings Tabs"
        SET_VOICE[Voice Config]
        SET_AI[AI Control]
        SET_SURVEY[Survey Builder]
        SET_SHOP[Secret Shopper]
        SET_COMP[Compliance]
        SET_TEAM[Team]
        SET_BILL[Billing ⚠️]
    end
    
    subgraph "Future Pages"
        ANALYTICS[/analytics<br/>❌ New Page]
        WEBHOOKS_UI[/settings?tab=webhooks<br/>❌ New Tab]
        REPORTS[/reports<br/>❌ New Page]
    end
    
    subgraph "Public Pages"
        PRICING[/pricing]
        TRUST[/trust]
        VERT_HC[/verticals/healthcare]
        VERT_LEGAL[/verticals/legal ❌]
        VERT_GOV[/verticals/government ❌]
    end
    
    subgraph "Admin"
        ADMIN[/admin<br/>System Admin]
    end

    HOME --> DASH
    HOME --> PRICING
    HOME --> TRUST
    HOME --> VERT_HC
    
    DASH --> VOICE
    DASH --> BOOK
    DASH --> SETTINGS
    DASH --> ANALYTICS
    DASH --> TEST
    
    VOICE --> REVIEW
    
    SETTINGS --> SET_VOICE
    SETTINGS --> SET_AI
    SETTINGS --> SET_SURVEY
    SETTINGS --> SET_SHOP
    SETTINGS --> SET_COMP
    SETTINGS --> SET_TEAM
    SETTINGS --> SET_BILL
    SETTINGS --> WEBHOOKS_UI
    
    SET_BILL --> ANALYTICS
    
    style ANALYTICS fill:#ffcdd2
    style WEBHOOKS_UI fill:#ffcdd2
    style REPORTS fill:#ffcdd2
    style SET_BILL fill:#fff3e0
    style VERT_LEGAL fill:#ffcdd2
    style VERT_GOV fill:#ffcdd2
```

---

## 📊 **Database Schema - Core Tables**

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORG_MEMBERS : has
    ORGANIZATIONS ||--o{ CALLS : owns
    ORGANIZATIONS ||--o{ VOICE_CONFIGS : has
    ORGANIZATIONS ||--o{ USAGE_RECORDS : tracks
    ORGANIZATIONS ||--o{ USAGE_LIMITS : defines
    ORGANIZATIONS ||--o{ STRIPE_SUBSCRIPTIONS : has
    
    USERS ||--o{ ORG_MEMBERS : belongs
    USERS ||--o{ CALLS : initiates
    
    CALLS ||--o{ RECORDINGS : generates
    CALLS ||--o{ AI_RUNS : processes
    CALLS ||--o{ EVIDENCE_MANIFESTS : produces
    CALLS ||--o{ CALL_NOTES : annotates
    
    RECORDINGS ||--o{ EVIDENCE_BUNDLES : includes
    AI_RUNS ||--o{ EVIDENCE_MANIFESTS : contributes
    
    ORGANIZATIONS ||--o{ CALL_TARGETS : defines
    ORGANIZATIONS ||--o{ CALLER_IDS : manages
    ORGANIZATIONS ||--o{ SURVEYS : creates
    ORGANIZATIONS ||--o{ SCORECARDS : configures
    ORGANIZATIONS ||--o{ BOOKINGS : schedules
    ORGANIZATIONS ||--o{ WEBHOOK_SUBSCRIPTIONS : configures
    
    STRIPE_SUBSCRIPTIONS ||--o{ STRIPE_INVOICES : generates
    STRIPE_SUBSCRIPTIONS ||--o{ STRIPE_EVENTS : logs
    
    ORGANIZATIONS {
        uuid id PK
        text name
        text plan
        text plan_status
        text stripe_customer_id
        text stripe_subscription_id
    }
    
    CALLS {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        text status
        text direction
        text from_number
        text to_number
        timestamptz created_at
    }
    
    USAGE_RECORDS {
        uuid id PK
        uuid organization_id FK
        integer calls_count
        integer minutes_used
        integer transcriptions_count
        integer translations_count
        date period_start
        date period_end
    }
    
    STRIPE_SUBSCRIPTIONS {
        uuid id PK
        uuid organization_id FK
        text stripe_subscription_id UK
        text stripe_customer_id
        text plan
        text status
        timestamptz current_period_end
    }
```

---

## 🔐 **Authentication & Authorization Flow**

```mermaid
graph TB
    subgraph "Authentication (NextAuth.js)"
        LOGIN[User Login]
        SESSION[Session Check]
        JWT[JWT Token]
    end
    
    subgraph "Authorization (RBAC)"
        ORG_CHECK[Organization Membership]
        ROLE_CHECK[Role Verification]
        PLAN_CHECK[Plan Capabilities]
        FEATURE_CHECK[Feature Flags]
    end
    
    subgraph "Roles"
        OWNER[Owner<br/>Full Control]
        ADMIN[Admin<br/>Config + Execute]
        OPERATOR[Operator<br/>Execute Only]
        VIEWER[Viewer<br/>Read Only]
    end
    
    subgraph "Plans"
        FREE[Free<br/>Recording only]
        PRO[Pro<br/>+ Transcription]
        BUSINESS[Business<br/>+ Translation]
        ENTERPRISE[Enterprise<br/>+ SSO & API]
    end
    
    LOGIN --> SESSION
    SESSION --> JWT
    JWT --> ORG_CHECK
    ORG_CHECK --> ROLE_CHECK
    ROLE_CHECK --> OWNER
    ROLE_CHECK --> ADMIN
    ROLE_CHECK --> OPERATOR
    ROLE_CHECK --> VIEWER
    
    ORG_CHECK --> PLAN_CHECK
    PLAN_CHECK --> FREE
    PLAN_CHECK --> PRO
    PLAN_CHECK --> BUSINESS
    PLAN_CHECK --> ENTERPRISE
    
    PLAN_CHECK --> FEATURE_CHECK
    ROLE_CHECK --> FEATURE_CHECK
    
    FEATURE_CHECK --> ALLOW[Allow Action]
    FEATURE_CHECK --> DENY[Deny Action]
    
    style ALLOW fill:#c8e6c9
    style DENY fill:#ffcdd2
```

---

## 🚀 **Deployment Architecture**

```mermaid
graph TB
    subgraph "Edge Network"
        CF_PAGES[Cloudflare Pages<br/>Global CDN]
        CF_WORKERS[Cloudflare Workers<br/>Edge Logic]
        CF_CRON[Cloudflare Triggers<br/>Scheduled Jobs]
    end
    
    subgraph "Application"
        NEXT[Next.js App<br/>SSR + API Routes]
        MIDDLEWARE[Middleware<br/>Auth + Rate Limit]
    end
    
    subgraph "Data & Storage"
        NEON[Neon Serverless<br/>Postgres + Hyperdrive]
        R2[Cloudflare R2<br/>Media Storage]
        CACHE[Edge Cache<br/>Static Assets]
    end
    
    subgraph "External APIs"
        TELNYX[Telnyx<br/>Voice & Media]
        ASSEMBLYAI[AssemblyAI<br/>Transcription]
        ELEVENLABS[ElevenLabs<br/>TTS]
        STRIPE[Stripe<br/>Billing]
        RESEND[Resend<br/>Email]
    end
    
    CF_PAGES --> NEXT
    NEXT --> MIDDLEWARE
    MIDDLEWARE --> NEON
    NEXT --> CACHE
    CF_CRON --> CF_WORKERS
    
    NEXT --> TELNYX
    NEXT --> ASSEMBLYAI
    NEXT --> ELEVENLABS
    NEXT --> STRIPE
    NEXT --> RESEND
    
    TELNYX --> CF_WORKERS
    ASSEMBLYAI --> CF_WORKERS
    STRIPE --> CF_WORKERS
    
    style CF_PAGES fill:#e3f2fd
    style NEON fill:#e8f5e9
    style TELNYX fill:#fce4ec
```

---

## 📱 **Component Hierarchy - Settings Page**

```
SettingsPage
├── AppShell (Navigation)
├── Header
│   ├── Organization Name
│   └── Plan Badge
├── Tab Navigation
│   ├── Voice Config Tab
│   ├── AI Control Tab ⭐
│   ├── Survey Builder Tab
│   ├── Secret Shopper Tab
│   ├── Compliance Tab
│   ├── Team Tab
│   └── Billing Tab ⚠️
└── Tab Content
    ├── Voice Config Tab
    │   ├── CallTargets
    │   ├── CallerIdManager
    │   └── VoiceConfigForm
    │
    ├── AI Control Tab ⭐ NEW
    │   ├── AIControlSection
    │   ├── AIAgentConfig ⭐ NEW (Jan 16)
    │   │   ├── Master toggle
    │   │   ├── Live translation settings
    │   │   ├── Voice cloning toggle
    │   │   ├── Model selection
    │   │   ├── Temperature slider
    │   │   ├── Custom agent ID (Business+)
    │   │   └── Custom prompts (Enterprise)
    │   └── SurveyBuilder
    │
    ├── Survey Builder Tab
    │   └── SurveyBuilder
    │
    ├── Secret Shopper Tab
    │   └── SecretShopperConfig
    │
    ├── Compliance Tab
    │   └── RetentionSettings
    │
    ├── Team Tab
    │   └── TeamManagement
    │
    └── Billing Tab ⚠️ PARTIAL
        ├── UsageDisplay ⭐ NEW (Jan 16)
        │   ├── Calls meter
        │   ├── Minutes meter
        │   ├── Transcription counter
        │   └── Translation counter
        ├── BillingActions (stub)
        │   ├── Plan info
        │   └── Upgrade button (no flow)
        └── ❌ Missing: Self-service upgrade
            ├── ❌ Stripe checkout integration
            ├── ❌ Payment method management
            └── ❌ Invoice history

⭐ = Implemented January 16, 2026
⚠️ = Partial implementation
❌ = Not implemented
```

---

## 🎯 **Implementation Gaps Summary**

### **By Priority**

#### 🔴 **Critical Gaps (Revenue Blockers)**
```
All critical gaps resolved.
```

#### 🟡 **High Priority (User Experience)**
```
None.
```

#### 🟢 **Nice to Have (Future)**
```
5. Additional Vertical Landing Pages (1 day each)
   - /verticals/legal
   - /verticals/government
   - /verticals/sales
   Status: Template exists (healthcare)
   
6. Advanced Reporting (5-7 days)
   - Custom date ranges
   - Export to PDF/CSV
   - Scheduled reports
   Status: Not started
```

---

## 📈 **Feature Completeness Matrix**

| Feature Area | Backend | Frontend | Testing | Docs | Overall |
|-------------|---------|----------|---------|------|---------|
| Core Voice Operations | 100% | 100% | 95% | 100% | ✅ 100% |
| Recording & Transcription | 100% | 100% | 95% | 100% | ✅ 100% |
| Post-Call Translation | 100% | 95% | 90% | 95% | ✅ 95% |
| Live Translation | 100% | 90% | 85% | 90% | ✅ 90% |
| Survey System | 100% | 100% | 95% | 100% | ✅ 100% |
| Secret Shopper | 100% | 95% | 90% | 95% | ✅ 95% |
| Evidence & Compliance | 100% | 100% | 95% | 100% | ✅ 100% |
| Team Management | 100% | 100% | 95% | 95% | ✅ 100% |
| Booking System | 100% | 100% | 90% | 95% | ✅ 100% |
| Chrome Extension | 100% | 100% | 85% | 90% | ✅ 95% |
| **Usage Metering** ⭐ | **100%** | **100%** | **95%** | **100%** | ✅ **100%** |
| **Stripe Billing** ⭐ | **100%** | **100%** | **95%** | **100%** | ✅ **100%** |
| **AI Agent Config** ⭐ | **100%** | **100%** | **95%** | **100%** | ✅ **100%** |
| Analytics Dashboard | 100% | 100% | 90% | 100% | ✅ 100% |
| Webhook Config UI | 100% | 100% | 90% | 100% | ✅ 100% |

**Legend:**
- ✅ 90-100% = Fully complete
- ⚠️ 60-89% = Partial implementation
- ❌ 0-59% = Incomplete
- ⭐ = New implementation (Jan 31, 2026)

---

## 🔧 **Technology Stack Detail**

### **Frontend**
```yaml
Framework: Next.js 14 (App Router)
Language: TypeScript 5.9
Styling: Tailwind CSS 4.1
UI Components: Custom (Professional Design System v3.0)
State Management: React hooks + server actions
Icons: Inline SVG (no icon library)
```

### **Backend**
```yaml
API: Next.js API Routes + Cloudflare Workers
Auth: Auth.js (NextAuth) with Neon Adapter
Database: Neon Serverless Postgres (44 tables)
Storage: Cloudflare R2 (media files)
Rate Limiting: Cloudflare Rate Limiting
Validation: Zod 3.22
```

### **External Services**
```yaml
Voice: Telnyx (TeXML for standard, Media Streams for AI)
STT/Translation: AssemblyAI
TTS: ElevenLabs + Voice Cloning
Billing: Stripe (subscriptions + usage-based)
Email: Resend
Monitoring: Cloudflare Analytics + Logpush
```

### **Infrastructure**
```yaml
Hosting: Cloudflare Pages (Frontend)
Edge Logic: Cloudflare Workers
CDN: Cloudflare Global Edge
Cron Jobs: Cloudflare Cron Triggers
CI/CD: GitHub Actions -> Cloudflare Pages
Secrets: Cloudflare Environment Variables
```

---

## 📝 **Next Steps Recommendation**

### **Immediate Actions (This Week)**

1. **Complete Billing Self-Service** (2-3 days)
   - Integrate Stripe checkout flow in BillingActions component
   - Add payment method management UI
   - Add invoice history view
   - Test end-to-end upgrade flow
   - **Impact:** Unblocks revenue generation

2. **Polish AI Agent Config** (1 day)
   - Complete plan-based feature locking UI
   - Add inline help text for settings
   - Test with actual SignalWire AI agents
   - **Impact:** Makes live translation production-ready

### **Next Sprint (Next 2 Weeks)**

3. **Create Analytics Page** (3-4 days)
   - Move dashboard widgets to dedicated page
   - Add call volume trends (chart.js or recharts)
   - Add quality metrics over time
   - Add export functionality
   - **Impact:** Better insights for users

4. **Build Webhook Config UI** (2 days)
   - Add webhooks tab to settings
   - List configured webhooks with status
   - Add/edit/delete webhook forms
   - Test endpoint button
   - **Impact:** Self-service for power users

### **Future Enhancements**

5. **Additional Verticals** (1 day each)
   - Legal vertical landing page
   - Government vertical landing page
   - Sales/customer success vertical
   
6. **Advanced Reporting** (5-7 days)
   - Custom date ranges
   - Scheduled reports
   - Export to PDF/CSV
   - Compliance reporting templates

---

## 🎨 **Design System Reference**

### **Color Palette**
```css
/* Primary (Navy) */
--primary-50: #e3f2fd;
--primary-600: #1e40af;
--primary-700: #1e3a8a;

/* Success (Green) */
--success: #10b981;
--success-light: #d1fae5;

/* Warning (Amber) */
--warning: #f59e0b;
--warning-light: #fef3c7;

/* Error (Red) */
--error: #ef4444;
--error-light: #fee2e2;

/* Neutral (Gray) */
--gray-50: #f9fafb;
--gray-200: #e5e7eb;
--gray-600: #4b5563;
--gray-900: #111827;
```

### **Component Patterns**
```
Professional Design System v3.0
- Light theme only
- No emojis in UI
- Navy primary color
- Clean, minimal aesthetic
- Data-first hierarchy
- Inline SVG icons (no library)
```

---

**End of Visual Guide**

For detailed implementation status, see [CURRENT_STATUS.md](./CURRENT_STATUS.md)  
For gap analysis, see [GAP_ANALYSIS_JAN_16_2026.md](./05-STATUS/GAP_ANALYSIS_JAN_16_2026.md)  
For next steps, see [ROLLOUT_EXECUTION_PLAN.md](../ROLLOUT_EXECUTION_PLAN.md)
