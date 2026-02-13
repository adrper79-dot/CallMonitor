# Word Is Bond - Function Engineering Guide

**Last Updated:** February 12, 2026
**Platform Version:** v4.64
**Status:** Production Ready ⭐

This comprehensive engineering guide documents every feature listed in APPLICATION_FUNCTIONS.md, including:
- **Codebase Location:** Where the feature is implemented
- **Flow Diagrams:** File-level and logical-level architecture
- **Tests:** Which tests validate the feature
- **Status:** Active/Dormant on website
- **Database Elements:** Tables, columns, and relationships used
- **Requirements:** Dependencies and prerequisites
- **Activation Requirements:** What must be configured for the feature to work

---

## **1. Core Platform Functions**

### **1.1 Authentication & User Management**

#### **Custom Session-Based Authentication with PBKDF2 Password Hashing**
**Codebase Location:**
- `workers/src/lib/auth.ts` - Core authentication logic
- `workers/src/routes/auth.ts` - Authentication endpoints
- `lib/apiClient.ts` - Client-side API authentication
- `components/AuthProvider.tsx` - React context provider

**File-Level Flow:**
```
Client Request → apiClient.ts → Workers Route → auth.ts → Database
     ↓              ↓              ↓              ↓              ↓
  Login Form → apiGet/apiPost → /auth/signin → requireAuth() → users table
  Signup Form → apiPost → /auth/signup → hashPassword() → sessions (KV)
  Password Reset → apiPost → /auth/forgot-password → sendEmail() → email service
```

**Logical-Level Flow:**
```
1. User submits credentials
2. Client calls apiPost('/auth/signin')
3. Workers route validates input with Zod
4. requireAuth() middleware checks credentials
5. PBKDF2 password verification
6. Session created in Cloudflare KV
7. HttpOnly cookie set with session ID
8. CSRF token generated and stored
```

**Tests:**
- `tests/auth.test.ts` - Authentication flow tests
- `tests/auth-flow.test.ts` - End-to-end auth flow
- `tests/csrf-protection.test.ts` - CSRF validation tests

**Status:** ✅ **ACTIVE** - Core functionality on signin/signup pages

**Database Elements:**
- `users` table: id, email, password_hash, organization_id, role, created_at
- `organizations` table: id, name, settings
- Cloudflare KV: sessions, csrf_tokens

**Requirements:**
- Cloudflare Workers environment
- Neon PostgreSQL database
- Cloudflare KV binding
- Email service (Resend) for password reset

**Activation Requirements:**
- Environment variables: DATABASE_URL, KV binding, RESEND_API_KEY
- Database migrations applied
- Workers deployed with auth routes

#### **CSRF Protection and HttpOnly Cookies**
**Codebase Location:**
- `workers/src/lib/auth.ts` - CSRF token generation/validation
- `workers/src/routes/auth.ts` - CSRF middleware
- `lib/apiClient.ts` - Client-side CSRF handling

**File-Level Flow:**
```
Form Submission → apiClient.ts → Workers Route → auth.ts
     ↓              ↓              ↓              ↓
  CSRF Token → X-CSRF-Token → csrfValidate() → KV lookup
  Session Cookie → HttpOnly → sessionValidate() → User context
```

**Logical-Level Flow:**
```
1. Page load: CSRF token generated and sent to client
2. Form submission: CSRF token included in headers
3. Server validation: Token verified against KV store
4. Session validation: HttpOnly cookie checked
5. Request processing: User context established
```

**Tests:**
- `tests/csrf-protection.test.ts` - CSRF validation
- `tests/auth-flow.test.ts` - Cookie/session handling

**Status:** ✅ **ACTIVE** - All forms protected

**Database Elements:**
- Cloudflare KV: csrf_tokens, sessions

**Requirements:**
- Cloudflare KV binding
- HttpOnly cookie support

**Activation Requirements:**
- KV namespace configured
- CSRF middleware enabled on routes

#### **Multi-Tenant Organization Management**
**Codebase Location:**
- `workers/src/routes/organizations.ts` - Org CRUD operations
- `workers/src/lib/auth.ts` - Organization context
- `app/settings/page.tsx` - Organization settings UI
- `components/teams/OrganizationSettings.tsx` - Settings components

**File-Level Flow:**
```
UI Request → apiClient.ts → Workers Route → Database
     ↓              ↓              ↓              ↓
Settings Page → apiGet('/org') → /organizations → organizations table
Create Org → apiPost('/org') → POST /organizations → org_users table
```

**Logical-Level Flow:**
```
1. User accesses organization settings
2. requireAuth() establishes user context
3. Organization ID extracted from session
4. RLS policies filter data by organization_id
5. CRUD operations performed with tenant isolation
```

**Tests:**
- `tests/organizations.test.ts` - Organization CRUD
- `tests/multi-tenant.test.ts` - Tenant isolation
- `tests/rls-policies.test.ts` - Row-level security

**Status:** ✅ **ACTIVE** - Available in settings pages

**Database Elements:**
- `organizations` table: id, name, settings, created_at
- `org_users` table: organization_id, user_id, role
- All business tables include `organization_id` column

**Requirements:**
- RLS policies enabled on all tables
- Organization context in auth middleware

**Activation Requirements:**
- RLS migration applied
- Organization created for user
- User assigned to organization

#### **Role-Based Access Control (RBAC) with Hierarchical Permissions**
**Codebase Location:**
- `workers/src/lib/rbac-v2.ts` - RBAC logic and permissions
- `workers/src/routes/rbac-v2.ts` - RBAC API endpoints
- `hooks/useRole.ts` - Client-side role hooks
- `hooks/usePermissions.ts` - Permission checking hooks

**File-Level Flow:**
```
Component → usePermissions() → apiClient.ts → Workers Route → rbac-v2.ts
     ↓              ↓              ↓              ↓              ↓
  Role Check → Permission Query → apiGet('/rbac') → /rbac/check → role hierarchy
  Context Load → useRBAC() → apiGet('/rbac/context') → /rbac/context → user roles
```

**Logical-Level Flow:**
```
1. Component calls usePermissions('feature')
2. Hook queries current user roles
3. RBAC service checks permission hierarchy
4. Role inheritance applied (admin > manager > user)
5. Boolean result returned for UI rendering
```

**Tests:**
- `tests/rbac-v2.test.ts` - RBAC functionality
- `tests/permissions.test.ts` - Permission checking
- `tests/role-hierarchy.test.ts` - Role inheritance

**Status:** ✅ **ACTIVE** - Controls UI visibility and API access

**Database Elements:**
- `rbac_roles` table: id, name, hierarchy_level
- `rbac_permissions` table: role_id, resource, action
- `user_roles` table: user_id, role_id, organization_id

**Requirements:**
- RBAC middleware on protected routes
- Role hierarchy defined
- Permission matrix configured

**Activation Requirements:**
- RBAC tables populated
- Roles assigned to users
- Permission checks implemented

#### **User Onboarding Flow with CSV Import Capabilities**
**Codebase Location:**
- `app/onboarding/page.tsx` - Onboarding UI
- `workers/src/routes/onboarding.ts` - Onboarding API
- `components/voice/BulkImportWizard.tsx` - CSV import component
- `lib/csv-parser.ts` - CSV processing logic

**File-Level Flow:**
```
Onboarding UI → apiClient.ts → Workers Route → Database
     ↓              ↓              ↓              ↓
Step 1 (Org) → apiPost('/onboarding') → /onboarding → organizations
Step 2 (Users) → apiPost('/users/bulk') → /users/bulk → users table
Step 3 (CSV) → BulkImportWizard → /collections/import → collection_accounts
```

**Logical-Level Flow:**
```
1. User starts onboarding
2. Organization created
3. User profile completed
4. CSV upload processed
5. Data validation and import
6. Onboarding completion marked
```

**Tests:**
- `tests/onboarding.test.ts` - Onboarding flow
- `tests/csv-import.test.ts` - CSV processing
- `tests/bulk-import.test.ts` - Bulk operations

**Status:** ✅ **ACTIVE** - Available at /onboarding

**Database Elements:**
- `organizations` table
- `users` table
- `collection_accounts` table (for CSV import)
- `onboarding_progress` table

**Requirements:**
- File upload handling
- CSV parsing library
- Data validation schemas

**Activation Requirements:**
- Onboarding routes deployed
- CSV validation rules configured
- Storage for uploaded files

#### **Password Reset and Account Recovery**
**Codebase Location:**
- `app/forgot-password/page.tsx` - Password reset UI
- `app/reset-password/page.tsx` - Reset form
- `workers/src/routes/auth.ts` - Reset endpoints
- `lib/email-service.ts` - Email sending

**File-Level Flow:**
```
Reset Request → apiClient.ts → Workers Route → Email Service
     ↓              ↓              ↓              ↓
Forgot Password → apiPost('/auth/forgot') → /auth/forgot → Resend API
Reset Token → apiPost('/auth/reset') → /auth/reset → users table
```

**Logical-Level Flow:**
```
1. User requests password reset
2. Email sent with reset token
3. User clicks link with token
4. Token validated and password updated
5. User logged in with new password
```

**Tests:**
- `tests/password-reset.test.ts` - Reset flow
- `tests/email-service.test.ts` - Email sending

**Status:** ✅ **ACTIVE** - Available at /forgot-password

**Database Elements:**
- `users` table: password_hash, reset_token, reset_expires
- `password_reset_tokens` table (if separate)

**Requirements:**
- Email service (Resend)
- Secure token generation
- Token expiration handling

**Activation Requirements:**
- RESEND_API_KEY configured
- Email templates set up
- Reset token TTL configured

---

## **2. Voice Operations & Call Management**

### **2.1 Real-Time Voice Calling via Telnyx (WebRTC + PSTN)**
**Codebase Location:**
- `workers/src/routes/voice.ts` - Voice call endpoints
- `workers/src/routes/webrtc.ts` - WebRTC handling
- `components/voice/VoiceOperationsClient.tsx` - Voice UI
- `lib/telnyx-client.ts` - Telnyx API integration

**File-Level Flow:**
```
UI Action → apiClient.ts → Workers Route → Telnyx API
     ↓              ↓              ↓              ↓
Call Button → apiPost('/calls/start') → /voice/start → Telnyx Call Control
WebRTC Dial → apiPost('/webrtc/dial') → /webrtc/dial → Telnyx WebRTC
```

**Logical-Level Flow:**
```
1. User initiates call
2. Voice config validated
3. Telnyx call created
4. WebRTC connection established
5. Call status tracked
6. Recording initiated if enabled
```

**Tests:**
- `tests/voice-calling.test.ts` - Call initiation
- `tests/webrtc.test.ts` - WebRTC functionality
- `tests/telnyx-integration.test.ts` - Telnyx API

**Status:** ✅ **ACTIVE** - Core functionality in voice operations

**Database Elements:**
- `calls` table: id, organization_id, status, recording_url
- `voice_configs` table: transcribe, translate, amd_enabled
- `call_translations` table: call_id, language, content

**Requirements:**
- Telnyx API credentials
- WebRTC browser support
- Voice configuration

**Activation Requirements:**
- TELNYX_API_KEY, TELNYX_PUBLIC_KEY
- Voice configs enabled
- Telnyx application configured

### **2.2 Live Translation Pipeline (English ↔ Spanish)**
**Codebase Location:**
- `workers/src/routes/ai-transcribe.ts` - Transcription handling
- `workers/src/lib/post-transcription-processor.ts` - Translation logic
- `workers/src/routes/tts.ts` - Text-to-speech
- `lib/openai-client.ts` - OpenAI integration

**File-Level Flow:**
```
Telnyx Webhook → Workers Route → AI Processing → Database
     ↓              ↓              ↓              ↓
Transcription → /webhooks/telnyx → ai-transcribe.ts → call_translations
Translation → post-transcription-processor.ts → OpenAI API → translations table
TTS → tts.ts → ElevenLabs API → audio synthesis
```

**Logical-Level Flow:**
```
1. Call transcription received
2. Language detection
3. OpenAI translation request
4. Translation stored
5. TTS synthesis if voice-to-voice enabled
6. Real-time streaming to client
```

**Tests:**
- `tests/translation-pipeline.test.ts` - Translation flow
- `tests/live-translation.test.ts` - Real-time translation
- `tests/tts.test.ts` - Text-to-speech

**Status:** ✅ **ACTIVE** - When translation enabled in voice configs

**Database Elements:**
- `voice_configs` table: live_translate, translate_from, translate_to
- `call_translations` table: call_id, original_text, translated_text, language
- `transcriptions` table: call_id, content, entities

