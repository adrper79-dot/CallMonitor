#!/usr/bin/env pwsh
# Backfill Transcriptions for Existing Recordings
# Submits all recordings with status='none' to AssemblyAI

param(
    [string]$OrgId = "f92acc56-7a95-4276-8513-4d041347fab3",  # Vox South
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "=== Backfill Transcriptions Utility ===" -ForegroundColor Cyan

# Check environment
if (-not $env:NEON_PG_CONN) {
    Write-Error "NEON_PG_CONN environment variable not set"
}

# Get calls with recordings but no transcripts
Write-Host "`nQuerying calls with recordings but no transcripts..." -ForegroundColor Yellow

$query = @"
SELECT id, call_sid, recording_url
FROM calls 
WHERE organization_id = '$OrgId'
  AND recording_url IS NOT NULL
  AND transcript_status = 'none'
  AND is_deleted = false
ORDER BY created_at DESC;
"@

$calls = psql $env:NEON_PG_CONN -t -A -F"|" -c $query | ForEach-Object {
    $parts = $_ -split '\|'
    if ($parts.Length -eq 3) {
        [PSCustomObject]@{
            Id = $parts[0]
            CallSid = $parts[1]
            RecordingUrl = $parts[2]
        }
    }
} | Where-Object { $_.Id }

Write-Host "Found $($calls.Count) calls needing transcription" -ForegroundColor Green

if ($calls.Count -eq 0) {
    Write-Host "No calls to process. Exiting." -ForegroundColor Green
    exit 0
}

# Display summary
$calls | Format-Table -AutoSize

if ($DryRun) {
    Write-Host "`n[DRY RUN] Would submit $($calls.Count) recordings to AssemblyAI" -ForegroundColor Cyan
    exit 0
}

# Confirm
$confirm = Read-Host "`nSubmit these $($calls.Count) recordings to AssemblyAI? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Get API keys from Cloudflare
Write-Host "`nRetrieving API keys from Cloudflare Workers..." -ForegroundColor Yellow
cd workers
$secrets = wrangler secret list --config wrangler.toml | ConvertFrom-Json

$assemblyKey = ($secrets | Where-Object { $_.name -eq 'ASSEMBLYAI_API_KEY' }).name
$webhookSecret = ($secrets | Where-Object { $_.name -eq 'ASSEMBLYAI_WEBHOOK_SECRET' }).name

if (-not $assemblyKey) {
    Write-Error "ASSEMBLYAI_API_KEY not found in Cloudflare secrets"
}

Write-Host "✓ Found ASSEMBLYAI_API_KEY" -ForegroundColor Green
Write-Host "✓ Found ASSEMBLYAI_WEBHOOK_SECRET" -ForegroundColor Green

# Get actual secret values (requires manual input or pre-configured env vars)
if (-not $env:ASSEMBLYAI_API_KEY) {
    Write-Error "Set env:ASSEMBLYAI_API_KEY with your AssemblyAI API key before running this script"
}

$apiKey = $env:ASSEMBLYAI_API_KEY
$webhookUrl = "https://wordisbond-api.adrper79.workers.dev/api/webhooks/assemblyai"
$publicBucketUrl = "https://audio.wordis-bond.com"

cd ..

# Submit each recording
$submitted = 0
$failed = 0

foreach ($call in $calls) {
    Write-Host "`nProcessing call $($call.Id)..." -ForegroundColor Cyan
    
    # Construct audio URL
    $audioUrl = if ($call.RecordingUrl.StartsWith('http')) {
        $call.RecordingUrl
    } else {
        "$publicBucketUrl/$($call.RecordingUrl)"
    }
    
    Write-Host "  Audio URL: $audioUrl"
    
    # Submit to AssemblyAI
    try {
        $headers = @{
            "Authorization" = $apiKey
            "Content-Type" = "application/json"
        }
        
        $body = @{
            audio_url = $audioUrl
            webhook_url = $webhookUrl
            speaker_labels = $true
            auto_highlights = $true
            sentiment_analysis = $true
        }
        
        if ($env:ASSEMBLYAI_WEBHOOK_SECRET) {
            $body.webhook_auth_header_name = "Authorization"
            $body.webhook_auth_header_value = $env:ASSEMBLYAI_WEBHOOK_SECRET
        }
        
        $response = Invoke-RestMethod -Uri "https://api.assemblyai.com/v2/transcript" `
            -Method POST `
            -Headers $headers `
            -Body ($body | ConvertTo-Json) `
            -ErrorAction Stop
        
        $transcriptId = $response.id
        
        Write-Host "  ✓ Submitted to AssemblyAI: $transcriptId" -ForegroundColor Green
        
        # Update database
        $updateQuery = @"
UPDATE calls 
SET transcript_status = 'pending', 
    transcript_id = '$transcriptId',
    updated_at = NOW()
WHERE id = '$($call.Id)';
"@
        
        psql $env:NEON_PG_CONN -c $updateQuery | Out-Null
        Write-Host "  ✓ Updated database" -ForegroundColor Green
        
        $submitted++
        
        # Rate limit: 1 request per second
        Start-Sleep -Seconds 1
        
    } catch {
        Write-Host "  ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
        
        # Mark as failed in DB
        $failQuery = @"
UPDATE calls 
SET transcript_status = 'failed',
    updated_at = NOW()
WHERE id = '$($call.Id)';
"@
        psql $env:NEON_PG_CONN -c $failQuery | Out-Null
        
        $failed++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Total calls processed: $($calls.Count)"
Write-Host "Successfully submitted: $submitted" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red

Write-Host "`nTranscripts will be delivered to $webhookUrl within 1-5 minutes." -ForegroundColor Yellow
Write-Host "Check status with:" -ForegroundColor Cyan
Write-Host "  psql `$env:NEON_PG_CONN -c ""SELECT transcript_status, COUNT(*) FROM calls WHERE organization_id = '$OrgId' GROUP BY transcript_status;"""
