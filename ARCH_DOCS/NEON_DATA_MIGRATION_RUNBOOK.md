# Neon Data Migration Runbook

Purpose: step-by-step plan to migrate data from Supabase -> Neon safely, including initial bulk copy, incremental sync options, verification, rollback, and post-cutover tasks.

Prerequisites
- Ensure you have the following env vars or connection strings (set in CI or local `.env`): `SUPABASE_PG_CONN`, `NEON_PG_CONN`, `SUPABASE_SERVICE_ROLE_KEY` (for storage), `NEON_ADMIN_ROLE` (if applicable).
- Ensure `pg_dump`, `pg_restore`, and `psql` are installed locally or in CI runners.
- Create backups: snapshot or pg_dump of Supabase and export storage metadata.

High-level strategy
1. Prepare staging Neon branch and apply schema (use `migrations/neon_public_schema_pass1.sql` then pass2 guarded). Validate schema and fix drift.
2. Perform an initial logical dump of the Supabase database (custom format) and restore into staging Neon.
3. Verify data integrity (row counts, checksums, key foreign constraints, application smoke tests).
4. Implement incremental replication strategy (choose one):
   - Logical replication (pglogical or pgoutput publications) — preferred for low-downtime but complex across providers.
   - WAL shipping / replication slot to a standby — often not available across providers.
   - Scheduled Delta ETLs (rsync-like copies by updated_at watermark) — simpler, acceptable for moderate datasets.
5. Plan cutover window: final incremental sync, application maintenance mode, switch `PG_CONN` in deployments to Neon, run smoke tests, monitor.

Detailed steps

Stage 0 — Preparation
- Confirm schema applied on Neon: run `psql "$NEON_PG_CONN" -f migrations/neon_public_schema_pass1.sql` then guarded pass2 runner: `node scripts/apply_pass2_safe.js`.
- Export Supabase inventory (functions, triggers, policies, roles) and store in `migrations/supabase_inventory/`.
- Export storage metadata: `SUPABASE_SERVICE_ROLE_KEY=<key> SUPABASE_PROJECT_REF=<ref> node scripts/export_supabase_storage.js`.

-- Auth session token storage note --
The `authjs.sessions` table format is significant for Auth.js/NextAuth compatibility. Before cutover verify the session token storage format:

- Auth.js may store a raw token or a transformed/hashed token (e.g., md5, sha256) depending on adapter versions or configuration.
- If you change token storage (raw -> hashed) you must perform a zero-downtime migration:
  1. Add a new column (e.g., `session_token_hash`) to `authjs.sessions` nullable.
  2. Backfill: compute and populate `session_token_hash` = transform(raw_token) for existing rows in batches.
  3. Update application to attempt lookup by raw token first, then hashed token (dual-read) during transition.
  4. Once traffic shows no failures, flip to single read by hashed token and drop old column.

Ensure the runbook includes explicit SQL snippets for these steps and a verification query that checks new lookups succeed before cutting over.

Stage 1 — Initial data copy
1. Create a dump (custom format):

```bash
SUPABASE_PG_CONN='postgresql://user:pass@db.project.supabase.co:5432/postgres?sslmode=require' \
pg_dump "$SUPABASE_PG_CONN" -Fc -f backups/supabase_init.dump
```

2. Restore to Neon staging branch (test run):

```bash
NEON_PG_CONN='postgresql://user:pass@branch.region.neon.tech:5432/neondb?sslmode=require&channel_binding=require' \
pg_restore --verbose --clean --no-owner --role=<neon_owner_role> -d "$NEON_PG_CONN" backups/supabase_init.dump
```

3. Verify counts and sample rows (see Verification below).

Stage 2 — Incremental sync options
- Option A: Logical replication (recommended when supported)
  - Create publication on Supabase for relevant tables: `CREATE PUBLICATION pub FOR TABLE table1, table2;` (requires provider support)
  - Set up a subscriber on Neon to consume the publication.
  - Validate lag and consistency.
- Option B: Scheduled delta ETL (simpler)
  - Use `updated_at` watermark: copy rows where `updated_at > last_sync` in batches.
  - Apply idempotent upserts into Neon using `INSERT ... ON CONFLICT DO UPDATE`.

Stage 3 — Verification
- Row counts by table (compare `SELECT count(*)` on each table)
- CRC/checksum sampling per-table (e.g., `md5(string_agg(col1||'|'||col2, ',' ORDER BY id))`), pick representative large tables.
- FK and constraint verification: run queries to find orphaned FKs.
- Application smoke tests: login flows, key user journeys, background jobs.

Stage 4 — Cutover
1. Schedule maintenance window and notify stakeholders.
2. Pause writes or put app into read-only mode.
3. Run final incremental sync and verification.
4. Update deployment envs (`PG_CONN`/`DATABASE_URL`) in Vercel/Cloudflare to point to Neon.
5. Run smoke tests and monitor logs, metrics, and error rates.
6. If stable, decommission Supabase resources per policy (snapshot, revoke keys, delete project/buckets).

Rollback Plan
- If data or app errors occur after cutover: revert `PG_CONN` to Supabase snapshot, restore application traffic, and investigate. Keep final Supabase snapshot for a period before deletion.

Verification checklist (quick)
- [ ] Schema present and constraints OK on Neon
- [ ] Data counts match for critical tables
- [ ] Application smoke tests pass on Neon
- [ ] RLS/policies and functions ported or compensated in app
- [ ] Storage assets accessible and verified

Appendices
- Scripts: `scripts/pg_migration_helpers.sh`, `scripts/pg_migration_helpers.ps1`, `scripts/export_supabase_storage.js`, `scripts/export_supabase_inventory.js`, `scripts/export_supabase_policies_and_roles.js`.
- Logs: `migrations/neon_apply_report_pass2.log`, `migrations/neon_pass2_repairs.json`, `migrations/supabase_inventory/`

Contact: migration owner or on-call DB engineer during cutover.
