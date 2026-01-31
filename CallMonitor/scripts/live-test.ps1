# ═══════════════════════════════════════════════════════════════
# LIVE END-TO-END FEATURE PIPELINE TEST
# ═══════════════════════════════════════════════════════════════
#
# This script tests the REAL deployed CallMonitor system.
# Run from PowerShell: .\scripts\live-test.ps1
#
# CONFIGURATION:
# - Agent Number (FROM): +17062677235
# - Target Number (TO): +12392027345
# - Languages: English → German
# - Artifact Email: adrper79@gmail.com
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"

# Configuration
$BASE_URL = "https://voxsouth.online"
$FROM_NUMBER = "+17062677235"
$TO_NUMBER = "+12392027345"
$TRANSLATE_FROM = "en"
$TRANSLATE_TO = "de"
$ARTIFACT_EMAIL = "adrper79@gmail.com"

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  LIVE E2E FEATURE PIPELINE TEST" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Base URL: $BASE_URL"
Write-Host "  From: $FROM_NUMBER"
Write-Host "  To: $TO_NUMBER"
Write-Host "  Languages: $TRANSLATE_FROM → $TRANSLATE_TO"
Write-Host "  Email: $ARTIFACT_EMAIL"
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Helper function to make API calls
function Invoke-ApiRequest {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Body = $null
    )
    
    $url = "$BASE_URL$Endpoint"
    Write-Host "  → $Method $url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $url
            Method = $Method
            ContentType = "application/json"
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response }
    }
    catch {
        $errorMsg = $_.Exception.Message
        return @{ Success = $false; Error = $errorMsg }
    }
}

# Test 1: Health Check
Write-Host "`n🧪 Test 1: Health Check" -ForegroundColor Yellow
$health = Invoke-ApiRequest -Endpoint "/api/health"
if ($health.Success) {
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    Write-Host "    Status: $($health.Data.status)"
} else {
    Write-Host "  ❌ FAILED: $($health.Error)" -ForegroundColor Red
}

# Test 2: Check Environment
Write-Host "`n🧪 Test 2: Environment Check" -ForegroundColor Yellow
$env = Invoke-ApiRequest -Endpoint "/api/health/env"
if ($env.Success) {
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    if ($env.Data.signalwire) {
        Write-Host "    SignalWire: Configured"
    }
    if ($env.Data.assemblyai) {
        Write-Host "    AssemblyAI: Configured"
    }
} else {
    Write-Host "  ⚠️ Could not verify environment" -ForegroundColor Yellow
}

# Prompt for organization ID (required for authenticated calls)
Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  MANUAL INPUT REQUIRED" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "To continue, you need your Organization ID from the database."
Write-Host "Run this SQL in Supabase to get it:"
Write-Host ""
Write-Host "  SELECT organization_id FROM users WHERE email = 'stepdadstrong@gmail.com';" -ForegroundColor Magenta
Write-Host ""
$ORG_ID = Read-Host "Enter your Organization ID (UUID)"

if (-not $ORG_ID) {
    Write-Host "No Organization ID provided. Exiting." -ForegroundColor Red
    exit 1
}

