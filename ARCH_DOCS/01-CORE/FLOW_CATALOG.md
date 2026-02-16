# Flow Catalog

TOGAF Phase: B/C/G  
Version: 1.0.0  
Date: 2026-02-16  
Status: Active baseline for flow correctness validation

---

## Purpose

This catalog defines canonical flows for:

- Business outcomes (BF)
- Role workflows (WF)
- System feature flows (FF)

Use this file as the source of truth for:

- acceptance criteria
- test traceability
- documentation QA

---

## Flow ID format

- BF-XX: Business flow
- WF-ROLE-XX: Role workflow
- FF-XX: Feature/system flow

---

## A) Business Flows (BF)

## BF-01 Organization Activation

- Objective: make a new organization operational
- Trigger: first successful sign-in by owner/admin
- Preconditions:
  - valid account
  - organization membership established
- Primary path:
  1. Sign in
  2. Complete onboarding setup
  3. Provision org number pool
  4. Save compliance defaults
  5. Land in role shell
- Exceptions:
  - auth failure
  - provisioning incomplete
  - role visibility mismatch
- Exit criteria:
  - user reaches workspace
  - role shell visible
  - outbound flows available

## BF-02 Daily Collections Operations

- Objective: execute high-volume outreach with consistent documentation
- Trigger: agent starts shift
- Preconditions:
  - queue and account data available
- Primary path:
  1. Open work queue
  2. Select account
  3. Execute contact attempt
  4. Record outcome via quick action
  5. Continue to next account
- Exceptions:
  - no queue accounts
  - account detail unavailable
  - quick action submit failure
- Exit criteria:
  - every touched account has note/disposition
  - unresolved accounts have callback/next action

## BF-03 Payment Recovery

- Objective: convert customer commitment to recorded payment outcome
- Trigger: customer commits to pay
- Preconditions:
  - account selected
  - payment route available
- Primary path:
  1. Create payment link or plan
  2. Send to customer
  3. Track status in payments view
  4. Reconcile completion/failure
- Exceptions:
  - payment config unavailable
  - link generation failure
- Exit criteria:
  - payment artifact created
  - account/payment timeline updated

## BF-04 Compliance Risk Control

- Objective: prevent non-compliant contact and preserve traceability
- Trigger: pre-contact and post-contact events
- Preconditions:
  - compliance checks enabled
- Primary path:
  1. Pre-dial validation (DNC/consent/time/frequency/legal hold)
  2. Allow or block decision
  3. Record event trail
  4. Route disputes/violations to compliance views
- Exceptions:
  - service error defaults to safe block path
- Exit criteria:
  - prohibited contacts blocked
  - reasons and events retrievable

## BF-05 Team Performance Loop

- Objective: improve agent outcomes and quality
- Trigger: manager daily review cycle
- Preconditions:
  - command and analytics data available
- Primary path:
  1. Monitor live board
  2. Review scorecards/coaching queue
  3. Review KPI trends
  4. Issue coaching actions
- Exceptions:
  - partial metric availability
- Exit criteria:
  - coaching actions logged
  - trend review complete

## BF-06 Platform Governance

- Objective: maintain secure, stable, role-correct operations
- Trigger: admin weekly review or change event
- Preconditions:
  - admin shell access
- Primary path:
  1. Role/access review
  2. Integration/channel status review
  3. Billing/usage review
  4. Retention/compliance checks
- Exceptions:
  - auth/permission mismatch
  - provider outages
- Exit criteria:
  - governance checklist complete
  - issues queued with owners

---

## B) Role Workflows (WF)

## WF-AGENT-01 Queue-to-Call Workflow

- Role: agent/operator/viewer-shell users
- UI scope:
  - `/work`
  - `/work/queue`
  - `/work/call`
  - `/accounts`
- API scope:
  - `/api/collections`
  - `/api/calls`
  - `/api/messages`
  - `/api/notes`, `/api/callbacks`, `/api/disputes`
- Success criteria:
  - account progressed with documented outcome

## WF-AGENT-02 Quick Action Completion

- Role: agent
- UI scope:
  - quick action modals in call workspace