**Requirements:**
- OpenAI API key
- ElevenLabs API key (for voice-to-voice)
- AssemblyAI transcription

**Activation Requirements:**
- AI API keys configured
- voice_configs.live_translate = true
- Translation languages set

### **2.3 Call Recording Storage in Cloudflare R2**
**Codebase Location:**
- `workers/src/routes/recordings.ts` - Recording CRUD
- `workers/src/routes/webhooks.ts` - Recording upload handling
- `lib/r2-client.ts` - R2 storage integration
- `components/voice/RecordingPlayer.tsx` - Playback UI

**File-Level Flow:**
```
Telnyx Webhook → Workers Route → R2 Storage → Database
     ↓              ↓              ↓              ↓
Recording URL → /webhooks/telnyx → recordings.ts → R2 bucket
Playback → apiGet('/recordings') → /recordings → signed URL
```

**Logical-Level Flow:**
```
1. Call ends with recording
2. Telnyx uploads to R2
3. Recording metadata stored
4. Signed URL generated for playback
5. Client streams audio
```

**Tests:**
- `tests/recordings.test.ts` - Recording storage
- `tests/r2-integration.test.ts` - R2 functionality

**Status:** ✅ **ACTIVE** - Automatic for all calls

**Database Elements:**
- `recordings` table: id, call_id, r2_key, duration, size
- `calls` table: recording_url

**Requirements:**
- Cloudflare R2 bucket
- Telnyx recording configuration

**Activation Requirements:**
- R2 bucket configured
- Recording enabled in voice configs
- Signed URL generation working

### **2.4 Interactive Voice Response (IVR) Systems**
**Codebase Location:**
- `workers/src/routes/ivr.ts` - IVR endpoints
- `workers/src/lib/ivr-handler.ts` - IVR logic
- `components/voice/IVRBuilder.tsx` - IVR configuration UI

**File-Level Flow:**
```
Call Flow → Webhook → IVR Handler → Telnyx Actions
     ↓              ↓              ↓              ↓
DTMF Input → /webhooks/telnyx → ivr-handler.ts → speak/play actions
Menu Selection → ivr.ts → menu logic → next action
```

**Logical-Level Flow:**
```
1. Call connects to IVR
2. Welcome message played
3. DTMF input collected
4. Menu options processed
5. Call routed or information provided
```

**Tests:**
- `tests/ivr.test.ts` - IVR functionality
- `tests/dtmf-handling.test.ts` - DTMF processing

**Status:** ✅ **ACTIVE** - Configurable in voice settings

**Database Elements:**
- `ivr_configs` table: organization_id, menu_tree, prompts
- `ivr_sessions` table: call_id, current_menu, input_history

**Requirements:**
- Telnyx IVR support
- DTMF handling
- Audio prompt storage

**Activation Requirements:**
- IVR config created
- Audio prompts uploaded
- Menu tree defined

### **2.5 Call Bridging and Conference Calling**
**Codebase Location:**
- `workers/src/routes/calls.ts` - Call management
- `workers/src/lib/call-bridge.ts` - Bridging logic
- `components/voice/CallBridge.tsx` - Bridge UI

**File-Level Flow:**
```
Agent Call → Bridge Logic → Customer Call → Conference
     ↓              ↓              ↓              ↓
Start Bridge → call-bridge.ts → Telnyx API → bridge action
Conference → calls.ts → conference logic → multi-party
```

**Logical-Level Flow:**
```
1. Agent call initiated
2. Customer call initiated
3. Bridge action executed
4. Calls connected
5. Conference established
```

**Tests:**
- `tests/call-bridging.test.ts` - Bridge functionality
- `tests/conference-calling.test.ts` - Multi-party calls

**Status:** ✅ **ACTIVE** - Used in collection workflows

**Database Elements:**
- `calls` table: bridge_id, conference_id, participants
- `call_participants` table: call_id, user_id, role

**Requirements:**
- Telnyx bridge support
- Multi-call management

**Activation Requirements:**
- Bridge endpoints deployed
- Call flow configured

### **2.6 Answering Machine Detection (AMD)**
**Codebase Location:**
- `workers/src/lib/amd-handler.ts` - AMD logic
- `workers/src/routes/voice.ts` - AMD configuration
- `components/voice/AMDSettings.tsx` - AMD UI

**File-Level Flow:**
```
Call Start → AMD Check → Result Processing
     ↓              ↓              ↓
AMD Enabled → amd-handler.ts → human/machine detection
Result → voice.ts → call routing
```

**Logical-Level Flow:**
```
1. Call initiated with AMD
2. Initial audio analyzed
3. Human vs machine detected
4. Call routed accordingly
5. Result logged
```

**Tests:**
- `tests/amd.test.ts` - AMD functionality
- `tests/call-routing.test.ts` - Routing logic

**Status:** ✅ **ACTIVE** - Configurable per call type

**Database Elements:**
- `voice_configs` table: amd_enabled, amd_timeout
- `calls` table: amd_result, amd_confidence

**Requirements:**
- Telnyx AMD support
- Audio analysis

**Activation Requirements:**
- AMD enabled in voice configs
- Routing rules configured

### **2.7 Call Outcome Tracking and Disposition Codes**
**Codebase Location:**
- `workers/src/routes/calls.ts` - Outcome endpoints
- `components/voice/CallDisposition.tsx` - Disposition UI
- `lib/disposition-codes.ts` - Code definitions

**File-Level Flow:**
```
Call End → Disposition UI → API Update → Database
     ↓              ↓              ↓              ↓
Select Code → CallDisposition.tsx → apiPut('/calls') → calls table
Outcome → disposition-codes.ts → validation → call_outcomes
```

**Logical-Level Flow:**
```
1. Call completed
2. Agent selects disposition
3. Code validated
4. Outcome recorded
5. Analytics updated
```

**Tests:**
- `tests/call-disposition.test.ts` - Disposition handling
- `tests/outcome-tracking.test.ts` - Outcome recording

**Status:** ✅ **ACTIVE** - Required after every call

**Database Elements:**
- `calls` table: disposition_code, outcome, notes
- `call_outcomes` table: call_id, code, timestamp
- `disposition_codes` table: code, description, category

**Requirements:**
- Disposition code definitions
- Validation logic

**Activation Requirements:**
- Codes configured
- UI integrated
- Validation active

### **2.8 Keyboard Shortcuts for Call Handling**
**Codebase Location:**
- `hooks/useKeyboardShortcuts.ts` - Shortcut logic
- `components/voice/CallControls.tsx` - Call controls
- `components/ui/KeyboardShortcutsHelp.tsx` - Help overlay

**File-Level Flow:**
```
Key Press → useKeyboardShortcuts → Action Handler
     ↓              ↓              ↓
Shortcut → event listener → call action
Help (?) → KeyboardShortcutsHelp → overlay display
```

**Logical-Level Flow:**
```
1. Keyboard event captured
2. Shortcut mapped to action
3. Action executed
4. UI updated
```

**Tests:**
- `tests/keyboard-shortcuts.test.ts` - Shortcut functionality

**Status:** ✅ **ACTIVE** - Available during calls

**Database Elements:**
- `user_preferences` table: keyboard_shortcuts_enabled
- `organization_settings` table: default_shortcuts

**Requirements:**
- Keyboard event handling
- Action mapping

**Activation Requirements:**
- Hook integrated
- Shortcuts configured
- Help overlay available

---

## **3. AI-Powered Intelligence**

### **3.1 AssemblyAI Transcription with Entity Detection and Content Safety**
**Codebase Location:**
- `workers/src/routes/ai-transcribe.ts` - AssemblyAI integration
- `workers/src/lib/assemblyai-client.ts` - API client
- `workers/src/lib/post-transcription-processor.ts` - Processing

**File-Level Flow:**
```
Audio Upload → AssemblyAI API → Processing → Database
     ↓              ↓              ↓              ↓
Webhook → ai-transcribe.ts → assemblyai-client.ts → transcriptions
Entities → post-transcription-processor.ts → entity extraction → entities table
```

**Logical-Level Flow:**
```
1. Audio file uploaded
2. AssemblyAI transcription requested
3. Entity detection enabled
4. Content safety filtering
5. Results stored and processed
```

**Tests:**
- `tests/ai-transcribe.test.ts` - Transcription
- `tests/entity-detection.test.ts` - Entity extraction
- `tests/content-safety.test.ts` - Safety filtering

**Status:** ✅ **ACTIVE** - When transcription enabled

**Database Elements:**
- `transcriptions` table: call_id, content, entities, safety_score
- `transcription_entities` table: transcription_id, entity_type, value
- `voice_configs` table: entity_detection, content_safety

**Requirements:**
- AssemblyAI API key
- Audio file handling

**Activation Requirements:**
- ASSEMBLYAI_API_KEY configured
- Features enabled in voice configs

### **3.2 OpenAI GPT-4o-mini Integration for Summarization and Analysis**
**Codebase Location:**
- `workers/src/routes/ai-llm.ts` - OpenAI endpoints
- `workers/src/lib/openai-client.ts` - API client
- `workers/src/lib/ai-router.ts` - Provider routing

**File-Level Flow:**
```
Request → AI Router → OpenAI API → Response
     ↓              ↓              ↓              ↓
Summarize → ai-router.ts → openai-client.ts → ai_summaries
Analyze → ai-llm.ts → GPT-4o-mini → analysis results
```

**Logical-Level Flow:**
```
1. AI request received
2. Complexity assessed
3. Provider selected (OpenAI for complex)
4. API call made
5. Response processed and stored
```

**Tests:**
- `tests/ai-llm.test.ts` - LLM integration
- `tests/ai-router.test.ts` - Provider routing
- `tests/summarization.test.ts` - Summary generation

**Status:** ✅ **ACTIVE** - Available in Bond AI features

**Database Elements:**
- `ai_summaries` table: call_id, summary, sentiment, highlights
- `ai_requests` table: user_id, provider, cost, tokens
- `voice_configs` table: ai_enabled, ai_provider

**Requirements:**
- OpenAI API key
- AI router configuration

**Activation Requirements:**
- OPENAI_API_KEY configured
- AI features enabled
- Cost tracking active

### **3.3 ElevenLabs Text-to-Speech (TTS) with Voice Synthesis**
**Codebase Location:**
- `workers/src/routes/tts.ts` - TTS endpoints
- `workers/src/lib/elevenlabs-client.ts` - API client
- `workers/src/lib/tts-cache.ts` - Caching logic

**File-Level Flow:**
```
Text Input → Cache Check → ElevenLabs API → Storage
     ↓              ↓              ↓              ↓
TTS Request → tts-cache.ts → elevenlabs-client.ts → R2 storage
Cache Hit → cached audio → direct return
```

**Logical-Level Flow:**
```
1. Text received for synthesis
2. SHA-256 hash generated
3. Cache checked in KV
4. If miss, ElevenLabs API called
5. Audio stored in R2 and cached
```

**Tests:**
- `tests/tts.test.ts` - Text-to-speech
- `tests/tts-cache.test.ts` - Caching functionality

**Status:** ✅ **ACTIVE** - Used in voice-to-voice translation

**Database Elements:**
- `tts_cache` table: text_hash, r2_key, voice, model
- Cloudflare KV: TTS cache entries

**Requirements:**
- ElevenLabs API key
- R2 storage
- KV caching

**Activation Requirements:**
- ELEVENLABS_API_KEY configured
- R2 bucket available
- Cache TTL configured

### **3.4 Groq Voice API for Cost-Effective Voice Generation**
**Codebase Location:**
- `workers/src/lib/grok-voice-client.ts` - Groq integration
- `workers/src/routes/tts.ts` - Voice synthesis routing
- `workers/src/lib/ai-router.ts` - Provider selection

**File-Level Flow:**
```
Voice Request → AI Router → Groq API → Audio
     ↓              ↓              ↓              ↓
Cost Check → ai-router.ts → grok-voice-client.ts → synthesis
Fallback → elevenlabs fallback → if Groq fails
```

**Logical-Level Flow:**
```
1. Voice synthesis requested
2. Cost optimization checked
3. Groq selected for low-cost
4. API call made
5. Audio returned
```

**Tests:**
- `tests/grok-voice.test.ts` - Groq integration
- `tests/voice-cost-optimization.test.ts` - Cost routing

**Status:** ✅ **ACTIVE** - Primary voice synthesis provider

**Database Elements:**
- `ai_requests` table: provider, cost, duration
- `voice_configs` table: preferred_tts_provider

**Requirements:**
- Groq API key
- Cost optimization logic

**Activation Requirements:**
- GROQ_API_KEY configured
- Cost thresholds set
- Fallback provider configured

