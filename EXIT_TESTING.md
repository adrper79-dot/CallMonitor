# Exit Testing Process

**Purpose**: Comprehensive pre-deploy validation for code, build, deps, and CF Pages/Workers. Ensures 99% compliance + no regressions. Run before merge/deploy.

**When**: PRs, releases, post-updates.

## 1. Quick Smoke Test (Local – 2min)
```bash
rm -rf node_modules .next package-lock.json
npm ci
npm run validate  # lint + tsc + build + test
npm run build:cloudflare
npm run preview  # wrangler pages dev
```
**Expect**: No SWC warnings, build succeeds, app loads (test Voice call).

## 2. Deps/Build Audit (Proactive)
```bash
npm ls next @next/swc --depth=0  # Match versions
npm audit  # Fix vulns
npm outdated  # Update non-breaking
```

**SWC Mismatch Fix** (If warning):
```json
// package.json overrides
{
  "overrides": {
    "@next/swc-*": "15.5.11"  // Match your Next.js
  }
}
```
→ `npm i`.

## 3. Agent Prompting Guide (Deep Scans)
Use these for AI reviews:

| Tier | Prompt | Catches |
|------|--------|---------|
| Build | "Run npm run validate/build:cloudflare. Report ALL warnings/errors." | SWC, hydration, bundle. |
| Deps | "npm ls next @next/swc/audit. Mismatches?" | Versions/vulns. |
| CF | "wrangler pages dev test. Voice/WebRTC/cron?" | Edge/deploy. |
| Full | "1. Code/arch. 2. Deps audit. 3. Builds ALL. 4. CF sim." | Everything. |

**Rule**: `@create_rule('ExitTesting', 'Always validate build/deps first.')`

## 4. CF Pages/Workers Checklist
- [ ] `wrangler.toml`: Hyperdrive/Neon bindings, `nodejs_compat_v2=true`.
- [ ] `open-next.config.ts`: `buildCommand: "npm run build"`.
- [ ] Cron: `[triggers.crons]` or `vercel.json`.
- [ ] Edge Externals: `next.config.js` (crypto/node:*).
- [ ] Deploy: `npm run build:cloudflare && wrangler pages publish .open-next/assets`.
- [ ] Test: Realtime (Supabase), WebRTC (SignalWire), Evidence bundles.

## 5. CI/CD Template (.github/workflows/deploy.yml)
```yaml
name: Exit Testing & Deploy
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: rm -rf node_modules package-lock.json
      - run: npm ci
      - run: npm run validate
      - run: npm run build:cloudflare
      - run: npm test -- --coverage
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - ... checkout/ci/build
      - run: npx wrangler pages publish .open-next/assets --project-name=wordisbond
```

## 6. Success Criteria
- Build: 0 warnings.
- Lighthouse: 95+ perf/accessibility.
- e2e: Voice→Evidence pass.
- CF: 100ms latency (Hyperdrive).

**Run Now**: Copy-paste smoke test. 100% deploy confidence! 🚀
