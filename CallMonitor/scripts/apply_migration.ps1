param(
  [string]$MigrationPath = "migrations/2026-01-10-add-voice-configs.sql"
)

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL environment variable is required. Example: postgres://user:pass@host:5432/dbname"
  exit 1
}

$full = Join-Path $PSScriptRoot ".." | Resolve-Path -Relative
$sql = Join-Path $PSScriptRoot "..\$MigrationPath"
if (-not (Test-Path $sql)) {
  Write-Error "Migration file not found: $sql"
  exit 1
}

Write-Output "Applying migration: $sql"
& psql $env:DATABASE_URL -f $sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
