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
if (-not $token) { Write-Host "NO_TOKEN"; exit 2 }
$headers = @{ Authorization = "Bearer $token" }

Write-Host "== Workers Scripts =="
try {
  $w = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$env:CF_ACCOUNT_ID/workers/scripts" -Headers $headers -Method Get -TimeoutSec 30
  $w | ConvertTo-Json -Depth 6
} catch {
  Write-Host "Workers_ERROR"
  if ($_.Exception.Response) { $r = $_.Exception.Response; $sr = New-Object System.IO.StreamReader($r.GetResponseStream()); Write-Host $sr.ReadToEnd() } else { Write-Host $_ }
}

Write-Host "`n== Pages Project (wordisbond) =="
try {
  $p = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$env:CF_ACCOUNT_ID/pages/projects/wordisbond" -Headers $headers -Method Get -TimeoutSec 30
  $p | ConvertTo-Json -Depth 6
} catch {
  Write-Host "Pages_PROJECT_ERROR"
  if ($_.Exception.Response) { $r = $_.Exception.Response; $sr = New-Object System.IO.StreamReader($r.GetResponseStream()); Write-Host $sr.ReadToEnd() } else { Write-Host $_ }
}

Write-Host "`n== Recent Pages Deployments (last 5) =="
try {
  $d = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$env:CF_ACCOUNT_ID/pages/projects/wordisbond/deployments?per_page=5" -Headers $headers -Method Get -TimeoutSec 30
  $d | ConvertTo-Json -Depth 8
} catch {
  Write-Host "Pages_DEPLOYMENTS_ERROR"
  if ($_.Exception.Response) { $r = $_.Exception.Response; $sr = New-Object System.IO.StreamReader($r.GetResponseStream()); Write-Host $sr.ReadToEnd() } else { Write-Host $_ }
}
