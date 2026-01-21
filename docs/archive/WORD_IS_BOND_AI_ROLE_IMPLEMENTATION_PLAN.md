# Word Is Bond - AI Role Implementation Plan

## Document Purpose
**Strategic Implementation Plan** for enforcing the AI's role as *witness/notary/stenographer* rather than *negotiator/agent*. This plan ensures legal defensibility, human agency preservation, and regulatory compliance.

> **Core Principle**: "People speak the commitments. The system ensures those commitments are captured correctly."

---

## Executive Summary

### The Requirement
The AI in Word Is Bond must:
- ✅ **Frame** - Set procedural context
- ✅ **Guide** - Prompt humans to make confirmations
- ✅ **Witness** - Observe and record
- ✅ **Confirm** - Capture acknowledgments
- ✅ **Record** - Preserve evidence

The AI must **NEVER**:
- ❌ Negotiate on behalf of any party
- ❌ Persuade or influence agreement
- ❌ Speak commitments for humans
- ❌ Act as agent of intent

---

## Current State Assessment

### What's Currently Implemented (Functions Reviewed)

| Component | File | Current Behavior | Compliance Status |
|-----------|------|------------------|-------------------|
| **Survey Bot** | `lib/signalwire/surveySwmlBuilder.ts` | AI asks survey questions, captures responses | ⚠️ **REVIEW** - AI speaks questions |
| **Secret Shopper** | `lib/signalwire/shopperSwmlBuilder.ts` | AI role-plays as customer for QA | ❌ **VIOLATION** - AI is actor |
| **Translation** | `app/api/voice/swml/translation/route.ts` | AI provides real-time translation | ✅ **COMPLIANT** - Neutral service |
| **Transcription** | `app/actions/ai/triggerTranscription.ts` | AI transcribes recordings | ✅ **COMPLIANT** - Witness role |
| **Evidence Manifest** | `app/services/evidenceManifest.ts` | AI generates cryptographic evidence | ✅ **COMPLIANT** - Notary role |
| **Voice Ops** | `components/voice/VoiceOperationsClient.tsx` | Human initiates calls | ✅ **COMPLIANT** - Human agency |
| **Call Modulations** | `components/voice/CallModulations.tsx` | Toggles for recording/transcribe/survey | ⚠️ **REVIEW** - Survey unclear |

### Gap Analysis Summary

| Area | Gap | Risk Level | Effort |
|------|-----|------------|--------|
| **Secret Shopper** | AI acts as negotiating party | 🔴 HIGH | Medium |
| **Survey Bot** | AI asks questions (procedural, acceptable) | 🟡 MEDIUM | Low |
| **Disclosure System** | No explicit recording disclosure before calls | 🔴 HIGH | Low |
| **Confirmation Capture** | No structured verbal confirmation flow | 🟡 MEDIUM | Medium |
| **Human Prompting** | No guided operator prompts for confirmations | 🟡 MEDIUM | Medium |
| **Outcome Declaration** | Limited structured outcome capture | 🟡 MEDIUM | Medium |

---

## Feasibility Assessment

### ✅ Highly Feasible (Low Risk, Existing Patterns)

1. **Recording Disclosure System** - Add pre-call disclosure prompt
2. **Survey Bot Clarification** - Document that surveys are *procedural* not *contractual*
3. **Translation Disclosure** - Add disclosure that translation is AI-assisted
4. **Evidence Manifest Enhancement** - Add disclosure/confirmation tracking

### ⚠️ Feasible with Design Decisions Required

1. **Guided Confirmation Flow** - Requires UI/UX for operator prompts
2. **Outcome Declaration** - Requires structured summary generation
3. **Human Agency Enforcement** - Requires workflow changes

### ❌ Requires Strategic Decision (Out of Current Scope)

1. **Secret Shopper Repositioning** - Currently AI acts as customer (violates principle)
   - **Option A**: Rebrand as "QA Evaluation" with explicit disclosure
   - **Option B**: Make human-driven with AI observation only
   - **Option C**: Remove from contractual/agreement contexts

---

## Implementation Plan

### Phase 1: Immediate Compliance (Week 1)

#### Task 1.1: Recording Disclosure System
**Objective**: Ensure all calls begin with explicit disclosure

