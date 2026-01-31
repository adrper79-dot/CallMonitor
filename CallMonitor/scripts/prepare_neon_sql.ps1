<#
Prepare a Neon-ready SQL file from `migrations/supabase_public_schema.sql`.

What it does:
- Replaces `uuid_generate_v4()` with `gen_random_uuid()`
- Replaces `USER-DEFINED` types with `text`
- Converts `::tool_role_type` to `::text`
- Comments out any `REFERENCES auth.` or `REFERENCES next_auth.` foreign-key lines

Usage (PowerShell):
  .\scripts\prepare_neon_sql.ps1

Output:
  migrations\neon_ready_schema.sql
#>

Param(
    [string]$Input = (Join-Path $PSScriptRoot "..\migrations\supabase_public_schema.sql"),
    [string]$Output = (Join-Path $PSScriptRoot "..\migrations\neon_ready_schema.sql")
)

if (-not (Test-Path $Input)) {
    Write-Error "Input schema not found: $Input"
    exit 1
}

$content = Get-Content -Raw -Path $Input -ErrorAction Stop

# Simple textual replacements
$content = $content -replace 'uuid_generate_v4\(\)', 'gen_random_uuid()'
$content = $content -replace 'USER-DEFINED', 'text'
$content = $content -replace '::tool_role_type', '::text'

# Comment out external schema foreign key references (auth.*, next_auth.*)
$lines = $content -split "\r?\n"
$out = for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line -match 'REFERENCES\s+(auth|next_auth)\.') {
        "-- $line"
    } else {
        $line
    }
}

$outText = $out -join "`n"

Set-Content -Path $Output -Value $outText -Encoding UTF8

Write-Host "Prepared Neon-ready schema: $Output"