### **3.5 AI Router for Intelligent Provider Selection**
**Codebase Location:**
- `workers/src/lib/ai-router.ts` - Main router logic
- `workers/src/lib/provider-costs.ts` - Cost calculations
- `workers/src/lib/complexity-analyzer.ts` - Task complexity assessment

**File-Level Flow:**
```
AI Request → Complexity Analysis → Cost Comparison → Provider Selection
     ↓              ↓              ↓              ↓
Task Type → complexity-analyzer.ts → provider-costs.ts → ai-router.ts
Selection → optimal provider → API call
```

**Logical-Level Flow:**
```
1. Task complexity analyzed
2. Provider costs compared
3. Optimal provider selected
4. Request routed
5. Cost tracked
```

**Tests:**
- `tests/ai-router.test.ts` - Routing logic
- `tests/cost-optimization.test.ts` - Cost calculations
- `tests/complexity-analysis.test.ts` - Task assessment

**Status:** ✅ **ACTIVE** - All AI requests routed

**Database Elements:**
- `ai_requests` table: task_type, complexity_score, selected_provider, cost
- `provider_costs` table: provider, model, cost_per_token

**Requirements:**
- Multiple AI providers
- Cost tracking
- Complexity analysis

**Activation Requirements:**
- All provider keys configured
- Cost data current
- Routing rules active

### **3.6 Sentiment Analysis and Scoring**
**Codebase Location:**
- `workers/src/routes/sentiment.ts` - Sentiment endpoints
- `workers/src/lib/sentiment-analyzer.ts` - Analysis logic
- `components/analytics/SentimentChart.tsx` - Visualization

**File-Level Flow:**
```
Text Input → Sentiment Analysis → Scoring → Storage
     ↓              ↓              ↓              ↓
Transcription → sentiment-analyzer.ts → scoring algorithm → sentiment_scores
Batch Processing → sentiment.ts → bulk analysis → database
```

**Logical-Level Flow:**
```
1. Text content analyzed
2. Sentiment score calculated
3. Confidence level determined
4. Results stored and visualized
```

**Tests:**
- `tests/sentiment-analysis.test.ts` - Sentiment processing
- `tests/sentiment-scoring.test.ts` - Scoring accuracy

**Status:** ✅ **ACTIVE** - Automatic on transcriptions

**Database Elements:**
- `sentiment_scores` table: transcription_id, score, confidence, categories
- `sentiment_configs` table: organization_id, thresholds, categories

**Requirements:**
- Sentiment analysis model
- Scoring algorithm

**Activation Requirements:**
- Sentiment enabled in configs
- Analysis model configured

### **3.7 Likelihood-to-Pay Scoring Engine**
**Codebase Location:**
- `workers/src/lib/likelihood-scorer.ts` - Scoring engine
- `workers/src/routes/productivity.ts` - Scoring endpoints
- `components/voice/LikelihoodScore.tsx` - UI display

**File-Level Flow:**
```
Account Data → Scoring Factors → Calculation → Score
     ↓              ↓              ↓              ↓
Payment History → likelihood-scorer.ts → weighted calculation → likelihood_scores
Engagement → contact patterns → scoring → database
```

**Logical-Level Flow:**
```
1. Account data collected
2. Multiple factors weighted
3. Score calculated (0-100)
4. Results stored and displayed
```

**Tests:**
- `tests/likelihood-scoring.test.ts` - Scoring engine
- `tests/scoring-accuracy.test.ts` - Score validation

**Status:** ✅ **ACTIVE** - Available in productivity features

**Database Elements:**
- `likelihood_scores` table: account_id, score, factors, last_updated
- `collection_accounts` table: payment_history, contact_engagement

**Requirements:**
- Historical payment data
- Contact tracking
- Scoring algorithm

**Activation Requirements:**
- Account data available
- Scoring weights configured
- Historical data populated

### **3.8 Auto-Task Creation from Call Content**
**Codebase Location:**
- `workers/src/lib/post-transcription-processor.ts` - Task creation logic
- `workers/src/routes/tasks.ts` - Task management
- `components/voice/TaskManager.tsx` - Task UI

**File-Level Flow:**
```
Transcription → Content Analysis → Task Detection → Creation
     ↓              ↓              ↓              ↓
Payment Promise → post-transcription-processor.ts → task creation → tasks table
Follow-up → pattern matching → auto-assign → notifications
```

**Logical-Level Flow:**
```
1. Call content analyzed
2. Task triggers identified
3. Tasks automatically created
4. Assigned to appropriate users
5. Notifications sent
```

**Tests:**
- `tests/auto-task-creation.test.ts` - Task generation
- `tests/task-assignment.test.ts` - Assignment logic

**Status:** ✅ **ACTIVE** - Automatic task creation

**Database Elements:**
- `tasks` table: id, account_id, type, priority, assignee_id
- `task_triggers` table: pattern, task_type, conditions
- `transcriptions` table: content for analysis

**Requirements:**
- Transcription content
- Task trigger patterns
- Assignment rules

**Activation Requirements:**
- Task triggers configured
- Assignment logic active
- Notification system working

---

## **4. Campaign Management**

### **4.1 Bulk Calling Campaigns with Predictive Dialing**
**Codebase Location:**
- `workers/src/routes/campaigns.ts` - Campaign endpoints
- `workers/src/lib/predictive-dialer.ts` - Dialing logic
- `components/campaigns/CampaignManager.tsx` - Campaign UI

**File-Level Flow:**
```
Campaign Setup → Dialer Logic → Call Initiation → Tracking
     ↓              ↓              ↓              ↓
Account List → predictive-dialer.ts → voice.ts → campaign_calls
Predictive → agent availability → optimal timing → results
```

**Logical-Level Flow:**
```
1. Campaign configured with accounts
2. Predictive algorithm calculates timing
3. Calls initiated based on agent availability
4. Results tracked and analyzed
```

**Tests:**
- `tests/campaigns.test.ts` - Campaign management
- `tests/predictive-dialing.test.ts` - Dialing logic

**Status:** ✅ **ACTIVE** - Available in campaigns section

**Database Elements:**
- `campaigns` table: id, name, account_list, status
- `campaign_calls` table: campaign_id, account_id, outcome
- `dialer_queues` table: campaign_id, priority, next_call_time

**Requirements:**
- Account lists
- Agent availability tracking
- Predictive algorithms

**Activation Requirements:**
- Campaign data configured
- Dialer settings active
- Agent status tracking

### **4.2 Campaign Analytics and Performance Tracking**
**Codebase Location:**
- `workers/src/routes/analytics.ts` - Analytics endpoints
- `components/analytics/CampaignAnalytics.tsx` - Analytics UI
- `lib/campaign-metrics.ts` - Metrics calculation

**File-Level Flow:**
```
Campaign Data → Metrics Calculation → Visualization
     ↓              ↓              ↓              ↓
Call Results → campaign-metrics.ts → analytics.ts → charts
Performance → KPI calculation → dashboard → reports
```

**Logical-Level Flow:**
```
1. Campaign data aggregated
2. Key metrics calculated
3. Performance visualized
4. Insights generated
```

**Tests:**
- `tests/campaign-analytics.test.ts` - Analytics functionality
- `tests/performance-tracking.test.ts` - Metrics calculation

**Status:** ✅ **ACTIVE** - Available in analytics dashboard

**Database Elements:**
- `campaign_analytics` table: campaign_id, metric, value, date
- `campaigns` table: performance data
- `campaign_calls` table: outcome data

**Requirements:**
- Campaign execution data
- Metrics definitions
- Visualization components

**Activation Requirements:**
- Analytics enabled
- Data collection active
- Metrics configured

### **4.3 Queue Management for Collection Workflows**
**Codebase Location:**
- `workers/src/routes/dialer.ts` - Queue endpoints
- `components/voice/TodayQueue.tsx` - Queue UI
- `lib/queue-manager.ts` - Queue logic

**File-Level Flow:**
```
Account Queue → Priority Sorting → Agent Assignment
     ↓              ↓              ↓              ↓
Due Accounts → queue-manager.ts → dialer.ts → agent_queues
Priority → scoring algorithm → assignment → notifications
```

**Logical-Level Flow:**
```
1. Accounts prioritized by urgency
2. Queue sorted by priority
3. Agents assigned work items
4. Progress tracked
```

**Tests:**
- `tests/queue-management.test.ts` - Queue functionality
- `tests/priority-sorting.test.ts` - Sorting logic

**Status:** ✅ **ACTIVE** - Core to collection workflows

**Database Elements:**
- `dialer_queues` table: account_id, priority, agent_id, status
- `collection_accounts` table: priority_score, due_date
- `agent_queues` table: agent_id, current_task, queue_position

**Requirements:**
- Account prioritization
- Agent availability
- Queue management logic

**Activation Requirements:**
- Queue configuration active
- Priority rules defined
- Agent assignment working

### **4.4 Daily Planner for Agent Productivity**
**Codebase Location:**
- `workers/src/routes/productivity.ts` - Planner endpoints
- `components/voice/DailyPlanner.tsx` - Planner UI
- `lib/daily-planner.ts` - Planning logic

**File-Level Flow:**
```
Tasks + Accounts → Planning Algorithm → Daily Schedule
     ↓              ↓              ↓              ↓
Due Tasks → daily-planner.ts → productivity.ts → daily_plans
Campaigns → cross-campaign view → prioritization → schedule
```

**Logical-Level Flow:**
```
1. All tasks and accounts analyzed
2. Priority and timing calculated
3. Daily schedule generated
4. Agent productivity optimized
```

**Tests:**
- `tests/daily-planner.test.ts` - Planning functionality
- `tests/productivity-optimization.test.ts` - Optimization logic

**Status:** ✅ **ACTIVE** - Available in voice operations

**Database Elements:**
- `daily_plans` table: agent_id, date, tasks, schedule
- `tasks` table: due_date, priority
- `campaigns` table: schedule requirements

**Requirements:**
- Task and account data
- Agent capacity tracking
- Scheduling algorithms

**Activation Requirements:**
- Planner enabled
- Data sources configured
- Scheduling rules active

### **4.5 Objection Rebuttal Library with FDCPA Compliance**
**Codebase Location:**
- `workers/src/routes/productivity.ts` - Rebuttal endpoints
- `components/voice/ObjectionLibrary.tsx` - Library UI
- `lib/objection-rebuttals.ts` - Rebuttal logic

**File-Level Flow:**
```
Objection Detected → Library Search → Compliant Response
     ↓              ↓              ↓              ↓
Agent Input → ObjectionLibrary.tsx → productivity.ts → rebuttals
FDCPA Check → compliance filter → selection → usage tracking
```

**Logical-Level Flow:**
```
1. Objection identified
2. Compliant rebuttals searched
3. Best response selected
4. Usage tracked for compliance
```

**Tests:**
- `tests/objection-rebuttals.test.ts` - Rebuttal functionality
- `tests/fdcpa-compliance.test.ts` - Compliance checking

**Status:** ✅ **ACTIVE** - Available in productivity tools

**Database Elements:**
- `objection_rebuttals` table: objection, rebuttal, fdcpa_compliant
- `rebuttal_usage` table: agent_id, rebuttal_id, call_id
- `compliance_configs` table: fdcpa_rules, restrictions

**Requirements:**
- Rebuttal database
- FDCPA compliance rules
- Usage tracking

**Activation Requirements:**
- Rebuttals populated
- Compliance rules configured
- Tracking active

### **4.6 Note Templates with Shortcode Expansion**
**Codebase Location:**
- `workers/src/routes/productivity.ts` - Template endpoints
- `components/voice/NoteTemplates.tsx` - Template UI
- `lib/note-templates.ts` - Template logic

**File-Level Flow:**
```
Shortcode Input → Template Expansion → Note Generation
     ↓              ↓              ↓              ↓
/vm /ptp → NoteTemplates.tsx → productivity.ts → expanded text
Autocomplete → template search → insertion → call notes
```

**Logical-Level Flow:**
```
1. Shortcode typed
2. Template retrieved
3. Variables expanded
4. Full note inserted
```

**Tests:**
- `tests/note-templates.test.ts` - Template functionality
- `tests/shortcode-expansion.test.ts` - Expansion logic

**Status:** ✅ **ACTIVE** - Available during calls

**Database Elements:**
- `note_templates` table: shortcode, template, variables
- `call_notes` table: content, template_used
- `template_usage` table: agent_id, template_id, frequency

**Requirements:**
- Template definitions
- Variable expansion logic
- Autocomplete functionality

**Activation Requirements:**
- Templates configured
- Shortcodes defined
- Expansion logic active

