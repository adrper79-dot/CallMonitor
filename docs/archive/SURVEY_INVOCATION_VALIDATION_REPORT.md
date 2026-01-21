# After-Call Survey Invocation - Deep Validation Report

**Date:** January 16, 2026  
**Status:** ✅ **ISSUES FIXED**

> **Update (Jan 16, 2026):** All critical issues have been resolved. See "Fixes Applied" section below.

---

## Executive Summary

The after-call survey feature has **TWO DISTINCT IMPLEMENTATIONS**:

1. **AI Survey Bot** - Inbound calls to dedicated survey number (WORKING)
2. **After-Call Survey** - Outbound calls with survey at end (PARTIALLY BROKEN)

The outbound after-call survey is **NOT being properly invoked** in the current flow.

---

## Issue #1: Survey Flag Not Passed Through Full Call Flow

### Problem
The `survey` modulation flag is **lost in the call execution pipeline**:

```
User toggles survey in UI
    ↓
CallModulations component sets survey=true
    ↓
ExecutionControls sends modulations to /api/voice/call
    ↓
startCall action receives modulations with survey=true
    ↓
❌ LOST - modulations not forwarded to outbound LaML generation
```

### Location: [app/api/calls/start/route.ts](app/api/calls/start/route.ts)
The endpoint forwards modulations to `startCallHandler`:
```typescript
const result = await startCall({ 
  organization_id,
  from_number,
  phone_number,
  flow_type,
  modulations,  // ✅ Has survey flag
  actor_id: actorId 
})
```

### Location: [app/actions/calls/startCallHandler.ts](app/actions/calls/startCallHandler.ts) (Line ~320+)
But `placeSignalWireCall()` builds LaML URL WITHOUT passing survey:
```typescript
let lamlUrl = `${env.NEXT_PUBLIC_APP_URL}/api/voice/laml/outbound?callId=${encodeURIComponent(callIdParam)}`
params.append('Url', lamlUrl)
```

**The modulations object is never passed to the LaML generator.**

### Root Cause
- `startCallHandler` receives `modulations` with `survey` flag
- But it only looks at `modulations.translate` to decide between SWML (translation) or LaML
- Never extracts or passes `survey` flag to LaML endpoint

---

## Issue #2: LaML Outbound Cannot Access Survey Configuration

### Current Flow
[app/api/voice/laml/outbound/route.ts](app/api/voice/laml/outbound/route.ts) Line 40-70:

```typescript
async function generateLaML(callSid: string | undefined, toNumber: string | undefined, callId?: string | null) {
  // Lookup by callId
  if (callId) {
    const { data: callRows } = await supabaseAdmin
      .from('calls')
      .select('organization_id')
      .eq('id', callId)
      .limit(1)
    organizationId = callRows?.[0]?.organization_id || null
  }

  if (organizationId) {
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('record, transcribe, translate, translate_from, translate_to, survey, synthetic_caller')
      // ✅ CORRECTLY selects 'survey' field
      .eq('organization_id', organizationId)
      .limit(1)
    voiceConfig = vcRows?.[0] || null
  }
```

The LaML generator **DOES select the survey field** (Line 63), but only reads it as static config:

```typescript
// Survey prompts (Line 100)
if (voiceConfig?.survey) {
  elements.push('<Say voice="alice">Thank you for your time. Before we end, I have a quick survey.</Say>')
  elements.push('<Pause length="1"/>')
  elements.push('<Say>On a scale of 1 to 5, how satisfied were you with this call?</Say>')
  elements.push('<Gather numDigits="1" action="/api/webhooks/survey" method="POST" timeout="10"/>')
}
```

### Problem
This uses **hardcoded survey question** ("On a scale of 1 to 5...") from LaML, not the dynamic `survey_prompts` configured by users.

The user's custom survey questions in `voice_configs.survey_prompts` are **never read or used in outbound calls**.

---

## Issue #3: Two Survey Implementations - Conflicting Design

