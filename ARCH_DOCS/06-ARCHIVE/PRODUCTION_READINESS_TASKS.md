# Production Readiness Task List

**Generated:** 2026-01-09  
**Authority:** ARCH_DOCS (MASTER_ARCHITECTURE.txt, MEDIA_PLANE_ARCHITECTURE.txt, Schema.txt, etc.)  
**Current State:** Partial implementation - Core infrastructure exists, but many production-critical features are incomplete

---

## Executive Summary

The codebase has a solid foundation with:
- ✅ Basic Voice Operations UI structure (`app/voice/page.tsx`)
- ✅ SignalWire call initiation (`app/actions/calls/startCallHandler.ts`)
- ✅ Voice config API (`app/api/voice/config/route.ts`)
- ✅ Basic LaML endpoint (`app/api/voice/laml/outbound/route.ts`)
- ✅ AssemblyAI transcription trigger (`app/actions/ai/triggerTranscription.ts`)
- ✅ Database schema mostly complete (per Schema.txt)

**Critical Gaps for Production:**
- ❌ Incomplete webhook handlers (SignalWire, AssemblyAI)
- ❌ Missing evidence manifest generation
- ❌ Incomplete call modulation features (translation, surveys, secret shopper)
- ❌ Missing RBAC/plan gating enforcement
- ❌ No error handling system
- ❌ Missing health checks and monitoring

---

## Task Categories

### 1. Core Integration Completion (Critical - Week 1)

#### Task 1.1: Complete SignalWire Webhook Handler
**File:** `app/api/webhooks/signalwire/route.ts`  
**Status:** Stub exists, needs full implementation  
**Requirements:**
- Parse form-encoded webhook payloads
- Handle `CallStatus` events (completed, failed, no-answer, busy)
- Handle `RecordingStatus` events (completed)
- Update `calls` table: status, ended_at, duration
- Update `recordings` table: recording_url, recording_sid, duration_seconds
- Link recordings to calls via call_sid
- Trigger transcription if enabled in voice_configs
- Return 200 OK quickly (async processing for heavy work)

**Reference:** MASTER_ARCHITECTURE.txt sequence diagram, SECRET_SHOPPER_INFRASTRUCTURE.md

#### Task 1.2: Implement AssemblyAI Webhook Handler
**File:** `app/api/webhooks/assemblyai/route.ts` (create new)  
**Status:** Missing  
**Requirements:**
- Receive transcription completion webhooks
- Update `recordings.transcript_json` with full transcript
- Update `ai_runs` table: status=completed, output=transcript JSON
- If translation enabled, trigger translation pipeline
- If survey enabled, extract survey responses from transcript
- Generate evidence manifest if all artifacts complete

**Reference:** MASTER_ARCHITECTURE.txt, triggerTranscription.ts

#### Task 1.3: Enhance LaML Script Generation
**File:** `app/api/voice/laml/outbound/route.ts`  
**Status:** Basic implementation, needs modulation support  
**Requirements:**
- Fetch voice_configs for the call
- Generate LaML with `<Record>` if recording enabled
- Inject translation prompts if translation enabled
- Inject survey prompts if survey enabled
- Inject secret shopper script if synthetic_caller enabled
- Support dynamic script fetching from `/api/voice/script?callSid=...`

**Reference:** MEDIA_PLANE_ARCHITECTURE.txt, SECRET_SHOPPER_INFRASTRUCTURE.md

---

### 2. Call Modulations (High Priority - Week 1-2)

#### Task 2.1: Translation Pipeline
**Status:** Not implemented  
**Requirements:**
- When `voice_configs.translate = true`, trigger AssemblyAI translation
- Use `translate_from` and `translate_to` language codes
- Store translation results in `ai_runs` table with model='assemblyai-translation'
- Link translation to original transcript via call_id
- Update evidence manifest with translation

**Reference:** MASTER_ARCHITECTURE.txt sequence diagram

#### Task 2.2: After-Call Survey System
**Status:** Not implemented  
**Requirements:**
- Inject survey prompts via LaML during call
- Collect DTMF or voice responses
- Process responses via AssemblyAI NLP
- Store survey results in `evidence_manifests.manifest` JSON
- Link to `surveys` table if survey_id specified

**Reference:** MASTER_ARCHITECTURE.txt, Schema.txt (surveys table)

