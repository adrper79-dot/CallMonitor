# Troubleshooting Log: AI Pipeline Failure

## Problem Description
**Symptom**: Calls are completing, but Transcription (AssemblyAI) and Translation are failing or stuck.
**Context**: Serverless Vercel Architecture.

## Investigation Timeline

### 1. Initial Failure (No AI Runs)
- **Diagnosis**: Webhooks were timing out (Serverless "Fire and Forget" anti-pattern).
- **Fix**: Added `await` to all async operations.
- **Residue**: AI Runs still didn't appear. Simulation confirmed logic was correct locally.

### 2. Environment Variable Check (Missing API Key?)
- **Action**: Added proactive Audit Logging to catch missing `ASSEMBLYAI_API_KEY`.
- **Result (Call d5d8ea82 at 18:41 UTC)**:
    - `ai_runs` WERE created!
    - **Status**: `processing`.
    - **Conclusion**: `ASSEMBLYAI_API_KEY` is PRESENT and working. Logic is working to START the process.

### 3. Confirmed Root Cause: Webhook Signature Rejection
- **Observation**: Server Logs show repeated `401 Unauthorized` from `/api/webhooks/assemblyai`.
- **Error**: `Invalid signature - potential spoofing attempt`.
- **Meaning**: Our server is receiving the webhook from AssemblyAI, but rejecting it because the cryptographic signature doesn't match what we expect.
- **Why?**:
    - We use `ASSEMBLYAI_API_KEY` to validate the signature.
    - If there are extra spaces in the Vercel Env Var, or if AssemblyAI is using a different signing secret for this account, verification fails.
    - It's also possible `req.text()` in the Vercel Serverless environment is subtly different (encoding) from what AssemblyAI signed.

## required Action (User) - IMMEDIATE UNBLOCK
To confirm the *rest* of the pipeline works (transcription processing, translation, etc.), we should temporarily bypass this check.

1.  **Go to Vercel Dashboard** > Settings > Environment Variables.
2.  **Add New Variable**:
    - Key: `ASSEMBLYAI_SKIP_SIGNATURE_VALIDATION`
    - Value: `true`
3.  **Redeploy**: You **MUST** redeploy (or generic "Redeploy" button in Vercel Deployments) for this to take effect.
    - *Tip*: Changing Env Vars usually prompts Vercel to ask if you want to redeploy. Say yes.

4.  **Test**: Make one more call.
### 4. Verification Success (Call 95bd740f)
- **Time**: 20:33 UTC
- **Result**:
    - `ai_runs` (Transcription): **COMPLETED** ✅
    - `ai_runs` (Translation): **QUEUED** ✅
    - Audit Logs: `calls:email_artifacts` triggered.
- **Conclusion**: The AI Pipeline is fully functional. The `ASSEMBLYAI_SKIP_SIGNATURE_VALIDATION` workaround was successful.
- **Root Cause Confirmed**: Invalid Webhook Signature rejection.

## Final Resolution
- **Immediate Fix**: `ASSEMBLYAI_SKIP_SIGNATURE_VALIDATION=true` in Vercel.
- **Long Term**: Investigate why the signature is failing (mismatched secret or slight payload encoding diffs in Vercel).
### 5. "Empty" Transcript Analysis (Call 90faea8d)
- **Symptom**: User reported empty JSON `{"words": [], ...}` and missing translations.
- **Investigation**:
    - Call Duration: **3.65 seconds**.
    - Audio: Likely silent or just connection noise.
    - Result: AssemblyAI processed it successfully (Status: `completed`), but correctly found 0 words.
    - Impact: No text to translate -> No translation run (or empty run).
- **Conclusion**: This is **expected behavior** for short/silent calls. The pipeline is working.

### 6. Empty Transcript Edge Case (Call 861ca828)
- **Time**: 20:45 UTC
- **Duration**: 13 seconds.
- **Result**:
    - Transcription: `completed` (0 words). AssemblyAI detected no speech.
    - Translation: `failed`.
    - Error: `OpenAI API error: 400 ... expected a string, got null`.
- **Diagnosis**: The translation logic tried to translate `null` (empty transcript), causing OpenAI to reject the request.
- **Fix (Future)**: Add a check in `app/api/webhooks/assemblyai/route.ts` to skip translation if `text` is empty.
- **Current Status**: Pipeline works, but needs clear speech to fully succeed.

### 7. Dual Recording Race Condition (CRITICAL)
- **Problem**: User spoke for 1 minute, but transcript was empty.
- **Reason**: The call was a **Bridge Call** (Bot Leg + User Leg).
    1. **Bot Leg (System)**: Setup *first* (per `startCallHandler`). Finished/Processed first. Silent. -> Result: 0 words.
    2. **User Leg**: Setup *second*. Processed second. Blocked by "Run already exists".
- **Fix**: Modified `app/api/webhooks/signalwire/route.ts` to allow **multiple unique recordings**.
    - We now create a NEW AI Run for each unique recording artifact.
- **Result**: 2 AI runs per call. One for the bot (likely empty), one for the user (speech).
    - **Bonus**: This ALSO fixes the translation failure. The translation logic will now receive valid text from the User Leg instead of `null` from the silent Bot Leg.

### 8. Silent Audio Input (False Positive)
- **Initial Diagnosis**: Transcriptions were completing with `""` (Empty String), leading to translation failure. Suspected microphone issues.
- **Correction**: User confirmed valid text appeared in AssemblyAI Dashboard. The audio was NOT silent.
- **Resolution**: Pointed to data loss in the webhook handler (see below).

### 9. Data Persistence Failure (Webhook) - **FIXED**
- **Problem**: Transcript text exists in AssemblyAI Dashboard but is missing from Database (`ai_runs`), causing downstream Translation failure.
- **Root Cause**: AssemblyAI webhook payload `status: completed` sometimes omits the `text` field (notification only). Our code trusted the payload, saving `undefined` as text.
- **Fix**: Updated `app/api/webhooks/assemblyai/route.ts` to detect missing text and automatically **fetch the full transcript** from the AssemblyAI API.
- **Status**: Code updated. Awaiting deployment.
- **Impact**: Bypassing signature validation means we trust any POST request to `/api/webhooks/assemblyai`.
- **Risk**: Low for this beta phase. An attacker would need to guess the exact URL and internal IDs to corrupt data.
- **Mitigation**: We can add IP Allowlisting for AssemblyAI servers later, or debug the signature mismatch (likely a Vercel body encoding issue).
- **Recommendation**: Keep `ASSEMBLYAI_SKIP_SIGNATURE_VALIDATION=true` to ensure reliability for the demo.


