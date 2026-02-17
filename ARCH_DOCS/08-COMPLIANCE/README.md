# Regulatory Compliance Standards Library

**TOGAF Phase:** B/G (Business Architecture / Implementation Governance)  
**Status:** Baseline — February 16, 2026  
**Applicability:** Word Is Bond v4.68+

---

## Purpose

This directory contains the canonical compliance documentation for all regulatory frameworks applicable to the Word Is Bond platform. Each document defines:

1. **Standard scope** — What the regulation covers and when it applies
2. **Implementation status** — What the platform implements today
3. **Control mapping** — How platform features satisfy each requirement
4. **Gap analysis** — What remains to be built or formalized
5. **Audit procedures** — How to verify ongoing compliance

---

## Document Index

| # | Standard | File | Priority | Status |
|---|---|---|---|---|
| 1 | FDCPA | [FDCPA_COMPLIANCE.md](FDCPA_COMPLIANCE.md) | P0 — Critical | Substantially Compliant |
| 2 | TCPA | [TCPA_COMPLIANCE.md](TCPA_COMPLIANCE.md) | P0 — Critical | Substantially Compliant |
| 3 | PCI DSS | [PCI_DSS_COMPLIANCE.md](PCI_DSS_COMPLIANCE.md) | P0 — Critical | Compliant (SAQ A) |
| 4 | HIPAA | [HIPAA_READINESS.md](HIPAA_READINESS.md) | P1 — Conditional | Partial (Medical Vertical) |
| 5 | SOC 2 Type II | [SOC2_CONTROLS.md](SOC2_CONTROLS.md) | P2 — Enterprise | Tracking Started |
| 6 | GDPR | [GDPR_COMPLIANCE.md](GDPR_COMPLIANCE.md) | P3 — Conditional | Partial |
| 7 | CCPA | [CCPA_COMPLIANCE.md](CCPA_COMPLIANCE.md) | P3 — Conditional | Likely Exempt |

---

## Compliance Priority Matrix

```
P0 — FDCPA + TCPA + PCI DSS  → Must be compliant NOW (collections + voice)
P1 — HIPAA                    → Required IF targeting medical/dental vertical
P2 — SOC 2 Type II            → Required for enterprise sales (Month 6+)
P3 — GDPR + CCPA              → Required IF international/California expansion
```

---

## Cross-Reference: Code Implementation

| Concern | Implementation File | Tests |
|---|---|---|
| Pre-dial compliance engine | `workers/src/lib/compliance-checker.ts` | `tests/production/compliance.test.ts` |
| Compliance rules library | `workers/src/lib/compliance-guides.ts` | Inline assertions |
| SMS/call consent gating | `workers/src/lib/compliance.ts` | Integration tests |
| DNC list management | `workers/src/routes/compliance.ts` | API tests |
| Legal hold enforcement | `workers/src/routes/retention.ts` | E2E tests |
| Recording pause (PCI) | `workers/src/lib/ivr-flow-engine.ts` | Load tests |
| Mini-Miranda auto-play | `workers/src/routes/webhooks.ts` | Webhook tests |
| Disclosure logging | `workers/src/lib/compliance-checker.ts` | Compliance tests |
| Cease & desist blocking | `workers/src/lib/compliance-checker.ts` | Pre-dial tests |
| Sequence C&D exclusion | `workers/src/lib/sequence-executor.ts` | Sequence tests |
| Data retention/legal holds | `workers/src/routes/retention.ts` | Retention tests |
| Audit log (7-year) | `workers/src/lib/audit.ts` | Audit tests |
| RLS multi-tenant isolation | Database RLS policies | Security tests |
| PII/PHI redaction | `ARCH_DOCS/03-INFRASTRUCTURE/SECURITY_HARDENING.md` | — |

---

## Governance

- **Owner:** Compliance Officer / Platform Owner
- **Review cadence:** Quarterly (or on regulatory change)
- **Authority:** These documents are the canonical compliance reference. All code implementations must trace back to controls defined here.
- **Change control:** Updates require review via `ARCH_DOCS/07-GOVERNANCE/CHANGE_MANAGEMENT.md`
