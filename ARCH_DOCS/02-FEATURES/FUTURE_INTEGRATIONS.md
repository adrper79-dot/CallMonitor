# Wordis Bond Future Integrations Plan

**Date**: February 7, 2026  
**Status**: Planned (Post-Review/Audit)  
**Priority**: CRM → Mobile → IVR → Analytics → Exports

## Product Review Summary
Wordis Bond: Compliant voice AI platform ("System of Record for Business Conversations"). Features: Telnyx calls, AssemblyAI transcription/translation, ElevenLabs TTS/cloning, Bond AI (chat/alerts/copilot), campaigns/bookings/surveys/shopper, teams/RBAC, billing/usage, reports. Edge: Cloudflare Pages/Workers + Neon (120 tables, RLS/audit).

**Users**: SMB sales/service (10-200 emp), compliance-heavy (insurance/real estate).
**Problems Solved**: Call recording/analysis/compliance/automation.
**ICP**: $1-20M ARR sales orgs needing Gong.ai alternative ($29-99/user/mo).
**Market**: $5B voice AI, SMB gap.
**Costs**: Low ($300/mo base + usage).

## Prioritized Features
1. **CRM Integrations** (Hubspot/SF): Sync calls/leads bi-directional.
2. **Mobile App** (PWA/Native): Native calling/pushes.
3. **Inbound IVR**: Toll-free menus/surveys.
4. **Advanced Analytics**: Sentiment/ML trends.
5. **API Exports**: Zapier/Slack webhooks.

## Detailed Designs & Compliance
All: Workers routes (Zod/auth/rate-limit/audit), Neon snake_case/RLS, Hyperdrive/db.end(), secureHeaders/CSRF/idempotency.

### 1. CRM (Priority 1)
- **DB**: `crm_integrations` (org_id, crm_type, tokens), `synced_crm_contacts`.
- **Routes**: `/api/crm/connect` (OAuth), `/sync-calls`, `/webhook/crm-updated`.
- **Sync**: Scheduled cron (delta).
- **UI**: Settings > Integrations accordion/modal.
- **Compliance**: KV encrypt tokens, audit mutations.
- **Effort**: 2-3d (Hubspot MVP).

### 2. Mobile (Priority 2)
- **PWA MVP**: Manifest/service-worker (offline queue).
- **Native**: Expo RN + react-native-webrtc/phone-call/FCM.
- **Backend**: `/mobile/register-device`, scheduled pushes.
- **UI**: Mirror Dashboard, QR auth.
- **Compliance**: Permissions-Policy, device fingerprints.
- **Effort**: PWA 2d, RN 5d.

### 3. IVR
- **Telnyx DIDs** → Workers `/voice/inbound/{did}` → XML.
- **DB**: `inbound_configs`.
- **UI**: Settings > Numbers menu builder.
- **Compliance**: Disclosures/audit.
- **Effort**: 2d.

### 4. Analytics
- **Views**: `call_sentiment_view`.
- **ML**: Workers Vectorize.
- **UI**: Dashboard Trends tab (Recharts).
- **Compliance**: RLS aggregates.
- **Effort**: 3d.

### 5. Exports
- **Extend webhooks**: `/webhooks/zapier/{key}`.
- **Events**: pg_notify → fanout.
- **UI**: Settings form + per-report btn.
- **Compliance**: Sig verify.
- **Effort**: 1d.

## UI Interfaces
- **Settings**: Accordions/modals (shadcn, useRBAC).
- **Dashboard**: Widgets (SurveyAnalytics style, realtime).
- **Hooks**: useIntegrations (status/sync), toasts prog.

## Improvements
- Wizards/A-B UX.
- Queues scale.
- Adoption metrics.
- Offline PWA queue.
- Playwright e2e.

## Rollout
1. Migrations/tests/docs.
2. Lint/drift/rls-audit.
3. Deploy + smoke-test.
4. Monitor /usage.

**Next**: CRM MVP.