# UI Rebuild Blueprint — Word Is Bond Collections Platform

> **Date:** 2026-02-12 | **Version:** 5.0 | **Goal:** Role-based, flow-driven UI for debt collection

---

## 1. THE PROBLEM WITH YOUR CURRENT NAV

Your current sidebar is a **flat list of 9 items**:
```
Dashboard → Calls → Evidence → Accounts → Schedule → Teams → Analytics → Campaigns → Reports → Settings
```

This is tool-oriented, not workflow-oriented. An agent starting their day has to mentally map: "Where do I go to work my accounts?" A manager has to visit 4 different pages to understand team performance. There's no concept of the 5 critical flows.

---

## 2. THE NEW ARCHITECTURE: ROLE-BASED FLOW SHELLS

Instead of one flat nav, use **3 role shells** with a **5-flow information architecture**.

### Role Shells

| Role | Primary Flows | Default Landing |
|------|--------------|-----------------|
| **Agent** | Call, Contact, Payment, Compliance | Today's Queue (Daily Planner) |
| **Manager/Supervisor** | All 5 flows + Team oversight | Manager Dashboard |
| **Admin/Owner** | All + Settings, Billing, Config | Analytics Overview |

The shell auto-selects based on the user's RBAC role from `session.role`.

---

## 3. THE NEW NAVIGATION (GROUPED BY FLOW)

### Agent Sidebar

```
┌─────────────────────────────────┐
│ 🏠 TODAY                        │  ← Daily Planner (smart queue)
├─────────────────────────────────┤
│ 📞 COLLECT                      │  ← THE CORE LOOP
│   ├─ Work Queue                 │  ← Smart-prioritized accounts
│   ├─ Dialer                     │  ← Power/predictive dialer
│   ├─ Active Call                │  ← In-call workspace
│   └─ Payment Links              │  ← Generate & track links
├─────────────────────────────────┤
│ 📋 ACCOUNTS                     │
│   ├─ All Accounts               │  ← CRM view with filters
│   ├─ Import                     │  ← CSV bulk import
│   └─ Disputes                   │  ← Dispute workflow
├─────────────────────────────────┤
│ 📅 SCHEDULE                     │
│   ├─ Callbacks                  │  ← Scheduled callbacks
│   ├─ Follow-ups                 │  ← Promise-to-pay tracking
│   └─ Appointments               │  ← Booking calendar
├─────────────────────────────────┤
│ 🛠️ TOOLS                        │
│   ├─ Note Templates             │  ← Quick note expansion
│   ├─ Objection Library          │  ← Compliant responses
│   ├─ Scripts                    │  ← Call scripts
│   └─ Payment Calculator         │  ← Plan builder
├─────────────────────────────────┤
│ 📊 MY PERFORMANCE               │  ← Personal scorecard
└─────────────────────────────────┘
```

### Manager Sidebar

```
┌─────────────────────────────────┐
│ 🏠 COMMAND CENTER               │  ← Real-time team overview
├─────────────────────────────────┤
│ 👥 TEAM                         │
│   ├─ Live Board                 │  ← Who's on what call NOW
│   ├─ Members                    │  ← Team roster & roles
│   ├─ Scorecards                 │  ← QA evaluation
│   └─ Coaching                   │  ← Flagged calls for review
├─────────────────────────────────┤
│ 📊 ANALYTICS                    │
│   ├─ Collections KPIs           │  ← $ collected, contact rate
│   ├─ Agent Performance          │  ← Leaderboards & trends
│   ├─ Campaign Results           │  ← Strategy A/B testing
│   └─ Reports                    │  ← Scheduled & ad-hoc
├─────────────────────────────────┤
│ 🛡️ COMPLIANCE                   │
│   ├─ Violation Dashboard        │  ← Flagged events
│   ├─ Audit Trail                │  ← 7-year log browser
│   ├─ DNC Management             │  ← Do Not Call list
│   └─ Dispute Queue              │  ← Validation letters
├─────────────────────────────────┤
│ 💰 PAYMENTS                     │
│   ├─ Payment Plans              │  ← Active arrangements
│   ├─ Reconciliation             │  ← Stripe vs. records
│   ├─ Failed Payments            │  ← Retry queue
│   └─ Receipts                   │  ← Payment history
├─────────────────────────────────┤
│ 📢 CAMPAIGNS                    │
│   ├─ Active Campaigns           │  ← Running strategies
│   ├─ Contact Sequences          │  ← Email→SMS→Call flows
│   └─ Surveys                    │  ← Post-call surveys
├─────────────────────────────────┤
│ ⚙️ SETTINGS                     │
└─────────────────────────────────┘
```

