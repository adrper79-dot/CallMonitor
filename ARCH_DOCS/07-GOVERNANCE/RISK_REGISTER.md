# Risk Register (RAID Log)

**TOGAF Phase:** H — Architecture Change Management  
**Deliverable:** Risk Register, Assumptions, Issues, Dependencies  
**Version:** 1.0  
**Date:** February 13, 2026  
**Last Reviewed:** February 13, 2026  
**Status:** Living Document  
**Review Cadence:** Monthly

---

## Risk Scoring Matrix

| Likelihood × Impact | Low Impact (1) | Medium Impact (2) | High Impact (3) | Critical Impact (4) |
|---------------------|---------------|-------------------|-----------------|-------------------|
| **Almost Certain (4)** | 4 | 8 | 12 | **16** |
| **Likely (3)** | 3 | 6 | **9** | **12** |
| **Possible (2)** | 2 | 4 | 6 | 8 |
| **Unlikely (1)** | 1 | 2 | 3 | 4 |

**Thresholds:** 1-4 = Accept | 5-8 = Monitor | 9-12 = Mitigate | 13-16 = Escalate

---

## Active Risks

### R-001: Database Connection Order Reversal (HTTP 530)
| Field | Value |
|-------|-------|
| **Category** | Technical |
| **Likelihood** | 2 (Possible) |
| **Impact** | 4 (Critical — total API outage) |
| **Score** | **8 — Monitor** |
| **Description** | Reversing Neon/Hyperdrive connection string order in `getDb()` causes WebSocket-over-TCP failure → HTTP 530 on all API requests |
| **Mitigation** | `getDb(env)` utility enforces correct order; copilot-instructions guard; code review checklist |
| **Owner** | Platform Engineering |
| **Status** | ✅ Mitigated — guard in place |

### R-002: Cross-Tenant Data Leakage
| Field | Value |
|-------|-------|
| **Category** | Security |
| **Likelihood** | 1 (Unlikely) |
| **Impact** | 4 (Critical — compliance violation, breach) |
| **Score** | **4 — Accept (defense-in-depth)** |
| **Description** | A missing `organization_id` WHERE clause could expose another tenant's data |
| **Mitigation** | RLS on 50+ tables (DB-level enforcement), `requireAuth()` middleware injects org_id, code review mandates org_id in every query |
| **Owner** | Security Team |
| **Status** | ✅ Mitigated — RLS active |

### R-003: Telnyx Rate Limiting / Account Tier
| Field | Value |
|-------|-------|
| **Category** | Vendor |
| **Likelihood** | 3 (Likely — currently on trial tier) |
| **Impact** | 3 (High — voice calling unavailable) |
| **Score** | **9 — Mitigate** |
| **Description** | Trial tier limits ~10-20 dials/hour. HTTP 429 errors observed in production testing. Production launch blocked until upgraded. |
| **Mitigation** | Upgrade to pay-as-you-go tier; add balance monitoring cron; implement 429 retry with backoff |
| **Owner** | Platform Engineering |
| **Status** | ⚠️ Open — upgrade pending |
| **Due Date** | Before production launch |

### R-004: AI Provider Outage
| Field | Value |
|-------|-------|
| **Category** | Vendor / Availability |
| **Likelihood** | 2 (Possible) |
| **Impact** | 2 (Medium — degraded AI features, core calling unaffected) |
| **Score** | **4 — Accept** |
| **Description** | Any single AI provider (Grok, Groq, OpenAI, AssemblyAI) could experience downtime |
| **Mitigation** | 3-provider redundancy with automatic failover chain: Groq → Grok → OpenAI. AssemblyAI is sole transcription provider (single point of failure) |
| **Owner** | AI Engineering |
| **Status** | ✅ Partially mitigated — failover for LLM; no transcription backup |

### R-005: AI Cost Overrun
| Field | Value |
|-------|-------|
| **Category** | Financial |
| **Likelihood** | 2 (Possible) |
| **Impact** | 2 (Medium — margin erosion) |
| **Score** | **4 — Accept** |
| **Description** | High-volume AI usage without guardrails could exceed budget projections |
| **Mitigation** | AI Router with complexity scoring (38% savings), per-org spending quotas, usage dashboards, Groq migration (83% TTS cost reduction) |
| **Owner** | Product / Finance |
| **Status** | ✅ Mitigated — quotas + routing active |

