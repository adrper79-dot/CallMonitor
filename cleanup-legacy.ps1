# LEGACY CODE CLEANUP SCRIPT
# Removes all Supabase, Vercel, and SignalWire references

Write-Host "`n🔥 PHASE 1: Removing Legacy Test Files`n" -ForegroundColor Yellow

# Remove test files with legacy dependencies
$testFiles = @(
    "__tests__/crm-integration.test.ts",
    "__tests__/external-entities.test.ts",
    "tests/unit/scoring.test.ts",
    "tests/unit/webhookSecurity.test.ts"
)

foreach ($file in $testFiles) {
    $path = Join-Path $PSScriptRoot $file
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "  ✅ Removed: $file" -ForegroundColor Green
    }
}

Write-Host "`n🔥 PHASE 2: Removing Legacy Documentation`n" -ForegroundColor Yellow

# Remove or archive legacy documentation
$legacyDocs = @(
    "WEBRTC_AUTH_DEBUG.md",
    "ARCH_DOCS/NEON_DATA_MIGRATION_RUNBOOK.md",
    "ARCH_DOCS/NEON_CUTOVER_CHECKLIST.md",
    "docs/DEPLOYMENT.md"
)

foreach ($doc in $legacyDocs) {
    $path = Join-Path $PSScriptRoot $doc
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "  ✅ Removed: $doc" -ForegroundColor Green
    }
}

Write-Host "`n🔥 PHASE 3: Removing Legacy Tools`n" -ForegroundColor Yellow

$legacyTools = @(
    "tools/check_sw_subscribers.ts",
    "tools/run_prod_test.ts",
    "test-signalwire-auth.ps1"
)

foreach ($tool in $legacyTools) {
    $path = Join-Path $PSScriptRoot $tool
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "  ✅ Removed: $tool" -ForegroundColor Green
    }
}

Write-Host "`n🔥 PHASE 4: Cleaning Package Dependencies`n" -ForegroundColor Yellow

# This will require manual review of package.json for:
# - @supabase/* packages
# - @vercel/* packages (keep @vercel/oidc if needed for auth)
# - Any signalwire dependencies

Write-Host "  ⚠️  Manual review needed for package.json`n" -ForegroundColor Yellow
Write-Host "Run: npm uninstall @supabase/supabase-js @supabase/auth-helpers-nextjs @sentry/vercel-edge`n" -ForegroundColor Cyan

Write-Host "`n✅ CLEANUP COMPLETE!`n" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Review changes: git status" -ForegroundColor Cyan
Write-Host "  2. Remove legacy dependencies: npm uninstall <packages>" -ForegroundColor Cyan
Write-Host "  3. Rebuild: npm run build" -ForegroundColor Cyan
Write-Host "  4. Test deployment`n" -ForegroundColor Cyan