- API scope:
  - `/api/notes`
  - `/api/callbacks`
  - `/api/disputes`
  - `/api/payments/links`
- Success criteria:
  - action persisted and visible in account context

## WF-MANAGER-01 Command Oversight

- Role: manager/compliance/analyst
- UI scope:
  - `/command`
  - `/command/live`
  - `/command/scorecards`
  - `/command/coaching`
  - `/analytics`
- API scope:
  - `/api/analytics`
  - `/api/scorecards`
  - `/api/compliance`
- Success criteria:
  - actionable team exceptions identified and assigned

## WF-ADMIN-01 Access and Configuration Governance

- Role: admin/owner
- UI scope:
  - `/settings`
  - `/teams`
  - `/admin`
- API scope:
  - `/api/organizations`
  - `/api/teams`
  - `/api/feature-flags`
  - `/api/admin/metrics`
  - `/api/webhooks*`
- Success criteria:
  - role/access and config posture validated

---

## C) Feature Flows (FF)

## FF-01 Authentication and Session Context

- Entry points:
  - `/api/auth/callback/credentials`
  - `/api/auth/session`
  - `/api/auth/refresh`
- Data entities:
  - users, sessions, org_members
  - KV session context mapping
- Invariants:
  - active org context deterministic
  - unauthorized requests denied

## FF-02 Role-Shell Navigation and Access

- Entry points:
  - `lib/navigation.ts`
  - protected shell routes in `app/*`
- Data entities:
  - RBAC role context
- Invariants:
  - role shell aligns with assigned role
  - nav links resolve to valid routes

## FF-03 Voice Call Lifecycle

- Entry points:
  - `/api/voice/call`
  - `/api/calls/*`
  - `/api/webrtc/*`
  - `/api/webhooks/telnyx`
- Data entities:
  - calls, recordings, timeline events
- Invariants:
  - call state transitions valid
  - webhook updates org-scoped and signed

## FF-04 Messaging Lifecycle

- Entry points:
  - `/api/messages`
  - `/api/messages/bulk`
- Data entities:
  - messages, collection_accounts
- Invariants:
  - consent/compliance gates applied
  - account/campaign scoping preserved

## FF-05 Collections Lifecycle

- Entry points:
  - `/api/collections/*`
  - `/api/import/*`
- Data entities:
  - collection_accounts, collection_notes, collection_callbacks, collection_disputes
- Invariants:
  - account operations scoped to organization
  - writes auditable and schema-consistent

## FF-06 Payments Lifecycle

- Entry points:
  - `/api/payments/*`
  - `/api/billing/*`
- Data entities:
  - payment_links, payment_plans, scheduled_payments, subscription artifacts
- Invariants:
  - amount/account binding preserved
  - lifecycle state reflected in views

## FF-07 Campaign and Dialer Lifecycle

- Entry points:
  - `/api/campaigns/*`
  - `/api/dialer/*`
  - scheduled sequence execution
- Data entities:
  - campaigns, campaign_calls, sequence_enrollments
- Invariants:
  - queue transitions valid
  - recipient scoping to campaign

## FF-08 Compliance and DNC Lifecycle

- Entry points:
  - `/api/compliance/*`
  - `/api/dnc/*`
- Data entities:
  - compliance_events, dnc-related entities, legal_holds
- Invariants:
  - blocked contact paths enforce denial
  - reason and audit trace retained

## FF-09 Integrations and Webhook Lifecycle

- Entry points:
  - `/api/crm/*`
  - `/api/quickbooks/*`
  - `/api/google-workspace/*`
  - `/api/helpdesk/*`
  - `/api/webhooks*`
- Data entities:
  - integrations, encrypted token storage, delivery logs
- Invariants:
  - secure token handling
  - webhook mutation routes require proper role

---

## 10) Flow acceptance checklist template

Apply this checklist to any new/changed flow:

- [ ] Flow ID assigned (BF/WF/FF)
- [ ] Trigger and preconditions documented
- [ ] Happy path and exception path documented
- [ ] UI route(s), API endpoint(s), data entities listed
- [ ] Role requirement documented
- [ ] Exit criteria measurable
- [ ] Traceability to automated tests added
