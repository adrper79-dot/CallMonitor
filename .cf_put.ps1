$envFile = ".vercel/.env"
$token = $null
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*CLOUDFLARE_API_TOKEN\s*=\s*(.+)\s*$') {
      $token = $Matches[1].Trim()
      $token = $token.Trim('"')
      break
    }
  }
}
if (-not $token) { $token = $env:CLOUDFLARE_API_TOKEN }
if (-not $token) { Write-Host "NO_TOKEN_FOUND"; exit 2 }

$accountId = $env:CF_ACCOUNT_ID
if (-not $accountId) { $accountId = 'a1c8a33cbe8a3c9e260480433a0dbb06' }
$project = 'wordisbond'

$body = @{ 
  production_branch = 'main';
  source = @{ 
    type = 'github';
    repository = @{ name = 'adrper79-dot/CallMonitor' };
    build_config = @{ command = 'npm run build:cloudflare'; directory = '.open-next/assets' }
  }
}
$json = $body | ConvertTo-Json -Depth 8

Write-Host "PUT /accounts/$accountId/pages/projects/$project - body:"; Write-Host $json

try {
  $resp = Invoke-RestMethod -Method Put -Uri "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects/$project" -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } -Body $json -TimeoutSec 60
  Write-Host "\nPUT response:"; $resp | ConvertTo-Json -Depth 6
} catch {
  Write-Host "PUT_ERROR"; if ($_.Exception.Response) { $r = $_.Exception.Response; $sr = New-Object System.IO.StreamReader($r.GetResponseStream()); Write-Host 'HTTP' $r.StatusCode; Write-Host $sr.ReadToEnd() } else { Write-Host $_ }
}

# Fetch project info to confirm
try {
  Start-Sleep -Seconds 1
  $proj = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects/$project" -Headers @{ Authorization = "Bearer $token" } -Method Get -TimeoutSec 30
  Write-Host "\nProject info:"; $proj | ConvertTo-Json -Depth 6
} catch {
  Write-Host "PROJECT_FETCH_ERROR"; if ($_.Exception.Response) { $r = $_.Exception.Response; $sr = New-Object System.IO.StreamReader($r.GetResponseStream()); Write-Host 'HTTP' $r.StatusCode; Write-Host $sr.ReadToEnd() } else { Write-Host $_ }
}
