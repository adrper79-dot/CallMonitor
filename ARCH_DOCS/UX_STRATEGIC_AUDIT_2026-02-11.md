# Word Is Bond — UX/UI Strategic Audit & Migration Design Blueprint

**Date:** February 11, 2026  
**Version:** 4.48  
**Methodology:** Dieter Rams (Functionalism) + Don Norman (Human-Centered Design) + Material Design (Systematic Clarity) + Apple HIG (Opinionated Simplicity)  
**Implementation Status:** 10/17 findings resolved (Session 11)

### FINDING RESOLUTION TRACKER

| Finding | Severity | Status | Implementation |
|---------|----------|--------|----------------|
| F1: Dual Navigation | Blocker | RESOLVED | Navigation.tsx deleted (Session 12). Was orphaned with zero imports. |
| F2: VoiceOps Layout Disconnect | Blocker | RESOLVED | Wrapped in AppShell. Removed phantom 80px padding. |
| F3: No Account-Centric View | Blocker | PARTIAL | `/voice-operations/accounts` already exists. Added Accounts nav item to AppShell. |
| F4: No Power-Dial / Auto-Advance | Blocker | RESOLVED | QuickDisposition + TodayQueue + DialNext button implemented. |
| F5: Defaults Anti-User | Blocker | RESOLVED | Record=ON, Transcribe=ON by default in both desktop and mobile. |
| F6: Settings Overload | High | RESOLVED | Role-based tab filtering. Workers see 2 tabs; owners see all 7. |
| F7: First-Run Double Onboarding | High | RESOLVED | Both flows kept; localStorage gating prevents overlap. Welcome Back card when standalone done. |
| F8: No Collections Vertical | High | RESOLVED | `/verticals/collections` — full landing page with COLLECT! migration guide. |
| F9: Onboarding Missing CSV | High | RESOLVED | CSV import added as standalone onboarding Step 3 with COLLECT! migration hint. |
| F10: Mobile Nav Incomplete | High | RESOLVED | Persona-based: Collectors see Queue/Dial/Accounts/Activity; Supervisors see Dashboard/Analytics/Teams/Activity. |
| F11: No Keyboard Shortcuts | Medium | RESOLVED | `useKeyboardShortcuts` hook + `KeyboardShortcutsHelp` overlay. |
| F12: Loading Spinners | Medium | RESOLVED | `Skeletons.tsx` — Dashboard, VoiceOps, Settings skeleton loaders. |
| Trust Signals | — | RESOLVED | SOC 2 / HIPAA / 256-bit badges in AppShell sidebar footer. |
| Dashboard Differentiation | — | RESOLVED | Owner vs worker metrics, worker queue summary card. |

---

## TABLE OF CONTENTS

