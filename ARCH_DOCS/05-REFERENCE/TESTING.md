# Testing Guide (Vitest + Playwright)

## Versions
- `vitest`: ^4.0.16 (@vitest/coverage-v8)
- `@playwright/test`: ^1.58.1 (e2e)

## Configs
- `vitest.config.ts`: unit/integration
- `vitest.production.config.ts`: prod mocks/env

## Scripts
```
npm test                    # vitest watch
npm run test:run            # vitest run
npm run test:production     # prod config
npm run test:prod:db        # DB tests (RUN_DB_TESTS=1)
npm run test:prod:api       # API (RUN_API_TESTS=1)
npm run test:prod:voice     # Voice (RUN_VOICE_TESTS=1)
npm run test:e2e            # integration/e2e
npm run test:coverage       # coverage
```

## Patterns
- **Unit**: components, hooks (vitest)
- **Integration/E2E**: login.spec.ts (playwright?)
- **Prod Tests**: Mock Workers/Neon, real env vars.

## Examples
- `tests/e2e/login.spec.ts`: Auth flows.
- `tests/production/database.test.ts`: Neon queries.
- `tests/production/api.test.ts`: /api/auth etc.

## Best Practices
- RUN_*=1 for real deps.
- Coverage: v8 provider.
- Playwright: page.goto, expect.

## Troubleshooting
- DB: NEON_PG_CONN env.
- API: Mock fetch or real tail.

See tests/ dir.