### Implementation A: AI Survey Bot (Inbound - COMPLETE)
- **Endpoint**: [app/api/voice/swml/survey/route.ts](app/api/voice/swml/survey/route.ts)
- **Triggered**: Inbound calls to dedicated SignalWire number
- **Prompts**: From `voice_configs.survey_prompts` (jsonb array)
- **Technology**: SignalWire AI (GPT-4o-mini)
- **Status**: ✅ FULLY IMPLEMENTED

### Implementation B: After-Call Survey (Outbound - INCOMPLETE)
- **Endpoint**: [app/api/voice/laml/outbound/route.ts](app/api/voice/laml/outbound/route.ts)
- **Triggered**: End of outbound calls
- **Prompts**: Hardcoded in LaML (<Say> element)
- **Technology**: Twilio LaML <Gather> DTMF
- **Status**: ⚠️ PARTIALLY BROKEN - uses static config, not user prompts

---

## Issue #4: Survey Results Not Stored for Outbound Calls

### For AI Survey Bot (Inbound):
[app/api/survey/ai-results/route.ts](app/api/survey/ai-results/route.ts) Line 65+:
```typescript
const aiRunId = uuidv4()
await supabaseAdmin.from('ai_runs').insert({
  id: aiRunId, call_id: callId, system_id: null,
  model: 'signalwire-ai-survey', status: 'completed',
  output: {
    type: 'ai_survey', 
    survey_responses: surveyResponses,
    conversation, 
    summary
  }
})
```

### For After-Call Survey (Outbound):
[app/api/webhooks/survey/route.ts](app/api/webhooks/survey/route.ts) Line 52+:
```typescript
const surveyRunId = uuidv4()
await supabaseAdmin.from('ai_runs').insert({
  id: surveyRunId, 
  call_id: call.id, 
  system_id: systemAiId,
  model: 'assemblyai-survey',  // ← WRONG: Should be 'laml-survey'
  status: 'queued',
  output: { 
    type: 'survey', 
    dtmf_response: digits  // ← Only stores DTMF digit, not meaning
  }
})
```

**Issues**:
1. Model name is `assemblyai-survey` (wrong - should indicate LaML/DTMF)
2. Only stores raw DTMF digit (e.g., "4"), not mapped to response
3. Status is `queued` - never updated to `completed`
4. No email results sent for outbound surveys (unlike inbound)

---

## Issue #5: Survey Results Not Mapped to Questions

### Inbound Survey (AI Bot):
[app/api/survey/ai-results/route.ts](app/api/survey/ai-results/route.ts) Line 129+:
```typescript
function extractSurveyResponses(conversation: any[], prompts: string[]) {
  return prompts.map((prompt, i) => ({
    question: prompt,
    answer: findAnswerInConversation(prompt, conversation, i)
  }))
}
```
✅ **Maps each question to its answer**

### Outbound Survey (LaML/DTMF):
[app/api/webhooks/survey/route.ts](app/api/webhooks/survey/route.ts):
```typescript
output: { 
  type: 'survey', 
  dtmf_response: digits,  // ← Just stores "4"
  call_sid: callSid, 
  from_number: from 
}
```
❌ **No mapping of digit to question or meaning**

---

## Verification: What Should Happen

### Expected Flow for After-Call Survey (Outbound):

```
1. User configures survey questions:
   - "On scale 1-5: satisfaction?"
   - "Would you recommend?"
   - "Additional feedback?"

2. User enables "After-Call Survey" toggle in Call Modulations

3. User places outbound call with survey=true

4. LaML Generated Should Include:
   <Say>Thank you. I have a survey for you.</Say>
   <Say>Question 1: On scale 1-5: satisfaction?</Say>
   <Gather numDigits="1" action="/api/webhooks/survey" method="POST"/>
   <Say>Question 2: Would you recommend?</Say>
   <Gather action="/api/webhooks/survey" method="POST"/>
   ...

5. Caller responds (DTMF digits or voice)

6. Results Captured:
   Q1: "4" or extracted sentiment
   Q2: "Yes" or voice-to-text result
   Q3: Transcribed feedback

7. Call Artifacts Show Survey Tab with Results
```