#### Task 2.3: Secret Shopper as Call Modulation
**Status:** Not implemented  
**Requirements:**
- Treat secret shopper as call modulation (not separate tool)
- Add script storage (could use voice_configs JSONB or new table)
- Generate LaML with scripted prompts
- Auto-score based on expected outcomes
- Store results in standard call artifacts (recordings, transcripts)
- Link to evidence manifest

**Reference:** SECRET_SHOPPER_INFRASTRUCTURE.md, UX_DESIGN_PRINCIPLES.txt (v2.0)

---

### 3. Artifact & Evidence System (High Priority - Week 2)

#### Task 3.1: Evidence Manifest Generation
**Status:** Not implemented  
**File:** Create `app/services/evidenceManifest.ts`  
**Requirements:**
- Generate immutable evidence manifests per call
- Link: recording, transcript, translation, survey, scores
- Store in `evidence_manifests` table
- Include provenance metadata (when, which model, which version)
- Support export/audit use cases

**Reference:** MASTER_ARCHITECTURE.txt, evidence_manifest_sample.json

#### Task 3.2: Recording Storage Integration
**Status:** Partial (SignalWire provides URLs, but no Supabase Storage upload)  
**Requirements:**
- Download recordings from SignalWire URLs
- Upload to Supabase Storage bucket (`recordings` bucket)
- Path: `{organization_id}/{call_id}/{recording_id}.mp3`
- Set up RLS policies for secure access
- Generate signed URLs for playback
- Update `recordings.storage_path` column

**Reference:** SECRET_SHOPPER_INFRASTRUCTURE.md, Schema.txt

---

### 4. Security & Access Control (Critical - Week 2)

#### Task 4.1: RBAC Implementation
**Status:** Partial (org_members table exists, but enforcement missing)  
**Requirements:**
- Implement role-based access control per RBAC matrix
- Roles: Owner, Admin, Operator, Analyst, Viewer
- Plan gating: Base, Pro, Insights, Global
- Middleware to check permissions on API routes
- UI to hide/disable features based on role/plan
- Audit all permission checks

**Reference:** MASTER_ARCHITECTURE.txt RBAC section

#### Task 4.2: Webhook Security
**Status:** Missing  
**Requirements:**
- Validate SignalWire webhook signatures
- Validate AssemblyAI webhook signatures
- Add IP allowlisting if possible
- Rate limit webhook endpoints
- Log all webhook attempts

**Reference:** ERROR_HANDLING_PLAN.txt, security best practices

---

### 5. Error Handling & Observability (High Priority - Week 2)

#### Task 5.1: Error Handling System
**Status:** AppError class exists, but catalog missing  
**File:** Create `lib/errors/errorCatalog.ts`, `lib/errors/errorTracker.ts`  
**Requirements:**
- Centralized error catalog with codes, categories, severities
- Error tracking with unique IDs (ERR_YYYYMMDD_ABC123)
- KPI collection for error frequency
- Structured error responses
- Integration with monitoring (Sentry)

**Reference:** ERROR_HANDLING_PLAN.txt

#### Task 5.2: Health Checks
**Status:** Missing  
**File:** Create `app/api/health/route.ts`  
**Requirements:**
- SignalWire connectivity check
- AssemblyAI API availability
- Database connectivity
- Supabase Storage accessibility
- Return health status (healthy, degraded, critical)

**Reference:** MEDIA_PLANE_ARCHITECTURE.txt

#### Task 5.3: Monitoring & Alerting
**Status:** Missing  
**Requirements:**
- Integrate Sentry for error tracking
- Set up Vercel log aggregation
- Configure alerts for:
  - Call failure rate > 5%
  - Transcription errors
  - Webhook processing failures
  - High error rates
- Dashboard for system health

---

### 6. UI Completion (Medium Priority - Week 2-3)

#### Task 6.1: Complete Voice Operations UI
**File:** `app/voice/page.tsx`, `components/voice/*`  
**Status:** Basic structure exists  
**Requirements:**
- Single-page implementation (no tool tabs)
- Call list with filters (status, date, score)
- Call detail view with all modulations visible
- Modulation toggles (recording, transcription, translation, survey, secret shopper)
- Artifact viewer (recording player, transcript, evidence manifest)
- Activity feed with real-time updates
- Plan upgrade prompts for disabled features

**Reference:** UX_DESIGN_PRINCIPLES.txt v2.0, MASTER_ARCHITECTURE.txt

