# SOC 2 Type II Controls Mapping

**AICPA Trust Services Criteria (TSC)**  
**Priority:** P2 — Enterprise Sales  
**Status:** Tracking Started  
**Target:** Month 6–12  
**Last Review:** February 16, 2026

---

## 1. Applicability

SOC 2 Type II certification is required for enterprise sales (50+ seats). It demonstrates that Word Is Bond maintains effective controls over security, availability, processing integrity, confidentiality, and privacy over a sustained observation period (typically 3–6 months).

**Timeline:** 3–6 months with auditor  
**Estimated Cost:** $15,000–$25,000 for initial audit  
**Required for:** Enterprise sales, government contracts, large agency partnerships

---

## 2. Trust Service Criteria — Control Mapping

### 2.1 Security (Common Criteria — CC)

| Control ID | Requirement | Platform Implementation | Status |
|---|---|---|---|
| CC1.1 | Security commitment and policies | `ARCH_DOCS/03-INFRASTRUCTURE/SECURITY_HARDENING.md` | **PARTIAL** (implementation guide, not formal policy) |
| CC2.1 | Risk assessment | `ARCH_DOCS/07-GOVERNANCE/RISK_REGISTER.md` (RAID log) | **PARTIAL** (not formalized as annual risk assessment) |
| CC3.1 | Logical access controls | RBAC with 6 roles, `requireAuth()` + `requireRole()` middleware | **IMPLEMENTED** |
| CC3.2 | Authentication mechanisms | Session-based auth, CSRF protection, PBKDF2 password hashing | **IMPLEMENTED** |
| CC3.3 | Access review procedures | Not documented as periodic process | **GAP** |
| CC4.1 | Change management | `ARCH_DOCS/07-GOVERNANCE/CHANGE_MANAGEMENT.md`, CI/CD pipeline | **IMPLEMENTED** |
| CC5.1 | Vendor risk assessment | `ARCH_DOCS/06-REFERENCE/VENDOR_DOCUMENTATION.md` exists | **PARTIAL** |
| CC6.1 | System monitoring & alerting | Health checks, `ARCH_DOCS/03-INFRASTRUCTURE/MONITORING.md` | **IMPLEMENTED** |
| CC6.2 | Incident detection & response | 5-step playbook in `SECURITY_HARDENING.md` | **PARTIAL** (needs formal IRP document) |
| CC7.1 | Vulnerability management | Not documented as process | **GAP** |
| CC7.2 | Penetration testing | Not conducted | **GAP** |
| CC8.1 | Employee onboarding/offboarding | Not documented | **GAP** |

### 2.2 Availability (A)

| Control ID | Requirement | Platform Implementation | Status |
|---|---|---|---|
| A1.1 | Uptime monitoring | Health check endpoint, Cloudflare analytics | **IMPLEMENTED** |
| A1.2 | Disaster recovery plan | Not documented | **GAP** |
| A1.3 | Backup procedures | Neon point-in-time recovery, R2 object versioning | **IMPLEMENTED** (not documented) |
| A1.4 | Capacity planning | Cloudflare Workers auto-scaling, Neon auto-scaling | **IMPLEMENTED** |
| A1.5 | Uptime SLA | Not formally defined | **GAP** |

### 2.3 Processing Integrity (PI)

| Control ID | Requirement | Platform Implementation | Status |
|---|---|---|---|
| PI1.1 | Data validation controls | Zod schemas on all API inputs (`workers/src/lib/schemas.ts`) | **IMPLEMENTED** |
| PI1.2 | Error handling procedures | Try/catch patterns, error responses, audit logging | **IMPLEMENTED** |
| PI1.3 | Idempotency controls | `workers/src/lib/idempotency.ts` middleware | **IMPLEMENTED** |
| PI1.4 | Data reconciliation | Payment reconciliation routes exist | **IMPLEMENTED** |

