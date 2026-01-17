# Wordis Bond - Site Architecture Visual Guide

**Version:** 3.0  
**Date:** January 17, 2026  
**Build Status:** ✅ PASSING

---

## 🗺️ Site Map - Actual Implementation

```mermaid
flowchart TB
    subgraph Public["🌐 Public Pages"]
        HOME["/"]
        PRICING["/pricing"]
        TRUST["/trust"]
        COMPARE["/compare"]
        CASES["/case-studies"]
    end
    
    subgraph Verticals["📋 Vertical Landing Pages"]
        V_GOV["/verticals/government"]
        V_HEALTH["/verticals/healthcare"]
        V_LEGAL["/verticals/legal"]
        V_PROP["/verticals/property-management"]
    end
    
    subgraph Auth["🔐 Authentication"]
        AUTH_ADMIN["/admin/auth"]
        INVITE["/invite/[token]"]
    end
    
    subgraph Dashboard["📊 Dashboard (Protected)"]
        DASH["/dashboard"]
        VOICE["/voice"]
        CAMPAIGNS["/campaigns"]
        REPORTS["/reports"]
        BOOKINGS["/bookings"]
        ANALYTICS["/analytics"]
        SETTINGS["/settings"]
        REVIEW["/review"]
        TEST["/test"]
    end
    
    HOME --> Auth
    HOME --> Public
    Public --> Verticals
    Auth --> Dashboard
```

---

## 📱 Page Inventory

### Public Pages (No Auth Required)

| Route | Status | Purpose |
|-------|--------|---------|
| `/` | ✅ Static | Landing page |
| `/pricing` | ✅ Static | Plan comparison |
| `/trust` | ✅ Static | Security & compliance |
| `/compare` | ✅ Static | Competitor comparison |
| `/case-studies` | ✅ Static | Customer stories |
| `/verticals/government` | ✅ Static | Government vertical |
| `/verticals/healthcare` | ✅ Static | Healthcare vertical |
| `/verticals/legal` | ✅ Static | Legal vertical |
| `/verticals/property-management` | ✅ Static | Property management |

### Protected Pages (Auth Required)

| Route | Status | Purpose | Bundle Size |
|-------|--------|---------|-------------|
| `/dashboard` | ✅ Dynamic | Main dashboard | 160 kB |
| `/voice` | ✅ Dynamic | Voice operations | 209 kB |
| `/campaigns` | ✅ Static | Campaign management | 122 kB |
| `/reports` | ✅ Static | Report builder | 122 kB |
| `/bookings` | ✅ Static | Scheduled calls | 93.9 kB |
| `/analytics` | ✅ Static | Analytics dashboard | 220 kB |
| `/settings` | ✅ Static | User/org settings | 165 kB |
| `/review` | ✅ Static | Evidence review | 104 kB |
| `/test` | ✅ Static | Test runner | 91.6 kB |

---

## 🔌 API Architecture - Actual vs Conceptual

### Actual API Endpoints (96+ routes)

