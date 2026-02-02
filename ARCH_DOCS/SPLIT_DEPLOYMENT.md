# Split Deployment: Frontend (Cloudflare Pages) + Node Backend

Last updated: 2026-01-27

Overview
- Frontend: Next.js compiled with OpenNext for Cloudflare Pages (edge runtime for UI pages and static assets).
- Backend: Node/Express service (Docker image) hosting server-only APIs: DB access (Neon), webhooks, Auth.js sessions, long-running jobs, and integrations.

Why this design
- Edge runtimes cannot use Node-only builtins or native modules; server-only SDKs (pg, child_process, ws, many monitoring SDKs) must run in Node.
- Splitting keeps frontend fast and Cloudflare-compatible while allowing full Node features in backend.

Responsibilities
- Frontend (Pages): UI, static pages, client-side fetches to `/api/*` (proxied to backend in dev), OpenNext bundle.
- Backend (Node): `/api/*` endpoints that require `pg`, `crypto`, `fs`, long-running tasks, Auth.js provider flows, webhooks (Stripe, AssemblyAI, SignalWire), integrations callbacks.

Environment variables (examples)
- Frontend build-time (Cloudflare Pages / OpenNext):
  - NEXT_PUBLIC_APP_URL: https://your-frontend.example
  - NEXT_PUBLIC_BACKEND_URL: https://your-backend.example

- Backend runtime (Node):
  - NEON_PG_CONN (recommended): full Neon connection string (includes password & sslmode)
  - AUTH_SECRET / NEXTAUTH_SECRET
  - NEXTAUTH_URL or BACKEND_URL: public backend URL for provider callbacks
  - Provider credentials: GOOGLE_CLIENT_ID/SECRET, GITHUB_ID/SECRET, SMTP_*
  - AssemblyAI/Stripe/SignalWire keys

Database migrations
- Migrations are idempotent SQL in `migrations/`.
- Run migration against Neon (example):
  ```bash
  psql "$NEON_PG_CONN" -f migrations/auth_pg_adapter.sql
  ```

Auth.js notes
- Use `@auth/core` with `@auth/pg-adapter` on the Node backend.
- Ensure `AUTH_SECRET` is set and `NEXTAUTH_URL` points to the backend public URL.
- Create DB tables using the provided SQL before enabling auth in production.

CI/CD and deployment
- Build and publish backend Docker image to GHCR (workflow in `.github/workflows/backend-ci.yml`).
- Deploy image to a container platform (Render, Fly, or similar). Example Render setup is documented in repository README.
- Ensure secrets are stored in the platform's secret manager and not committed.

Local dev
- Use `NEXT_PUBLIC_BACKEND_URL` and `next.config.js` rewrites to proxy `/api/*` to local backend.
- Start backend locally: `npm run backend:start` (from repo root).

Testing
- Use the smoke-test script `services/backend/tests/smoke-auth.js` to validate `/health` and basic auth endpoints.

Rollback
- Take a DB snapshot or enable point-in-time restore before applying migrations in production.

Contact
- Repo owner / maintainer for secrets and deploy keys.
