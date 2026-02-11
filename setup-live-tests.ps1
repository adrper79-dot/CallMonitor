#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Setup and validate live E2E testing infrastructure for Word Is Bond platform.

.DESCRIPTION
  Provisions test users in Neon PostgreSQL, validates SignalWire configuration,
  and runs comprehensive health checks before executing voice E2E tests.

.PARAMETER SkipSetup
  Skip test user provisioning (use if already created)

.PARAMETER SkipValidation
  Skip health checks (use for quick test runs)

.PARAMETER EnableLiveCalls
  Enable real phone calls during tests (COSTS MONEY)

.EXAMPLE
  .\setup-live-tests.ps1
  # Full setup + validation (no live calls)

.EXAMPLE
  .\setup-live-tests.ps1 -SkipSetup -EnableLiveCalls
  # Run live voice tests without reprovisioning users
#>

param(
  [switch]$SkipSetup,
  [switch]$SkipValidation,
  [switch]$EnableLiveCalls
)

$ErrorActionPreference = "Stop"

# ── Configuration ──────────────────────────────────────────────────────────

$ENV_FILE = "tests\.env.production"
$SETUP_SQL = "tests\setup-test-users.sql"
$TEST_FILE = "tests\production\voice-e2e.test.ts"

Write-Host "`n🚀 Word Is Bond — Live E2E Test Setup`n" -ForegroundColor Cyan

# ── Load Environment ───────────────────────────────────────────────────────

if (-not (Test-Path $ENV_FILE)) {
  Write-Error "❌ Environment file not found: $ENV_FILE"
  exit 1
}

Write-Host "📋 Loading environment from $ENV_FILE..." -ForegroundColor Gray

Get-Content $ENV_FILE | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') {
    $key = $matches[1].Trim()
    $value = $matches[2].Trim()
    [Environment]::SetEnvironmentVariable($key, $value, "Process")
  }
}

$DB_URL = $env:DATABASE_URL
$API_URL = $env:API_URL
$SIGNALWIRE_PROJECT = $env:SIGNALWIRE_PROJECT_ID
$SIGNALWIRE_TOKEN = $env:SIGNALWIRE_TOKEN
$TEST_ORG = $env:TEST_ORG_ID
$TEST_USER_1 = $env:TEST_USER_ID
$TEST_USER_2 = $env:TEST_USER_2_ID
$PRIMARY_PHONE = $env:SIGNALWIRE_NUMBER_PRIMARY
$SECONDARY_PHONE = $env:SIGNALWIRE_NUMBER_SECONDARY

if (-not $DB_URL) {
  Write-Error "❌ DATABASE_URL not configured in $ENV_FILE"
  exit 1
}

Write-Host "   ✅ Environment loaded" -ForegroundColor Green
Write-Host "      Database: $($DB_URL.Substring(0, 30))..." -ForegroundColor Gray
Write-Host "      API: $API_URL" -ForegroundColor Gray
Write-Host "      SignalWire: Project $SIGNALWIRE_PROJECT" -ForegroundColor Gray
Write-Host "      Test Org: $TEST_ORG" -ForegroundColor Gray

# ── Install psql if needed ─────────────────────────────────────────────────

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Warning "⚠️  psql not found. Install PostgreSQL client to provision users."
  Write-Host "   Download: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
  
  if (-not $SkipSetup) {
    $response = Read-Host "Continue without DB setup? (y/N)"
    if ($response -ne 'y') {
      exit 1
    }
    $SkipSetup = $true
  }
}

# ── Provision Test Users ───────────────────────────────────────────────────

if (-not $SkipSetup) {
  Write-Host "`n📦 Provisioning test users in database..." -ForegroundColor Cyan
  
  if (-not (Test-Path $SETUP_SQL)) {
    Write-Error "❌ Setup script not found: $SETUP_SQL"
    exit 1
  }
  
  try {
    $result = psql $DB_URL -f $SETUP_SQL 2>&1
    
    if ($LASTEXITCODE -ne 0) {
      Write-Error "❌ Database provisioning failed:`n$result"
      exit 1
    }
    
    Write-Host "   ✅ Test users created" -ForegroundColor Green
    Write-Host "      User 1: $TEST_USER_1 (Owner)" -ForegroundColor Gray
    Write-Host "      User 2: $TEST_USER_2 (Admin)" -ForegroundColor Gray
    Write-Host "      Org: $TEST_ORG" -ForegroundColor Gray
    Write-Host "      Phones: $PRIMARY_PHONE, $SECONDARY_PHONE" -ForegroundColor Gray
  }
  catch {
    Write-Error "❌ Failed to run setup script: $_"
    exit 1
  }
} else {
  Write-Host "`n⏭️  Skipping user provisioning (use -SkipSetup=`$false to enable)" -ForegroundColor Yellow
}