### What Actually Happens:

```
1. User configures survey questions ✅
2. User enables "After-Call Survey" toggle ✅
3. User places outbound call WITH survey=true ✅
4. LaML Generated:
   - Reads voice_configs.survey ✅ (flag exists)
   - Uses HARDCODED "On scale 1-5" ❌ (ignores survey_prompts)
   - Missing Q2, Q3 from user config ❌
5. Caller responds with DTMF "4" ✅
6. Results Captured:
   - Raw digit "4" stored in ai_runs ❌
   - No mapping to "satisfaction=4" ❌
   - Status left as "queued" ❌ (never completes)
   - No email sent ❌
7. Call Artifacts:
   - Survey tab shows nothing or invalid data ❌
```

---

## Fixes Applied

### Fix 1: LaML Outbound Now Uses Dynamic Survey Prompts ✅
**File:** `app/api/voice/laml/outbound/route.ts`

Changes made:
- Added `survey_prompts` and `survey_webhook_email` to the voice_configs select query
- Dynamic survey question generation from `voice_configs.survey_prompts`
- Falls back to default question if none configured
- Question indexing for multi-question surveys (e.g., "Question 1 of 3")
- Action URLs include `callId`, `orgId`, question index, and total for proper tracking

### Fix 2: Survey Webhook Now Properly Completes Results ✅
**File:** `app/api/webhooks/survey/route.ts`

Changes made:
- Changed model name from `assemblyai-survey` to `laml-dtmf-survey` (clarity)
- Status now set to `completed` (not `queued`) when survey finishes
- Maps DTMF digits to meaningful values (e.g., "4" → "4/5 - Satisfied")
- Supports multi-question surveys by tracking question index
- Updates existing survey run if one exists (for multi-question flows)
- Sends email to `survey_webhook_email` when survey completes
- Returns LaML XML response (not JSON) to maintain call flow

### Fix 3: Question-Response Mapping ✅
Added intelligent response mapping:
- Scale questions (1-5): Maps to labels like "Very Dissatisfied" to "Very Satisfied"
- Scale questions (1-10): Maps to "N/10" format
- Yes/No questions: Maps 1→Yes, 2→No
- Default: Returns raw digit

### Fix 4: Email Results Delivery ✅
- Uses existing `sendEmail` service from `@/app/services/emailService`
- HTML-formatted email with branded design
- Includes call metadata, all responses, and DTMF inputs
- Only sends when survey is fully complete

---

## Original Analysis (Preserved for Reference)

## Code Changes Required (Completed)

### Fix 1: Pass Survey Configuration to LaML Generator
**File**: [app/actions/calls/startCallHandler.ts](app/actions/calls/startCallHandler.ts)

**Current** (Line ~290):
```typescript
let lamlUrl = `${env.NEXT_PUBLIC_APP_URL}/api/voice/laml/outbound?callId=${encodeURIComponent(callIdParam)}`
```

**Required**:
```typescript
// Extract survey flag from modulations
const survey = modulations?.survey ?? false
let lamlUrl = `${env.NEXT_PUBLIC_APP_URL}/api/voice/laml/outbound?callId=${encodeURIComponent(callIdParam)}&survey=${survey}`
```

---

### Fix 2: Use Dynamic Survey Prompts in LaML Generator
**File**: [app/api/voice/laml/outbound/route.ts](app/api/voice/laml/outbound/route.ts)

**Current** (Line ~100):
```typescript
if (voiceConfig?.survey) {
  elements.push('<Say voice="alice">Thank you for your time. Before we end, I have a quick survey.</Say>')
  elements.push('<Pause length="1"/>')
  elements.push('<Say>On a scale of 1 to 5, how satisfied were you with this call?</Say>')
  elements.push('<Gather numDigits="1" action="/api/webhooks/survey" method="POST" timeout="10"/>')
}
```

