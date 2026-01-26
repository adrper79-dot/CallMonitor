#!/usr/bin/env bash
set -euo pipefail

# Migration helper for Unix-like shells
# Expects the following env vars to be set (or pass them inline):
# - SUPABASE_PG_CONN (source)
# - NEON_PG_CONN (target)
# - BACKUP_DIR (optional, defaults to ./backups)

BACKUP_DIR=${BACKUP_DIR:-backups}
mkdir -p "$BACKUP_DIR"

timestamp() { date +%Y%m%dT%H%M%SZ; }

usage(){
  cat <<EOF
Usage:
  SUPABASE_PG_CONN=... NEON_PG_CONN=... ./scripts/pg_migration_helpers.sh dump
  SUPABASE_PG_CONN=... NEON_PG_CONN=... ./scripts/pg_migration_helpers.sh restore <dumpfile>
  ./scripts/pg_migration_helpers.sh psql_neon -c "SELECT 1"

Commands:
  dump      Create a compressed custom-format dump from Supabase
  restore   Restore a dump into Neon (careful: may overwrite objects)
  psql_neon Run an arbitrary SQL against Neon using psql
  psql_supabase Run SQL against Supabase
EOF
}

cmd=${1:-}
case "$cmd" in
  dump)
    if [[ -z "${SUPABASE_PG_CONN:-}" ]]; then echo "SUPABASE_PG_CONN required" >&2; exit 2; fi
    file="$BACKUP_DIR/supabase_dump_$(timestamp).dump"
    echo "Creating dump -> $file"
    pg_dump "$SUPABASE_PG_CONN" -Fc -f "$file"
    echo "Dump completed: $file"
    ;;
  restore)
    if [[ -z "${NEON_PG_CONN:-}" ]]; then echo "NEON_PG_CONN required" >&2; exit 2; fi
    if [[ -z "${2:-}" ]]; then echo "Usage: restore <dumpfile>" >&2; exit 2; fi
    dumpfile="$2"
    echo "Restoring $dumpfile into Neon"
    pg_restore --verbose --clean --no-owner --role=$(whoami) -d "$NEON_PG_CONN" "$dumpfile"
    echo "Restore completed"
    ;;
  psql_neon)
    if [[ -z "${NEON_PG_CONN:-}" ]]; then echo "NEON_PG_CONN required" >&2; exit 2; fi
    shift
    psql "$NEON_PG_CONN" "$@"
    ;;
  psql_supabase)
    if [[ -z "${SUPABASE_PG_CONN:-}" ]]; then echo "SUPABASE_PG_CONN required" >&2; exit 2; fi
    shift
    psql "$SUPABASE_PG_CONN" "$@"
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 2
    ;;
esac
