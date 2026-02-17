# Requirements to Flow Coverage Matrix

TOGAF Phase: B/C/G  
Date: 2026-02-16  
Status: Baseline completeness assessment (requirements-level)

---

## 1) Assessment intent

This matrix answers: **Are flows complete and correct against business functional requirements?**

Authoritative inputs:

- `ARCH_DOCS/APPLICATION_FUNCTIONS.md` (38 functional domains)
- `ARCH_DOCS/01-CORE/FLOW_CATALOG.md` (BF/WF/FF definitions)
- `ARCH_DOCS/01-CORE/FLOW_TRACEABILITY_MATRIX.md` (test evidence)
- `ARCH_DOCS/01-CORE/FLOW_DELIVERABLE_GOVERNANCE_STANDARD.md` (L0-L4 gate)
- `ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md` (agentic constraints)

---

## 2) Scoring model

- **Coverage Fit**
  - Full: requirement explicitly mapped to one or more flows
  - Partial: mapped at high level, missing dedicated subflow detail
  - Gap: no clear mapping

- **Evidence Strength**
  - Strong: Full test coverage in traceability matrix
  - Medium: Partial test coverage
  - Weak: Gap or no deterministic evidence

- **Governance Readiness**
  - L4 only when flow has mandatory ownership/controls/observability/runbook/test handles

---

## 3) Functional-domain mapping (38 domains)

| App Function Domain | Primary Flow Mapping | Coverage Fit | Evidence Strength | Notes |
|---|---|---|---|---|
| 1. Auth & Session | FF-01, WF-AGENT-01/WF-ADMIN-01 | Full | Strong | Session/RBAC tests present |
| 2. Voice Ops | FF-03, WF-AGENT-01 | Full | Strong | API+E2E lifecycle coverage |
| 3. Live Translation | FF-03 (+ specialized subflow needed) | Partial | Medium | Feature-specific acceptance not isolated in flow catalog |
| 4. AI Intelligence Suite | FF-03/FF-04/FF-09 (+ AI subflows needed) | Partial | Medium | AI policy constraints exist; subflow granularity missing |
| 5. Bond AI Assistant | FF-09 (+ AI assist subflow needed) | Partial | Medium | Requires explicit non-autonomy acceptance criteria |
| 6. Cockpit Workspace | WF-AGENT-01/WF-AGENT-02 | Full | Strong | Canonical simulator coverage |
| 7. Predictive Dialer | FF-07, WF-AGENT-01 | Full | Strong | Covered in campaign/dialer tests |
| 8. Collections CRM | FF-05, BF-02 | Full | Strong | Import+lifecycle covered |
| 9. Campaign Management | FF-07 | Full | Strong | API and E2E coverage present |
| 10. Analytics & Reporting | WF-MANAGER-01, BF-05 | Full | Medium | Matrix marks partial in places |
| 11. Scorecard & QA | WF-MANAGER-01, BF-05 | Partial | Medium | Explicit command/coaching assertions still pending |
| 12. Billing & Subscription | FF-06, BF-03 | Full | Medium | Settlement/reconciliation depth still partial |
| 13. Team & Org Mgmt | WF-ADMIN-01, BF-06 | Full | Medium | Governance automation still partial |
| 14. Compliance & Security | FF-08, BF-04 | Full | Medium | Edge-case forced-block tests pending |
| 15. IVR System | FF-03/FF-09 (+ IVR subflow needed) | Partial | Weak | Not represented as dedicated canonical flow |
| 16. Webhook Mgmt | FF-09, WF-ADMIN-01 | Full | Strong | Security/retry coverage present |
| 17. CRM Integration | FF-09 | Full | Strong | OAuth/sync flow represented |
| 18. Feature Flags | WF-ADMIN-01, BF-06 | Partial | Medium | Needs explicit flow state/rollback criteria |
| 19. Onboarding Wizard | BF-01 | Full | Medium | Matrix marks onboarding acceptance script gap |
| 20. Payment Plans & Dunning | FF-06, BF-03 | Partial | Medium | Dedicated plan/reconciliation scenario pending |
| 21. Scheduling & Callbacks | FF-05, WF-AGENT-02 | Full | Strong | Callback/notes path covered |
| 22. Agent Productivity | WF-AGENT-01/WF-AGENT-02 | Full | Strong | Quick actions and workflow covered |
| 23. Sentiment Analysis | BF-05 (+ sentiment subflow needed) | Partial | Medium | KPI path exists but no standalone flow spec |
| 24. TTS | FF-03 (+ TTS subflow needed) | Partial | Weak | Dedicated acceptance and failure modes missing |
| 25. Recording Management | FF-03 (+ recording custody subflow needed) | Partial | Medium | Needs explicit evidence-custody flow controls |
| 26. Data Retention & Legal Holds | FF-08, BF-06 | Full | Medium | More deterministic legal-hold scenario tests advised |
| 27. RBAC & Permissions | FF-01, WF-ADMIN-01, BF-06 | Full | Strong | Unit + E2E present |
| 28. Admin & Platform Mgmt | WF-ADMIN-01, BF-06 | Full | Medium | Governance checklist automation gap |
| 29. Infrastructure & DevOps | BF-06 (platform ops envelope) | Partial | Medium | Not a user flow; should be operational control flow set |
| 30. Testing & QA | Cross-cutting all flows | Partial | Medium | Framework exists; per-flow L4 gates not yet enforced in CI |
| 31. UI/UX Framework | WF-AGENT/WF-MANAGER/WF-ADMIN | Full | Medium | UX quality checks not fully codified as flow acceptance |
| 32. QuickBooks Integration | FF-09 | Full | Strong | Included in integrations lifecycle |
| 33. Google Workspace Integration | FF-09 | Full | Strong | Included in integrations lifecycle |
| 33A. Outlook Integration | FF-09 | Full | Strong | Included in integrations lifecycle |
| 34. Notifications (Slack/Teams) | FF-09 | Full | Strong | Included in integrations lifecycle |
| 35. Helpdesk Integration | FF-09 | Full | Strong | Included in integrations lifecycle |
| 36. Webhook Automation (Zapier/Make) | FF-09 | Full | Strong | Included in integrations lifecycle |
| 37. Integration Settings Hub | WF-ADMIN-01, FF-09 | Full | Medium | Add admin route-level acceptance assertions |
| 38. Email Campaign System | FF-04, FF-07 | Full | Medium | Expand negative-path and deliverability failure scenarios |