# ── Validate Database ──────────────────────────────────────────────────────

if (-not $SkipValidation) {
  Write-Host "`n🔍 Validating database configuration..." -ForegroundColor Cyan
  
  # Check users exist
  $users_query = @"
SELECT id, email, name FROM users 
WHERE id IN ('$TEST_USER_1', '$TEST_USER_2')
ORDER BY id;
"@
  
  Write-Host "   Checking test users..." -ForegroundColor Gray
  $users_result = psql $DB_URL -t -c $users_query 2>&1
  
  if ($users_result -match $TEST_USER_1 -and $users_result -match $TEST_USER_2) {
    Write-Host "   ✅ Test users found" -ForegroundColor Green
  } else {
    Write-Warning "⚠️  Test users not found. Run without -SkipSetup to create them."
  }
  
  # Check organization
  $org_query = "SELECT name FROM organizations WHERE id = '$TEST_ORG';"
  $org_result = psql $DB_URL -t -c $org_query 2>&1
  
  if ($org_result -match "Test Organization") {
    Write-Host "   ✅ Test organization configured" -ForegroundColor Green
  } else {
    Write-Warning "⚠️  Test organization not found"
  }
  
  # Check phone numbers
  $phone_query = @"
SELECT phone_number, capabilities 
FROM phone_numbers 
WHERE organization_id = '$TEST_ORG'
ORDER BY phone_number;
"@
  
  $phone_result = psql $DB_URL -t -c $phone_query 2>&1
  
  if ($phone_result -match $PRIMARY_PHONE.Replace('+', '\+')) {
    Write-Host "   ✅ SignalWire phone numbers provisioned" -ForegroundColor Green
  } else {
    Write-Warning "⚠️  Phone numbers not configured"
  }
  
  # Check voice config
  $voice_query = @"
SELECT provider, project_id 
FROM voice_configs 
WHERE organization_id = '$TEST_ORG';
"@
  
  $voice_result = psql $DB_URL -t -c $voice_query 2>&1
  
  if ($voice_result -match "signalwire" -and $voice_result -match $SIGNALWIRE_PROJECT) {
    Write-Host "   ✅ Voice provider configured (SignalWire)" -ForegroundColor Green
  } else {
    Write-Warning "⚠️  Voice configuration incomplete"
  }
}

# ── Validate API ───────────────────────────────────────────────────────────

