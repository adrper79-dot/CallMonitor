# Agent Orchestration — Word Is Bond Platform

**Purpose:** Index of specialized agent prompts organized by ROADMAP workstream.  
**Usage:** Open the relevant agent prompt file and paste it as context when starting a focused session.

---

## How to Use These Agents

Each agent prompt file contains:

- **Scope** — what workstream it covers
- **Context files** — what to read first for that domain
- **Remaining items** — specific tasks pulled from ROADMAP.md
- **Critical rules** — guardrails to never violate
- **Success criteria** — how to know when done

### Starting a Session

1. Pick the agent prompt that matches your work focus
2. Start a new Copilot/Claude session
3. Paste the agent prompt as initial context (or reference the file)
4. The agent will read the listed context files and begin work

### Parallel vs Sequential

These agents can work **independently** — they don't share state:

| Agent                                            | ROADMAP Section        | Remaining | Estimated Hours |
| ------------------------------------------------ | ---------------------- | --------- | --------------- |
| [Security & Risk](agents/security-risk.md)       | RISK/SCALE             | 5 items   | ~4hr            |
| [DX & CI](agents/dx-ci.md)                       | DX/CI                  | 2 items   | ~3hr            |
| [Architecture](agents/architecture.md)           | DESIGN/CODE EXCELLENCE | 7 items   | ~17hr           |
| [Stack Integration](agents/stack-integration.md) | STACK EXCELLENCE       | 7 items   | ~11hr           |

**Total remaining:** ~21 items across 4 workstreams (~35hr estimated)

---

## Shared Resources (All Agents Must Read)

These files contain rules that apply to EVERY workstream:

1. `.github/copilot-instructions.md` — global project rules (auto-loaded by Copilot)
2. `ARCH_DOCS/LESSONS_LEARNED.md` — hard-won pitfalls and patterns
3. `ARCH_DOCS/DATABASE_CONNECTION_STANDARD.md` — DB connection order (8+ hours lost)
4. `ARCH_DOCS/CURRENT_STATUS.md` — current version and deployment state
5. `ROADMAP.md` — full progress tracker (69/109, 63%)

---

## After Any Agent Completes Work

```bash
# 1. Deploy Workers
npm run api:deploy

# 2. Build Next.js
npm run build

# 3. Deploy Pages
npm run pages:deploy

# 4. Health check
npm run health-check

# 5. Update ROADMAP.md — mark items [x]
# 6. Update ARCH_DOCS/CURRENT_STATUS.md — bump version
# 7. Git commit and push
```

---

## Cross-Workstream Dependencies

| Task                  | Depends On                              | Notes                                        |
| --------------------- | --------------------------------------- | -------------------------------------------- |
| Telnyx VXML Migration | Security agent (WAF rules)              | WAF should be set before new voice endpoints |
| E2E Tests             | Stack Integration (subscriptions)       | E2E should cover billing flows               |
| RLS Audit             | Listed in both Security & Stack         | Can be done by either agent                  |
| AI Proxies            | Security agent (rate limiting patterns) | Reuse existing KV rate limiter               |

---

_Last updated: February 7, 2026 — v4.11_
