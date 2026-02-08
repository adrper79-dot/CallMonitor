# Debt Collection Niche Plan (Agentic)

## Industry Pains (Deep Research)
1. **Compliance Violations**: FDCPA/TCPA lawsuits $10M+ settlements (CFPB 2024-26), manual tracking.
2. **Legacy Software**: On-premise COLLECT!/C&R, no real-time AI.
3. **SMB Adoption**: 10-100 agents low tech, $1-10M rev, compliance fines trigger switch.
4. **Agent Efficiency**: Escalations, objection handling manual.

## Improvements Plan
**Add**:
- CompliancePanel (real-time risk score).
- DNC UI/route.
- Debt scripts (SurveyBuilder).
- ROI calculator (analytics).

**Remove**: Unused responsive dup (fixed).

**Leave**: Core voice/Bond AI (extend).

## Agentic Rollout
ORCHESTRATOR
  ↓
Research Agent → UI Agent → Workflow Agent → Features Agent → Psych Agent → Test Agent
  ↓
SYNTHESIS

### 1. Research Agent
- Confirm pains (update data/*.json).

### 2. UI Agent
- Add CompliancePanel.tsx (shadcn, Tailwind responsive).
- Debt vertical page.tsx.

### 3. Workflow Agent
- Pre-call DNC check (VoiceConfig).
- Post-call score (Bond AI).

### 4. Features Agent
- DNC table/migration (lib/compliance/dnc.ts).
- Debt scripts SurveyBuilder templates.
- ROI widget dashboard (extend analytics).
Hook complianceUtils.ts extend checkCompliance debt rules.

### 5. Psych Agent
- Trust badges (evidence).
- ROI calc psychology.

### 6. Test Agent
- Vitest UI/workflow.
- E2E Playwright.

**Standards**: ARCH_DOCS snake_case/Zod/RLS/shadcn. Hook existing complianceUtils/SurveyBuilder/Bond AI.

Approve to ACT.