```mermaid
flowchart TB
    subgraph Auth["🔐 Auth (5 endpoints)"]
        A1["POST /api/auth/signup"]
        A2["GET /api/auth/[...nextauth]"]
        A3["GET /api/auth/debug"]
        A4["POST /api/auth/unlock"]
    end
    
    subgraph Voice["📞 Voice (12 endpoints)"]
        V1["POST /api/voice/call"]
        V2["GET/PUT /api/voice/config"]
        V3["GET /api/voice/targets"]
        V4["POST /api/voice/bulk-upload"]
        V5["GET /api/voice/script"]
        V6["POST /api/voice/config/test"]
        V7["POST /api/voice/laml/outbound"]
        V8["POST /api/voice/swml/*"]
    end
    
    subgraph Calls["📞 Calls (10 endpoints)"]
        C1["GET/POST /api/calls"]
        C2["GET/PUT/DELETE /api/calls/[id]"]
        C3["POST /api/calls/[id]/email"]
        C4["GET /api/calls/[id]/export"]
        C5["POST /api/calls/[id]/notes"]
        C6["GET /api/calls/[id]/timeline"]
        C7["POST /api/calls/start"]
    end
    
    subgraph Billing["💳 Billing (5 endpoints)"]
        B1["POST /api/billing/checkout"]
        B2["POST /api/billing/cancel"]
        B3["GET /api/billing/subscription"]
        B4["GET /api/billing/portal"]
    end
    
    subgraph Campaigns["📢 Campaigns (5 endpoints)"]
        CA1["GET/POST /api/campaigns"]
        CA2["GET/PUT/DELETE /api/campaigns/[id]"]
        CA3["POST /api/campaigns/[id]/execute"]
        CA4["GET /api/campaigns/[id]/stats"]
    end
    
    subgraph Reports["📊 Reports (5 endpoints)"]
        R1["GET/POST /api/reports"]
        R2["GET /api/reports/[id]/export"]
        R3["GET/POST /api/reports/schedules"]
        R4["GET/PUT/DELETE /api/reports/schedules/[id]"]
    end
    
    subgraph Webhooks["🔗 Webhooks (10 endpoints)"]
        W1["GET/POST /api/webhooks"]
        W2["PATCH/DELETE /api/webhooks/[id]"]
        W3["POST /api/webhooks/stripe"]
        W4["POST /api/webhooks/signalwire"]
        W5["POST /api/webhooks/assemblyai"]
    end
    
    subgraph Analytics["📈 Analytics (6 endpoints)"]
        AN1["GET /api/analytics/calls"]
        AN2["GET /api/analytics/performance"]
        AN3["GET /api/analytics/sentiment-trends"]
        AN4["GET /api/analytics/surveys"]
        AN5["GET /api/analytics/export"]
    end
```

---

## 🎯 Feature Matrix - Actual vs Conceptual

### Voice Features

```mermaid
flowchart LR
    subgraph Implemented["✅ IMPLEMENTED"]
        I1["📞 Outbound Calls"]
        I2["🎙️ Recording"]
        I3["📝 Transcription"]
        I4["🌐 Translation"]
        I5["📊 Surveys"]
        I6["🛒 Secret Shopper"]
        I7["📧 Email Artifacts"]
    end
    
    subgraph Preview["⚠️ PREVIEW"]
        P1["🔄 Live Translation"]
        P2["🤖 AI Agent Config"]
    end
    
    subgraph Planned["❌ PLANNED"]
        PL1["📱 Mobile Dialer"]
        PL2["🎥 Video Calls"]
        PL3["💬 SMS Integration"]
    end
```

### Feature Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Outbound Calls** | ✅ 100% | SignalWire integration complete |
| **Recording** | ✅ 100% | Auto-record all calls |
| **Transcription** | ✅ 100% | AssemblyAI post-call |
| **Translation** | ✅ 95% | Post-call via AssemblyAI |
| **Live Translation** | ⚠️ 80% | SignalWire AI Agents (Business+ only) |
| **Surveys** | ✅ 100% | IVR + AI bot surveys |
| **Secret Shopper** | ✅ 95% | AI call scoring |
| **Campaigns** | ✅ 100% | Bulk call management |
| **Reports** | ✅ 90% | Custom report builder |
| **Analytics** | ✅ 100% | Full dashboard |
| **Billing** | ⚠️ 70% | Backend 100%, UI partial |
| **Webhooks** | ⚠️ 50% | API exists, no config UI |

---

## 🏢 Component Architecture

### UI Component Library

```mermaid
flowchart TB
    subgraph Design["🎨 Design System"]
        DS1["Button"]
        DS2["Card"]
        DS3["Dialog"]
        DS4["Select"]
        DS5["Badge"]
        DS6["Input"]
        DS7["Table"]
        DS8["Tabs"]
    end
    
    subgraph Voice["📞 Voice Components"]
        VC1["CallList"]
        VC2["CallModulations"]
        VC3["TranscriptView"]
        VC4["RecordingPlayer"]
        VC5["TargetCampaignSelector"]
        VC6["VoiceHeader"]
    end
    
    subgraph Settings["⚙️ Settings Components"]
        SC1["SubscriptionManager"]
        SC2["PaymentMethodManager"]
        SC3["InvoiceHistory"]
        SC4["WebhookManager"]
        SC5["LiveTranslationConfig"]
    end
    
    subgraph Billing["💳 Billing Components"]
        BC1["PlanComparisonModal"]
        BC2["CancelSubscriptionModal"]
        BC3["UsageDisplay"]
    end
    
    Design --> Voice
    Design --> Settings
    Design --> Billing
```