---

## **5. Analytics & Reporting**

### **5.1 Real-Time KPI Dashboards**
**Codebase Location:**
- `workers/src/routes/analytics.ts` - Dashboard endpoints
- `components/dashboard/DashboardHome.tsx` - Dashboard UI
- `lib/kpi-calculator.ts` - KPI logic

**File-Level Flow:**
```
Data Sources → KPI Calculation → Dashboard Display
     ↓              ↓              ↓              ↓
Calls/Tasks → kpi-calculator.ts → analytics.ts → dashboard
Real-time → live updates → WebSocket → UI refresh
```

**Logical-Level Flow:**
```
1. Data aggregated from sources
2. KPIs calculated
3. Dashboard populated
4. Real-time updates enabled
```

**Tests:**
- `tests/dashboard.test.ts` - Dashboard functionality
- `tests/kpi-calculation.test.ts` - KPI accuracy

**Status:** ✅ **ACTIVE** - Main dashboard view

**Database Elements:**
- `kpi_metrics` table: metric_name, value, timestamp
- `dashboard_configs` table: user_id, layout, widgets
- `real_time_updates` table: metric, last_value, change

**Requirements:**
- Data aggregation
- KPI definitions
- Real-time updates

**Activation Requirements:**
- Data sources connected
- KPI formulas configured
- Update mechanisms active

### **5.2 Custom Report Builder**
**Codebase Location:**
- `workers/src/routes/reports.ts` - Report endpoints
- `components/reports/ReportBuilder.tsx` - Builder UI
- `lib/report-generator.ts` - Generation logic

**File-Level Flow:**
```
Report Config → Data Query → Report Generation → Export
     ↓              ↓              ↓              ↓
Builder UI → ReportBuilder.tsx → reports.ts → PDF/CSV
Filters → query builder → execution → formatting
```

**Logical-Level Flow:**
```
1. Report parameters selected
2. Data queries built
3. Report generated
4. Export options provided
```

**Tests:**
- `tests/report-builder.test.ts` - Builder functionality
- `tests/report-generation.test.ts` - Generation logic

**Status:** ✅ **ACTIVE** - Available in reports section

**Database Elements:**
- `reports` table: id, config, data, created_by
- `report_templates` table: name, config, fields
- `report_exports` table: report_id, format, url

**Requirements:**
- Query builder
- Export functionality
- Template system

**Activation Requirements:**
- Report templates configured
- Data access permissions
- Export capabilities active

### **5.3 Scorecard Generation**
**Codebase Location:**
- `workers/src/routes/scorecards.ts` - Scorecard endpoints
- `components/analytics/ScorecardView.tsx` - Scorecard UI
- `lib/scorecard-calculator.ts` - Calculation logic

**File-Level Flow:**
```
Performance Data → Score Calculation → Scorecard Display
     ↓              ↓              ↓              ↓
Agent Metrics → scorecard-calculator.ts → scorecards.ts → visualization
Benchmarks → comparison logic → grading → results
```

**Logical-Level Flow:**
```
1. Performance data collected
2. Scores calculated against benchmarks
3. Scorecard generated
4. Results visualized
```

**Tests:**
- `tests/scorecard-generation.test.ts` - Scorecard functionality
- `tests/score-calculation.test.ts` - Calculation accuracy

**Status:** ✅ **ACTIVE** - Available in analytics

**Database Elements:**
- `scorecards` table: agent_id, period, scores, grade
- `performance_metrics` table: agent_id, metric, value
- `benchmarks` table: metric, target, weight

**Requirements:**
- Performance data
- Benchmark definitions
- Scoring algorithms

**Activation Requirements:**
- Metrics configured
- Benchmarks set
- Calculation logic active

### **5.4 Collections Analytics with Portfolio Performance**
**Codebase Location:**
- `components/voice/CollectionsAnalytics.tsx` - Analytics UI
- `workers/src/routes/analytics.ts` - Analytics endpoints
- `lib/collections-metrics.ts` - Metrics calculation

**File-Level Flow:**
```
Portfolio Data → Metrics Calculation → Analytics Display
     ↓              ↓              ↓              ↓
Account Status → collections-metrics.ts → analytics.ts → charts
Performance → recovery rates → trends → insights
```

**Logical-Level Flow:**
```
1. Portfolio data analyzed
2. Key metrics calculated
3. Performance visualized
4. Insights generated
```

**Tests:**
- `tests/collections-analytics.test.ts` - Analytics functionality
- `tests/portfolio-performance.test.ts` - Performance metrics

**Status:** ✅ **ACTIVE** - Available in voice operations

**Database Elements:**
- `collections_analytics` table: portfolio_id, metric, value, date
- `collection_accounts` table: status, balance, last_contact
- `portfolio_performance` table: recovery_rate, contact_rate

**Requirements:**
- Collection data
- Metrics definitions
- Visualization components

**Activation Requirements:**
- Portfolio data available
- Metrics configured
- Analytics enabled

### **5.5 Payment History Visualization**
**Codebase Location:**
- `components/billing/PaymentHistoryChart.tsx` - Chart UI
- `workers/src/routes/billing.ts` - History endpoints
- `lib/payment-analytics.ts` - Analytics logic

**File-Level Flow:**
```
Payment Data → Chart Generation → Visualization
     ↓              ↓              ↓              ↓
Transaction History → PaymentHistoryChart.tsx → billing.ts → timeline
Trends → payment-analytics.ts → calculations → insights
```

**Logical-Level Flow:**
```
1. Payment data retrieved
2. Timeline constructed
3. Chart rendered
4. Trends analyzed
```

**Tests:**
- `tests/payment-history.test.ts` - History functionality
- `tests/payment-visualization.test.ts` - Chart accuracy

**Status:** ✅ **ACTIVE** - Available in billing section

**Database Elements:**
- `payments` table: id, amount, date, status
- `payment_history` table: account_id, payment_id, amount
- `billing_analytics` table: period, total_payments, trends

**Requirements:**
- Payment data
- Chart library
- Timeline logic

**Activation Requirements:**
- Payment records available
- Chart components loaded
- Data access configured

### **5.6 Compliance Reporting and Audit Trails**
**Codebase Location:**
- `workers/src/routes/compliance.ts` - Compliance endpoints
- `components/compliance/ComplianceReport.tsx` - Report UI
- `workers/src/lib/audit.ts` - Audit logic

**File-Level Flow:**
```
Audit Data → Report Generation → Compliance Check
     ↓              ↓              ↓              ↓
Log Entries → audit.ts → compliance.ts → reports
Validation → compliance rules → verification → alerts
```

**Logical-Level Flow:**
```
1. Audit logs collected
2. Compliance checked
3. Reports generated
4. Violations flagged
```

**Tests:**
- `tests/compliance-reporting.test.ts` - Reporting functionality
- `tests/audit-trails.test.ts` - Audit accuracy

**Status:** ✅ **ACTIVE** - Required for compliance

**Database Elements:**
- `audit_logs` table: action, user_id, resource, old_value, new_value
- `compliance_reports` table: period, violations, status
- `compliance_rules` table: rule, severity, check_logic

**Requirements:**
- Audit logging
- Compliance rules
- Report generation

**Activation Requirements:**
- Audit logging active
- Rules configured
- Reporting enabled

### **5.7 Usage Metering and Billing Analytics**
**Codebase Location:**
- `workers/src/routes/usage.ts` - Usage endpoints
- `components/billing/UsageDashboard.tsx` - Usage UI
- `lib/usage-metering.ts` - Metering logic

**File-Level Flow:**
```
Usage Data → Metering Calculation → Billing Analytics
     ↓              ↓              ↓              ↓
API Calls → usage-metering.ts → usage.ts → dashboard
Limits → plan checking → alerts → notifications
```

**Logical-Level Flow:**
```
1. Usage tracked
2. Limits monitored
3. Analytics generated
4. Billing calculated
```

**Tests:**
- `tests/usage-metering.test.ts` - Metering functionality
- `tests/billing-analytics.test.ts` - Analytics accuracy

**Status:** ✅ **ACTIVE** - Core billing functionality

**Database Elements:**
- `usage_metrics` table: user_id, metric, value, period
- `billing_plans` table: plan_id, limits, pricing
- `usage_alerts` table: user_id, metric, threshold, triggered

**Requirements:**
- Usage tracking
- Plan definitions
- Analytics logic

**Activation Requirements:**
- Metering active
- Plans configured
- Alerts enabled

---

## **6. Billing & Subscription Management**

### **6.1 Stripe Integration with Webhook Processing**
**Codebase Location:**
- `workers/src/routes/webhooks.ts` - Stripe webhooks
- `workers/src/routes/billing.ts` - Billing endpoints
- `lib/stripe-client.ts` - Stripe API client

**File-Level Flow:**
```
Stripe Event → Webhook Verification → Processing → Database Update
     ↓              ↓              ↓              ↓
Webhook → webhooks.ts → stripe signature check → billing.ts
Subscription → event processing → status update → notifications
```

**Logical-Level Flow:**
```
1. Stripe webhook received
2. Signature verified
3. Event processed
4. Database updated
5. Notifications sent
```

**Tests:**
- `tests/stripe-webhooks.test.ts` - Webhook processing
- `tests/stripe-integration.test.ts` - API integration

**Status:** ✅ **ACTIVE** - Core billing functionality

**Database Elements:**
- `subscriptions` table: stripe_id, status, plan_id
- `stripe_events` table: event_id, type, processed
- `billing_history` table: subscription_id, amount, date

**Requirements:**
- Stripe API keys
- Webhook endpoints
- Signature verification

**Activation Requirements:**
- STRIPE_SECRET_KEY configured
- Webhook URL registered
- Event processing active

### **6.2 Subscription Lifecycle Management**
**Codebase Location:**
- `workers/src/routes/billing.ts` - Subscription endpoints
- `components/billing/SubscriptionManager.tsx` - Management UI
- `lib/subscription-manager.ts` - Lifecycle logic

**File-Level Flow:**
```
Subscription Action → Processing → Stripe API → Database
     ↓              ↓              ↓              ↓
Create/Update → SubscriptionManager.tsx → billing.ts → stripe API
Cancel/Pause → lifecycle logic → webhook → status update
```

**Logical-Level Flow:**
```
1. Subscription action requested
2. Stripe API called
3. Webhook confirms change
4. Database updated
5. UI refreshed
```

**Tests:**
- `tests/subscription-lifecycle.test.ts` - Lifecycle management
- `tests/subscription-updates.test.ts` - Update processing

**Status:** ✅ **ACTIVE** - Available in billing section

**Database Elements:**
- `subscriptions` table: id, user_id, plan_id, status, stripe_id
- `subscription_events` table: subscription_id, event, timestamp
- `plan_changes` table: subscription_id, old_plan, new_plan

**Requirements:**
- Stripe integration
- Lifecycle logic
- Status tracking

**Activation Requirements:**
- Stripe configured
- Plans defined
- Lifecycle rules active

### **6.3 Plan-Based Feature Gating**
**Codebase Location:**
- `workers/src/lib/plan-gating.ts` - Gating logic
- `workers/src/routes/capabilities.ts` - Capability endpoints
- `components/ui/PlanGate.tsx` - UI gating

**File-Level Flow:**
```
Feature Access → Plan Check → Gate Decision
     ↓              ↓              ↓              ↓
Request → plan-gating.ts → capabilities.ts → allow/deny
UI Element → PlanGate.tsx → feature check → show/hide
```

**Logical-Level Flow:**
```
1. Feature requested
2. User plan checked
3. Access granted/denied
4. UI updated accordingly
```

**Tests:**
- `tests/plan-gating.test.ts` - Gating functionality
- `tests/feature-access.test.ts` - Access control

**Status:** ✅ **ACTIVE** - All premium features gated

**Database Elements:**
- `user_plans` table: user_id, plan_id, features
- `plan_features` table: plan_id, feature, enabled
- `feature_access` table: user_id, feature, last_access

**Requirements:**
- Plan definitions
- Feature mapping
- Access control logic

**Activation Requirements:**
- Plans configured
- Features mapped
- Gating active

### **6.4 Usage Tracking (Calls, Minutes, Recordings, Transcriptions)**
**Codebase Location:**
- `workers/src/routes/usage.ts` - Usage endpoints
- `workers/src/lib/usage-tracker.ts` - Tracking logic
- `components/billing/UsageDisplay.tsx` - Usage UI

**File-Level Flow:**
```
Activity → Usage Tracking → Storage → Display
     ↓              ↓              ↓              ↓
Call Made → usage-tracker.ts → usage.ts → database
Limit Check → plan comparison → alerts → notifications
```

