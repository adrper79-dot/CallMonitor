# Split Deployment — Updated Design & Production Readiness

Updated: 2026-01-27

Summary
- Frontend: Next.js app built with OpenNext and hosted on Cloudflare Pages. Edge runtime used only for lightweight routes and static assets.
- Backend: Dedicated Node/Express service in `services/backend` for all server-only responsibilities (DB access, webhooks, Auth, long-running jobs, audio/TTS, presigned uploads, external integrations).

Design highlights
- Clear runtime separation prevents Node-builtins and native modules from being bundled into Edge code.
- Frontend remains fast and Cloudflare-compatible; backend provides full Node capabilities and access to Neon, R2, and other server-side resources.

File map (concise)
- `app/` — UI, client code, lightweight Edge routes.
- `app/services/elevenlabs.ts` — ElevenLabs REST helper (Edge-safe client-side helper for small ops).
- `app/api/*` — API surface; routes that require server features are proxied to Node or marked `runtime='nodejs'`.
- `services/backend/` — Express server, `nextauth` handler, webhooks, audio endpoints, integration callbacks.
- `migrations/` — idempotent SQL migrations (Auth adapter SQL included).
- `deploy/` — example manifests: `deploy/render.yaml`, `deploy/fly.toml`.
- `scripts/deploy_backend.sh` — build/push script with Fly/Render examples.

Standards validation (quick)
- Runtime separation: PASS — server-only modules are isolated to `services/backend`.
- Secrets management: PASS (requires platform setup) — `.env` examples present; DO NOT commit secrets. Use platform secret stores.
- Migrations: PASS — `migrations/auth_pg_adapter.sql` applied successfully in staging when `NEON_PG_CONN` supplied.
- Auth: PASS — `@auth/core` + `@auth/pg-adapter` wired on backend; must set `AUTH_SECRET` and `NEXTAUTH_URL` in production.
- Observability: WARNING — opentelemetry/prisma instrumentation emits build warnings; ensure telemetry runs server-side only.
- Third-party SDKs: PASS — ElevenLabs SDK removed from Edge; heavier tasks routed to backend.

Production readiness checklist (required before go-live)
1. Set and verify production secrets on the hosting platform: `NEON_PG_CONN`, `AUTH_SECRET`, `NEXTAUTH_URL`, provider creds (Google/GitHub), `ASSEMBLYAI_KEY`, `STRIPE_SECRET`, `SIGNALWIRE_KEY`.
2. Publish backend Docker image to GHCR and configure automatic deploys (CI workflow: `.github/workflows/backend-ci.yml`).
3. Run full E2E smoke tests against deployed backend: `/health`, auth flows, webhook consumption, audio/TTS endpoints.
4. Configure server-side monitoring and error reporting (Sentry/Prometheus) and ensure instrumentation is backend-only.
5. Harden backend: CORS, rate-limiting, request size limits, and authentication checks for sensitive endpoints.
6. Create and verify runbooks: DB restore, key rotation, incident response, and deploy rollback procedures.

Production-ready verdict
- Current status: "Near-ready". The architecture, code separation, and migrations are in place. Completing the checklist above (especially secrets, CI image publish, and E2E smoke tests) is required before declaring fully production ready.

Operational notes / next steps
- Publish GHCR image and deploy to chosen platform (Render or Fly). The repo contains example manifests in `deploy/` and a `scripts/deploy_backend.sh` helper.
- After deploy, run the smoke-test script in `services/backend/tests/` against the deployed endpoint.
- Enable backend monitoring and add health checks to the platform (e.g., `/health` endpoint monitored).

References
- `ARCH_DOCS/SPLIT_DEPLOYMENT.md` (original) — conceptual notes and migration rationale.
- `services/backend/README.md` — deployment and run instructions.
- `migrations/auth_pg_adapter.sql` — Auth.js adapter schema.

If you want, I can:
- Render the Mermaid diagram to an SVG and embed it into this docs file.
- Run the checklist items I can perform locally (e.g., publish image if you provide GHCR credentials) or run smoke tests against a deployed URL.
