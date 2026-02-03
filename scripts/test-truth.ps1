# WordIsBond Truth Script - PowerShell Version
# Tiered Test Runs + Health Checks for Windows

param(
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false
)

Write-Host "🎯 WordIsBond Truth Script - Tiered Testing" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Test results tracking
$results = @()
$failed = 0

# Function to run test tier and track results
function Invoke-TestTier {
    param(
        [string]$TierName,
        [string]$TestCommand,
        [string]$Description
    )
    
    Write-Host "`n🧪 Testing: $TierName" -ForegroundColor Magenta
    Write-Host "   $Description" -ForegroundColor Gray
    
    try {
        $output = Invoke-Expression $TestCommand 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $TierName PASSED" -ForegroundColor Green
            $script:results += "✅ $TierName"
            return $true
        } else {
            Write-Host "❌ $TierName FAILED" -ForegroundColor Red
            if ($Verbose) {
                Write-Host "Output: $output" -ForegroundColor Yellow
            }
            $script:results += "❌ $TierName"
            $script:failed++
            return $false
        }
    }
    catch {
        Write-Host "❌ $TierName ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $script:results += "❌ $TierName (Error)"
        $script:failed++
        return $false
    }
}

# Tier 1: Core Infrastructure (Must Always Pass)
Invoke-TestTier -TierName "Tier 1: Core" `
    -TestCommand "npx vitest tests/tier1-core.test.ts --run" `
    -Description "Basic utilities, environment, mocking infrastructure"

# Tier 2: Unit Tests
Invoke-TestTier -TierName "Tier 2: Units" `
    -TestCommand "npx vitest tests/unit/*.test.ts --run" `
    -Description "Individual component and function tests"

# Tier 3: Integration Tests  
Invoke-TestTier -TierName "Tier 3: Integration" `
    -TestCommand "npx vitest tests/integration/*.test.ts --run" `
    -Description "Cross-component workflow tests"

# Tier 4: Production Health
Write-Host "`n🏥 Health Checks" -ForegroundColor Magenta

# Local health (if running)
try {
    $localHealth = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 3
    Write-Host "✅ Local health check passed" -ForegroundColor Green
    $results += "✅ Local Health"
}
catch {
    Write-Host "⚠️  Local dev server not running (expected)" -ForegroundColor Yellow
    $results += "⚠️  Local Health (N/A)"
}

# Production health
try {
    $prodHealth = Invoke-RestMethod -Uri "https://wordisbond-production.adrper79.workers.dev/api/health" -TimeoutSec 10
    if ($prodHealth.status -eq "healthy") {
        Write-Host "✅ Production health check passed" -ForegroundColor Green
        $results += "✅ Production Health"
    } else {
        Write-Host "⚠️  Production health check shows: $($prodHealth.status)" -ForegroundColor Yellow
        $results += "⚠️  Production Health ($($prodHealth.status))"
    }
}
catch {
    Write-Host "❌ Production health check failed: $($_.Exception.Message)" -ForegroundColor Red
    $results += "❌ Production Health"
    $failed++
}

# Tier 5: Deployment Validation (if build not skipped)
if (-not $SkipBuild) {
    try {
        Write-Host "`n🚀 Deployment Check" -ForegroundColor Magenta
        $dryRun = wrangler deploy --dry-run 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Deploy configuration valid" -ForegroundColor Green
            $results += "✅ Deploy Check"
        } else {
            Write-Host "❌ Deploy configuration invalid" -ForegroundColor Red
            if ($Verbose) {
                Write-Host "Wrangler output: $dryRun" -ForegroundColor Yellow
            }
            $results += "❌ Deploy Check"
            $failed++
        }
    }
    catch {
        Write-Host "❌ Deploy check failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += "❌ Deploy Check"
        $failed++
    }
} else {
    Write-Host "`n🚀 Deployment Check SKIPPED" -ForegroundColor Yellow
    $results += "⚠️  Deploy Check (Skipped)"
}

# Summary Report
Write-Host "`n📊 Truth Script Results" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

foreach ($result in $results) {
    if ($result -match "❌") {
        Write-Host $result -ForegroundColor Red
    } elseif ($result -match "⚠️") {
        Write-Host $result -ForegroundColor Yellow
    } else {
        Write-Host $result -ForegroundColor Green
    }
}

$total = $results.Count
$passed = $total - $failed
$passRate = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

Write-Host "`nOverall: $passed/$total passed ($passRate%)" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "All tests passed! Ready for deployment." -ForegroundColor Green
    exit 0
} elseif ($passRate -ge 80) {
    Write-Host "Most tests passed. Review failures before deploy." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "Significant test failures. Do not deploy." -ForegroundColor Red
    exit 1
}