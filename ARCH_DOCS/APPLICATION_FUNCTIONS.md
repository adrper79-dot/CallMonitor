# Word Is Bond — Application Functions Overview

> **TOGAF Phase:** Phase B (Business Architecture) + Phase C (Information Systems Architecture)

**Last Updated:** February 13, 2026
**Platform Version:** v4.65
**Status:** Production Ready — 109/109 Roadmap Items Complete
**Audited:** Feb 13, 2026 — Full codebase analysis (82 pages, 53 route files, 260+ endpoints, 37 lib modules)

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [Voice Operations & Call Management](#2-voice-operations--call-management)
3. [Live Translation Pipeline](#3-live-translation-pipeline)
4. [AI Intelligence Suite](#4-ai-intelligence-suite)
5. [Bond AI Assistant (3-Tier)](#5-bond-ai-assistant-3-tier)
6. [Cockpit — Agent Workspace](#6-cockpit--agent-workspace)
7. [Predictive Dialer](#7-predictive-dialer)
8. [Collections CRM](#8-collections-crm)
9. [Campaign Management](#9-campaign-management)
10. [Analytics & Reporting](#10-analytics--reporting)
11. [Scorecard & QA System](#11-scorecard--qa-system)
12. [Billing & Subscription Management](#12-billing--subscription-management)
13. [Team & Organization Management](#13-team--organization-management)
14. [Compliance & Security Center](#14-compliance--security-center)
15. [IVR System](#15-ivr-system)
16. [Webhook Management](#16-webhook-management)
17. [CRM Integration Framework](#17-crm-integration-framework)
18. [Feature Flag System](#18-feature-flag-system)
19. [Onboarding Wizard](#19-onboarding-wizard)
20. [Payment Plans & Dunning](#20-payment-plans--dunning)
21. [Scheduling & Callbacks](#21-scheduling--callbacks)
22. [Agent Productivity Tools](#22-agent-productivity-tools)
23. [Sentiment Analysis](#23-sentiment-analysis)
24. [Text-to-Speech (TTS)](#24-text-to-speech-tts)
25. [Recording Management](#25-recording-management)
26. [Data Retention & Legal Holds](#26-data-retention--legal-holds)
27. [RBAC & Permissions](#27-rbac--permissions)
28. [Admin & Platform Management](#28-admin--platform-management)
29. [Infrastructure & DevOps](#29-infrastructure--devops)
30. [Testing & Quality Assurance](#30-testing--quality-assurance)
31. [UI/UX Framework](#31-uiux-framework)

---

## 1. Authentication & Session Management

- Custom session-based authentication with PBKDF2 password hashing
- CSRF protection via token endpoint
- Bearer token auth (stored in localStorage as `wb-session-token`)
- Session refresh and expiration management
- Multi-provider support (credentials, magic link stubs, Google OAuth stub)
- Password reset flow (forgot → email → reset with token)
- Rate-limited login/signup/forgot-password endpoints
- Client-side auth via `useSession()` hook from `AuthProvider`
- `ProtectedGate` component for authenticated route guarding
- API key validation for programmatic access

**Backend Routes:** `/api/auth/*` (12 endpoints)
**Frontend Pages:** `/signin`, `/signup`, `/forgot-password`, `/reset-password`

---

## 2. Voice Operations & Call Management

- Real-time voice calling via Telnyx Call Control v2 (WebRTC + PSTN)
- WebRTC browser-based calling with token management
- Call recording with automatic R2 storage
- Call bridging and 3-way conferencing
- Answering Machine Detection (AMD) via Telnyx
- Call disposition codes and outcome tracking
- Call timeline event capture (ring, answer, hold, transfer, hangup)
- Call notes and confirmations
- Call hold and transfer operations
- Call export and email sharing
- Call AI suggestions (real-time copilot)
- Pre-dial compliance checking
- Keyboard shortcuts for call handling (Ctrl+P, Ctrl+N, Ctrl+B, Ctrl+D)
- Call modulation settings

**Backend Routes:** `/api/calls/*` (18 endpoints), `/api/voice/*` (6 endpoints), `/api/webrtc/*` (3 endpoints)
**Frontend Pages:** `/voice-operations`, `/work/call`, `/work/dialer`
**Components:** `VoiceOperationsClient`, `Cockpit`, `ActiveCallPanel`, `WebRTCCallControls`, `CallDisposition`, `CallTimeline`, `CallNotes`, `PreDialChecker`

---

## 3. Live Translation Pipeline

- Real-time English ↔ Spanish translation via Groq LLM
- SSE (Server-Sent Events) streaming for live translation display
- Translation history persistence
- Audio injection of translated speech into calls
- Language detection indicator UI
- Organization-level translation configuration
- Translation processing with cost tracking

**Backend Routes:** `/api/voice/translate/*` (2 endpoints)
**Backend Lib:** `translation-processor.ts`, `audio-injector.ts`
**Components:** `LiveTranslationPanel`, `LanguageDetectionIndicator`, `TranslationView`

---

## 4. AI Intelligence Suite

- **AssemblyAI** integration for transcription with entity detection, content safety, PII redaction
- **OpenAI GPT-4o-mini** for summarization, analysis, and chat
- **ElevenLabs** Text-to-Speech with voice synthesis
- **Groq** Voice API for cost-effective voice generation and translation
- **AI Router** for intelligent provider selection based on task complexity
- Post-transcription processing pipeline (auto-summary, sentiment, entity extraction)
- Transcription queue with async processing via Cloudflare Queues
- Prompt sanitization for injection prevention
- AI operation logging and cost tracking
- AI config management (per-org overrides)

**Backend Routes:** `/api/ai/transcribe/*` (3), `/api/ai/llm/*` (3), `/api/ai/router/*` (3), `/api/ai-config/*` (2), `/api/ai-toggle/*` (5)
**Backend Lib:** `ai-router.ts`, `ai-call-engine.ts`, `prompt-sanitizer.ts`, `groq-client.ts`, `grok-voice-client.ts`, `post-transcription-processor.ts`, `queue-consumer.ts`
**Frontend Components:** `AITogglePanel`, `TranscriptView`

---

## 5. Bond AI Assistant (3-Tier)

- **Tier 1 — Chat:** Conversational AI assistant with org-aware context
- **Tier 2 — Alerts:** AI-generated alerts with severity levels, bulk actions, and alert rules
- **Tier 3 — Copilot:** Searchbar AI copilot for quick answers and insights
- Conversation persistence and management
- Custom prompt configuration
- Context builders that inject org stats, KPIs, and call history

**Backend Routes:** `/api/bond-ai/*` (14 endpoints)
**Backend Lib:** `bond-ai.ts` (context builders, system prompts)
**Frontend Components:** `BondAIChat`, `BondAIAlertsPanel`, `BondAICopilot`, `SearchbarCopilot`
**Frontend Pages:** `/bond-ai/alerts`

---

## 6. Cockpit — Agent Workspace

- 3-column layout: Work Queue | Call Center | Context Panel
- AI-prioritized account queue with likelihood scoring
- Integrated call controls (dial, hold, transfer, disposition)
- Real-time transcript display during calls
- Quick action modals (payment link, note, callback, dispute, transfer)
- Responsive mobile view with panel switcher
- Collapsible side panels
- Keyboard shortcuts for all major actions
- Account context panel with payment tools

**Frontend Pages:** `/work/call`, `/work/dialer`
**Components:** `Cockpit.tsx` (970 lines), `DispositionBar`, `PreDialChecker`, `QuickActionModals`, `PaymentLinkGenerator`, `PlanBuilder`, `WorkQueuePage`

---

## 7. Predictive Dialer

- Campaign-based predictive dialing engine
- Start/pause/stop queue controls
- Progressive and predictive pacing modes
- AMD (Answering Machine Detection) handling
- Agent pool status tracking (available, on_call, wrap_up)
- Real-time dialer statistics (pending, calling, completed, failed)
- Agent status management

**Backend Routes:** `/api/dialer/*` (6 endpoints)
**Backend Lib:** `dialer-engine.ts`
**Frontend Component:** `DialerPanel.tsx` (283 lines) — **NOTE: Currently orphaned, not rendered in any page**
**Database Tables:** `dialer_agent_status`, `campaign_calls`

---

## 8. Collections CRM

- Full account lifecycle management (active → partial → paid → disputed)
- Promise-to-pay tracking with follow-up scheduling
- Payment recording and balance updates
- Task management per account (create, update, complete, delete)
- Account notes and history
- Bulk CSV import with validation and error reporting
- Collection statistics and portfolio performance
- Daily stats and callback tracking
- Account-level disputes
- Likelihood-to-pay scoring

**Backend Routes:** `/api/collections/*` (17+ endpoints), `/api/import/*` (2 endpoints)
**Frontend Pages:** `/accounts`, `/accounts/[id]`, `/accounts/import`, `/accounts/disputes`, `/voice-operations/accounts`
**Components:** `BulkImportWizard`, `CollectionsAnalytics`, `CollectionsKPIs`, `PaymentHistoryChart`
**Database Tables:** `collection_accounts`, `collection_payments`, `collection_tasks`, `collection_csv_imports`

---

## 9. Campaign Management

- Campaign CRUD with status tracking
- Campaign statistics and performance analytics
- Contact sequence builder (multi-step outreach)
- Post-call survey management (CSAT/NPS)
- Campaign audit logging

**Backend Routes:** `/api/campaigns/*` (10 endpoints), `/api/surveys/*` (3 endpoints)
**Frontend Pages:** `/campaigns`, `/campaigns/new`, `/campaigns/sequences`, `/campaigns/surveys`
**Components:** `ContactSequenceEditor`, `TargetCampaignSelector`, `SurveyBuilder`, `SurveyResults`
**Database Tables:** `campaigns`, `campaign_calls`, `surveys`, `survey_responses`

---

## 10. Analytics & Reporting

- Real-time KPI dashboards (call volume, sentiment, performance, usage)
- Agent-level performance metrics and leaderboard
- Collections-specific analytics (recovery rates, aging, portfolio)
- Sentiment trend analysis
- Survey analytics widget
- Advanced analytics with custom date ranges
- Export capabilities (CSV)
- Custom report builder with schedule support
- Agent personal scorecard (`/analytics/me`)

**Backend Routes:** `/api/analytics/*` (12 endpoints), `/api/reports/*` (7 endpoints)
**Frontend Pages:** `/analytics`, `/analytics/agents`, `/analytics/collections`, `/analytics/me`, `/analytics/sentiment`, `/reports`
**Components:** `CallVolumeChart`, `SentimentChart`, `DurationChart`, `PerformanceMetrics`, `AdvancedAnalytics`, `AgentLeaderboard`, `CollectionsKPIs`, `SentimentDashboard`, `DateRangePicker`, `ExportButton`, `MetricCard`

---

## 11. Scorecard & QA System

- Agent scorecard generation and tracking
- Scorecard template library (customizable criteria)
- Scorecard alerts for quality issues
- Mystery shopper script management
- Scored recording tracking
- Call review mode with timeline playback
- Coaching queue (flagged agents)

**Backend Routes:** `/api/scorecards/*` (4 endpoints), `/api/shopper/*` (7 endpoints)
**Frontend Pages:** `/review`, `/command/scorecards`, `/command/coaching`, `/settings/quality`
**Components:** `ScorecardAlerts`, `ScorecardTemplateLibrary`, `ScorecardTrendsChart`, `ReviewMode`, `ReviewTimeline`, `ShopperScriptManager`, `ScoreView`
**Database Tables:** `scorecards`, `scorecard_templates`, `scored_recordings`, `shopper_scripts`, `shopper_results`

---

## 12. Billing & Subscription Management

- Stripe Checkout integration for plan purchases
- Stripe Customer Portal for self-service
- Subscription lifecycle (create, change plan, cancel, resume)
- Invoice history and payment method management
- Plan-based feature gating (Base/Pro/Enterprise tiers)
- Usage tracking (calls, minutes, recordings, transcriptions)
- Usage metering and billing analytics
- Stripe data sync (subscriptions, payment methods, invoices)
- Stripe webhook processing (checkout, subscription, invoice, payment events)
- Dunning management for failed payments

**Backend Routes:** `/api/billing/*` (11 endpoints), `/api/usage/*` (2 endpoints), `/api/capabilities/*` (3 endpoints)
**Frontend Pages:** `/admin/billing`, `/pricing`
**Components:** `SubscriptionManager`, `PaymentMethodManager`, `InvoiceHistory`, `UsageDisplay`, `PlanComparisonTable`, `CancelSubscriptionModal`, `BillingActions`
**Database Tables:** `stripe_events`, `billing_events`, `stripe_subscriptions`, `stripe_payment_methods`, `stripe_invoices`

---

## 13. Team & Organization Management

- Multi-user team collaboration with invite flow
- Organization creation and management
- Role-based UI differentiation (owner/admin/operator/worker)
- Team member CRUD with role assignment
- Team invite system (email + token validation)
- Multi-org support with org switching
- Team performance analytics
- Organization-level configuration

**Backend Routes:** `/api/teams/*` (10 endpoints), `/api/team/*` (8 endpoints), `/api/organizations/*` (3 endpoints)
**Frontend Pages:** `/teams`, `/settings/team`, `/settings/org-create`
**Components:** `TeamManagement`, `TeamsManager`, `RoleManager`, `OrgSwitcher`
**Database Tables:** `organizations`, `org_members`, `teams`, `team_members`, `team_invites`

---

## 14. Compliance & Security Center

- **HIPAA** compliance with PII redaction (`pii-redactor.ts`)
- **FDCPA/TCPA** compliance checking (pre-dial, frequency limits, time-of-day)
- Compliance violation reporting and tracking
- Dispute management with validation letter generation
- Do Not Call (DNC) list management
- Audit log browser with full mutation history
- SOC 2 certification progress tracking (readiness badges)
- Row-Level Security (RLS) on 51 database tables
- Rate limiting on all endpoints (20+ pre-configured limiters)
- Idempotency protection for critical operations
- Webhook signature verification (Stripe, Telnyx, Ed25519)
- CSRF token protection
- Prompt sanitization for AI injection prevention

**Backend Routes:** `/api/compliance/*` (7 endpoints), `/api/dnc/*` (3 endpoints), `/api/audit-logs/*` (1 endpoint)
**Backend Lib:** `pii-redactor.ts`, `compliance-checker.ts`, `compliance-guides.ts`, `prompt-sanitizer.ts`
**Frontend Pages:** `/compliance`, `/compliance/violations`, `/compliance/disputes`, `/compliance/dnc`, `/compliance/audit`
**Components:** `ViolationDashboard`, `DNCManager`, `AuditLogBrowser`, `SOC2CertificationTracker`, `CompliancePanel`

---

## 15. IVR System

- Interactive Voice Response flow engine
- IVR session management with gather result handling
- Payment IVR panel for automated collections
- Inbound phone number management

**Backend Routes:** `/api/ivr/*` (2 endpoints)
**Backend Lib:** `ivr-flow-engine.ts`
**Frontend Component:** `IVRPaymentPanel`
**Database Tables:** `ivr_flows`, `inbound_phone_numbers`

---

## 16. Webhook Management

- Webhook subscription CRUD (create, update, delete, test)
- Webhook delivery tracking with retry logic (exponential backoff)
- Webhook dead-letter queue (DLQ) with flush mechanism
- Webhook reliability configuration
- Webhook event filtering
- Signing documentation and verification
- Webhook KPI widget for dashboard
- External webhook receivers: Telnyx, AssemblyAI, Stripe

**Backend Routes:** `/api/webhooks/*` (11+ endpoints), `/webhooks/*` (3 inbound), `/api/reliability/*` (2 endpoints)
**Backend Lib:** `webhook-retry.ts`
**Frontend Pages:** `/admin/api`
**Components:** `WebhookOverview`, `WebhookList`, `WebhookForm`, `WebhookDeliveryLog`, `WebhookEventFilter`, `WebhookSigningDocs`, `WebhookStatusBadge`, `WebhooksKPIWidget`
**Database Tables:** `webhook_subscriptions`, `webhook_deliveries`, `webhook_failures`

---

## 17. CRM Integration Framework

- External CRM integration management (create, update, delete)
- CRM object linking (map external entities to WIB records)
- Sync log tracking for integration health
- Generic entity import pipeline

**Backend Routes:** `/api/crm/*` (12 endpoints)
**Database Tables:** `integrations`, `crm_object_links`, `crm_sync_log`

---

## 18. Feature Flag System

- Global feature flags (admin-managed)
- Organization-level flag overrides
- Feature flag CRUD (create, read, update, delete)
- Client-side feature flag utilities
- Route-level feature flag redirects (via `FeatureFlagRedirect`)
- `NEXT_PUBLIC_NEW_NAV` controls new vs. legacy navigation

**Backend Routes:** `/api/feature-flags/*` (10 endpoints)
**Frontend Pages:** `/admin/feature-flags`
**Backend Lib:** `feature-flags.ts`
**Frontend Lib:** `feature-flags.ts`, `FeatureFlagRedirect.tsx`
**Database Tables:** `global_feature_flags`, `org_feature_flags`

---

## 19. Onboarding Wizard

- 7-step guided setup flow (plan, phone number, compliance, CSV import, test call, invite team, product tour)
- Onboarding progress persistence
- "WORD IS BOND TEST CALL. THANKS." TTS test call feature
- Integration with all provisioning APIs

**Backend Routes:** `/api/onboarding/*` (2 endpoints)
**Frontend Pages:** `/onboarding`
**Components:** `OnboardingWizard`

---

## 20. Payment Plans & Dunning

- Payment plan creation and management
- Payment link generation and tracking
- Payment history visualization
- Payment reconciliation (Stripe mismatches, orphans)
- Scheduled payment processing (cron: daily at 6 AM)
- Dunning escalation for overdue payments (cron: daily at 6 AM)
- Failed payment tracking with retry

**Backend Routes:** `/api/payments/*` (6 endpoints)
**Backend Lib:** `payment-scheduler.ts`
**Frontend Pages:** `/payments`, `/payments/plans`, `/payments/failed`, `/payments/reconciliation`, `/work/payments`
**Components:** `PaymentCalculator`, `PaymentHistoryChart`, `PaymentLinkGenerator`
**Database Tables:** `collection_payments`, `payment_plans`, `scheduled_payments`, `dunning_events`

---

## 21. Scheduling & Callbacks

- Booking/callback management (CRUD)
- Follow-up task tracking
- Timezone-aware scheduling
- Calendar view with callback deep-links

**Backend Routes:** `/api/bookings/*` (4 endpoints)
**Frontend Pages:** `/schedule`, `/schedule/callbacks`, `/schedule/follow-ups`, `/bookings`
**Components:** `BookingsList`, `BookingModal`, `CallbackScheduler`, `FollowUpTracker`
**Database Tables:** `booking_events`

---

## 22. Agent Productivity Tools

- Note template browser with shortcode expansion
- Objection rebuttal library (FDCPA-compliant)
- Call script manager (mystery shopper scripts)
- Payment calculator
- Daily planner with queue stats and targets
- Likelihood-to-pay scoring per account
- Prevention configuration (at-risk account detection)

**Backend Routes:** `/api/productivity/*` (13 endpoints)
**Backend Lib:** `likelihood-scorer.ts`, `prevention-scan.ts`
**Frontend Pages:** `/tools`, `/tools/templates`, `/tools/scripts`, `/tools/objections`, `/tools/calculator`, `/work` (daily planner)
**Components:** `NoteTemplates`, `ObjectionLibrary`, `ShopperScriptManager`, `PaymentCalculator`, `DailyPlanner`, `TodayQueue`
**Database Tables:** `note_templates`, `objection_rebuttals`

---

## 23. Sentiment Analysis

- Real-time sentiment scoring during calls
- Sentiment summary generation per call
- Sentiment configuration (thresholds, alert triggers)
- Sentiment history tracking
- Sentiment alert configuration
- Dashboard sentiment analytics

**Backend Routes:** `/api/sentiment/*` (5 endpoints)
**Backend Lib:** `sentiment-processor.ts`
**Frontend Components:** `SentimentWidget`, `SentimentChart`, `SentimentDashboard`
**Database Tables:** `call_sentiment_scores`, `call_sentiment_summary`, `sentiment_alert_configs`

---

## 24. Text-to-Speech (TTS)

- ElevenLabs TTS integration with KV caching
- Grok/xAI TTS for cost-effective alternatives
- Voice synthesis with configurable voice selection
- Audio file upload and storage (R2)
- AI router TTS endpoint with provider selection

**Backend Routes:** `/api/tts/generate` (1 endpoint), `/api/audio/*` (3 endpoints), `/api/ai/router/tts` (1)
**Backend Lib:** `tts-processor.ts`, `grok-voice-client.ts`
**Database Tables:** `tts_audio`, `audio_files`, `audio_injections`

---

## 25. Recording Management

- Call recording storage in Cloudflare R2
- Recording listing with filters
- Signed URL generation for secure playback
- Recording deletion
- Scored recording association for QA

**Backend Routes:** `/api/recordings/*` (3 endpoints)
**Frontend Components:** `RecordingPlayer`, `AudioPlayer`
**Database Tables:** `recordings`, `scored_recordings`

---

## 26. Data Retention & Legal Holds

- Organization-level retention policy management
- Legal hold creation and management (freeze data deletion)
- Retention policy enforcement

**Backend Routes:** `/api/retention/*` (5 endpoints)
**Frontend Pages:** `/admin/retention`
**Components:** `RetentionSettings`
**Database Tables:** `retention_policies`, `legal_holds`

---

## 27. RBAC & Permissions

- Hierarchical role system: `platform_admin > owner > admin > operator > worker`
- RBAC context endpoint for client-side permission checks
- Permission checking API
- `requireRole()` middleware for route protection
- `useRBAC()` hook for UI permission gating
- Role-based navigation (RoleShell renders different nav per role)

**Backend Routes:** `/api/rbac/*` (3 endpoints)
**Backend Lib:** `auth.ts` (`requireRole()`), `rbac-v2.ts` (role hierarchy)
**Frontend Hooks:** `useRBAC.ts`
**Frontend Components:** `RoleShell` (role-based navigation)

---

## 28. Admin & Platform Management

- Platform metrics dashboard (owner only)
- Auth provider management
- Voice configuration (caller IDs, voice targets)
- AI model configuration
- API key and webhook management
- Data retention settings
- Feature flag administration
- Internal cron health, webhook DLQ, and schema health endpoints

**Backend Routes:** `/api/_admin/*` (2 endpoints), `/api/admin/metrics/*` (1 endpoint), `/api/internal/*` (3 endpoints)
**Frontend Pages:** `/admin`, `/admin/metrics`, `/admin/billing`, `/admin/voice`, `/admin/ai`, `/admin/api`, `/admin/retention`, `/admin/feature-flags`

---

## 29. Infrastructure & DevOps

- **Cloudflare Pages** for static UI deployment (Next.js 15 static export)
- **Cloudflare Workers** for API backend (Hono 4.7)
- **Neon PostgreSQL 17** with Hyperdrive connection pooling
- **Cloudflare R2** for file/recording storage
- **Cloudflare KV** for caching, sessions, rate limits, idempotency
- **Cloudflare Queues** for async transcription processing
- Structured JSON logging (frontend + backend)
- Deep health check endpoints (DB, KV, R2, Telnyx, OpenAI, Stripe, AssemblyAI)
- Environment verification scripts
- Deploy chain: Workers → Build → Pages → Health check
- 7 cron jobs (transcription retry, session cleanup, audit DLQ flush, usage aggregation, payment processing, dunning, prevention scan)

**Backend Lib:** `db.ts`, `logger.ts`, `health-probes.ts`, `rate-limit.ts`, `idempotency.ts`

---

## 30. Testing & Quality Assurance

- **Unit tests:** 3 files (AI optimization, navigation, RBAC)
- **Production integration tests:** 36 files (live API, voice, translation, collections, compliance, schema validation)
- **E2E tests:** 4 Playwright specs (auth, login, navigation, webhooks)
- **Load tests:** 6 k6 scripts (auth, baseline, collections, smoke, spike, voice)
- **Manual tests:** 1 PowerShell script
- **Total:** 758 passed, 18 skipped, 0 failed
- Schema drift validation (`validate-schema-drift.ts`)
- RLS audit script (`rls-audit.sql`)
- API contract validation tooling
- Coverage: 89% overall

---

## 31. UI/UX Framework

- Responsive design with persona-based mobile navigation (`BottomNav`)
- Dark/light theme support via `next-themes`
- Skeleton loaders for all async content
- Error boundaries at app level
- Keyboard shortcuts with help overlay (`KeyboardShortcutsHelp`)
- Command palette (Ctrl+K) for quick navigation
- Product tour system (multi-step guided tours)
- Trust signals (SOC 2 readiness badges, HIPAA)
- 13 vertical landing pages
- Interactive API docs (Swagger UI)
- Bug reporter and feedback system

**Frontend Components:** `AppShell`, `RoleShell`, `BottomNav`, `CommandPalette`, `ProductTour`, `ErrorBoundary`, `Skeletons`, `BugReporter`
**Frontend Pages:** `/`, `/pricing`, `/compare`, `/trust`, `/case-studies`, `/api-docs`, `/verticals/*`

---

## Architecture Summary

| Layer | Technology | Count |
|-------|-----------|-------|
| Frontend Pages | Next.js 15 | 82 |
| Backend Route Files | Hono on Workers | 53 |
| HTTP Endpoints | REST API | ~260 |
| Backend Lib Modules | TypeScript | 37 |
| Frontend Components | React/TypeScript | ~155 |
| Custom Hooks | React | 13 |
| Database Tables | Neon PostgreSQL | 170 |
| Active Tables (route-referenced) | — | ~66 |
| Cron Jobs | Scheduled Workers | 7 |
| Queue Consumers | Cloudflare Queues | 1 |
| Webhook Providers | Inbound | 3 |
| Test Files | Vitest + Playwright + k6 | 50+ |

---

## Critical Rules & Patterns

### Database Connection Order
✅ `c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString`
❌ `c.env.HYPERDRIVE?.connectionString || c.env.NEON_PG_CONN` (causes HTTP 530)

### No Server-Side Code in Next.js
Static export (`output: 'export'`). No API routes, no `getServerSideProps`, no `cookies()`, no `headers()`.

### Audit Log Columns
Use `old_value` / `new_value` — NOT `before` / `after`.

### Bearer Token Auth
Client components must use `apiGet/apiPost/apiPut/apiDelete` from `@/lib/apiClient`.

### Multi-Tenant Isolation
Every business query MUST include `organization_id` in WHERE clause.

### Parameterized Queries Only
Always `$1, $2, $3` — never string interpolation in SQL.
