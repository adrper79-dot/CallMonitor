# Final Sprint to Market Ready — 2-Week Plan

**TOGAF Phase:** G — Implementation Governance  
**Created:** February 14, 2026  
**Status:** IN PROGRESS — Week 1 Active  
**Goal:** Close critical gaps to achieve 95% market readiness

---

## Executive Summary

**Current State**: v4.66 at 85% market ready  
**Target State**: 95% market ready with full dialer + omnichannel functionality  
**Timeline**: 2 weeks (10 working days)  
**Critical Path**: Dialer activation → Omnichannel completion

### Market Readiness Assessment

| Category | Current | Post-Sprint | Gap Closed |
|----------|---------|-------------|------------|
| **Technical Foundation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | — |
| **Compliance/Security** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | — |
| **AI Intelligence** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | — |
| **Predictive Dialer** | ⭐ (broken) | ⭐⭐⭐⭐⭐ | **+4** 🔴 |
| **Omnichannel** | ⭐⭐ | ⭐⭐⭐⭐ | **+2** 🟡 |
| **Overall Readiness** | 85% | **95%** | **+10%** |

---

## Week 1: Dialer Activation (P0 — CRITICAL)

**Objective**: Make predictive dialer fully functional and competitive with TCN/Convoso

### Sprint Items

#### Task 1.1: Wire DialerPanel into Voice Operations 🔴
- **Priority**: P0 (Critical)
- **Effort**: 1 day
- **Owner**: Agent 1
- **Current State**: DialerPanel.tsx exists (283 lines) but orphaned — not rendered anywhere
- **Deliverable**: DialerPanel visible and functional in [app/voice-operations/page.tsx](app/voice-operations/page.tsx)
- **Success Criteria**:
  - ✅ Dialer panel renders in Voice Ops UI
  - ✅ Start/pause/stop controls functional
  - ✅ Real-time stats display (pending, calling, completed, failed)
  - ✅ Agent pool status tracking
  - ✅ Campaign selection dropdown populated

**Files Affected**:
- `app/voice-operations/page.tsx` — Add DialerPanel to layout
- `components/voice/DialerPanel.tsx` — Verify API integration
- `workers/src/routes/dialer.ts` — Backend routes (already exist)

**Dependencies**: None (self-contained)

---

#### Task 1.2: Complete Telnyx Call Control Integration 🔴
- **Priority**: P0 (Critical)
- **Effort**: 2 days
- **Owner**: Agent 2
- **Current State**: Backend has `dialer-engine.ts` but Telnyx origination incomplete
- **Deliverable**: Full Telnyx Call Control v2 integration for outbound calls

**Sub-Tasks**:
1. **Calls Route Enhancement** (4 hours)
   - Wire `POST /api/calls` to trigger actual Telnyx outbound calls
   - Store `call_control_id` for webhook correlation
   - Handle errors with DB rollback
   - Success: Real call dials when queue starts

2. **Telnyx Webhook Handlers** (4 hours)
   - Add `call.initiated`, `call.answered`, `call.hangup` webhook handlers
   - Update DB call status in real-time
   - Trigger WebSocket state updates to UI
   - Success: Agent sees call connect/end in real-time

3. **AMD (Answering Machine Detection)** (2 hours)
   - Enable AMD in Telnyx call creation
   - Handle `call.machine_detection.ended` webhook
   - Auto-disposition voicemail calls
   - Success: VM calls skip to next account

4. **Dialer Queue → Telnyx Loop** (4 hours)
   - Integrate `dialer-engine.ts` with Telnyx API
   - Fetch next account from queue
   - Trigger call via Telnyx
   - Handle agent assignment
   - Success: Queue processes 50+ calls continuously

**Files Affected**:
- `workers/src/routes/calls.ts` — Add Telnyx API calls
- `workers/src/routes/webhooks.ts` — Add Telnyx call webhooks
- `workers/src/lib/dialer-engine.ts` — Integrate Telnyx origination
- `workers/src/routes/dialer.ts` — Queue management logic

**Dependencies**: 
- Telnyx API credentials (`TELNYX_API_KEY` env var)
- Call Control application configured

**Environment Variables Required**:
```bash
TELNYX_API_KEY=KEY...
TELNYX_CALL_CONTROL_APP_ID=...
```

**Success Criteria**:
- ✅ Click "Start Queue" → real calls dial to phone numbers
- ✅ Agent answers → call connects + recording starts
- ✅ Failed calls retry per campaign settings
- ✅ All calls recorded + transcription auto-triggers
- ✅ AMD detects voicemail → auto-disposition + next call

