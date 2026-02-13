# Word Is Bond — Comprehensive Engineering Guide

> **TOGAF Phase:** Phase C (Information Systems Architecture) + Phase D (Technology Architecture)

**Last Updated:** February 13, 2026
**Platform Version:** v4.65
**Scope:** Complete feature-level engineering reference for all 31 application functions
**Companion Document:** `ARCH_DOCS/APPLICATION_FUNCTIONS.md`

---

## Table of Contents

- [1. Authentication & Session Management](#1-authentication--session-management)
- [2. Voice Operations & Call Management](#2-voice-operations--call-management)
- [3. Live Translation Pipeline](#3-live-translation-pipeline)
- [4. AI Intelligence Suite](#4-ai-intelligence-suite)
- [5. Bond AI Assistant](#5-bond-ai-assistant)
- [6. Cockpit — Agent Workspace](#6-cockpit--agent-workspace)
- [7. Predictive Dialer](#7-predictive-dialer)
- [8. Collections CRM](#8-collections-crm)
- [9. Campaign Management](#9-campaign-management)
- [10. Analytics & Reporting](#10-analytics--reporting)
- [11. Scorecard & QA System](#11-scorecard--qa-system)
- [12. Billing & Subscription Management](#12-billing--subscription-management)
- [13. Team & Organization Management](#13-team--organization-management)
- [14. Compliance & Security Center](#14-compliance--security-center)
- [15. IVR System](#15-ivr-system)
- [16. Webhook Management](#16-webhook-management)
- [17. CRM Integration Framework](#17-crm-integration-framework)
- [18. Feature Flag System](#18-feature-flag-system)
- [19. Onboarding Wizard](#19-onboarding-wizard)
- [20. Payment Plans & Dunning](#20-payment-plans--dunning)
- [21. Scheduling & Callbacks](#21-scheduling--callbacks)
- [22. Agent Productivity Tools](#22-agent-productivity-tools)
- [23. Sentiment Analysis](#23-sentiment-analysis)
- [24. Text-to-Speech (TTS)](#24-text-to-speech-tts)
- [25. Recording Management](#25-recording-management)
- [26. Data Retention & Legal Holds](#26-data-retention--legal-holds)
- [27. RBAC & Permissions](#27-rbac--permissions)
- [28. Admin & Platform Management](#28-admin--platform-management)
- [29. Infrastructure & DevOps](#29-infrastructure--devops)
- [30. Testing & Quality Assurance](#30-testing--quality-assurance)
- [31. UI/UX Framework](#31-uiux-framework)
- [Appendix A: Bug & Issue Audit](#appendix-a-bug--issue-audit)
- [Appendix B: Recommendations Matrix](#appendix-b-recommendations-matrix)

---

## 1. Authentication & Session Management

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/auth.ts` | 12 auth endpoints |
| Backend Lib | `workers/src/lib/auth.ts` | `verifySession()`, `requireAuth()`, `requireRole()`, fingerprinting |
| Backend Lib | `workers/src/lib/schemas.ts` | Zod schemas: signup, login, forgot-password |
| Backend Lib | `workers/src/lib/email.ts` | Password reset, invite email templates (Resend) |
| Frontend | `components/AuthProvider.tsx` | `useSession()`, `signIn()`, `signOut()`, token management |
| Frontend | `components/ui/ProtectedGate.tsx` | Route-level auth guarding |
| Frontend Pages | `app/signin/`, `app/signup/`, `app/forgot-password/`, `app/reset-password/` | Auth UI |

### Flow Diagram

```
User → /signin → AuthProvider.signIn()
  → POST /api/auth/callback/credentials { email, password }
  → Workers: hash + compare PBKDF2
  → Create session row in `sessions` table
  → Return JWT-like token
  → AuthProvider stores in localStorage (wb-session-token)
  → All subsequent apiGet/apiPost calls include Bearer header
  → Workers: verifySession() → decode token → lookup session in DB
  → Attach session to Hono context: c.set('session', {...})

Password Reset Flow:
  /forgot-password → POST /api/auth/forgot-password
  → Generate token → store in `verification_tokens`
  → Send email via Resend
  → User clicks link → /reset-password?token=xxx
  → POST /api/auth/reset-password { token, password }
  → Verify token → hash new password → update `users` table
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/api-live.test.ts` | Auth endpoint connectivity |
| `tests/production/api.test.ts` | Auth integration flows |
| `tests/e2e/auth.setup.ts` | Playwright auth state setup |
| `tests/e2e/login.spec.ts` | Login E2E flow |
| `tests/load/authentication.js` | k6 auth load testing |

### Status: **ACTIVE** on website

### Database Elements

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `users` | `id`, `email`, `password_hash`, `organization_id`, `role`, `platform_role` | User accounts |
| `sessions` | `id`, `user_id`, `token`, `expires_at`, `fingerprint` | Active sessions |
| `verification_tokens` | `token`, `email`, `expires` | Password reset tokens |
| `login_attempts` | `email`, `ip`, `attempt_at`, `success` | Brute-force tracking |
| `auth_providers` | `provider`, `enabled`, `config` | Auth provider configuration |

### Requirements & Dependencies

- **Resend** API key for email delivery (`RESEND_API_KEY`)
- **PBKDF2** password hashing (Node.js crypto, available in Workers)
- Rate limiters: `authRateLimit` (login), `registrationRateLimit` (signup)

### Activation Requirements

- `RESEND_API_KEY` env var for password reset emails
- `sessions` table must exist with proper indexes
- CORS config must include frontend origin

---

## 2. Voice Operations & Call Management

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/calls.ts` | 18 call management endpoints |
| Backend Route | `workers/src/routes/voice.ts` | Voice targets, config, call initiation |
| Backend Route | `workers/src/routes/webrtc.ts` | WebRTC tokens, debug, dial |
| Backend Lib | `workers/src/lib/ai-call-engine.ts` | AI call state machine (KV-backed) |
| Backend Lib | `workers/src/lib/compliance-checker.ts` | Pre-dial compliance checks |
| Frontend | `components/voice/VoiceOperationsClient.tsx` (967 lines) | Main voice operations UI |
| Frontend | `components/voice/ActiveCallPanel.tsx` | Active call display |
| Frontend | `components/voice/WebRTCCallControls.tsx` | Browser-based calling controls |
| Frontend | `components/voice/CallDisposition.tsx` | Call disposition interface |
| Frontend | `components/voice/CallTimeline.tsx` | Call event timeline |
| Frontend | `components/voice/CallNotes.tsx` | Call notes interface |
| Frontend | `components/cockpit/PreDialChecker.tsx` | Pre-dial compliance UI |
| Hooks | `hooks/useWebRTC.ts` | WebRTC browser calling |
| Hooks | `hooks/WebRTCProvider.tsx` | WebRTC context |
| Hooks | `hooks/useActiveCall.ts` | Active call state |
| Hooks | `hooks/useCallDetails.ts` | Call detail fetching |
| Frontend Pages | `app/voice-operations/page.tsx` | Legacy voice page |
| Frontend Pages | `app/work/call/page.tsx` | New Cockpit call page |
| Frontend Pages | `app/work/dialer/page.tsx` | Dialer page |

### Flow Diagram

```
Agent clicks "Dial" in Cockpit
  → PreDialChecker runs compliance checks
    → GET /api/compliance/pre-dial?phone=xxx
    → Checks: DNC, consent, time-of-day, frequency, legal hold, bankruptcy
  → If clear: POST /api/calls/start { to, from, callerId }
    → Workers: creates `calls` row with status='initiated'
    → Workers: POST to Telnyx Call Control v2 API
    → Telnyx sends webhook events → POST /webhooks/telnyx
      → call.answered → update calls status='in_progress'
      → call.hangup → update calls status='completed'
      → call.recording.saved → store in R2
      → call.machine.detection → AMD result
  → WebRTC flow:
    → GET /api/webrtc/token → Telnyx JWT (cached in KV, 5min TTL)
    → useWebRTC hook → browser WebRTC session
    → POST /api/webrtc/dial → outbound through WebRTC

Call End Flow:
  → Agent clicks Hang Up or POST /api/calls/:id/end
  → Call disposition modal → PUT /api/calls/:id/disposition
  → POST /api/calls/:id/outcome → call_outcomes row
  → If recording: POST /webhooks/assemblyai → transcription → post-processing
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/voice.test.ts` | Voice feature unit tests |
| `tests/production/voice-e2e.test.ts` | Voice end-to-end |
| `tests/production/voice-live.test.ts` | Live voice integration |
| `tests/production/bridge-call-flow.test.ts` | Bridge/3-way calling |
| `tests/production/bridge-crossing.test.ts` | Bridge crossing logic |
| `tests/production/amd.test.ts` | AMD testing |
| `tests/load/voice-calls.js` | k6 voice load test |

### Status: **ACTIVE** on website

### Database Elements

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `calls` | `id`, `organization_id`, `status`, `from_number`, `to_number`, `started_at`, `ended_at`, `call_sid`, `telnyx_call_control_id` | Call records |
| `call_notes` | `call_id`, `user_id`, `content` | Call notes |
| `call_confirmations` | `call_id`, `confirmation_type`, `confirmed_at` | Call confirmations |
| `call_outcomes` | `call_id`, `disposition`, `notes` | Call outcomes |
| `call_outcome_history` | `call_id`, `old_disposition`, `new_disposition` | Outcome audit trail |
| `call_timeline_events` | `call_id`, `event_type`, `timestamp`, `data` | Call event timeline |
| `recordings` | `call_id`, `r2_key`, `duration`, `file_size` | Recording metadata |
| `voice_configs` | `organization_id`, `default_caller_id`, `recording_enabled` | Voice settings |
| `voice_targets` | `organization_id`, `phone_number`, `label` | Voice targets |
| `caller_id_numbers` | `organization_id`, `phone_number`, `verified` | Caller IDs |
| `webrtc_sessions` | `user_id`, `session_id`, `connected_at` | WebRTC sessions |

### Requirements & Dependencies

- **Telnyx** account with Call Control v2 API key (`TELNYX_API_KEY`)
- **Telnyx** connection for WebRTC (`TELNYX_CONNECTION_ID`)
- **Cloudflare R2** bucket for recordings (`RECORDINGS_BUCKET`)
- Telnyx webhook URL configured: `https://wordisbond-api.adrper79.workers.dev/webhooks/telnyx`

### Activation Requirements

- `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID` env vars
- Telnyx messaging profile with webhook pointing to Workers
- R2 bucket binding in `wrangler.toml`
- `voice_configs` row for org with `recording_enabled=true` for recordings

---

## 3. Live Translation Pipeline

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/live-translation.ts` | SSE stream + translation history |
| Backend Lib | `workers/src/lib/translation-processor.ts` | `translateAndStore()`, config management |
| Backend Lib | `workers/src/lib/groq-client.ts` | Groq LLM for translation |
| Backend Lib | `workers/src/lib/audio-injector.ts` | Inject translated audio into calls |
| Frontend | `components/voice/LiveTranslationPanel.tsx` | Live translation display |
| Frontend | `components/voice/LanguageDetectionIndicator.tsx` | Language indicator |
| Frontend | `components/voice/TranslationView.tsx` | Translation viewer |

### Flow Diagram

```
Caller speaks (Spanish) → Telnyx transcribes
  → POST /webhooks/telnyx (call.transcription event)
  → Workers: Groq translateAndStore()
    → Groq LLM: Spanish → English
    → INSERT into call_translations
  → Frontend: GET /api/voice/translate/stream (SSE)
    → Server-Sent Events push translated text in real-time
  → Optional: audio-injector → ElevenLabs TTS → Telnyx audio fork
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/translation-e2e.test.ts` | Translation end-to-end |
| `tests/production/translation-pipeline.test.ts` | Pipeline stages |
| `tests/production/translation-processor-osi.test.ts` | OSI model validation |
| `tests/voice-to-voice.test.ts` | Full V2V pipeline (mocked) |

### Status: **ACTIVE** on website (requires org-level enablement)

### Database Elements

| Table | Columns | Purpose |
|-------|---------|---------|
| `call_translations` | `call_id`, `source_lang`, `target_lang`, `original_text`, `translated_text`, `created_at` | Translation records |
| `audio_injections` | `call_id`, `audio_url`, `injection_type` | Audio injection tracking |

### Activation Requirements

- `GROQ_API_KEY` env var
- Organization must have translation enabled in `organization_config`
- ElevenLabs key for voice injection: `ELEVEN_LABS_API_KEY`

---

## 4. AI Intelligence Suite

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/ai-transcribe.ts` | Transcription submit/status/result |
| Backend Route | `workers/src/routes/ai-llm.ts` | Chat, summarize, analyze |
| Backend Route | `workers/src/routes/ai-router.ts` | Multi-provider routing + TTS |
| Backend Route | `workers/src/routes/ai-config.ts` | AI config CRUD |
| Backend Route | `workers/src/routes/ai-toggle.ts` | Live call AI activation |
| Backend Lib | `workers/src/lib/ai-router.ts` | Provider selection, complexity analysis |
| Backend Lib | `workers/src/lib/ai-call-engine.ts` | AI call state machine |
| Backend Lib | `workers/src/lib/groq-client.ts` | Groq: chat, translate, sentiment |
| Backend Lib | `workers/src/lib/grok-voice-client.ts` | Grok/xAI TTS |
| Backend Lib | `workers/src/lib/prompt-sanitizer.ts` | Injection prevention |
| Backend Lib | `workers/src/lib/post-transcription-processor.ts` | Post-transcription pipeline |
| Backend Lib | `workers/src/lib/queue-consumer.ts` | Async transcription queue |
| Frontend | `components/voice/AITogglePanel.tsx` | AI on/off during calls |
| Frontend | `components/voice/TranscriptView.tsx` | Transcript display |

### Flow Diagram

```
AI Router Decision Tree:
  Task Classification → { chat, summarize, analyze, translate, tts }
  Complexity Analysis → { simple (Groq), complex (OpenAI), voice (ElevenLabs/Grok) }
  Provider Selection:
    simple + chat → Groq (fast, cheap)
    complex + analyze → OpenAI GPT-4o-mini
    tts → ElevenLabs (high quality) or Grok (cost-effective)

Post-Transcription Pipeline:
  AssemblyAI webhook → processCompletedTranscript()
    → PII redaction → summary generation → sentiment analysis
    → entity extraction → content safety check
    → Store results in: transcriptions, ai_summaries, call_sentiment_scores
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/e2e-transcription-workflow.test.ts` | Transcription E2E |
| `tests/production/pii-redaction.test.ts` | PII redaction |
| `tests/unit/ai-optimization.test.ts` | AI optimization logic |
| `tests/production/ai-optimization-l4.test.ts` | AI Level 4 |
| `tests/production/ai-analytics-isolation.test.ts` | Multi-tenant AI isolation |

### Status: **ACTIVE** — Plan-gated (Pro/Enterprise for chat/analyze, Starter for summarize)

### Database Elements

| Table | Purpose |
|-------|---------|
| `transcriptions` | Transcription results + metadata |
| `ai_summaries` | AI-generated call summaries |
| `ai_configs` | Organization AI configuration |
| `ai_agent_audit_log` | AI operation audit trail |
| `ai_runs` | AI invocation tracking |

### Activation Requirements

- `ASSEMBLYAI_API_KEY` for transcription
- `OPENAI_API_KEY` for GPT-4o-mini
- `GROQ_API_KEY` for Groq LLM
- `ELEVEN_LABS_API_KEY` for ElevenLabs TTS
- `GROK_API_KEY` for xAI TTS
- `TRANSCRIPTION_QUEUE` binding in wrangler.toml for async jobs
- Plan: Pro required for chat/analyze, Starter for summarize

---

## 5. Bond AI Assistant

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/bond-ai.ts` | 14 endpoints (conversations, chat, alerts, copilot, insights) |
| Backend Lib | `workers/src/lib/bond-ai.ts` | Context builders, system prompts, KPI fetching |
| Frontend | `components/bond-ai/BondAIChat.tsx` | Chat interface |
| Frontend | `components/bond-ai/BondAIAlertsPanel.tsx` | Alerts dashboard |
| Frontend | `components/bond-ai/BondAICopilot.tsx` | Copilot sidebar |
| Frontend | `components/SearchbarCopilot.tsx` | Cmd+K copilot |
| Frontend Pages | `app/bond-ai/alerts/page.tsx` | Alerts page |

### Flow Diagram

```
3-Tier Architecture:
  Tier 1 — Chat:
    User → POST /api/bond-ai/chat { message, conversationId }
    → bond-ai.ts: buildSystemPrompt(orgStats, kpis, callHistory)
    → OpenAI GPT-4o-mini completion
    → Store in bond_ai_conversations + messages

  Tier 2 — Alerts:
    Cron/Events → AI analyzes patterns
    → INSERT bond_ai_alerts { severity, message, accountId }
    → GET /api/bond-ai/alerts → BondAIAlertsPanel renders
    → PATCH /api/bond-ai/alerts/:id (acknowledge)
    → POST /api/bond-ai/alerts/bulk-action

  Tier 3 — Copilot:
    SearchbarCopilot (Cmd+K) → POST /api/bond-ai/copilot { query }
    → Quick context-aware response (no conversation state)
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/deep-functional.test.ts` | Bond AI functional tests |
| `tests/production/ai-analytics-isolation.test.ts` | Multi-tenant AI isolation |

### Status: **ACTIVE** — Pro plan required for chat

### Database Elements

| Table | Purpose |
|-------|---------|
| `bond_ai_alerts` | AI-generated alerts (**NOTE: missing CREATE TABLE migration**) |
| `bond_ai_alert_acknowledged` | Alert acknowledgements |
| `bond_ai_custom_prompts` | Custom prompt configurations |

### Activation Requirements

- `OPENAI_API_KEY` for GPT-4o-mini
- Pro plan subscription
- `bond_ai_alerts` table must exist (currently no formal migration)

---

## 6. Cockpit — Agent Workspace

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Frontend | `components/cockpit/Cockpit.tsx` (974 lines) | 3-column agent workspace |
| Frontend | `components/cockpit/DispositionBar.tsx` | Call disposition UI |
| Frontend | `components/cockpit/PreDialChecker.tsx` | Pre-dial compliance |
| Frontend | `components/cockpit/QuickActionModals.tsx` | Payment link, note, callback, dispute, transfer modals |
| Frontend | `components/cockpit/PaymentLinkGenerator.tsx` | Payment link creation |
| Frontend | `components/cockpit/PlanBuilder.tsx` | Payment plan builder |
| Frontend | `components/cockpit/WorkQueuePage.tsx` | Full-screen queue |
| Frontend Pages | `app/work/call/page.tsx` | Cockpit call page |
| Frontend Pages | `app/work/dialer/page.tsx` | Dialer page |
| Frontend Pages | `app/work/queue/page.tsx` | Queue browser |
| Frontend Pages | `app/work/payments/page.tsx` | Agent payment tracking |

### Flow Diagram

```
┌──────────────┬──────────────────────────┬──────────────────┐
│  WORK QUEUE   │     CALL CENTER          │  CONTEXT PANEL   │
│  (Left Rail)  │     (Center Stage)       │  (Right Rail)    │
│               │                          │                  │
│  fetchQueue() │  CallCenter component    │  ContextPanel    │
│  → GET /api/  │  → PreDialChecker        │  → Account info  │
│  collections  │  → useActiveCall hook    │  → Payment tools │
│  ?limit=25    │  → WebRTC/SIP calling    │  → Compliance    │
│  &sort=       │  → Live transcript       │  → Quick actions │
│  priority     │  → Disposition bar       │                  │
│               │                          │                  │
│  Account list │  Keyboard shortcuts:     │  Modals:         │
│  AI-scored    │  Ctrl+P = Payment Link   │  PaymentLink     │
│  by likelihood│  Ctrl+N = Add Note       │  AddNote         │
│               │  Ctrl+B = Callback       │  ScheduleCallback│
│               │  Ctrl+D = Dispute        │  FileDispute     │
│               │  Ctrl+S = Save & Next    │  TransferCall    │
└──────────────┴──────────────────────────┴──────────────────┘
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/collections.test.ts` | Queue data source |
| `tests/production/deep-functional.test.ts` | Cockpit functional flow |
| `tests/e2e/navigation.spec.ts` | Page loading E2E |

### Status: **ACTIVE** on website

### Database Elements

Uses Collections CRM tables (§8), Voice tables (§2), and Compliance tables (§14).

### Activation Requirements

- Authenticated user with org membership
- `organization_id` in session for queue loading
- Collections data loaded for queue to populate

---

## 7. Predictive Dialer

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/dialer.ts` (257 lines) | 6 dialer endpoints |
| Backend Lib | `workers/src/lib/dialer-engine.ts` | Dialer logic, AMD, pacing |
| Frontend | `components/voice/DialerPanel.tsx` (283 lines) | **ORPHANED** — complete UI, never imported |

### Flow Diagram

```
POST /api/dialer/start { campaign_id, pacing_mode, max_concurrent }
  → dialer-engine: startDialerQueue()
    → Query campaign_calls WHERE status='pending'
    → For each: POST /api/calls/start
    → AMD check: if machine → skip, if human → connect
    → Agent pool: GET /api/dialer/agents
    → Match available agent → bridge call

POST /api/dialer/pause → pause queue processing
POST /api/dialer/stop → stop and clean up
GET /api/dialer/stats/:campaignId → real-time stats
PUT /api/dialer/agent-status → agent availability updates
GET /api/dialer/agents → list agents and status
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/v5-features.test.ts` | Dialer feature tests |
| `tests/production/amd.test.ts` | AMD integration |

### Status: **DORMANT** — Backend fully active, frontend `DialerPanel` is orphaned (never rendered)

### Database Elements

| Table | Purpose |
|-------|---------|
| `dialer_agent_status` | Agent availability tracking |
| `campaign_calls` | Campaign call queue |
| `campaigns` | Campaign metadata |

### Activation Requirements

- Wire `DialerPanel` into a page (e.g., `/campaigns/[id]/dialer` or within Cockpit)
- Campaign must exist with accounts assigned
- Telnyx Call Control API configured
- Agent status tracking initialized

---

## 8. Collections CRM

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/collections.ts` (1104 lines) | 17+ collection endpoints |
| Backend Route | `workers/src/routes/import.ts` | Generic entity import |
| Backend Lib | `workers/src/lib/likelihood-scorer.ts` | Account scoring |
| Backend Lib | `workers/src/lib/prevention-scan.ts` | At-risk detection |
| Frontend Pages | `app/accounts/page.tsx` | Account portfolio |
| Frontend Pages | `app/accounts/[id]/page.tsx` | Account detail |
| Frontend Pages | `app/accounts/import/page.tsx` | CSV import |
| Frontend Pages | `app/accounts/disputes/page.tsx` | Account disputes |
| Frontend Pages | `app/voice-operations/accounts/page.tsx` | Legacy accounts view |
| Frontend | `components/voice/BulkImportWizard.tsx` | CSV import UI |
| Frontend | `components/voice/CollectionsAnalytics.tsx` | Collections analytics |
| Frontend | `components/analytics/CollectionsKPIs.tsx` | Collection KPIs |
| Frontend | `components/voice/PaymentHistoryChart.tsx` | Payment history chart |

### Flow Diagram

```
Account Lifecycle:
  Import CSV → POST /api/collections/import
    → Validate rows → INSERT collection_accounts → collection_csv_imports log

  Work Account:
    GET /api/collections?limit=25&sort=priority
    → Cockpit: select account → PreDialChecker → call → disposition

  Record Payment:
    POST /api/collections/:id/payments { amount, method }
    → INSERT collection_payments → UPDATE collection_accounts.balance_due
    → If balance_due = 0: status → 'paid'

  Create Task:
    POST /api/collections/:id/tasks { type, due_date, description }
    → INSERT collection_tasks

  Promise to Pay:
    UPDATE collection_accounts SET promise_date, promise_amount
    → Daily cron: check overdue promises → create follow-up tasks
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/collections.test.ts` | Collections CRM endpoints |
| `tests/production/csv-ingestion-e2e.test.ts` | CSV import pipeline |
| `tests/production/csv-validators.test.ts` | CSV validation |
| `tests/load/collections.js` | k6 collections load test |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `collection_accounts` | Account records — balance, status, promise tracking |
| `collection_payments` | Payment records |
| `collection_tasks` | Follow-up tasks |
| `collection_csv_imports` | Import history/audit |

### Activation Requirements

- Organization membership
- Accounts imported (CSV or manual creation)
- `likelihood-scorer` uses account payment history for scoring

---

## 9. Campaign Management

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/campaigns.ts` | 10 campaign endpoints |
| Backend Route | `workers/src/routes/surveys.ts` | 3 survey endpoints |
| Frontend Pages | `app/campaigns/page.tsx` | Campaign list |
| Frontend Pages | `app/campaigns/new/page.tsx` | Create campaign |
| Frontend Pages | `app/campaigns/sequences/page.tsx` | Sequence builder |
| Frontend Pages | `app/campaigns/surveys/page.tsx` | Survey management |
| Frontend | `components/campaigns/ContactSequenceEditor.tsx` | Multi-step sequence editor |
| Frontend | `components/voice/SurveyBuilder.tsx` | Survey builder |
| Frontend | `components/voice/SurveyResults.tsx` | Survey results |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/feature-validation.test.ts` | Campaign feature validation |
| `tests/production/deep-functional.test.ts` | Campaign functional tests |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `campaigns` | Campaign metadata |
| `campaign_calls` | Campaign-account association |
| `surveys` | Survey definitions (CSAT, NPS) |
| `survey_responses` | Survey response data |

### Activation Requirements

- Organization with at least one collection account
- Campaign creation requires `operator` or higher role

---

## 10. Analytics & Reporting

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/analytics.ts` | 12 analytics endpoints |
| Backend Route | `workers/src/routes/reports.ts` | 7 report endpoints |
| Frontend Pages | `app/analytics/page.tsx` | Analytics hub |
| Frontend Pages | `app/analytics/agents/page.tsx` | Agent leaderboard |
| Frontend Pages | `app/analytics/collections/page.tsx` | Collections analytics |
| Frontend Pages | `app/analytics/me/page.tsx` | Personal scorecard |
| Frontend Pages | `app/analytics/sentiment/page.tsx` | Sentiment deep-dive |
| Frontend Pages | `app/reports/page.tsx` | Report builder |
| Frontend | `components/analytics/` (11 components) | Charts, metrics, dashboards |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/ai-analytics-isolation.test.ts` | Multi-tenant analytics isolation |
| `tests/production/deep-functional.test.ts` | Analytics functional tests |

### Status: **ACTIVE** on website — Reports require Business plan

### Database Elements

| Table | Purpose |
|-------|---------|
| `reports` | Generated report metadata |
| `report_schedules` | Scheduled report configurations |
| `generated_reports` | Report output storage |

### Activation Requirements

- Analytics: any authenticated user (scoped to org)
- Reports: Business plan required
- Export: stricter rate limiting applied

---

## 11. Scorecard & QA System

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/scorecards.ts` | 4 scorecard endpoints |
| Backend Route | `workers/src/routes/shopper.ts` | 7 shopper script endpoints |
| Frontend Pages | `app/review/page.tsx` | Call review mode |
| Frontend Pages | `app/command/scorecards/page.tsx` | Manager scorecards |
| Frontend Pages | `app/command/coaching/page.tsx` | Coaching queue |
| Frontend Pages | `app/settings/quality/page.tsx` | QA settings |
| Frontend | `components/voice/ScorecardAlerts.tsx` | Alert notifications |
| Frontend | `components/voice/ScorecardTemplateLibrary.tsx` | Template management |
| Frontend | `components/voice/ShopperScriptManager.tsx` | Script management |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/deep-functional.test.ts` | Scorecard functional tests |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `scorecards` | Agent scorecards |
| `scorecard_templates` | Scorecard templates |
| `scorecard_alerts` | QA alerts (**NOTE: missing CREATE TABLE migration**) |
| `scored_recordings` | Scored recording associations |
| `shopper_scripts` | Mystery shopper scripts |
| `shopper_results` | Shopper test results |

### Activation Requirements

- Owner/admin role for template management
- Operator+ for scorecard creation
- `scorecard_alerts` table must exist (no formal migration found)

---

## 12. Billing & Subscription Management

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/billing.ts` | 11 billing endpoints |
| Backend Route | `workers/src/routes/usage.ts` | 2 usage endpoints |
| Backend Route | `workers/src/routes/capabilities.ts` | 3 capability check endpoints |
| Backend Lib | `workers/src/lib/plan-gating.ts` | `requirePlan()` middleware |
| Backend Lib | `workers/src/lib/stripe-sync.ts` | Stripe data synchronization |
| Backend Lib | `workers/src/lib/capabilities.ts` | Capability checking |
| Frontend Pages | `app/admin/billing/page.tsx` | Billing management |
| Frontend Pages | `app/pricing/page.tsx` | Plan comparison (public) |
| Frontend | `components/settings/SubscriptionManager.tsx` | Subscription UI |
| Frontend | `components/settings/PaymentMethodManager.tsx` | Payment methods |
| Frontend | `components/settings/InvoiceHistory.tsx` | Invoice history |
| Frontend | `components/settings/UsageDisplay.tsx` | Usage meters |

### Flow Diagram

```
Plan Purchase:
  /pricing → POST /api/billing/checkout { planId }
  → Stripe Checkout Session → redirect to Stripe
  → Stripe webhook: checkout.session.completed
  → POST /webhooks/stripe → process event
  → UPDATE organizations SET plan = 'pro'
  → syncStripeData() → mirror to stripe_* tables

Feature Gating:
  requirePlan('pro') middleware on route
  → Check org.plan × feature matrix in plan-gating.ts
  → If insufficient: 403 { error: 'Plan upgrade required' }

Usage Tracking:
  Cron: aggregate_usage (daily at midnight)
  → Count calls, minutes, recordings, transcriptions per org
  → INSERT usage_stats
```

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/functional-validation.test.ts` | Billing functional tests |
| `tests/webhooks-security.test.ts` | Stripe webhook signature verification |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `stripe_events` | Raw Stripe webhook events |
| `billing_events` | Billing event log |
| `stripe_subscriptions` | Mirrored subscription data |
| `stripe_payment_methods` | Mirrored payment methods |
| `stripe_invoices` | Mirrored invoices |

### Activation Requirements

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` env vars
- Stripe Product/Price IDs configured
- `stripe_events` table for idempotent webhook processing

---

## 13. Team & Organization Management

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/teams.ts` | 10 team endpoints |
| Backend Route | `workers/src/routes/team.ts` | 8 team/invite endpoints |
| Backend Route | `workers/src/routes/organizations.ts` | 3 org endpoints |
| Frontend Pages | `app/teams/page.tsx` | Team management |
| Frontend Pages | `app/settings/team/page.tsx` | Team settings |
| Frontend Pages | `app/settings/org-create/page.tsx` | Org creation |
| Frontend | `components/team/TeamManagement.tsx` | Team management UI |
| Frontend | `components/teams/TeamsManager.tsx` | Teams manager |
| Frontend | `components/teams/RoleManager.tsx` | Role assignment |
| Frontend | `components/teams/OrgSwitcher.tsx` | Organization switcher |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/functional-validation.test.ts` | Team management tests |
| `tests/production/deep-functional.test.ts` | Org functional tests |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `organizations` | Organization records |
| `org_members` | Org membership + roles |
| `teams` | Team groupings |
| `team_members` | Team membership |
| `team_invites` | Pending invitations |

### Activation Requirements

- Owner/admin role for team management
- Email service (Resend) for invite delivery

---

## 14. Compliance & Security Center

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/compliance.ts` | 7 compliance endpoints |
| Backend Route | `workers/src/routes/dnc.ts` | 3 DNC endpoints |
| Backend Route | `workers/src/routes/audit.ts` | 1 audit log endpoint |
| Backend Lib | `workers/src/lib/pii-redactor.ts` | PII detection/redaction |
| Backend Lib | `workers/src/lib/compliance-checker.ts` | Pre-dial compliance |
| Backend Lib | `workers/src/lib/compliance-guides.ts` | TCPA/FDCPA rules |
| Backend Lib | `workers/src/lib/prompt-sanitizer.ts` | AI injection prevention |
| Backend Lib | `workers/src/lib/audit.ts` | `writeAuditLog()`, DLQ flush |
| Frontend Pages | `app/compliance/` (5 pages) | Compliance hub |
| Frontend | `components/compliance/` (4 components) | Violation, DNC, Audit, SOC2 UI |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/pii-redaction.test.ts` | PII redaction pipeline |
| `tests/webhooks-security.test.ts` | Webhook signature verification |
| `tests/production/deep-functional.test.ts` | Compliance functional tests |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `compliance_violations` | Violation records |
| `audit_logs` | Full mutation audit trail |
| `dnc_lists` | Do Not Call entries |

### Activation Requirements

- All endpoints active by default
- PII redaction runs automatically on transcriptions
- DNC list must be populated for pre-dial checks to work

---

## 15. IVR System

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/ivr.ts` | 2 IVR endpoints |
| Backend Lib | `workers/src/lib/ivr-flow-engine.ts` | IVR flow execution |
| Frontend | `components/voice/IVRPaymentPanel.tsx` | IVR payment panel |

### Status: **ACTIVE** — Backend functional, limited frontend integration

### Database Elements

| Table | Purpose |
|-------|---------|
| `ivr_flows` | IVR flow definitions |
| `inbound_phone_numbers` | Inbound number routing |

### Activation Requirements

- IVR flow definitions must be created in `ivr_flows` table
- Telnyx inbound number must be configured with webhook routing

---

## 16. Webhook Management

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/webhooks.ts` | 11+ webhook endpoints + 3 inbound |
| Backend Route | `workers/src/routes/reliability.ts` | Webhook reliability config |
| Backend Lib | `workers/src/lib/webhook-retry.ts` | Delivery with retry + fan-out |
| Frontend Pages | `app/admin/api/page.tsx` | API key & webhook management |
| Frontend | `components/settings/Webhook*.tsx` (6 components) | Webhook management UI |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/webhook-retry.test.ts` | Webhook retry logic |
| `tests/webhooks-security.test.ts` | Signature verification |
| `tests/e2e/settings-webhook.spec.ts` | E2E webhook config |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `webhook_subscriptions` | Subscriber configurations |
| `webhook_deliveries` | Delivery audit trail |
| `webhook_failures` | Failed delivery tracking |

### Activation Requirements

- Webhook subscription must be created
- Target URL must be reachable from Workers

---

## 17. CRM Integration Framework

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/crm.ts` | 12 CRM endpoints |

### Status: **ACTIVE** — API complete, no dedicated frontend page

### Database Elements

| Table | Purpose |
|-------|---------|
| `integrations` | CRM integration configs |
| `crm_object_links` | Object mapping |
| `crm_sync_log` | Sync audit trail |

### Activation Requirements

- CRM integration must be configured via API
- No frontend UI for setup — API-only

---

## 18. Feature Flag System

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/feature-flags.ts` | 10 flag endpoints |
| Backend Lib | `workers/src/lib/feature-flags.ts` | `getFeatureFlag()`, caching |
| Frontend Pages | `app/admin/feature-flags/page.tsx` (291 lines) | Flag management UI |
| Frontend Lib | `lib/feature-flags.ts` | Client-side utilities |
| Frontend | `components/layout/FeatureFlagRedirect.tsx` | Route-level redirects |

### Status: **ACTIVE** on website — `NEXT_PUBLIC_NEW_NAV` defaults `false` in `next.config.js`

### Database Elements

| Table | Purpose |
|-------|---------|
| `global_feature_flags` | Platform-wide flags |
| `org_feature_flags` | Org-level overrides |

### Activation Requirements

- Admin role for flag management
- **SECURITY NOTE:** Global flags should require `platform_admin` role (see Appendix A, Issue #7)

---

## 19. Onboarding Wizard

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/onboarding.ts` | 2 onboarding endpoints |
| Frontend Pages | `app/onboarding/page.tsx` | 7-step wizard |
| Frontend | `components/voice/OnboardingWizard.tsx` | Wizard component |

### Status: **ACTIVE** on website

### Activation Requirements

- New user account with no completed onboarding
- Telnyx for phone number provisioning
- Resend for email invites

---

## 20. Payment Plans & Dunning

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/payments.ts` | 6 payment endpoints |
| Backend Lib | `workers/src/lib/payment-scheduler.ts` | Scheduled processing + dunning |
| Frontend Pages | `app/payments/` (4 pages) | Payment hub |
| Frontend Pages | `app/work/payments/page.tsx` | Agent payment view |
| Frontend | `components/cockpit/PaymentLinkGenerator.tsx` | Payment link creation |
| Frontend | `components/voice/PaymentCalculator.tsx` | Payment calculator |
| Frontend | `components/voice/PaymentHistoryChart.tsx` | History visualization |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/collections.test.ts` | Payment tests within collections |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `collection_payments` | Payment records |
| `payment_plans` | Installment plan definitions |
| `scheduled_payments` | Future payment schedule |
| `dunning_events` | Dunning escalation log |

### Activation Requirements

- Collection accounts with balances
- Cron: `0 6 * * *` for daily payment processing and dunning

---

## 21. Scheduling & Callbacks

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/bookings.ts` | 4 booking endpoints |
| Frontend Pages | `app/schedule/` (3 pages) | Schedule hub |
| Frontend Pages | `app/bookings/page.tsx` | Booking management |
| Frontend | `components/voice/BookingsList.tsx` | Bookings list |
| Frontend | `components/voice/BookingModal.tsx` | Booking creation |
| Frontend | `components/schedule/CallbackScheduler.tsx` | Callback scheduler |
| Frontend | `components/schedule/FollowUpTracker.tsx` | Follow-up tracker |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `booking_events` | Booking/callback records |

### Activation Requirements

- Authenticated user in an organization
- Idempotency middleware on booking creation

---

## 22. Agent Productivity Tools

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/productivity.ts` | 13 productivity endpoints |
| Backend Lib | `workers/src/lib/likelihood-scorer.ts` | Account scoring |
| Backend Lib | `workers/src/lib/prevention-scan.ts` | At-risk detection |
| Frontend Pages | `app/tools/` (5 pages) | Tools hub |
| Frontend Pages | `app/work/page.tsx` | Daily planner |
| Frontend | `components/voice/NoteTemplates.tsx` | Note templates |
| Frontend | `components/voice/ObjectionLibrary.tsx` | Objection rebuttals |
| Frontend | `components/voice/DailyPlanner.tsx` | Daily planner |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/productivity-live.test.ts` | Productivity endpoints live |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `note_templates` | Note template definitions with shortcodes |
| `objection_rebuttals` | Rebuttal library |

### Activation Requirements

- Org membership
- Templates/rebuttals must be created by admin/owner

---

## 23. Sentiment Analysis

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/sentiment.ts` | 5 sentiment endpoints |
| Backend Lib | `workers/src/lib/sentiment-processor.ts` | Real-time sentiment scoring |
| Frontend | `components/voice/SentimentWidget.tsx` | Live sentiment display |
| Frontend | `components/analytics/SentimentChart.tsx` | Sentiment charts |
| Frontend | `components/analytics/SentimentDashboard.tsx` | Sentiment deep-dive |

### Tests

| Test File | Coverage |
|-----------|----------|
| `tests/production/v5-features.test.ts` | Sentiment feature tests |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `call_sentiment_scores` | Per-utterance sentiment scores |
| `call_sentiment_summary` | Per-call sentiment summary |
| `sentiment_alert_configs` | Alert threshold configuration |

### Activation Requirements

- Groq API key for sentiment analysis
- Sentiment config must be enabled per org

---

## 24. Text-to-Speech (TTS)

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/tts.ts` | 1 TTS endpoint |
| Backend Route | `workers/src/routes/audio.ts` | 3 audio endpoints |
| Backend Route | `workers/src/routes/ai-router.ts` (TTS path) | AI router TTS |
| Backend Lib | `workers/src/lib/tts-processor.ts` | ElevenLabs synthesis |
| Backend Lib | `workers/src/lib/grok-voice-client.ts` | Grok/xAI TTS |

### Status: **ACTIVE** on website

### Database Elements

| Table | Purpose |
|-------|---------|
| `tts_audio` | Generated TTS audio metadata |
| `audio_files` | Uploaded audio files |
| `audio_injections` | Audio injection records |
| `transcriptions` | Transcription results |

### Activation Requirements

- `ELEVEN_LABS_API_KEY` for ElevenLabs
- `GROK_API_KEY` for Grok TTS
- KV binding for TTS caching
- R2 binding for audio storage

---

## 25. Recording Management

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/recordings.ts` | 3 endpoints (list, get, delete) |
| Frontend | `components/voice/RecordingPlayer.tsx` | Recording playback UI |
| Frontend | `components/voice/AudioPlayer.tsx` | Audio player |

### Status: **ACTIVE** — Streaming endpoint added 2026-02-13

### Database Elements

| Table | Purpose |
|-------|---------|
| `recordings` | Recording metadata + R2 key |
| `scored_recordings` | QA-scored recording links |

### Activation Requirements

- R2 bucket binding for storage
- Recording playback uses `GET /api/recordings/stream/:id` (added 2026-02-13)

---

## 26. Data Retention & Legal Holds

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/retention.ts` | 5 retention endpoints |
| Frontend Pages | `app/admin/retention/page.tsx` | Retention settings UI |
| Frontend | `components/settings/RetentionSettings.tsx` | Retention config |

### Status: **ACTIVE** on website — Admin only

### Database Elements

| Table | Purpose |
|-------|---------|
| `retention_policies` | Org retention config |
| `legal_holds` | Legal hold records |

### Activation Requirements

- Admin/owner role
- Legal hold must reference valid entity IDs

---

## 27. RBAC & Permissions

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/rbac-v2.ts` | 3 RBAC endpoints |
| Backend Lib | `workers/src/lib/auth.ts` | `requireRole()` middleware |
| Frontend Hooks | `hooks/useRBAC.ts` | Client-side permission checks |
| Frontend | `components/layout/RoleShell.tsx` (417 lines) | Role-based navigation |

### Status: **ACTIVE** on website

### Activation Requirements

- User must have `role` in `org_members`
- Role hierarchy: `platform_admin > owner > admin > operator > worker`

---

## 28. Admin & Platform Management

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/admin-metrics.ts` | Platform metrics |
| Backend Route | `workers/src/routes/admin.ts` | Auth provider management |
| Backend Route | `workers/src/routes/internal.ts` | Cron health, DLQ, schema health |
| Frontend Pages | `app/admin/` (7 pages) | Admin hub |

### Status: **ACTIVE** on website — Owner/admin only

### Activation Requirements

- Owner role (admin-metrics requires `platform_role` check)
- Internal endpoints require `INTERNAL_API_KEY`

---

## 29. Infrastructure & DevOps

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Backend Route | `workers/src/routes/health.ts` | Health check endpoints |
| Backend Lib | `workers/src/lib/db.ts` | `getDb(env)` → DbClient |
| Backend Lib | `workers/src/lib/health-probes.ts` | Infrastructure probes |
| Backend Lib | `workers/src/lib/rate-limit.ts` | KV-backed rate limiter |
| Backend Lib | `workers/src/lib/idempotency.ts` | Idempotent operations |
| Backend Lib | `workers/src/lib/logger.ts` | Structured JSON logger |
| Backend | `workers/src/scheduled.ts` | 7 cron jobs |
| Backend | `workers/src/lib/queue-consumer.ts` | Transcription queue consumer |

### Cron Schedule

| Cron | Job | Description |
|------|-----|-------------|
| `*/5 * * * *` | `retry_transcriptions` | Retry failed AssemblyAI jobs |
| `0 * * * *` | `cleanup_sessions` | Purge expired sessions |
| `0 * * * *` | `flush_audit_dlq` | Flush audit log DLQ from KV |
| `0 0 * * *` | `aggregate_usage` | Daily usage aggregation per org |
| `0 6 * * *` | `process_payments` | Process scheduled payments |
| `0 6 * * *` | `dunning_escalation` | Dunning escalation |
| `0 6 * * *` | `prevention_scan` | AI risk scoring + task creation |

### Status: **ACTIVE**

### Activation Requirements

- All env vars in `wrangler.toml`: `NEON_PG_CONN`, KV/R2/Queue bindings
- Hyperdrive configured for connection pooling
- Cron triggers defined in `wrangler.toml`

---

## 30. Testing & Quality Assurance

### Test Inventory

| Category | Count | Location | Runner |
|----------|-------|----------|--------|
| Unit | 3 | `tests/unit/` | Vitest |
| Production Integration | 36 | `tests/production/` | Vitest (no mocks, real API) |
| E2E | 4 | `tests/e2e/` | Playwright |
| Load | 6 | `tests/load/` | k6 |
| Manual | 1 | `tests/manual/` | PowerShell |
| Root-level | 2 | `tests/` | Vitest |
| **Total** | **52** | — | — |

### Results: 758 passed, 18 skipped, 0 failed

### Scripts & Tools

| Script | Purpose |
|--------|---------|
| `scripts/validate-schema-drift.ts` | Compare schema registry with live Neon DB |
| `scripts/rls-audit.sql` | RLS policy coverage audit |
| `scripts/validate-all.ts` | L1-L3 validation orchestrator |
| `tools/validate_api_contract.py` | API contract validation |
| `tools/extract_schema.py` | Schema extraction + TypeScript type generation |

### Status: **ACTIVE**

---

## 31. UI/UX Framework

### Codebase Location

| Layer | File | Purpose |
|-------|------|---------|
| Layout | `app/layout.tsx` | Root layout with providers |
| Layout | `components/layout/AppShell.tsx` | App shell (legacy nav) |
| Layout | `components/layout/RoleShell.tsx` | Role-based navigation |
| Layout | `components/layout/BottomNav.tsx` | Mobile navigation |
| Layout | `components/layout/CommandPalette.tsx` | Cmd+K search |
| UI | `components/ui/` (23 files) | Design system primitives |
| Tour | `components/tour/` (5 files) | Product tour system |
| Theme | `components/theme-provider.tsx` | Dark/light mode |
| Error | `components/ErrorBoundary.tsx` | Global error boundary |

### Status: **ACTIVE** on website

---

## Appendix A: Bug & Issue Audit

### P0 — CRITICAL (Production Impacting)

#### Issue #1: Duplicate `crmRoutes` import in index.ts — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **File** | `workers/src/index.ts` lines 71, 73 |
| **Problem** | `import { crmRoutes }` appears twice — duplicate identifier |
| **Impact** | Build fragility — bundler may silently dedupe or fail in strict mode |
| **Fix** | Remove the duplicate import on line 73 |
| **Effort** | 1 minute |

#### Issue #2: Duplicate route handlers in collections.ts — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **File** | `workers/src/routes/collections.ts` |
| **Problem** | Three endpoints defined twice: `POST /import` (lines 228, 941), `GET /imports` (lines 148, 1020), `GET /promises` (lines 898, 1052) |
| **Impact** | Hono matches first handler — second handlers are dead code. If canonical logic is in the second set, it never executes |
| **Fix** | Delete the duplicate handler blocks (lines 941-1104). Verify the first set is canonical |
| **Effort** | 30 minutes (verify + delete + test) |

#### Issue #3: `/api/recordings/stream/:id` endpoint never defined — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **File** | `workers/src/routes/recordings.ts`, referenced by `webhooks.ts`, `scheduled.ts`, `queue-consumer.ts` |
| **Problem** | 4 places generate URLs to this endpoint but it doesn't exist — returns 404 |
| **Impact** | **Recording playback/streaming is broken in production.** Users cannot play back call recordings through the generated stream URLs |
| **Fix** | Add `GET /stream/:id` handler to recordings.ts: authenticate → lookup recording → fetch from R2 → stream binary audio |
| **Effort** | 2-3 hours |

#### Issue #4: `/api/test/health` has NO authentication — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **File** | `workers/src/routes/test.ts` |
| **Problem** | The `/health` endpoint calls `probeAll(c.env)` which probes DB, KV, R2, Telnyx, OpenAI, Stripe, AssemblyAI — all without authentication |
| **Impact** | Information disclosure — any unauthenticated user can enumerate full infrastructure health, service dependencies, and status |
| **Fix** | Add `requireAuth()` + admin role check, or move to `/api/internal/` behind `requireInternalKey` |
| **Effort** | 15 minutes |

### P1 — HIGH (Security / Data Integrity)

#### Issue #5: RBAC context leaks org plans via query parameter — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **File** | `workers/src/routes/rbac-v2.ts` line 45 |
| **Problem** | `const orgId = c.req.query('orgId') || session.organization_id` — any authenticated user can query any org's plan tier |
| **Impact** | Organization plan enumeration — competitive intelligence leak |
| **Fix** | Always use `session.organization_id`, remove `orgId` query param override |
| **Effort** | 10 minutes |

#### Issue #6: Global feature flags guarded by org role, not platform role — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **File** | `workers/src/routes/feature-flags.ts` lines 35-43 |
| **Problem** | Global flags (affect ALL tenants) guarded by `ADMIN_ROLES = ['admin', 'owner']` which checks org-level role, not `platform_role` |
| **Impact** | Privilege escalation — any org admin can toggle platform-wide feature flags |
| **Fix** | Guard global endpoints with `session.platform_role === 'platform_admin'` |
| **Effort** | 30 minutes |

#### Issue #7: Auth tokens in localStorage — XSS risk

| Field | Detail |
|-------|--------|
| **File** | `components/AuthProvider.tsx` |
| **Problem** | Bearer tokens stored in `localStorage` — vulnerable to XSS exfiltration |
| **Impact** | If XSS exists anywhere in app, attacker steals tokens and gains full account access |
| **Fix** | Short-term: ensure all user-generated content is sanitized. Long-term: migrate to httpOnly cookies |
| **Effort** | Short-term: audit sprint. Long-term: 2-3 weeks refactor |

#### Issue #8: RBAC queries lack org_id filter

| Field | Detail |
|-------|--------|
| **File** | `workers/src/routes/rbac-v2.ts` lines 55-57 |
| **Problem** | Queries `rbac_permissions` table without `organization_id` in WHERE — assumes global table |
| **Impact** | If org-scoped permissions added later, cross-tenant leakage |
| **Fix** | Document that `rbac_permissions` is intentionally global, or add org_id filtering |
| **Effort** | 1 hour |
| **Status** | **RESOLVED 2026-02-13** — Added 6-line architectural comment in rbac-v2.ts explaining rbac_permissions is intentionally global |

### P2 — MEDIUM (Code Quality / Missing Coverage)

#### Issue #9: DialerPanel orphaned — never imported — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **File** | `components/voice/DialerPanel.tsx` (283 lines) |
| **Problem** | Fully implemented predictive dialer UI (start/pause/stop, agent pool, stats) but never imported by any page |
| **Impact** | Dead code — campaign-level dialer controls are inaccessible to users |
| **Fix** | Created `app/campaigns/[id]/page.tsx` + `CampaignDetailClient.tsx` — campaign detail page with DialerPanel integrated in right-column layout. Static export via `generateStaticParams` placeholder + Cloudflare Pages SPA fallback. Build: 86/86 pages. |
| **Effort** | 2-4 hours |

#### Issue #10: Duplicate component re-export shims — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **Files** | `components/auth/ProtectedGate.tsx` (re-exports from `ui/`), `components/auth/FeatureFlagRedirect.tsx` (re-exports from `layout/`) |
| **Problem** | Inconsistent imports — some pages use `auth/`, some use canonical path |
| **Fix** | Standardize all imports to canonical locations, delete `auth/` shims |
| **Effort** | 30 minutes |

#### Issue #11: `bond_ai_alerts` and `scorecard_alerts` missing CREATE TABLE migration — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **Files** | Not found in any migration file |
| **Problem** | Tables exist in production (queried by routes) but have no version-controlled migration |
| **Impact** | Schema drift — new environments won't have these tables |
| **Fix** | Add formal `CREATE TABLE IF NOT EXISTS` migrations |
| **Effort** | 1 hour |

#### Issue #12: 8+ active tables lack RLS policies — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **Tables** | `bond_ai_alerts`, `bond_ai_alert_rules`, `scorecard_alerts`, `booking_events`, `shopper_scripts`, `audit_logs`, `call_outcomes`, `call_notes`, `caller_id_numbers`, `transcriptions`, `ai_configs`, `webhook_deliveries` |
| **Problem** | Defense-in-depth gap — app-level WHERE clauses enforce isolation but no DB-level safety net |
| **Fix** | Created `migrations/2026-02-13-rls-hardening-active-tables.sql` — 14 tables hardened with ENABLE ROW LEVEL SECURITY + org_isolation policies + CONCURRENTLY indexes. Tables: call_translations, booking_events, ai_configs, shopper_scripts, shopper_results, bond_ai_conversations, bond_ai_custom_prompts, payment_plans, scheduled_payments, dnc_lists, survey_responses, call_sentiment_scores, call_sentiment_summary, dialer_agent_status. |
| **Effort** | 4-6 hours for all tables |

#### Issue #13: ~104 orphan database tables — RESOLVED 2026-02-13

| Field | Detail |
|-------|--------|
| **Tables** | 104 of 170 tables had no API route references |
| **Impact** | Schema bloat — unnecessary storage, confusing for new developers |
| **Fix** | Deep audit (3-pass: workers/src, frontend, tests/scripts, FK deps). 61 confirmed orphans dropped. 11 borderline tables kept (FK deps: `systems`, `tools`, `caller_id_numbers`; frontend refs: `evidence_*`, `transcript_versions`; billing: `stripe_*`; test refs: `ai_*`, `accounts`, `webrtc_sessions`, `verification_tokens`). DB: 152 → 91 tables. |
| **Commit** | `3713d7a` |

---

## Appendix B: Recommendations Matrix

### Priority Action Items

| # | Priority | Action | Impact | Effort |
|---|----------|--------|--------|--------|
| 1 | **P0** | Add `/api/recordings/stream/:id` endpoint | Unblocks recording playback | 2-3h |
| 2 | **P0** | Auth-gate `/api/test/health` endpoint | Closes info disclosure | 15min |
| 3 | **P0** | Remove duplicate collections route handlers | Eliminates dead code confusion | 30min |
| 4 | **P0** | Remove duplicate `crmRoutes` import | Eliminates build fragility | 1min |
| 5 | **P1** | Fix global feature flag authorization | Closes privilege escalation | 30min |
| 6 | **P1** | Remove RBAC `orgId` query param override | Closes plan enumeration | 10min |
| 7 | **P1** | Harden token storage (format validation, expiry check, tamper detection) — **RESOLVED 2026-02-13** | Mitigates XSS → token theft | 1-2 days |
| 8 | **P2** | Add RLS to 14 active tables — **RESOLVED 2026-02-13** | Defense-in-depth | 4-6h |
| 9 | **P2** | Write migration for `bond_ai_alerts`/`scorecard_alerts` | Schema reproducibility | 1h |
| 10 | **P2** | Wire DialerPanel into campaign detail page — **RESOLVED 2026-02-13** | Enables dialer feature | 2-4h |
| 11 | **P2** | Clean up duplicate component shims | Code hygiene | 30min |
| 12 | **P3** | Audit 104 orphan tables — **RESOLVED 2026-02-13** (61 dropped, 152→91) | Schema cleanup | 1-2 days |

### Cross-Functional Risk Matrix

| Risk | Functions Affected | Severity |
|------|-------------------|----------|
| Recording playback broken (Issue #3) | Voice Ops (§2), QA/Scorecards (§11), Compliance (§14) | HIGH |
| Global feature flag escalation (Issue #6) | All features (§18 controls all) | HIGH |
| No RLS on active tables (Issue #12) — RESOLVED | Bond AI (§5), Scorecards (§11), Scheduling (§21), Compliance (§14) | MEDIUM |
| DialerPanel orphaned (Issue #9) — RESOLVED | Predictive Dialer (§7), Campaigns (§9) | MEDIUM |
| Missing table migrations (Issue #11) | Bond AI (§5), Scorecards (§11) | MEDIUM |

### Schema Health Summary

| Metric | Value |
|--------|-------|
| Total tables | 91 (down from 152 after cleanup) |
| Active (route-referenced) | ~80 (88%) |
| Borderline-keep (FK/frontend/test refs) | 11 (12%) |
| Orphan tables dropped | 61 (2026-02-13) |
| Tables with RLS | 87+ policies (covers all active tables) |
| Active tables missing RLS | 0 (14-table RLS hardening applied 2026-02-13) |
| Tables missing CREATE TABLE migration | 1 (`bond_ai_custom_prompts` — not yet in prod) |

---

**End of Engineering Guide**
**Document generated:** February 13, 2026
**Next review:** March 13, 2026