**Files to Modify**:
- `app/api/voice/laml/outbound/route.ts`
- `lib/signalwire/swmlBuilder.ts`
- `lib/signalwire/surveySwmlBuilder.ts`

**Implementation Steps**:
1. Add disclosure prompt before any AI/recording begins
2. Capture confirmation response
3. Log disclosure timestamp in `calls` table

**Prompt for Copilot**:
```
Add a pre-call disclosure system to the LaML/SWML builders:

1. In app/api/voice/laml/outbound/route.ts, before any <Record> or <Dial> verb, add:
   <Say voice="alice">This call may be recorded for quality and compliance purposes. By continuing, you consent to recording.</Say>

2. In lib/signalwire/swmlBuilder.ts, add a disclosure section at the start of the main array:
   { play: { url: "${appUrl}/audio/disclosure.mp3" } }
   OR use TTS: add a disclosure prompt before the AI agent

3. Update the calls table to track disclosure_given: boolean and disclosure_at: timestamptz

Ensure disclosure is given BEFORE recording begins, not after.
```

#### Task 1.2: Update AI Survey Bot Documentation
**Objective**: Clarify surveys are procedural, not contractual

**Files to Modify**:
- `ARCH_DOCS/02-FEATURES/AI_SURVEY_BOT.md`
- `lib/signalwire/surveySwmlBuilder.ts` (add disclosure)

**Prompt for Copilot**:
```
Update the AI Survey Bot to include:

1. Add explicit disclosure at start of survey:
   "This is an automated customer satisfaction survey. Your responses will be recorded. This survey does not constitute any agreement or commitment."

2. Update ARCH_DOCS/02-FEATURES/AI_SURVEY_BOT.md to document:
   - Surveys are procedural, not contractual
   - AI asks questions but does not negotiate
   - Responses are captured but not interpreted as commitments
   - Add a "Legal Considerations" section
```

#### Task 1.3: Add Translation Disclosure
**Objective**: Disclose AI translation to all parties

**Files to Modify**:
- `app/api/voice/swml/translation/route.ts`
- `lib/signalwire/swmlBuilder.ts`

**Prompt for Copilot**:
```
Add translation disclosure to live translation calls:

1. In app/api/voice/swml/translation/route.ts, add disclosure:
   "This call includes AI-powered real-time translation between [Language A] and [Language B]. Translation is provided as assistance only and may not capture exact nuances."

2. Store translation disclosure flag in calls metadata

3. Document in ARCH_DOCS that translation is a "neutral service" (accessibility support)
```

---

### Phase 2: Guided Confirmation System (Week 2)

#### Task 2.1: Operator Prompt System
**Objective**: Create UI prompts guiding human operators to capture confirmations

**New Files**:
- `components/voice/ConfirmationPrompts.tsx`
- `lib/confirmation/promptDefinitions.ts`
- `app/api/confirmations/route.ts`

**Database Migration**:
```sql
-- 20260120_confirmation_system.sql
CREATE TABLE call_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- What was confirmed
  confirmation_type TEXT NOT NULL, -- 'disclosure_accepted', 'terms_agreed', 'price_confirmed', etc.
  prompt_text TEXT NOT NULL, -- What the operator was prompted to ask
  
  -- Who confirmed
  confirmer_role TEXT NOT NULL, -- 'customer', 'operator', 'third_party'
  
  -- When
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recording_timestamp_seconds DECIMAL(10,2), -- Position in recording
  
  -- Verification
  captured_by TEXT NOT NULL DEFAULT 'human', -- 'human' | 'system'
  verification_method TEXT, -- 'verbal', 'keypress', 'biometric'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Prompt for Copilot**:
```
Create a guided confirmation system for call operators:

1. Create components/voice/ConfirmationPrompts.tsx:
   - Display prompts to operator during active calls
   - Show suggested questions like "Can you confirm you agree to [term]?"
   - Operator clicks to mark confirmation captured
   - Record timestamp in call timeline

2. Create lib/confirmation/promptDefinitions.ts:
   - Define standard confirmation prompts by use case
   - Prompts for: recording consent, terms agreement, price confirmation, scope confirmation

