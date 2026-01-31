# Test SignalWire Relay API Credentials
# PowerShell script for Windows

# Read environment variables
$envFile = ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$PROJECT_ID = $env:SIGNALWIRE_PROJECT_ID -replace '"', ''
$TOKEN = $env:SIGNALWIRE_TOKEN -replace '"', ''
$SPACE = $env:SIGNALWIRE_SPACE -replace '"', ''

if (!$PROJECT_ID -or !$TOKEN -or !$SPACE) {
    Write-Host "ERROR: Missing SignalWire credentials in .env.local" -ForegroundColor Red
    Write-Host "Required: SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN, SIGNALWIRE_SPACE"
    exit 1
}

# Normalize space name - remove https:// and .signalwire.com
$spaceName = $SPACE -replace '^https?://', '' -replace '\.signalwire\.com.*$', ''
$domain = "$spaceName.signalwire.com"

Write-Host "Testing SignalWire Relay API..." -ForegroundColor Cyan
Write-Host "Domain: $domain"
Write-Host "Project ID: $PROJECT_ID"
Write-Host ""

# Create Basic Auth
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${PROJECT_ID}:${TOKEN}"))

# Test JWT endpoint
$uri = "https://$domain/api/relay/rest/jwt"
$headers = @{
    "Authorization" = "Basic $base64Auth"
    "Content-Type"  = "application/json"
}
$body = @{
    resource   = "test-session-$(Get-Date -Format 'yyyyMMddHHmmss')"
    expires_in = 3600
} | ConvertTo-Json

try {
    Write-Host "POST $uri" -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Token received: $($response.jwt_token.Substring(0,20))..." -ForegroundColor Green
    Write-Host ""
    Write-Host "Full response:"
    $response | ConvertTo-Json -Depth 3
}
catch {
    Write-Host "❌ FAILED!" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Error: $($_.Exception.Message)"
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody"
    }
    exit 1
}