### Admin Sidebar (extends Manager + adds)

```
│ 🔧 ADMIN                        │
│   ├─ Platform Metrics            │  ← System health
│   ├─ Billing & Plans             │  ← Stripe subscriptions
│   ├─ Voice Config                │  ← Telnyx settings
│   ├─ AI Config                   │  ← Model selection
│   ├─ Data Retention              │  ← Retention policies
│   ├─ API Keys                    │  ← Webhook management
│   └─ Org Settings                │  ← Branding, users
```

---

## 4. THE CORE AGENT WORKSPACE — "THE COCKPIT"

This is the **single most important screen**. It's where agents spend 90% of their time. It replaces your current `/voice-operations` page.

### Layout: 3-Column Cockpit

```
┌──────────────┬─────────────────────────────┬──────────────────┐
│              │                             │                  │
│  WORK QUEUE  │      ACTIVE CALL AREA       │   CONTEXT PANEL  │
│  (Left Rail) │      (Center Stage)         │   (Right Rail)   │
│              │                             │                  │
│  Next 10     │  ┌─────────────────────┐    │  Account Info    │
│  accounts    │  │   CALL CONTROLS     │    │  ─────────────── │
│  sorted by   │  │   [Call] [Hang Up]  │    │  Name: John Doe  │
│  AI priority │  │   [Hold] [Transfer] │    │  Balance: $4,200 │
│              │  │   [Mute] [Record]   │    │  Last Contact:   │
│  ┌────────┐  │  └─────────────────────┘    │    3 days ago    │
│  │ Smith  │  │                             │  Status: Active  │
│  │ $4,200 │  │  ┌─────────────────────┐    │  Score: 72%      │
│  │ ⚡ 87% │  │  │  LIVE TRANSCRIPT    │    │                  │
│  └────────┘  │  │                     │    │  ─────────────── │
│  ┌────────┐  │  │  Agent: "This is    │    │  COMPLIANCE      │
│  │ Jones  │  │  │  regarding your     │    │  ✅ Mini-Miranda  │
│  │ $1,800 │  │  │  account..."        │    │  ✅ Time OK       │
│  │ ⚡ 65% │  │  │                     │    │  ✅ 7-in-7: 2/7  │
│  └────────┘  │  │  AI: "Suggest       │    │  ✅ Consent       │
│              │  │  payment plan"      │    │                  │
│  ┌────────┐  │  └─────────────────────┘    │  ─────────────── │
│  │ Brown  │  │                             │  QUICK ACTIONS   │
│  │ $7,500 │  │  ┌─────────────────────┐    │  [💳 Payment]    │
│  │ ⚡ 45% │  │  │  AI SCRIPT ASSIST   │    │  [📝 Note]       │
│  └────────┘  │  │  "Based on debtor's │    │  [📅 Callback]   │
│              │  │  response, suggest  │    │  [⚠️ Dispute]    │
│  [Load More] │  │  offering 3-month   │    │  [📞 Transfer]   │
│              │  │  plan at $1,400/mo" │    │                  │
│              │  └─────────────────────┘    │  ─────────────── │
│              │                             │  PAYMENT CALC    │
│              │  ┌─────────────────────┐    │  Total: $4,200   │
│              │  │   DISPOSITION BAR    │    │  Down: $___      │
│              │  │  [PTP] [Dispute]     │    │  Monthly: $___   │
│              │  │  [VM] [No Answer]    │    │  Terms: 3/6/12mo │
│              │  │  [Refused] [Wrong#]  │    │  [Send Link]     │
│              │  └─────────────────────┘    │                  │
└──────────────┴─────────────────────────────┴──────────────────┘
                    ┌─────────────────────────────┐
                    │  ⌨️ KEYBOARD SHORTCUTS BAR   │
                    │  ⌘P: Payment  ⌘D: Dispute   │
                    │  ⌘N: Note  ⌘H: Hold  Esc: ×│
                    └─────────────────────────────┘
```

