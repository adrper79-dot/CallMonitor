# AI Role Policy

**Document:** AI_ROLE_POLICY.md  
**Version:** 5.0.0  
**Last Updated:** January 27, 2026  
**Status:** COMPLETE - All 5 Phases Implemented  

> **Core Principle:** "People speak the commitments. The system ensures those commitments are captured correctly."

---

## Executive Summary

Word Is Bond positions AI as **infrastructure, not an actor**. The AI functions as a notary, stenographer, and compliance officer - standing in the room but never speaking on behalf of any party's intent.

This policy defines what AI may and may not do within the Word Is Bond platform to ensure:
- Legal defensibility
- Human agency preservation
- Regulatory compliance
- Trust and transparency

---

## 1. The AI Role Model

### Mental Model

Think of the AI as:

> **A notary + stenographer + compliance officer standing in the room — not speaking for anyone.**

The AI:
- ✅ **Frames** - Sets procedural context
- ✅ **Guides** - Prompts humans to make confirmations
- ✅ **Witnesses** - Observes and records
- ✅ **Confirms** - Captures acknowledgments
- ✅ **Records** - Preserves evidence

The AI does **NOT**:
- ❌ Negotiate on behalf of any party
- ❌ Persuade or influence agreement
- ❌ Speak commitments for humans
- ❌ Act as agent of intent

---

## 2. Permitted AI Functions

### 2.1 Disclosures (Procedural Announcements)

AI may speak procedural disclosures such as:

```
"This call may be recorded for quality assurance and compliance purposes. 
By continuing, you consent to recording."
```

**Characteristics:**
- Neutral, informational
- No persuasion or sales language
- Given BEFORE recording/processing begins
- Logged with timestamp

### 2.2 Instructions (How to Proceed)

AI may provide neutral instructions:

```
"Please say your response after the beep."
"Press 1 for yes, 2 for no."
```

### 2.3 Neutral Summaries (Read-back for Confirmation)

AI may read back summaries for human confirmation:

```
"Here is a summary of what was discussed: [summary]. 
Please confirm if this is accurate."
```

**Important:** The human must confirm. AI never assumes confirmation.

### 2.4 Translations (Accessibility Support)

AI may provide real-time translation with disclosure:

```
"This call includes AI-powered real-time translation. 
Translation is provided to assist communication and may not capture every nuance."
```

**Important:** Original language is preserved for canonical record.

### 2.5 Transcription (Witness Function)

AI may transcribe spoken words without interpretation:
- Captures what was said
- Does not interpret meaning
- Does not infer intent
- Produces canonical transcript (AssemblyAI authoritative)

### 2.6 Evidence Generation (Notary Function)

AI may generate evidence artifacts:
- Creates cryptographic hashes
- Timestamps events
- Bundles artifacts
- Never modifies source content

### 2.7 Survey Questions (Procedural Feedback)

AI may conduct surveys with disclosure:

```
"This is an automated customer satisfaction survey. 
Your responses are for feedback purposes only and do not constitute any agreement."
```

**Important:** Surveys are PROCEDURAL, not CONTRACTUAL.

---

## 3. Prohibited AI Functions

### 3.1 Negotiation

AI must NEVER negotiate on behalf of any party:

❌ "I can offer you a 10% discount if you agree today."
❌ "Would you accept $500 as a settlement?"
❌ "I think that's a fair deal, you should accept."

### 3.2 Persuasion

AI must NEVER attempt to persuade or influence:

❌ "This is a great opportunity you shouldn't miss."
❌ "Most customers find this very satisfying."
❌ "I strongly recommend you proceed."

### 3.3 Agreement on Behalf of Humans

AI must NEVER commit on anyone's behalf:

❌ "You have agreed to the terms."
❌ "Your confirmation is noted and binding."
❌ "The deal is now finalized."

### 3.4 Commitment Statements

AI must NEVER make promises or commitments:

❌ "We guarantee your satisfaction."
❌ "This will definitely solve your problem."
❌ "You can count on us to deliver."

---