**Logical-Level Flow:**
```
1. Activity occurs
2. Usage tracked
3. Limits checked
4. Data stored and displayed
```

**Tests:**
- `tests/usage-tracking.test.ts` - Tracking functionality
- `tests/usage-limits.test.ts` - Limit enforcement

**Status:** ✅ **ACTIVE** - All billable activities tracked

**Database Elements:**
- `usage_tracking` table: user_id, metric, value, timestamp
- `usage_limits` table: plan_id, metric, limit, period
- `usage_alerts` table: user_id, metric, threshold, sent

**Requirements:**
- Activity monitoring
- Metric definitions
- Limit checking

**Activation Requirements:**
- Tracking active
- Limits configured
- Alerts enabled

### **6.5 Payment Plan Calculators with Installment Options**
**Codebase Location:**
- `components/voice/PaymentCalculator.tsx` - Calculator UI
- `workers/src/routes/productivity.ts` - Calculator endpoints
- `lib/payment-calculator.ts` - Calculation logic

**File-Level Flow:**
```
Payment Request → Calculation → Options Display
     ↓              ↓              ↓              ↓
Amount Input → PaymentCalculator.tsx → productivity.ts → installment plans
Terms → payment-calculator.ts → options → selection
```

**Logical-Level Flow:**
```
1. Payment amount entered
2. Installment options calculated
3. Plans displayed
4. Selection made
```

**Tests:**
- `tests/payment-calculator.test.ts` - Calculator functionality
- `tests/installment-options.test.ts` - Option generation

**Status:** ✅ **ACTIVE** - Available in voice operations

**Database Elements:**
- `payment_plans` table: account_id, amount, terms, schedule
- `installment_options` table: plan_id, term_months, monthly_amount
- `payment_calculations` table: input_amount, options, selected

**Requirements:**
- Payment logic
- Term calculations
- Plan storage

**Activation Requirements:**
- Calculator enabled
- Terms configured
- Storage active

### **6.6 Dunning Management and Payment Reminders**
**Codebase Location:**
- `workers/src/lib/dunning-manager.ts` - Dunning logic
- `workers/src/routes/billing.ts` - Dunning endpoints
- `lib/email-service.ts` - Notification sending

**File-Level Flow:**
```
Overdue Payment → Dunning Process → Notifications
     ↓              ↓              ↓              ↓
Due Date → dunning-manager.ts → billing.ts → email service
Escalation → reminder sequence → actions → resolution
```

**Logical-Level Flow:**
```
1. Payment overdue detected
2. Dunning sequence started
3. Reminders sent
4. Actions escalated if needed
```

**Tests:**
- `tests/dunning-management.test.ts` - Dunning functionality
- `tests/payment-reminders.test.ts` - Reminder sending

**Status:** ✅ **ACTIVE** - Automatic for overdue accounts

**Database Elements:**
- `dunning_events` table: account_id, stage, sent_date
- `payment_reminders` table: account_id, type, sent, response
- `dunning_configs` table: stage, delay_days, actions

**Requirements:**
- Overdue detection
- Reminder sequences
- Email service

**Activation Requirements:**
- Dunning rules configured
- Email service active
- Detection logic running

---

## **7. Team & Organization Management**

### **7.1 Multi-User Team Collaboration**
**Codebase Location:**
- `workers/src/routes/teams.ts` - Team endpoints
- `components/teams/TeamManager.tsx` - Team UI
- `lib/team-collaboration.ts` - Collaboration logic

**File-Level Flow:**
```
Team Action → Processing → Collaboration → Updates
     ↓              ↓              ↓              ↓
Member Add → TeamManager.tsx → teams.ts → notifications
Task Assign → collaboration logic → assignment → alerts
```

**Logical-Level Flow:**
```
1. Team action performed
2. Members notified
3. Collaboration enabled
4. Updates synchronized
```

**Tests:**
- `tests/team-collaboration.test.ts` - Collaboration functionality
- `tests/team-management.test.ts` - Management logic

**Status:** ✅ **ACTIVE** - Available in teams section

**Database Elements:**
- `teams` table: id, name, organization_id
- `team_members` table: team_id, user_id, role
- `team_collaboration` table: team_id, activity, timestamp

**Requirements:**
- Team structure
- Member management
- Notification system

**Activation Requirements:**
- Teams configured
- Members assigned
- Collaboration enabled

### **7.2 Organization-Level Settings and Configuration**
**Codebase Location:**
- `app/settings/page.tsx` - Settings UI
- `workers/src/routes/organizations.ts` - Settings endpoints
- `lib/organization-settings.ts` - Settings logic

**File-Level Flow:**
```
Setting Change → Validation → Storage → Application
     ↓              ↓              ↓              ↓
Config Update → settings page → organizations.ts → database
Validation → settings logic → checks → activation
```

**Logical-Level Flow:**
```
1. Setting changed
2. Validation performed
3. Setting stored
4. Application updated
```

**Tests:**
- `tests/organization-settings.test.ts` - Settings functionality
- `tests/settings-validation.test.ts` - Validation logic

**Status:** ✅ **ACTIVE** - Available in settings

**Database Elements:**
- `organization_settings` table: org_id, setting_key, value
- `setting_validations` table: setting_key, rules, constraints
- `setting_history` table: org_id, setting_key, old_value, new_value

**Requirements:**
- Settings schema
- Validation rules
- Change tracking

**Activation Requirements:**
- Settings defined
- Validation active
- History tracking enabled

### **7.3 Role-Based UI Differentiation (Owner vs Worker Views)**
**Codebase Location:**
- `hooks/useRole.ts` - Role detection
- `components/layout/RoleBasedLayout.tsx` - UI differentiation
- `lib/role-ui-manager.ts` - UI logic

**File-Level Flow:**
```
User Role → UI Selection → Component Rendering
     ↓              ↓              ↓              ↓
Role Check → useRole() → RoleBasedLayout.tsx → appropriate UI
Permission → role-ui-manager.ts → feature gating → display
```

**Logical-Level Flow:**
```
1. User role determined
2. UI components selected
3. Features gated by role
4. Appropriate interface displayed
```

**Tests:**
- `tests/role-based-ui.test.ts` - UI differentiation
- `tests/ui-gating.test.ts` - Feature gating

**Status:** ✅ **ACTIVE** - Automatic based on user role

**Database Elements:**
- `user_roles` table: user_id, role_id, organization_id
- `role_ui_configs` table: role_id, ui_component, visible
- `ui_permissions` table: role_id, component, permission

**Requirements:**
- Role definitions
- UI component mapping
- Permission system

**Activation Requirements:**
- Roles assigned
- UI configs defined
- Permissions set

### **7.4 Team Performance Analytics**
**Codebase Location:**
- `workers/src/routes/analytics.ts` - Team analytics
- `components/analytics/TeamPerformance.tsx` - Performance UI
- `lib/team-metrics.ts` - Metrics calculation

**File-Level Flow:**
```
Team Data → Metrics Calculation → Performance Display
     ↓              ↓              ↓              ↓
Activity Logs → team-metrics.ts → analytics.ts → dashboard
Comparisons → benchmark logic → rankings → insights
```

**Logical-Level Flow:**
```
1. Team data collected
2. Performance metrics calculated
3. Analytics displayed
4. Insights generated
```

**Tests:**
- `tests/team-performance.test.ts` - Performance analytics
- `tests/team-metrics.test.ts` - Metrics calculation

**Status:** ✅ **ACTIVE** - Available in analytics

**Database Elements:**
- `team_performance` table: team_id, metric, value, period
- `team_benchmarks` table: metric, target, weight
- `performance_insights` table: team_id, insight, impact

**Requirements:**
- Team activity data
- Metrics definitions
- Benchmark system

**Activation Requirements:**
- Data collection active
- Metrics configured
- Benchmarks set

### **7.5 Permission Matrix with Inheritance**
**Codebase Location:**
- `tools/generate-permission-matrix.ts` - Matrix generation
- `docs/PERMISSION_MATRIX.md` - Matrix documentation
- `workers/src/lib/rbac-v2.ts` - Permission logic

**File-Level Flow:**
```
Role Definition → Inheritance Calculation → Matrix Generation
     ↓              ↓              ↓              ↓
Permissions → rbac-v2.ts → generate script → PERMISSION_MATRIX.md
Hierarchy → inheritance logic → expansion → documentation
```

**Logical-Level Flow:**
```
1. Base permissions defined
2. Role hierarchy applied
3. Inheritance calculated
4. Matrix generated and documented
```

**Tests:**
- `tests/permission-matrix.test.ts` - Matrix generation
- `tests/permission-inheritance.test.ts` - Inheritance logic

**Status:** ✅ **ACTIVE** - Used for access control

**Database Elements:**
- `rbac_roles` table: id, name, parent_role, permissions
- `permission_matrix` table: role_id, resource, action, inherited
- `role_hierarchy` table: role_id, parent_id, level

**Requirements:**
- Role hierarchy
- Permission definitions
- Inheritance logic

**Activation Requirements:**
- Roles defined
- Hierarchy configured
- Matrix generated

---

## **8. Compliance & Security**

### **8.1 HIPAA and GDPR Compliance with PII Redaction**
**Codebase Location:**
- `workers/src/lib/pii-redactor.ts` - Redaction logic
- `workers/src/routes/compliance.ts` - Compliance endpoints
- `lib/compliance-manager.ts` - Compliance management

**File-Level Flow:**
```
Sensitive Data → Detection → Redaction → Storage
     ↓              ↓              ↓              ↓
Content → pii-redactor.ts → pattern matching → redacted text
Validation → compliance-manager.ts → compliance.ts → audit
```

**Logical-Level Flow:**
```
1. Content scanned for PII
2. Sensitive data detected
3. Information redacted
4. Compliant content stored
```

**Tests:**
- `tests/pii-redaction.test.ts` - Redaction functionality
- `tests/compliance-validation.test.ts` - Compliance checking

**Status:** ✅ **ACTIVE** - Automatic on all content

**Database Elements:**
- `redacted_content` table: original_hash, redacted_content, pii_types
- `pii_detection` table: content_id, pii_type, location
- `compliance_audit` table: action, pii_handled, compliant

**Requirements:**
- PII patterns
- Redaction logic
- Compliance rules

**Activation Requirements:**
- Patterns configured
- Redaction active
- Audit logging enabled

### **8.2 SOC 2 Type II Compliance Framework**
**Codebase Location:**
- `workers/src/lib/soc2-compliance.ts` - SOC2 logic
- `docs/SECURITY_AUDIT_REPORT.md` - Compliance documentation
- `lib/compliance-framework.ts` - Framework implementation

**File-Level Flow:**
```
Security Control → Validation → Compliance Check
     ↓              ↓              ↓              ↓
Control → soc2-compliance.ts → framework → verification
Audit → compliance check → reporting → certification
```

**Logical-Level Flow:**
```
1. Security controls implemented
2. Compliance validated
3. Audit evidence collected
4. SOC2 certification maintained
```

**Tests:**
- `tests/soc2-compliance.test.ts` - Compliance validation
- `tests/security-controls.test.ts` - Control verification

**Status:** ✅ **ACTIVE** - Ongoing compliance

**Database Elements:**
- `security_controls` table: control_id, status, evidence
- `compliance_audit` table: control_id, check_date, result
- `soc2_evidence` table: requirement, evidence, location

**Requirements:**
- Security controls
- Audit procedures
- Evidence collection

**Activation Requirements:**
- Controls implemented
- Audit schedule active
- Evidence maintained

### **8.3 Row-Level Security (RLS) on All Database Tables**
**Codebase Location:**
- `migrations/2026-02-08-rls-enforcement.sql` - RLS policies
- `scripts/rls-audit.sql` - RLS verification
- `workers/src/lib/db.ts` - RLS context

**File-Level Flow:**
```
Query → RLS Context → Policy Application → Filtered Results
     ↓              ↓              ↓              ↓
Database Access → db.ts → RLS policies → organization data
Context Set → current_org_id → policy filter → isolation
```

**Logical-Level Flow:**
```
1. User context established
2. Organization ID set
3. RLS policies applied
4. Data automatically filtered
```

**Tests:**
- `tests/rls-policies.test.ts` - Policy functionality
- `tests/data-isolation.test.ts` - Isolation verification

**Status:** ✅ **ACTIVE** - All tables protected

**Database Elements:**
- All business tables include `organization_id` column
- RLS policies on all tables: `USING (organization_id = current_setting('app.current_org_id', true)::UUID)`

**Requirements:**
- Organization context
- RLS policies
- Context setting

