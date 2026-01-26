Param(
    [Parameter(Mandatory=$true)]
    [string]$ConnString,

    [Parameter(Mandatory=$true)]
    [string]$SqlFile
)

$psqlPaths = @("C:\Program Files\PostgreSQL\16\bin\psql.exe", "C:\Program Files\PostgreSQL\15\bin\psql.exe")
$psql = $psqlPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $psql) { $psql = 'psql' }

if (-not (Test-Path $SqlFile)) {
    Write-Error "SQL file not found: $SqlFile"
    exit 2
}

Write-Output "Using psql: $psql"
Write-Output "Running SQL file: $SqlFile"

& $psql $ConnString -v ON_ERROR_STOP=1 -f $SqlFile
$rc = $LASTEXITCODE
if ($rc -ne 0) {
    Write-Error "psql exited with code $rc"
}
exit $rc
