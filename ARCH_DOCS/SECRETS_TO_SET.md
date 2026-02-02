# Secrets To Set (migration)

This file lists exact secret names and where to set them for the Neon cutover (test/dev and later prod). Do NOT commit real secrets to the repo.

Env names (recommended)
- `SUPABASE_PG_CONN` — Supabase Postgres connection string (used by migration scripts)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (storage + admin APIs)
- `SUPABASE_PROJECT_REF` — Supabase project ref used for storage API endpoints
- `NEON_PG_CONN` — Neon Postgres connection string for target branch
- `NEON_ADMIN_ROLE` — Role name to use when restoring (pg_restore `--role`)
- `HYPERDRIVE_ID` — Cloudflare Hyperdrive configuration ID
- `R2_ACCESS_KEY_ID` — Cloudflare R2 access key id
- `R2_SECRET_ACCESS_KEY` — Cloudflare R2 secret
- `R2_BUCKET_ACCOUNT_ID` — Cloudflare account id (used for endpoint)
- `R2_BUCKET` — default R2 bucket name (e.g., `wordisbond01`)
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with R2 and DNS permissions
- `CLOUDFLARE_ORIGIN_CA_KEY` — optional Origin CA key if using custom TLS
- `CLOUDFLARE_ORIGIN_CA_KEY` — optional Origin CA key if using custom TLS
- `NEXTAUTH_URL` / `NEXTAUTH_SECRET` — auth settings if used
- `SENTRY_DSN` — optional
- `PUBLIC_ASSETS_URL` — canonical asset hostname (R2/custom domain)

- `AUTH_SECRET` / `NEXTAUTH_SECRET` — critical: must be the same secret used by Auth.js/NextAuth; rotating this changes cookie verification and session lookup (do NOT rotate without a migration plan)
- `GHCR_PAT` — if using GitHub Container Registry for images
- `TELNYX_API_KEY` / `TELNYX_ACCOUNT_ID` — telephony credentials
- `ASSEMBLYAI_API_KEY` — transcription API key
- `ELEVENLABS_API_KEY` — TTS API key
- `DEEPL_API_KEY` or `OPENAI_API_KEY` — translation/LLM keys
- `SMTP_URL` / `RESEND_API_KEY` — email provider creds
- `DEBUG_API_KEY` — temporary debugging key; rotate and remove prior to prod

Where to set
- Local dev: `.env` (for local testing only). Avoid committing `.env`.
- CI / Pipelines: store in CI secret store (GitHub Actions Secrets, Azure DevOps variable groups, etc.).
- Cloudflare: Pages > Settings > Environment Variables (Production & Preview).

Rotation & access
- Recommended: rotate keys after production cutover. Use short-lived tokens where possible.
- Limit scope: Cloudflare token should be scoped to R2 and DNS only.

Postponing rotation until after build
- If you choose to postpone rotation until after completing the build and deploy, follow these safeguards:
	1. Use the minimal-scope tokens possible for CI (limit permissions and, if available, set short TTLs).
	2. Record every affected secret name and where it is stored (CI, Render, Cloudflare, GHCR, Neon, Supabase, etc.).
	3. Schedule an immediate rotation and update window to run immediately after a successful build/deploy.
	4. After the build completes, rotate tokens in the provider consoles and update the secret values in GitHub (or your CI secret store).

Quick rotation and verification example (GitHub CLI):
```powershell
# set a new secret value (replace owner/repo and secret)
gh secret set GHCR_PAT --repo adrper79-dot/CallMonitor --body "$NEW_GHCR_PAT"

# verify secrets present
gh secret list --repo adrper79-dot/CallMonitor
```

How to populate (example command lines)
```powershell
$env:SUPABASE_PG_CONN='postgresql://user:pass@db.project.supabase.co:5432/postgres?sslmode=require'
$env:NEON_PG_CONN='postgresql://user:pass@branch.region.neon.tech:5432/neondb?sslmode=require&channel_binding=require'
```

Once secrets are set in your secret manager, run verification scripts:
- `node scripts/dry_run_inventory.js` (reads `SUPABASE_PG_CONN` and `NEON_PG_CONN`)
- `node scripts/export_supabase_inventory.js` (reads `SUPABASE_PG_CONN`)
- `node scripts/export_supabase_storage.js` (reads `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_PROJECT_REF`)

Quick verification checklist (secrets):
- [ ] `NEON_PG_CONN` works from CI runner (run `psql "$NEON_PG_CONN" -c 'SELECT 1'`)
- [ ] `NEXTAUTH_SECRET` or `AUTH_SECRET` is set in both staging and prod (and matches where required)
- [ ] Cloudflare API token can access R2 and Pages preview (test via `wrangler` or Cloudflare CLI)
- [ ] AssemblyAI / ElevenLabs / Telnyx keys are valid in staging and have usage caps configured
