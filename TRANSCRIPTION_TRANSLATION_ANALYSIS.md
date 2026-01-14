# 🔬 Transcription & Translation Pipeline Analysis

**Date:** January 14, 2026  
**Project:** CallMonitor (voxsouth.online)

---

## 📋 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CALL LIFECYCLE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CALL INITIATED                                                      │
│     └─► POST /api/voice/call                                           │
│         └─► startCallHandler                                           │
│             └─► SignalWire: Create call                                │
│                 └─► calls table: status='pending'                      │
│                                                                         │
│  2. CALL IN PROGRESS                                                    │
│     └─► SignalWire webhook: status='in-progress'                       │
│         └─► calls table: status='in_progress'                          │
│                                                                         │
│  3. CALL COMPLETED + RECORDING                                          │
│     └─► SignalWire webhook: status='completed' + RecordingUrl          │
│         └─► calls table: status='completed'                            │
│         └─► recordings table: INSERT (recording_url)                   │
│         └─► Storage: Upload recording to Supabase                      │
│         └─► triggerTranscriptionIfEnabled()                            │
│                                                                         │
│  4. TRANSCRIPTION (if enabled)                                          │
│     └─► Check: voice_configs.transcribe = true                         │
│     └─► Check: org.plan != 'free'                                      │
│     └─► Check: ASSEMBLYAI_API_KEY configured                           │
│     └─► ai_runs table: INSERT (model='assemblyai-v1', status='queued') │
│     └─► POST https://api.assemblyai.com/v2/transcript                  │
│         └─► ai_runs: status='processing'                               │
│                                                                         │
│  5. TRANSCRIPTION WEBHOOK (AssemblyAI callback)                         │
│     └─► POST /api/webhooks/assemblyai                                  │
│         └─► ai_runs: status='completed', output={transcript}           │
│         └─► recordings: transcript_json={...}                          │
│         └─► checkAndTriggerTranslation() ←─── TRANSLATION TRIGGERED    │
│                                                                         │
│  6. TRANSLATION (if enabled)                                            │
│     └─► Check: voice_configs.translate = true                          │
│     └─► Check: translate_from & translate_to set                       │
│     └─► Check: OPENAI_API_KEY configured                               │
│     └─► ai_runs: INSERT (model='assemblyai-translation')               │
│     └─► OpenAI GPT-3.5-turbo: Translate text                           │
│     └─► ElevenLabs: Generate TTS audio (optional)                      │
│         └─► Storage: Upload translated audio                           │
│     └─► ai_runs: status='completed', output={translated_text}          │
│                                                                         │
│  7. EVIDENCE MANIFEST + EMAIL (optional)                                │
│     └─► checkAndGenerateManifest()                                     │
│     └─► sendArtifactsToUserEmail()                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Environment Variables Required

| Variable | Purpose | Status Check |
|----------|---------|--------------|
| `ASSEMBLYAI_API_KEY` | Transcription | Health endpoint reports "healthy" |
| `OPENAI_API_KEY` | Translation | **Check in Vercel Dashboard** |
| `ELEVENLABS_API_KEY` | TTS for translated audio | Optional, check in Vercel |
| `RESEND_API_KEY` | Email artifacts | Optional |

---

## 🔍 Diagnostic SQL Query

Run in **Supabase SQL Editor** → `scripts/check-transcription-status.sql`:

```sql
-- Check voice_configs settings
SELECT vc.organization_id, o.plan, vc.record, vc.transcribe, vc.translate,
       vc.translate_from, vc.translate_to
FROM voice_configs vc
JOIN organizations o ON o.id = vc.organization_id;

-- Check recent calls with recordings
SELECT c.id, c.status, r.id as recording_id, r.transcript_json IS NOT NULL as has_transcript
FROM calls c
LEFT JOIN recordings r ON r.call_sid = c.call_sid
ORDER BY c.created_at DESC LIMIT 10;

-- Check ai_runs (transcription/translation jobs)
SELECT model, status, COUNT(*)
FROM ai_runs
WHERE model LIKE 'assemblyai%'
GROUP BY model, status;
```

---

## ❌ Potential Gaps & Fixes

### Gap 1: Recording Not Received

**Symptoms:**
- Call completes but no recording in `recordings` table
- Logs show: "Call completed but NO RECORDING FIELDS"

