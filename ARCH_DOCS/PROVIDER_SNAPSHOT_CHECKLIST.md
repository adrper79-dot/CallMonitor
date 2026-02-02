# Provider Snapshot Checklist

Purpose: steps to snapshot current provider configurations before any migration or cutover.

Providers to snapshot:
- Cloudflare (Account + Pages + Workers + R2)
- Neon (projects, branches, roles)
- Telnyx (numbers, webhooks, auth tokens)
- SignalWire (projects, tokens)
- AssemblyAI (API keys, webhook targets)
- ElevenLabs (API keys, voice models)
- Vercel (project settings, env vars)

Checklist (perform and store artifacts securely):

1) Cloudflare
  - Export Pages project settings (project name, routes, secrets)
  - Export Workers scripts & bindings (via wrangler or `wrangler tail` metadata)
  - Export R2 bucket names and enable versioning (document lifecycle rules)
  - Save a copy of current WAF rules and Access policies

2) Neon
  - Export project list, roles, and connection strings
  - Export branch list and current branch commit ids
  - Create a read-only connection string for validation tests

3) Telnyx / SignalWire
  - List phone numbers (DIDs) and associated webhooks
  - Export API keys (rotate after capture) and document who has access

4) AssemblyAI / ElevenLabs
  - List active API keys and webhook endpoints
  - Document voice models / allowed locales

5) Vercel / CI
  - Export project env var list (do NOT store secrets in repo)
  - Document deployment hooks and domains

6) Storage
  - Generate and save an object manifest from Supabase storage (list of keys + sizes + checksums)
  - If possible, create a snapshot copy or export to temporary secure bucket

Recommendations:
- Store snapshots in a secure vault or dedicated audit bucket with ACL restricted to ops.
- Timestamp and sign each snapshot file and record operator name.
- Rotate any API keys captured after snapshotting.
