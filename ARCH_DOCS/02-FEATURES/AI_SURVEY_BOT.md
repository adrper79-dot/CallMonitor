# AI Survey Bot Feature

**Last Updated:** January 27, 2026  
**Version:** 2.0.0  
**Status:** Implemented (AI Role Compliant)

> **AI Role Policy Reference:** [AI_ROLE_POLICY.md](../01-CORE/AI_ROLE_POLICY.md)

---

## ⚠️ AI Role Policy Compliance

Per the AI Role Policy:

1. **Surveys are PROCEDURAL, not CONTRACTUAL**
2. **AI asks questions but does NOT negotiate or make commitments**
3. **Responses are feedback, NOT agreements**
4. **All calls include mandatory disclosure**

### Mandatory Disclosure

Every survey call MUST begin with:

```
"This is an automated customer satisfaction survey. Your responses will be 
recorded for quality improvement purposes. This survey does not constitute 
any agreement or commitment. You may end the call at any time."
```

### Permitted Functions

| Function | Allowed | Notes |
|----------|---------|-------|
| Ask survey questions | ✅ Yes | Procedural feedback collection |
| Record responses | ✅ Yes | For quality improvement |
| Analyze sentiment | ✅ Yes | Neutral analysis only |
| Negotiate terms | ❌ No | Never permitted |
| Capture agreements | ❌ No | Not a contractual context |
| Make commitments | ❌ No | AI does not commit |

---

## Overview

The AI Survey Bot is a call modulation feature that uses SignalWire AI Agents to conduct automated customer surveys via inbound phone calls. It supports:

- **Dynamic Survey Prompts** - Configurable questions per organization
- **Voice Selection** - Multiple language/voice options
- **Automated Results** - Email delivery of survey results
- **Conversation Capture** - Full transcript stored in `ai_runs`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AI Survey Bot Flow                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Admin configures survey in Settings UI                          │
│     └──> voice_configs.survey_prompts = ["Q1", "Q2", "Q3"]         │
│     └──> voice_configs.survey_webhook_email = "results@co.com"     │
│                                                                     │
│  2. Admin assigns SignalWire number to survey endpoint              │
│     └──> PATCH /api/signalwire/numbers                             │
│     └──> VoiceUrl = /api/voice/swml/survey?configId=xxx            │
│                                                                     │
│  3. Caller dials assigned number                                    │
│     └──> SignalWire POSTs to /api/voice/swml/survey                │
│     └──> Returns SWML with AI agent configuration                  │
│                                                                     │
│  4. SignalWire AI Agent conducts survey                             │
│     └──> Uses GPT-4o-mini for conversation                         │
│     └──> Asks configured questions sequentially                    │
│     └──> Captures responses in real-time                           │
│                                                                     │
│  5. Survey completion triggers post_prompt_url                      │
│     └──> POST /api/survey/ai-results                               │
│     └──> Stores in ai_runs table                                   │
│     └──> Sends email via emailService                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### voice_configs additions

```sql
survey_prompts jsonb DEFAULT '[]'     -- Array of survey questions
survey_voice text DEFAULT 'rime.spore' -- SignalWire TTS voice
survey_webhook_email text             -- Email for results
survey_inbound_number text            -- SignalWire number SID
```

### ai_runs output format

```json
{
  "type": "ai_survey",
  "survey_responses": [
    { "question": "How was your experience?", "answer": "Great!" },
    { "question": "Rate us 1-5?", "answer": "5" }
  ],
  "conversation": [
    { "role": "assistant", "content": "Hello! I have a quick survey..." },
    { "role": "user", "content": "Sure, go ahead." }
  ],
  "summary": "Caller rated experience 5/5, mentioned fast service",
  "call_metadata": {
    "sid": "CA123...",
    "from": "+1234567890",
    "duration": 120
  }
}
```

---

## API Endpoints

### GET/PATCH /api/signalwire/numbers

List and configure SignalWire phone numbers.

**GET Response:**
```json
{
  "success": true,
  "numbers": [
    {
      "sid": "PN123...",
      "phoneNumber": "+15551234567",
      "voiceUrl": "https://app.com/api/voice/swml/survey?configId=..."
    }
  ]
}
```

**PATCH Body:**
```json
{
  "numberSid": "PN123...",
  "webhookUrl": "https://app.com/api/voice/swml/survey?configId=xxx",
  "orgId": "uuid"
}
```

### POST /api/voice/swml/survey

SignalWire webhook for inbound survey calls. Returns SWML with AI configuration.

**Query Params:**
- `configId` - voice_configs.id
- `orgId` - organization_id (fallback)

**Response:** SWML JSON

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      { "record_call": { "format": "mp3" } },
      {
        "ai": {
          "prompt": { "text": "You are a survey bot..." },
          "voice": "rime.spore",
          "model": "gpt-4o-mini",
          "post_prompt_url": "https://app.com/api/survey/ai-results?configId=xxx"
        }
      },
      { "hangup": {} }
    ]
  }
}
```

### POST /api/survey/ai-results

Webhook receiving AI conversation results from SignalWire.

**Payload (from SignalWire):**
```json
{
  "conversation": [...],
  "summary": "...",
  "call": { "sid": "...", "from": "...", "duration": 120 },
  "params": { "callmonitor_call_id": "...", "callmonitor_org_id": "..." }
}
```

---

## UI Configuration

The survey configuration is available in the Call Modulations panel when "After-call Survey" is enabled:

1. **Survey Questions** - Textarea for entering questions (one per line)
2. **Email for Results** - Optional email address for result delivery
3. **Bot Voice** - Select from available SignalWire voices
4. **Inbound Number Status** - Shows if a number is configured

---

## SWML Builder

The survey SWML is generated by `lib/signalwire/surveySwmlBuilder.ts`:

```typescript
buildSurveySWML({
  callId: 'call-123',
  organizationId: 'org-456',
  prompts: ['Rate our service 1-5', 'What can we improve?'],
  voice: 'rime.spore',
  postPromptWebhook: 'https://app.com/api/survey/ai-results?configId=xxx',
  recordCall: true
})
```

---

## Security

- **Authentication** - SignalWire numbers API requires session auth
- **Authorization** - Only owners/admins can modify phone numbers
- **Org Membership** - Results are scoped to organization

---

## Limitations

- Requires SignalWire AI Agents feature (Business+ account)
- Survey duration limited by SignalWire AI timeout (configurable)
- Voice cloning not supported for survey bot (uses preset voices)

---

## Future Enhancements

- [ ] Number purchase within UI
- [ ] Survey analytics dashboard
- [ ] Multiple survey templates per org
- [ ] Webhook integration (in addition to email)
- [ ] DTMF input support (press 1-5)

---

## Legal Considerations

### AI Role Policy Compliance

This feature operates under the AI Role Policy which mandates:

1. **Disclosure First** - Survey disclaimer before any questions
2. **No Contractual Weight** - Responses are feedback only
3. **Human Agency** - Callers can end the call at any time
4. **Transparent Purpose** - Clearly stated as "quality improvement"

### Regulatory Compliance

- **TCPA** - Automated calls follow consent requirements
- **GDPR** - Response data is stored per privacy policy
- **CCPA** - California privacy rights respected

---

## References

- **AI Role Policy:** [ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md](../01-CORE/AI_ROLE_POLICY.md)
- SignalWire SWML: https://developer.signalwire.com/guides/swml-quickstart
- SignalWire AI Agents: https://developer.signalwire.com/guides/ai-agents
- MASTER_ARCHITECTURE.txt: Survey as call modulation
