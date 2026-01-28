#!/usr/bin/env pwsh
# Dispatch backend-deploy.yml and watch the latest run for the workflow
gh workflow run backend-deploy.yml --repo adrper79-dot/CallMonitor --ref main -f deploy_to=render
Start-Sleep -Seconds 3
$raw = gh run list --repo adrper79-dot/CallMonitor --workflow backend-deploy.yml --limit 1 --json databaseId
try {
  $run = $raw | ConvertFrom-Json
  $RUN_ID = $run[0].databaseId
} catch {
  Write-Error "Failed to parse gh run list output: $raw"
  exit 2
}
gh run watch $RUN_ID --repo adrper79-dot/CallMonitor
