# Edge-Native Production Stack (2026)

This document captures the consolidated edge-first stack recommended for the project and maps it to the repository, deployment patterns, and operational runbooks in this repo.

## Final Recommended Stack

- Frontend: Next.js (App Router) deployed to Cloudflare Pages (Preview + Production)
- API / Glue: Cloudflare Workers (Workers + Queues)
- Database: Neon Postgres (serverless) + Hyperdrive
- Media Storage: Cloudflare R2 (versioned buckets)
- Telephony: Telnyx (CPaaS)
- Realtime Transcription: AssemblyAI (WS)
- TTS: ElevenLabs (streaming)
- Translation/LLM: DeepL / OpenAI (GPT-4o-mini)
- Auth: NextAuth / Auth.js with Neon pg-adapter (migrated to run on Workers or via Hyperdrive)
- Background Jobs: Cloudflare Queues + Cron Triggers
- Observability: Cloudflare Logpush + Sentry (errors)

## Mapping to repo
- `app/` → Next.js App ready for Pages deployment (static + SSR). Use Pages' environment variables for `NEXTAUTH_URL` in previews and production.
- `services/backend/` → currently an Express-based container service. Recommended transitional approach: keep container for now but progressively move API endpoints to Workers (start with webhook receivers and transcription proxy).
- `scripts/` and `migrations/` → run from CI or ephemeral runners before promoting images or routing traffic.

## Deployment notes
- Use Cloudflare Pages for UI with automatic previews on PRs.
- Deploy Workers for all `/api/*` glue endpoints. Workers should call Neon via Hyperdrive (edge-aware connection) or via a small backend bridge where pooling is required.
- Store recordings in R2 and return presigned URLs to the frontend.

## Operational guidance
- Secrets: keep production secrets in Cloudflare Pages/Workers environment or in GitHub Actions secrets for CI runs. Do not store secrets in repo.
- Migration policy: run DB migrations from CI with manual approval for prod; follow the Neon runbook and the `NEON_DATA_MIGRATION_RUNBOOK.md` for zero-downtime steps.
- Debugging: avoid exposing debug endpoints in production. Use Cloudflare Access and short-lived tokens for any internal debug endpoints during staging.

## Auth & Session note (important)
- Auth.js/NextAuth and the `@auth/pg-adapter` expect a session-token format; confirm whether tokens are stored raw or hashed in the `authjs.sessions` table.
- If you must change token storage format, follow the zero-downtime migration steps in the Neon runbook.

## Phased migration plan (practical steps)
1. Stabilize backend in container and fix session-resolution bug (current priority).
2. Add R2 upload + retrieval endpoints and test storing real recordings in staging.
3. Move webhook receivers (Telnyx/AssemblyAI) to Workers and validate end-to-end flows.
4. Implement Workers-based transcription proxy for AssemblyAI realtime flows.
5. Reduce container responsibilities: keep only legacy or complex routes until decommissioned.

## Cost & scaling notes
- Expect transcription and telephony to be the dominant variable costs.
- Use R2 and Cloudflare caching to reduce egress and runtime costs.

## References
- See `DEPLOYMENT_CHECKLIST.md`, `SECRETS_TO_SET.md`, and `NEON_DATA_MIGRATION_RUNBOOK.md` for operational runbooks and exact commands.
