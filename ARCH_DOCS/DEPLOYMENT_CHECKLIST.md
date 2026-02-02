**Deployment Checklist**

- **Migrations**: Run `node services/backend/scripts/run_sql_file.js services/backend/migrations/create_authjs_tables.sql` (requires `NEON_PG_CONN`). The migration is idempotent and safe to re-run.
 - **Migrations**: Run `node services/backend/scripts/run_sql_file.js services/backend/migrations/create_authjs_tables.sql` (requires `NEON_PG_CONN`). The migration is idempotent and safe to re-run.
   - For Neon/Hyperdrive + Cloudflare Workers deployments run migrations as a CI job or ephemeral runner before routing production traffic to the new environment.
- **Secrets**: Set the following in the target environment (CI/CD secrets or platform env):
  - **NEXTAUTH_SECRET** / **AUTH_SECRET**: strong random secret (do not reuse devsecret)
  - **NEON_PG_CONN**: Neon Postgres connection string (use least-privileged user)
  - **GOOGLE_CLIENT_ID**, **GOOGLE_CLIENT_SECRET**, **GITHUB_CLIENT_ID**, **GITHUB_CLIENT_SECRET** (if using OAuth)
  - **SMTP_URL** or provider creds / **RESEND_API_KEY** for email
  - **SENTRY_DSN** (optional) and `SENTRY_TRACES_SAMPLE_RATE`
- **CI**: CI will build, test, and publish the backend image to GHCR when `GHCR_PAT` is set in repository secrets. Integration tests against Neon run only when `NEON_PG_CONN` is provided to CI.
 - **CI**: CI will build, test, and publish the backend image to GHCR when `GHCR_PAT` is set in repository secrets. Integration tests against Neon run only when `NEON_PG_CONN` is provided to CI.
   - If you adopt the edge-native stack (Cloudflare Pages + Workers + R2), CI should instead run preview builds and a dedicated migration + e2e job that uses staging secrets injected from the secret manager (do not hardcode secrets in the workflow).
- **E2E testing**:
  - Ensure a staging OAuth redirect URI is configured for Google/GitHub.
  - CI should run full sign-in flows in staging using real OAuth or email link flows.
- **Security & Cookies**:
  - Ensure `NODE_ENV=production` in runtime so `useSecureCookies` is enabled and cookie `secure` is true.
  - Use HTTPS / TLS termination at the edge (load balancer) and set `NEXTAUTH_URL` to the canonical HTTPS URL.
  - Rotate dev secrets: remove `devsecret` from environment files; do not commit secrets to repo.
- **DB credential handling**:
  - Use a dedicated least-privileged DB role for the app (no superuser).
  - Use environment secrets for connection strings; avoid storing in files in repo.
- **Observability**:
  - Set `SENTRY_DSN` for error monitoring and set `SENTRY_TRACES_SAMPLE_RATE` as desired.
  - Ensure logs are aggregated (platform-specific) and include request ids.
- **Readiness/Liveness**:
  - Kubernetes example probes:
    - livenessProbe: `httpGet: /health`, initialDelaySeconds: 15, periodSeconds: 10
    - readinessProbe: `httpGet: /ready`, initialDelaySeconds: 5, periodSeconds: 10

  - **Edge / Workers note**: Cloudflare Workers and Pages do not use Kubernetes liveness probes; ensure your Worker health checks are lightweight and that any long-running jobs are moved to Queues. For Workers deployments, validate preview deployments and use Cloudflare logs for readiness indicators.

- **Rollback**: Create a point-in-time backup or snapshot before applying migrations in production. The migration is idempotent but schema changes should always be guarded by backups.

Commands:

```bash
# Apply migration (requires NEON_PG_CONN env)
NEON_PG_CONN="${NEON_PG_CONN}" node services/backend/scripts/run_sql_file.js services/backend/migrations/create_authjs_tables.sql

# Run adapter integration test (staging only)
NEON_PG_CONN="${NEON_PG_CONN}" NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" node services/backend/scripts/adapter_test.js

# Post-deploy smoke tests (recommended):
```bash
# smoke: health + simple auth check (use an ephemeral test user or run auth sign-in in staging)
curl -f https://<prod-host>/health
# If you have a test cookie available (or a test sign-in), verify session resolution
curl -v -H "Cookie: next-auth.session-token=<token>" https://<prod-host>/api/auth/session
```
```