1. [Design Philosophy Framework](#1-design-philosophy-framework)
2. [Core Audience: Worker Demographics](#2-core-audience-worker-demographics)
3. [Core Buyer Profile](#3-core-buyer-profile)
4. [COLLECT! → Word Is Bond Migration Lifecycle](#4-collect--word-is-bond-migration-lifecycle)
5. [The Big Questions](#5-the-big-questions)
6. [Owner vs Worker — Free vs Paid Tier Design](#6-owner-vs-worker--free-vs-paid-tier-design)
7. [Site Audit: Critical Findings](#7-site-audit-critical-findings)
8. [Opportunity Map: Prioritized Recommendations](#8-opportunity-map-prioritized-recommendations)
9. [Agent Personas & Their Mandates](#9-agent-personas--their-mandates)

---

## 1. DESIGN PHILOSOPHY FRAMEWORK

We apply four world-class design philosophies as lenses:

### Dieter Rams — "Good Design Is as Little Design as Possible"
- **Principle:** Every element must earn its pixels. Remove decoration, expose function.
- **Application:** A debt collector dials 80-200 numbers/day. The interface must be a *weapon*, not a *brochure*. The cockpit (Voice Operations) should feel like a Bloomberg terminal: dense but zero-waste.

### Don Norman — "Design for Error, Design for Real Humans"
- **Principle:** Humans are imperfect, stressed, distracted. Affordances must be obvious. Errors must be recoverable. Mental models must match.
- **Application:** Debt collectors work under pressure with quotas. They think in **accounts** not **calls**. They need to see "debtor owes $4,200, called 3 times, last promise-to-pay was Jan 15" — not "Call #4382 lasted 4:22."

### Material Design (Google) — "Systematic Hierarchy and Motion"
- **Principle:** Consistent elevation, predictable transitions, intentional motion that communicates state changes. Information architecture through spatial metaphor.
- **Application:** Navigation must be one system, not two. States (ringing, connected, post-call, reviewing) need distinct visual modes. Skeleton loaders during data fetch, not spinners.

### Apple HIG — "Opinionated Defaults, Progressive Disclosure"
- **Principle:** Make the right thing the default. Hide complexity until needed. Every screen has ONE primary action.
- **Application:** Recording and transcription should be ON by default. The primary CTA on Voice Ops should be "Dial Next" — not a blank dialer. Settings should predict what you need.

---

## 2. CORE AUDIENCE: WORKER DEMOGRAPHICS

### Primary User — "The Collector" (70% of daily usage)

| Attribute | Profile |
|-----------|---------|
| **Job Title** | Collections Agent, Recovery Specialist, Skip Tracer, Accounts Receivable Specialist |
| **Age Range** | 22-45 (median 31) |
| **Education** | High school diploma + OJT, some college. Rarely degreed. |
| **Tech Comfort** | Moderate. Comfortable with web apps but not power users. Used to COLLECT!, Latitude, FICO Debt Manager, or spreadsheets. |
| **Work Environment** | Open floor call center (60%), remote home office (30%), hybrid (10%) |
| **Daily Pattern** | 6-8 hour shifts. 80-200 outbound dials/day. 15-40 live conversations. 5-15 minutes per call average. |
| **Stress Level** | High. Performance-based pay. Daily/weekly quotas. Regulatory pressure (FDCPA, CFPB Reg F, TCPA). |
| **Pain Points** | Slow software, too many clicks to dial, manual note-taking, compliance anxiety, system crashes, no mobile access for remote work. |
| **What They Value** | Speed (seconds matter), reliability (can't lose call data), simplicity (no training needed), keyboard shortcuts, auto-population of debtor info. |
| **Devices** | Desktop (primary, 85%), laptop (remote workers), mobile (break-time check-ins only). |

### Secondary User — "The Supervisor" (20% of daily usage)

| Attribute | Profile |
|-----------|---------|
| **Job Title** | Collections Manager, Team Lead, QA Analyst, Compliance Officer |
| **Age Range** | 30-55 (median 40) |
| **Education** | Associate's or bachelor's degree. Some compliance certifications (ACA, RMAi). |
| **Daily Pattern** | Reviews agent performance, listens to flagged calls, generates reports, manages campaigns, handles escalations. |
| **What They Value** | Dashboards, scorecards, compliance assurance, team visibility, easy report generation, audit readiness. |

### Tertiary User — "The IT/Admin" (5% of usage)

| Attribute | Profile |
|-----------|---------|
| **Job Title** | IT Administrator, Systems Manager, Database Administrator |
| **What They Value** | API docs, webhook configuration, SSO setup, data import/export, uptime reliability. |

---

## 3. CORE BUYER PROFILE

### Decision Maker — NOT the collector. It's the OWNER.

| Attribute | Profile |
|-----------|---------|
| **Job Title** | Owner, CEO, COO, VP of Operations, Director of Collections |
| **Company Size** | 5-200 seat collection agencies (sweet spot: 10-50 seats) |
| **Age Range** | 35-60 |
| **Budget Authority** | $500-$10,000/month for software tooling |
| **Current Stack** | COLLECT! ($100-$300/seat/month), manual dialing, basic phone system, Excel/Google Sheets for tracking |
| **Purchase Trigger** | (1) CFPB audit fear, (2) losing accounts to competitors with AI, (3) remote work enablement, (4) agent turnover cost, (5) COLLECT! feels outdated |
| **Evaluation Criteria** | ROI calculable in 30 days, compliance risk reduction (quantifiable), agent productivity gain, migration difficulty, data portability, support quality |
| **Sales Cycle** | 2-6 weeks for <50 seats, 2-4 months for enterprise |
| **Objections** | "Can my agents actually use this?", "What happens to our COLLECT! data?", "Is this HIPAA/SOC2 compliant?", "Can we try before committing all seats?" |

### Key Insight: The Buyer-User Gap

The **buyer** (owner) cares about: compliance, cost reduction, agent productivity metrics, ROI.  
The **user** (collector) cares about: speed, simplicity, not getting in trouble, going home on time.  

**These are different value propositions that require different interfaces.**

The buyer needs a **command center**: dashboards, reports, cost analytics, compliance scorecards.  
The user needs a **cockpit**: dial, talk, log, next. Repeat 150 times.

---

## 4. COLLECT! → WORD IS BOND MIGRATION LIFECYCLE

### Phase 0: Discovery & Evaluation (Week 0)
**User's Mental State:** Skeptical, protective of current workflow. "This better not break what works."

| Need | Current State | Gap |
|------|--------------|-----|
| See it work before committing | No interactive demo, must sign up | **CRITICAL: Add product tour video or interactive demo on landing page** |
| Debt collections case study | Zero collections-specific content. 4 verticals but no collections. | **CRITICAL: Add `/verticals/collections` and a collections case study** |
| ROI calculator | None | **HIGH: Build "COLLECT! → WIB savings calculator" on pricing page** |
| Data migration assurance | No migration docs or tools | **HIGH: Publish migration guide showing CSV import path** |

### Phase 1: Signup & Onboarding (Day 1)
**User's Mental State:** Cautiously optimistic. "Show me this is worth my time."

| Need | Current State | Gap |
|------|--------------|-----|
| Frictionless signup | Org name required, no SSO | **MEDIUM: Default org name, add "Skip for now"** |
| Import COLLECT! data immediately | CSV wizard exists but not in onboarding flow | **CRITICAL: Add "Import your contacts" as Step 2 in onboarding** |
| See familiar mental model | Call-centric, not account-centric | **CRITICAL: "Accounts" view needed alongside "Calls" view** |
| Get a number, make a test call | Exists in onboarding (Steps 2-3) | Working well |
| Set up defaults (recording ON, transcription ON) | Defaults are OFF, buried in Settings → AI Settings | **HIGH: Onboarding Step 4 should be "Set Your Defaults"** |
| Add team members | Not in onboarding flow | **MEDIUM: Optional onboarding step for inviting first agent** |

### Phase 2: First Real Work Day (Day 2-5)
**User's Mental State:** "Can I do my actual job with this?"

| Need | Current State | Gap |
|------|--------------|-----|
| Load today's call list | Must manually input or import CSV | **CRITICAL: "Today's Queue" as a first-class concept** |
| Power-dial through the list | No auto-advance/dial-next | **CRITICAL: Power-dial mode that auto-advances after disposition** |
| See debtor info before calling | No account detail page | **HIGH: Account card with balance, history, notes, promises** |
| Log call outcome with 1-2 clicks | CallDisposition exists but flow unclear | **HIGH: Quick-disposition buttons post-call (Promise, Refused, No Answer, Left VM, Wrong Number)** |
| Record everything by default | Defaults to OFF | **HIGH: Org-level "always record" setting, surfaced in setup** |
| Hear previous calls on same account | Calls are per-call, not per-account | **HIGH: Account-centric call history** |

### Phase 3: First Full Week (Day 5-10)
**User's Mental State:** "Is this actually better than COLLECT!?"

| Need | Current State | Gap |
|------|--------------|-----|
| See daily/weekly call volume | Dashboard has numbers, no charts | **MEDIUM: Sparkline or mini-chart on dashboard** |
| Manager reviews agent calls | Review page with scorecards | Works — strong feature |
| Compliance report for the week | Reports page exists | Works — needs collections-specific report templates |
| Agent standings / leaderboard | No leaderboard | **MEDIUM: Agent performance ranking visible to supervisors** |

### Phase 4: Month 1 Evaluation (Owner Review)
**User's Mental State:** "Is the ROI there? Should I migrate the whole team?"

| Need | Current State | Gap |
|------|--------------|-----|
| Cost comparison dashboard | No ROI/savings view | **HIGH: "Your WIB vs Old System" efficiency dashboard** |
| Compliance confidence score | Compliance tab in settings, not a dashboard metric | **MEDIUM: Compliance health score on main dashboard** |
| Seat expansion without friction | Billing exists, plan upgrade works | Works — needs clearer per-seat pricing display |
| Export data (prove not locked in) | Export exists | Works — should be more prominent for trust |

### Phase 5: Full Adoption (Month 2+)
**User's Mental State:** "This is my system now. Make it faster."

| Need | Current State | Gap |
|------|--------------|-----|
| Keyboard shortcuts | None visible | **MEDIUM: D = Dial, N = Next, H = Hang up, 1-5 = Disposition** |
| Saved filters / smart lists | No saved filter capability | **MEDIUM: "My Queues" — saved filter views** |
| API for custom integrations | Swagger docs exist | Works — needs better presentation |
| Custom fields per account | No custom field support | **LOW: Configurable account metadata** |

---

## 5. THE BIG QUESTIONS

These are the fundamental questions that, if answered well, make adoption seamless. If answered poorly, cause churn.

### Q1: "Where did my data go?"
**Context:** Migrating from COLLECT! means leaving behind years of debtor records, payment histories, notes.  
**Current Answer:** Silent. No guidance.  
**Required Answer:**  
- Landing page migration guide: "Bring Your Data in 3 Steps"
- CSV import with field mapping that mirrors COLLECT! export fields (Debtor Name, Account #, Balance, Phone, Last Payment Date, Status)
- Import progress bar with row-by-row validation
- Post-import confirmation: "243 accounts imported. 5 skipped (reason). Review."

### Q2: "How do I get through my list today?"
**Context:** Collectors don't browse. They process. They need a queue.  
**Current Answer:** Manual target selection or campaign management. No "work queue."  
**Required Answer:**  
- "Today's Queue" as a first-class view replacing the current center column when no call is active
- Auto-populated from campaigns, bookings, and follow-ups
- One-click "Start Dialing" that calls the first number and auto-advances on disposition
- Clear count: "42 remaining today"

### Q3: "What happened on the last call with this person?"
**Context:** Account-centric memory. Collectors need context before every call.  
**Current Answer:** Calls are standalone objects. No account view.  
**Required Answer:**  
- Account/Contact master view showing: all calls, notes, promises, payment history, dispositions, compliance flags
- Pre-call popup: "Last called Jan 15. Promised $200 by Feb 1. No payment received."
- Bond AI suggestion: "This debtor has missed 2 promises. Consider escalation."

### Q4: "Am I in compliance?"
**Context:** FDCPA, CFPB Reg F, TCPA, state mini-Miranda requirements. Fines are personal.  
**Current Answer:** Compliance tab in Settings. PII redaction exists. Recording is feature-complete.  
**Required Answer:**  
- Pre-call compliance checklist (auto): Reg F call frequency check, mini-Miranda script prompt, time-of-day validation
- In-call compliance indicator: green/yellow/red based on AI monitoring
- Post-call compliance score per call
- Compliance dashboard for the owner showing org-wide compliance health

### Q5: "How do I know my team is performing?"
**Context:** Owner/supervisor needs to justify the software cost.  
**Current Answer:** Analytics page with 5 tabs. Decent but generic.  
**Required Answer:**  
- Collections-specific KPIs: Promise-to-pay conversion rate, dollars collected per hour, right-party contact rate, average calls to resolution
- Agent rankings with trend arrows
- Exportable weekly performance summary
- Email digest option (weekly report to owner's inbox)

### Q6: "Can I trust that this is secure and won't lose my data?"
**Context:** Debt collection data includes PII, financial info, HIPAA-adjacent medical debt.  
**Current Answer:** Trust Pack page is excellent. RLS, PII redaction, SOC2 compliance.  
**Required Answer:**  
- Trust badges visible EVERYWHERE (footer, settings, dashboard)
- One-click data export for peace of mind
- Uptime status page link
- "Your data is encrypted at rest and in transit" visible on first login

### Q7: "What do I pay for vs what's free?"
**Context:** Owner wants to pilot on 2-3 agents before scaling.  
**Current Answer:** 3 tiers ($49/$149/Custom) but per-seat pricing unclear. Free trial in onboarding but no permanent free tier.  
**Required Answer:** See Section 6 below.

---

## 6. OWNER VS WORKER — FREE VS PAID TIER DESIGN

### Tier Architecture Recommendation

| Tier | Name | Price | Who | What's Included |
|------|------|-------|-----|-----------------|
| **Free** | Starter | $0/forever | Solo collector, freelance ARM | 1 seat, 1 number, 50 calls/mo, recording, basic transcription, 30-day retention. No campaigns, no analytics, no team features. |
| **Paid Tier 1** | Pro | $39/seat/mo | Small agency (2-10 agents) | Unlimited calls, full transcription, evidence bundles, basic analytics, 90-day retention, 3 campaigns, team management (up to 10). |
| **Paid Tier 2** | Business | $99/seat/mo | Growth agency (10-50 agents) | Everything in Pro + AI insights, sentiment analysis, scorecards, translation, power-dial, 1-year retention, unlimited campaigns, priority support. |
| **Paid Tier 3** | Enterprise | Custom | Large agencies (50+ agents) | Everything in Business + SSO, custom roles, legal hold, compliance dashboard, dedicated CSM, SLA, API, custom integrations, white-labeling. |

### Owner vs Worker Experience Separation

| Feature Area | Owner Sees | Worker Sees |
|-------------|-----------|-------------|
| **Dashboard** | Org-wide KPIs, team rankings, cost analytics, compliance health, active campaigns summary | Personal KPIs (my calls today, my outcomes, my queue remaining), recent calls, next scheduled call |
| **Navigation** | Full sidebar: Dashboard, Calls, Accounts, Campaigns, Analytics, Reports, Teams, Settings, Billing | Simplified sidebar: My Queue, Calls, Accounts, Schedule, Settings (personal only) |
| **Settings** | All 7 tabs including Billing, Compliance, Webhooks, Team & Access | Only: My Profile, Call Preferences, Notification Settings |
| **Analytics** | Org-wide analytics with agent breakdown, financial metrics, compliance trends | Personal analytics: my call volume, my sentiment scores, my disposition breakdown |
| **Campaigns** | Create, manage, assign campaigns. View all campaigns. | See assigned campaigns. View own queue. Cannot create campaigns. |
| **Admin** | User management, role assignment, plan management, audit logs | Not visible |
| **Bond AI** | Strategic insights: "Agent A's compliance score dropped 15% this week" | Tactical assist: "This debtor called 3x this week, Reg F limit approaching" |

---

## 7. SITE AUDIT: CRITICAL FINDINGS

### SEVERITY 1 — BLOCKERS (Fix before next deployment)

#### F1: Dual Navigation Conflict
- **Where:** Every authenticated page
- **What:** `Navigation.tsx` (floating dark capsule) AND `AppShell.tsx` (white sidebar) render simultaneously. Two competing nav paradigms.
- **Impact:** Cognitive overload, wasted screen space, unprofessional appearance.
- **Fix:** Remove `Navigation.tsx` entirely. AppShell sidebar IS the navigation. Add a thin top bar inside AppShell for breadcrumbs + user avatar only.

#### F2: Voice Operations Layout Disconnect
- **Where:** `/voice-operations` — the most important page
- **What:** Does NOT use AppShell. Has its own VoiceHeader + floating Navigation. Sidebar disappears when entering the cockpit.
- **Impact:** Jarring layout shift. Loss of navigation context. User feels "trapped" in Voice Ops.
- **Fix:** Wrap Voice Ops in AppShell with a collapsible sidebar (collapsed by default in cockpit mode). Add breadcrumb: "Dashboard > Calls." Add a minimal left rail with quick nav.

#### F3: No Account/Debtor-Centric View
- **Where:** Entire application
- **What:** Everything is organized by calls, not by accounts/contacts/debtors. This is the fundamental opposite of how collectors think.
- **Impact:** Collectors can't see "all interactions with Jane Doe" in one place. Forces mental model mismatch.
- **Fix:** Create `/accounts` page and `AccountDetailView` component. An account aggregates: all calls, all notes, all dispositions, all promises, payment history, compliance flags. This becomes the collector's primary workspace alongside the dialer.

#### F4: No Power-Dial / Auto-Advance
- **Where:** Voice Operations cockpit
- **What:** After completing a call, the collector must manually select the next target. No "Dial Next" button, no auto-advance through a campaign or queue.
- **Impact:** 5-15 seconds wasted per transition x 150 calls/day = 12-37 minutes of dead time per day per agent.
- **Fix:** Add "Dial Next" as the primary post-call CTA. When a campaign is active, auto-load the next contact after disposition. Show "Next: John Smith — $3,400 balance" preview.

#### F5: Defaults Are Anti-User
- **Where:** Call options in Voice Ops, Settings → AI Settings
- **What:** Recording = OFF, Transcription = OFF, Translation = OFF by default. A compliance-focused platform ships with compliance features disabled.
- **Impact:** First calls go unrecorded. Trust destroyed. "I thought it was recording!"
- **Fix:** Org-level defaults in onboarding setup. Recording = ON, Transcription = ON by default. Show warning badge if recording is off: "This call is not being recorded."

### SEVERITY 2 — HIGH PRIORITY (Fix within 2 weeks)

#### F6: Settings Page Overload
- **Problem:** 7 tabs, 15+ sub-components. Webhook config alongside billing alongside AI settings. Workers and owners see the same page.
- **Fix:** Split by persona. Owner settings: Billing, Team, Compliance, Webhooks. Worker settings: My Profile, Call Preferences, Notifications. Shared: Call Config, AI Settings.

#### F7: First-Run Double Onboarding
- **Problem:** `/onboarding` (page-level 5-step wizard) AND inline `OnboardingWizard` in Voice Ops. Different features in each.
- **Fix:** One onboarding flow. The page-level wizard is the master. After completion, Voice Ops skips inline wizard and shows a "Welcome Back" state with first-call guidance.

#### F8: No Collections Vertical Content
- **Problem:** 4 verticals (healthcare, legal, property management, government) but NOT ONE for debt collections — the primary use case.
- **Fix:** Create `/verticals/collections` with: Reg F compliance messaging, COLLECT! migration story, power-dial demo, ROI calculator, collector testimonials.

#### F9: Onboarding Missing CSV Import
- **Problem:** A collector migrating from COLLECT! needs to import contacts immediately. The standalone onboarding page has no import step. CSV import exists only in the inline VoiceOps wizard.
- **Fix:** Add "Import Your Contacts" as onboarding Step 2 (after trial activation). Support COLLECT! export format auto-detection.

#### F10: Mobile Navigation Incomplete
- **Problem:** Bottom nav shows 4 of 9 items. Campaigns, Reports, Analytics, Teams, Settings require hamburger menu discovery.
- **Fix:** Prioritize by persona. Collector mobile: Queue, Dial, Accounts, Activity. Supervisor mobile: Dashboard, Analytics, Teams, Activity. Settings always accessible via avatar menu.

### SEVERITY 3 — MEDIUM PRIORITY (Fix within 1 month)

#### F11: No Keyboard Shortcuts
Standard call center software supports keyboard navigation. Implement:
- `D` or `Enter` = Dial / Answer
- `H` or `Esc` = Hang up
- `N` = Next in queue
- `1-5` = Quick disposition codes
- `/` = Search
- `?` = Shortcut help overlay

#### F12: Dashboard Lacks Visual Trends
Numbers without context. Add sparklines or mini-charts for: calls today (vs yesterday), collection rate, compliance score trend.

#### F13: No Skeleton Loaders
Pages show a generic spinner during data load. Replace with skeleton screens matching the actual layout for perceived speed improvement.

#### F14: Tour System Disconnected from Onboarding
The product tour (via `components/tour/`) exists but doesn't auto-trigger after onboarding completion. Wire Step 5 of onboarding to trigger the Voice Ops tour.

#### F15: API Docs Presentation
Raw Swagger UI embed looks unprofessional. Style it to match app theme or replace with a Mintlify/Readme-style documentation page.

#### F16: Bond AI Chat Always Visible
The floating chat button appears during active calls. During power-dial mode, it's a distraction. Add a "focus mode" that hides Bond AI during active calling sessions.

#### F17: No "Pause My Queue" Button
Collectors need to pause for breaks, escalations, or supervisor huddles without losing their place in the queue. Add a prominent Pause/Resume toggle.

---

## 8. OPPORTUNITY MAP: PRIORITIZED RECOMMENDATIONS

### Immediate Impact (This Sprint)

| # | Recommendation | Effort | Impact | Philosophy |
|---|---------------|--------|--------|------------|
| 1 | Remove duplicate Navigation.tsx, keep AppShell only | 2 hours | High | Rams: Remove unnecessary |
| 2 | Set Recording/Transcription defaults to ON | 1 hour | Critical | Apple: Right defaults |
| 3 | Add "Dial Next" button to post-call state | 4 hours | Critical | Norman: Match mental model |
| 4 | Add skeleton loaders to dashboard and Voice Ops | 4 hours | Medium | Material: Systematic transitions |

### Short-Term (Next 2 Sprints)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 5 | Build `/accounts` page — account-centric view | 3 days | Critical |
| 6 | Add CSV import to onboarding flow | 1 day | High |
| 7 | Create `/verticals/collections` landing page | 1 day | High |
| 8 | Split Settings by persona (owner vs worker) | 2 days | High |
| 9 | Unify onboarding (remove inline wizard, connect tour) | 1 day | Medium |
| 10 | Add "Today's Queue" as first-class concept | 3 days | Critical |

### Medium-Term (Next Month)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 11 | Power-dial mode with auto-advance | 1 week | Critical |
| 12 | Keyboard shortcuts system | 3 days | Medium |
| 13 | Agent leaderboard/rankings for supervisors | 2 days | Medium |
| 14 | Pre-call compliance checker (Reg F frequency, time-of-day) | 3 days | High |
| 15 | ROI calculator on pricing page | 1 day | Medium |
| 16 | Collections-specific report templates | 2 days | Medium |
| 17 | Interactive product demo (no signup required) | 1 week | High |
| 18 | Dashboard sparklines/trend charts | 1 day | Medium |

### Long-Term (Quarter)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 19 | Account master + promise-to-pay tracking | 2 weeks | Critical |
| 20 | In-call compliance AI monitor | 1 week | High |
| 21 | Collections-specific KPI framework | 1 week | High |
| 22 | COLLECT! export format auto-detection on import | 3 days | Medium |
| 23 | Weekly email digest for owners | 2 days | Medium |
| 24 | White-label option for Enterprise | 2 weeks | Low |

---

## 9. AGENT PERSONAS & THEIR MANDATES

Below are five virtual audit agents, each with a distinct lens, and what they found.

---

### Agent 1: "The Collector's Advocate" (Don Norman Lens)

**Mandate:** Represent the daily experience of a collections agent making 150+ calls/day.

**Findings:**

1. **The #1 Problem: No Queue.** A collector's day is a list. COLLECT! gives them an "Operator Work Queue" — a prioritized list they work top to bottom. Word Is Bond has no equivalent. The collector opens Voice Ops and sees... a dialer and empty space. There's no "here's what you need to do today." This is the single biggest gap for adoption.

2. **Account Amnesia.** After hanging up, a collector disposition-codes the call and wants to see a quick summary of the outcome attached to the ACCOUNT — not to a floating "call record." The next time they call this debtor, they need that context instantly. Currently, call history is per-call. There's no account-level memory.

3. **Two-Click Dial Maximum.** From queue → ringing should be 2 clicks max (click account → click dial). Currently it's: navigate to Voice Ops → open target selector → search or scroll → select → click dial options → click dial. That's 5-6 interactions. Every extra click costs 3-5 seconds × 150 calls = 7-12 lost minutes/day.

4. **Call Disposition Must Be Instant.** Post-call: show 5-6 buttons (Promise to Pay, Refused, No Answer, Left Voicemail, Wrong Number, Deceased/Disputed). One click → advance to next. Don't make them write a note unless they choose to.

5. **Error Tolerance is Zero.** If a call drops and the recording is lost, trust is destroyed. Add a "call recovery" indicator: "Recording saved. Transcript processing." Confirmation, not silence.

---

### Agent 2: "The Owner's ROI Calculator" (Business Value Lens)

**Mandate:** Represent the agency owner evaluating whether to switch from COLLECT! and how to justify the cost.

**Findings:**

1. **No COLLECT! Comparison Content.** The `/compare` page positions against generic "call recording" and "AI insights." It never mentions COLLECT!, Latitude, or FICO Debt Manager by name. An owner searching "COLLECT! alternative" finds nothing relevant on the site.

2. **Missing ROI Proof.** The owner needs to see: "Your current COLLECT! license costs $X/seat/month. Word Is Bond replaces COLLECT!'s call management + adds AI transcription + compliance monitoring for $Y/seat/month. Net savings/gain: $Z." None of this exists.

3. **Trial Must Prove Value in 3 Days.** The 14-day trial is generous but unfocused. Day 1-3 should be scripted to deliver an "aha moment": import 50 contacts → power-dial 10 → see AI-generated call summaries → receive compliance score. If this happens, conversion is near-certain. Currently, the onboarding doesn't guide toward this.

4. **Compliance as a Selling Point Needs to Be Dominant.** COLLECT! is compliance-capable but basic. WIB's AI-powered compliance monitoring, automatic Reg F frequency tracking, and evidence-grade recordings are genuine differentiators. These should be front-and-center on the landing page, pricing page, and in every sales touchpoint. Currently, compliance is mentioned but not positioned as THE reason to switch.

5. **Owner Dashboard is Missing.** The current dashboard is the same for everyone. An owner needs: total calls across all agents today, total dollars promised, compliance score, cost per call, seat utilization. This is different from what an agent needs.

---

### Agent 3: "The Interface Purist" (Dieter Rams Lens)

**Mandate:** Eliminate every pixel that doesn't serve the core task.

**Findings:**

1. **Kill the Floating Navigation.** Navigation.tsx (the dark capsule nav) overlaps AppShell sidebar. Two navigation systems = visual noise. One navigation. One truth. Sidebar only.

2. **Voice Ops: Three Columns is Right, But the Content is Wrong.**
   - Left column (call history) is useful — keep it.
   - Center column (dialer) — should be the QUEUE when idle, not an empty dialer.
   - Right column (activity feed) — useful during calls, meaningless when idle. Collapse into left column when no call is active. Use the space for account details.

3. **Settings: 7 Tabs is a Symptom.** If you need 7 tabs, the page is doing too many jobs. Split into: "My Preferences" (personal settings, 2 tabs max) and "Organization Settings" (admin-only, 4 tabs). Move Billing to its own top-level route.

4. **The Landing Page is 707 Lines of Marketing.** 8 sections before the CTA. Cut to 4: Hero → "See It Work" (interactive demo) → Compliance Promise → Pricing. Everything else goes to linked pages.

5. **Remove Feature Status Widget from Dashboard.** The "Active Features" panel shows what's enabled by plan. This is marketing, not operational data. Replace with "Today's Goals" (calls made vs target, dollars collected vs target).

---

### Agent 4: "The Trust Engineer" (Security & Compliance Lens)

**Mandate:** Ensure every interaction reinforces security, compliance, and data integrity.

**Findings:**

1. **Trust Signals Are Buried.** The Trust Pack page is excellent content but it's linked from the tiny nav bar. There are zero trust indicators on the dashboard, login page, or Voice Ops. Add: lock icon in header ("256-bit encrypted"), compliance badges in footer, "SOC 2 certified" badge on dashboard.

2. **First Call Without Recording Is a Liability.** Recording defaults to OFF. A collector's first real call goes unrecorded. If that call leads to a dispute, there's no evidence. This is a compliance failure in the product's own positioning. Default must be ON.

3. **Compliance Pre-Call Check is Missing.** Before dialing, the system should verify: (a) not calling outside allowed hours for debtor's timezone, (b) not exceeding Reg F 7-in-7 call frequency limit, (c) appropriate state-specific mini-Miranda script loaded. None of these checks exist as pre-dial gates.

4. **Audit Trail Visibility.** The audit log system exists in the backend (writeAuditLog) but there's no UI for owners to view the audit trail. Add an "Audit Log" viewer in admin/settings for compliance review and SOC 2 auditor access.

5. **Data Export Needs to Be Prominent.** For buyer trust, "You can export all your data anytime" should be visible on the pricing page, during onboarding, and in settings. Not buried — displayed as a trust signal.

---

### Agent 5: "The Adoption Architect" (Material Design + Onboarding Lens)

**Mandate:** Design the path from stranger to power user with zero support tickets.

**Findings:**

1. **Onboarding Must Mirror the First Real Workday.** Current flow: Trial → Number → Test Call → Tour → Launch. Better flow: Trial → Import 50 Contacts → Set Defaults (recording ON) → Power-Dial 5 Contacts → See Your First AI Summary → Invite Your Team → Launch. Every step delivers tangible value.

2. **Progressive Disclosure Pattern Needed.** Don't show Campaigns, Webhooks, API Docs, or advanced AI settings to a first-week user. Unlock them progressively. Day 1: Queue + Dial + Accounts. Week 1: + Reports + Analytics. Week 2: + Campaigns + Team Management. Month 1: + Webhooks + API.

3. **Empty States Are Golden Opportunities.** When the dashboard has zero calls, show: "Make your first call and see AI-powered insights appear here." When Accounts is empty: "Import your contacts from COLLECT! or CSV." Every empty state should have a clear CTA, not just "No data yet."

4. **Contextual Help > Documentation.** Instead of linking to docs, show inline tooltips on first encounter: "This is your call queue. It shows everyone you need to call today, sorted by priority." Then never show it again (store in user preferences).

5. **The "Week 1 Challenge."** Gamify the first week with a checklist: Make 10 calls, Review 1 transcript, Set up your first campaign, Invite a teammate, Generate your first report. Completion = badge + unlock advanced features. This is Duolingo for debt collection.

---

## APPENDIX: COLLECT! FEATURE MAPPING

| COLLECT! Feature | Word Is Bond Equivalent | Status | Priority |
|-----------------|------------------------|--------|----------|
| Operator Work Queues | None — needs "Today's Queue" | **MISSING** | P0 |
| Debtor Account View | None — needs `/accounts` | **MISSING** | P0 |
| Batch Processing | CSV Import + Campaigns | Partial | P1 |
| Call Logging & Notes | CallNotes + CallDisposition | Exists | OK |
| Payment Tracking | IVRPaymentPanel | Exists | OK |
| Letter Templates | None visible | **MISSING** | P2 |
| Credit Bureau Reporting | None visible | **MISSING** | P2 |
| Consumer Portal | None visible | **MISSING** | P3 |
| Client Web Portal | None visible | **MISSING** | P3 |
| Data Import & Export | CSV Import + Export | Exists | OK |
| Stock Reports | Reports page | Exists — needs collections templates | P1 |
| Compliance Features | PII Redaction + Recording + Evidence | Exists — strongest area | OK |
| Skip Tracing | None visible | **MISSING** | P2 |
| Automations | Campaigns + Cron handlers | Partial | P1 |
| Attachments | R2 recordings | Partial — no document attachments | P2 |
| On-premise Deploy | No — cloud only | By design | N/A |
| MS SQL Database | PostgreSQL (Neon) | Equivalent | OK |
| API Documentation | Swagger UI | Exists — needs styling | P3 |

---

*This audit integrates findings from the four design philosophies applied through five focused agent lenses. Priority ratings reflect the debt collection industry's specific workflow requirements and the COLLECT! → Word Is Bond migration path.*