## 4. The Four Conversation Phases

### Phase 1: System Disclosure (AI May Speak)

The system speaks procedural announcements:
- Recording disclosure
- Translation disclosure
- Survey disclosure

**This is procedural, not contractual.**

### Phase 2: Human-to-Human Conversation (AI Silent)

The humans:
- Explain terms
- Ask questions
- Negotiate
- Agree or decline

**The AI is silent, listening, recording.**

### Phase 3: Guided Confirmation (AI Prompts Human)

At key points, the system prompts the human operator:

> "Please confirm: are you agreeing to [specific term]?"

**The HUMAN asks the question. The CUSTOMER answers.**

### Phase 4: Outcome Declaration (System Capture)

The system records:
- What was agreed
- What was not agreed
- Where ambiguity exists

**Optionally, the system reads back a summary, but humans confirm.**

---

## 5. Feature Compliance Matrix

| Feature | AI Speaks | Permitted Function | Disclosure Required |
|---------|-----------|-------------------|---------------------|
| Recording | Yes (disclosure only) | Procedural | Yes - before recording |
| Transcription | No | Witness | No |
| Translation | Yes (disclosure only) | Neutral service | Yes - at call start |
| Survey | Yes (questions only) | Procedural feedback | Yes - survey disclaimer |
| Secret Shopper | Yes (QA evaluation) | Internal QA only | Yes - QA disclosure |
| Evidence Manifest | No | Notary | No |
| Scoring | No | Analysis | No |

---

## 6. Disclosure Templates

### 6.1 Recording Disclosure

```
This call may be recorded for quality assurance and compliance purposes. 
By continuing, you consent to recording.
```

### 6.2 Survey Disclaimer

```
This is an automated customer satisfaction survey. 
Your responses will be recorded for quality improvement purposes. 
This survey does not constitute any agreement or commitment. 
You may end the call at any time.
```

### 6.3 Translation Disclosure

```
This call includes AI-powered real-time translation. 
Translation is provided to assist communication and may not capture every nuance. 
Please confirm understanding of important terms directly with the other party.
```

### 6.4 QA Evaluation Disclosure

```
This is an automated quality assurance evaluation call. 
This call is for internal evaluation purposes only and does not constitute 
any service agreement or commitment.
```

---

## 7. Implementation Status

### Phase 1 - COMPLETE (January 18, 2026)

- ✅ Recording disclosure added to LaML outbound route
- ✅ Survey disclaimer added to SWML builder
- ✅ Translation disclosure added to AI agent config
- ✅ QA Evaluation disclosure added to Secret Shopper
- ✅ Database migration for disclosure tracking

### Phase 2 - COMPLETE (January 18, 2026)

- ✅ Guided confirmation system (operator prompts)
- ✅ Real-time call guidance panel (ActiveCallPanel)
- ✅ ConfirmationPrompts component with checklist UI
- ✅ Confirmation definitions library (promptDefinitions.ts)
- ✅ Confirmations API (/api/calls/[id]/confirmations)
- ✅ Database migration for confirmation tracking

### Phase 3 - COMPLETE (January 27, 2026)

- ✅ Outcome declaration system (OutcomeDeclaration.tsx)
- ✅ AI-assisted summary with human confirmation
- ✅ Database migration for outcomes (call_outcomes, call_outcome_history, ai_summaries)
- ✅ Outcome types library (lib/outcome/outcomeTypes.ts)
- ✅ Outcome API (/api/calls/[id]/outcome)
- ✅ AI Summary API (/api/calls/[id]/summary)
- ✅ Integration with CallDetailView

### Phase 4 - COMPLETE (January 27, 2026)

- ✅ Secret Shopper repositioned as "AI Quality Evaluation"
- ✅ UI labels updated throughout the application
- ✅ Compliance restriction system (lib/compliance/complianceUtils.ts)
- ✅ Database migration for compliance tracking (20260127_ai_quality_evaluation.sql)
- ✅ Feature conflict detection (QA_NO_CONFIRMATIONS, QA_NO_OUTCOMES)
- ✅ Documentation updated (SECRET_SHOPPER_INFRASTRUCTURE.md)
- ✅ Compliance notice banner in ShopperScriptManager

