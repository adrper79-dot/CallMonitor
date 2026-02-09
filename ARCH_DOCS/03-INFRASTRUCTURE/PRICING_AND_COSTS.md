# Pricing & Costs Analysis

**Date:** 2026-02-09

## Current Costs
- Fixed: $50/mo (Neon $20, CF free).
- Variable: $0.02/min (Telnyx+AI).

## Pricing
| Plan | $/mo | Min | Margin |
|------|------|-----|--------|
| Starter | $49 | 500 | $29 |
| Pro | $199 | 5k | $150 |
| Enterprise | $999 | Unlimited | High |

## Hands-Off Ops (Existing)
- **Cron**: scheduled.ts (every 6h).
- **Webhooks**: Stripe/Telnyx auto.
- **Retry**: webhook-retry.ts.
- **Audit**: lib/audit.ts.
- **Retention**: routes/retention.ts.
- **Metrics**: admin-metrics (MRR/usage).

**Gaps**: Vendor cost track, alerts.

**Plan**: Metered Stripe, cron balance check.