**Activation Requirements:**
- RLS enabled
- Policies applied
- Context middleware active

### **8.4 Audit Logging for All Mutations**
**Codebase Location:**
- `workers/src/lib/audit.ts` - Audit logic
- `workers/src/routes/audit.ts` - Audit endpoints
- `lib/audit-logger.ts` - Logging implementation

**File-Level Flow:**
```
Mutation → Audit Capture → Log Storage
     ↓              ↓              ↓              ↓
Database Change → audit.ts → old/new values → audit_logs
Context → user/session info → timestamp → storage
```

**Logical-Level Flow:**
```
1. Mutation detected
2. Before/after values captured
3. Context information added
4. Audit log created
```

**Tests:**
- `tests/audit-logging.test.ts` - Logging functionality
- `tests/audit-verification.test.ts` - Log accuracy

**Status:** ✅ **ACTIVE** - All mutations logged

**Database Elements:**
- `audit_logs` table: user_id, action, resource_type, resource_id, old_value, new_value, timestamp
- `audit_context` table: log_id, session_id, ip_address, user_agent

**Requirements:**
- Mutation detection
- Value capture
- Context logging

**Activation Requirements:**
- Audit middleware active
- Log storage configured
- Context capture enabled

### **8.5 Webhook Signature Verification**
**Codebase Location:**
- `workers/src/lib/webhook-security.ts` - Signature logic
- `workers/src/routes/webhooks.ts` - Webhook endpoints
- `lib/signature-verifier.ts` - Verification implementation

**File-Level Flow:**
```
Webhook → Signature Check → Processing
     ↓              ↓              ↓              ↓
Incoming → webhook-security.ts → signature verification → accept/reject
Validation → signature-verifier.ts → cryptographic check → processing
```

**Logical-Level Flow:**
```
1. Webhook received
2. Signature extracted
3. Cryptographic verification
4. Processing allowed/rejected
```

**Tests:**
- `tests/webhook-security.test.ts` - Signature verification
- `tests/webhook-validation.test.ts` - Validation logic

**Status:** ✅ **ACTIVE** - All webhooks verified

**Database Elements:**
- `webhook_logs` table: source, signature_valid, processed
- `webhook_configs` table: source, secret_key, algorithm
- `signature_failures` table: source, reason, timestamp

**Requirements:**
- Cryptographic libraries
- Secret key management
- Signature algorithms

**Activation Requirements:**
- Secrets configured
- Verification active
- Failure logging enabled

### **8.6 Rate Limiting on All Endpoints**
**Codebase Location:**
- `workers/src/lib/rate-limit.ts` - Rate limiting logic
- `workers/src/routes/` - Applied to all routes
- `lib/rate-limit-store.ts` - Storage implementation

**File-Level Flow:**
```
Request → Rate Check → Allow/Deny
     ↓              ↓              ↓              ↓
Incoming → rate-limit.ts → KV check → processing/rejection
Tracking → counter update → TTL → storage
```

**Logical-Level Flow:**
```
1. Request received
2. Rate limit checked
3. Counter updated
4. Request allowed or rejected
```

**Tests:**
- `tests/rate-limiting.test.ts` - Limiting functionality
- `tests/rate-limit-storage.test.ts` - Storage verification

**Status:** ✅ **ACTIVE** - All endpoints protected

**Database Elements:**
- Cloudflare KV: rate limit counters with TTL
- `rate_limit_logs` table: endpoint, ip, exceeded, timestamp
- `rate_limit_configs` table: endpoint, limit, window

**Requirements:**
- KV storage
- IP detection
- Time window logic

**Activation Requirements:**
- KV configured
- Limits set
- Middleware active

### **8.7 Idempotency Protection for Critical Operations**
**Codebase Location:**
- `workers/src/lib/idempotency.ts` - Idempotency logic
- `workers/src/routes/billing.ts` - Applied to billing
- `lib/idempotency-store.ts` - Storage implementation

**File-Level Flow:**
```
Request → Idempotency Check → Processing
     ↓              ↓              ↓              ↓
Idempotency-Key → idempotency.ts → KV lookup → new/duplicate
Processing → result storage → key association → response
```

**Logical-Level Flow:**
```
1. Idempotency key checked
2. If new, process and store result
3. If duplicate, return stored result
4. Key expires after TTL
```

**Tests:**
- `tests/idempotency.test.ts` - Idempotency functionality
- `tests/idempotency-storage.test.ts` - Storage verification

**Status:** ✅ **ACTIVE** - Critical operations protected

**Database Elements:**
- Cloudflare KV: idempotency keys with TTL
- `idempotency_logs` table: key, operation, result, timestamp
- `idempotency_configs` table: operation, ttl_seconds

**Requirements:**
- KV storage
- Key generation
- Result caching

**Activation Requirements:**
- KV configured
- Keys generated
- Middleware active

---

## **9. Data Management & Integration**

### **9.1 Bulk CSV Import with Validation**
**Codebase Location:**
- `components/voice/BulkImportWizard.tsx` - Import UI
- `workers/src/routes/collections.ts` - Import endpoints
- `lib/csv-parser.ts` - Parsing logic

**File-Level Flow:**
```
CSV Upload → Validation → Processing → Storage
     ↓              ↓              ↓              ↓
File → BulkImportWizard.tsx → collections.ts → database
Validation → csv-parser.ts → error checking → import
```

**Logical-Level Flow:**
```
1. CSV file uploaded
2. Data validated
3. Parsing performed
4. Records imported
```

**Tests:**
- `tests/csv-import.test.ts` - Import functionality
- `tests/csv-validation.test.ts` - Validation logic

**Status:** ✅ **ACTIVE** - Available in onboarding and collections

**Database Elements:**
- `collection_accounts` table: imported data
- `import_jobs` table: job_id, status, records_processed
- `import_errors` table: job_id, row, error_message

**Requirements:**
- CSV parsing
- Validation rules
- Error handling

**Activation Requirements:**
- Parser configured
- Validation rules set
- Error logging active

### **9.2 CRM Integration Capabilities**
**Codebase Location:**
- `workers/src/routes/crm-integration.ts` - CRM endpoints
- `lib/crm-connector.ts` - CRM logic
- `components/integrations/CRMSetup.tsx` - Setup UI

**File-Level Flow:**
```
CRM Action → Connector → External API → Sync
     ↓              ↓              ↓              ↓
Sync Request → crm-connector.ts → CRM API → database
Bidirectional → data mapping → transformation → storage
```

**Logical-Level Flow:**
```
1. CRM action initiated
2. Data mapped and transformed
3. External API called
4. Results synchronized
```

**Tests:**
- `tests/crm-integration.test.ts` - Integration functionality
- `tests/crm-sync.test.ts` - Synchronization logic

**Status:** 🚧 **IN DEVELOPMENT** - Framework ready, specific CRM connectors pending

**Database Elements:**
- `crm_connections` table: org_id, crm_type, config
- `crm_sync_logs` table: connection_id, status, records_synced
- `crm_mappings` table: field_mapping, transformation_rules

**Requirements:**
- CRM API clients
- Data mapping
- Sync logic

**Activation Requirements:**
- CRM credentials configured
- Mappings defined
- Sync schedules set

### **9.3 Webhook System for External Integrations**
**Codebase Location:**
- `workers/src/routes/webhooks.ts` - Webhook endpoints
- `lib/webhook-manager.ts` - Webhook logic
- `components/integrations/WebhookConfig.tsx` - Config UI

**File-Level Flow:**
```
Event → Webhook Trigger → External Call
     ↓              ↓              ↓              ↓
System Event → webhook-manager.ts → webhooks.ts → external API
Configuration → subscription setup → validation → activation
```

**Logical-Level Flow:**
```
1. System event occurs
2. Webhook subscriptions checked
3. External endpoints called
4. Responses logged
```

**Tests:**
- `tests/webhook-system.test.ts` - Webhook functionality
- `tests/webhook-delivery.test.ts` - Delivery verification

**Status:** ✅ **ACTIVE** - Webhook UI in progress (70%)

**Database Elements:**
- `webhook_subscriptions` table: org_id, url, events, secret
- `webhook_deliveries` table: subscription_id, status, response
- `webhook_events` table: event_type, data, timestamp

**Requirements:**
- HTTP client
- Signature generation
- Retry logic

**Activation Requirements:**
- Subscriptions configured
- Secrets generated
- Delivery tracking active

### **9.4 API Documentation with OpenAPI Specification**
**Codebase Location:**
- `public/openapi.yaml` - OpenAPI spec
- `tools/generate-openapi.ts` - Generation script
- `docs/API.md` - API documentation

**File-Level Flow:**
```
Code Analysis → Spec Generation → Documentation
     ↓              ↓              ↓              ↓
Routes → generate-openapi.ts → openapi.yaml → API.md
Schemas → type extraction → validation → publishing
```

**Logical-Level Flow:**
```
1. Code analyzed for routes
2. OpenAPI spec generated
3. Documentation created
4. API reference published
```

**Tests:**
- `tests/openapi-generation.test.ts` - Generation functionality
- `tests/api-validation.test.ts` - Spec validation

**Status:** ✅ **ACTIVE** - Auto-generated and maintained

**Database Elements:**
- Spec stored in `public/openapi.yaml`
- No database storage for spec itself

**Requirements:**
- Code analysis
- OpenAPI generation
- Documentation tools

**Activation Requirements:**
- Generation script configured
- Build process integrated
- Publishing active

### **9.5 Database Schema Drift Validation**
**Codebase Location:**
- `scripts/schema-drift-check.sh` - Validation script
- `ARCH_DOCS/DATABASE_SCHEMA_REGISTRY.md` - Schema registry
- `lib/schema-validator.ts` - Validation logic

**File-Level Flow:**
```
Schema Check → Comparison → Drift Detection
     ↓              ↓              ↓              ↓
Database → schema-drift-check.sh → registry → alerts
Validation → schema-validator.ts → rules → reports
```

**Logical-Level Flow:**
```
1. Current schema analyzed
2. Registry compared
3. Drift detected
4. Reports generated
```

**Tests:**
- `tests/schema-drift.test.ts` - Drift detection
- `tests/schema-validation.test.ts` - Validation logic

**Status:** ✅ **ACTIVE** - CI/CD integrated

**Database Elements:**
- Schema registry in documentation
- Drift reports in logs

**Requirements:**
- Schema analysis
- Comparison logic
- Alert system

**Activation Requirements:**
- Registry maintained
- CI/CD integrated
- Alerts configured

### **9.6 Backup and Restore Functionality**
**Codebase Location:**
- `scripts/neon-backup.sh` - Backup script
- `lib/backup-manager.ts` - Backup logic
- `workers/src/routes/backup.ts` - Backup endpoints

**File-Level Flow:**
```
Backup Trigger → Execution → Storage
     ↓              ↓              ↓              ↓
Schedule → neon-backup.sh → pg_dump → R2 storage
Restore → backup-manager.ts → pg_restore → database
```

**Logical-Level Flow:**
```
1. Backup triggered
2. Database dumped
3. File stored in R2
4. Restore available when needed
```

**Tests:**
- `tests/backup-restore.test.ts` - Backup functionality
- `tests/backup-verification.test.ts` - Verification logic

**Status:** ✅ **ACTIVE** - Automated backups

**Database Elements:**
- Backup metadata in logs
- No persistent database storage for backups

**Requirements:**
- pg_dump access
- R2 storage
- Restore procedures

**Activation Requirements:**
- Backup schedule configured
- Storage available
- Restore tested

---

## **10. Bond AI Assistant**

### **10.1 3-Tier AI System (Chat, Alerts, Co-Pilot)**
**Codebase Location:**
- `workers/src/routes/bond-ai.ts` - AI endpoints
- `components/bond-ai/AIAssistant.tsx` - AI UI
- `lib/ai-system.ts` - AI logic

**File-Level Flow:**
```
AI Request → Tier Selection → Processing → Response
     ↓              ↓              ↓              ↓
Chat/Alert → bond-ai.ts → ai-system.ts → AI response
Co-Pilot → context analysis → assistance → guidance
```

**Logical-Level Flow:**
```
1. AI request categorized
2. Appropriate tier selected
3. Processing performed
4. Response generated
```

**Tests:**
- `tests/bond-ai.test.ts` - AI functionality
- `tests/ai-tiers.test.ts` - Tier logic

**Status:** ✅ **ACTIVE** - All 3 tiers operational

**Database Elements:**
- `ai_conversations` table: user_id, tier, messages, context
- `ai_alerts` table: user_id, alert_type, triggered, response
- `ai_copilot_actions` table: user_id, action, context

