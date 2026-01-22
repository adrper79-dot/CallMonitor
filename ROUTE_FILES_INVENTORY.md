# Complete Route.ts Files Inventory

**Generated:** 2026-01-22  
**Total Routes:** 153

---

## AI & AI Runs (3)
- `app/api/ai-config/route.ts`
- `app/api/ai-runs/[id]/retry/route.ts`
- `app/api/ai-runs/[id]/status/route.ts`

## Analytics (5)
- `app/api/analytics/calls/route.ts`
- `app/api/analytics/export/route.ts`
- `app/api/analytics/performance/route.ts`
- `app/api/analytics/sentiment-trends/route.ts`
- `app/api/analytics/surveys/route.ts`

## Attention System (4)
- `app/api/attention/decisions/[id]/override/route.ts`
- `app/api/attention/digests/route.ts`
- `app/api/attention/events/route.ts`
- `app/api/attention/policies/route.ts`

## Audio Processing (3)
- `app/api/audio/status/[id]/route.ts`
- `app/api/audio/transcribe/route.ts`
- `app/api/audio/upload/route.ts`

## Audit Logs (1)
- `app/api/audit-logs/route.ts`

## Authentication (7)
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/debug/route.ts`
- `app/api/auth/forgot-password/route.ts`
- `app/api/auth/reset-password/route.ts`
- `app/api/auth/signup/route.ts`
- `app/api/auth/sso/route.ts`
- `app/api/auth/sso/callback/route.ts`
- `app/api/auth/unlock/route.ts`

## Billing (6)
- `app/api/billing/cancel/route.ts`
- `app/api/billing/checkout/route.ts`
- `app/api/billing/invoices/route.ts`
- `app/api/billing/payment-methods/route.ts`
- `app/api/billing/portal/route.ts`
- `app/api/billing/subscription/route.ts`

## Bookings (2)
- `app/api/bookings/route.ts`
- `app/api/bookings/[id]/route.ts`

## Call Capabilities (1)
- `app/api/call-capabilities/route.ts`

## Caller ID (2)
- `app/api/caller-id/verification-twiml/route.ts`
- `app/api/caller-id/verify/route.ts`

## Calls (13)
- `app/api/calls/route.ts`
- `app/api/calls/recordModulationIntent/route.ts`
- `app/api/calls/start/route.ts`
- `app/api/calls/[id]/route.ts`
- `app/api/calls/[id]/confirmations/route.ts`
- `app/api/calls/[id]/debug/route.ts`
- `app/api/calls/[id]/disposition/route.ts`
- `app/api/calls/[id]/email/route.ts`
- `app/api/calls/[id]/export/route.ts`
- `app/api/calls/[id]/notes/route.ts`
- `app/api/calls/[id]/outcome/route.ts`
- `app/api/calls/[id]/summary/route.ts`
- `app/api/calls/[id]/timeline/route.ts`
- `app/api/calls/[id]/translate/route.ts`

## Campaigns (4)
- `app/api/campaigns/route.ts`
- `app/api/campaigns/[id]/route.ts`
- `app/api/campaigns/[id]/execute/route.ts`
- `app/api/campaigns/[id]/stats/route.ts`

## Cron Jobs (4)
- `app/api/cron/fix-orphan-bundles/route.ts`
- `app/api/cron/scheduled-calls/route.ts`
- `app/api/cron/scheduled-reports/route.ts`
- `app/api/cron/webhook-retry/route.ts`

## Debug (3)
- `app/api/debug/email-check/route.ts`
- `app/api/debug/run-start-call/route.ts`
- `app/api/debug/translation-check/route.ts`

## Error Tracking (1)
- `app/api/errors/metrics/route.ts`

## Evidence (1)
- `app/api/evidence/verify/route.ts`

## External Entities (3)
- `app/api/external-entities/route.ts`
- `app/api/external-entities/link/route.ts`
- `app/api/external-entities/[id]/route.ts`

## Features (1)
- `app/api/features/route.ts`

## Health Checks (6)
- `app/api/health/route.ts`
- `app/api/health/auth-adapter/route.ts`
- `app/api/health/auth-providers/route.ts`
- `app/api/health/env/route.ts`
- `app/api/health/resilience/route.ts`
- `app/api/health/user/route.ts`

## Integrations (6)
- `app/api/integrations/route.ts`
- `app/api/integrations/hubspot/callback/route.ts`
- `app/api/integrations/hubspot/connect/route.ts`
- `app/api/integrations/salesforce/callback/route.ts`
- `app/api/integrations/salesforce/connect/route.ts`
- `app/api/integrations/[id]/disconnect/route.ts`
- `app/api/integrations/[id]/sync/route.ts`

## OpenAPI (1)
- `app/api/openapi/route.ts`

## Organizations (1)
- `app/api/organizations/current/route.ts`

## RBAC (1)
- `app/api/rbac/context/route.ts`

## Realtime (1)
- `app/api/realtime/subscribe/route.ts`

## Recordings (1)
- `app/api/recordings/[id]/route.ts`

## Reliability (1)
- `app/api/reliability/webhooks/route.ts`

## Reports (4)
- `app/api/reports/route.ts`
- `app/api/reports/schedules/route.ts`
- `app/api/reports/schedules/[id]/route.ts`
- `app/api/reports/[id]/export/route.ts`

## Retention (2)
- `app/api/retention/route.ts`
- `app/api/retention/legal-holds/route.ts`

## RTI (Real-Time Intelligence) (3)
- `app/api/rti/digests/route.ts`
- `app/api/rti/feed/route.ts`
- `app/api/rti/policies/route.ts`

## Scorecards (2)
- `app/api/scorecards/route.ts`
- `app/api/scorecards/alerts/route.ts`

## Search (2)
- `app/api/search/route.ts`
- `app/api/search/rebuild/route.ts`

## Secret Shopper (3)
- `app/api/shopper/results/route.ts`
- `app/api/shopper/scripts/route.ts`
- `app/api/shopper/scripts/manage/route.ts`

## SignalWire (1)
- `app/api/signalwire/numbers/route.ts`

## Surveys (2)
- `app/api/survey/ai-results/route.ts`
- `app/api/surveys/route.ts`

## Team Management (2)
- `app/api/team/invite/route.ts`
- `app/api/team/members/route.ts`

## Testing (3)
- `app/api/test/e2e/route.ts`
- `app/api/test/run/route.ts`
- `app/api/test-email/route.ts`

## TTS (Text-to-Speech) (1)
- `app/api/tts/generate/route.ts`

## Usage Tracking (1)
- `app/api/usage/route.ts`

## Users (1)
- `app/api/users/[userId]/organization/route.ts`

## Voice Operations (16)
- `app/api/voice/bridge/route.ts`
- `app/api/voice/bulk-upload/route.ts`
- `app/api/voice/call/route.ts`
- `app/api/voice/caller-ids/available/route.ts`
- `app/api/voice/config/route.ts`
- `app/api/voice/config/test/route.ts`
- `app/api/voice/laml/outbound/route.ts`
- `app/api/voice/laml/webrtc-conference/route.ts`
- `app/api/voice/numbers/assign/route.ts`
- `app/api/voice/numbers/retire/route.ts`
- `app/api/voice/numbers/revoke/route.ts`
- `app/api/voice/script/route.ts`
- `app/api/voice/swml/bridge/route.ts` ⭐
- `app/api/voice/swml/outbound/route.ts` ⭐
- `app/api/voice/swml/shopper/route.ts` ⭐
- `app/api/voice/swml/survey/route.ts` ⭐
- `app/api/voice/swml/translation/route.ts` ⭐
- `app/api/voice/targets/route.ts`

## Webhooks (11)
- `app/api/webhooks/route.ts`
- `app/api/webhooks/assemblyai/route.ts`
- `app/api/webhooks/signalwire/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/webhooks/subscriptions/route.ts`
- `app/api/webhooks/subscriptions/[id]/route.ts`
- `app/api/webhooks/subscriptions/[id]/deliveries/route.ts`
- `app/api/webhooks/subscriptions/[id]/test/route.ts`
- `app/api/webhooks/survey/route.ts`
- `app/api/webhooks/[id]/route.ts`
- `app/api/webhooks/[id]/test/route.ts`

## WebRPC (1)
- `app/api/webrpc/route.ts`

## WebRTC (2)
- `app/api/webrtc/dial/route.ts`
- `app/api/webrtc/session/route.ts`

## Admin Routes (2)
- `app/api/_admin/auth-providers/route.ts`
- `app/api/_admin/signup/route.ts`

---

## SWML Routes (SignalWire Markup Language) ⭐

These 5 routes are critical for SignalWire AI Agent integration:

1. **`app/api/voice/swml/outbound/route.ts`** - Live translation calls with AI Agent
2. **`app/api/voice/swml/bridge/route.ts`** - WebRTC conference bridge with translation
3. **`app/api/voice/swml/survey/route.ts`** - AI Survey Bot for post-call feedback
4. **`app/api/voice/swml/shopper/route.ts`** - Secret Shopper AI Agent evaluations
5. **`app/api/voice/swml/translation/route.ts`** - Generic translation endpoint

---

## Categories by Count

| Category | Count |
|----------|-------|
| Voice Operations | 16 |
| Calls | 13 |
| Webhooks | 11 |
| Authentication | 7 |
| Integrations | 6 |
| Health Checks | 6 |
| Billing | 6 |
| Analytics | 5 |
| Campaigns | 4 |
| Cron Jobs | 4 |
| Attention System | 4 |
| Reports | 4 |
| Other (single routes) | 67 |

**Total: 153 route.ts files**
