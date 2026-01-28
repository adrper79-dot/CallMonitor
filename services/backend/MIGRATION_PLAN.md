# Migration Plan — Split deployment (Frontend + Node backend)

Last updated: 2026-01-27

Goals
- Move server-only endpoints and handlers out of the Cloudflare Pages/Edge bundle and into a Node backend.
- Ensure Next/OpenNext frontend builds cleanly for Cloudflare Pages.

Scope (initial)
- Audio transcription webhooks and upload handling (AssemblyAI)
- Payment webhooks (Stripe) — stubbed for now
- Telephony/webhook receivers (SignalWire) — stubbed for now
- Move DB-heavy endpoints that require `pg`, `crypto`, and other node-only modules

Phased Tasks
1. Create Node backend scaffold (done)
2. Add webhook endpoints and wire them to handlers (this commit)
3. Migrate server-only API routes incrementally into `services/backend/src/` (webhooks, integrations, auth flows)
4. Update frontend to call backend via `NEXT_PUBLIC_BACKEND_URL` or proxy in dev
5. Add CI/CD for backend (Dockerfile or platform config) and secret management

Short-term next steps (for this sprint)
- Implement and test `services/backend/src/webhooks.js` handlers (AssemblyAI, SignalWire, Stripe)
- Migrate remaining audio-related server logic into backend
- Run full `npx open-next build` to verify frontend build passes

Notes
- Backend expects `NEON_PG_CONN` or `DATABASE_URL` in env for Postgres pool.
- `BACKEND_URL` or `NEXT_PUBLIC_APP_URL` should be set so AssemblyAI webhooks point back to this service.
- Keep handlers idempotent and safe to re-run (webhook retries are common).

Contact
- Maintainer: repo owner (see project README)
Migration Plan — Split deployment: Cloudflare Pages frontend + Node backend

Overview
- Goal: Move server-only API logic out of Next Edge/runtime bundles into a dedicated Node backend at `services/backend`.
- Strategy: Incremental migration by feature groups. Track progress here and in the project's TODO list.

Phases
1) Bootstrap (done)
   - scaffolded `services/backend` with `src/index.js`
   - wired basic audio endpoints and attention endpoints
   - verified backend runs locally on port from env or 8080

2) Webhooks (in progress)
   - Create backend endpoints for:
     - `/api/webhooks/assemblyai`
     - `/api/webhooks/signalwire`
     - `/api/webhooks/stripe`
   - Validate signatures where applicable and persist minimal event records
   - Update frontend/dev scripts to point AssemblyAI webhook_url to backend during dev

3) Auth server ops
   - Move NextAuth callbacks, signup, forgot-password flows that require server secrets
   - Ensure session/storage compatibility (JWT/DB)

4) Integrations
   - Salesforce, third-party sync, background jobs
   - Move long-running tasks or native module usage to backend

5) Remaining server-only routes
   - Identify routes using `pg`, `node:*` builtins, or server-only SDKs (ElevenLabs, ws, prisma instrumentation)
   - Migrate gradually, test each group

6) Frontend rewiring
   - Add `NEXT_PUBLIC_BACKEND_URL` for Pages build
   - Update fetch targets or add a lightweight proxy during dev

7) Deploy backend
   - Provide Dockerfile or platform instructions (Render/Fly/Vercel)
   - Add CI job to deploy and set `BACKEND_URL` in Pages deploy

8) Validation & cleanup
   - Run full OpenNext build and end-to-end tests
   - Remove or mark migrated Next routes as deprecated

Notes and safety
- Prefer incremental small changes and tests for each feature group.
- Keep webhooks idempotent and make DB writes defensive.
- Add a `webhook_events` table if not present (used by stubs). Consider a quick migration script if you want persistence.

Next immediate steps
- Finish webhook handler logic (translate existing Next route code into backend handlers).
- Migrate auth flows next.

Contact
- This file is authoritative for migration progress; update it when marking groups complete.
