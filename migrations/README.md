This folder contains helper migration artifacts and seeds used during local testing and cutover validation.

Files of interest:
- `seed_test_users.js` — Node script that creates `admin01@testgroup.org`, `owner@testgroup.org`, `user1@testgroup.org`, `user2@testgroup.org`, the `testgroup` organization, `org_members` entries, and `tool_team_members` entries for `callmonitor`. Use when your environment cannot run SQL directly or when you want deterministic UUIDs via Node.
- `seed_test_users.sql` — Idempotent SQL equivalent of the Node script (safe to run multiple times). Prefers checks via `WHERE NOT EXISTS` so it does not require unique indexes on every column.

Usage:
1. Using Node (works when `NEON_PG_CONN` is set):

```bash
NEON_PG_CONN="<conn-string>" node migrations/seed_test_users.js
```

2. Using psql (ensure the connection string is quoted for your shell):

```bash
psql "<conn-string>" -f migrations/seed_test_users.sql
```

Notes:
- Both artifacts are idempotent and intended for test or product-validation environments only. Do not run these in production without review.
- The SQL variant uses `gen_random_uuid()` which requires `pgcrypto` extension (the schema includes it in pass1 migrations).

Storage migration helpers:
- `scripts/copy_supabase_to_r2.sh` / `scripts/copy_supabase_to_r2.ps1` — helper scripts to run rclone/aws based copies.
- `migrations/rclone.conf.template` — rclone config template for an `r2` remote.
- `lib/storage.ts` — server-side storage adapter that routes to R2 when `R2_*` envs are present and falls back to Supabase when `SUPABASE_*` envs are available.

Recommended copy workflow:
1. Provision `r2` remote in rclone using `migrations/rclone.conf.template` (fill credentials from your secret manager).
2. Dry-run sync with rclone as shown in `ARCH_DOCS/NEON_CUTOVER_CHECKLIST.md`.
3. Run sync and verify counts/checksums against `migrations/supabase_storage_backup/` manifests.
