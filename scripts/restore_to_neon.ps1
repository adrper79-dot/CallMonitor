<#
Restores `migrations/supabase_public_schema.sql` into a Neon/Postgres database.

Usage (PowerShell):
  $env:NEON_CONN = "postgresql://user:pass@host:5432/dbname?sslmode=require"
  .\scripts\restore_to_neon.ps1

Or pass connection string directly:
  .\scripts\restore_to_neon.ps1 -NeonConn "postgresql://..."

Notes:
- Ensure `psql` is installed and on `PATH`.
- This script does not supply or manage secrets; provide a connection string with credentials or set `NEON_CONN`.
#>

param(
  [string]$NeonConn = $env:NEON_CONN,
  [string]$SchemaFile = Join-Path $PSScriptRoot "..\migrations\supabase_public_schema.sql"
)

if (-not $NeonConn) {
  Write-Error "NEON_CONN not set and no -NeonConn provided. Set environment variable or pass parameter."
  exit 1
}

if (-not (Test-Path $SchemaFile)) {
  Write-Error "Schema file not found: $SchemaFile"
  exit 1
}

Write-Host "Restoring schema file: $SchemaFile"
Write-Host "Target connection: (hidden)"

try {
  & psql $NeonConn -f $SchemaFile
  if ($LASTEXITCODE -ne 0) {
    Write-Error "psql exited with code $LASTEXITCODE"
    exit $LASTEXITCODE
  }
  Write-Host "Restore completed."
} catch {
  Write-Error "Restore failed: $_"
  exit 1
}
