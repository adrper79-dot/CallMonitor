# Manual Testing Script for WordIsBond
# PowerShell script for manual health checks that mirror E2E tests

param(
    [string]$Environment = "production",
    [switch]$Verbose = $false,
    [switch]$AllTests = $false
)

Write-Host "🔍 WordIsBond Manual Testing Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Environment URLs
$urls = @{
    production = "https://wordisbond-production.adrper79.workers.dev"
    staging = "https://wordisbond-staging.adrper79.workers.dev"
    local = "http://localhost:3000"
}

$baseUrl = $urls[$Environment]
if (-not $baseUrl) {
    Write-Host "❌ Unknown environment: $Environment" -ForegroundColor Red
    Write-Host "   Available: production, staging, local" -ForegroundColor Gray
    exit 1
}

Write-Host "Base URL: $baseUrl" -ForegroundColor Gray

# Test results storage
$testResults = @{}

# Function to make HTTP requests with error handling
function Invoke-TestRequest {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$TestName
    )

    Write-Host "`n🧪 Testing: $TestName" -ForegroundColor Magenta
    Write-Host "   $Method $Url" -ForegroundColor Gray

    try {
        $response = if ($Body) {
            Invoke-RestMethod -Uri $Url -Method $Method -Headers $Headers -Body $Body -ContentType "application/json"
        } else {
            Invoke-RestMethod -Uri $Url -Method $Method -Headers $Headers
        }

        Write-Host "✅ Request successful" -ForegroundColor Green
        if ($Verbose) {
            Write-Host "Response: $(ConvertTo-Json $response -Depth 2)" -ForegroundColor Gray
        }
        return @{ success = $true; data = $response }
    }
    catch {
        Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
        return @{ success = $false; error = $_.Exception.Message }
    }
}

# 1. Health Check Test
Write-Host "`n=== 🏥 Health Check Test ===" -ForegroundColor Cyan
$healthResult = Invoke-TestRequest -Url "$baseUrl/api/health" -TestName "System Health Check"
$testResults["health"] = $healthResult.success