### 2.4 Confidentiality (C)

| Control ID | Requirement | Platform Implementation | Status |
|---|---|---|---|
| C1.1 | Data classification policy | `ARCH_DOCS/01-CORE/DATA_FLOW_LIFECYCLE.md` (retention tiers) | **PARTIAL** |
| C1.2 | Encryption standards | TLS in transit, Neon encryption at rest, AES-256-GCM for CRM tokens | **IMPLEMENTED** |
| C1.3 | Multi-tenant data isolation | RLS policies, `organization_id` in all queries | **IMPLEMENTED** |
| C1.4 | Secure data disposal | Not documented as process | **GAP** |
| C1.5 | Key management | CRM_ENCRYPTION_KEY for KV, Stripe secret keys in Workers secrets | **IMPLEMENTED** |

### 2.5 Privacy (P)

| Control ID | Requirement | Platform Implementation | Status |
|---|---|---|---|
| P1.1 | Privacy policy published | `app/privacy/page.tsx` (public-facing privacy page) | **IMPLEMENTED** |
| P1.2 | Data retention policy | Tiers in `DATA_FLOW_LIFECYCLE.md`, legal holds in `retention.ts` | **PARTIAL** |
| P1.3 | Consent management | `consent_status` on accounts, pre-dial consent check | **PARTIAL** |
| P1.4 | Data deletion procedures | Not implemented as self-service | **GAP** |
| P1.5 | Data export/portability | Not implemented | **GAP** |

---

## 3. Current Readiness Score

| Category | Controls Mapped | Implemented | Partial | Gap |
|---|---|---|---|---|
| Security (CC) | 12 | 5 | 4 | 3 |
| Availability (A) | 5 | 2 | 0 | 3 |
| Processing Integrity (PI) | 4 | 4 | 0 | 0 |
| Confidentiality (C) | 5 | 3 | 1 | 1 |
| Privacy (P) | 5 | 1 | 2 | 2 |
| **Total** | **31** | **15 (48%)** | **7 (23%)** | **9 (29%)** |

---

## 4. SOC 2 Preparation Roadmap

### Month 1–2: Documentation Phase
- [ ] Write formal Information Security Policy
- [ ] Write Incident Response Plan (consolidate from 3 files into 1)
- [ ] Write Disaster Recovery & Business Continuity Plan
- [ ] Document access review procedures (quarterly cadence)
- [ ] Document vulnerability management process
- [ ] Document employee onboarding/offboarding procedures
- [ ] Define uptime SLA (target: 99.9%)
- [ ] Create data classification and disposal policy
- [ ] Document backup procedures formally

### Month 3–4: Implementation Phase
- [ ] Conduct initial vulnerability scan
- [ ] Implement quarterly access reviews
- [ ] Build data export endpoint for users
- [ ] Build data deletion endpoint for users
- [ ] Schedule first penetration test
- [ ] Implement vendor risk assessment checklist

### Month 5–6: Audit Phase
- [ ] Engage SOC 2 auditor
- [ ] Begin 3-month observation period
- [ ] Collect evidence for all controls
- [ ] Address any auditor findings
- [ ] Receive SOC 2 Type II report

---

## 5. Cost Estimate

| Item | Estimated Cost |
|---|---|
| Policy documentation (internal) | $0 |
| Vulnerability scanning tools | $1,000–$3,000/year |
| Penetration testing | $3,000–$8,000 |
| SOC 2 Type II audit | $15,000–$25,000 |
| Audit management platform (e.g., Vanta, Drata) | $5,000–$15,000/year |
| **Total Year 1** | **$24,000–$51,000** |

---

## 6. References

- [AICPA Trust Services Criteria](https://www.aicpa.org/resources/landing/system-and-organization-controls-soc-suite-of-services)
- [SOC 2 Overview](https://www.aicpa.org/topic/audit-assurance/audit-and-assurance-greater-than-soc-2)