---

#### Task 1.3: End-to-End Dialer Testing 🟡
- **Priority**: P1 (High)
- **Effort**: 1 day
- **Owner**: QA Agent
- **Deliverable**: Comprehensive test coverage for dialer workflows

**Test Scenarios**:

1. **Happy Path** (2 hours)
   - Create campaign with 10 test numbers
   - Start queue
   - Agent answers call
   - Disposition call
   - Next call auto-dials
   - All 10 calls complete successfully
   - Success: 100% completion rate

2. **Pause/Resume** (1 hour)
   - Start queue
   - Pause mid-campaign
   - Verify no new calls dial
   - Resume queue
   - Calls continue from where paused
   - Success: No calls lost during pause

3. **Compliance Pre-Dial Checks** (2 hours)
   - Add number to DNC list
   - Verify call skipped
   - Add account with exceeded frequency
   - Verify call skipped
   - Call outside allowed hours
   - Verify call blocked
   - Success: 100% compliance enforcement

4. **AMD Detection** (1 hour)
   - Call number that goes to voicemail
   - Verify AMD triggers
   - Verify auto-disposition
   - Verify next call dials
   - Success: Voicemail detected, no agent time wasted

5. **Error Handling** (2 hours)
   - Telnyx API failure
   - Verify call marked failed
   - Verify retry scheduled
   - No available agents
   - Verify queue pauses automatically
   - Network timeout
   - Verify graceful degradation
   - Success: All errors handled, no crashes

**Files Created**:
- `tests/production/dialer-integration.test.ts` — Production tests
- `tests/e2e/dialer-workflow.spec.ts` — Playwright E2E tests

**Success Criteria**:
- ✅ 50-call test campaign completes successfully
- ✅ Zero missed calls or orphaned sessions
- ✅ Health check shows dialer operational
- ✅ All edge cases handled gracefully

---

#### Task 1.4: Power Dialer Auto-Advance Integration 🟢
- **Priority**: P2 (Medium)
- **Effort**: 1 day
- **Owner**: Agent 3
- **Current State**: Feature built (v4.66) but needs dialer queue integration
- **Deliverable**: Auto-advance countdown connects to dialer's next-account selection

**Sub-Tasks**:
1. **QuickDisposition → Dialer Queue Integration** (4 hours)
   - Fetch next account from dialer queue API
   - Pass to QuickDisposition as `nextAccountId`/`nextAccountPhone`
   - Wire compliance check to dialer pre-dial logic
   - Success: Auto-advance sees next account from queue

2. **Countdown → Auto-Dial Integration** (3 hours)
   - After disposition + countdown → trigger `POST /api/calls`
   - Use queue's next account (not DailyPlanner)
   - Respect user's auto-advance enabled/delay settings
   - Success: Disposition → 2s → auto-dial

3. **ESC Cancellation Handling** (1 hour)
   - ESC pressed → cancel countdown
   - Return to queue without skipping account
   - Success: Agent can opt-out mid-countdown

**Files Affected**:
- `components/voice/QuickDisposition.tsx` — Add dialer queue fetch
- `components/voice/DailyPlanner.tsx` — Toggle between manual/dialer mode
- `workers/src/routes/dialer.ts` — Add `GET /api/dialer/next-account` endpoint

**Success Criteria**:
- ✅ After disposition → 2s countdown → auto-dial next account
- ✅ Compliance check runs before each auto-dial
- ✅ ESC cancellation works
- ✅ Agent can toggle auto-advance on/off

---

### Week 1 Deliverables

**Code Artifacts**:
- ✅ DialerPanel.tsx wired into voice-operations page
- ✅ Telnyx Call Control v2 fully integrated
- ✅ AMD handling implemented
- ✅ Dialer queue → Telnyx → Agent loop functional
- ✅ Auto-advance connected to dialer queue
- ✅ Comprehensive test coverage (unit + E2E)

**Documentation**:
- ✅ Dialer user guide (add to USER_GUIDE.md)
- ✅ Telnyx integration docs (ARCH_DOCS/03-INFRASTRUCTURE/)
- ✅ API documentation updated (openapi.yaml)

**Deployment**:
- ✅ Deploy to production (wrangler deploy)
- ✅ Health check verification
- ✅ Smoke test with 10 test calls

**Metrics Target**:
- Call success rate: >95%
- AMD accuracy: >90%
- Queue throughput: 50+ calls/hour per agent
- Compliance block rate: 100% (zero violations)

