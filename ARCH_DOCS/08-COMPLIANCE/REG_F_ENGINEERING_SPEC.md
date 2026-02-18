# Regulation F & TCPA Engineering Spec

**Purpose:** Map every enforceable regulation to a concrete technical requirement with implementation status.  
**Authority:** 12 CFR Part 1006 (Regulation F), 15 U.S.C. §§ 1692-1692p (FDCPA), 47 U.S.C. § 227 (TCPA)  
**Owner:** Engineering  
**Date:** February 17, 2026  
**Status:** Living document — update as features ship

---

## How to Use This Spec

Each section follows the same format:

```
REG SECTION → WHAT THE LAW SAYS → TECHNICAL REQUIREMENT → CURRENT STATUS → TASK (if gap)
```

Status key: ✅ Enforced | ⚠️ Partial | ❌ Missing | 🔧 Task defined

Every task references the **existing file** it should modify or the **new file** it creates.  
Every task follows the existing pattern in `compliance-checker.ts` (pre-dial gate → DB query → fail-closed → audit log).

---

## PART 1: Communications Restrictions (§1006.6)

### REQ-001: Time-of-Day Restrictions
**Regulation:** §1006.6(b)(1)(i) — No contact before 8:00 AM or after 9:00 PM **local time at the consumer's location**.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **Server file** | `workers/src/lib/compliance-checker.ts` L123-127, L310-332 |
| **Enforcement** | `isAllowedCallingTime(timezone)` uses `Intl.DateTimeFormat` with debtor's timezone from DB |
| **Fail mode** | Closed (blocks if timezone is invalid) |
| **Audit** | Logged to `compliance_events` table |
| **Gap** | SMS checker in `workers/src/lib/compliance.ts` L164-175 uses server time instead of consumer timezone |

**Task TASK-001:** Update SMS time check in `workers/src/lib/compliance.ts` to use account timezone (same pattern as voice checker).

---

### REQ-002: Attorney-Represented Consumer Block
**Regulation:** §1006.6(b)(2) — If a debt collector knows the consumer is represented by an attorney with respect to such debt and knows or can readily ascertain the attorney's name and address, must **not** communicate directly with the consumer.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **Server file** | `workers/src/lib/compliance-checker.ts` — attorney_represented check in both accountId and phone-lookup branches |
| **Migration** | `migrations/2026-02-17-reg-f-compliance.sql` — `attorney_represented`, `attorney_name`, `attorney_email`, `attorney_phone` columns on `collection_accounts` |
| **Enforcement** | Pre-dial block: `if (acct.attorney_represented) { checks.attorney_represented = false }` |
| **Audit** | `AuditAction.COMPLIANCE_ATTORNEY_BLOCKED` → `writeAuditLog` + `compliance_events` table |
| **Gap** | None — UI attorney fields on AccountDetails.tsx pending (cosmetic) |

**Task TASK-002:**  
1. **Migration:** `ALTER TABLE collection_accounts ADD COLUMN attorney_represented BOOLEAN DEFAULT false, ADD COLUMN attorney_name TEXT, ADD COLUMN attorney_email TEXT, ADD COLUMN attorney_phone TEXT;`  
2. **Pre-dial check:** Add step 1.5 in `compliance-checker.ts` after cease_and_desist check:
   ```typescript
   if (acct.attorney_represented) {
     checks.attorney_represented = false
     blockedBy = blockedBy || 'attorney_represented'
     reason = reason || 'Consumer represented by attorney — direct contact prohibited (§1006.6(b)(2))'
   }
   ```
3. **ComplianceCheck interface:** Add `attorney_represented: boolean` to checks object.
4. **UI:** Add attorney fields to account edit form in `components/voice/AccountDetails.tsx`.
5. **Audit:** Compliance event auto-logged by existing `compliance_events` INSERT in compliance-checker.ts.

**Effort:** 2-3 hours  
**Files:** `compliance-checker.ts`, migration SQL, `AccountDetails.tsx`, `schemas.ts` (Zod validation)

---

### REQ-003: Employer Communication Prohibition
**Regulation:** §1006.6(b)(3) — Must not contact consumer at workplace if collector knows employer prohibits it.

| Attribute | Detail |
|---|---|
| **Status** | ⚠️ Partial |
| **Current** | No `employer_prohibits_contact` flag exists. DNC flag would cover this implicitly but is not specific. |

