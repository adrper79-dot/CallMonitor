# Migration helpers

This folder contains cross-platform helper scripts to create logical dumps from Supabase and restore them into Neon, plus convenience wrappers for `psql`.

Files:

- `pg_migration_helpers.sh` — Bash script for Unix-like environments. Usage examples:

```bash
# Create a dump from Supabase
SUPABASE_PG_CONN='postgresql://user:pass@db.project.supabase.co:5432/postgres?sslmode=require' ./scripts/pg_migration_helpers.sh dump

# Restore into Neon
NEON_PG_CONN='postgresql://user:pass@branch.region.neon.tech:5432/neondb?sslmode=require&channel_binding=require' ./scripts/pg_migration_helpers.sh restore backups/supabase_dump_20260124T120000Z.dump

# Run a query against Neon
NEON_PG_CONN='...' ./scripts/pg_migration_helpers.sh psql_neon -c "SELECT count(*) FROM public.users;"
```

- `pg_migration_helpers.ps1` — PowerShell equivalent for Windows. Examples:

```powershell
$env:SUPABASE_PG_CONN='postgresql://user:pass@db.project.supabase.co:5432/postgres?sslmode=require'
.\scripts\pg_migration_helpers.ps1 dump

$env:NEON_PG_CONN='postgresql://user:pass@branch.region.neon.tech:5432/neondb?sslmode=require&channel_binding=require'
.\scripts\pg_migration_helpers.ps1 restore backups\supabase_dump_20260124T120000Z.dump
```

Security notes:
- These scripts do not store keys in source control. Use environment variables or a secure secret store in CI.
- Test restores in a staging Neon branch before applying in production.
