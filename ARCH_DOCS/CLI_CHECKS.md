# CLI Connectivity & Quick Checks

Purpose: quick commands to validate connectivity to the core services used by the FINAL_STACK. Run these from your local dev machine / CI with appropriate environment variables set.

Prereqs:
- `wrangler` (Cloudflare Workers/Pages)
- `psql` (Postgres client)
- `curl` / `http` / `jq`
- `wscat` or another WebSocket client (optional, for realtime tests)
- Environment variables set: `NEON_PG_CONN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `TELNYX_API_KEY`, `ASSEMBLYAI_API_KEY`, `ELEVENLABS_API_KEY`

1) Cloudflare (Workers / Pages)
- Check Wrangler auth:

```bash
wrangler whoami
```

- Test a worker/Pages health endpoint (replace with your route):

```bash
curl -i https://<your-pages-or-worker-domain>/api/health
```

- Local dev (Workers):

```bash
wrangler dev --local --experimental-local-persist
```

2) Neon Postgres
- Quick connectivity test (uses `NEON_PG_CONN` env):

```bash
psql "$NEON_PG_CONN" -c 'select version();'
psql "$NEON_PG_CONN" -c 'select 1 as ok;'
```

- If you need to test a specific DB user/role, export a connection string:

```bash
export NEON_PG_CONN='postgresql://neondb_owner:...@<host>/neondb?sslmode=require'
```

3) Cloudflare R2 (S3-compatible)
- R2 is S3-compatible. You can test with `s3cmd` or `aws cli` (use the R2 endpoint and credentials). Example (aws cli):

```bash
# configure AWS env vars for R2 (account id & access key/secret)
aws --endpoint-url https://<account>.r2.cloudflarestorage.com s3 ls
```

4) Telnyx
- List account numbers (simple GET):

```bash
curl -s -H "Authorization: Bearer $TELNYX_API_KEY" "https://api.telnyx.com/v2/phone_numbers" | jq .
```

- Get account status:

```bash
curl -s -H "Authorization: Bearer $TELNYX_API_KEY" "https://api.telnyx.com/v2/auth/verify" | jq .
```

5) AssemblyAI (REST + Realtime)
- REST quick check:

```bash
curl -s -H "Authorization: $ASSEMBLYAI_API_KEY" https://api.assemblyai.com/v2/realtime/token | jq .
```

- Realtime WebSocket test (wscat):

```bash
wscat -c "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000" -H "Authorization: $ASSEMBLYAI_API_KEY"
```

6) ElevenLabs
- List voices:

```bash
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v1/voices | jq .
```

7) DeepL / GPT-4o-mini (translation tests)
- DeepL REST test (if used):

```bash
curl -s -H "Authorization: DeepL-Auth-Key $DEEPL_KEY" "https://api-free.deepl.com/v2/translate?text=hello&target_lang=DE" | jq .
```

- GPT test (OpenAI-compatible):

```bash
curl -s -H "Authorization: Bearer $OPENAI_KEY" -H "Content-Type: application/json" -d '{"model":"gpt-4o-mini","input":"translate: hello -> fr"}' https://api.openai.com/v1/responses
```

8) System smoke test
- Run standard test suite:

```bash
# run from root
npm run test
```

Notes:
- Replace token placeholders with the correct env vars.
- For WebSocket tests, make sure your network allows outbound ws(s) connections.
- If CLI tools are missing, install via package manager: `npm i -g wrangler wscat awscli jq s3cmd`.

If you want, I can run these checks here — tell me which ones you want me to run and confirm that your env vars (secrets) can be used in this environment or provide sanitized connection details.