**Requirements:**
- AI providers
- Context management
- Response generation

**Activation Requirements:**
- AI keys configured
- Tiers enabled
- Context tracking active

### **10.2 Context-Aware Assistance During Calls**
**Codebase Location:**
- `components/voice/AIContextHelp.tsx` - Context UI
- `workers/src/lib/ai-context.ts` - Context logic
- `hooks/useAIContext.ts` - Context hook

**File-Level Flow:**
```
Call Context → Analysis → Assistance → Display
     ↓              ↓              ↓              ↓
Current Call → ai-context.ts → analysis → AIContextHelp.tsx
Suggestions → real-time processing → recommendations → UI
```

**Logical-Level Flow:**
```
1. Call context analyzed
2. Relevant assistance identified
3. Suggestions provided
4. UI updated in real-time
```

**Tests:**
- `tests/ai-context.test.ts` - Context functionality
- `tests/context-assistance.test.ts` - Assistance logic

**Status:** ✅ **ACTIVE** - Available during calls

**Database Elements:**
- `call_context` table: call_id, context_data, analysis
- `ai_suggestions` table: call_id, suggestion, accepted
- `context_history` table: call_id, context_snapshot

**Requirements:**
- Real-time processing
- Context analysis
- Suggestion generation

**Activation Requirements:**
- Context tracking active
- AI processing enabled
- UI integration complete

### **10.3 AI-Powered Recommendations and Insights**
**Codebase Location:**
- `workers/src/lib/ai-insights.ts` - Insights logic
- `components/analytics/AIInsights.tsx` - Insights UI
- `lib/recommendation-engine.ts` - Recommendation logic

**File-Level Flow:**
```
Data Analysis → AI Processing → Insights → Display
     ↓              ↓              ↓              ↓
Performance → ai-insights.ts → analysis → AIInsights.tsx
Recommendations → recommendation-engine.ts → suggestions → dashboard
```

**Logical-Level Flow:**
```
1. Data analyzed by AI
2. Insights generated
3. Recommendations created
4. Results displayed
```

**Tests:**
- `tests/ai-insights.test.ts` - Insights functionality
- `tests/recommendations.test.ts` - Recommendation logic

**Status:** ✅ **ACTIVE** - Available in analytics

**Database Elements:**
- `ai_insights` table: user_id, insight_type, data, generated
- `ai_recommendations` table: user_id, recommendation, impact
- `insight_history` table: user_id, insight, action_taken

**Requirements:**
- Data analysis
- AI processing
- Insight generation

**Activation Requirements:**
- Data sources connected
- AI processing active
- Display components ready

### **10.4 Prompt Sanitization for Security**
**Codebase Location:**
- `workers/src/lib/prompt-sanitizer.ts` - Sanitization logic
- `workers/src/routes/ai-llm.ts` - Applied to AI routes
- `lib/security-filters.ts` - Security filters

**File-Level Flow:**
```
User Input → Sanitization → Processing → Response
     ↓              ↓              ↓              ↓
Prompt → prompt-sanitizer.ts → security check → AI processing
Injection → detection → blocking → safe response
```

**Logical-Level Flow:**
```
1. User input received
2. Security sanitization applied
3. Injection attempts blocked
4. Safe processing continued
```

**Tests:**
- `tests/prompt-sanitization.test.ts` - Sanitization functionality
- `tests/security-filters.test.ts` - Filter logic

**Status:** ✅ **ACTIVE** - All AI inputs protected

**Database Elements:**
- `sanitization_logs` table: input_hash, violations, sanitized
- `security_incidents` table: input, violation_type, blocked
- `prompt_history` table: user_id, original_prompt, sanitized

**Requirements:**
- Pattern matching
- Sanitization rules
- Security monitoring

**Activation Requirements:**
- Sanitization active
- Rules configured
- Logging enabled

---

## **11. Infrastructure & DevOps**

### **11.1 Cloudflare Pages for Static UI Deployment**
**Codebase Location:**
- `next.config.js` - Pages configuration
- `wrangler.pages.toml` - Pages deployment
- `package.json` - Build scripts

**File-Level Flow:**
```
Code → Build → Deploy → Serve
     ↓              ↓              ↓              ↓
Next.js → npm run build → wrangler pages deploy → Cloudflare CDN
Static → output: 'export' → Pages functions → global CDN
```

**Logical-Level Flow:**
```
1. Code built to static files
2. Deployed to Cloudflare Pages
3. Served via global CDN
4. API calls proxied to Workers
```

**Tests:**
- `tests/pages-deployment.test.ts` - Deployment verification
- `tests/static-build.test.ts` - Build validation

**Status:** ✅ **ACTIVE** - Live at wordis-bond.com

**Database Elements:**
- No database storage for Pages deployment

**Requirements:**
- Next.js static export
- Cloudflare Pages account
- Build pipeline

**Activation Requirements:**
- Pages project configured
- Build script working
- Deployment automated

### **11.2 Cloudflare Workers for API Backend**
**Codebase Location:**
- `workers/src/index.ts` - Worker entry point
- `wrangler.toml` - Worker configuration
- `workers/src/routes/` - API routes

**File-Level Flow:**
```
Request → Worker → Route Handler → Response
     ↓              ↓              ↓              ↓
HTTP → workers/src/index.ts → route matching → processing
API → Hono framework → business logic → database
```

**Logical-Level Flow:**
```
1. HTTP request received
2. Route matched and processed
3. Business logic executed
4. Response returned
```

**Tests:**
- `tests/worker-deployment.test.ts` - Worker functionality
- `tests/api-routing.test.ts` - Route handling

**Status:** ✅ **ACTIVE** - Live at wordisbond-api.adrper79.workers.dev

**Database Elements:**
- All application data stored in Neon PostgreSQL

**Requirements:**
- Cloudflare Workers account
- Hono framework
- Database connections

**Activation Requirements:**
- Worker deployed
- Routes configured
- Environment variables set

### **11.3 Neon PostgreSQL with Hyperdrive Connection Pooling**
**Codebase Location:**
- `workers/src/lib/db.ts` - Database connection
- `lib/pgClient.ts` - Client configuration
- `migrations/` - Database schema

**File-Level Flow:**
```
Query → Connection Pool → Database → Response
     ↓              ↓              ↓              ↓
SQL → db.ts → Hyperdrive → Neon PostgreSQL
Pooling → connection reuse → performance → results
```

**Logical-Level Flow:**
```
1. Database connection requested
2. Pool provides connection
3. Query executed
4. Connection returned to pool
```

**Tests:**
- `tests/database-connection.test.ts` - Connection functionality
- `tests/connection-pooling.test.ts` - Pooling verification

**Status:** ✅ **ACTIVE** - All data operations working

**Database Elements:**
- All application tables in Neon PostgreSQL
- Connection pooling via Hyperdrive

**Requirements:**
- Neon database
- Hyperdrive configuration
- Connection pooling

**Activation Requirements:**
- Database URL configured
- Hyperdrive enabled
- Pool settings optimized

### **11.4 Cloudflare R2 for File Storage**
**Codebase Location:**
- `workers/src/routes/recordings.ts` - R2 integration
- `lib/r2-client.ts` - R2 client
- `workers/src/lib/signed-urls.ts` - URL generation

**File-Level Flow:**
```
File → Upload → R2 Storage → Access URL
     ↓              ↓              ↓              ↓
Recording → recordings.ts → R2 bucket → signed URL
Access → r2-client.ts → authentication → secure access
```

**Logical-Level Flow:**
```
1. File uploaded to R2
2. Metadata stored
3. Signed URL generated
4. Secure access provided
```

**Tests:**
- `tests/r2-storage.test.ts` - Storage functionality
- `tests/signed-urls.test.ts` - URL generation

**Status:** ✅ **ACTIVE** - All recordings stored

**Database Elements:**
- `recordings` table: r2_key, metadata
- R2 bucket for file storage

**Requirements:**
- R2 bucket
- Signed URL generation
- Access control

**Activation Requirements:**
- R2 configured
- Bucket permissions set
- URL signing active

### **11.5 Cloudflare KV for Caching and Sessions**
**Codebase Location:**
- `workers/src/lib/kv-client.ts` - KV operations
- `workers/src/lib/auth.ts` - Session storage
- `workers/src/lib/rate-limit.ts` - Rate limit storage

**File-Level Flow:**
```
Data → KV Operation → Storage → Retrieval
     ↓              ↓              ↓              ↓
Session → auth.ts → KV put → KV get
Cache → kv-client.ts → TTL → expiration
```

**Logical-Level Flow:**
```
1. Data stored in KV
2. TTL set for expiration
3. Data retrieved when needed
4. Automatic cleanup on expiration
```

**Tests:**
- `tests/kv-storage.test.ts` - Storage functionality
- `tests/session-management.test.ts` - Session handling

**Status:** ✅ **ACTIVE** - Sessions and caching working

**Database Elements:**
- Cloudflare KV namespace for sessions
- KV for rate limiting
- KV for caching

**Requirements:**
- KV namespace
- TTL management
- Key naming

**Activation Requirements:**
- KV configured
- Namespace bound
- TTL policies set

### **11.6 Structured JSON Logging**
**Codebase Location:**
- `workers/src/lib/logger.ts` - Logging implementation
- `workers/src/index.ts` - Logger integration
- `lib/log-processor.ts` - Log processing

**File-Level Flow:**
```
Event → Logger → Structured Log → Output
     ↓              ↓              ↓              ↓
Application → logger.ts → JSON format → Cloudflare Logs
Context → metadata → correlation → analysis
```

**Logical-Level Flow:**
```
1. Log event captured
2. Context and metadata added
3. JSON structure created
4. Log output generated
```

**Tests:**
- `tests/structured-logging.test.ts` - Logging functionality
- `tests/log-processing.test.ts` - Processing verification

**Status:** ✅ **ACTIVE** - All logs structured

**Database Elements:**
- Logs stored in Cloudflare Logpush
- No database storage for logs

**Requirements:**
- JSON serialization
- Context capture
- Correlation IDs

**Activation Requirements:**
- Logger integrated
- Context middleware active
- Logpush configured

### **11.7 Health Check Endpoints**
**Codebase Location:**
- `workers/src/routes/health.ts` - Health endpoints
- `lib/health-checker.ts` - Health logic
- `scripts/health-check.sh` - Health script

**File-Level Flow:**
```
Request → Health Check → Service Validation → Response
     ↓              ↓              ↓              ↓
Health → health.ts → database/KV/R2 check → status
Automated → health-checker.ts → monitoring → alerts
```

**Logical-Level Flow:**
```
1. Health check requested
2. Services validated
3. Status determined
4. Response returned
```

**Tests:**
- `tests/health-checks.test.ts` - Health functionality
- `tests/service-validation.test.ts` - Validation logic

**Status:** ✅ **ACTIVE** - Health monitoring working

**Database Elements:**
- Health status in monitoring
- No persistent storage

**Requirements:**
- Service checks
- Status determination
- Response formatting

**Activation Requirements:**
- Health routes deployed
- Services monitored
- Alerts configured

### **11.8 Environment Verification Scripts**
**Codebase Location:**
- `scripts/verify-env.ts` - Verification script
- `lib/env-validator.ts` - Validation logic
- `package.json` - Script integration

**File-Level Flow:**
```
Environment → Validation → Verification → Report
     ↓              ↓              ↓              ↓
Variables → verify-env.ts → checks → deployment ready
Configuration → env-validator.ts → validation → status
```

**Logical-Level Flow:**
```
1. Environment variables checked
2. Configuration validated
3. Deployment readiness determined
4. Report generated
```

**Tests:**
- `tests/env-verification.test.ts` - Verification functionality
- `tests/env-validation.test.ts` - Validation logic

**Status:** ✅ **ACTIVE** - Pre-deployment validation

**Database Elements:**
- No database storage for environment checks

**Requirements:**
- Variable checking
- Validation rules
- Report generation

**Activation Requirements:**
- Script configured
- Validation rules set
- CI/CD integrated

---

## **12. UI/UX Features**

### **12.1 Responsive Design with Persona-Based Mobile Navigation**
**Codebase Location:**
- `components/voice/MobileBottomNav.tsx` - Mobile navigation
- `hooks/useRBAC.ts` - Role detection
- `components/layout/AppShell.tsx` - Layout component

**File-Level Flow:**
```
User Role → Navigation Selection → UI Rendering
     ↓              ↓              ↓              ↓
Role Check → useRBAC() → MobileBottomNav.tsx → appropriate tabs
Responsive → screen size → layout → mobile/desktop
```

**Logical-Level Flow:**
```
1. User role determined
2. Navigation tabs selected
3. Responsive layout applied
4. Mobile-optimized UI displayed
```

