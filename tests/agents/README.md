# AI Agent Testing System — Word Is Bond

## Overview

Autonomous AI agents use your app like real users in real browsers. Each agent logs in with role-appropriate credentials, navigates the platform via Claude AI decisions, captures screenshots at every step, and generates HTML evidence reports.

## Architecture

```
tests/agents/
├── config.ts         ← Test users, URLs, routes, RBAC mapping
├── types.ts          ← Shared TypeScript interfaces
├── agent.ts          ← AIAgent class (browser + Claude decision loop)
├── scenarios.ts      ← 25 scenarios across 6 roles (mapped to Flow Catalog)
├── orchestrator.ts   ← Runs all scenarios, generates master report
├── run.ts            ← Entry point for full suite
├── run-single.ts     ← Entry point for single-role testing
└── README.md         ← This file
```

## Quick Start

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run all agent tests (visible browser)
npm run test:agents

# Run headless (CI mode)
npm run test:agents:headless

# Run by role
npm run test:agent:owner
npm run test:agent:admin
npm run test:agent:manager
npm run test:agent:compliance
npm run test:agent:agent
npm run test:agent:viewer
```

## How It Works

1. **Login**: Agent navigates to `/signin`, fills `input#email` + `input#password`, clicks submit. Waits for redirect to role shell (`/work`, `/command`, `/dashboard`).

2. **AI Loop**: Claude sees a screenshot + DOM elements → decides next action (click, type, navigate, scroll) → agent executes → repeat until goal is met or max steps reached.

3. **Evidence**: Every step gets a timestamped screenshot saved to `test-results/agent-screenshots/<role>/`.

4. **Reports**: HTML reports per role + master report in `test-results/agent-reports/`.

## Roles & Shells

| Role | Shell | Landing | Scenarios |
|------|-------|---------|-----------|
| `owner` | admin | `/command` | Analytics, billing, voice config |
| `admin` | admin | `/command` | Team, integrations, call config |
| `manager` | manager | `/command` | Command center, campaigns, reports |
| `compliance` | manager | `/command` | Violations, DNC, disputes, audit |
| `agent` | agent | `/work` | Queue, dialer, accounts, payments |
| `viewer` | agent | `/work` | View-only verification |

## Scenarios

All 25 scenarios map to real flows from `ARCH_DOCS/01-CORE/FLOW_CATALOG.md`:

- **BF-01** Organization Activation → Owner analytics overview
- **BF-02** Daily Collections → Agent queue, dialer, accounts workflows
- **BF-03** Payment Recovery → Agent payment links, settlement calculator
- **BF-04** Compliance Risk → Compliance violations, DNC, disputes
- **BF-05** Team Performance → Manager command center, scorecards
- **BF-06** Platform Governance → Admin settings, integrations, billing

## Output Structure

```
test-results/
├── agent-screenshots/
│   ├── owner/
│   │   ├── step-001-1739721600000.png
│   │   └── ...
│   ├── admin/
│   ├── manager/
│   ├── compliance/
│   ├── agent/
│   └── viewer/
├── agent-videos/
│   ├── owner/
│   └── ...
└── agent-reports/
    ├── master-report-1739721600000.html
    ├── owner-1739721600000.html
    ├── agent-1739721600001.html
    └── agent-test-summary-1739721600000.json
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | — | Claude API key |
| `AGENT_TEST_URL` | No | `https://wordis-bond.com` | Target URL |
| `AGENT_HEADLESS` | No | `false` | Headless browser mode |
| `AGENT_SLOW_MO` | No | `300` | ms delay between actions |
| `AGENT_TEST_OWNER_EMAIL` | No | `adrper79@gmail.com` | Owner login |
| `AGENT_TEST_OWNER_PASSWORD` | No | `123qweASD` | Owner password |

## Flow Catalog Coverage

| Flow ID | Flow Name | Covered By |
|---------|-----------|------------|
| WF-AGENT-01 | Queue-to-Call Workflow | Agent scenarios |
| WF-AGENT-02 | Quick Action Completion | Agent — View Accounts |
| WF-MANAGER-01 | Command Oversight | Manager scenarios |
| WF-ADMIN-01 | Access & Config Governance | Admin scenarios |
| FF-01 | Auth & Session | All (login flow) |
| FF-02 | Role-Shell Navigation | All (shell routing) |
| FF-05 | Collections Lifecycle | Agent — Accounts |
| FF-06 | Payments Lifecycle | Agent — Payment Links |
| FF-07 | Campaign & Dialer | Manager — Campaigns |
| FF-08 | Compliance & DNC | Compliance scenarios |
