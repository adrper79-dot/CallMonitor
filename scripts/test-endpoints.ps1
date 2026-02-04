# Test API Endpoints with curl
# Usage: .\scripts\test-endpoints.ps1 <session_token>

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$BaseUrl = "https://wordisbond-api.adrper79.workers.dev"
$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

Write-Host "Testing API Endpoints..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Health check
Write-Host "1. Health Check (GET /api/health)" -ForegroundColor Yellow
curl -s "$BaseUrl/api/health" | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""

# Test 2: Current organization
Write-Host "2. Current Organization (GET /api/organizations/current)" -ForegroundColor Yellow
$orgResponse = curl -s -H "Authorization: Bearer $Token" "$BaseUrl/api/organizations/current"
$orgResponse | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""

# Test 3: Audit logs
Write-Host "3. Audit Logs (GET /api/audit-logs)" -ForegroundColor Yellow
curl -s -H "Authorization: Bearer $Token" "$BaseUrl/api/audit-logs" | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""

# Test 4: WebRTC token
Write-Host "4. WebRTC Token (GET /api/webrtc/token)" -ForegroundColor Yellow
curl -s -H "Authorization: Bearer $Token" "$BaseUrl/api/webrtc/token" | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""

# Test 5: Calls list
Write-Host "5. Calls List (GET /api/calls)" -ForegroundColor Yellow
curl -s -H "Authorization: Bearer $Token" "$BaseUrl/api/calls" | ConvertFrom-Json | ConvertTo-Json -Depth 10
Write-Host ""

Write-Host "Testing complete!" -ForegroundColor Green