if (-not $SkipValidation) {
  Write-Host "`n🌐 Validating API connectivity..." -ForegroundColor Cyan
  
  try {
    $health = Invoke-RestMethod -Uri "$API_URL/health" -Method GET -TimeoutSec 10
    Write-Host "   ✅ API reachable: $API_URL" -ForegroundColor Green
    Write-Host "      Status: $($health.status)" -ForegroundColor Gray
  }
  catch {
    Write-Warning "⚠️  API health check failed: $_"
  }
  
  # Test authentication
  Write-Host "   Testing authentication..." -ForegroundColor Gray
  
  $login_body = @{
    email = "test-user-001@wordis-bond.com"
    password = "TestPass123!"
  } | ConvertTo-Json
  
  try {
    $auth = Invoke-RestMethod `
      -Uri "$API_URL/api/auth/login" `
      -Method POST `
      -Body $login_body `
      -ContentType "application/json" `
      -TimeoutSec 10
    
    if ($auth.sessionToken) {
      Write-Host "   ✅ Authentication working" -ForegroundColor Green
      [Environment]::SetEnvironmentVariable("TEST_SESSION_TOKEN", $auth.sessionToken, "Process")
    } else {
      Write-Warning "⚠️  No session token returned"
    }
  }
  catch {
    Write-Warning "⚠️  Authentication failed: $_"
  }
}

# ── Validate SignalWire ────────────────────────────────────────────────────

if (-not $SkipValidation) {
  Write-Host "`n📞 Validating SignalWire configuration..." -ForegroundColor Cyan
  
  $sw_auth = [Convert]::ToBase64String(
    [Text.Encoding]::ASCII.GetBytes("${SIGNALWIRE_PROJECT}:${SIGNALWIRE_TOKEN}")
  )
  
  try {
    $sw_numbers = Invoke-RestMethod `
      -Uri "https://$($env:SIGNALWIRE_SPACE)/api/relay/rest/phone_numbers" `
      -Method GET `
      -Headers @{ Authorization = "Basic $sw_auth" } `
      -TimeoutSec 10
    
    $primary_found = $sw_numbers.data | Where-Object { $_.number -eq $PRIMARY_PHONE }
    $secondary_found = $sw_numbers.data | Where-Object { $_.number -eq $SECONDARY_PHONE }
    
    if ($primary_found -and $secondary_found) {
      Write-Host "   ✅ SignalWire phone numbers active" -ForegroundColor Green
      Write-Host "      Primary: $PRIMARY_PHONE ($($primary_found.capabilities -join ', '))" -ForegroundColor Gray
      Write-Host "      Secondary: $SECONDARY_PHONE ($($secondary_found.capabilities -join ', '))" -ForegroundColor Gray
    } else {
      Write-Warning "⚠️  Phone numbers not found in SignalWire account"
    }
  }
  catch {
    Write-Warning "⚠️  Could not verify SignalWire numbers: $_"
  }
}

# ── Run Tests ──────────────────────────────────────────────────────────────

Write-Host "`n🧪 Running E2E Voice Tests..." -ForegroundColor Cyan

if ($EnableLiveCalls) {
  Write-Host ""
  Write-Warning "⚠️  LIVE CALLS ENABLED — THIS WILL COST MONEY ⚠️"
  Write-Host "   Real phone calls will be made via SignalWire" -ForegroundColor Yellow
  Write-Host "   Estimated cost: ~`$0.60 per test run" -ForegroundColor Yellow
  Write-Host ""
  
  $confirm = Read-Host "Proceed with live phone calls? (yes/NO)"
  if ($confirm -ne 'yes') {
    Write-Host "   Test run cancelled" -ForegroundColor Gray
    exit 0
  }
  
  [Environment]::SetEnvironmentVariable("ENABLE_LIVE_VOICE_TESTS", "true", "Process")
  [Environment]::SetEnvironmentVariable("TEST_CALL_DURATION", "30", "Process")
  
  Write-Host "   🔴 LIVE MODE ACTIVE" -ForegroundColor Red
} else {
  Write-Host "   🟡 STUB MODE (no live calls)" -ForegroundColor Yellow
  Write-Host "      Use -EnableLiveCalls to make real calls" -ForegroundColor Gray
  [Environment]::SetEnvironmentVariable("ENABLE_LIVE_VOICE_TESTS", "false", "Process")
}

Write-Host ""

try {
  npm run test:production -- voice-e2e
  
  if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ All tests passed!`n" -ForegroundColor Green
  } else {
    Write-Host "`n❌ Some tests failed (exit code: $LASTEXITCODE)`n" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}
catch {
  Write-Error "❌ Test execution failed: $_"
  exit 1
}

# ── Summary ────────────────────────────────────────────────────────────────

Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "Test Infrastructure Ready" -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "Users: test-user-001 (Owner), test-user-002 (Admin)"
Write-Host "Org: $TEST_ORG"
Write-Host "Phones: $PRIMARY_PHONE, $SECONDARY_PHONE"
Write-Host "Provider: SignalWire (Project: $SIGNALWIRE_PROJECT)"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Review test results above"
Write-Host "  2. Check call logs in SignalWire dashboard"
Write-Host "  3. Verify recordings/transcriptions in database"
Write-Host "  4. Run with -EnableLiveCalls for full validation"
Write-Host ""
Write-Host "Documentation: tests/LIVE_TESTING_GUIDE.md" -ForegroundColor Gray
Write-Host "──────────────────────────────────────────────────────────`n" -ForegroundColor Gray