if ($healthResult.success -and $healthResult.data.status -eq "healthy") {
    Write-Host "✅ System is healthy" -ForegroundColor Green
    if ($Verbose -and $healthResult.data.bindings) {
        Write-Host "Cloudflare Bindings:" -ForegroundColor Gray
        $healthResult.data.bindings | ForEach-Object {
            Write-Host "  - $($_.name): $($_.status)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "⚠️  System health check issues detected" -ForegroundColor Yellow
}

# 2. Authentication Test
Write-Host "`n=== 🔐 Authentication Test ===" -ForegroundColor Cyan
$authResult = Invoke-TestRequest -Url "$baseUrl/api/auth/signin" -TestName "SignIn Page Access"
$testResults["auth"] = $authResult.success

# 3. Database Connection Test (via API)
Write-Host "`n=== 🗄️  Database Connection Test ===" -ForegroundColor Cyan
$dbResult = Invoke-TestRequest -Url "$baseUrl/api/dashboard" -TestName "Dashboard (DB-dependent endpoint)"
$testResults["database"] = $dbResult.success

# 4. Static Asset Test
Write-Host "`n=== 📦 Static Assets Test ===" -ForegroundColor Cyan
$assetResult = Invoke-TestRequest -Url "$baseUrl/_next/static/css" -TestName "CSS Assets" 2>$null
$testResults["assets"] = $assetResult.success

# 5. API Routes Test
if ($AllTests) {
    Write-Host "`n=== 🔌 API Routes Test ===" -ForegroundColor Cyan
    
    $apiEndpoints = @(
        "/api/voice/calls/start",
        "/api/voice/calls/status",
        "/api/dashboard/stats",
        "/api/settings/organization"
    )

    foreach ($endpoint in $apiEndpoints) {
        $result = Invoke-TestRequest -Url "$baseUrl$endpoint" -TestName "API: $endpoint"
        $testName = "api_" + ($endpoint -replace "/api/", "" -replace "/", "_")
        $testResults[$testName] = $result.success
    }
}

# 6. WebRTC Test (Telnyx connectivity)
Write-Host "`n=== 📞 WebRTC Connectivity Test ===" -ForegroundColor Cyan
try {
    # Test if we can reach Telnyx WebRTC endpoint
    $telnyxHealth = Invoke-RestMethod -Uri "https://wss.telnyx.com" -TimeoutSec 5
    Write-Host "✅ Telnyx connectivity OK" -ForegroundColor Green
    $testResults["webrtc"] = $true
}
catch {
    Write-Host "❌ Telnyx connectivity failed: $($_.Exception.Message)" -ForegroundColor Red
    $testResults["webrtc"] = $false
}

# 7. Edge Performance Test
Write-Host "`n=== ⚡ Edge Performance Test ===" -ForegroundColor Cyan
$perfStart = Get-Date
$perfResult = Invoke-TestRequest -Url "$baseUrl/api/health" -TestName "Performance Timing"
$perfEnd = Get-Date
$responseTime = ($perfEnd - $perfStart).TotalMilliseconds

if ($responseTime -lt 500) {
    Write-Host "✅ Response time: $([math]::Round($responseTime))ms (Excellent)" -ForegroundColor Green
    $testResults["performance"] = $true
} elseif ($responseTime -lt 1000) {
    Write-Host "⚠️  Response time: $([math]::Round($responseTime))ms (Acceptable)" -ForegroundColor Yellow
    $testResults["performance"] = $true
} else {
    Write-Host "❌ Response time: $([math]::Round($responseTime))ms (Too slow)" -ForegroundColor Red
    $testResults["performance"] = $false
}

# 8. CORS Test (for frontend integration)
Write-Host "`n=== 🌐 CORS Test ===" -ForegroundColor Cyan
try {
    $corsHeaders = @{
        "Origin" = "https://wordisbond.com"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "content-type"
    }
    $corsResult = Invoke-WebRequest -Uri "$baseUrl/api/health" -Method OPTIONS -Headers $corsHeaders -UseBasicParsing
    if ($corsResult.Headers["Access-Control-Allow-Origin"]) {
        Write-Host "✅ CORS headers configured" -ForegroundColor Green
        $testResults["cors"] = $true
    } else {
        Write-Host "⚠️  CORS headers not found" -ForegroundColor Yellow
        $testResults["cors"] = $false
    }
}
catch {
    Write-Host "❌ CORS test failed: $($_.Exception.Message)" -ForegroundColor Red
    $testResults["cors"] = $false
}

# Summary Report
Write-Host "`n📊 Manual Test Results Summary" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

$passed = 0
$failed = 0
$total = $testResults.Count

foreach ($test in $testResults.GetEnumerator()) {
    $status = if ($test.Value) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($test.Value) { "Green" } else { "Red" }
    Write-Host "$status $($test.Key)" -ForegroundColor $color
    
    if ($test.Value) { $passed++ } else { $failed++ }
}

Write-Host "`n📈 Overall Results:" -ForegroundColor Cyan
Write-Host "   Total Tests: $total" -ForegroundColor White
Write-Host "   Passed: $passed" -ForegroundColor Green  
Write-Host "   Failed: $failed" -ForegroundColor Red
$passRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }
Write-Host "   Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 80) { "Green" } else { "Yellow" })

# Specific recommendations based on failures
Write-Host "`n🔧 Recommendations:" -ForegroundColor Cyan
if (-not $testResults["health"]) {
    Write-Host "   ❗ Health check failed - Check Cloudflare Workers deployment" -ForegroundColor Yellow
}
if (-not $testResults["database"]) {
    Write-Host "   ❗ Database connection failed - Check Neon DB and Hyperdrive config" -ForegroundColor Yellow
}
if (-not $testResults["performance"]) {
    Write-Host "   ❗ Performance issues - Check CDN caching and edge routing" -ForegroundColor Yellow
}
if (-not $testResults["webrtc"]) {
    Write-Host "   ❗ WebRTC connectivity failed - Check SignalWire configuration" -ForegroundColor Yellow
}

# Exit with appropriate code
if ($passRate -ge 80) {
    Write-Host "`n🎉 System is performing well!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n🚨 System has significant issues that need attention." -ForegroundColor Red
    exit 1
}

# Usage instructions at the end
Write-Host "`n💡 Usage Examples:" -ForegroundColor Cyan
Write-Host "   .\test-manual.ps1                          # Quick production test"
Write-Host "   .\test-manual.ps1 -Environment staging      # Test staging environment"
Write-Host "   .\test-manual.ps1 -AllTests -Verbose       # Comprehensive test with details"
Write-Host "   .\test-manual.ps1 -Environment local       # Test local development" -ForegroundColor Gray