### R-006: Prompt Injection Attack
| Field | Value |
|-------|-------|
| **Category** | Security |
| **Likelihood** | 2 (Possible) |
| **Impact** | 3 (High — AI manipulation, data exfiltration) |
| **Score** | **6 — Monitor** |
| **Description** | Malicious input could manipulate AI prompts to extract data or produce harmful outputs |
| **Mitigation** | Prompt sanitization pipeline, PII redaction before AI, AI-as-notary policy (no autonomous actions), input validation |
| **Owner** | Security Team |
| **Status** | ✅ Mitigated — sanitization active |

### R-007: PII/PHI Exposure
| Field | Value |
|-------|-------|
| **Category** | Compliance |
| **Likelihood** | 1 (Unlikely) |
| **Impact** | 4 (Critical — HIPAA violation, fines $100-$50K per incident) |
| **Score** | **4 — Accept (defense-in-depth)** |
| **Description** | Sensitive data (SSN, medical info, CC numbers) could leak through logs, AI calls, or API responses |
| **Mitigation** | PII redaction regex pipeline (SSN/CC/DOB/email/phone) runs before ALL AI processing and logging; field-level encryption; RLS isolation |
| **Owner** | Compliance |
| **Status** | ✅ Mitigated — pipeline active |

### R-008: Evidence Integrity Compromise
| Field | Value |
|-------|-------|
| **Category** | Compliance / Legal |
| **Likelihood** | 1 (Unlikely) |
| **Impact** | 4 (Critical — evidence inadmissible, legal liability) |
| **Score** | **4 — Accept** |
| **Description** | Call recordings or transcripts modified after sealing, breaking chain of custody |
| **Mitigation** | Immutable DB triggers (no in-place edits), `transcript_versions` table, `artifact_provenance` tracking, `/api/evidence/verify` integrity check, R2 object versioning |
| **Owner** | Compliance |
| **Status** | ✅ Mitigated — immutability enforced |