---

## 4) Completeness verdict (requirements-level)

### 4.1 Coverage snapshot

- Full fit: 26/38 domains
- Partial fit: 12/38 domains
- Gap: 0/38 domains

### 4.1.1 Partial attribution by reason

Documentation/modeling partial (requirements mapped, but subflow/governance detail still incomplete):

- 3. Live Translation
- 4. AI Intelligence Suite
- 5. Bond AI Assistant
- 11. Scorecard & QA
- 15. IVR System
- 18. Feature Flags
- 20. Payment Plans & Dunning
- 23. Sentiment Analysis
- 24. TTS
- 25. Recording Management
- 29. Infrastructure & DevOps
- 30. Testing & QA

Evidence/testing partial (flow exists, but test depth is not yet full per traceability matrix):

- BF-01 Organization Activation
- BF-03 Payment Recovery
- BF-04 Compliance Risk Control
- BF-05 Team Performance Loop
- BF-06 Platform Governance
- WF-MANAGER-01 Command Oversight
- WF-ADMIN-01 Access + Config Governance
- FF-04 Messaging lifecycle
- FF-06 Payments lifecycle
- FF-08 Compliance/DNC lifecycle

Cross-layer partial (both documentation depth and evidence depth contribute):

- Onboarding/activation
- Payment recovery/plans/reconciliation
- Compliance forced-block and legal-hold scenarios
- Manager command/coaching and admin governance operations

### 4.2 Interpretation

- **No major capability is completely missing** from canonical flows.
- However, a meaningful subset is only represented at broad abstraction and needs subflow decomposition for full correctness assurance.

### 4.3 Are workflows “standard”?

- **Yes, internally standard**: BF/WF/FF taxonomy + TOGAF governance + traceability matrix + L4 gate model.
- **Not yet fully standardized operationally**: many flows in `FLOW_CATALOG.md` do not yet carry all mandatory L4 fields from `FLOW_DELIVERABLE_GOVERNANCE_STANDARD.md` (owners, explicit state models, SLO/alerts, runbook links).

---

## 5) Correctness verdict

Current state should be considered:

- **Architecturally coherent:** Yes
- **Functionally broad-complete:** Yes (at capability level)
- **Operationally complete and proven-correct:** **Not yet** (until partial items are closed and L4 gate is enforced per flow)

---

## 6) Priority closure actions

1. Add dedicated subflows/specs for: live translation, AI assist, IVR, TTS, recording custody, sentiment, feature flags.
2. Close partial evidence gaps already identified in `FLOW_TRACEABILITY_MATRIX.md` (onboarding, manager/coaching, payment reconciliation, compliance forced-block).
3. Enforce L4 gate in CI so any flow lacking mandatory deliverables fails release.
4. Create companion governance artifacts:
   - `ROLE_AUTHORIZATION_MATRIX.md`
   - `ROUTE_CONTRACT_MATRIX.md`
   - `STATE_TRANSITIONS.md`

---

## 7) Agentic interpretation capability statement

The platform artifacts are sufficient for an AI assistant to:

- ingest business functional domains,
- map domains to canonical flows,
- detect coverage/evidence deficiencies,
- and recommend closure actions.

Final business acceptance remains a human governance decision, but the interpretation and gap analysis can be automated and made deterministic.