### Key Design Decisions:

1. **Work Queue is ALWAYS visible** — Agent never loses context of what's next
2. **Compliance panel is ALWAYS visible** during calls — green/red indicators
3. **AI suggestions are contextual** — appear only when relevant
4. **Disposition is ONE CLICK** — no modals, no extra screens
5. **Payment actions are in-context** — no navigating away from the call

---

## 5. PAGE-BY-PAGE IMPLEMENTATION MAP

### Phase 1: Core Agent Experience (Weeks 1-4)

| New Route | Replaces | Components Needed |
|-----------|----------|-------------------|
| `/work` | `/dashboard` (for agents) | `DailyPlanner`, `TodayQueue`, `SmartPriority` |
| `/work/queue` | `/voice-operations/accounts` | `WorkQueue`, `AccountCard`, `PriorityScore` |
| `/work/call` | `/voice-operations` | `Cockpit` (3-column), `CallControls`, `LiveTranscript`, `AIAssist`, `CompliancePanel`, `DispositionBar` |
| `/work/call/payment` | New | `PaymentCalculator`, `PaymentLinkGenerator`, `PlanBuilder` |
| `/accounts` | `/verticals/collections` | `AccountList`, `AccountDetail`, `ImportWizard`, `DisputeWorkflow` |
| `/accounts/[id]` | New | `AccountTimeline`, `ContactHistory`, `PaymentHistory`, `ComplianceLog` |
| `/schedule` | `/bookings` | `CallbackQueue`, `FollowUpTracker`, `BookingCalendar` |

### Phase 2: Manager & Compliance (Weeks 5-8)

| New Route | Replaces | Components Needed |
|-----------|----------|-------------------|
| `/command` | `/manager` | `LiveBoard`, `TeamKPIs`, `AlertFeed` |
| `/command/scorecards` | New | `ScorecardTemplateLibrary`, `ScorecardAlerts`, `ScoreView` |
| `/command/coaching` | New | `FlaggedCalls`, `CoachingNotes`, `CallReplay` |
| `/compliance` | New | `ViolationDashboard`, `AuditTrail`, `DNCManager` |
| `/compliance/disputes` | New | `DisputeQueue`, `ValidationLetterGenerator` |
| `/compliance/audit` | New | `AuditLogBrowser` (7-year searchable) |
| `/payments` | New | `PaymentPlans`, `ReconciliationView`, `FailedPayments` |
| `/payments/reconciliation` | New | `StripeReconciliation`, `MismatchFlags` |

### Phase 3: Analytics & Campaigns (Weeks 9-12)

| New Route | Replaces | Components Needed |
|-----------|----------|-------------------|
| `/analytics` | `/analytics` (enhanced) | `CollectionsKPIs`, `AgentLeaderboard`, `TrendCharts` |
| `/analytics/agents` | New | `AgentScorecard`, `PerformanceComparison` |
| `/campaigns` | `/campaigns` (enhanced) | `CampaignBuilder`, `ContactSequenceEditor` |
| `/campaigns/sequences` | New | `SequenceTimeline`, `ABTestResults` |
| `/reports` | `/reports` (kept) | Already built |

### Phase 4: Admin & Settings (Weeks 13-14)

| New Route | Replaces | Components Needed |
|-----------|----------|-------------------|
| `/admin` | `/admin/metrics` | `PlatformHealth`, `BillingOverview` |
| `/admin/billing` | `/settings` billing tab | `SubscriptionManager`, `UsageMetrics` |
| `/admin/voice` | `/voice` | `TelnyxConfig`, `CallerIdManager` |
| `/admin/retention` | New | `RetentionPolicies`, `DataLifecycle` |
| `/settings` | `/settings` (simplified) | `OrgSettings`, `UserProfile`, `Notifications` |

---

## 6. THE 5-MINUTE ONBOARDING FLOW

