# TCPA Compliance Standard

**Telephone Consumer Protection Act (47 U.S.C. § 227)**  
**FCC Implementing Rules (47 CFR Part 64.1200)**  
**Priority:** P0 — Critical  
**Status:** Substantially Compliant  
**Last Review:** February 16, 2026

---

## 1. Applicability

The TCPA applies to Word Is Bond as a platform that enables:

- Outbound voice calls (manual and power-dialed)
- Outbound SMS/text messages
- Automated voice messaging (IVR)
- Campaign-driven multi-channel contact

**Risk Level:** HIGH — Violations carry $500 per call/text ($1,500 if willful). Class actions common.

---

## 2. TCPA Requirements & Platform Controls

### 2.1 Consent Requirements

**Requirement:** Prior express consent required for non-telemarketing calls; prior express written consent required for telemarketing/advertising calls or texts using an ATDS.

| Control | Implementation | File | Status |
|---|---|---|---|
| Consent status on accounts | `collection_accounts.consent_status` column | Migrations | **IMPLEMENTED** |
| Pre-dial consent check | Blocks if `consent_status = 'revoked'` | `workers/src/lib/compliance-checker.ts` (L100–105) | **IMPLEMENTED** |
| SMS consent check | `sms_consent` field verified before send | `workers/src/lib/compliance.ts` | **IMPLEMENTED** |
| Per-call consent logging | `calls.consent_method` column updated | `workers/src/lib/compliance-checker.ts` (L416–467) | **IMPLEMENTED** |
| Compliance events | Consent events logged to `compliance_events` | `workers/src/lib/compliance-checker.ts` | **IMPLEMENTED** |
| UI display | `PreDialChecker.tsx` shows TCPA consent status | `components/cockpit/PreDialChecker.tsx` (L317–321) | **IMPLEMENTED** |
| Compliance guide rule | `tcpa-consent` rule defined | `workers/src/lib/compliance-guides.ts` (L58–68) | **IMPLEMENTED** |

**Gap:** No dedicated `consent_records` table for consent history/evidence. Consent is tracked as a flag (`consent_status`) rather than a full audit trail with proof storage. No explicit consent revocation API endpoint.

### 2.2 Time-of-Day Restrictions

**Requirement:** No calls before 8:00 AM or after 9:00 PM recipient's local time.

| Control | Implementation | File | Status |
|---|---|---|---|
| Timezone-aware time check | Pre-dial engine calculates debtor local time | `workers/src/lib/compliance-checker.ts` | **IMPLEMENTED** |
| Configurable calling hours | Organization-level settings (default 8am–9pm) | Onboarding compliance setup | **IMPLEMENTED** |
| Dialer enforcement | Power dialer respects time windows | `workers/src/lib/dialer-engine.ts` | **IMPLEMENTED** |
| Compliance event on violation | Logged if out-of-hours attempt detected | `compliance_events` table | **IMPLEMENTED** |

### 2.3 Do Not Call (DNC) Lists

**Requirement:** Maintain internal DNC list. Honor National DNC Registry. Remove within 30 days of request.

| Control | Implementation | File | Status |
|---|---|---|---|
| Internal DNC list | CRUD via `/api/compliance/dnc` | `workers/src/routes/compliance.ts` | **IMPLEMENTED** |
| Pre-dial DNC check | Blocks call if phone on DNC list | `workers/src/lib/compliance-checker.ts` | **IMPLEMENTED** |
| National DNC integration | External registry check capability | Compliance config | **IMPLEMENTED** |
| Campaign sequence DNC exclusion | DNC accounts excluded from sequences | `workers/src/lib/sequence-executor.ts` | **IMPLEMENTED** |

### 2.4 Caller ID / ANI Requirements

**Requirement:** Must transmit valid caller ID. Cannot spoof or block caller ID for debt collection calls.

| Control | Implementation | File | Status |
|---|---|---|---|
| Telnyx number provisioning | Dedicated provisioned numbers with valid CNAM | `workers/src/routes/onboarding.ts` | **IMPLEMENTED** |
| Call origination with caller ID | Telnyx API transmits provisioned number | `workers/src/lib/dialer-engine.ts` | **IMPLEMENTED** |

### 2.5 Opt-Out Mechanisms

**Requirement:** Must provide opt-out mechanism for marketing texts. Must honor opt-out immediately.

| Control | Implementation | File | Status |
|---|---|---|---|
| SMS opt-out (STOP keyword) | Telnyx handles STOP/START at carrier level | Telnyx platform | **IMPLEMENTED** |
| Consent revocation flag | `consent_status = 'revoked'` blocks further contact | `workers/src/lib/compliance-checker.ts` | **IMPLEMENTED** |

---

## 3. Platform Classification

Word Is Bond does **NOT** operate as an Automatic Telephone Dialing System (ATDS) under current FCC interpretation:

- Power dialer requires agent presence and manual initiation
- No random or sequential number generation
- Calls are placed from pre-existing contact lists with prior business relationship

This classification means most calls require only **prior express consent** (not written consent), reducing compliance burden. If predictive/progressive dialing without agent presence is added in the future, ATDS classification would need reassessment.

---

## 4. Compliance Audit Checklist

Run quarterly:

- [ ] Consent status verified for every contacted account
- [ ] Consent revocation requests honored within 24 hours
- [ ] All calls fall within 8am–9pm recipient local time
- [ ] Internal DNC list maintained and checked pre-dial
- [ ] National DNC Registry checked (if applicable)
- [ ] Valid caller ID transmitted on all outbound calls
- [ ] SMS opt-out (STOP) honored immediately
- [ ] Compliance events logged with timestamps for all checks
- [ ] No calls to numbers on DNC list (verify via audit query)

---

## 5. Remaining Actions

| # | Action | Priority | Effort | Status |
|---|---|---|---|---|
| 1 | Create `consent_records` table for evidence storage | P1 | 4 hours | Not Started |
| 2 | Build consent revocation API endpoint | P1 | 2 hours | Not Started |
| 3 | Add consent history timeline query | P2 | 2 hours | Not Started |
| 4 | Document ATDS classification rationale | P2 | 1 hour | Not Started |

---

## 6. References

- [47 U.S.C. § 227](https://www.law.cornell.edu/uscode/text/47/227)
- [47 CFR Part 64.1200](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L)
- [FCC TCPA Rules](https://www.fcc.gov/general/telemarketing-and-robocalls)
