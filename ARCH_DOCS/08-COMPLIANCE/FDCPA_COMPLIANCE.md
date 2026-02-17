# FDCPA Compliance Standard

**Fair Debt Collection Practices Act (15 U.S.C. §§ 1692–1692p)**  
**Regulation F (12 CFR Part 1006)**  
**Priority:** P0 — Critical  
**Status:** Substantially Compliant  
**Last Review:** February 16, 2026

---

## 1. Applicability

The FDCPA applies to Word Is Bond when used by **third-party debt collectors** collecting consumer debts. This includes:

- Collection agencies using the platform
- Law firms collecting on behalf of creditors
- Debt buyers collecting purchased debts
- **Excludes:** Original creditors collecting their own debts (though many states apply similar rules)

**Risk Level:** HIGH — Violations carry $500–$1,500 per incident + class action exposure + CFPB enforcement.

---

## 2. FDCPA Requirements & Platform Controls

### 2.1 Mini-Miranda Disclosure (§1692e(11))

**Requirement:** Collector must disclose identity and debt collection purpose within the first communication.

| Control | Implementation | File | Status |
|---|---|---|---|
| Auto-play disclosure on outbound calls | Telnyx TTS plays mini-Miranda on call answer | `workers/src/routes/webhooks.ts` (L1309–1348) | **IMPLEMENTED** |
| Disclosure event logging | `logDisclosureEvent()` writes to `compliance_events` + `disclosure_logs` | `workers/src/lib/compliance-checker.ts` (L342–410) | **IMPLEMENTED** |
| Call record columns | `disclosure_given`, `disclosure_type`, `disclosure_timestamp` on `calls` table | `workers/src/lib/compliance-checker.ts` (L395–410) | **IMPLEMENTED** |
| Compliance guide rule | `fdcpa-mini-miranda` rule defined | `workers/src/lib/compliance-guides.ts` (L19–31) | **IMPLEMENTED** |
| Audit report | Query `compliance_events WHERE event_type = 'mini_miranda'` | `workers/src/routes/compliance.ts` | **IMPLEMENTED** |

**Gap:** Cockpit UI hardcodes `mini_miranda: true` instead of reading actual per-call status from API. Non-blocking but should be corrected.

### 2.2 Calling Restrictions (§1692c)

**Requirement:** Cannot call at inconvenient times (before 8am or after 9pm debtor local time). Regulation F limits to 7 calls per account per 7-day period.

| Control | Implementation | File | Status |
|---|---|---|---|
| Time-of-day check (8am–9pm local) | Pre-dial engine checks debtor timezone | `workers/src/lib/compliance-checker.ts` | **IMPLEMENTED** |
| 7-in-7 frequency cap (Reg F) | Counts calls per account per 7-day window | `workers/src/lib/compliance-checker.ts` | **IMPLEMENTED** |
| Pre-dial gate in dialer | `checkPreDialCompliance()` blocks violating calls | `workers/src/lib/dialer-engine.ts` (L166) | **IMPLEMENTED** |
| UI compliance gate | `PreDialChecker.tsx` shows pass/fail before dialing | `components/cockpit/PreDialChecker.tsx` | **IMPLEMENTED** |
| Compliance events logged | Every check result stored | `compliance_events` table | **IMPLEMENTED** |

### 2.3 Cease & Desist (§1692c(c))

**Requirement:** If debtor requests in writing that collector cease communication, collector must stop all contact (with limited exceptions for final notices).

| Control | Implementation | File | Status |
|---|---|---|---|
| C&D flag on account | `collection_accounts.cease_and_desist BOOLEAN` | Migration `2026-02-11` | **IMPLEMENTED** |
| Pre-dial block | Blocks call if `cease_and_desist = true` | `workers/src/lib/compliance-checker.ts` (L90) | **IMPLEMENTED** |
| Sequence exclusion | C&D accounts excluded from campaign sequences | `workers/src/lib/sequence-executor.ts` (L78) | **IMPLEMENTED** |
| Dialer exclusion | Dialer fetches and respects C&D flag | `workers/src/routes/dialer.ts` (L290) | **IMPLEMENTED** |

