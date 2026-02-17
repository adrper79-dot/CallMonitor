# CCPA / CPRA Compliance Assessment

**California Consumer Privacy Act (as amended by CPRA)**  
**Priority:** P3 — California Expansion  
**Status:** Assessment Complete  
**Applicability:** Likely Exempt (current scale)  
**Last Review:** February 16, 2026

---

## 1. Applicability Thresholds

CCPA/CPRA applies to for-profit businesses that collect California residents' personal information AND meet **any one** of these thresholds:

| Threshold | Word Is Bond Status | Met? |
|---|---|---|
| Annual gross revenue > $25 million | Not at this stage | **NO** |
| Buy/sell/share personal info of 100,000+ consumers/households annually | Platform processes debtor accounts, not 100K consumers directly | **NO** |
| Derive 50%+ of annual revenue from selling/sharing personal information | Revenue from SaaS subscriptions, not data sales | **NO** |

**Current Status:** LIKELY EXEMPT  
**Reason:** Below all three thresholds at current scale  
**Monitoring Trigger:** Approaching $25M ARR, or any single customer brings 50K+ California debtor accounts

---

## 2. Service Provider Classification

Even if Word Is Bond itself is exempt, California-based **customers** (collections agencies) may be subject to CCPA/CPRA and require their service providers to comply.

**Word Is Bond's Role:** Service Provider / Processor  
**Implication:** Must be prepared to honor customer requests for CCPA compliance even if not directly subject

### Service Provider Agreement Requirements

| Clause | Status |
|---|---|
| Prohibit selling/sharing of consumer data | Platform does not sell data — **IMPLEMENTED** (by design) |
| Process data only per customer instructions | Multi-tenant isolation ensures this — **IMPLEMENTED** |
| Implement reasonable security measures | TLS, RLS, encryption, RBAC — **IMPLEMENTED** |
| Assist controller with consumer rights requests | No formal process documented — **GAP** |
| Delete consumer data on customer request | No deletion API — **GAP** |
| Provide CCPA addendum to customer agreements | No template exists — **GAP** |

---

## 3. Consumer Rights (If Applicable)

| Right | Requirement | Platform Status |
|---|---|---|
| Right to Know | Disclose data collected, sources, purposes, third parties | Privacy page exists, no per-consumer data report | **PARTIAL** |
| Right to Delete | Delete personal information on request | No deletion workflow | **GAP** |
| Right to Opt-Out of Sale/Sharing | "Do Not Sell My Personal Information" | Not applicable — platform does not sell data | **N/A** |
| Right to Correct | Correct inaccurate data | Account editing exists | **IMPLEMENTED** |
| Right to Limit Use of Sensitive PI | Restrict use of sensitive categories | Not applicable — no sensitive PI categories per CCPA definition | **N/A** |
| Right to Non-Discrimination | Cannot discriminate for exercising rights | By design — no discrimination logic | **IMPLEMENTED** |

---

## 4. Data Categories Processed

| Category | Examples | Sensitive? |
|---|---|---|
| Identifiers | Name, phone, email, account number | No |
| Financial Information | Debt balance, payment history | No (not bank/credit card numbers) |
| Commercial Information | Transaction records, payment plans | No |
| Internet/Network Activity | Login timestamps, API calls (audit log) | No |
| Audio/Visual | Call recordings | No |
| Professional/Employment | Agent performance data | No |

**Note:** Word Is Bond does NOT process CCPA "sensitive personal information" categories (SSN, driver's license, biometric data, precise geolocation, racial/ethnic origin, health data, sexual orientation, union membership).

---

## 5. Current Compliance Posture

### Already Compliant By Design
- **No data selling or sharing** — Revenue model is SaaS subscriptions
- **Multi-tenant isolation** — Each customer's data is completely separated
- **Reasonable security** — TLS, AES-256-GCM encryption, RBAC, audit logging, RLS
- **Data minimization** — Only business-necessary data collected
- **Non-discrimination** — No discrimination for rights exercise

### Gaps (Service Provider Obligations)
- No consumer data deletion API
- No consumer data export API
- No CCPA service provider addendum template
- No documented process for handling customer-forwarded consumer rights requests

---

## 6. Implementation Roadmap (If Triggered)

### Phase 1: Service Provider Readiness (2–3 weeks)
- [ ] Create CCPA Service Provider Addendum template
- [ ] Document process for handling consumer rights requests from customers
- [ ] Implement data deletion API (`DELETE /api/accounts/:id/ccpa-delete`)
- [ ] Implement data export API (`GET /api/accounts/:id/ccpa-export`)

### Phase 2: Direct Compliance (If thresholds met) (4–6 weeks)
- [ ] Add "Do Not Sell" link to website (even if N/A, signals compliance)
- [ ] Create consumer rights request intake form
- [ ] Implement identity verification for consumer requests
- [ ] Create CCPA compliance dashboard for customer admins
- [ ] Train support staff on CCPA request handling

### Phase 3: CPRA Enhancements (2–4 weeks)
- [ ] Implement data retention auto-deletion cron
- [ ] Create annual risk assessment for consumer PI
- [ ] Document purpose limitation for each data category
- [ ] Implement audit logging for all CCPA request processing

---

## 7. Monitoring Triggers

Check these thresholds quarterly to determine when CCPA compliance becomes mandatory:

| Metric | Threshold | Current | Check Frequency |
|---|---|---|---|
| Annual Revenue | $25M | Well below | Quarterly |
| California Consumer Records | 100,000 | Below | Quarterly |
| Revenue from Data Sales | 50% | 0% (SaaS model) | Annual |
| California Customer Requests | Any CCPA request received | None | Ongoing |

---

## 8. Cost Estimate (If Triggered)

| Item | Estimated Cost |
|---|---|
| Legal review + SP addendum drafting | $2,000–$5,000 |
| Data deletion/export API development | Internal |
| Annual compliance review | $1,000–$3,000 |
| **Total Year 1** | **$3,000–$8,000** |

---

## 9. References

- [CCPA Full Text (Cal. Civ. Code §§ 1798.100–199.100)](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5)
- [CPRA Amendments](https://cppa.ca.gov/)
- [CCPA Regulations (Title 11, Division 6)](https://cppa.ca.gov/regulations/)
- [AG Guidance on Service Provider Obligations](https://oag.ca.gov/privacy/ccpa)