### Phase 5 - COMPLETE (January 27, 2026)

- ✅ AI_ROLE_POLICY.md published and maintained
- ✅ All feature docs updated with AI Role references:
  - AI_SURVEY_BOT.md (v2.0.0 - AI Role Compliant)
  - BOOKING_SCHEDULING.md (v2.0.0 - AI Role Compliant)
  - TRANSLATION_AGENT_IMPLEMENTATION_PLAN.md (v2.0.0 - AI Role Compliant)
  - SECRET_SHOPPER_INFRASTRUCTURE.md (AI Quality Evaluation)
  - SYSTEM_OF_RECORD_COMPLIANCE.md (v2.0.0)
- ✅ Full compliance audit checklist validation (see Section 11)

---

## 8. Confirmation System (Phase 2)

### Purpose

The confirmation system guides operators on what questions to ask during calls.
The operator asks, the customer answers, the operator marks it captured.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ConfirmationPrompts.tsx` | `components/voice/` | UI for confirmation checklist |
| `promptDefinitions.ts` | `lib/confirmation/` | Template definitions |
| `confirmations/route.ts` | `app/api/calls/[id]/` | API for saving confirmations |
| `ActiveCallPanel.tsx` | `components/voice/` | Integration with call panel |

### Confirmation Types

| Type | When to Use |
|------|-------------|
| `disclosure_accepted` | Recording disclosure acknowledged |
| `recording_consent` | Explicit consent to record |
| `terms_agreed` | Terms and conditions accepted |
| `price_confirmed` | Pricing/amount verified |
| `scope_confirmed` | Scope of work agreed |
| `identity_verified` | Caller identity confirmed |
| `authorization_given` | Action authorized |
| `understanding_confirmed` | Comprehension verified |

### Key Principle

> **The operator asks the question. The customer answers. The operator marks it captured.**

AI never asks the confirmation question. AI only guides the operator.

---

## 9. Outcome Declaration System (Phase 3)

### Purpose

After a call ends, the operator declares what was agreed, declined, or left ambiguous.
AI may assist by generating a summary, but the human MUST verify and confirm.

### Core Principle

> **"The system records what happened. The human declares the meaning."**

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `OutcomeDeclaration.tsx` | `components/voice/` | UI for declaring outcomes |
| `outcomeTypes.ts` | `lib/outcome/` | Type definitions for outcomes |
| `outcome/route.ts` | `app/api/calls/[id]/` | API for saving outcomes |
| `summary/route.ts` | `app/api/calls/[id]/` | AI summary generation |
| `CallDetailView.tsx` | `components/voice/` | Integration point |

### Database Tables

| Table | Purpose |
|-------|---------|
| `call_outcomes` | Primary outcome storage |
| `call_outcome_history` | Audit trail for revisions |
| `ai_summaries` | AI-generated summaries (pending review) |

### Outcome Statuses

| Status | Description |
|--------|-------------|
| `agreed` | All terms accepted |
| `declined` | Customer declined |
| `partial` | Some terms agreed, some declined |
| `inconclusive` | No clear decision reached |
| `follow_up_required` | Needs additional conversation |
| `cancelled` | Call/interaction cancelled |

### AI Summary Workflow

1. **Human clicks "Generate AI Summary"**
2. **AI analyzes transcript and proposes summary**
3. **Summary is marked as `ai_generated` (pending review)**
4. **Human reviews, edits if needed**
5. **Human clicks "Declare Outcome"**
6. **Summary source changes to `ai_confirmed`**

### Key Safeguards

- AI summaries are NEVER auto-confirmed
- Human must click "Declare Outcome" to finalize
- All revisions tracked in history table
- `summary_source` field tracks origin (human/ai_generated/ai_confirmed)

---

## 10. AI Quality Evaluation System (Phase 4)

### Purpose

The AI Quality Evaluation feature (formerly "Secret Shopper") allows organizations to conduct
automated QA assessments. Per AI Role Policy, this feature has been repositioned to clarify
that it is for **internal QA purposes only** and cannot be used for customer agreements.

### Core Principle

> **AI evaluates service quality. AI never negotiates agreements.**

### Legal Positioning

| Aspect | Policy |
|--------|--------|
| Purpose | Internal QA evaluation only |
| Disclosure | Mandatory at call start |
| Agreements | Cannot capture confirmations/outcomes |
| Negotiation | AI never negotiates on behalf of parties |

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `shopperScriptBuilder.ts` | `lib/voice/` | Script generation with QA disclosure |
| `complianceUtils.ts` | `lib/compliance/` | Feature conflict detection |
| `ShopperScriptManager.tsx` | `components/voice/` | Script management UI |
| Migration | `migrations/2026-01-27-ai-quality-evaluation.sql` | Compliance tracking |

### Compliance Restrictions

| Code | Description | Action |
|------|-------------|--------|
| `QA_NO_CONFIRMATIONS` | QA calls cannot capture confirmations | Warn |
| `QA_NO_OUTCOMES` | QA calls cannot have outcome declarations | Warn |
| `QA_NO_AGREEMENTS` | QA calls cannot record agreements | Block |

### Mandatory Disclosure

```
"This is an automated quality assurance evaluation call. This call is for 
internal evaluation purposes only and does not constitute any service 
agreement or commitment."
```

---

## 11. Audit Checklist

Before any release, verify:

### Recording Disclosure
- [ ] All calls have disclosure before recording
- [ ] Disclosure timestamp captured in database
- [ ] Disclosure text is neutral, not persuasive

### Human Agency
- [ ] All commitments spoken by humans
- [ ] AI never negotiates
- [ ] Operator prompts for confirmations (not AI)

### Confirmation Capture
- [ ] Confirmations tagged with who (human/customer)
- [ ] Timestamps linked to recording
- [ ] Human declares outcome, not AI

### Outcome Declaration
- [ ] Outcomes declared by human operator
- [ ] AI summaries marked as requiring review
- [ ] Revision history maintained
- [ ] Read-back confirmation tracked

### Surveys
- [ ] Disclosed as automated survey
- [ ] Does not capture contractual commitments
- [ ] Responses are feedback, not agreements

### Translation
- [ ] Disclosed as AI-assisted
- [ ] Nuance disclaimer included
- [ ] Original language preserved

### AI Quality Evaluation (formerly Secret Shopper)
- [ ] Disclosed as AI evaluation
- [ ] Not used for agreement capture
- [ ] Clearly labeled as "AI Quality Evaluation" in UI
- [ ] Compliance restrictions enforced

---

## 12. Legal Positioning

### What This Makes Word Is Bond

- **Safer** than AI agents (AI never commits)
- **More trustworthy** than call analytics (human agency preserved)
- **More defensible** than voice biometrics (disclosure + consent)
- **More valuable** than recordings alone (evidence-grade)

### Court Questions We Can Answer

Courts don't ask: *"What did the AI say?"*

They ask: *"Who said it?"*

**Our answer:** The human said it. The system captured it correctly.

---

## 13. References

- [WORD_IS_BOND_AI_ROLE_IMPLEMENTATION_PLAN.md](../../WORD_IS_BOND_AI_ROLE_IMPLEMENTATION_PLAN.md) - Full implementation plan
- [FULL_SYSTEM_ARCHITECTURE.md](FULL_SYSTEM_ARCHITECTURE.md) - System architecture
- [SYSTEM_OF_RECORD_COMPLIANCE.md](SYSTEM_OF_RECORD_COMPLIANCE.md) - Evidence handling
- [SECRET_SHOPPER_INFRASTRUCTURE.md](../02-FEATURES/SECRET_SHOPPER_INFRASTRUCTURE.md) - AI Quality Evaluation details

---

*Document Version: 5.0.0*  
*Updated: January 27, 2026*  
*Status: COMPLETE - All 5 Phases Implemented*