3. Create app/api/confirmations/route.ts:
   - POST: Record a confirmation
   - GET: List confirmations for a call
   - Include call_id, confirmation_type, timestamp, confirmer_role

4. Update CallDetailView.tsx to show confirmation timeline

The operator asks the question, the customer answers, the operator marks it captured.
AI never speaks the commitment question - the human does.
```

#### Task 2.2: Real-Time Call Guidance Panel
**Objective**: Show operators what to ask during calls

**Files to Modify**:
- `components/voice/ActiveCallPanel.tsx` (new)
- `components/voice/VoiceOperationsClient.tsx`

**Prompt for Copilot**:
```
Create an ActiveCallPanel component that shows during active calls:

1. Create components/voice/ActiveCallPanel.tsx:
   - Shows when a call is in-progress
   - Displays current call duration, status
   - Shows "Confirmation Checklist" with prompts:
     □ Recording disclosed
     □ Terms explained
     □ Price confirmed (if applicable)
     □ Agreement captured
   - Each item has a "Mark Confirmed" button
   - Operator clicks when customer verbally confirms

2. Integrate into VoiceOperationsClient.tsx:
   - Show ActiveCallPanel when call status is 'in-progress'
   - Hide when call ends
   - Persist confirmations to database

The AI observes the call. The human asks the questions.
```

---

### Phase 3: Outcome Declaration System (Week 3)

#### Task 3.1: Structured Outcome Capture
**Objective**: After calls, capture what was agreed/not agreed

**New Files**:
- `components/voice/OutcomeDeclaration.tsx`
- `app/api/calls/[id]/outcome/route.ts`

**Database Migration**:
```sql
-- 20260127_call_outcomes.sql
CREATE TABLE call_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID UNIQUE NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Outcome summary
  outcome_status TEXT NOT NULL CHECK (outcome_status IN ('agreed', 'declined', 'partial', 'inconclusive', 'pending_review')),
  
  -- What was agreed
  agreed_items JSONB DEFAULT '[]', -- Array of {term: string, confirmed: boolean, timestamp: number}
  
  -- What was NOT agreed
  declined_items JSONB DEFAULT '[]',
  
  -- Ambiguities flagged
  ambiguities JSONB DEFAULT '[]', -- Array of {issue: string, timestamp: number}
  
  -- Summary for record
  summary_text TEXT,
  
  -- Verification
  declared_by UUID REFERENCES users(id), -- Human who declared outcome
  declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Read-back confirmation
  readback_confirmed BOOLEAN DEFAULT false,
  readback_timestamp_seconds DECIMAL(10,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Prompt for Copilot**:
```
Create an Outcome Declaration system for post-call capture:

1. Create components/voice/OutcomeDeclaration.tsx:
   - Form shown after call ends
   - Fields:
     - Outcome Status: dropdown (Agreed, Declined, Partial, Inconclusive)
     - Agreed Items: multi-select or text list
     - Declined Items: multi-select or text list
     - Ambiguities: text area for flagging unclear items
     - Summary: AI-assisted summary generation (editable by human)
   - "Declare Outcome" button submits to API
   - Optional: "Readback Confirmed" checkbox if summary was read to customer

2. Create app/api/calls/[id]/outcome/route.ts:
   - POST: Create/update outcome declaration
   - GET: Retrieve outcome for call
   - Only human users can declare outcomes (not AI)

3. Integrate into CallDetailView.tsx:
   - Show OutcomeDeclaration after call completes
   - Display declared outcome in call details

The system records what happened. The human declares the meaning.
```

#### Task 3.2: AI-Assisted Summary (Human Confirms)
**Objective**: AI generates summary, human verifies and confirms

**Files to Modify**:
- `app/api/calls/[id]/summary/route.ts` (new)
- `components/voice/OutcomeDeclaration.tsx`

**Prompt for Copilot**:
```
Add AI-assisted summary generation with human confirmation:

1. Create app/api/calls/[id]/summary/route.ts:
   - POST: Generate summary from transcript
   - Uses OpenAI to summarize what was discussed
   - Returns structured summary with:
     - topics_discussed: string[]
     - potential_agreements: string[]
     - potential_concerns: string[]
     - recommended_followup: string[]
   - Mark as "AI_GENERATED - REQUIRES_HUMAN_REVIEW"

2. In OutcomeDeclaration.tsx:
   - Add "Generate Summary" button that calls the summary API
   - Display AI summary in editable textarea
   - Show banner: "This summary was AI-generated. Please review and edit before confirming."
   - Require human to click "I confirm this summary is accurate"
   - Log who confirmed and when

The AI summarizes. The human verifies. The human confirms.
```

---

### Phase 4: Secret Shopper Repositioning (Week 4) ⚠️

**STRATEGIC DECISION REQUIRED**

The Secret Shopper feature currently has AI role-playing as a customer, which violates the "AI never speaks on behalf of intent" principle.

#### Option A: QA Evaluation Disclosure (Recommended)
- Keep functionality, add explicit disclosure that this is an AI-driven quality evaluation
- Not suitable for agreement/contract contexts
- Document clearly that this is evaluation, not negotiation

**Prompt for Copilot (if Option A chosen)**:
```
Reposition Secret Shopper as "AI Quality Evaluation" with clear disclosure:

1. Update lib/signalwire/shopperSwmlBuilder.ts:
   - Add disclosure at start: "This is an AI-assisted quality evaluation call. This call is for evaluation purposes only and does not constitute any service agreement or commitment."

2. Update ARCH_DOCS/02-FEATURES/SECRET_SHOPPER_INFRASTRUCTURE.md:
   - Rename to "AI Quality Evaluation"
   - Add section: "Legal Positioning"
   - Document: This feature is for internal QA only, not customer-facing agreements

3. Update UI labels:
   - "Secret Shopper" → "AI Quality Evaluation"
   - Add tooltips explaining purpose

4. Add capability restriction:
   - Secret Shopper cannot be used in contexts where agreements are captured
   - Flag if call has both secret_shopper and confirmation_capture enabled
```

#### Option B: Human-Driven with AI Observation
- Human makes the call, AI observes and scores
- Most compliant, but changes product significantly

#### Option C: Scope Limitation
- Secret Shopper only for non-contractual contexts
- Add explicit warnings in UI

---

### Phase 5: Documentation & Compliance (Week 5)

#### Task 5.1: Architecture Documentation Update
**Files to Create/Modify**:
- `ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md` (new)
- `ARCH_DOCS/02-FEATURES/*.md` (all feature docs)

**Prompt for Copilot**:
```
Create comprehensive AI Role Policy documentation:

1. Create ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md with sections:
   
   ## AI Role in Word Is Bond
   
   ### Permitted AI Functions
   - Disclosures (procedural announcements)
   - Instructions (how to proceed)
   - Neutral summaries (read-back for confirmation)
   - Translations (with disclosure)
   - Accessibility support
   - Transcription (witness function)
   - Evidence generation (notary function)
   
   ### Prohibited AI Functions
   - Negotiation on behalf of any party
   - Persuasion or sales
   - Agreement on behalf of humans
   - Commitment statements
   
   ### The Four Phases
   1. System Disclosure (AI may speak - procedural)
   2. Human-to-Human Conversation (AI silent, recording)
   3. Guided Confirmation (AI prompts human, human asks customer)
   4. Outcome Declaration (System captures, human confirms)
   
   ### Legal Positioning
   - Word Is Bond is infrastructure, not an actor
   - The system is notary + stenographer + compliance officer
   - Courts ask "who said it" - answer must always be human

2. Update all feature docs to reference AI_ROLE_POLICY.md
```

#### Task 5.2: Compliance Audit Checklist
**New File**: `ARCH_DOCS/07-COMPLIANCE/AI_ROLE_AUDIT_CHECKLIST.md`

**Prompt for Copilot**:
```
Create an AI Role Compliance Audit Checklist:

1. Create ARCH_DOCS/07-COMPLIANCE/AI_ROLE_AUDIT_CHECKLIST.md:

   ## Pre-Release Checklist
   
   ### Recording Disclosure
   - [ ] All calls have disclosure before recording
   - [ ] Disclosure timestamp captured
   - [ ] Disclosure text is neutral, not persuasive
   
   ### Human Agency
   - [ ] All commitments spoken by humans
   - [ ] AI never negotiates
   - [ ] Operator prompts for confirmations (not AI)
   
   ### Confirmation Capture
   - [ ] Confirmations tagged with who (human/customer)
   - [ ] Timestamps linked to recording
   - [ ] Human declares outcome, not AI
   
   ### Secret Shopper
   - [ ] Disclosed as AI evaluation
   - [ ] Not used for agreement capture
   - [ ] Clearly labeled in UI
   
   ### Surveys
   - [ ] Disclosed as automated survey
   - [ ] Does not capture contractual commitments
   - [ ] Responses are feedback, not agreements
   
   ### Translation
   - [ ] Disclosed as AI-assisted
   - [ ] Nuance disclaimer included
   - [ ] Original language preserved
```

---

## Success Criteria

### Phase 1 Complete When: ✅ COMPLETE (January 18, 2026)
- [x] All calls begin with recording disclosure
- [x] Disclosure timestamp stored in database
- [x] Survey bot has procedural disclaimer
- [x] Translation has AI disclosure

### Phase 2 Complete When: ✅ COMPLETE (January 18, 2026)
- [x] Operators see confirmation prompts during calls
- [x] Confirmations are logged with timestamps
- [x] Human marks confirmations, not AI

**Phase 2 Implementation:**
- Created `lib/confirmation/promptDefinitions.ts` - Type definitions & templates
- Created `components/voice/ConfirmationPrompts.tsx` - Checklist UI component
- Created `app/api/calls/[id]/confirmations/route.ts` - Confirmation capture API
- Updated `components/voice/ActiveCallPanel.tsx` - Integrated confirmation checklist
- Updated `components/voice/VoiceOperationsClient.tsx` - Added organizationId prop
- Created `supabase/migrations/20260120_confirmation_system.sql` - Database tables

### Phase 3 Complete When:
- [x] Outcome declaration form exists
- [x] AI summary is human-editable and human-confirmed
- [x] Ambiguities can be flagged

### Phase 4 Complete When: ✅ COMPLETE
- [x] Secret Shopper repositioned (per strategic decision)
- [x] UI labels updated
- [x] Documentation reflects new positioning

### Phase 5 Complete When: ✅ COMPLETE (January 27, 2026)
- [x] AI_ROLE_POLICY.md published (v5.0.0)
- [x] All feature docs updated:
  - AI_SURVEY_BOT.md (v2.0.0)
  - BOOKING_SCHEDULING.md (v2.0.0)
  - TRANSLATION_AGENT_IMPLEMENTATION_PLAN.md (v2.0.0)
  - SECRET_SHOPPER_INFRASTRUCTURE.md (AI Quality Evaluation)
  - SYSTEM_OF_RECORD_COMPLIANCE.md (v2.0.0)
- [x] Compliance audit checklist passed

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI speaks commitment accidentally | Prompt review, forbidden phrase list |
| Human skips confirmation | Required checkbox before call end |
| Disclosure not given | Pre-call disclosure mandatory |
| Secret Shopper misused | Capability restrictions, warnings |
| Summary mistaken for agreement | "AI GENERATED" banners, human confirm required |

---

## One Sentence Summary

> **People speak the commitments. The system ensures those commitments are captured correctly.**

---

## Appendix: Prompt Library

### Prompt 1: Recording Disclosure LaML
```xml
<Say voice="alice">This call is being recorded for quality and compliance purposes. If you do not wish to be recorded, please disconnect now. By continuing, you consent to recording.</Say>
```

### Prompt 2: Survey Disclaimer
```
This is an automated customer satisfaction survey. Your responses are for feedback purposes only and do not constitute any agreement or commitment. The survey will take approximately [X] minutes.
```

### Prompt 3: Translation Disclosure
```
This call includes AI-powered real-time translation between [Language A] and [Language B]. Translation is provided to assist communication and may not capture every nuance. Please confirm understanding of important terms directly with the other party.
```

### Prompt 4: Outcome Declaration Reminder
```
Before closing this call, please declare the outcome:
- What was agreed?
- What was not agreed?
- Are there any ambiguities?
The system will generate a summary for your review and confirmation.
```

---

*Document Version: 1.0*
*Created: January 18, 2026*
*Author: GitHub Copilot*
*Status: READY FOR IMPLEMENTATION*