```
Step 1: SIGNUP (30 sec)
├─ Email + password only
├─ Auto-create org
└─ Assign trial plan via Stripe

Step 2: CONFIGURE (60 sec)
├─ Company name
├─ Industry vertical (pre-select Collections)
├─ Team size (solo/small/medium/large)
└─ Auto-provision Telnyx TN

Step 3: FIRST ACCOUNT (60 sec)
├─ Add one test account (or import CSV)
├─ Pre-fill with sample data option
└─ Show account in queue

Step 4: TEST CALL (90 sec)
├─ One-click test call to your own phone
├─ Shows the Cockpit in action
├─ Demonstrates recording + transcript
└─ Shows compliance checks in real-time

Step 5: TOUR (60 sec)
├─ Interactive shadcn tour overlay
├─ Highlights: Queue → Call → Dispose → Next
├─ Shows keyboard shortcuts
└─ Points to Help/Objection Library

→ DONE: Agent lands on Today's Queue
→ Billing: Skip during trial, prompt at day 7
```

### Onboarding Route Structure
```
/onboarding
  /onboarding/signup      → Step 1
  /onboarding/configure   → Step 2
  /onboarding/first-data  → Step 3
  /onboarding/test-call   → Step 4
  /onboarding/tour        → Step 5
  /onboarding/complete    → Redirect to /work
```

---

## 7. KEYBOARD SHORTCUTS (DOMAIN-SPECIFIC)

These are the 15 shortcuts that save 10+ minutes/day:

| Shortcut | Action | Context |
|----------|--------|---------|
| `⌘/Ctrl + D` | Open Dialer | Global |
| `⌘/Ctrl + N` | Quick Note | During/after call |
| `⌘/Ctrl + P` | Payment Modal | During call |
| `⌘/Ctrl + K` | Command Palette | Global |
| `⌘/Ctrl + S` | Save & Next Account | After disposition |
| `⌘/Ctrl + H` | Hold/Unhold | During call |
| `⌘/Ctrl + M` | Mute/Unmute | During call |
| `⌘/Ctrl + T` | Transfer | During call |
| `⌘/Ctrl + B` | Schedule Callback | Any account view |
| `⌘/Ctrl + E` | Expand/collapse panels | Cockpit |
| `1-9` | Quick disposition codes | Disposition bar |
| `Esc` | Cancel/close modal | Global |
| `/vm` | Voicemail note template | Note field |
| `/ptp` | Promise-to-pay template | Note field |
| `/dispute` | Dispute note template | Note field |

---

## 8. COMPONENT REUSE MAP

### Existing Components → New Location

| Current Component | Current Location | New Location(s) |
|-------------------|-----------------|-----------------|
| `VoiceOperationsClient` | `/voice-operations` | `/work/call` (refactored into Cockpit) |
| `ActiveCallPanel` | voice components | Cockpit center stage |
| `CallControls` + `WebRTCCallControls` | voice components | Cockpit call controls bar |
| `LiveTranslationPanel` | voice components | Cockpit transcript area |
| `PaymentCalculator` | voice components | Cockpit right rail + `/payments` |
| `CompliancePanel` | voice components | Cockpit right rail (always visible) |
| `DailyPlanner` | voice components | `/work` (promoted to page-level) |
| `TodayQueue` | voice components | `/work` + Cockpit left rail |
| `NoteTemplates` | voice components | `/work/call` + command palette |
| `ObjectionLibrary` | voice components | `/work/call` + standalone `/tools/objections` |
| `ScorecardTemplateLibrary` | voice components | `/command/scorecards` |
| `ScorecardAlerts` | voice components | `/command` dashboard |
| `SentimentWidget` | voice components | Cockpit right rail |
| `BulkImportWizard` | voice components | `/accounts/import` |
| `SurveyBuilder` + `SurveyResults` | voice components | `/campaigns/surveys` |
| `ShopperScriptManager` | voice components | `/tools/scripts` |
| `CallAnalytics` | voice components | `/analytics` |
| `CollectionsAnalytics` | voice components | `/analytics/collections` |
| `DialerPanel` | voice components | `/work/dialer` |
| `BookingModal` + `BookingsList` | voice components | `/schedule` |
| `CallerIdManager` | voice components | `/admin/voice` |

### New Components to Build

