param(
  [string]$Command,
  [string]$Arg
)

# PowerShell migration helper
if (-not (Test-Path -Path ./backups)) { New-Item -ItemType Directory -Path ./backups | Out-Null }

function Timestamp { Get-Date -Format yyyyMMddTHHmmssZ }

switch ($Command) {
  'dump' {
    if (-not $env:SUPABASE_PG_CONN) { Write-Error 'SUPABASE_PG_CONN required'; exit 2 }
    $file = "backups/supabase_dump_$(Timestamp).dump"
    Write-Host "Creating dump -> $file"
    & pg_dump $env:SUPABASE_PG_CONN -Fc -f $file
    Write-Host "Dump completed: $file"
  }
  'restore' {
    if (-not $env:NEON_PG_CONN) { Write-Error 'NEON_PG_CONN required'; exit 2 }
    if (-not $Arg) { Write-Error 'Usage: ./pg_migration_helpers.ps1 restore <dumpfile>'; exit 2 }
    Write-Host "Restoring $Arg into Neon"
    & pg_restore --verbose --clean --no-owner --role $env:USERNAME -d $env:NEON_PG_CONN $Arg
    Write-Host "Restore completed"
  }
  'psql_neon' {
    if (-not $env:NEON_PG_CONN) { Write-Error 'NEON_PG_CONN required'; exit 2 }
    & psql $env:NEON_PG_CONN
  }
  'psql_supabase' {
    if (-not $env:SUPABASE_PG_CONN) { Write-Error 'SUPABASE_PG_CONN required'; exit 2 }
    & psql $env:SUPABASE_PG_CONN
  }
  default {
    Write-Host "Usage: ./pg_migration_helpers.ps1 <dump|restore|psql_neon|psql_supabase> [arg]"
  }
}