#### Task 6.2: Real-time Updates
**Status:** Missing  
**Requirements:**
- Supabase real-time subscriptions for call status
- Polling fallback for recording/transcription completion
- Optimistic UI updates
- Activity feed updates

---

### 7. API Completeness (Medium Priority - Week 3)

#### Task 7.1: Missing API Endpoints
**Status:** Several endpoints missing per contract  
**Requirements:**
- `/api/voice/targets` (GET) - List voice targets
- `/api/campaigns` (GET) - List campaigns
- `/api/voice/call` (POST) - Execute call (may exist as `/api/calls/start`)
- `/api/surveys` (GET) - List surveys
- `/api/shopper/scripts` (GET) - List shopper scripts (if separate table)
- `/api/recordings/:id` (GET) - Get recording with signed URL
- `/api/transcripts/:id` (GET) - Get transcript
- `/api/evidence/:id` (GET) - Get evidence manifest

**Reference:** MASTER_ARCHITECTURE.txt UI→API→Table contract

---

### 8. Database & Schema (Medium Priority - Week 1)

#### Task 8.1: Verify Schema Completeness
**Status:** Most tables exist, but verify  
**Requirements:**
- Verify all tables from Schema.txt exist
- Check for missing tables: `voice_targets`, `campaigns`, `surveys`, `shopper_scripts` (if needed)
- Verify foreign key relationships
- Add missing indexes for performance
- Set up RLS policies for all tables

**Reference:** Schema.txt

#### Task 8.2: Migration Scripts
**Status:** Some migrations exist  
**Requirements:**
- Create migration for any missing tables
- Add indexes for frequently queried columns
- Set up RLS policies
- Test migrations on staging

---

### 9. Testing & Quality (Ongoing)

#### Task 9.1: Unit Tests
**Status:** Minimal  
**Requirements:**
- Test critical paths: call execution, webhook processing
- Test error handling
- Test RBAC enforcement
- Mock external services (SignalWire, AssemblyAI)

#### Task 9.2: Integration Tests
**Status:** Missing  
**Requirements:**
- End-to-end call flow test
- Webhook processing test
- Transcription pipeline test
- Evidence manifest generation test

---

### 10. Documentation (Ongoing)

#### Task 10.1: API Documentation
**Status:** Missing  
**Requirements:**
- Document all API endpoints
- Request/response schemas
- Authentication requirements
- Error codes

#### Task 10.2: Deployment Runbook
**Status:** FREESWITCH_RUNBOOK.md exists for Phase 2  
**Requirements:**
- Phase 1 (SignalWire-only) deployment guide
- Environment variable setup
- Health check procedures
- Troubleshooting guide

---

## Priority Order for Production

### Must Have (Week 1)
1. Complete SignalWire webhook handler
2. Complete AssemblyAI webhook handler
3. Enhance LaML generation with modulations
4. Evidence manifest generation
5. RBAC enforcement
6. Error handling system
7. Health checks

### Should Have (Week 2)
8. Translation pipeline
9. After-call survey system
10. Secret shopper modulation
11. Recording storage integration
12. Real-time UI updates
13. Monitoring/alerting

### Nice to Have (Week 3+)
14. Complete API endpoints
15. Comprehensive testing
16. Documentation
17. Performance optimization

---

## Architecture Compliance Checklist

- [x] Voice-first, call-rooted design
- [x] SignalWire-first v1 (no FreeSWITCH dependency)
- [ ] Single Voice Operations page (UI structure exists, needs completion)
- [ ] Call modulations as toggles (partially implemented)
- [ ] Evidence manifests (not implemented)
- [ ] RBAC enforcement (not implemented)
- [ ] Plan gating (not implemented)
- [ ] Error handling system (not implemented)
- [ ] Health checks (not implemented)

---

## Notes

- **FreeSWITCH Phase 2** is explicitly deferred per architecture. Do not implement FreeSWITCH features.
- **Secret Shopper** is a call modulation, not a separate tool. Implement as part of voice_configs.
- **All execution** must go through API routes, never directly from UI.
- **Artifacts are immutable** once finalized.
- **Plan gating** controls availability, **Role** controls authority.

---

**Next Steps:**
1. Review this task list with the team
2. Prioritize based on business needs
3. Assign tasks to engineers
4. Set up project tracking (GitHub Issues, Jira, etc.)
5. Begin with Week 1 critical tasks