---

## 🔄 Data Flow Architecture

### Call Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant App
    participant SW as SignalWire
    participant AAI as AssemblyAI
    participant DB as Supabase
    
    User->>App: Initiate Call
    App->>DB: Create call record
    App->>SW: Start call (LaML/SWML)
    SW-->>User: Call connected
    
    Note over SW: Call in progress
    SW->>SW: Record audio
    
    SW-->>App: Call ended webhook
    App->>DB: Update call status
    
    App->>SW: Get recording URL
    App->>AAI: Submit for transcription
    AAI-->>App: Transcription complete
    App->>DB: Store transcript
    
    opt Translation requested
        App->>AAI: Translate transcript
        AAI-->>App: Translation complete
        App->>DB: Store translation
    end
    
    App->>DB: Generate evidence bundle
    App-->>User: Call artifacts ready
```

### Campaign Execution Flow

```mermaid
flowchart TB
    START[Campaign Created] --> SCHEDULE[Schedule Execution]
    SCHEDULE --> CRON[Cron Job Triggers]
    CRON --> BATCH[Load Target Batch]
    
    BATCH --> LOOP{More Targets?}
    LOOP -->|Yes| CALL[Initiate Call]
    CALL --> RESULT{Call Result}
    
    RESULT -->|Success| SUCCESS[Log Success]
    RESULT -->|Failed| RETRY{Retry?}
    RETRY -->|Yes| CALL
    RETRY -->|No| FAILED[Log Failed]
    
    SUCCESS --> UPDATE[Update Stats]
    FAILED --> UPDATE
    UPDATE --> LOOP
    
    LOOP -->|No| COMPLETE[Campaign Complete]
    COMPLETE --> REPORT[Generate Report]
```

---

## 🚧 Gap Analysis

### Critical Gaps

```mermaid
flowchart TB
    subgraph Critical["🔴 Critical (Fix Now)"]
        CG1["Rate Limiting Disabled<br/>Commented out in API routes"]
        CG2["Webhook Config UI<br/>API exists, no frontend"]
    end
    
    subgraph Important["🟡 Important (Next Sprint)"]
        IG1["Billing UI Incomplete<br/>Backend 100%, frontend 30%"]
        IG2["Error Monitoring<br/>No Sentry integration"]
        IG3["Usage Notifications<br/>No email alerts"]
    end
    
    subgraph Enhancement["🟢 Enhancement (Future)"]
        EG1["Mobile Native App"]
        EG2["SSO Integration"]
        EG3["Custom Reporting"]
    end
```

### Gap Details

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **Rate Limiting Disabled** | 🔴 Security risk | Re-implement using proper Supabase-based limiter |
| **Webhook Config UI** | 🟡 User friction | Build UI in Settings → Webhooks tab |
| **Billing UI** | 🟡 Revenue impact | Complete subscription management UI |
| **Error Monitoring** | 🟡 Operations | Add Sentry for production monitoring |
| **Usage Alerts** | 🟡 User experience | Email when approaching limits |

---

## 📊 Build Output Analysis

### Route Distribution

```mermaid
pie title Route Types
    "Static Pages" : 14
    "Dynamic Pages" : 4
    "API Routes" : 96
```

### Bundle Size Analysis

```mermaid
bar title Page Bundle Sizes (KB)
    "/analytics" : 220
    "/voice" : 209
    "/settings" : 165
    "/dashboard" : 160
    "/campaigns" : 122
    "/reports" : 122
```

---

## ✅ Current State Summary

| Component | Status | Health |
|-----------|--------|--------|
| **Build** | ✅ Passing | 🟢 |
| **TypeScript** | ✅ No errors | 🟢 |
| **Pages** | 31 routes | 🟢 |
| **API** | 96+ endpoints | 🟢 |
| **Components** | 50+ components | 🟢 |
| **Database** | 47 tables | 🟢 |
| **Tests** | 98.5% passing | 🟢 |
| **Rate Limiting** | ⚠️ Disabled | 🟡 |
| **Webhook UI** | ⚠️ Missing | 🟡 |
| **Billing UI** | ⚠️ Partial | 🟡 |

---

*Generated from successful build on January 17, 2026*