### 2.4 Dispute Handling & Validation (§1692g)

**Requirement:** Within 5 days of first communication, send written notice of debt amount, creditor name, and debtor's right to dispute. If disputed within 30 days, must cease collection and send verification.

| Control | Implementation | File | Status |
|---|---|---|---|
| Dispute filing (table + API + UI) | `collection_disputes` table, `POST /api/disputes` | `workers/src/routes/cockpit.ts` (L145–200) | **IMPLEMENTED** |
| Legal hold system | `legal_holds` table with CRUD | `workers/src/routes/retention.ts` (L118–220) | **IMPLEMENTED** |
| Pre-dial legal hold block | Active legal holds block outbound contact | `workers/src/lib/compliance-checker.ts` (L109–120) | **IMPLEMENTED** |
| **Auto-pause on dispute** | Filing dispute should auto-create legal hold | — | **GAP** |
| **Validation letter trigger** | FDCPA §809 letter auto-queue on dispute | — | **GAP** |
| **Account status → 'disputed'** | Should update `collection_accounts.status` | — | **GAP** |

**Priority Gap:** Disputes can be filed but don't automatically pause collection activity. This requires manual legal hold creation. The auto-pause workflow should connect dispute filing → legal hold creation → sequence pause.

### 2.5 DNC (Do Not Call) List Management

| Control | Implementation | File | Status |
|---|---|---|---|
| Phone-level DNC list | Checked in pre-dial compliance | `workers/src/lib/compliance-checker.ts` | **IMPLEMENTED** |
| DNC management routes | `GET/POST/DELETE /api/compliance/dnc` | `workers/src/routes/compliance.ts` | **IMPLEMENTED** |
| National DNC registry | External check capability | Compliance configuration | **IMPLEMENTED** |

### 2.6 Audit & Record Retention

| Control | Implementation | File | Status |
|---|---|---|---|
| Audit logging (all actions) | `writeAuditLog()` with 7-year retention | `workers/src/lib/audit.ts` | **IMPLEMENTED** |
| Compliance event history | `compliance_events` table with full history | Migration schemas | **IMPLEMENTED** |
| Disclosure logs | `disclosure_logs` table | `neon_public_schema_pass1.sql` (L543) | **IMPLEMENTED** |
| Call recordings | R2 storage with tenant isolation | `workers/src/routes/recordings.ts` | **IMPLEMENTED** |

---

## 3. Compliance Audit Checklist

Run quarterly or before regulatory examination:

- [ ] Every outbound collection call has mini-Miranda disclosure logged
- [ ] All calls fall within 8am–9pm debtor local time
- [ ] No account exceeds 7 calls per 7-day period
- [ ] All disputes pause collection activity within 24 hours
- [ ] Validation letters sent within 30 days of dispute
- [ ] Cease & desist requests honored immediately (no further contact)
- [ ] 7-year record retention enforced on all records
- [ ] DNC list checked before every outbound attempt
- [ ] All compliance events logged with timestamps
- [ ] Agent disclosures verified via recording spot-checks

---

## 4. Remaining Actions

| # | Action | Priority | Effort | Status |
|---|---|---|---|---|
| 1 | Wire dispute filing → auto-create legal hold | P0 | 4 hours | Not Started |
| 2 | Auto-queue validation letter on dispute | P1 | 1 day | Not Started |
| 3 | Update `collection_accounts.status` on dispute | P0 | 2 hours | Not Started |
| 4 | Fix Cockpit mini-Miranda display (read from API) | P2 | 2 hours | Not Started |
| 5 | Add validation letter template to email campaigns | P1 | 4 hours | Not Started |

---

## 5. References

- [15 U.S.C. §§ 1692–1692p](https://www.law.cornell.edu/uscode/text/15/chapter-41/subchapter-V)
- [12 CFR Part 1006 (Regulation F)](https://www.ecfr.gov/current/title-12/chapter-X/part-1006)
- [CFPB Debt Collection Rule](https://www.consumerfinance.gov/rules-policy/final-rules/debt-collection-practices-regulation-f/)