| Component | Purpose | Priority |
|-----------|---------|----------|
| `Cockpit` | 3-column agent workspace | P0 - Week 1 |
| `WorkQueue` | AI-prioritized account queue | P0 - Week 1 |
| `SmartPriority` | AI score display + sorting | P0 - Week 1 |
| `DispositionBar` | One-click call outcomes | P0 - Week 2 |
| `PreDialChecker` | Compliance gate before calls | P0 - Week 2 |
| `PaymentLinkGenerator` | Stripe link creation UI | P0 - Week 3 |
| `PlanBuilder` | Payment arrangement wizard | P0 - Week 3 |
| `ContactSequenceEditor` | Email→SMS→Call flow builder | P1 - Week 5 |
| `ViolationDashboard` | Compliance event viewer | P1 - Week 5 |
| `AuditLogBrowser` | Searchable 7-year audit trail | P1 - Week 6 |
| `DNCManager` | Do Not Call list management | P1 - Week 6 |
| `DisputeQueue` | Dispute workflow tracker | P1 - Week 7 |
| `ReconciliationView` | Stripe vs. DB matching | P1 - Week 7 |
| `FailedPaymentQueue` | Retry management UI | P1 - Week 8 |
| `AgentLeaderboard` | Gamified performance ranking | P2 - Week 9 |
| `ABTestResults` | Campaign strategy comparison | P2 - Week 10 |
| `RetentionPolicyManager` | Data lifecycle config | P2 - Week 13 |

---

## 9. INFORMATION DENSITY BY ROLE

### Agent View: Maximum Focus, Minimum Noise
- **NO** analytics charts on main screen
- **NO** team management options
- **YES** next account always visible
- **YES** compliance status always visible
- **YES** payment tools always one click away

