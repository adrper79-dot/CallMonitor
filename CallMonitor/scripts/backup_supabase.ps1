<#
Backup helper for Supabase (PowerShell).
Set environment variable `SUPABASE_PG_CONN` to the Supabase Postgres connection string.
Optionally set `SUPABASE_BUCKET_URL` and `SUPABASE_BUCKET_API_KEY` to export storage assets.
#>
param(
  [string]$OutDir = "migrations/backups"
)

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

if (-not $env:SUPABASE_PG_CONN) {
  Write-Error "Please set SUPABASE_PG_CONN environment variable to the Supabase PG connection string."
  exit 2
}

$timestamp = (Get-Date).ToString('yyyyMMddHHmmss')
$schemaFile = Join-Path $OutDir "supabase_schema_$timestamp.sql"
$dataFile = Join-Path $OutDir "supabase_data_$timestamp.sql"

Write-Output "Preparing logical backups to: $OutDir"

# Export schema
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
  Write-Output "Running pg_dump --schema-only"
  pg_dump --schema-only --dbname="$env:SUPABASE_PG_CONN" -f $schemaFile
} else {
  Write-Warning "pg_dump not found in PATH. Save the following command and run on a machine with pg_dump installed:" 
  Write-Output "pg_dump --schema-only --dbname=\"$env:SUPABASE_PG_CONN\" -f $schemaFile"
}

# Export data
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
  Write-Output "Running pg_dump --data-only"
  pg_dump --data-only --dbname="$env:SUPABASE_PG_CONN" -f $dataFile
} else {
  Write-Warning "pg_dump not found in PATH. Save the following command and run on a machine with pg_dump installed:" 
  Write-Output "pg_dump --data-only --dbname=\"$env:SUPABASE_PG_CONN\" -f $dataFile"
}

Write-Output "Backups prepared:"
Write-Output "  Schema: $schemaFile"
Write-Output "  Data:   $dataFile"

if ($env:SUPABASE_BUCKET_URL -and $env:SUPABASE_BUCKET_API_KEY) {
  Write-Output "Bucket export configured — implement provider-specific download here."
  # Placeholder: implement storage copy using provider API / CLI if desired.
}

Write-Output "Done."