---

## Week 2: Omnichannel Completion (P1 — HIGH)

**Objective**: Complete SMS/Email campaign capabilities for multi-touch sequences

### Sprint Items

#### Task 2.1: Inbound SMS Webhook Handler 🟡
- **Priority**: P1 (High)
- **Effort**: 1 day
- **Owner**: Agent 4
- **Current State**: Can send SMS (Telnyx), can't receive
- **Deliverable**: Inbound SMS webhook receiving + storing + notifying

**Sub-Tasks**:
1. Add Telnyx inbound SMS webhook route (`POST /webhooks/telnyx/sms`)
2. Store in `email_logs` table (type: 'sms', direction: 'inbound')
3. Link to `collection_accounts` via phone number lookup
4. Trigger real-time notification to agent (WebSocket)
5. Display in Multi-Channel Timeline

**Files Created**:
- `workers/src/routes/webhooks.ts` — Add SMS webhook handler

**Success Criteria**:
- ✅ Customer replies to payment link SMS → appears in timeline
- ✅ Agent gets real-time notification
- ✅ SMS thread view in Cockpit

---

#### Task 2.2: SMS Campaign Builder 🟡
- **Priority**: P1 (High)
- **Effort**: 2 days
- **Owner**: Agent 5
- **Deliverable**: Bulk SMS campaigns with templates + scheduling

**Sub-Tasks**:
1. Add campaign type: `sms_blast` to campaigns table
2. Template builder component with merge fields
3. Recipient list upload (CSV) or filter from accounts
4. Schedule send (immediate or future)
5. Throttle sending (respect Telnyx rate limits)
6. Delivery tracking dashboard

**Files Created**:
- `components/campaigns/SMSCampaignBuilder.tsx`
- `workers/src/routes/campaigns.ts` — Add SMS campaign logic

**Success Criteria**:
- ✅ Create SMS campaign → send to 100 accounts → track delivery
- ✅ Failed deliveries retry automatically
- ✅ Compliance checks (DNC, opt-out)

---

#### Task 2.3: Email Campaign Builder 🟢
- **Priority**: P2 (Medium)
- **Effort**: 1 day
- **Owner**: Agent 6
- **Deliverable**: Bulk email campaigns with templates

**Sub-Tasks**:
1. Add campaign type: `email_blast`
2. HTML email template editor (or reuse payment link templates)
3. Merge field support
4. Open/click tracking via Resend webhooks
5. Unsubscribe handling

**Files Created**:
- `components/campaigns/EmailCampaignBuilder.tsx`
- `workers/src/routes/campaigns.ts` — Add email campaign logic

**Success Criteria**:
- ✅ Create email campaign → send to 200 accounts → track opens
- ✅ Unsubscribe handling functional

---

#### Task 2.4: Unified Inbox (Stretch Goal) 🟢
- **Priority**: P3 (Low)
- **Effort**: 2 days
- **Owner**: Agent 7 (if time permits)
- **Deliverable**: Inbox for managing inbound SMS/email threads

**Sub-Tasks**:
1. Add "Inbox" tab to Cockpit
2. Show unread SMS/email threads
3. Mark as read/replied
4. Quick reply from inbox
5. Thread grouping by account

**Files Created**:
- `components/cockpit/Inbox.tsx`

**Success Criteria**:
- ✅ Agent can respond to SMS/email without leaving Cockpit
- ✅ Threads grouped by account

---

### Week 2 Deliverables

**Code Artifacts**:
- ✅ Inbound SMS webhooks functional
- ✅ SMS campaign builder complete
- ✅ Email campaign builder complete
- ✅ (Stretch) Unified inbox

**Documentation**:
- ✅ Omnichannel guide (add to USER_GUIDE.md)
- ✅ Campaign builder tutorial

**Deployment**:
- ✅ Deploy to production
- ✅ Test inbound SMS with live numbers
- ✅ Send test campaigns

---

## Bonus: Quick Wins (If Extra Time)

#### Task 3.1: Landing Page Competitive Comparison 🟢
- **Effort**: 4 hours
- **Deliverable**: `/compare` page showing Word Is Bond vs TCN/Balto/Skit.ai
- **Content**: Use competitive matrix from market assessment

#### Task 3.2: First Customer Case Study Shell 🟢
- **Effort**: 2 hours
- **Deliverable**: `/case-studies/pilot-agency` page template
- **Content**: Placeholder for first beta customer story