### R-009: RBAC Role Divergence (Client vs Server)
| Field | Value |
|-------|-------|
| **Category** | Technical Debt |
| **Likelihood** | 3 (Likely — divergence exists today) |
| **Impact** | 2 (Medium — UI shows capabilities user can't execute) |
| **Score** | **6 — Monitor** |
| **Description** | Client-side RBAC has 9 roles; server-side has 7. `operator`, `analyst`, `member` exist client-side but not in Workers RBAC |
| **Mitigation** | Server is authoritative (rejects unauthorized requests regardless of client display). UI gracefully handles 403 responses |
| **Owner** | Engineering |
| **Status** | ⚠️ Open — alignment backlogged |

### R-010: Neon Serverless Cold Start
| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Likelihood** | 2 (Possible — after inactivity periods) |
| **Impact** | 1 (Low — first request slow, subsequent normal) |
| **Score** | **2 — Accept** |
| **Description** | Neon serverless compute may scale to zero during low-traffic periods, causing ~500ms cold start |
| **Mitigation** | Hyperdrive connection pooling keeps warm connections; health check cron prevents full cold start |
| **Owner** | Platform Engineering |
| **Status** | ✅ Mitigated — Hyperdrive active |

### R-011: Stripe Webhook Replay / Duplication
| Field | Value |
|-------|-------|
| **Category** | Financial |
| **Likelihood** | 2 (Possible) |
| **Impact** | 3 (High — duplicate charges, incorrect plan state) |
| **Score** | **6 — Monitor** |
| **Description** | Stripe may retry webhooks, leading to duplicate event processing |
| **Mitigation** | Idempotency middleware on webhook handler; event ID deduplication in KV; webhook signature verification |
| **Owner** | Engineering |
| **Status** | ✅ Mitigated — idempotency active |

### R-012: AssemblyAI Single Point of Failure
| Field | Value |
|-------|-------|
| **Category** | Vendor / Availability |
| **Likelihood** | 1 (Unlikely) |
| **Impact** | 3 (High — no transcription during outage) |
| **Score** | **3 — Accept** |
| **Description** | AssemblyAI is the sole transcription provider; no fallback exists |
| **Mitigation** | None currently. Potential future: add Deepgram or Whisper as backup. Calls still function without transcription (recording + manual notes) |
| **Owner** | Engineering |
| **Status** | ⚠️ Accepted risk — no backup |

---

## Assumptions Register

| ID | Assumption | Risk if Wrong | Confidence |
|----|-----------|--------------|------------|
| A-001 | Telnyx provides reliable WebRTC at scale | Voice quality degrades; need PSTN-only fallback | High |
| A-002 | Neon serverless handles production DB load | Connection pooling/Hyperdrive + dedicated tier available | High |
| A-003 | Groq/Grok API availability >99.5% | OpenAI fallback chain exists; 3-provider redundancy | Medium |
| A-004 | Call centers willing to adopt cloud-native platform | On-prem hybrid mode not architected | Medium |
| A-005 | Spanish is primary translation need | Architecture supports additional languages via AI pipeline | High |
| A-006 | Cloudflare Workers CPU limits sufficient | 50ms per request adequate for all route handlers | High |
| A-007 | Stripe handles all tax/compliance for billing | No custom tax calculation needed | High |
| A-008 | SOC 2 Type II achievable within 12 months | Tracking dashboard in place; formal audit required | Medium |

---

## Issues Register

| ID | Issue | Severity | Status | Owner | Notes |
|----|-------|----------|--------|-------|-------|
| I-001 | Telnyx trial tier rate limiting (429s) | High | ⚠️ Open | Platform Eng | Blocks production launch |
| I-002 | `soft_delete_call()` trigger uses old column names (`before`/`after`) | Medium | ⚠️ Open | Engineering | Should use `old_value`/`new_value` |
| I-003 | Client/server RBAC role mismatch (9 vs 7) | Low | ⚠️ Open | Engineering | UI shows phantom roles |
| I-004 | ElevenLabs API key expired (401) | Low | ⚠️ Open | Operations | Premium TTS unavailable; Groq TTS active |

---

## Dependencies Register

| ID | Dependency | Type | Criticality | Fallback |
|----|-----------|------|-------------|----------|
| D-001 | Cloudflare Pages + Workers | Infrastructure | Critical | None (platform-locked) |
| D-002 | Neon PostgreSQL | Database | Critical | Self-hosted PostgreSQL (major migration) |
| D-003 | Telnyx Call Control v2 | Voice | Critical | Twilio (2-3x cost increase) |
| D-004 | AssemblyAI | Transcription | High | Deepgram, Whisper (not integrated) |
| D-005 | Stripe | Billing | High | Paddle, LemonSqueezy (migration effort) |
| D-006 | Grok (xAI) | AI - Advanced | Medium | OpenAI GPT-4o (cost increase) |
| D-007 | Groq (Llama 4 Scout) | AI - Cost-Optimized | Medium | OpenAI GPT-4o-mini (cost increase) |
| D-008 | ElevenLabs | TTS - Premium | Low | Groq TTS (already migrated) |
| D-009 | Resend | Email | Low | SendGrid, AWS SES |

---

## Risk Trend

| Quarter | Open Risks | Mitigated | Accepted | Score Trend |
|---------|-----------|-----------|----------|-------------|
| Q1 2026 (Current) | 3 | 7 | 2 | ↓ Improving |

---

## Review Log

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-13 | Architecture Review | Initial register created from audit findings |

---

## References

- [03-INFRASTRUCTURE/MONITORING.md](../03-INFRASTRUCTURE/MONITORING.md) — P0/P1/P2 alerting
- [03-INFRASTRUCTURE/SECURITY_HARDENING.md](../03-INFRASTRUCTURE/SECURITY_HARDENING.md) — Security controls
- [03-INFRASTRUCTURE/TELNYX_ACCOUNT_TIER.md](../03-INFRASTRUCTURE/TELNYX_ACCOUNT_TIER.md) — Telnyx limits
- [01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md](../01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md) — Compliance requirements
- [05-AI/COST_OPTIMIZATION_STRATEGY.md](../05-AI/COST_OPTIMIZATION_STRATEGY.md) — AI cost management