**Task TASK-003:**  
1. Add `employer_prohibits_contact BOOLEAN DEFAULT false` to `collection_accounts`.
2. Account CRUD UI should expose this toggle.
3. Not a pre-dial gate (this only applies to workplace calls, not the consumer's personal phone). Log as compliance note if set.

**Effort:** 1 hour  
**Priority:** Low — collectors rarely call workplaces via software dialer

---

### REQ-004: Cease Communication Honor
**Regulation:** §1006.6(c)(1) — If consumer notifies in writing to cease communication, collector must stop. Exceptions only for: (i) terminate efforts, (ii) notify of remedy invocation, (iii) intend to invoke remedy.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **Server file** | `compliance-checker.ts` L84-93 |
| **Enforcement** | `cease_and_desist` flag on `collection_accounts` → pre-dial block |
| **Multi-channel** | SMS: `webhooks.ts` L2789-2818 (STOP keyword detection), Email: `unsubscribe.ts` |
| **Audit** | Logged to `compliance_events`, `opt_out_requests` table, `audit_logs` |

No task required.

---

### REQ-005: Email Safe Harbor Procedures
**Regulation:** §1006.6(d)(3-4) — For emails to not violate third-party disclosure rules, collector must follow one of two safe harbors: (i) consumer used the email to communicate about the debt, or (ii) creditor-provided email with 35-day opt-out notice.

| Attribute | Detail |
|---|---|
| **Status** | ⚠️ Partial |
| **Current** | Email consent tracked in `consent_records` table. Email opt-out via `unsubscribe.ts`. But no tracking of *which safe harbor* qualifies the email address. |

**Task TASK-005:**  
1. Add `email_consent_basis` ENUM to `consent_records`: `'consumer_initiated'`, `'creditor_provided_with_notice'`, `'prior_collector'`.
2. When sending email campaigns, check that at least one basis exists.
3. Log basis in compliance event.

**Effort:** 2-3 hours  
**Files:** migration SQL, `consent.ts`, `workers/src/routes/campaigns.ts`

---

### REQ-006: SMS Safe Harbor (60-Day Reconfirmation)
**Regulation:** §1006.6(d)(5) — SMS is only safe if: (i) consumer texted collector from that number within past 60 days, OR (ii) collector reconfirmed number hasn't been reassigned within 60 days.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **Server file** | `workers/src/scheduled.ts` — `expireSmsConsent()` cron at 6am UTC daily |
| **Migration** | `migrations/2026-02-17-reg-f-compliance.sql` — uses existing `consent_records` table |
| **Enforcement** | `UPDATE consent_records SET event_type = 'expired'` for records > 60 days without inbound SMS |
| **Audit** | `AuditAction.COMPLIANCE_SMS_CONSENT_EXPIRED` → `writeAuditLog` + `logger.info` |
| **Gap** | Pre-SMS send check for active consent is implicit via campaign flow, not explicit gate |

**Task TASK-006:**  
1. **Cron job:** New scheduled handler in `workers/src/scheduled.ts`:
   ```typescript
   // Every day at 2am UTC: expire SMS consent records older than 60 days
   // unless renewed by recent inbound SMS from that number
   UPDATE consent_records
   SET event_type = 'expired', updated_at = NOW()
   WHERE consent_type = 'sms_contact'
     AND event_type IN ('granted', 'renewed')
     AND created_at < NOW() - INTERVAL '60 days'
     AND account_id NOT IN (
       SELECT DISTINCT ca.id FROM collection_accounts ca
       JOIN calls c ON c.to_number = ca.primary_phone OR c.from_number = ca.primary_phone
       WHERE c.direction = 'inbound' AND c.channel = 'sms'
         AND c.created_at > NOW() - INTERVAL '60 days'
     )
   ```
2. **Pre-SMS check:** Before sending SMS in campaigns, verify active `sms_contact` consent exists and hasn't expired.
3. **Wrangler cron:** Add to `wrangler.toml` — `"0 2 * * *"` trigger.

**Effort:** 3-4 hours  
**Files:** `scheduled.ts`, `wrangler.toml`, `workers/src/lib/compliance.ts`, migration SQL

---

### REQ-007: Opt-Out Notice in Electronic Communications
**Regulation:** §1006.6(e) — Every electronic communication must include clear opt-out instructions. Cannot require fee or information beyond opt-out preference.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **SMS** | STOP keyword auto-detection in `webhooks.ts` L2789-2818 |
| **Email** | One-click unsubscribe via `unsubscribe.ts` route + CAN-SPAM footer |
| **Audit** | All opt-outs logged to `opt_out_requests` table + `audit_logs` |

No task required.

---

## PART 2: Harassment Prevention (§1006.14)

### REQ-008: Call Frequency — 7-in-7 Rule
**Regulation:** §1006.14(b)(2)(i) — Presumed compliant if no more than 7 calls within 7 consecutive days per particular debt, AND no calls within 7 days after telephone conversation.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced (both prongs) |
| **Server file** | `compliance-checker.ts` — 7-in-7 count + conversation cooldown check |
| **Enforcement** | First prong: counts outbound calls in 7 days, blocks at ≥7. Second prong: blocks if most recent **connected** outbound call was within 7 days |
| **Audit** | `AuditAction.COMPLIANCE_CONVERSATION_COOLDOWN` → `writeAuditLog` + `compliance_events` |
| **Gap** | Consent exception per §1006.14(b)(3)(i) not yet implemented |

**Task TASK-008:**  
1. Add second check: if the most recent **connected** outbound call to this number was within the last 7 days, block.
   ```typescript
   // After the 7-in-7 count check, add conversation cooldown check:
   const lastConversation = await db.query(
     `SELECT created_at FROM calls
      WHERE organization_id = $1 AND to_number = $2
        AND direction = 'outbound' AND status = 'completed'
        AND duration_seconds > 0
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC LIMIT 1`,
     [organizationId, phoneNumber]
   )
   if (lastConversation.rows.length > 0) {
     checks.contact_frequency = false
     blockedBy = blockedBy || 'frequency_conversation_cooldown'
     reason = reason || 'Reg F: Cannot call within 7 days after telephone conversation (§1006.14(b)(2)(i)(B))'
   }
   ```
2. Add consent exception per §1006.14(b)(3)(i): calls with prior consent given within 7 days are excluded from frequency count.

**Effort:** 2 hours  
**Files:** `compliance-checker.ts`

---

### REQ-009: Caller Identity Disclosure
**Regulation:** §1006.14(g) — Must meaningfully disclose caller's identity on every call.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **Server file** | `webhooks.ts` L1309-1342 |
| **Enforcement** | Mini-Miranda auto-played via Telnyx `speak` API on `call.answered` for outbound collections |
| **Audit** | Triple-write: `compliance_events`, `disclosure_logs`, `calls.disclosure_given` |

No task required.

---

### REQ-010: Communication Medium Opt-Out
**Regulation:** §1006.14(h)(1) — If consumer requests no contact via a specific medium, collector must honor it.

| Attribute | Detail |
|---|---|
| **Status** | ⚠️ Partial |
| **Current** | SMS opt-out and email opt-out work. But consent is tracked at the consent-type level, not enforced per-medium in pre-dial. |
| **Gap** | A consumer who opts out of SMS can still receive campaign SMS if the campaign doesn't check `consent_records`. Voice pre-dial doesn't check voice-specific consent. |

**Task TASK-010:**  
1. In pre-dial checker, add voice-channel consent check:
   ```typescript
   const voiceConsent = await db.query(
     `SELECT event_type FROM consent_records
      WHERE account_id = $1 AND organization_id = $2
        AND consent_type = 'outbound_contact'
      ORDER BY created_at DESC LIMIT 1`,
     [accountId, organizationId]
   )
   if (voiceConsent.rows[0]?.event_type === 'revoked') {
     checks.consent = false
     blockedBy = blockedBy || 'voice_consent_revoked'
     reason = reason || 'Consumer opted out of voice contact (§1006.14(h))'
   }
   ```
2. In SMS send path (`compliance.ts`), check `sms_contact` consent record.
3. In email send path, check `email_contact` consent record.

**Effort:** 3 hours  
**Files:** `compliance-checker.ts`, `compliance.ts`, campaign routes

---

## PART 3: Validation Notice (§1006.34) — CRITICAL

### REQ-011: Validation Notice Delivery
**Regulation:** §1006.34(a)(1) — Must provide validation information either in the initial communication or within 5 days of initial communication. Must use Model Form B-1 (or substantially similar).

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **Server file** | `workers/src/routes/validation-notices.ts` — 6 endpoints (CRUD + sent + disputed + pending-alerts) |
| **Migration** | `migrations/2026-02-17-reg-f-compliance.sql` — `validation_notices` table (24 columns, 4 indexes, RLS) |
| **Enforcement** | POST generates Model Form B-1 from account data, PATCH /sent tracks delivery, PATCH /disputed auto-creates legal hold, GET /pending-alerts for deadline monitoring |
| **Cron** | `scheduled.ts` — `checkValidationNoticeDeadlines()` creates `compliance_events` warning at 3 days, auto-escalates to `compliance_violations` at 5 days |
| **Audit** | `AuditAction.VALIDATION_NOTICE_CREATED/SENT/DISPUTED` → `writeAuditLog` + `compliance_events` table |
| **Remaining** | PDF generation (Phase 5 of original spec), auto-trigger from first outbound call in webhooks.ts |

**Task TASK-011 (P0):**

**Phase 1: Data model (migration)**
```sql
CREATE TABLE IF NOT EXISTS validation_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  
  -- Notice content (Model Form B-1 fields per §1006.34(c))
  collector_name TEXT NOT NULL,
  collector_mailing_address TEXT NOT NULL,
  consumer_name TEXT NOT NULL,
  consumer_mailing_address TEXT,
  creditor_on_itemization_date TEXT,
  account_number_truncated TEXT,
  current_creditor TEXT NOT NULL,
  itemization_date DATE NOT NULL,
  amount_on_itemization_date DECIMAL(12,2) NOT NULL,
  itemization_details JSONB,             -- interest, fees, payments, credits since itemization date
  current_amount DECIMAL(12,2) NOT NULL,
  
  -- Validation period tracking
  validation_period_end DATE NOT NULL,    -- 30 days after consumer receives (+ 5 day assumed receipt)
  dispute_response_prompts JSONB,         -- §1006.34(c)(4) dispute/original-creditor prompts
  
  -- Spanish language support (§1006.34(d)(3)(vi) & (e))
  spanish_translation_offered BOOLEAN DEFAULT false,
  spanish_notice_sent BOOLEAN DEFAULT false,
  
  -- Delivery tracking
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email', 'mail', 'in_app', 'initial_communication')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_reference TEXT,               -- mail tracking number or email message ID
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'disputed', 'expired')),
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_validation_notices_org ON validation_notices(organization_id);
CREATE INDEX idx_validation_notices_account ON validation_notices(account_id);
CREATE INDEX idx_validation_notices_status ON validation_notices(status);
CREATE INDEX idx_validation_notices_period_end ON validation_notices(validation_period_end);
ALTER TABLE validation_notices ENABLE ROW LEVEL SECURITY;
```

**Phase 2: Route handler** — New file `workers/src/routes/validation-notices.ts`
- `POST /api/validation-notices` — Generate notice from account data (auto-populate Model Form B-1 fields)
- `GET /api/validation-notices/:id` — Retrieve notice
- `GET /api/validation-notices?account_id=X` — List notices for account
- `PATCH /api/validation-notices/:id/sent` — Mark as sent with delivery reference
- `GET /api/validation-notices/:id/pdf` — Generate PDF (using template engine)

**Phase 3: Auto-trigger** — Hook into first outbound call:
In `webhooks.ts`, after first outbound `call.answered` for an account, check if a validation notice exists:
```typescript
const existingNotice = await db.query(
  `SELECT id FROM validation_notices
   WHERE account_id = $1 AND organization_id = $2 LIMIT 1`,
  [accountId, organizationId]
)
if (existingNotice.rows.length === 0) {
  // Auto-generate pending validation notice — must be sent within 5 days
  // Insert into validation_notices with status = 'pending'
  // Queue for review/send
}
```

**Phase 4: Cron — 5-day send reminder** in `scheduled.ts`:
```typescript
// Alert on validation notices pending > 3 days (2-day warning before 5-day deadline)
SELECT * FROM validation_notices
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '3 days'
```

**Phase 5: Dispute integration** — When consumer disputes via `cockpit.ts`, update validation notice status to `'disputed'` and trigger verification/cease-collection per §1006.34(c)(3).

**Effort:** 8-12 hours  
**Files:** New migration, new `validation-notices.ts` route, `webhooks.ts` hook, `scheduled.ts` cron, PDF template, UI component

---

### REQ-012: Validation Notice Content (§1006.34(c))
**Regulation:** The notice must contain specific required fields. Model Form B-1 provides safe harbor.

Required fields (mapped to DB columns in TASK-011):
| §1006.34(c) | Field | DB Column |
|---|---|---|
| (c)(1) | Debt collector communication disclosure | Boilerplate text (§1006.18(e)) |
| (c)(2)(i) | Collector name and mailing address | `collector_name`, `collector_mailing_address` |
| (c)(2)(ii) | Consumer name and mailing address | `consumer_name`, `consumer_mailing_address` |
| (c)(2)(iii) | Creditor on itemization date | `creditor_on_itemization_date` |
| (c)(2)(iv) | Account number (truncated) | `account_number_truncated` |
| (c)(2)(v) | Current creditor | `current_creditor` |
| (c)(2)(vi) | Itemization date | `itemization_date` |
| (c)(2)(vii) | Amount on itemization date | `amount_on_itemization_date` |
| (c)(2)(viii) | Itemization of current amount | `itemization_details` (JSONB: interest, fees, payments, credits) |
| (c)(2)(ix) | Current amount | `current_amount` |
| (c)(3)(i-iii) | Dispute rights with end date | `validation_period_end` + boilerplate text |
| (c)(3)(iv) | CFPB website reference | Static: `www.cfpb.gov/debt-collection` |
| (c)(4) | Dispute prompts ("How do you want to respond?") | `dispute_response_prompts` JSONB |

**Status:** Covered by TASK-011 data model. No separate task.

---

### REQ-013: Spanish-Language Validation Notice
**Regulation:** §1006.34(d)(3)(vi) — May optionally offer Spanish translation. §1006.34(e)(2) — If offered and requested, **must** provide it.

| Attribute | Detail |
|---|---|
| **Status** | ❌ Missing |
| **Note** | Your platform already does real-time EN↔ES translation. This is a natural extension. |

**Task TASK-013:** Include in TASK-011 Phase 2. When generating notices, include the optional Spanish disclosure: `"Póngase en contacto con nosotros para solicitar una copia de este formulario en español"`. Track `spanish_translation_offered` and `spanish_notice_sent` flags.

**Effort:** Included in TASK-011

---

### REQ-014: Record Retention (3 Years)
**Regulation:** §1006.38 — Must retain validation notices, evidence of compliance, and records of communications for 3 years.

| Attribute | Detail |
|---|---|
| **Status** | ⚠️ Partial |
| **Current** | Call recordings in R2 (no auto-delete). Audit logs retained. Compliance events retained. But no explicit retention policy enforced. |

**Task TASK-014:**
1. Add `retention_policy` config to `organization_settings`: `{ call_recordings: '3_years', audit_logs: '7_years', validation_notices: '3_years' }`.
2. Cron job: flag records approaching retention expiry but **never auto-delete** (legal hold may override).
3. Dashboard widget showing retention compliance status.

**Effort:** 4 hours  
**Files:** `scheduled.ts`, org settings migration, compliance dashboard component

---

## PART 4: TCPA Compliance

### REQ-015: Two-Party Consent States (Call Recording)
**Regulation:** 13 states require all-party consent for call recording: CA, CT, FL, IL, MA, MD, MI (case law), MT, NH, NV, PA, WA, HI. Some apply only to in-state calls; CA (Penal Code §632) penalizes per-recording.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **Server file** | `compliance-checker.ts` — two-party consent checks in both accountId and phone-lookup branches |
| **Migration** | `migrations/2026-02-17-reg-f-compliance.sql` — `state_consent_rules` table seeded with all 50 states + DC |
| **Enforcement** | Queries `state_consent_rules` for consumer's state; if `all_party`, adds warning to response (not a block — flag for enhanced disclosure) |
| **Audit** | `AuditAction.COMPLIANCE_TWO_PARTY_STATE` → `writeAuditLog` + `compliance_events` |
| **Gap** | Enhanced recording disclosure in `webhooks.ts` not yet conditional on two-party flag; inbound call recording disclosure not yet added |

**Task TASK-015 (P1):**

1. **State consent data** — New reference table:
```sql
CREATE TABLE IF NOT EXISTS state_consent_rules (
  state_code CHAR(2) PRIMARY KEY,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('one_party', 'all_party')),
  recording_disclosure_required BOOLEAN DEFAULT false,
  statute_reference TEXT,
  notes TEXT
);
-- Seed all 50 states + DC
INSERT INTO state_consent_rules VALUES
  ('AL', 'one_party', false, 'Ala. Code §13A-11-30', NULL),
  ('CA', 'all_party', true, 'Cal. Penal Code §632', 'Applies to confidential communications'),
  ('CT', 'all_party', true, 'Conn. Gen. Stat. §52-570d', NULL),
  ('FL', 'all_party', true, 'Fla. Stat. §934.03', NULL),
  ('IL', 'all_party', true, '720 ILCS 5/14-2', 'Eavesdropping Act'),
  -- ... (all 50 states)
;
```

2. **Pre-dial consent check** — In `compliance-checker.ts`, after time-of-day check:
```typescript
// Determine consumer's state from account address or phone area code
const consumerState = await getConsumerState(db, accountId, phoneNumber)
const consentRule = await db.query(
  `SELECT consent_type FROM state_consent_rules WHERE state_code = $1`,
  [consumerState]
)
if (consentRule.rows[0]?.consent_type === 'all_party') {
  // Flag: recording disclosure must include explicit consent request
  // Not a block — but sets a flag that webhooks.ts reads
  checks.two_party_consent_state = true
}
```

3. **Recording disclosure upgrade** — In `webhooks.ts` call.answered handler:
   - If `two_party_consent_state` flag is set, play enhanced disclosure: *"This call will be recorded. By continuing this call, you consent to being recorded."*
   - If consumer disconnects immediately after disclosure, mark as "consent not given" and do NOT save recording.

4. **Inbound call recording disclosure** — Currently missing entirely. Add to IVR flow:
   - Before routing inbound call to agent, play: *"This call may be recorded for quality assurance. Please stay on the line."*

**Effort:** 6-8 hours  
**Files:** Migration (new table + seed), `compliance-checker.ts`, `webhooks.ts`, IVR configuration

---

### REQ-016: TCPA Prior Express Consent for Auto-Dialer
**Regulation:** 47 U.S.C. §227(b)(1)(A) — Calls using ATDS (automatic telephone dialing system) to cell phones require prior express consent (written for telemarketing).

| Attribute | Detail |
|---|---|
| **Status** | ⚠️ Partial |
| **Current** | Consent tracked in `consent_records` table. Predictive dialer exists. But no classification of calls as "ATDS" and no written-consent gate for campaign dialing. |

**Task TASK-016:**
1. Campaign creation should require `tcpa_consent_type` field: `'prior_express'` or `'prior_express_written'`.
2. Pre-dial for campaigns: verify matching consent record exists for each account.
3. Campaign UI should warn if accounts lack required consent level.

**Effort:** 4 hours  
**Files:** `campaigns.ts`, campaign creation UI, `compliance-checker.ts`

---

## PART 5: Time-Barred Debt

### REQ-017: Statute of Limitations Awareness
**Regulation:** §1006.26(b) — Must not sue or threaten to sue on time-barred debt. Many states require specific disclosures when collecting time-barred debt.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced (warning level) |
| **Server file** | `compliance-checker.ts` — SOL warning in both accountId and phone-lookup branches |
| **Migration** | `migrations/2026-02-17-reg-f-compliance.sql` — `sol_state`, `charge_off_date`, `sol_expires_at` on `collection_accounts`; `state_sol_rules` reference table seeded |
| **Enforcement** | Computed `sol_expired` via `CASE WHEN sol_expires_at < CURRENT_DATE`. Warning (not block) added to compliance check response |
| **Audit** | `AuditAction.COMPLIANCE_SOL_WARNING` → `writeAuditLog` + `compliance_events` |
| **Gap** | State-specific disclosure text in mini-Miranda not yet conditional on SOL status |

**Task TASK-017:**
1. **State SOL reference table:**
```sql
CREATE TABLE IF NOT EXISTS state_sol_rules (
  state_code CHAR(2) NOT NULL,
  debt_type TEXT NOT NULL CHECK (debt_type IN ('written_contract', 'oral_contract', 'promissory_note', 'open_account', 'credit_card')),
  sol_years INTEGER NOT NULL,
  PRIMARY KEY (state_code, debt_type)
);
-- Seed: e.g., CA written_contract = 4 years, NY = 6, etc.
```
2. **Auto-calculate SOL status** on `collection_accounts`:
   - `sol_state` (consumer's state)
   - `sol_expires_at` (computed from `charge_off_date + sol_years`)
   - `sol_expired` (boolean, computed)
3. **Pre-dial warning** (not block — collecting time-barred debt isn't illegal, threatening to sue is):
   - If `sol_expired`, add warning to compliance check response.
   - Agent cockpit shows SOL warning banner.
4. **Disclosure requirement:** Some states (e.g., NY, NM, WI) require specific disclosure when collecting time-barred debt. Add to mini-Miranda if applicable.

**Effort:** 6-8 hours  
**Files:** Migration (lookup + computed columns), `compliance-checker.ts`, cockpit UI, mini-Miranda logic in `webhooks.ts`

---

## PART 6: Unfair Practices Prevention (§1006.22)

### REQ-018: No Collection of Unauthorized Amounts
**Regulation:** §1006.22(a) — Must not collect any amount unless authorized by the debt agreement or permitted by law.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced |
| **Current** | Settlement calculator in `settlements.ts` tracks original balance, fees, and negotiated amounts with audit trail. Payments update balances via atomic DB transactions. |

No task required.

---

### REQ-019: No Threats of Unauthorized Action
**Regulation:** §1006.22(b) — Must not threaten to take action that is not intended or cannot legally be taken.

| Attribute | Detail |
|---|---|
| **Status** | ✅ Enforced (via Bond AI) |
| **Current** | AI copilot suggestions are governed by AI Role Policy (notary, not actor). Objection scripts in `productivity.ts` are curated for compliance. Real-time sentiment analysis flags aggressive language. |

No task required — but see TASK-017 for SOL-specific threat prevention.

---

## Implementation Priority Matrix

| ID | Task | Regulation | Risk Level | Effort | Priority |
|---|---|---|---|---|---|
| **TASK-011** | Validation notice engine (Model Form B-1) | §1006.34 | ✅ **SHIPPED** | Done | **P0** |
| **TASK-015** | Two-party consent state recording rules | TCPA / State law | ✅ **SHIPPED** (warning level) | Done | **P1** |
| **TASK-002** | Attorney-represented consumer block | §1006.6(b)(2) | ✅ **SHIPPED** | Done | **P1** |
| **TASK-008** | 7-day conversation cooldown (second prong) | §1006.14(b)(2)(i)(B) | ✅ **SHIPPED** | Done | **P2** |
| **TASK-006** | SMS 60-day consent reconfirmation cron | §1006.6(d)(5) | ✅ **SHIPPED** | Done | **P2** |
| **TASK-017** | Statute of limitations auto-calculation | §1006.26(b) | ✅ **SHIPPED** (warning level) | Done | **P2** |
| **TASK-010** | Per-channel consent enforcement in pre-dial | §1006.14(h) | **MEDIUM** | 3h | **P2** |
| **TASK-016** | TCPA ATDS consent classification | 47 U.S.C. §227 | **MEDIUM** | 4h | **P3** |
| **TASK-005** | Email safe harbor basis tracking | §1006.6(d)(4) | **LOW** | 2-3h | **P3** |
| **TASK-014** | 3-year record retention policy | §1006.38 | **LOW** | 4h | **P3** |
| **TASK-001** | SMS time-of-day to use consumer timezone | §1006.6(b)(1)(i) | **LOW** | 1h | **P3** |
| **TASK-003** | Employer prohibits contact flag | §1006.6(b)(3) | **LOW** | 1h | **P4** |
| **TASK-013** | Spanish validation notice (per §1006.34(e)) | §1006.34(d)(3)(vi) | **LOW** | Included in 011 | **P4** |

**Shipped: 6/13 tasks (v5.3 — Feb 17, 2026)**  
**Remaining effort for remaining gaps: ~18-22 engineering hours**

---

## Architecture Pattern (All Tasks Follow This)

Every new compliance check plugs into the existing pipeline:

```
┌─────────────────────────────────────────────────────────┐
│                   Pre-Dial Gate                          │
│              compliance-checker.ts                        │
│                                                          │
│  1. Account flags (DNC, cease, bankruptcy)               │
│  2. Attorney representation  ← TASK-002 (NEW)           │
│  3. DNC list lookup                                      │
│  4. Consent verification (per-channel) ← TASK-010 (UPD) │
│  5. Legal hold check                                     │
│  6. Time-of-day (timezone-aware)                         │
│  7. 7-in-7 frequency + conversation cooldown ← TASK-008 │
│  8. Two-party consent state flag ← TASK-015 (NEW)       │
│  9. SOL warning ← TASK-017 (NEW)                        │
│                                                          │
│  → All checks logged to compliance_events                │
│  → Fail-closed on any error                              │
│  → Returns { allowed, checks, reason, blockedBy }        │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│      Outbound Contact        │
│  (voice / SMS / email)       │
│                              │
│  Post-connect hooks:         │
│  • Mini-Miranda (existing)   │
│  • Recording disclosure      │
│    (enhanced for 2-party)    │
│    ← TASK-015                │
│  • Validation notice check   │
│    ← TASK-011                │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│      Audit Trail             │
│  compliance_events           │
│  disclosure_logs             │
│  consent_records             │
│  validation_notices ← NEW    │
│  audit_logs                  │
└──────────────────────────────┘
```

---

## Files Inventory (New + Modified)

| File | Action | Task |
|---|---|---|
| `workers/src/lib/compliance-checker.ts` | Modify — add checks 2, 7b, 8, 9 | TASK-002, 008, 010, 015, 017 |
| `workers/src/routes/validation-notices.ts` | **New** — CRUD + PDF generation | TASK-011 |
| `workers/src/routes/webhooks.ts` | Modify — post-connect validation notice check, enhanced recording disclosure | TASK-011, 015 |
| `workers/src/scheduled.ts` | Modify — SMS consent expiry cron, validation notice deadline alerts | TASK-006, 011, 014 |
| `workers/src/lib/compliance.ts` | Modify — SMS timezone fix, channel consent check | TASK-001, 010 |
| `workers/src/routes/campaigns.ts` | Modify — TCPA consent check before campaign dial | TASK-016 |
| `workers/src/routes/consent.ts` | Modify — email basis tracking | TASK-005 |
| `migrations/2026-02-17-reg-f-compliance.sql` | **New** — all schema changes | ALL |
| `components/voice/AccountDetails.tsx` | Modify — attorney fields, SOL warning | TASK-002, 017 |
| `components/compliance/ValidationNotice.tsx` | **New** — notice viewer/generator UI | TASK-011 |

---

## Validation Checklist

After implementing each task, verify:

- [ ] Pre-dial check returns `{ allowed: false }` for the regulated scenario
- [ ] `compliance_events` row created with correct `event_type` and `severity`
- [ ] Audit log entry via `writeAuditLog()` with old/new values
- [ ] Existing 66 smart-csv-import tests still pass
- [ ] Existing E2E chat-ui tests still pass
- [ ] `npx next build` succeeds (0 errors)
- [ ] `npx vitest --run` passes all unit tests
- [ ] Workers deploy succeeds (`npm run api:deploy`)

---

## References

- [12 CFR Part 1006 — Regulation F (Full Text)](https://www.consumerfinance.gov/rules-policy/regulations/1006/)
- [§1006.6 — Communications](https://www.consumerfinance.gov/rules-policy/regulations/1006/6/)
- [§1006.14 — Harassment Prevention](https://www.consumerfinance.gov/rules-policy/regulations/1006/14/)
- [§1006.34 — Validation Notice](https://www.consumerfinance.gov/rules-policy/regulations/1006/34/)
- [Model Form B-1 (Appendix B)](https://www.consumerfinance.gov/rules-policy/regulations/1006/B/)
- [CFPB Examination Procedures](https://www.consumerfinance.gov/compliance/supervision-examinations/debt-collection-examination-procedures/)
- [TCPA — 47 U.S.C. § 227](https://www.law.cornell.edu/uscode/text/47/227)
- [ACA International Compliance Resources](https://www.acainternational.org/)
