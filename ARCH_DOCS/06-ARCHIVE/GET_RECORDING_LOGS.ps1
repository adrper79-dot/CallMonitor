# PowerShell script to get relevant logs
# Run this to see recording-related logs

Write-Host "🔍 Checking Vercel logs for recording activity..." -ForegroundColor Cyan
Write-Host ""

# Get latest deployment
Write-Host "📦 Getting latest deployment..." -ForegroundColor Yellow
vercel ls --limit 1

Write-Host ""
Write-Host "Now manually check logs in Vercel Dashboard:" -ForegroundColor Green
Write-Host "1. Go to: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Click your project" -ForegroundColor White
Write-Host "3. Click 'Logs' tab" -ForegroundColor White
Write-Host "4. Search for these terms (one at a time):" -ForegroundColor White
Write-Host ""
Write-Host "   Search Term 1: 'RECORDING ENABLED'" -ForegroundColor Cyan
Write-Host "   Expected: Should see 'placeSignalWireCall: RECORDING ENABLED { Record: 'true' }'" -ForegroundColor Gray
Write-Host ""
Write-Host "   Search Term 2: 'FULL REST API REQUEST'" -ForegroundColor Cyan
Write-Host "   Expected: Should see hasRecord: true, recordValue: 'true'" -ForegroundColor Gray
Write-Host ""
Write-Host "   Search Term 3: 'webhook processing'" -ForegroundColor Cyan
Write-Host "   Expected: Multiple entries for call status updates" -ForegroundColor Gray
Write-Host ""
Write-Host "   Search Term 4: 'RECORDING DETECTED'" -ForegroundColor Cyan
Write-Host "   Expected: If recording worked, should see recording URL" -ForegroundColor Gray
Write-Host ""
Write-Host "   Search Term 5: 'NO RECORDING FIELDS'" -ForegroundColor Cyan
Write-Host "   Expected: If recording failed, should see this WARNING" -ForegroundColor Gray
Write-Host ""
Write-Host "   Search Term 6: 'created recording'" -ForegroundColor Cyan
Write-Host "   Expected: If DB insert worked, should see recording ID" -ForegroundColor Gray
Write-Host ""

Write-Host "Press Enter to open Vercel dashboard in browser..."
Read-Host
Start-Process "https://vercel.com/dashboard"