#### Task 3.3: Pricing Page Polish 🟢
- **Effort**: 4 hours
- **Deliverable**: Collections-specific pricing tiers:
  - Starter: 1-5 agents, $299/mo
  - Professional: 6-20 agents, $799/mo
  - Enterprise: 21+ agents, custom

---

## Success Metrics

### Sprint Completion Criteria

| Metric | Pre-Sprint | Target | Actual |
|--------|------------|--------|--------|
| **Market Readiness** | 85% | 95% | TBD |
| **Table Stakes Features** | 6/8 | 8/8 | TBD |
| **Dialer Functional** | ❌ | ✅ | TBD |
| **Omnichannel Complete** | ⚠️ | ✅ | TBD |
| **Test Coverage** | 89% | 92% | TBD |
| **Production Tests Passing** | 217/217 | 230+/230+ | TBD |

### Post-Sprint Capabilities

**Must Demo Successfully**:
1. ✅ Full call workflow: Campaign → auto-dial → live call → coaching → disposition → next call
2. ✅ Omnichannel outreach: Voice + SMS + Email from one account
3. ✅ Compliance-first: Pre-dial checks, Mini-Miranda, DNC enforcement
4. ✅ Real-time intelligence: Transcription, sentiment, settlement calculator
5. ✅ Evidence integrity: Complete audit trail, exportable evidence

---

## Risk Management

### High-Risk Items

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Telnyx API integration complex | Medium | High | Start with simple dial, iterate | Agent 2 |
| AMD accuracy below 90% | Medium | Medium | Use Telnyx native AMD, fallback to timeout | Agent 2 |
| Dialer performance issues | Low | High | Load test with 100 concurrent calls | QA Agent |
| SMS delivery failures | Low | Medium | Implement retry queue, alerting | Agent 4 |

### Contingency Plans

**If Telnyx Integration Blocked** (>2 days):
- Ship dialer with manual click-to-dial
- Defer auto-dial to Week 3
- Still achieves 90% market ready

**If SMS/Email Campaigns Blocked** (>2 days):
- Ship individual send only
- Defer bulk campaigns to Week 3
- Still achieves 90% market ready

---

## Post-Sprint: Go-to-Market (Week 3)

### Immediate Actions

1. **3 Pilot Customers**
   - Target: Small agencies (5-10 agents) in network
   - Offer: 50% discount for 3 months
   - Goal: Feedback + case study

2. **Pricing Finalization**
   - Lock in $/agent or $/org tiers
   - Set up Stripe product SKUs
   - Enable self-serve signup

3. **Demo Video**
   - Record 5-min Loom: dialer + omnichannel workflow
   - Publish to YouTube + landing page
   - Share on LinkedIn

4. **Sales Deck**
   - 10 slides: Problem, Solution, Features, Competitive Edge, Pricing, Case Study
   - PDF + Google Slides versions
   - Sales enablement training

### 30-Day Launch Plan

- **Week 3**: Pilot signups + feedback loop
- **Week 4**: Polish based on pilot feedback
- **Week 5**: Public launch (ProductHunt, Reddit r/collections, LinkedIn)
- **Week 6**: First paid customer → iterate

---

## Resource Requirements

### Team Allocation

- **Agent 1** (DialerPanel Integration): 1 day
- **Agent 2** (Telnyx Integration): 2 days
- **QA Agent** (Dialer Testing): 1 day
- **Agent 3** (Auto-Advance): 1 day
- **Agent 4** (SMS Inbound): 1 day
- **Agent 5** (SMS Campaigns): 2 days
- **Agent 6** (Email Campaigns): 1 day
- **Agent 7** (Inbox - stretch): 2 days

**Total**: 11 person-days across 2 weeks (within capacity)

### Infrastructure

- ✅ Cloudflare Workers (existing)
- ✅ Neon PostgreSQL (existing)
- ✅ Telnyx account (existing)
- ✅ Resend account (existing)
- ⚠️ Telnyx Call Control app (needs configuration)

---

## Approval & Sign-Off

**Plan Approved By**: [Stakeholder]  
**Date**: February 14, 2026  
**Sprint Start**: February 17, 2026 (Monday)  
**Sprint End**: February 28, 2026 (Friday)  
**Launch Target**: March 3, 2026 (Week 3)

---

**Document Status**: APPROVED — Ready for Execution  
**Next Review**: End of Week 1 (February 21, 2026)  
**Success Definition**: 95% market ready, full dialer + omnichannel functional