**Tests:**
- `tests/mobile-navigation.test.ts` - Navigation functionality
- `tests/responsive-design.test.ts` - Responsive logic

**Status:** ✅ **ACTIVE** - Mobile navigation working

**Database Elements:**
- `user_roles` table for persona detection
- No UI-specific database storage

**Requirements:**
- Role detection
- Responsive design
- Mobile optimization

**Activation Requirements:**
- Navigation configured
- Roles assigned
- Mobile testing complete

### **12.2 Dark/Light Theme Support**
**Codebase Location:**
- `components/theme-provider.tsx` - Theme provider
- `components/mode-toggle.tsx` - Theme toggle
- `tailwind.config.js` - Theme configuration

**File-Level Flow:**
```
User Preference → Theme Selection → CSS Application
     ↓              ↓              ↓              ↓
Toggle → mode-toggle.tsx → theme-provider.tsx → Tailwind classes
System → preference detection → automatic → theme
```

**Logical-Level Flow:**
```
1. Theme preference detected
2. Theme classes applied
3. UI updated
4. Preference persisted
```

**Tests:**
- `tests/theme-support.test.ts` - Theme functionality
- `tests/theme-persistence.test.ts` - Persistence logic

**Status:** ✅ **ACTIVE** - Theme switching working

**Database Elements:**
- `user_preferences` table: theme_preference
- Local storage for immediate switching

**Requirements:**
- CSS variables
- Theme definitions
- Preference storage

**Activation Requirements:**
- Theme provider active
- Toggle component available
- Preferences persisted

### **12.3 Skeleton Loaders for Performance**
**Codebase Location:**
- `components/ui/Skeletons.tsx` - Skeleton components
- `components/dashboard/DashboardHome.tsx` - Applied to dashboard
- `hooks/useLoadingState.ts` - Loading state management

**File-Level Flow:**
```
Loading State → Skeleton Display → Content Load → Replacement
     ↓              ↓              ↓              ↓
Async → useLoadingState() → Skeletons.tsx → real content
Performance → immediate feedback → smooth transition → loaded
```

**Logical-Level Flow:**
```
1. Loading state detected
2. Skeleton displayed
3. Content loads
4. Skeleton replaced with content
```

**Tests:**
- `tests/skeleton-loaders.test.ts` - Loader functionality
- `tests/loading-states.test.ts` - State management

**Status:** ✅ **ACTIVE** - Performance optimization active

**Database Elements:**
- No database storage for loading states

**Requirements:**
- Loading state detection
- Skeleton components
- Transition handling

**Activation Requirements:**
- Skeletons designed
- Loading states managed
- Transitions smooth

### **12.4 Error Boundaries and Loading States**
**Codebase Location:**
- `app/error.tsx` - Root error boundary
- `components/ErrorBoundary.tsx` - Component boundaries
- `components/Loading.tsx` - Loading component

**File-Level Flow:**
```
Error → Boundary Catch → Fallback Display
     ↓              ↓              ↓              ↓
Exception → ErrorBoundary.tsx → error.tsx → user-friendly message
Recovery → error reset → retry → normal operation
```

**Logical-Level Flow:**
```
1. Error occurs
2. Boundary catches exception
3. Fallback UI displayed
4. Recovery options provided
```

**Tests:**
- `tests/error-boundaries.test.ts` - Boundary functionality
- `tests/error-handling.test.ts` - Error logic

**Status:** ✅ **ACTIVE** - Error handling working

**Database Elements:**
- `error_logs` table: error_details, user_context
- Error tracking for debugging

**Requirements:**
- Error catching
- Fallback UI
- Recovery mechanisms

**Activation Requirements:**
- Boundaries implemented
- Fallbacks designed
- Logging active

### **12.5 Keyboard Shortcuts and Help Overlays**
**Codebase Location:**
- `hooks/useKeyboardShortcuts.ts` - Shortcut logic
- `components/ui/KeyboardShortcutsHelp.tsx` - Help overlay
- `lib/shortcut-manager.ts` - Shortcut management

**File-Level Flow:**
```
Key Press → Shortcut Detection → Action Execution
     ↓              ↓              ↓              ↓
Keyboard → useKeyboardShortcuts() → action → UI update
Help (?) → KeyboardShortcutsHelp.tsx → overlay → display
```

**Logical-Level Flow:**
```
1. Keyboard event captured
2. Shortcut matched
3. Action executed
4. UI updated
```

**Tests:**
- `tests/keyboard-shortcuts.test.ts` - Shortcut functionality
- `tests/help-overlays.test.ts` - Overlay logic

**Status:** ✅ **ACTIVE** - Shortcuts available

**Database Elements:**
- `user_shortcuts` table: custom_shortcuts
- Default shortcuts in configuration

**Requirements:**
- Event handling
- Shortcut mapping
- Help system

**Activation Requirements:**
- Shortcuts configured
- Help overlay designed
- Event listeners active

### **12.6 Trust Signals (SOC 2, HIPAA Badges)**
**Codebase Location:**
- `components/layout/AppShell.tsx` - Trust signals
- `components/ui/TrustBadges.tsx` - Badge components
- `lib/compliance-status.ts` - Status logic

**File-Level Flow:**
```
Compliance Status → Badge Display → User Confidence
     ↓              ↓              ↓              ↓
Certification → compliance-status.ts → TrustBadges.tsx → sidebar
Validation → status check → display → trust building
```

**Logical-Level Flow:**
```
1. Compliance status verified
2. Appropriate badges displayed
3. User trust established
4. Credibility reinforced
```

**Tests:**
- `tests/trust-signals.test.ts` - Signal functionality
- `tests/compliance-badges.test.ts` - Badge logic

**Status:** ✅ **ACTIVE** - Badges displayed

**Database Elements:**
- `compliance_status` table: certification, valid_until
- Badge configuration in settings

**Requirements:**
- Certification data
- Badge components
- Display logic

**Activation Requirements:**
- Certifications current
- Badges designed
- Display active

### **12.7 Onboarding Wizard with Guided Setup**
**Codebase Location:**
- `app/onboarding/page.tsx` - Onboarding flow
- `components/onboarding/OnboardingWizard.tsx` - Wizard component
- `lib/onboarding-manager.ts` - Flow logic

**File-Level Flow:**
```
User Start → Step Progression → Completion
     ↓              ↓              ↓              ↓
Onboarding → OnboardingWizard.tsx → step logic → setup
Guidance → onboarding-manager.ts → validation → next step
```

**Logical-Level Flow:**
```
1. Onboarding initiated
2. Steps guided through
3. Validation performed
4. Completion achieved
```

**Tests:**
- `tests/onboarding-wizard.test.ts` - Wizard functionality
- `tests/onboarding-flow.test.ts` - Flow logic

**Status:** ✅ **ACTIVE** - Onboarding working

**Database Elements:**
- `onboarding_progress` table: user_id, step, completed
- `onboarding_data` table: user_id, responses

**Requirements:**
- Step definitions
- Validation logic
- Progress tracking

**Activation Requirements:**
- Wizard configured
- Steps defined
- Validation active

---

## **13. Testing & Quality Assurance**

### **13.1 Comprehensive Test Suite (210 tests)**
**Codebase Location:**
- `tests/` - Test directory
- `vitest.config.ts` - Test configuration
- `package.json` - Test scripts

**File-Level Flow:**
```
Test Execution → Runner → Assertions → Results
     ↓              ↓              ↓              ↓
Suite → vitest → test files → pass/fail
Coverage → istanbul → reports → analysis
```

**Logical-Level Flow:**
```
1. Tests executed
2. Assertions checked
3. Results reported
4. Coverage analyzed
```

**Tests:**
- Self-testing of test framework

**Status:** ✅ **ACTIVE** - 123 passing tests

**Database Elements:**
- Test data in separate database
- Test results in CI/CD

**Requirements:**
- Test framework
- Assertion library
- CI/CD integration

**Activation Requirements:**
- Tests written
- Framework configured
- CI/CD active

### **13.2 Production Test Validation**
**Codebase Location:**
- `tests/production/` - Production tests
- `vitest.production.config.ts` - Production config
- `scripts/test-production.sh` - Production script

**File-Level Flow:**
```
Production Tests → Execution → Validation → Deployment
     ↓              ↓              ↓              ↓
Critical → vitest production → checks → release
Validation → real data → verification → confidence
```

**Logical-Level Flow:**
```
1. Production tests run
2. Real scenarios validated
3. Deployment confidence gained
4. Release approved
```

**Tests:**
- Production test validation

**Status:** ✅ **ACTIVE** - Production validation working

**Database Elements:**
- Production test data
- Validation results

**Requirements:**
- Production-like environment
- Real data scenarios
- Validation criteria

**Activation Requirements:**
- Test environment configured
- Data scenarios prepared
- Validation criteria set

### **13.3 Load Testing Capabilities**
**Codebase Location:**
- `tests/load/` - Load tests
- `scripts/load-test.sh` - Load script
- `lib/load-generator.ts` - Load generation

**File-Level Flow:**
```
Load Generation → System Stress → Performance Measurement
     ↓              ↓              ↓              ↓
Requests → load-generator.ts → system → metrics
Scaling → concurrent users → limits → analysis
```

**Logical-Level Flow:**
```
1. Load generated
2. System stressed
3. Performance measured
4. Limits identified
```

**Tests:**
- Load test execution

**Status:** 🚧 **IN DEVELOPMENT** - Framework ready

**Database Elements:**
- Load test metrics
- Performance data

**Requirements:**
- Load generation tools
- Performance monitoring
- Analysis tools

**Activation Requirements:**
- Load scenarios defined
- Monitoring active
- Analysis configured

### **13.4 E2E Testing with Playwright**
**Codebase Location:**
- `playwright.config.ts` - Playwright config
- `tests/e2e/` - E2E tests
- `playwright-report/` - Test reports

**File-Level Flow:**
```
Browser Automation → User Flows → Validation
     ↓              ↓              ↓              ↓
Playwright → test scripts → assertions → results
End-to-End → real browser → full flows → confidence
```

**Logical-Level Flow:**
```
1. Browser automated
2. User flows executed
3. Validations performed
4. Results reported
```

**Tests:**
- E2E test execution

**Status:** 🚧 **IN DEVELOPMENT** - Framework configured

**Database Elements:**
- E2E test data
- Test results

**Requirements:**
- Playwright framework
- Browser automation
- Test scenarios

**Activation Requirements:**
- Test scripts written
- Browser configured
- Scenarios defined

### **13.5 Schema Validation and Drift Checking**
**Codebase Location:**
- `scripts/schema-drift-check.sh` - Drift checking
- `lib/schema-validator.ts` - Validation logic
- `ARCH_DOCS/DATABASE_SCHEMA_REGISTRY.md` - Registry

**File-Level Flow:**
```
Schema Analysis → Registry Comparison → Drift Detection
     ↓              ↓              ↓              ↓
Database → schema-validator.ts → registry → alerts
Validation → drift check → reports → fixes
```

**Logical-Level Flow:**
```
1. Schema analyzed
2. Registry compared
3. Drift detected
4. Reports generated
```

**Tests:**
- Schema validation tests

**Status:** ✅ **ACTIVE** - CI/CD integrated

**Database Elements:**
- Schema registry
- Drift reports

**Requirements:**
- Schema analysis
- Comparison tools
- Alert system

**Activation Requirements:**
- Registry maintained
- CI/CD integrated
- Alerts configured

### **13.6 Code Quality Linting and Formatting**
**Codebase Location:**
- `eslint.config.mjs` - ESLint config
- `.prettierrc` - Prettier config
- `husky/pre-commit` - Pre-commit hooks

**File-Level Flow:**
```
Code → Linting → Formatting → Quality
     ↓              ↓              ↓              ↓
Development → ESLint → Prettier → clean code
Pre-commit → husky → checks → commit
```

**Logical-Level Flow:**
```
1. Code written
2. Linting applied
3. Formatting enforced
4. Quality maintained
```

**Tests:**
- Code quality checks

**Status:** ✅ **ACTIVE** - Pre-commit hooks working

**Database Elements:**
- No database storage for code quality

**Requirements:**
- ESLint configuration
- Prettier configuration
- Husky hooks

**Activation Requirements:**
- Configs set
- Hooks installed
- Rules enforced

---

This comprehensive engineering guide documents every feature in the Word Is Bond platform. Each feature includes its codebase location, flow diagrams, tests, status, database dependencies, requirements, and activation criteria. The guide serves as the definitive reference for understanding, maintaining, and extending the platform's functionality.