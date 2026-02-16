# Flow Traceability Matrix

Date: 2026-02-16  
Purpose: Prove that business/workflow/feature flows are test-covered and verifiable.

Legend:

- Test Type: Unit, Integration (Vitest production), E2E (Playwright), Script
- Coverage: Full, Partial, Gap

---

## 1) Business flow traceability

| Flow ID | Flow Name | Primary Tests | Test Type | Coverage | Notes |
|---|---|---|---|---|---|
| BF-01 | Organization Activation | tests/e2e/auth-flow.spec.ts, tests/e2e/login.spec.ts, tests/e2e/workplace-simulator.spec.ts | E2E | Partial | Onboarding path covered in simulator/auth flows; formal onboarding acceptance script still needed |
| BF-02 | Daily Collections Operations | tests/e2e/workplace-simulator.spec.ts, tests/production/workflow-validation.test.ts (WF2) | E2E + Integration | Full | Includes account create/import and quick actions in canonical simulator |
| BF-03 | Payment Recovery | tests/e2e/workplace-simulator.spec.ts, tests/production/workflow-validation.test.ts (WF7) | E2E + Integration | Partial | Link generation and billing endpoints covered; settlement/payment-plan dedicated E2E can be expanded |
| BF-04 | Compliance Risk Control | tests/production/workflow-validation.test.ts (WF8), tests/e2e/permission-access-control.spec.ts | Integration + E2E | Partial | Compliance endpoints validated; policy edge-case simulation can be deepened |
| BF-05 | Team Performance Loop | tests/e2e/analytics.spec.ts, tests/e2e/dashboard.spec.ts, tests/e2e/reports.spec.ts | E2E | Partial | Manager command/coaching flow should have explicit runbook test |
| BF-06 | Platform Governance | tests/unit/rbac.test.ts, tests/e2e/settings-webhook.spec.ts, tests/e2e/permission-access-control.spec.ts | Unit + E2E | Partial | Admin governance functions covered in pieces; full governance checklist automation is a gap |

---

## 2) Role workflow traceability

| Flow ID | Role Workflow | Primary Tests | Test Type | Coverage | Notes |
|---|---|---|---|---|---|
| WF-AGENT-01 | Queue → Call → Outcome | tests/e2e/workplace-simulator.spec.ts, tests/e2e/voice-operations.spec.ts, tests/e2e/dialer-workflow.spec.ts | E2E | Full | Canonical simulator is primary acceptance test |
| WF-AGENT-02 | Quick Action Completion | tests/e2e/workplace-simulator.spec.ts, tests/e2e/ui-endpoint-toggle-audit.spec.ts | E2E | Full | Verifies notes/callback/dispute/payment-link interaction paths |
| WF-MANAGER-01 | Command Oversight | tests/e2e/dashboard.spec.ts, tests/e2e/analytics.spec.ts, tests/e2e/reports.spec.ts | E2E | Partial | Add explicit command scorecard/coaching assertions |
| WF-ADMIN-01 | Access + Config Governance | tests/e2e/settings-webhook.spec.ts, tests/e2e/permission-access-control.spec.ts, tests/unit/rbac.test.ts | E2E + Unit | Partial | Add explicit `/admin` feature matrix walkthrough test |

---

## 3) Feature flow traceability

| Flow ID | Feature Flow | Primary Tests | Test Type | Coverage | Notes |
|---|---|---|---|---|---|
| FF-01 | Auth/session context | tests/e2e/auth-flow.spec.ts, tests/production/workflow-validation.test.ts (WF1), tests/production/sessions-index-regression.test.ts | E2E + Integration | Full | Includes session and RBAC context checks |
| FF-02 | Role-shell navigation/access | tests/unit/navigation.test.ts, tests/nav-link-audit.test.ts, tests/e2e/navigation.spec.ts | Unit + E2E | Full | Structural and runtime nav checks in place |
| FF-03 | Voice call lifecycle | tests/production/voice.test.ts, tests/production/voice-live.test.ts, tests/production/voice-e2e.test.ts, tests/e2e/voice-operations.spec.ts | Integration + E2E | Full | Includes API + UI lifecycle coverage |
| FF-04 | Messaging lifecycle | tests/production/workflow-validation.test.ts (WF4), tests/e2e/inbox.spec.ts | Integration + E2E | Partial | Add dedicated bulk SMS negative/consent path E2E |
| FF-05 | Collections lifecycle | tests/production/collections.test.ts, tests/production/csv-ingestion-e2e.test.ts, tests/e2e/workplace-simulator.spec.ts | Integration + E2E | Full | Covers import and lifecycle interactions |
| FF-06 | Payments lifecycle | tests/production/workflow-validation.test.ts (WF7), tests/e2e/workplace-simulator.spec.ts | Integration + E2E | Partial | Add explicit payment-plan + reconciliation scenario |
| FF-07 | Campaign/dialer lifecycle | tests/production/dialer-integration.test.ts, tests/e2e/dialer-workflow.spec.ts, tests/e2e/campaigns.spec.ts | Integration + E2E | Full | Campaign + dialer covered from API and UI |
| FF-08 | Compliance/DNC lifecycle | tests/production/workflow-validation.test.ts (WF8), tests/e2e/security-edge-cases.spec.ts | Integration + E2E | Partial | Add legal-hold and frequency-cap forced-block test |
| FF-09 | Integrations/webhooks lifecycle | tests/production/workflow-validation.test.ts (WF5/WF6), tests/production/webhook-retry.test.ts, tests/webhooks-security.test.ts, tests/e2e/settings-webhook.spec.ts | Unit + Integration + E2E | Full | Security + retry + UI config coverage present |

---

## 4) Validation scripts and commands

| Purpose | Command |
|---|---|
| Critical workflow integration | `RUN_INTEGRATION=1 npx vitest tests/production/workflow-validation.test.ts --run` |
| Canonical agent journey | `npm run test:simulator` |
| Navigation integrity | `npx vitest tests/nav-link-audit.test.ts --run` |
| Production API/live suite | `npm run test:live:all` |
| Full E2E regression | `npm run test:e2e` |

---

## 5) Current gaps to close

Priority gaps:

1. Dedicated onboarding acceptance test with strict step completion criteria.
2. Explicit manager command/coaching runbook test assertions.
3. Payment plans + reconciliation E2E flow coverage.
4. Compliance forced-block scenarios (legal hold, frequency caps) as deterministic tests.

---

## 6) Definition of done for flow validation

A flow is validated only when all are true:

- Linked to at least one automated test in this matrix.
- Includes at least one negative/error-path assertion.
- Maps to role authorization expectations.
- Produces deterministic pass/fail artifacts (CI output or report file).