### Manager View: Oversight + Action
- **YES** real-time team grid (who's calling, who's idle)
- **YES** aggregate KPIs ($ collected today, contact rate)
- **YES** compliance alerts (violations need review)
- **YES** ability to listen/whisper/barge into calls
- **NO** individual account management (that's agent work)

### Admin View: Configuration + Strategy
- **YES** billing, quotas, usage metrics
- **YES** system health, error rates
- **YES** voice/AI configuration
- **YES** data retention and export
- **NO** day-to-day operations view

---

## 10. MOBILE-FIRST CONSIDERATIONS

### Agent Mobile (Phone)
Bottom nav: **Today** | **Call** | **Accounts** | **Tools**
- Cockpit collapses to single-column: call controls + transcript
- Swipe right for account info, swipe left for compliance
- Disposition is a bottom sheet

### Manager Mobile (Tablet)
Bottom nav: **Command** | **Team** | **Compliance** | **Analytics**
- Live board is a scrollable card grid
- Tap agent card to see their active call

---

## 11. URL STRUCTURE (FINAL)

```
/                           → Landing page (public)
/signin                     → Authentication
/signup                     → Registration
/onboarding/*               → 5-step wizard
/pricing                    → Plan comparison (public)

/work                       → Agent daily planner (TODAY)
/work/queue                 → Prioritized work queue
/work/call                  → The Cockpit (active call workspace)
/work/dialer                → Power/predictive dialer

/accounts                   → Account list (CRM)
/accounts/[id]              → Account detail + timeline
/accounts/import            → CSV import wizard
/accounts/disputes          → Dispute management

/schedule                   → Callbacks, follow-ups, bookings
/schedule/callbacks         → Callback queue
/schedule/followups         → Promise-to-pay tracking

/tools                      → Agent productivity tools
/tools/templates            → Note templates
/tools/objections           → Objection library
/tools/scripts              → Call scripts
/tools/calculator           → Payment calculator

/command                    → Manager command center
/command/live               → Real-time agent board
/command/scorecards         → QA scorecards
/command/coaching           → Flagged calls for review

/compliance                 → Compliance overview
/compliance/violations      → Violation dashboard
/compliance/audit           → Audit trail browser
/compliance/dnc             → DNC list management
/compliance/disputes        → Dispute queue

/payments                   → Payment overview
/payments/plans             → Active payment plans
/payments/reconciliation    → Stripe reconciliation
/payments/failed            → Failed payment retry queue
/payments/receipts          → Receipt history

/analytics                  → Analytics overview
/analytics/collections      → Collections KPIs
/analytics/agents           → Agent performance
/analytics/campaigns        → Campaign results

/campaigns                  → Campaign management
/campaigns/[id]             → Campaign detail
/campaigns/sequences        → Contact sequence editor
/campaigns/surveys          → Survey management

/reports                    → Report builder + schedules

/admin                      → Admin overview
/admin/billing              → Subscription management
/admin/voice                → Telnyx configuration
/admin/ai                   → AI model settings
/admin/retention            → Data retention policies
/admin/api                  → API keys & webhooks

/settings                   → Organization settings
/settings/profile           → User profile
/settings/notifications     → Notification preferences
/settings/team              → Team member management
```

---

## 12. CONDITIONAL NAVIGATION LOGIC

```typescript
// lib/navigation.ts

export function getNavItems(role: string): NavGroup[] {
  const base: NavGroup[] = [
    {
      label: 'Today',
      icon: 'home',
      href: '/work',
      roles: ['agent', 'manager', 'admin', 'owner'],
    },
  ]

  if (['agent'].includes(role)) {
    return [
      ...base,
      { label: 'Collect', icon: 'phone', children: [
        { label: 'Work Queue', href: '/work/queue' },
        { label: 'Dialer', href: '/work/dialer' },
        { label: 'Active Call', href: '/work/call' },
      ]},
      { label: 'Accounts', icon: 'users', href: '/accounts' },
      { label: 'Schedule', icon: 'calendar', href: '/schedule' },
      { label: 'Tools', icon: 'wrench', children: [
        { label: 'Note Templates', href: '/tools/templates' },
        { label: 'Objection Library', href: '/tools/objections' },
        { label: 'Payment Calculator', href: '/tools/calculator' },
      ]},
      { label: 'My Performance', icon: 'chart', href: '/analytics/me' },
    ]
  }

  if (['manager'].includes(role)) {
    return [
      ...base,
      { label: 'Command Center', icon: 'monitor', href: '/command' },
      { label: 'Team', icon: 'users', children: [
        { label: 'Live Board', href: '/command/live' },
        { label: 'Scorecards', href: '/command/scorecards' },
        { label: 'Coaching', href: '/command/coaching' },
      ]},
      { label: 'Compliance', icon: 'shield', children: [
        { label: 'Violations', href: '/compliance/violations' },
        { label: 'Audit Trail', href: '/compliance/audit' },
        { label: 'DNC List', href: '/compliance/dnc' },
        { label: 'Disputes', href: '/compliance/disputes' },
      ]},
      { label: 'Payments', icon: 'dollar', children: [
        { label: 'Plans', href: '/payments/plans' },
        { label: 'Reconciliation', href: '/payments/reconciliation' },
        { label: 'Failed', href: '/payments/failed' },
      ]},
      { label: 'Analytics', icon: 'chart', href: '/analytics' },
      { label: 'Campaigns', icon: 'megaphone', href: '/campaigns' },
      { label: 'Reports', icon: 'file', href: '/reports' },
      { label: 'Settings', icon: 'gear', href: '/settings' },
    ]
  }

  // Admin/Owner gets everything
  return [
    ...base,
    // ... all manager items plus:
    { label: 'Admin', icon: 'shield-check', children: [
      { label: 'Platform Metrics', href: '/admin' },
      { label: 'Billing', href: '/admin/billing' },
      { label: 'Voice Config', href: '/admin/voice' },
      { label: 'AI Config', href: '/admin/ai' },
      { label: 'Data Retention', href: '/admin/retention' },
      { label: 'API & Webhooks', href: '/admin/api' },
    ]},
  ]
}
```

---

## 13. IMPLEMENTATION ORDER (WEEK BY WEEK)

### Week 1-2: The Cockpit
- [ ] Build 3-column `Cockpit` layout
- [ ] Refactor `VoiceOperationsClient` → Cockpit center
- [ ] Build `WorkQueue` component with AI priority scores
- [ ] Build `DispositionBar` (one-click outcomes)
- [ ] Wire `PreDialChecker` (compliance gate)
- [ ] New routes: `/work`, `/work/queue`, `/work/call`

### Week 3-4: Accounts & Payments
- [ ] Build `AccountDetail` page with timeline
- [ ] Build `PaymentLinkGenerator` (Stripe integration)
- [ ] Build `PlanBuilder` (payment arrangement wizard)
- [ ] Wire payment webhooks to UI updates
- [ ] New routes: `/accounts/[id]`, `/payments/*`

### Week 5-6: Compliance & Manager
- [ ] Build `ViolationDashboard`
- [ ] Build `AuditLogBrowser` (searchable, filterable)
- [ ] Build `DNCManager`
- [ ] Build `LiveBoard` for managers
- [ ] Wire `PreDialChecker` to block non-compliant calls
- [ ] New routes: `/compliance/*`, `/command`

### Week 7-8: Productivity & Campaigns
- [ ] Promote `DailyPlanner` to `/work` landing page
- [ ] Build keyboard shortcut system
- [ ] Build `ContactSequenceEditor`
- [ ] Build `DisputeQueue` workflow
- [ ] Build `ReconciliationView`
- [ ] New routes: `/tools/*`, `/campaigns/sequences`

### Week 9-10: Analytics & Polish
- [ ] Enhanced analytics with collections-specific KPIs
- [ ] `AgentLeaderboard` with gamification
- [ ] `ABTestResults` for campaign strategies
- [ ] Performance optimization (lazy loading panels)

### Week 11-12: Role-Based Shell & Onboarding
- [ ] Implement role-based navigation switching
- [ ] Build 5-step onboarding wizard
- [ ] Build interactive tour (shadcn)
- [ ] Mobile-responsive Cockpit

### Week 13-14: Admin & Settings Consolidation
- [ ] Consolidate settings pages
- [ ] Build retention policy manager
- [ ] Build API key management UI
- [ ] Final QA and polish

---

## 14. MIGRATION STRATEGY (ZERO DOWNTIME)

1. **Build new routes alongside old ones** — Don't delete anything yet
2. **Feature flag new UI** — `USE_NEW_UI=true` in settings
3. **Redirect map** once stable:
   - `/dashboard` → `/work`
   - `/voice-operations` → `/work/call`
   - `/voice-operations/accounts` → `/accounts`
   - `/verticals/collections` → `/accounts`
   - `/bookings` → `/schedule`
   - `/manager` → `/command`
   - `/voice` → `/admin/voice`
   - `/admin/metrics` → `/admin`
4. **Remove old routes** after 2 weeks of stable new UI

---

## 15. SUCCESS METRICS

| Metric | Current (Estimated) | Target |
|--------|-------------------|--------|
| Time to first call (new user) | 15+ minutes | < 5 minutes |
| Clicks per disposition | 3-4 | 1 |
| Time between calls | 30+ seconds | < 5 seconds (auto-advance) |
| Pages visited per session (agent) | 5-7 | 2-3 (Cockpit + Queue) |
| Compliance check visibility | Optional/hidden | Always visible |
| Payment link generation | Navigate away | In-call, 1 click |
| Keyboard shortcut adoption | 0% | 60%+ by month 2 |

---

## APPENDIX A: CURRENT → NEW ROUTE MAPPING

| Current Route | New Route | Status |
|---------------|-----------|--------|
| `/dashboard` | `/work` | Rebuild |
| `/voice-operations` | `/work/call` | Major refactor |
| `/voice-operations/accounts` | `/accounts` | Promote to top-level |
| `/verticals/collections` | `/accounts` | Merge |
| `/bookings` | `/schedule` | Rename + enhance |
| `/teams` | `/settings/team` | Move under settings |
| `/analytics` | `/analytics` | Enhance |
| `/campaigns` | `/campaigns` | Enhance |
| `/reports` | `/reports` | Keep |
| `/settings` | `/settings` | Simplify |
| `/manager` | `/command` | Rename + enhance |
| `/voice` | `/admin/voice` | Move under admin |
| `/admin/metrics` | `/admin` | Simplify |
| `/review` | `/work/call` (evidence tab) | Merge into Cockpit |
| N/A | `/compliance/*` | **NEW** |
| N/A | `/payments/*` | **NEW** |
| N/A | `/tools/*` | **NEW** |
| N/A | `/command/*` | **NEW** |
