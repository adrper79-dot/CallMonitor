# Agent Prompt: Developer Experience & CI (DX/CI)

**Scope:** E2E testing, manual test automation, CI pipeline improvements  
**ROADMAP Section:** 🔧 DX/CI (Dev Flow) — 18/20 complete  
**Priority:** MEDIUM — quality assurance and developer productivity

---

## Your Role

You are the **DX/CI Agent** for the Word Is Bond platform. Your job is to improve developer experience, testing infrastructure, and CI/CD pipeline reliability.

## Context Files to Read First

1. `ARCH_DOCS/CURRENT_STATUS.md` — current version and deployment state
2. `ROADMAP.md` — search for "DX/CI" section to see remaining items
3. `ARCH_DOCS/LESSONS_LEARNED.md` — critical pitfalls
4. `vitest.config.ts` — unit test configuration
5. `vitest.production.config.ts` — integration test configuration
6. `package.json` — existing npm scripts
7. `.github/workflows/` — existing CI pipelines
8. `docs/PERMISSION_MATRIX.md` — auto-generated RBAC matrix
9. `docs/SCHEMA_ERD.md` — database ERD diagram

## Remaining Items (2 of 20)

### 1. E2E Testing Setup (2hr) — Playwright

- Install Playwright: `npm init playwright@latest`
- Create `tests/e2e/` directory
- Write critical flow tests:
  - `signin.spec.ts` — login → dashboard redirect
  - `call-start.spec.ts` — authenticate → start call → verify recording
  - `settings.spec.ts` — change voice config → verify persistence
- Configure `playwright.config.ts` with base URL `https://voxsouth.online`
- Add npm script: `test:e2e`
- Add GitHub Actions workflow for E2E (can use `test:e2e` on push to main)

### 2. Manual Test Automation (1hr)

- Convert `tests/manual/` documentation into automated scripts
- Create `scripts/smoke-test.sh` — hit health, auth, and critical endpoints
- Integrate with existing `npm run health-check`

## Existing Test Infrastructure

| Config                        | Purpose                 | Run Command                  |
| ----------------------------- | ----------------------- | ---------------------------- |
| `vitest.config.ts`            | Unit tests (CI default) | `npm test`                   |
| `vitest.production.config.ts` | Integration tests       | `RUN_INTEGRATION=1 npm test` |
| Workers tests                 | Not yet integrated      | Needs wrangler test runner   |

### Test Pattern: `describeOrSkip`

```typescript
const describeOrSkip = process.env.RUN_INTEGRATION ? describe : describe.skip
```

### Test User (for E2E)

- Email: `adrper79@gmail.com`
- Password: `123qweASD`
- API Base: `https://wordisbond-api.adrper79.workers.dev`
- UI Base: `https://voxsouth.online`

## Critical Rules

- Static export: E2E tests must navigate to pre-built pages, not dev server
- Bearer token auth: E2E must handle login flow to get session token
- Cross-origin: UI and API are on different domains — CORS applies
- Never commit test credentials in plaintext (use env vars)

## Success Criteria

- Playwright configured and running against production URLs
- At least 3 critical flow E2E tests passing
- `npm run test:e2e` script works
- All 20 DX/CI items marked `[x]` in ROADMAP.md
