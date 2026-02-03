# E2E Test Harness for WordIsBond
# PowerShell script for comprehensive testing

param(
    [string]$TestType = "all",
    [switch]$Coverage = $false,
    [switch]$Verbose = $false
)

Write-Host "🧪 WordIsBond E2E Test Harness" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Load test environment
if (Test-Path ".env.test") {
    Write-Host "✅ Loading .env.test environment" -ForegroundColor Green
    Get-Content ".env.test" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            Set-Item -Path "env:$($matches[1])" -Value $matches[2]
        }
    }
} else {
    Write-Host "⚠️  No .env.test found, using default test environment" -ForegroundColor Yellow
    $env:NODE_ENV = "test"
    $env:TEST_ORG_ID = "5f64d900-e212-42ab-bf41-7518f0bbcd4f"
    $env:TEST_USER_ID = "test-user-123"
}

# Function to run tests with proper error handling
function Invoke-TestSuite {
    param(
        [string]$SuiteName,
        [string]$TestPattern,
        [string]$Description
    )
    
    Write-Host "`n🔍 $SuiteName Tests" -ForegroundColor Magenta
    Write-Host "   $Description" -ForegroundColor Gray
    Write-Host "   Pattern: $TestPattern" -ForegroundColor Gray
    
    $startTime = Get-Date
    
    try {
        if ($Coverage) {
            npx vitest $TestPattern --run --coverage --reporter=verbose
        } else {
            npx vitest $TestPattern --run --reporter=basic
        }
        
        $duration = (Get-Date) - $startTime
        Write-Host "✅ $SuiteName completed in $($duration.TotalSeconds)s" -ForegroundColor Green
        return $true
    }
    catch {
        $duration = (Get-Date) - $startTime
        Write-Host "❌ $SuiteName failed after $($duration.TotalSeconds)s" -ForegroundColor Red
        if ($Verbose) {
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        }
        return $false
    }
}

# Test execution based on type
$results = @{}

if ($TestType.ToLower() -eq "tier1") {
    Write-Host "🎯 Running Tier 1 (Core Features) Tests Only" -ForegroundColor Yellow
    $results["tier1"] = Invoke-TestSuite "Tier 1 Core" "tests/tier1-core.test.ts" "Core application features and utilities"
}
elseif ($TestType.ToLower() -eq "integration") {
    Write-Host "🔗 Running Integration Tests Only" -ForegroundColor Yellow
    $results["startCall"] = Invoke-TestSuite "Start Call Flow" "tests/integration/startCallFlow.test.ts" "Call initiation and setup workflow"
    $results["webhook"] = Invoke-TestSuite "Webhook Flow" "tests/integration/webhookFlow.test.ts" "SignalWire webhook processing"
    $results["callExecution"] = Invoke-TestSuite "Call Execution" "tests/integration/callExecutionFlow.test.ts" "End-to-end call execution"
}
elseif ($TestType.ToLower() -eq "unit") {
    Write-Host "🧩 Running Unit Tests Only" -ForegroundColor Yellow
    $results["unit"] = Invoke-TestSuite "Unit Tests" "tests/unit/*.test.ts" "Individual component and function tests"
}
elseif ($TestType.ToLower() -eq "failing") {
    Write-Host "🚨 Running Previously Failing Tests" -ForegroundColor Red
    Write-Host "   Focusing on tests that were breaking in the analysis" -ForegroundColor Gray
    
    # Run specific failing tests identified in the analysis
    $results["compliance"] = Invoke-TestSuite "Compliance" "__tests__/compliance.test.ts" "Database compliance and security tests"
    $results["crm"] = Invoke-TestSuite "CRM Integration" "__tests__/crm-integration.test.ts" "CRM system integration tests"
    $results["translation"] = Invoke-TestSuite "Translation" "tests/unit/translation.test.ts" "Text translation functionality"
    $results["startCallHandler"] = Invoke-TestSuite "Start Call Handler" "tests/unit/startCallHandler.test.ts" "Call initiation handler unit tests"
}
else {
    Write-Host "🏁 Running Full Test Suite" -ForegroundColor Yellow
    
    # Tier 1 - Core features (should always pass)
    $results["tier1"] = Invoke-TestSuite "Tier 1 Core" "tests/tier1-core.test.ts" "Core application features and utilities"
    
    # Unit tests
    $results["unit"] = Invoke-TestSuite "Unit Tests" "tests/unit/*.test.ts" "Individual component and function tests"
    
    # Integration tests
    $results["integration"] = Invoke-TestSuite "Integration Tests" "tests/integration/*.test.ts" "Cross-component workflow tests"
    
    # Legacy tests (may have issues)
    $results["legacy"] = Invoke-TestSuite "Legacy Tests" "__tests__/*.test.ts" "Legacy test suite (may need updates)"
}

# Summary Report
Write-Host "`n📊 Test Results Summary" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

$passed = 0
$failed = 0
$total = $results.Count

foreach ($test in $results.GetEnumerator()) {
    $status = if ($test.Value) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($test.Value) { "Green" } else { "Red" }
    Write-Host "$status $($test.Key)" -ForegroundColor $color
    
    if ($test.Value) { $passed++ } else { $failed++ }
}

Write-Host "`n📈 Overall Results:" -ForegroundColor Cyan
Write-Host "   Total Suites: $total" -ForegroundColor White
Write-Host "   Passed: $passed" -ForegroundColor Green  
Write-Host "   Failed: $failed" -ForegroundColor Red
$passRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }
Write-Host "   Pass Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 80) { "Green" } else { "Yellow" })

# Health check if tests are passing
if ($passRate -ge 80 -and $TestType -eq "all") {
    Write-Host "`n🏥 Running Health Check..." -ForegroundColor Cyan
    try {
        $healthResponse = curl -s "https://wordisbond-production.adrper79.workers.dev/api/health" | ConvertFrom-Json
        if ($healthResponse.status -eq "healthy") {
            Write-Host "✅ Production health check passed" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Production health check shows: $($healthResponse.status)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "❌ Production health check failed" -ForegroundColor Red
    }
}

# Exit with appropriate code
if ($failed -eq 0) {
    Write-Host "`n🎉 All tests passed! Ready for production." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n🔧 Some tests failed. Check logs above for details." -ForegroundColor Yellow
    exit 1
}