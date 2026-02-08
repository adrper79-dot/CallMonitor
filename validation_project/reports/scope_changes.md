# Compliance AI Features Scope Changes (Generic)

## Assessment vs ARCH_DOCS Standards
- **Fit**: Perfect - extends Bond AI co-pilot, compliance utils, Telnyx calls.
- **Standards**: snake_case tables/routes, Zod validation, RLS, Workers API, static UI.
- **Effort**: Low (leverage existing AI/voice/compliance).

## Required Changes

### 1. Database (Migration)
- `migrations/add_compliance.sql`:
  ```
  CREATE TABLE debt_compliance_scores (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    call_id UUID REFERENCES calls(id),
    compliance_risk_score NUMERIC(3,2),
    violation_flags JSONB,
    recommendations JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE debt_compliance_scores ENABLE ROW LEVEL SECURITY;
  CREATE POLICY debt_compliance_org ON debt_compliance_scores USING (organization_id = current_setting('app.current_organization_id')::uuid);
  ```

### 2. Workers API
- `workers/src/routes/compliance.ts`:
  - POST /compliance/analyze (call_sid → risk score, flags, recommendations via OpenAI/rules)
  - GET /compliance/dnc-list (org DNC management)

### 3. UI Components
- `components/voice/CompliancePanel.tsx`: Real-time compliance risk score/flags, recommendations in ActiveCallPanel.

### 4. RBAC
- Seed 'compliance.view', 'compliance.manage' in rbac_permissions.

### 5. Vertical Page
- `app/verticals/debt-collection/page.tsx`: Copy legal, add FDCPA positioning.

### 6. Docs/ROADMAP
- Add to ROADMAP polish: "Debt Collection Vertical + Compliance AI".
- Update types/tier1-features.ts: add debt_compliance.

## AI Role
AI assists human compliance officer:
- Generates risk score/flags from transcript/rules for human review
- Human confirms/overrides/disputes scores
- Audit trail of AI suggestions + human actions
- Not authoritative - human final decision

## Metrics & Measurement
- **Risk Score**: 0.00-1.00 from OpenAI analysis of transcript (keywords: harassment, disclosure missing, threats)
- **Violation Flags**: JSONB array ['no_disclosure', 'call_frequency', 'dnc_hit']
- **DNC Hit Rate**: % calls to opted-out numbers
- **System Knows**: Transcript from AssemblyAI + rules engine (call duration, frequency per number, DNC lookup via KV/DB)

**Timeline**: 1 sprint (Week 1 schema/API, Week 2 UI/docs).
**Risk**: Low - builds on Bond AI/transcripts.
