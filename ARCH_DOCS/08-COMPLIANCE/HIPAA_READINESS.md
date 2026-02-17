# HIPAA Readiness Assessment

**Health Insurance Portability and Accountability Act (45 CFR Parts 160, 162, 164)**  
**Priority:** P1 — Conditional (Required for Medical/Dental Vertical)  
**Status:** Partially Ready  
**Last Review:** February 16, 2026

---

## 1. Applicability

HIPAA applies to Word Is Bond **only when** used to collect patient debts that involve Protected Health Information (PHI):

- Medical/dental practice patient balances
- Hospital billing collections
- Insurance-related debt communications
- Any scenario where diagnosis codes, treatment details, or insurance information are stored/transmitted

**Decision Point:** Does Word Is Bond target the medical/dental collections vertical?

- **YES** → Must achieve HIPAA compliance (estimated 2–3 weeks build + $5K–10K audit)
- **NO** → Document exemption, exclude medical clients, focus on general collections

**Risk Level:** CRITICAL if applicable — Violations carry $100–$50,000 per record + breach notification costs.

---

## 2. HIPAA Requirements & Current Platform State

### 2.1 Administrative Safeguards

| Requirement | Platform State | Status |
|---|---|---|
| Security Officer designation | Not formally designated | **GAP** |
| Privacy Officer designation | Not formally designated | **GAP** |
| Workforce training program | No training documentation | **GAP** |
| Business Associate Agreements (BAA) | No BAA template created | **GAP** |
| Risk assessment (annual) | Risk Register exists (`ARCH_DOCS/07-GOVERNANCE/RISK_REGISTER.md`) but not HIPAA-specific | **PARTIAL** |
| Incident response procedures | 5-step playbook in `SECURITY_HARDENING.md` | **PARTIAL** |
| Sanction policy for violations | Not documented | **GAP** |

### 2.2 Physical Safeguards

| Requirement | Platform State | Status |
|---|---|---|
| Workstation security | N/A — Cloud-native SaaS (Cloudflare Workers + Neon) | **N/A** |
| Facility access controls | Cloud provider responsibility (Cloudflare, AWS/Neon) | **DELEGATED** |
| Device/media disposal | No end-user devices store PHI directly | **N/A** |

### 2.3 Technical Safeguards

| Requirement | Platform State | Status |
|---|---|---|
| Access controls (unique user IDs) | UUID-based users with RBAC (6 roles) | **IMPLEMENTED** |
| Audit controls (access logging) | `writeAuditLog()` on all actions, 7-year retention | **IMPLEMENTED** |
| Integrity controls | Database constraints, RLS policies | **IMPLEMENTED** |
| Transmission security (encryption in transit) | HTTPS enforced via Cloudflare, TLS on all API calls | **IMPLEMENTED** |
| Encryption at rest | Neon PostgreSQL transparent encryption | **IMPLEMENTED** |
| Emergency access procedures | Not documented | **GAP** |
| Automatic logoff | Session expiration configured | **IMPLEMENTED** |
| PHI field-level encryption | Not implemented (application-level) | **GAP** |
| PHI access logging (dedicated) | No `phi_access_log` table | **GAP** |

### 2.4 Breach Notification Rule

| Requirement | Platform State | Status |
|---|---|---|
| Breach risk assessment procedures | Not documented | **GAP** |
| 60-day individual notification | Not documented | **GAP** |
| HHS notification (>500 individuals) | Not documented | **GAP** |
| Media notification (>500 in a state) | Not documented | **GAP** |
| Breach log maintenance | Not implemented | **GAP** |

### 2.5 Privacy Rule

| Requirement | Platform State | Status |
|---|---|---|
| Minimum necessary standard | RBAC limits access by role | **PARTIAL** |
| Patient rights (access, amendment, accounting) | Not implemented | **GAP** |
| Notice of Privacy Practices (NPP) | Not created | **GAP** |
| Authorization requirements | Not implemented | **GAP** |

---

## 3. What's Already in Place

The platform has strong **technical foundations** that support HIPAA:

- **Multi-tenant isolation** via RLS policies — prevents cross-org data leakage
- **Audit logging** with 7-year retention — provides accountability trail
- **Encryption in transit** (HTTPS/TLS) — protects PHI during transmission
- **Encryption at rest** (Neon database) — protects stored data
- **Role-based access control** (6 roles) — enforces least-privilege
- **PII/PHI redaction pipeline** documented in `SECURITY_HARDENING.md`
- **Session management** with expiration — prevents unauthorized access
- **Incident response playbook** (5-step) — partial breach response

---

## 4. Implementation Roadmap (If Medical Vertical Pursued)

### Phase 1: Documentation (Week 1)
- [ ] Designate Security Officer and Privacy Officer
- [ ] Create BAA template (for medical clients)
- [ ] Document breach notification procedures
- [ ] Create workforce training materials
- [ ] Conduct HIPAA-specific risk assessment
- [ ] Document emergency access procedures
- [ ] Create Notice of Privacy Practices

### Phase 2: Technical Controls (Week 2–3)
- [ ] Add `phi_access_log` table for PHI-specific access audit
- [ ] Implement PHI field-level encryption (diagnosis codes, insurance info)
- [ ] Add PHI role restrictions (`canAccessPHI()` guard)
- [ ] Create PHI data export endpoint (patient rights)
- [ ] Create PHI data deletion endpoint (patient rights)
- [ ] Build breach log table and management UI

### Phase 3: Training & BAAs (Week 3–4)
- [ ] Develop annual training curriculum
- [ ] Create training acknowledgment tracking
- [ ] Deploy BAA signing workflow
- [ ] Track BAA expirations

---

## 5. Database Schema (If Implementing)

```sql
-- PHI access audit log
CREATE TABLE phi_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id UUID REFERENCES accounts(id),
  action TEXT NOT NULL, -- 'view', 'edit', 'export', 'delete'
  phi_fields_accessed TEXT[],
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_phi_access_log_org ON phi_access_log(organization_id, created_at DESC);
CREATE INDEX idx_phi_access_log_user ON phi_access_log(user_id, created_at DESC);

-- Breach log
CREATE TABLE breach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  discovered_at TIMESTAMPTZ NOT NULL,
  reported_at TIMESTAMPTZ,
  individuals_affected INTEGER,
  phi_types_involved TEXT[],
  description TEXT,
  remediation_steps TEXT,
  hhs_notified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'investigating', -- investigating, contained, resolved
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Cost Estimate

| Item | Estimated Cost |
|---|---|
| Technical implementation (internal) | $0 (engineering time) |
| BAA legal review | $1,000–$2,000 |
| HIPAA compliance assessment (external) | $3,000–$5,000 |
| Annual training program | $500–$1,000 |
| **Total initial investment** | **$5,000–$10,000** |

---

## 7. References

- [45 CFR Parts 160, 162, 164](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C)
- [HHS HIPAA Guidance](https://www.hhs.gov/hipaa/index.html)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [Breach Notification Rule](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html)