**Root Cause:**
- SignalWire not configured to record calls
- StatusCallback URL not pointing to webhook

**Fix:**
1. In SignalWire Dashboard → Phone Numbers → Configure your number
2. Set "Status Callback URL" to: `https://voxsouth.online/api/webhooks/signalwire`
3. OR ensure `voice_configs.record = true` and LaML includes `Record=true`

### Gap 2: Transcription Not Triggered

**Symptoms:**
- Recording exists but no `ai_runs` entry with `model='assemblyai-v1'`

**Root Cause:**
- `voice_configs.transcribe` not enabled
- `ASSEMBLYAI_API_KEY` not set
- Organization plan is 'free'
- `systems` table missing 'system-ai' entry

**Fix:**
1. Enable transcription in Voice Operations settings
2. Verify `ASSEMBLYAI_API_KEY` is set in Vercel
3. Ensure organization plan is not 'free'
4. Run: `INSERT INTO systems (id, key, name) VALUES (gen_random_uuid(), 'system-ai', 'AI System');`

### Gap 3: Transcription Webhook Not Received

**Symptoms:**
- `ai_runs` status stays 'processing' forever
- No transcript in recordings

**Root Cause:**
- AssemblyAI webhook URL not correct
- `NEXT_PUBLIC_APP_URL` not set

**Fix:**
1. Verify `NEXT_PUBLIC_APP_URL=https://voxsouth.online` in Vercel
2. Check Vercel logs for incoming webhook from AssemblyAI

### Gap 4: Translation Not Triggered

**Symptoms:**
- Transcription completes but no translation

**Root Cause:**
- `voice_configs.translate` not enabled
- `translate_from` or `translate_to` not set
- `OPENAI_API_KEY` not configured

**Fix:**
1. Enable translation in Voice Operations settings
2. Set From/To languages
3. Add `OPENAI_API_KEY` to Vercel environment variables

### Gap 5: Translation Fails

**Symptoms:**
- `ai_runs` with `model='assemblyai-translation'` shows `status='failed'`

**Root Cause:**
- Organization plan not supported
- OpenAI API error

**Check:**
```sql
SELECT output->>'error' FROM ai_runs WHERE model='assemblyai-translation' AND status='failed';
```

---

## 🧪 Test Checklist

### Before Testing:
- [ ] Verify `ASSEMBLYAI_API_KEY` is set in Vercel
- [ ] Verify `OPENAI_API_KEY` is set in Vercel (for translation)
- [ ] Run `/api/debug/translation-check` to see status
- [ ] Ensure voice_configs has: `record=true, transcribe=true, translate=true`

### Test Steps:
1. Go to Voice Operations page
2. Enter a phone number and place a call
3. Complete the call (let it ring/answer for 30+ seconds)
4. Check database:
   - `calls` table: status should be 'completed'
   - `recordings` table: should have recording_url
   - `ai_runs` table: should have 'assemblyai-v1' entry
5. Wait 1-2 minutes for AssemblyAI webhook
6. Check `recordings.transcript_json` - should have transcript
7. If translation enabled, check `ai_runs` for 'assemblyai-translation'

---

## 📊 Current Status (Run these to verify)

### API Health Check:
```bash
curl https://voxsouth.online/api/health | jq .
```

### Translation Debug (authenticated):
```bash
# Login to the app first, then visit:
https://voxsouth.online/api/debug/translation-check
```

### Vercel Logs:
```bash
vercel logs https://voxsouth.online --since 1h
```

---

## 🔧 Quick Fixes

### Enable Transcription & Translation:
```sql
UPDATE voice_configs
SET record = true,
    transcribe = true,
    translate = true,
    translate_from = 'en',
    translate_to = 'es'
WHERE organization_id = '<YOUR_ORG_ID>';
```

### Add Missing System Entry:
```sql
INSERT INTO systems (id, key, name, created_at)
VALUES (gen_random_uuid(), 'system-ai', 'AI System', now())
ON CONFLICT (key) DO NOTHING;
```

### Check Environment Variables in Vercel:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Verify these are set:
   - `ASSEMBLYAI_API_KEY`
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_APP_URL=https://voxsouth.online`

---

**Last Updated:** January 14, 2026
