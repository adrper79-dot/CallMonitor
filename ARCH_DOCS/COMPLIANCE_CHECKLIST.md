# Compliance & Connectivity Checklist — run results (2026-01-29)

Summary: I ran the CLI connectivity checks using the secrets in `.vercel/.env`. Below are the observed results, follow-up action items, and monitoring points to track changes.

## Quick results
- Neon Postgres: reachable — `select version()` returned PostgreSQL 17.7 (OK)
- AssemblyAI realtime token: no valid token response observed — needs verification (follow-up)
- ElevenLabs voices: API responded with voice list (OK)
- Frontend health (`/api/health`): returned NOT_FOUND (404) — verify health route and `NEXT_PUBLIC_APP_URL`
- Backend smoke test: ran successfully
  - Backend started on `http://127.0.0.1:8081`
  - `/health` returned 200
  - `/api/auth/session` returned 200 (body null)

## Expanded findings & timestamps
- Run timestamp: 2026-01-29T23:XX:00Z (local run)
- Neon: `select version()` success — PostgreSQL 17.7 (catalog reachable)
- AssemblyAI token call returned non-200 / empty body — possible header format or API key rotation
- ElevenLabs returned full voice manifest JSON (large list) — API key valid
- Frontend health endpoint returned 404 at `https://voxsouth.online/api/health` — check whether health is exposed on Workers domain or Pages project
- Backend smoke test started on random port 8081 and performed expected health checks; NextAuth session endpoint returned 200 with null body (no cookie provided in this smoke context)

## Actions & Recommendations (short-term)
- AssemblyAI token: verify `ASSEMBLYAI_API_KEY` validity and that the endpoint `https://api.assemblyai.com/v2/realtime/token` accepts the provided header format. Re-run token request and capture full response. (Owner: DevOps)
- Frontend health 404: confirm `NEXT_PUBLIC_APP_URL` points to deployed Pages/Worker and that `/api/health` route is implemented. If health endpoint moved to Worker, test the Worker domain. (Owner: Frontend)
- Auth/session null: `/api/auth/session` returned 200 but body null — validate NextAuth session configuration and that cookies are included for the test environment. (Owner: Backend)
- Postgres SSL warning (from smoke test): update SSL parameters per recommendation (consider `sslmode=verify-full` or `uselibpqcompat=true&sslmode=require`). (Owner: DBA)

## Immediate remediation tasks (ordered)
1. Re-run AssemblyAI token request capturing full HTTP status, headers and body; try both `Authorization: <key>` and `Authorization: Bearer <key>` header formats. Timeout: 1 day. (DevOps)
2. Verify that `NEXT_PUBLIC_APP_URL` is canonical Pages/Worker URL. If site is deployed on Cloudflare Pages, update `NEXT_PUBLIC_APP_URL` accordingly and run health check. Timeout: 1 day. (Frontend)
3. Update smoke test to include a test cookie or short-lived session token so `/api/auth/session` returns session body; add to CI. Timeout: 2 days. (Backend)
4. Create an automated CI job to run the minimal CLI checks after infra changes and save output to `reports/cli_checks/YYYYMMDD.json`. Timeout: 2 days. (DevOps)
5. Add periodic job to validate AssemblyAI token and ElevenLabs voices daily; add Slack alert on failure. Timeout: 3 days. (SRE)

## Monitoring & Change Tracking (for PRs / migrations)
- Add a GitHub Action that runs a minimal subset of these checks after infra changes (psql, AssemblyAI token, ElevenLabs voices, health endpoint). Save results to `reports/cli_checks/YYYYMMDD.json`.
- Create an alerting rule (Slack/email) if AssemblyAI token endpoint returns failure or if Postgres becomes unreachable.
- Track `.vercel/.env` changes in a separate secure audit log (do not commit secrets). Record changes with reviewer and timestamp.

## Evidence & Artifacts
- Saved run output: `ARCH_DOCS/COMPLIANCE_CHECKLIST.md` (this file) includes summary.
- Scripts added: `scripts/run_cli_checks_no_psql.ps1` (uses `.vercel/.env`), `scripts/run_cli_checks.ps1` (full);
- CI workflow to be added: `.github/workflows/cli_checks.yml` (creates `reports/cli_checks/` outputs)

## Compliance acceptance criteria (concrete tests)
- Postgres query returns within 3s and `select version()` contains major version >= 15.
- AssemblyAI realtime token endpoint returns 200 with JSON containing `client_secret` or `token` field.
- ElevenLabs voice list returns 200 with array length > 0.
- `/api/health` on canonical app URL returns 200 and JSON { status: "ok" }.
- Smoke test returns non-null session body when run with test session token.

## Next actions I will perform (if you confirm)
1. Add GitHub Action to run CLI checks and save outputs to `reports/cli_checks/` (I will create the workflow file). 
2. Create db backup script `scripts/backup_db.sh` and run a dry-run to save to `migrations/backups/` (requires `NEON_PG_CONN`).
3. Begin migration branch creation `infra/final-stack-migration` and commit these compliance artifacts.

## Acceptance Criteria for Green State
- AssemblyAI realtime token endpoint returns token JSON (success) using `ASSEMBLYAI_API_KEY`.
- Frontend `/api/health` returns 200 on the canonical domain.
- Backend smoke test returns session body when a valid session cookie or test token is provided.
- Postgres SSL mode adjusted and verified in staging and production.

## Next steps I can do for you
- Re-run focused AssemblyAI token request and capture full response (I can do this now).
- Patch `ARCH_DOCS/00-README.md` to point to `ARCH_DOCS/FINAL_STACK.md` as canonical.
- Add a CI job skeleton for automated CLI checks and store results under `reports/cli_checks/`.

Maintainer: Architecture Team
Run by: automated assistant (local run)
Date: 2026-01-29