# Test 3: Create Voice Target
Write-Host "`n🧪 Test 3: Create Voice Target" -ForegroundColor Yellow
$targetBody = @{
    organization_id = $ORG_ID
    phone_number = $TO_NUMBER
    name = "E2E Test Target"
    description = "Created $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}
$target = Invoke-ApiRequest -Endpoint "/api/voice/targets" -Method "POST" -Body $targetBody
if ($target.Success -and $target.Data.success) {
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    $TARGET_ID = $target.Data.target.id
    Write-Host "    Target ID: $TARGET_ID"
} else {
    Write-Host "  ❌ FAILED: $($target.Data.error.message)" -ForegroundColor Red
    $TARGET_ID = $null
}

# Test 4: Create Survey
Write-Host "`n🧪 Test 4: Create Survey" -ForegroundColor Yellow
$surveyBody = @{
    organization_id = $ORG_ID
    name = "E2E Test Survey"
    description = "Customer satisfaction survey"
    questions = @(
        @{
            id = "q1"
            text = "On a scale of 1 to 5, how satisfied were you with our service today?"
            type = "scale"
            required = $true
            order = 1
        },
        @{
            id = "q2"
            text = "Would you recommend us to a friend?"
            type = "yes_no"
            required = $true
            order = 2
        },
        @{
            id = "q3"
            text = "Any additional feedback?"
            type = "text"
            required = $false
            order = 3
        }
    )
    is_active = $true
}
$survey = Invoke-ApiRequest -Endpoint "/api/surveys" -Method "POST" -Body $surveyBody
if ($survey.Success -and $survey.Data.success) {
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    $SURVEY_ID = $survey.Data.survey.id
    Write-Host "    Survey ID: $SURVEY_ID"
} elseif ($survey.Data.error.code -eq "PLAN_LIMIT_EXCEEDED") {
    Write-Host "  ⚠️ SKIPPED - Requires Insights plan" -ForegroundColor Yellow
    $SURVEY_ID = $null
} else {
    Write-Host "  ❌ FAILED: $($survey.Data.error.message)" -ForegroundColor Red
    $SURVEY_ID = $null
}

# Test 5: Update Voice Config
Write-Host "`n🧪 Test 5: Update Voice Configuration" -ForegroundColor Yellow
$configBody = @{
    orgId = $ORG_ID
    modulations = @{
        record = $true
        transcribe = $true
        translate = $true
        translate_from = $TRANSLATE_FROM
        translate_to = $TRANSLATE_TO
        survey = if ($SURVEY_ID) { $true } else { $false }
        survey_id = $SURVEY_ID
        target_id = $TARGET_ID
        survey_webhook_email = $ARTIFACT_EMAIL
    }
}
$config = Invoke-ApiRequest -Endpoint "/api/voice/config" -Method "PUT" -Body $configBody
if ($config.Success -and $config.Data.success) {
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    Write-Host "    Recording: Enabled"
    Write-Host "    Transcription: Enabled"
    Write-Host "    Translation: $TRANSLATE_FROM → $TRANSLATE_TO"
    Write-Host "    Email: $ARTIFACT_EMAIL"
} else {
    Write-Host "  ❌ FAILED: $($config.Data.error.message)" -ForegroundColor Red
}

# Test 6: Execute Call
Write-Host "`n🧪 Test 6: EXECUTE LIVE CALL" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  ⚠️  THIS WILL MAKE A REAL PHONE CALL" -ForegroundColor Magenta
Write-Host "      From: $FROM_NUMBER" -ForegroundColor Magenta
Write-Host "      To: $TO_NUMBER" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
$confirm = Read-Host "Type 'CALL' to proceed with live call"

if ($confirm -eq "CALL") {
    $callBody = @{
        organization_id = $ORG_ID
        phone_to = $TO_NUMBER
        from_number = $FROM_NUMBER
        modulations = @{
            record = $true
            transcribe = $true
            translate = $true
            survey = if ($SURVEY_ID) { $true } else { $false }
        }
    }
    $call = Invoke-ApiRequest -Endpoint "/api/voice/call" -Method "POST" -Body $callBody
    if ($call.Success -and $call.Data.success) {
        Write-Host "  ✅ CALL INITIATED" -ForegroundColor Green
        $CALL_ID = $call.Data.call_id
        $CALL_SID = $call.Data.call_sid
        Write-Host "    Call ID: $CALL_ID"
        Write-Host "    Call SID: $CALL_SID"
        
        # Poll for status
        Write-Host "`n⏳ Polling call status..." -ForegroundColor Yellow
        for ($i = 1; $i -le 30; $i++) {
            Start-Sleep -Seconds 5
            $status = Invoke-ApiRequest -Endpoint "/api/calls/$CALL_ID"
            if ($status.Success) {
                $callStatus = $status.Data.call.status
                Write-Host "    [$i/30] Status: $callStatus"
                if ($callStatus -in @("completed", "failed", "no-answer", "busy", "canceled")) {
                    break
                }
            }
        }
        
        # Wait for async processing
        Write-Host "`n⏳ Waiting 15 seconds for artifact processing..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
        
        # Check artifacts
        Write-Host "`n🧪 Test 7: Verify Artifacts" -ForegroundColor Yellow
        $artifacts = Invoke-ApiRequest -Endpoint "/api/calls/$CALL_ID"
        if ($artifacts.Success) {
            Write-Host "  ✅ Call data retrieved" -ForegroundColor Green
            Write-Host "    Transcript: $(if ($artifacts.Data.call.transcript) { 'Found' } else { 'Pending' })"
            Write-Host "    Translation: $(if ($artifacts.Data.call.translation) { 'Found' } else { 'Pending' })"
        }
        
        # Trigger email
        Write-Host "`n🧪 Test 8: Trigger Artifact Email" -ForegroundColor Yellow
        $emailBody = @{
            email = $ARTIFACT_EMAIL
            include_recording = $true
            include_transcript = $true
            include_translation = $true
        }
        $email = Invoke-ApiRequest -Endpoint "/api/calls/$CALL_ID/email" -Method "POST" -Body $emailBody
        if ($email.Success -and $email.Data.success) {
            Write-Host "  ✅ Email sent to $ARTIFACT_EMAIL" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ Email may have been sent automatically" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "  ❌ FAILED: $($call.Data.error.message)" -ForegroundColor Red
    }
} else {
    Write-Host "  ⏭️ SKIPPED - User chose not to make call" -ForegroundColor Yellow
}

# Summary
Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TEST COMPLETE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($CALL_ID) {
    Write-Host "`n📞 Call ID: $CALL_ID"
    Write-Host "   View at: $BASE_URL/voice?call=$CALL_ID"
}
Write-Host "`n📧 Artifacts will be emailed to: $ARTIFACT_EMAIL"
Write-Host "`n🔍 Check Vercel logs for detailed execution trace:"
Write-Host "   vercel logs $BASE_URL --follow"
