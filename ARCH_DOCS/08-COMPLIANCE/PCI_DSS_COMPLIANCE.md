# PCI DSS Compliance Standard

**Payment Card Industry Data Security Standard v4.0**  
**Priority:** P0 — Critical  
**Status:** Compliant (SAQ A)  
**Last Review:** February 16, 2026

---

## 1. Applicability

PCI DSS applies because Word Is Bond processes payments (via Stripe) for:

- Debtor payments (Stripe Checkout sessions / payment links)
- Organization subscriptions (Stripe billing)
- Payment plan auto-charging (Stripe PaymentIntents)

**Compliance Level:** SAQ A (Self-Assessment Questionnaire A) — The simplest level, applicable when all card data is handled by a PCI Level 1 compliant payment processor (Stripe).

**Risk Level:** LOW — The platform never touches, stores, transmits, or processes raw card data.

---

## 2. PCI DSS Controls & Platform Implementation

### 2.1 Cardholder Data Handling — DELEGATED TO STRIPE

| Requirement | Implementation | Status |
|---|---|---|
| No card numbers stored in database | All payments via Stripe Checkout or PaymentIntents | **COMPLIANT** |
| No card numbers in logs | No card data enters Workers/Next.js layer | **COMPLIANT** |
| No card input forms | Stripe Checkout (hosted) handles all card input | **COMPLIANT** |
| Card data encryption | Handled entirely by Stripe | **COMPLIANT** |
| Tokenization | Stripe Customers + PaymentMethods (tokenized) | **COMPLIANT** |

### 2.2 Recording Pause During Payment Collection

**Requirement:** Call recordings must be paused when payment card information is spoken during a call to prevent PAN capture in audio files.

| Control | Implementation | File | Status |
|---|---|---|---|
| Recording pause before payment | `record_pause` via Telnyx API | `workers/src/lib/ivr-flow-engine.ts` (L373–385) | **IMPLEMENTED** |
| Recording resume after payment | `record_resume` on both success and error paths | `workers/src/lib/ivr-flow-engine.ts` (L408) | **IMPLEMENTED** |
| Error-path safety | Recording resumes even if payment fails | `.catch()` handlers | **IMPLEMENTED** |
| Load test metric | `payment_recording_duration` tracked | `tests/load/collections.js` (L31) | **IMPLEMENTED** |

### 2.3 Network Security

| Requirement | Implementation | Status |
|---|---|---|
| TLS encryption in transit | Cloudflare enforces HTTPS on all endpoints | **COMPLIANT** |
| Stripe API calls over TLS | All Stripe API calls use `https://api.stripe.com` | **COMPLIANT** |
| Webhook signature verification | Stripe webhook signatures verified in handlers | **COMPLIANT** |

### 2.4 Access Controls

| Requirement | Implementation | Status |
|---|---|---|
| Unique user IDs | UUID-based user IDs with RBAC | **COMPLIANT** |
| Role-based access to payment functions | `requireAuth()` + `requireRole()` on payment routes | **COMPLIANT** |
| Audit logging of payment actions | `writeAuditLog()` on all payment operations | **COMPLIANT** |

---

## 3. What We Do NOT Do (PCI Scope Exclusions)

- **Do NOT** store card numbers (PAN) in any database table
- **Do NOT** log card numbers in any application log
- **Do NOT** render card input fields (Stripe Checkout handles this)
- **Do NOT** process card data server-side (all via Stripe API tokens)
- **Do NOT** store CVV/CVC values anywhere
- **Do NOT** retain card data in call recordings (recording pause enforced)

---

## 4. Stripe Integration Points

| Integration | Method | File |
|---|---|---|
| Payment link generation | Stripe Checkout Sessions API | `workers/src/routes/payments.ts` (L225–330) |
| Subscription billing | Stripe Customers + Subscriptions | `workers/src/routes/billing.ts` |
| Auto-charging payment plans | Stripe PaymentIntents (off_session) | `workers/src/lib/payment-scheduler.ts` |
| Webhook processing | `checkout.session.completed`, subscription events | `workers/src/routes/webhooks.ts` |
| Dunning escalation | Stripe subscription cancellation | `workers/src/lib/payment-scheduler.ts` (L265+) |

---

## 5. Annual Compliance Tasks

- [ ] Complete SAQ A self-assessment questionnaire
- [ ] Maintain Attestation of Compliance (AOC)
- [ ] Verify Stripe PCI Level 1 certification current
- [ ] Verify recording pause functions correctly (test quarterly)
- [ ] Confirm no card data in application logs (audit quarterly)
- [ ] Confirm no card data in database tables (audit quarterly)
- [ ] Review and update this document annually

---

## 6. Remaining Actions

| # | Action | Priority | Effort | Status |
|---|---|---|---|---|
| 1 | Complete annual SAQ A questionnaire | P2 | 2 hours | Not Started |
| 2 | Document AOC and store securely | P2 | 1 hour | Not Started |

---

## 7. References

- [PCI DSS v4.0](https://www.pcisecuritystandards.org/document_library/)
- [SAQ A Requirements](https://www.pcisecuritystandards.org/document_library/?document=saq)
- [Stripe PCI Compliance](https://stripe.com/docs/security/stripe)