**Required**:
```typescript
if (voiceConfig?.survey && voiceConfig.survey_prompts?.length > 0) {
  elements.push('<Say voice="alice">Thank you for your time. I have a quick survey with ' + 
                voiceConfig.survey_prompts.length + ' questions.</Say>')
  elements.push('<Pause length="1"/>')
  
  for (const prompt of voiceConfig.survey_prompts) {
    elements.push(`<Say>${escapeXml(prompt)}</Say>`)
    elements.push('<Pause length="1"/>')
    // Gather numDigits depends on question type (score vs yes/no)
    elements.push('<Gather numDigits="1" action="/api/webhooks/survey" method="POST" timeout="10"/>')
  }
}
```

---

### Fix 3: Update Survey Webhook to Complete Processing
**File**: [app/api/webhooks/survey/route.ts](app/api/webhooks/survey/route.ts)

**Current** (Line ~52):
```typescript
const surveyRunId = uuidv4()
await supabaseAdmin.from('ai_runs').insert({
  id: surveyRunId, call_id: call.id, system_id: systemAiId,
  model: 'assemblyai-survey', status: 'queued',
  output: { type: 'survey', dtmf_response: digits, call_sid: callSid, from_number: from }
})
```

**Required**:
```typescript
const surveyRunId = uuidv4()
await supabaseAdmin.from('ai_runs').insert({
  id: surveyRunId, 
  call_id: call.id, 
  system_id: systemAiId,
  model: 'laml-dtmf-survey',  // Clarify this is LaML DTMF, not AssemblyAI
  status: 'completed',  // Mark as completed since DTMF is instant
  completed_at: new Date().toISOString(),
  output: { 
    type: 'survey', 
    response: {
      digit: digits,
      source: 'dtmf',
      timestamp: new Date().toISOString()
    },
    call_sid: callSid, 
    from_number: from 
  }
})

// Send results email if configured
if (voiceConfig?.survey_webhook_email && digits) {
  try {
    await sendSurveyResultsEmail(voiceConfig.survey_webhook_email, {
      callSid,
      from: from,
      to: to,
      responses: [{ question: 'Survey Response', answer: digits }]
    })
  } catch (emailErr: any) {
    logger.error('survey webhook: email failed', emailErr)
  }
}
```

---

## Testing Checklist

After fixes applied, validate:

- [ ] Enable survey in voice config via UI (CallModulations → After-Call Survey toggle)
- [ ] Configure custom survey questions in the textarea
- [ ] Configure email address for results delivery
- [ ] Place outbound call with survey toggle ON
- [ ] Verify LaML includes all configured survey prompts (not hardcoded)
- [ ] Send DTMF response during survey
- [ ] Check ai_runs table:
  - [ ] `model` = `'laml-dtmf-survey'` ✅ (was 'assemblyai-survey')
  - [ ] `status` = `'completed'` ✅ (was 'queued')
  - [ ] `output.responses` array contains question text, digit, and mapped value
  - [ ] `output.total_questions` and `output.questions_answered` are correct
- [ ] Verify call artifacts show Survey tab with results
- [ ] Check that email was sent if configured (check inbox or Resend dashboard)
- [ ] Compare with inbound AI survey bot behavior (should be similar in results)

---

## Related Issues

- **UI Simplification**: Survey moved to Call Modulations (was in separate Settings)
- **AI Survey Bot**: Fully working for inbound dedicated numbers
- **Plan Limits**: Survey requires Insights+ plan (enforced in RBAC)
- **Schema**: `voice_configs` has `survey_prompts` jsonb field (migration exists)

---

## References

- [AI_SURVEY_BOT.md](ARCH_DOCS/02-FEATURES/AI_SURVEY_BOT.md) - Architecture doc
- [MASTER_ARCHITECTURE.txt](ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt) - Survey endpoints
- [FEATURES_LIST.md](FEATURES_LIST.md) - Feature overview
- Voice config schema: `voice_configs` table in Supabase

