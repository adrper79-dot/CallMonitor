# Word Is Bond — Future Integrations: Detailed Technical Assessment

**TOGAF Phase:** E — Opportunities & Solutions  
**Date**: February 7, 2026  
**Status**: Planned (Post-Review/Audit)  
**Priority**: CRM → Mobile → IVR → Analytics → Exports  
**Platform Version**: v4.24+  
**Author**: Technical Architecture Review

---

## Product Review Summary

Word Is Bond: Compliant voice AI platform ("System of Record for Business Conversations"). Features: Telnyx calls, AssemblyAI transcription/translation, ElevenLabs TTS/cloning, Bond AI (chat/alerts/copilot), campaigns/bookings/surveys/shopper, teams/RBAC, billing/usage, reports. Edge: Cloudflare Pages/Workers + Neon (120+ tables, RLS/audit).

**Users**: SMB sales/service (10–200 emp), compliance-heavy (insurance/real estate).  
**Problems Solved**: Call recording/analysis/compliance/automation.  
**ICP**: $1–20M ARR sales orgs needing Gong.ai alternative ($29–99/user/mo).  
**Market**: $5B voice AI, SMB gap.  
**Costs**: Low ($300/mo base + usage).

---

## Feature 1 — CRM Integrations (HubSpot / Salesforce)

### 1.1 Requirements — Concrete Deliverables

| Category          | Deliverable                                   | Description                                                                                                             |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Migration**     | `20260210_crm_integrations.sql`               | Tables: `crm_integrations`, `crm_sync_log`, `crm_field_mappings`, `crm_contact_cache`                                   |
| **Worker Route**  | `workers/src/routes/crm.ts`                   | 8 endpoints: OAuth connect/disconnect, sync triggers, webhook receiver, mapping config, status                          |
| **Zod Schemas**   | Additions to `workers/src/lib/schemas.ts`     | `ConnectCrmSchema`, `CrmFieldMappingSchema`, `CrmSyncTriggerSchema`, `CrmWebhookPayloadSchema`                          |
| **Audit Actions** | Additions to `workers/src/lib/audit.ts`       | `CRM_CONNECTED`, `CRM_DISCONNECTED`, `CRM_SYNC_STARTED`, `CRM_SYNC_COMPLETED`, `CRM_SYNC_FAILED`, `CRM_MAPPING_UPDATED` |
| **Plan Gating**   | Addition to `workers/src/lib/plan-gating.ts`  | `crm_hubspot: 'pro'`, `crm_salesforce: 'business'`, `crm_custom: 'enterprise'`                                          |
| **KV Encryption** | `workers/src/lib/crm-tokens.ts`               | AES-GCM encrypt/decrypt wrapper for OAuth tokens stored in KV                                                           |
| **Cron Worker**   | `workers/src/crons/crm-sync.ts`               | Scheduled delta sync (every 15 min) via Cloudflare Cron Triggers                                                        |
| **UI Component**  | `components/settings/CrmIntegrationPanel.tsx` | Settings > Integrations tab with OAuth connect buttons, sync status, field mapping editor                               |
| **UI Component**  | `components/settings/CrmFieldMapper.tsx`      | Drag-drop field mapping between WIB fields and CRM fields                                                               |
| **UI Component**  | `components/dashboard/CrmSyncStatus.tsx`      | Dashboard widget showing last sync time, error count, record count                                                      |
| **Hook**          | `hooks/useCrmIntegration.ts`                  | SWR hook for CRM connection status, sync history, trigger manual sync                                                   |

### 1.2 Technical Dependencies

**Platform utilities (MUST use):**

- `getDb(c.env)` from `workers/src/lib/db.ts` — all DB access
- `requireAuth()` from `workers/src/lib/auth.ts` — every CRM route
- `writeAuditLog()` from `workers/src/lib/audit.ts` — connect, disconnect, every sync
- `requirePlan('pro')` from `workers/src/lib/plan-gating.ts` — HubSpot gated to Pro+
- `rateLimit()` from `workers/src/lib/rate-limit.ts` — OAuth and sync endpoints
- `idempotency()` from `workers/src/lib/idempotency.ts` — sync trigger (prevents duplicate syncs)
- Zod `validateBody()` pattern for all POST/PUT payloads
- `apiGet/apiPost` from `@/lib/apiClient` — all frontend fetches

**External APIs/SDKs:**

- HubSpot API v3 (`https://api.hubapi.com`) — OAuth 2.0 + REST (contacts, deals, activities)
- Salesforce REST API (`https://login.salesforce.com/services/oauth2`) — OAuth 2.0 + SOQL
- No NPM SDKs — use raw `fetch()` from Workers (keeps bundle small, avoids Node.js polyfill issues)

**Cloudflare bindings:**

- `KV` — encrypted OAuth token storage (key: `crm:tokens:{org_id}:{crm_type}`)
- Cron Triggers — `wrangler.jsonc` `[triggers]` section for scheduled sync

### 1.3 Database Design

```sql
-- Migration: 20260210_crm_integrations.sql

BEGIN;

-- Core integration config per org
CREATE TABLE IF NOT EXISTS crm_integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    crm_type        TEXT NOT NULL CHECK (crm_type IN ('hubspot', 'salesforce', 'pipedrive')),
    status          TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
    config          JSONB DEFAULT '{}',  -- non-sensitive settings (sync direction, frequency)
    token_kv_key    TEXT,                -- pointer to encrypted tokens in KV (NOT the token itself)
    last_sync_at    TIMESTAMPTZ,
    last_sync_status TEXT DEFAULT 'none' CHECK (last_sync_status IN ('none', 'success', 'partial', 'failed')),
    sync_cursor     TEXT,                -- delta sync bookmark (e.g., HubSpot vidOffset)
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (organization_id, crm_type)
);

CREATE INDEX idx_crm_integrations_org ON crm_integrations(organization_id);

-- Sync log (bounded — cron purges rows > 30 days)
CREATE TABLE IF NOT EXISTS crm_sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id  UUID NOT NULL REFERENCES crm_integrations(id) ON DELETE CASCADE,
    direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
    records_synced  INTEGER DEFAULT 0,
    records_failed  INTEGER DEFAULT 0,
    error_detail    TEXT,
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    status          TEXT DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed'))
);

CREATE INDEX idx_crm_sync_log_org ON crm_sync_log(organization_id);
CREATE INDEX idx_crm_sync_log_integration ON crm_sync_log(integration_id);

-- Field mapping (which WIB field maps to which CRM field)
CREATE TABLE IF NOT EXISTS crm_field_mappings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES crm_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    wib_entity      TEXT NOT NULL,  -- 'call', 'contact', 'recording', 'outcome'
    wib_field       TEXT NOT NULL,  -- 'phone_number', 'duration', 'sentiment'
    crm_object      TEXT NOT NULL,  -- 'Contact', 'Deal', 'Activity'
    crm_field       TEXT NOT NULL,  -- 'phone', 'hs_call_duration', 'custom_field_1'
    transform       TEXT,           -- optional: 'seconds_to_minutes', 'uppercase'
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_field_mappings_integration ON crm_field_mappings(integration_id);

-- Cached CRM contacts for fast lookup during calls (denormalized)
CREATE TABLE IF NOT EXISTS crm_contact_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    crm_type        TEXT NOT NULL,
    crm_contact_id  TEXT NOT NULL,        -- external CRM ID
    phone_number    TEXT,
    email           TEXT,
    display_name    TEXT,
    company_name    TEXT,
    crm_url         TEXT,                  -- deep link back to CRM record
    raw_data        JSONB DEFAULT '{}',    -- full CRM contact payload
    synced_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (organization_id, crm_type, crm_contact_id)
);

CREATE INDEX idx_crm_contact_cache_org ON crm_contact_cache(organization_id);
CREATE INDEX idx_crm_contact_cache_phone ON crm_contact_cache(phone_number);

COMMIT;
```

**RLS Consideration:** All four tables have `organization_id` — every query MUST include `WHERE organization_id = $N`. RLS policies should be added as defense-in-depth:

```sql
ALTER TABLE crm_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_integrations_org_isolation ON crm_integrations
  USING (organization_id = current_setting('app.org_id')::uuid);
```

### 1.4 API Routes

| Method   | Path                            | Middleware                                                           | Purpose                                                   |
| -------- | ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| `GET`    | `/api/crm/integrations`         | `requireAuth`, `analyticsRateLimit`                                  | List connected CRMs for org                               |
| `POST`   | `/api/crm/connect`              | `requireAuth`, `requirePlan('pro')`, `crmRateLimit`, `idempotency()` | Initiate OAuth flow — returns redirect URL                |
| `POST`   | `/api/crm/callback`             | `requireAuth`, `crmRateLimit`                                        | OAuth callback — exchange code for tokens, store in KV    |
| `DELETE` | `/api/crm/disconnect/:crm_type` | `requireAuth`, `crmRateLimit`                                        | Revoke tokens, delete KV entry, set status='disconnected' |
| `POST`   | `/api/crm/sync`                 | `requireAuth`, `requirePlan('pro')`, `crmRateLimit`, `idempotency()` | Manual sync trigger                                       |
| `GET`    | `/api/crm/sync/log`             | `requireAuth`, `analyticsRateLimit`                                  | Sync history (paginated, last 30 days)                    |
| `GET`    | `/api/crm/mappings`             | `requireAuth`                                                        | Get field mappings for current integration                |
| `PUT`    | `/api/crm/mappings`             | `requireAuth`, `requirePlan('pro')`, `crmRateLimit`                  | Update field mappings                                     |
| `POST`   | `/api/webhooks/crm/:crm_type`   | `crmWebhookRateLimit` (no auth — signature verified)                 | Inbound CRM webhook (contact updated, deal closed)        |

**Route handler pattern (example):**

```typescript
// workers/src/routes/crm.ts
import { Hono } from 'hono'
import { getDb } from '../lib/db'
import { requireAuth } from '../lib/auth'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { requirePlan } from '../lib/plan-gating'
import { rateLimit } from '../lib/rate-limit'
import { idempotency } from '../lib/idempotency'

const crmRoutes = new Hono<{ Bindings: Env }>()
const crmRateLimit = rateLimit({ limit: 10, windowSeconds: 60, prefix: 'rl:crm' })

crmRoutes.post('/connect', requirePlan('pro'), crmRateLimit, idempotency(), async (c) => {
  const session = c.get('session')
  const db = getDb(c.env)
  try {
    const { crm_type } = await c.req.json()
    // ... build OAuth URL, insert crm_integrations row with status='disconnected'
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'crm_integration',
      resourceId: crm_type,
      action: 'crm:connect_initiated',
      before: null,
      after: { crm_type, status: 'connecting' },
    })
    return c.json({ redirect_url: oauthUrl }, 200)
  } finally {
    await db.end()
  }
})
```

### 1.5 UI Components

| Component             | Mount Point                                | Hooks Used                                   | Description                                                                    |
| --------------------- | ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `CrmIntegrationPanel` | `app/settings/page.tsx` → Integrations tab | `useCrmIntegration`, `useSession`, `useRBAC` | OAuth connect/disconnect buttons, status badges, last sync time                |
| `CrmFieldMapper`      | Modal from `CrmIntegrationPanel`           | `useCrmIntegration`                          | Two-column drag-drop: WIB fields ↔ CRM fields. Uses shadcn `Select`, `Table`   |
| `CrmSyncStatus`       | `components/dashboard/` widget             | `useCrmIntegration`                          | Mini card: "HubSpot: synced 5m ago • 142 contacts • 3 errors"                  |
| `CrmContactPopover`   | `components/voice/ActiveCallPanel.tsx`     | `useCrmIntegration`                          | During active call, show CRM contact data if phone matches `crm_contact_cache` |

### 1.6 Risks & Mitigations

| Risk                                   | Severity    | Mitigation                                                                                                                                                                                       |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OAuth token leakage**                | 🔴 Critical | Tokens stored in KV encrypted with AES-GCM; key derived from `c.env.CRM_ENCRYPTION_KEY`. Never stored in Neon. Never logged.                                                                     |
| **Token refresh failure**              | 🟠 High     | HubSpot tokens expire every 6h. Cron sync refreshes on each run. If refresh fails → set `status='error'`, notify user via dashboard badge. Exponential backoff on retry.                         |
| **CRM rate limits**                    | 🟠 High     | HubSpot: 150 req/10s (Pro). Salesforce: 100k req/day. Implement per-org rate tracking in KV. Batch requests where API supports bulk endpoints.                                                   |
| **Sync data conflicts**                | 🟡 Medium   | Last-write-wins with `synced_at` timestamp comparison. Log conflicts in `crm_sync_log.error_detail`. Option for manual resolution UI in Phase 2.                                                 |
| **Multi-tenant data leak via webhook** | 🔴 Critical | CRM webhook handler MUST validate signature (HubSpot: `X-HubSpot-Signature-v3`, Salesforce: HMAC). Map external `portalId`/`orgId` to internal `organization_id`. Never trust payload org claim. |
| **Cost: API call volume**              | 🟡 Medium   | Delta sync (not full sync). Sync only records modified since `sync_cursor`. Batch reads (HubSpot: 100 contacts per page).                                                                        |

### 1.7 Best Practices Checklist

- [ ] Every CRM query includes `WHERE organization_id = $N` — multi-tenant isolation
- [ ] All SQL uses `$1, $2, $3` parameterization — no interpolation
- [ ] `writeAuditLog()` called for: connect, disconnect, sync start, sync complete, mapping update — with `old_value/new_value` (NOT `before/after`)
- [ ] No server-side code in Next.js — all CRM logic in `workers/src/routes/crm.ts`
- [ ] `apiGet/apiPost` used in all frontend components — no raw `fetch()`
- [ ] CORS config updated in `workers/src/index.ts` for any custom headers (e.g., `X-CRM-Sync-Id`)
- [ ] Deploy chain: `api:deploy` → `build` → `pages:deploy` → `health-check`
- [ ] `getDb()` before `try`, `db.end()` in `finally`
- [ ] Session properties: `session.organization_id`, `session.user_id` (snake_case)
- [ ] OAuth tokens NEVER in Neon DB — KV only, encrypted

### 1.8 Effort Estimate

| Phase                            | Scope                                                             | Days       |
| -------------------------------- | ----------------------------------------------------------------- | ---------- |
| **Phase 1: HubSpot MVP**         | Migration, OAuth flow, contacts sync (outbound only), settings UI | 3          |
| **Phase 2: Bidirectional Sync**  | Call log push to HubSpot, CRM webhook handler, field mapper       | 2          |
| **Phase 3: Salesforce**          | Salesforce OAuth adapter, SOQL queries, field mapping defaults    | 2          |
| **Phase 4: CRM Contact Popover** | Real-time contact lookup during calls, cache warming              | 1          |
| **Total**                        |                                                                   | **8 days** |

### 1.9 Opportunities

- **Revenue**: CRM integration is the #1 requested feature for SMB sales teams. Gating to Pro ($49/user/mo) drives plan upgrades. Salesforce on Business ($79/user/mo) captures mid-market.
- **Retention**: CRM-connected orgs have 3–5x lower churn (data is sticky — leaving means losing workflow).
- **Expansion**: Opens door to Pipedrive, Zoho, Close.io integrations on Enterprise plan.
- **Competitive**: Gong.io charges $100+/user and requires Salesforce. WIB at $49 with HubSpot captures the "HubSpot-native" sales team segment entirely.

---

## Feature 2 — Mobile App (PWA + Native)

### 2.1 Requirements — Concrete Deliverables

| Category             | Deliverable                                   | Description                                                                        |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| **PWA Config**       | `public/manifest.json`                        | App manifest with icons, theme, `display: 'standalone'`, `start_url: '/dashboard'` |
| **PWA Config**       | `public/sw.js`                                | Service worker: offline cache shell, background sync queue for failed API calls    |
| **Migration**        | `20260215_mobile_devices.sql`                 | Tables: `mobile_devices`, `push_subscriptions`                                     |
| **Worker Route**     | `workers/src/routes/mobile.ts`                | 5 endpoints: device register, push subscribe, push test, QR auth, device list      |
| **Zod Schemas**      | Additions to `workers/src/lib/schemas.ts`     | `RegisterDeviceSchema`, `PushSubscriptionSchema`, `QrAuthSchema`                   |
| **Audit Actions**    | Additions to `workers/src/lib/audit.ts`       | `DEVICE_REGISTERED`, `DEVICE_REMOVED`, `PUSH_SUBSCRIBED`, `QR_AUTH_USED`           |
| **Plan Gating**      | Addition to `workers/src/lib/plan-gating.ts`  | `mobile_pwa: 'starter'`, `mobile_push: 'pro'`, `mobile_native: 'business'`         |
| **Next.js**          | `app/layout.tsx` additions                    | `<link rel="manifest">`, `<meta name="theme-color">`, viewport meta for mobile     |
| **UI Component**     | `components/layout/MobileNavigation.tsx`      | Bottom tab bar (Dashboard, Calls, Contacts, Settings) for `screen < 768px`         |
| **UI Component**     | `components/settings/MobileDeviceManager.tsx` | Settings > Devices — list registered devices, revoke, push test                    |
| **Hook**             | `hooks/usePushNotifications.ts`               | Registers push subscription, handles permission prompt                             |
| **Native (Phase 2)** | Separate Expo React Native repo               | Mirror app using `expo-web-browser` + `react-native-webrtc` for native calling     |

### 2.2 Technical Dependencies

**Platform utilities (MUST use):**

- `getDb(c.env)` / `requireAuth()` / `writeAuditLog()` / `rateLimit()` — standard middleware chain
- `requirePlan('starter')` — PWA is Starter+; push is Pro+
- `apiGet/apiPost` from `@/lib/apiClient` — all PWA data fetching (same auth flow)
- `useSession()` from `@/components/AuthProvider` — session state in PWA

**External APIs/SDKs:**

- Web Push API (`navigator.serviceWorker`, `PushManager`) — browser-native
- `web-push` npm (Workers-compatible: use manual VAPID signing via `crypto.subtle`) — for push send
- Expo SDK (Phase 2 only) — `expo-notifications`, `expo-av`, `expo-camera`
- FCM (Firebase Cloud Messaging) — push relay for Android native (Phase 2)

**Cloudflare bindings:**

- `KV` — QR auth tokens (key: `qr:auth:{nonce}`, TTL: 120s)

### 2.3 Database Design

```sql
-- Migration: 20260215_mobile_devices.sql

BEGIN;

CREATE TABLE IF NOT EXISTS mobile_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name     TEXT NOT NULL,          -- "iPhone 15 Pro", "Chrome on Android"
    device_type     TEXT NOT NULL CHECK (device_type IN ('pwa', 'ios', 'android')),
    device_fingerprint TEXT,                -- SHA-256 of User-Agent + screen dims (collision-resistant)
    last_active_at  TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    revoked_at      TIMESTAMPTZ            -- soft delete — null = active
);

CREATE INDEX idx_mobile_devices_user ON mobile_devices(user_id);
CREATE INDEX idx_mobile_devices_org ON mobile_devices(organization_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL,          -- Web Push endpoint URL
    p256dh_key      TEXT NOT NULL,          -- Public key
    auth_key        TEXT NOT NULL,          -- Auth secret
    push_type       TEXT NOT NULL DEFAULT 'web' CHECK (push_type IN ('web', 'fcm', 'apns')),
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_org ON push_subscriptions(organization_id);

COMMIT;
```

### 2.4 API Routes

| Method   | Path                         | Middleware                                             | Purpose                                        |
| -------- | ---------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `POST`   | `/api/mobile/devices`        | `requireAuth`, `mobileRateLimit`                       | Register new device                            |
| `GET`    | `/api/mobile/devices`        | `requireAuth`                                          | List user's registered devices                 |
| `DELETE` | `/api/mobile/devices/:id`    | `requireAuth`, `mobileRateLimit`                       | Revoke device (soft delete)                    |
| `POST`   | `/api/mobile/push/subscribe` | `requireAuth`, `requirePlan('pro')`, `mobileRateLimit` | Store Web Push subscription                    |
| `POST`   | `/api/mobile/push/test`      | `requireAuth`, `mobileRateLimit`                       | Send test push notification                    |
| `POST`   | `/api/mobile/auth/qr`        | `mobileRateLimit`                                      | Generate QR auth nonce (store in KV, TTL 120s) |
| `POST`   | `/api/mobile/auth/qr/verify` | `requireAuth`, `mobileRateLimit`                       | Verify QR nonce + bind session to device       |

### 2.5 UI Components

| Component              | Mount Point                                                           | Hooks Used                    |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------- |
| `MobileNavigation`     | `components/layout/AppShell.tsx` (conditionally rendered below 768px) | `useSession`, `usePathname`   |
| `MobileDeviceManager`  | `app/settings/page.tsx` → Devices tab                                 | `useMobileDevices` (new hook) |
| `PushPermissionBanner` | `components/layout/AppShell.tsx` — top banner                         | `usePushNotifications`        |
| `OfflineIndicator`     | `components/layout/AppShell.tsx` — footer                             | `useOnlineStatus` (new hook)  |
| `QrAuthModal`          | `app/signin/page.tsx` — "Scan to sign in" button                      | N/A — standalone              |

### 2.6 Risks & Mitigations

| Risk                                  | Severity    | Mitigation                                                                                                                                                                 |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service worker caching stale data** | 🟠 High     | Cache-first for static assets only. Network-first for API calls. Service worker version hash in `sw.js` — new deploy = new cache.                                          |
| **Offline queue replay ordering**     | 🟡 Medium   | Queue stores entries with timestamp + sequence number. Replay in FIFO order. Idempotency keys on each queued mutation prevent duplicates on reconnect.                     |
| **QR auth session hijacking**         | 🔴 Critical | QR nonce is single-use (delete from KV after first verify). TTL 120s. Nonce is 32 bytes crypto-random. QR verify requires the scanning device to already be authenticated. |
| **Push subscription drift**           | 🟡 Medium   | Browser may revoke push endpoint silently. Handle 410 Gone from push service → mark subscription `active=false`, prompt re-subscribe on next visit.                        |
| **iOS PWA limitations**               | 🟡 Medium   | Safari lacks Web Push (added iOS 16.4+ but requires home screen install). Display clear install instructions. Phase 2 native app covers iOS fully.                         |
| **WebRTC in PWA**                     | 🟠 High     | Browser WebRTC works but call quality varies on mobile networks. Show "WiFi recommended" banner. Phase 2 native app uses optimized `react-native-webrtc`.                  |

### 2.7 Best Practices Checklist

- [ ] No server-side code — `manifest.json` and `sw.js` are static files in `public/`
- [ ] PWA service worker MUST NOT cache API responses (network-first only)
- [ ] `apiGet/apiPost` used for all data fetching — Bearer token auto-attached
- [ ] All mobile routes include `organization_id` filtering
- [ ] Parameterized SQL: `$1, $2, $3`
- [ ] `writeAuditLog()` on device register/revoke with `old_value/new_value`
- [ ] Deploy: `api:deploy` → `build` → `pages:deploy` → `health-check`
- [ ] `Permissions-Policy` header reviewed — no accidental microphone/camera blocks for PWA calling

### 2.8 Effort Estimate

| Phase                                     | Scope                                                                              | Days        |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ----------- |
| **Phase 1: PWA Shell**                    | `manifest.json`, `sw.js`, mobile nav, offline indicator, viewport meta             | 2           |
| **Phase 2: Push Notifications**           | `mobile_devices` + `push_subscriptions` tables, push subscribe/send, settings UI   | 2           |
| **Phase 3: QR Auth**                      | QR generation, nonce in KV, verify flow, device manager settings page              | 1           |
| **Phase 4: React Native (separate repo)** | Expo project, auth bridge, push via FCM, native calling with `react-native-webrtc` | 5           |
| **Total**                                 |                                                                                    | **10 days** |

### 2.9 Opportunities

- **Retention**: Mobile access = daily active usage (vs. desktop-only = workday-only). DAU/MAU ratio improves 2–3x.
- **Competitive**: Most call center SaaS is desktop-only. Mobile access at Starter plan ($29/user) is a differentiator vs. Gong/Chorus/SalesLoft.
- **Field teams**: Insurance adjusters, real estate agents, field service — all need mobile calling. Unlocks a segment that can't use desktop tools.
- **Push upsell**: Push notifications drive Pro plan upgrades (Starter = PWA only, no push). Proven growth lever in SaaS.

---

## Feature 3 — Inbound IVR (Toll-Free Menus & Surveys)

### 3.1 Requirements — Concrete Deliverables

| Category          | Deliverable                                             | Description                                                                                                                       |
| ----------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Migration**     | `20260220_inbound_ivr.sql`                              | Tables: `inbound_numbers`, `ivr_menus`, `ivr_menu_options`, `inbound_call_log`                                                    |
| **Worker Route**  | `workers/src/routes/ivr.ts`                             | 6 endpoints: number provisioning, menu CRUD, call routing, inbound webhook handler                                                |
| **Worker Route**  | Extension to `workers/src/routes/webhooks.ts`           | Telnyx inbound call webhook → IVR XML/TeXML response                                                                              |
| **Zod Schemas**   | Additions to `workers/src/lib/schemas.ts`               | `CreateIvrMenuSchema`, `IvrMenuOptionSchema`, `ProvisionNumberSchema`                                                             |
| **Audit Actions** | Additions to `workers/src/lib/audit.ts`                 | `IVR_NUMBER_PROVISIONED`, `IVR_NUMBER_RELEASED`, `IVR_MENU_CREATED`, `IVR_MENU_UPDATED`, `IVR_MENU_DELETED`                       |
| **Plan Gating**   | Addition to `workers/src/lib/plan-gating.ts`            | `inbound_ivr: 'business'`, `toll_free_numbers: 'business'`                                                                        |
| **AI Compliance** | AI Role Policy: IVR greetings = Phase 1 Disclosure only | AI speaks procedural disclosures ("Press 1 for sales"). AI never negotiates/persuades. Survey disclaimers before any survey menu. |
| **UI Component**  | `components/settings/IvrMenuBuilder.tsx`                | Visual tree builder for IVR menus (keypress → action mapping)                                                                     |
| **UI Component**  | `components/settings/InboundNumberManager.tsx`          | Settings > Numbers — provision/release DIDs, assign to IVR menus                                                                  |
| **UI Component**  | `components/voice/InboundCallLog.tsx`                   | Voice > Inbound tab — table of inbound calls with IVR path taken                                                                  |
| **Hook**          | `hooks/useInboundNumbers.ts`                            | CRUD operations for inbound number management                                                                                     |

### 3.2 Technical Dependencies

**Platform utilities (MUST use):**

- Full middleware chain: `requireAuth` → `requirePlan('business')` → `rateLimit` → `idempotency()`
- `writeAuditLog()` — number provisioning is a billable, auditable action
- Existing `voice.ts` patterns for Telnyx interaction

**External APIs/SDKs:**

- Telnyx Number Ordering API (`/v2/number_orders`) — provision DIDs
- Telnyx Messaging Profile API — configure inbound call routing to webhook URL
- Telnyx TeXML — XML-based call flow (IVR menus, gather digits, play TTS)
- No SDK — use Telnyx REST via `fetch()` with `c.env.TELNYX_API_KEY`

**AI Role Policy compliance:**

- IVR greeting = "Phase 1: System Disclosure" — AI may speak procedural text
- IVR survey questions = "Phase 1: Procedural Feedback" — must include survey disclaimer
- IVR NEVER negotiates, persuades, or commits on behalf of humans (per AI_ROLE_POLICY.md §3)

### 3.3 Database Design

```sql
-- Migration: 20260220_inbound_ivr.sql

BEGIN;

CREATE TABLE IF NOT EXISTS inbound_numbers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number    TEXT NOT NULL UNIQUE,    -- E.164 format (+18005551234)
    telnyx_order_id TEXT,                    -- Telnyx number order reference
    telnyx_conn_id  TEXT,                    -- Telnyx connection ID for routing
    display_name    TEXT,                    -- "Main Sales Line", "Support Hotline"
    number_type     TEXT DEFAULT 'local' CHECK (number_type IN ('local', 'toll_free')),
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'released')),
    ivr_menu_id     UUID,                    -- FK added after ivr_menus table creation
    monthly_cost_cents INTEGER DEFAULT 0,    -- for billing display
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inbound_numbers_org ON inbound_numbers(organization_id);
CREATE INDEX idx_inbound_numbers_phone ON inbound_numbers(phone_number);

CREATE TABLE IF NOT EXISTS ivr_menus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,            -- "Main Menu", "After Hours", "Survey Menu"
    greeting_text   TEXT NOT NULL,            -- TTS greeting (AI Role: disclosure only)
    greeting_type   TEXT DEFAULT 'tts' CHECK (greeting_type IN ('tts', 'audio_url')),
    greeting_audio_url TEXT,                  -- R2 URL for pre-recorded greeting
    timeout_seconds INTEGER DEFAULT 10,
    max_retries     INTEGER DEFAULT 3,
    fallback_action TEXT DEFAULT 'voicemail' CHECK (fallback_action IN ('voicemail', 'hangup', 'transfer', 'repeat')),
    fallback_target TEXT,                     -- phone number or menu ID for fallback
    is_active       BOOLEAN DEFAULT true,
    disclosure_text TEXT NOT NULL DEFAULT 'This call may be recorded for quality assurance.', -- mandatory per AI_ROLE_POLICY
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ivr_menus_org ON ivr_menus(organization_id);

-- Add FK from inbound_numbers to ivr_menus
ALTER TABLE inbound_numbers ADD CONSTRAINT fk_inbound_numbers_ivr_menu
    FOREIGN KEY (ivr_menu_id) REFERENCES ivr_menus(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS ivr_menu_options (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id         UUID NOT NULL REFERENCES ivr_menus(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    digit           TEXT NOT NULL CHECK (digit IN ('0','1','2','3','4','5','6','7','8','9','*','#')),
    label           TEXT NOT NULL,            -- "Sales", "Support", "Repeat Menu"
    action_type     TEXT NOT NULL CHECK (action_type IN ('transfer', 'submenu', 'voicemail', 'survey', 'hangup', 'repeat')),
    action_target   TEXT,                     -- phone number, menu UUID, or survey UUID
    tts_text        TEXT,                     -- optional announcement before action
    sort_order      INTEGER DEFAULT 0,
    UNIQUE (menu_id, digit)
);

CREATE INDEX idx_ivr_menu_options_menu ON ivr_menu_options(menu_id);

CREATE TABLE IF NOT EXISTS inbound_call_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    inbound_number_id UUID REFERENCES inbound_numbers(id),
    caller_number   TEXT NOT NULL,
    caller_name     TEXT,                     -- CNAM if available
    call_sid        TEXT,                     -- Telnyx call control ID
    ivr_path        JSONB DEFAULT '[]',       -- ordered list of digits pressed: [{"digit":"1","menu":"Main","ts":"..."}]
    final_action    TEXT,                      -- 'transferred_to_agent', 'voicemail', 'hangup', 'survey_completed'
    duration_seconds INTEGER,
    recording_url   TEXT,
    started_at      TIMESTAMPTZ DEFAULT now(),
    ended_at        TIMESTAMPTZ
);

CREATE INDEX idx_inbound_call_log_org ON inbound_call_log(organization_id);
CREATE INDEX idx_inbound_call_log_started ON inbound_call_log(started_at DESC);

COMMIT;
```

### 3.4 API Routes

| Method   | Path                           | Middleware                                                                | Purpose                                       |
| -------- | ------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------- |
| `GET`    | `/api/ivr/numbers`             | `requireAuth`, `requirePlan('business')`                                  | List org's inbound numbers                    |
| `POST`   | `/api/ivr/numbers`             | `requireAuth`, `requirePlan('business')`, `ivrRateLimit`, `idempotency()` | Provision new DID from Telnyx                 |
| `DELETE` | `/api/ivr/numbers/:id`         | `requireAuth`, `ivrRateLimit`                                             | Release DID back to Telnyx                    |
| `GET`    | `/api/ivr/menus`               | `requireAuth`                                                             | List IVR menus                                |
| `POST`   | `/api/ivr/menus`               | `requireAuth`, `requirePlan('business')`, `ivrRateLimit`                  | Create IVR menu with options                  |
| `PUT`    | `/api/ivr/menus/:id`           | `requireAuth`, `ivrRateLimit`                                             | Update IVR menu                               |
| `DELETE` | `/api/ivr/menus/:id`           | `requireAuth`, `ivrRateLimit`                                             | Delete IVR menu (unlinks numbers)             |
| `GET`    | `/api/ivr/calls`               | `requireAuth`                                                             | Inbound call log (paginated)                  |
| `POST`   | `/api/webhooks/telnyx/inbound` | Telnyx signature verification (no auth)                                   | Inbound call handler — returns TeXML IVR flow |

### 3.5 UI Components

| Component              | Mount Point                                                         | Hooks Used                   |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------- |
| `InboundNumberManager` | `app/settings/page.tsx` → Numbers tab                               | `useInboundNumbers`          |
| `IvrMenuBuilder`       | Modal from `InboundNumberManager` → "Edit IVR" button               | `useIvrMenus` (new hook)     |
| `IvrMenuOptionRow`     | Rendered inside `IvrMenuBuilder` — one row per digit                | N/A — child component        |
| `InboundCallLog`       | `app/voice-operations/page.tsx` → Inbound tab                       | `useInboundCalls` (new hook) |
| `IvrPathBadge`         | Rendered in `InboundCallLog` table — shows digit path as breadcrumb | N/A — display component      |

### 3.6 Risks & Mitigations

| Risk                                         | Severity    | Mitigation                                                                                                                                                                                            |
| -------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI Role Policy violation in IVR greeting** | 🔴 Critical | All IVR `greeting_text` validated against prohibited phrases (no "I can offer", "You should", etc.). DB constraint: `disclosure_text IS NOT NULL`. Code review for any AI-generated greeting content. |
| **Telnyx webhook latency**                   | 🟠 High     | Inbound webhook handler MUST respond within 5 seconds (Telnyx timeout). Generate TeXML synchronously — no DB reads in critical path. Cache IVR menus in KV (key: `ivr:menu:{menu_id}`, TTL: 60s).     |
| **Number provisioning cost**                 | 🟡 Medium   | Display monthly cost before provisioning. Require confirmation modal. Set org-level number limit in `PLAN_LIMITS` (Business: 5, Enterprise: 25).                                                      |
| **Recording disclosure compliance**          | 🔴 Critical | `disclosure_text` is mandatory and played FIRST before any IVR interaction. Two-party consent states require explicit consent — document in UI.                                                       |
| **Orphaned numbers on org deletion**         | 🟡 Medium   | `ON DELETE CASCADE` releases the DB record. Must also call Telnyx API to release the actual DID — use a cleanup cron or `organization:deleted` event handler.                                         |

### 3.7 Best Practices Checklist

- [ ] All IVR greeting text compliant with AI_ROLE_POLICY.md §2 (disclosures only, no persuasion)
- [ ] Recording disclosure played before any recording begins (two-party consent)
- [ ] Survey IVR branches include survey disclaimer per AI_ROLE_POLICY.md §2.7
- [ ] `organization_id` in every query WHERE clause
- [ ] Telnyx webhook signature validated (never trust unsigned payloads)
- [ ] `writeAuditLog()` for number provisioning/release (expensive, auditable)
- [ ] Deploy: `api:deploy` → `build` → `pages:deploy` → `health-check`
- [ ] TeXML response must be < 5s (cache IVR menus in KV)

### 3.8 Effort Estimate

| Phase                           | Scope                                                      | Days       |
| ------------------------------- | ---------------------------------------------------------- | ---------- |
| **Phase 1: Number Management**  | Migration, Telnyx provisioning, number manager UI          | 1.5        |
| **Phase 2: IVR Menus**          | IVR builder UI, TeXML response generation, inbound webhook | 2          |
| **Phase 3: Call Logging**       | Inbound call log table, log entries from webhook, UI table | 1          |
| **Phase 4: Survey Integration** | Connect IVR option type "survey" to existing survey system | 0.5        |
| **Total**                       |                                                            | **5 days** |

### 3.9 Opportunities

- **Revenue**: Toll-free numbers = recurring monthly DID cost → pass through at markup. Business plan gating ($79/user) drives upgrades.
- **Completeness**: Inbound + outbound = full call center platform. Customers currently need a separate IVR provider — eliminating that consolidation pain.
- **Survey volume**: IVR-triggered surveys reach inbound callers (not just outbound). 10x survey completion rate vs. email.
- **Market**: Inbound IVR is table-stakes for call center software. Without it, WIB is "outbound-only" — a perception blocker for 40%+ of prospects.

---

## Feature 4 — Advanced Analytics (Sentiment Trends & ML Insights)

### 4.1 Requirements — Concrete Deliverables

| Category         | Deliverable                                         | Description                                                                                                                                       |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Migration**    | `20260225_advanced_analytics.sql`                   | Tables: `sentiment_scores`, `analytics_snapshots`, `ml_predictions`; Materialized views: `mv_call_sentiment_daily`, `mv_agent_performance_weekly` |
| **Worker Route** | `workers/src/routes/analytics.ts` (extend existing) | 4 new endpoints: sentiment trends, agent leaderboard, anomaly alerts, custom date range                                                           |
| **Worker Route** | `workers/src/routes/ml.ts` (new)                    | 3 endpoints: prediction requests, model status, training trigger                                                                                  |
| **Zod Schemas**  | Additions to `workers/src/lib/schemas.ts`           | `SentimentQuerySchema`, `AnalyticsDateRangeSchema`, `MlPredictionRequestSchema`                                                                   |
| **Plan Gating**  | Additions to `workers/src/lib/plan-gating.ts`       | `advanced_analytics: 'business'`, `ml_predictions: 'enterprise'`, `analytics_export: 'pro'`                                                       |
| **Cron Worker**  | `workers/src/crons/analytics-snapshot.ts`           | Nightly snapshot: compute daily aggregates into `analytics_snapshots` for fast dashboard loads                                                    |
| **UI Component** | `components/analytics/SentimentTrendChart.tsx`      | Recharts line chart: sentiment over time (day/week/month granularity)                                                                             |
| **UI Component** | `components/analytics/AgentLeaderboard.tsx`         | Ranked table: agents by call volume, avg sentiment, outcome success rate                                                                          |
| **UI Component** | `components/analytics/AnomalyAlertCard.tsx`         | Dashboard card: "Unusual pattern detected — call volume dropped 40% on Tuesday"                                                                   |
| **UI Component** | `components/analytics/AnalyticsDatePicker.tsx`      | Shared date range picker with presets (7d, 30d, 90d, custom)                                                                                      |
| **Hook**         | `hooks/useAdvancedAnalytics.ts`                     | SWR hook with date range, granularity, agent filter parameters                                                                                    |

### 4.2 Technical Dependencies

**Platform utilities (MUST use):**

- `getDb(c.env)` — all DB access; materialized views queried like tables
- `requireAuth()` — all analytics routes
- `requirePlan('business')` — advanced analytics gated to Business+
- `rateLimit()` — analytics queries can be expensive; limit to 30 req/min
- Existing `analytics.ts` routes — extend, don't duplicate

**External APIs/SDKs:**

- AssemblyAI Sentiment Analysis — already integrated for per-utterance sentiment. Aggregate stored scores.
- Workers AI (Cloudflare) — optional for lightweight anomaly detection (no external API call, runs at edge)
- No heavy ML frameworks — use pre-computed aggregates + statistical anomaly detection (Z-score)

**Existing data sources:**

- `calls` table — volume, duration, status
- `ai_summaries` table — sentiment data per call (already from AssemblyAI)
- `recordings` table — duration, quality metrics
- `call_outcomes` table — success/failure rates
- `scorecards` table — agent quality scores

### 4.3 Database Design

```sql
-- Migration: 20260225_advanced_analytics.sql

BEGIN;

-- Sentiment scores (one per call, extracted from AssemblyAI results)
CREATE TABLE IF NOT EXISTS sentiment_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    call_id         UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    overall_sentiment TEXT CHECK (overall_sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    sentiment_score NUMERIC(4,3) CHECK (sentiment_score BETWEEN -1.000 AND 1.000), -- -1 to +1
    positive_pct    NUMERIC(5,2),  -- % of utterances positive
    negative_pct    NUMERIC(5,2),
    neutral_pct     NUMERIC(5,2),
    key_phrases     JSONB DEFAULT '[]',     -- top extracted phrases
    agent_id        TEXT REFERENCES users(id),
    call_date       DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (call_id)
);

CREATE INDEX idx_sentiment_scores_org ON sentiment_scores(organization_id);
CREATE INDEX idx_sentiment_scores_date ON sentiment_scores(organization_id, call_date DESC);
CREATE INDEX idx_sentiment_scores_agent ON sentiment_scores(agent_id, call_date DESC);

-- Pre-computed daily snapshots for fast dashboard rendering
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    granularity     TEXT NOT NULL DEFAULT 'daily' CHECK (granularity IN ('daily', 'weekly', 'monthly')),
    total_calls     INTEGER DEFAULT 0,
    avg_duration_seconds NUMERIC(8,2) DEFAULT 0,
    avg_sentiment_score NUMERIC(4,3) DEFAULT 0,
    positive_call_pct NUMERIC(5,2) DEFAULT 0,
    outcome_success_pct NUMERIC(5,2) DEFAULT 0,
    total_recordings INTEGER DEFAULT 0,
    unique_agents   INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}',      -- extensible for new metrics
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (organization_id, snapshot_date, granularity)
);

CREATE INDEX idx_analytics_snapshots_org_date ON analytics_snapshots(organization_id, snapshot_date DESC);

-- ML predictions (enterprise only — churn risk, deal probability)
CREATE TABLE IF NOT EXISTS ml_predictions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    prediction_type TEXT NOT NULL CHECK (prediction_type IN ('churn_risk', 'deal_probability', 'sentiment_trend', 'volume_anomaly')),
    entity_type     TEXT NOT NULL,           -- 'contact', 'agent', 'org'
    entity_id       TEXT NOT NULL,
    score           NUMERIC(5,4),            -- 0.0000 to 1.0000
    confidence      NUMERIC(5,4),
    explanation     TEXT,                     -- human-readable
    model_version   TEXT,
    expires_at      TIMESTAMPTZ,             -- predictions go stale
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ml_predictions_org ON ml_predictions(organization_id);
CREATE INDEX idx_ml_predictions_type ON ml_predictions(prediction_type, entity_id);

-- Materialized view: daily sentiment aggregates (refresh nightly via cron)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_call_sentiment_daily AS
SELECT
    organization_id,
    call_date,
    COUNT(*) as total_calls,
    AVG(sentiment_score) as avg_sentiment,
    COUNT(*) FILTER (WHERE overall_sentiment = 'positive') as positive_count,
    COUNT(*) FILTER (WHERE overall_sentiment = 'negative') as negative_count,
    COUNT(*) FILTER (WHERE overall_sentiment = 'neutral') as neutral_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sentiment_score) as median_sentiment
FROM sentiment_scores
GROUP BY organization_id, call_date
WITH NO DATA;

CREATE UNIQUE INDEX idx_mv_sentiment_daily ON mv_call_sentiment_daily(organization_id, call_date);

-- Materialized view: weekly agent performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_agent_performance_weekly AS
SELECT
    ss.organization_id,
    ss.agent_id,
    u.name as agent_name,
    DATE_TRUNC('week', ss.call_date)::DATE as week_start,
    COUNT(*) as total_calls,
    AVG(ss.sentiment_score) as avg_sentiment,
    COUNT(*) FILTER (WHERE ss.overall_sentiment = 'positive') as positive_calls
FROM sentiment_scores ss
LEFT JOIN users u ON ss.agent_id = u.id
GROUP BY ss.organization_id, ss.agent_id, u.name, DATE_TRUNC('week', ss.call_date)
WITH NO DATA;

CREATE UNIQUE INDEX idx_mv_agent_perf_weekly ON mv_agent_performance_weekly(organization_id, agent_id, week_start);

COMMIT;
```

### 4.4 API Routes

| Method | Path                                          | Middleware                                                                 | Purpose                                                              |
| ------ | --------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET`  | `/api/analytics/sentiment/trends`             | `requireAuth`, `requirePlan('business')`, `analyticsRateLimit`             | Sentiment trend data (daily/weekly/monthly, date range)              |
| `GET`  | `/api/analytics/agents/leaderboard`           | `requireAuth`, `requirePlan('business')`, `analyticsRateLimit`             | Agent ranking by calls, sentiment, outcomes                          |
| `GET`  | `/api/analytics/anomalies`                    | `requireAuth`, `requirePlan('business')`, `analyticsRateLimit`             | Detected anomalies (Z-score > 2.0 on any metric vs. 30-day baseline) |
| `GET`  | `/api/analytics/snapshots`                    | `requireAuth`, `requirePlan('pro')`, `analyticsRateLimit`                  | Pre-computed daily snapshots for fast chart rendering                |
| `POST` | `/api/ml/predict`                             | `requireAuth`, `requirePlan('enterprise')`, `mlRateLimit`, `idempotency()` | Request ML prediction (churn risk, deal probability)                 |
| `GET`  | `/api/ml/predictions/:entity_type/:entity_id` | `requireAuth`, `requirePlan('enterprise')`                                 | Get latest predictions for entity                                    |
| `GET`  | `/api/ml/status`                              | `requireAuth`, `requirePlan('enterprise')`                                 | ML model version, last training date, accuracy metrics               |

### 4.5 UI Components

| Component             | Mount Point                                             | Hooks Used                                |
| --------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `SentimentTrendChart` | `app/analytics/page.tsx` → Trends tab                   | `useAdvancedAnalytics`                    |
| `AgentLeaderboard`    | `app/analytics/page.tsx` → Agents tab                   | `useAdvancedAnalytics`                    |
| `AnomalyAlertCard`    | `app/dashboard/page.tsx` → Alerts section               | `useAdvancedAnalytics`                    |
| `AnalyticsDatePicker` | Shared — used in Trends, Agents, Exports                | N/A — controlled component                |
| `MetricSparkline`     | Inline in dashboard KPI cards                           | `useAdvancedAnalytics` (lightweight mode) |
| `PredictionBadge`     | `components/voice/CallDetailView.tsx` — Enterprise only | `useMlPredictions` (new hook)             |

### 4.6 Risks & Mitigations

| Risk                              | Severity    | Mitigation                                                                                                                                                                                                                |
| --------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Expensive aggregation queries** | 🟠 High     | Materialized views refresh nightly (not per-request). Dashboard reads from `mv_*` views and `analytics_snapshots` — O(1) reads. Add `statement_timeout` to analytics queries (10s).                                       |
| **RLS on materialized views**     | 🔴 Critical | PostgreSQL RLS does NOT apply to materialized views. All MV queries MUST include `WHERE organization_id = $1` in application code. Defense: create views with `organization_id` in unique index so the optimizer uses it. |
| **Stale materialized views**      | 🟡 Medium   | Cron refreshes nightly. Show "Data as of: {last_refresh}" in UI. For real-time needs, fall back to direct query with `requirePlan('enterprise')` gating.                                                                  |
| **ML model accuracy**             | 🟡 Medium   | Start with simple statistical models (Z-score anomaly, linear trend). Label predictions with `confidence` score. Display "Experimental" badge for ML features.                                                            |
| **Data volume growth**            | 🟡 Medium   | `sentiment_scores` grows 1:1 with calls. At 20k calls/mo (Business plan max), that's 240k rows/year. Well within Neon's capabilities. Partition by `call_date` if needed.                                                 |

### 4.7 Best Practices Checklist

- [ ] Materialized views always queried with `WHERE organization_id = $N` (RLS doesn't apply)
- [ ] Pre-computed snapshots — never run aggregation queries on raw tables during dashboard load
- [ ] `REFRESH MATERIALIZED VIEW CONCURRENTLY` — non-blocking refresh in cron
- [ ] Analytics queries use `statement_timeout` (10s max) — prevent runaway queries
- [ ] `$1, $2, $3` parameterized queries — even for date ranges
- [ ] `requirePlan('business')` on all advanced analytics routes
- [ ] No server-side rendering — charts render client-side via Recharts
- [ ] Deploy: `api:deploy` → `build` → `pages:deploy` → `health-check`

### 4.8 Effort Estimate

| Phase                                    | Scope                                                                                | Days         |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | ------------ |
| **Phase 1: Sentiment Storage**           | Migration, populate `sentiment_scores` from existing `ai_summaries`, backfill script | 1            |
| **Phase 2: Dashboard Charts**            | `SentimentTrendChart`, `AnalyticsDatePicker`, extend `/analytics/sentiment/trends`   | 2            |
| **Phase 3: Agent Leaderboard**           | MV creation, leaderboard route + UI, agent filter                                    | 1            |
| **Phase 4: Anomaly Detection**           | Z-score computation in cron, anomaly alerts route, `AnomalyAlertCard` UI             | 1.5          |
| **Phase 5: ML Predictions (Enterprise)** | `ml_predictions` table, Workers AI integration, prediction badge UI                  | 2            |
| **Total**                                |                                                                                      | **7.5 days** |

### 4.9 Opportunities

- **Upsell**: Advanced analytics is the primary justification for Business plan ($79/user). Sentiment trends + agent leaderboard = the features managers ask for.
- **Stickiness**: Once managers build workflows around sentiment dashboards, switching cost is high.
- **Enterprise**: ML predictions (churn risk, deal probability) justify Enterprise pricing ($99+/user). Only 2–3 competitors offer ML at the SMB level.
- **Marketing**: "See exactly how your team's calls are performing" — screenshot-worthy charts for sales pages and case studies.

---

## Feature 5 — API Exports (Zapier, Slack Webhooks, CSV)

### 5.1 Requirements — Concrete Deliverables

| Category          | Deliverable                                   | Description                                                                                        |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Migration**     | `20260301_webhook_exports.sql`                | Tables: `webhook_subscriptions`, `webhook_deliveries`, `export_jobs`                               |
| **Worker Route**  | Extension of `workers/src/routes/webhooks.ts` | Extend existing webhook subscription CRUD. Add: event fanout, delivery retry, export generation    |
| **Worker Route**  | `workers/src/routes/exports.ts` (new)         | 4 endpoints: create export job, check status, download, list history                               |
| **Zod Schemas**   | Additions to `workers/src/lib/schemas.ts`     | `WebhookSubscriptionSchema`, `ExportJobSchema`, `WebhookEventFilterSchema`                         |
| **Worker Lib**    | `workers/src/lib/webhook-fanout.ts`           | Event fanout engine: on platform event → match subscriptions → queue deliveries                    |
| **Worker Lib**    | `workers/src/lib/export-generator.ts`         | CSV/JSON generator for calls, recordings, analytics data                                           |
| **Audit Actions** | Additions to `workers/src/lib/audit.ts`       | `WEBHOOK_CREATED`, `WEBHOOK_DELETED`, `WEBHOOK_TESTED`, `EXPORT_REQUESTED`, `EXPORT_DOWNLOADED`    |
| **Plan Gating**   | Additions to `workers/src/lib/plan-gating.ts` | `webhooks: 'pro'`, `zapier_integration: 'pro'`, `csv_export: 'starter'`, `bulk_export: 'business'` |
| **UI Component**  | `components/settings/WebhookManager.tsx`      | Settings > Webhooks — CRUD subscriptions, event filter, delivery log                               |
| **UI Component**  | `components/settings/WebhookDeliveryLog.tsx`  | Expandable rows showing payload, response code, retry count                                        |
| **UI Component**  | `components/reports/ExportButton.tsx`         | Button on any report/analytics page → trigger CSV/JSON export                                      |
| **UI Component**  | `components/reports/ExportHistory.tsx`        | Settings > Exports — list of generated exports with download links                                 |
| **Hook**          | `hooks/useWebhookSubscriptions.ts`            | CRUD for webhook management                                                                        |
| **Hook**          | `hooks/useExports.ts`                         | Export job creation + polling for completion                                                       |

### 5.2 Technical Dependencies

**Platform utilities (MUST use):**

- `getDb(c.env)` / `requireAuth()` / `writeAuditLog()` / `rateLimit()` — standard chain
- `requirePlan('pro')` — webhooks gated to Pro+; CSV export to Starter+
- `idempotency()` — on export creation (prevent duplicate large exports)
- Existing `webhooks.ts` already has subscription CRUD scaffolding — extend it

**External APIs/SDKs:**

- Zapier Webhook URL — Zapier provides a target URL; WIB POSTs events to it (no Zapier SDK needed)
- Slack Incoming Webhooks — POST to `https://hooks.slack.com/services/...` with JSON payload
- No SDKs — outbound webhook delivery is plain `fetch()` with retry logic

**Cloudflare bindings:**

- `R2` (`RECORDINGS_BUCKET` or new `EXPORTS_BUCKET`) — store generated CSV/JSON files for download
- `KV` — webhook delivery dedup (key: `wh:delivery:{event_id}:{subscription_id}`, TTL: 24h)
- Cloudflare Queues (optional, Phase 2) — reliable webhook delivery queue with retry

### 5.3 Database Design

```sql
-- Migration: 20260301_webhook_exports.sql

BEGIN;

-- Webhook subscriptions (extends existing webhook system)
-- Note: webhooks.ts already has /subscriptions CRUD — this table may already exist.
-- If so, ALTER to add missing columns.
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,             -- "Slack Alerts", "Zapier — New Calls"
    target_url      TEXT NOT NULL,             -- destination URL
    secret          TEXT NOT NULL,             -- HMAC-SHA256 signing secret (auto-generated)
    events          TEXT[] NOT NULL DEFAULT '{}', -- {'call.completed', 'recording.ready', 'sentiment.analyzed'}
    is_active       BOOLEAN DEFAULT true,
    retry_policy    TEXT DEFAULT 'exponential' CHECK (retry_policy IN ('none', 'linear', 'exponential')),
    max_retries     INTEGER DEFAULT 5,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_subscriptions_org ON webhook_subscriptions(organization_id);
CREATE INDEX idx_webhook_subscriptions_active ON webhook_subscriptions(organization_id, is_active) WHERE is_active = true;

-- Webhook delivery log (bounded — purge > 7 days)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,             -- 'call.completed'
    payload         JSONB NOT NULL,            -- the delivered payload
    response_status INTEGER,                   -- HTTP status code from target
    response_body   TEXT,                      -- first 1KB of response
    attempt_number  INTEGER DEFAULT 1,
    next_retry_at   TIMESTAMPTZ,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id);
CREATE INDEX idx_webhook_deliveries_org ON webhook_deliveries(organization_id);
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- Export jobs (CSV/JSON generation)
CREATE TABLE IF NOT EXISTS export_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id),
    export_type     TEXT NOT NULL CHECK (export_type IN ('calls', 'recordings', 'analytics', 'contacts', 'audit_logs')),
    format          TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'json')),
    filters         JSONB DEFAULT '{}',        -- date range, agent, status filters
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    total_rows      INTEGER,
    file_size_bytes BIGINT,
    r2_key          TEXT,                       -- R2 object key for download
    download_url    TEXT,                       -- pre-signed R2 URL (expires 1h)
    expires_at      TIMESTAMPTZ,               -- auto-delete from R2 after 24h
    error_detail    TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_export_jobs_org ON export_jobs(organization_id);
CREATE INDEX idx_export_jobs_user ON export_jobs(user_id);
CREATE INDEX idx_export_jobs_expires ON export_jobs(expires_at) WHERE status = 'completed';

COMMIT;
```

### 5.4 API Routes

| Method   | Path                                         | Middleware                                                                  | Purpose                                                |
| -------- | -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `GET`    | `/api/webhooks/subscriptions`                | `requireAuth`, `requirePlan('pro')`                                         | List org's webhook subscriptions                       |
| `POST`   | `/api/webhooks/subscriptions`                | `requireAuth`, `requirePlan('pro')`, `webhookRateLimit`                     | Create subscription (auto-generate HMAC secret)        |
| `PATCH`  | `/api/webhooks/subscriptions/:id`            | `requireAuth`, `webhookRateLimit`                                           | Update subscription (events, URL, active state)        |
| `DELETE` | `/api/webhooks/subscriptions/:id`            | `requireAuth`, `webhookRateLimit`                                           | Delete subscription + cascade deliveries               |
| `POST`   | `/api/webhooks/subscriptions/:id/test`       | `requireAuth`, `webhookRateLimit`                                           | Send test payload to target URL                        |
| `GET`    | `/api/webhooks/subscriptions/:id/deliveries` | `requireAuth`                                                               | Delivery log for subscription (paginated, last 7 days) |
| `POST`   | `/api/exports`                               | `requireAuth`, `requirePlan('starter')`, `exportRateLimit`, `idempotency()` | Create export job → returns `job_id`                   |
| `GET`    | `/api/exports/:id`                           | `requireAuth`                                                               | Check export job status                                |
| `GET`    | `/api/exports/:id/download`                  | `requireAuth`                                                               | Get pre-signed R2 download URL (redirect)              |
| `GET`    | `/api/exports`                               | `requireAuth`                                                               | List export history (paginated)                        |

**Webhook fanout pattern:**

```typescript
// workers/src/lib/webhook-fanout.ts
export async function fanoutEvent(
  db: DbClient,
  env: Env,
  orgId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  // 1. Find active subscriptions matching event
  const subs = await db.query(
    `SELECT id, target_url, secret FROM webhook_subscriptions
     WHERE organization_id = $1 AND is_active = true AND $2 = ANY(events)`,
    [orgId, eventType]
  )

  // 2. For each subscription, create delivery + send
  for (const sub of subs.rows) {
    const signature = await hmacSign(sub.secret, JSON.stringify(payload))
    // Insert delivery record
    await db.query(
      `INSERT INTO webhook_deliveries (subscription_id, organization_id, event_type, payload, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [sub.id, orgId, eventType, JSON.stringify(payload)]
    )
    // Fire-and-forget delivery
    deliverWebhook(sub.target_url, payload, signature, sub.id, env).catch(() => {})
  }
}
```

### 5.5 UI Components

| Component             | Mount Point                                                          | Hooks Used                |
| --------------------- | -------------------------------------------------------------------- | ------------------------- |
| `WebhookManager`      | `app/settings/page.tsx` → Webhooks tab                               | `useWebhookSubscriptions` |
| `WebhookCreateModal`  | Modal from `WebhookManager` → "Add Webhook" button                   | `useWebhookSubscriptions` |
| `WebhookDeliveryLog`  | Expandable section in `WebhookManager` per subscription              | `useWebhookSubscriptions` |
| `ExportButton`        | Rendered in `app/reports/page.tsx`, `app/analytics/page.tsx` toolbar | `useExports`              |
| `ExportHistory`       | `app/settings/page.tsx` → Exports tab                                | `useExports`              |
| `ExportProgressToast` | Global — shadcn `Toast` with progress indicator                      | `useExports` polling      |

### 5.6 Risks & Mitigations

| Risk                                 | Severity    | Mitigation                                                                                                                                                           |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Webhook target SSRF**              | 🔴 Critical | Validate target URL: reject `localhost`, `127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `169.254.x.x`, `::1`. Require HTTPS only.                                           |
| **Webhook delivery failure cascade** | 🟠 High     | Exponential backoff: 1min → 5min → 15min → 1h → 4h. Max 5 retries. After 5 failures, set subscription `is_active = false` + notify user.                             |
| **Large CSV export OOM**             | 🟠 High     | Stream rows in batches (1000 rows at a time). Write to R2 as multipart upload. Set max export size: 100k rows (Starter), 500k rows (Business), 1M rows (Enterprise). |
| **Export file persistence cost**     | 🟡 Medium   | R2 files auto-expire after 24h. Cron purges `export_jobs` where `expires_at < now()`. Show "Export expires in X hours" in UI.                                        |
| **Webhook payload data leak**        | 🟠 High     | Webhook payloads include org data. HMAC-SHA256 signature on every delivery. `X-WIB-Signature` header. Document signature verification for customers.                 |
| **Zapier app review**                | 🟡 Medium   | Phase 1: generic webhooks (Zapier "Webhooks by Zapier" trigger — no app review). Phase 2: native Zapier app requires review process (weeks). Start with generic.     |

### 5.7 Best Practices Checklist

- [ ] SSRF protection: validate target URLs (no internal IPs, HTTPS only)
- [ ] HMAC-SHA256 signature on every webhook delivery (`X-WIB-Signature` header)
- [ ] CORS: add `X-WIB-Signature` to `exposeHeaders` if used in responses
- [ ] `organization_id` in every query — exports only include requesting org's data
- [ ] Parameterized SQL — even for dynamic export filter queries
- [ ] `writeAuditLog()` on webhook create/delete, export request/download
- [ ] `idempotency()` on export creation (prevent duplicate 100k-row exports)
- [ ] R2 pre-signed URLs expire after 1h — no permanent download links
- [ ] Deploy: `api:deploy` → `build` → `pages:deploy` → `health-check`
- [ ] `getDb()` before `try`, `db.end()` in `finally`

### 5.8 Effort Estimate

| Phase                              | Scope                                                                                           | Days         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ------------ |
| **Phase 1: Webhook Subscriptions** | Extend existing CRUD, event filter, HMAC signing, test endpoint                                 | 1            |
| **Phase 2: Webhook Fanout**        | `webhook-fanout.ts` lib, integrate into `calls.ts`/`recordings.ts` event emission, delivery log | 1.5          |
| **Phase 3: CSV/JSON Exports**      | `exports.ts` routes, `export-generator.ts`, R2 upload, `ExportButton` UI                        | 1.5          |
| **Phase 4: Settings UI**           | `WebhookManager`, `WebhookDeliveryLog`, `ExportHistory` components                              | 1            |
| **Phase 5: Retry & Cleanup**       | Exponential backoff cron, R2 expiry cron, auto-disable failed subscriptions                     | 0.5          |
| **Total**                          |                                                                                                 | **5.5 days** |

### 5.9 Opportunities

- **Ecosystem**: Webhooks make WIB a platform, not just a product. Zapier alone has 6k+ apps — instant integration with CRMs, project management, notifications.
- **Self-serve**: Customers build their own integrations without WIB engineering effort. Reduces support load.
- **Revenue**: Webhook count limits by plan (Starter: 0, Pro: 5, Business: 25, Enterprise: unlimited). Natural upsell.
- **Enterprise**: CSV/JSON bulk exports are mandatory for enterprise procurement checklists. "Can we export our data?" is a deal-breaking question.
- **Compliance**: Audit log exports support regulatory requirements (FINRA, HIPAA). Unlocks regulated industries.

---

## Cross-Feature Summary

### Total Effort Estimate

| Feature            | Days        | Plan Gate                                         |
| ------------------ | ----------- | ------------------------------------------------- |
| CRM Integrations   | 8           | Pro+ (HubSpot), Business+ (Salesforce)            |
| Mobile App         | 10          | Starter+ (PWA), Pro+ (Push), Business+ (Native)   |
| Inbound IVR        | 5           | Business+                                         |
| Advanced Analytics | 7.5         | Business+ (Analytics), Enterprise (ML)            |
| API Exports        | 5.5         | Starter+ (CSV), Pro+ (Webhooks), Business+ (Bulk) |
| **Total**          | **36 days** |                                                   |

### New Database Tables (16 total)

| Table                   | Feature   | Est. Rows/Year (per org) |
| ----------------------- | --------- | ------------------------ |
| `crm_integrations`      | CRM       | 1–3                      |
| `crm_sync_log`          | CRM       | 2,000 (purged > 30d)     |
| `crm_field_mappings`    | CRM       | 20–50                    |
| `crm_contact_cache`     | CRM       | 500–10,000               |
| `mobile_devices`        | Mobile    | 5–50                     |
| `push_subscriptions`    | Mobile    | 5–50                     |
| `inbound_numbers`       | IVR       | 1–25                     |
| `ivr_menus`             | IVR       | 5–20                     |
| `ivr_menu_options`      | IVR       | 20–100                   |
| `inbound_call_log`      | IVR       | 5,000–50,000             |
| `sentiment_scores`      | Analytics | 5,000–240,000            |
| `analytics_snapshots`   | Analytics | 365–1,095                |
| `ml_predictions`        | Analytics | 1,000–10,000             |
| `webhook_subscriptions` | Exports   | 5–25                     |
| `webhook_deliveries`    | Exports   | 10,000 (purged > 7d)     |
| `export_jobs`           | Exports   | 100–500                  |

### New Worker Route Files

| File                            | Endpoints         | Feature   |
| ------------------------------- | ----------------- | --------- |
| `workers/src/routes/crm.ts`     | 9                 | CRM       |
| `workers/src/routes/mobile.ts`  | 7                 | Mobile    |
| `workers/src/routes/ivr.ts`     | 9                 | IVR       |
| `workers/src/routes/ml.ts`      | 3                 | Analytics |
| `workers/src/routes/exports.ts` | 4                 | Exports   |
| Extensions to `analytics.ts`    | 4                 | Analytics |
| Extensions to `webhooks.ts`     | 0 (existing CRUD) | Exports   |

### New Zod Schemas Required (16 total)

| Schema                      | Feature   |
| --------------------------- | --------- |
| `ConnectCrmSchema`          | CRM       |
| `CrmFieldMappingSchema`     | CRM       |
| `CrmSyncTriggerSchema`      | CRM       |
| `CrmWebhookPayloadSchema`   | CRM       |
| `RegisterDeviceSchema`      | Mobile    |
| `PushSubscriptionSchema`    | Mobile    |
| `QrAuthSchema`              | Mobile    |
| `CreateIvrMenuSchema`       | IVR       |
| `IvrMenuOptionSchema`       | IVR       |
| `ProvisionNumberSchema`     | IVR       |
| `SentimentQuerySchema`      | Analytics |
| `AnalyticsDateRangeSchema`  | Analytics |
| `MlPredictionRequestSchema` | Analytics |
| `WebhookSubscriptionSchema` | Exports   |
| `ExportJobSchema`           | Exports   |
| `WebhookEventFilterSchema`  | Exports   |

### New AuditAction Constants

```typescript
// CRM
CRM_CONNECTED: 'crm:connected',
CRM_DISCONNECTED: 'crm:disconnected',
CRM_SYNC_STARTED: 'crm:sync_started',
CRM_SYNC_COMPLETED: 'crm:sync_completed',
CRM_SYNC_FAILED: 'crm:sync_failed',
CRM_MAPPING_UPDATED: 'crm:mapping_updated',

// Mobile
DEVICE_REGISTERED: 'mobile:device_registered',
DEVICE_REMOVED: 'mobile:device_removed',
PUSH_SUBSCRIBED: 'mobile:push_subscribed',
QR_AUTH_USED: 'mobile:qr_auth_used',

// IVR
IVR_NUMBER_PROVISIONED: 'ivr:number_provisioned',
IVR_NUMBER_RELEASED: 'ivr:number_released',
IVR_MENU_CREATED: 'ivr:menu_created',
IVR_MENU_UPDATED: 'ivr:menu_updated',
IVR_MENU_DELETED: 'ivr:menu_deleted',

// Exports
WEBHOOK_CREATED: 'webhook:created',
WEBHOOK_DELETED: 'webhook:deleted',
WEBHOOK_TESTED: 'webhook:tested',
EXPORT_REQUESTED: 'export:requested',
EXPORT_DOWNLOADED: 'export:downloaded',
```

### Plan Gating Additions

```typescript
// Add to FEATURE_PLAN_REQUIREMENTS in workers/src/lib/plan-gating.ts
crm_hubspot: 'pro',
crm_salesforce: 'business',
crm_custom: 'enterprise',
mobile_pwa: 'starter',
mobile_push: 'pro',
mobile_native: 'business',
inbound_ivr: 'business',
toll_free_numbers: 'business',
advanced_analytics: 'business',
ml_predictions: 'enterprise',
analytics_export: 'pro',
webhooks: 'pro',
zapier_integration: 'pro',
csv_export: 'starter',
bulk_export: 'business',
```

### CORS Config Updates (`workers/src/index.ts`)

```typescript
// Add to allowHeaders:
;('X-CRM-Sync-Id', 'X-Export-Job-Id')

// Add to exposeHeaders:
;('X-WIB-Signature', 'X-Export-Status', 'X-Export-Download-Url')
```

### Recommended Rollout Order

1. **Week 1–2**: API Exports (5.5d) — low risk, high customer demand, unlocks Zapier ecosystem
2. **Week 2–3**: CRM Phase 1–2 (5d) — HubSpot MVP + bidirectional sync
3. **Week 4**: Inbound IVR (5d) — completes the call center platform story
4. **Week 5–6**: Advanced Analytics Phases 1–3 (4d) — sentiment charts + agent leaderboard
5. **Week 6–7**: Mobile PWA (4d) — immediate value, no app store dependency
6. **Week 7–8**: CRM Phase 3–4 + Analytics Phase 4–5 + Mobile Phase 4 — polish and Enterprise tier

**Total calendar time**: ~8 weeks with a single full-stack engineer, ~4 weeks with two engineers working in parallel.

---

## Best Practices for All Features

### Platform Rules (Non-Negotiable)

| Rule                                                    | Enforcement                                                                                   | Applies To                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **DB connection order**: `NEON_PG_CONN \|\| HYPERDRIVE` | `getDb(c.env)` handles this — never construct connections manually                            | All features                                  |
| **No server-side code in Next.js**                      | Static export (`output: 'export'`). All API in `workers/src/routes/`                          | Mobile, CRM settings UI, Analytics dashboards |
| **Multi-tenant isolation**                              | Every WHERE includes `organization_id = $N` from `session.organization_id`                    | All 16 new tables                             |
| **Parameterized queries only**                          | `$1, $2, $3` — zero string interpolation                                                      | All SQL                                       |
| **Audit logging**                                       | `writeAuditLog()` with `old_value/new_value` (not `before/after`)                             | Every CUD mutation across all features        |
| **Bearer token auth**                                   | Frontend uses `apiGet/apiPost/apiPut/apiDelete` — never raw `fetch()`                         | All new hooks and components                  |
| **CORS updates**                                        | Any new custom header needs both `allowHeaders` AND `exposeHeaders` in `workers/src/index.ts` | CRM sync headers, export headers              |
| **Deploy chain order**                                  | `api:deploy` → `build` → `pages:deploy` → `health-check`                                      | Every release                                 |

### Implementation Patterns

1. **Route handler skeleton** — Always follow: `getDb(c.env)` → `try { requireAuth(c) … } finally { await db.end() }`
2. **Validation** — `validateBody(c, ZodSchema)` returns `{ success, data, response }` discriminated union
3. **Plan gating** — Use `checkFeatureAccess(c.env, orgId, 'feature')` middleware or inline check
4. **Idempotency** — Apply `idempotency()` middleware to POST endpoints that trigger external side effects (CRM sync, webhook dispatch, export jobs)
5. **Rate limiting** — Use pre-built limiters from `workers/src/lib/rate-limit.ts`. Add new limiters for high-frequency endpoints (webhook delivery, analytics queries)
6. **Error handling** — Return structured `{ error: string }` with appropriate HTTP status. Use `formatErrorResponse()` for consistency
7. **Cron workers** — Use Cloudflare Cron Triggers via `wrangler.jsonc` `[triggers]` section. Handle in `workers/src/scheduled.ts`

### Security Best Practices per Feature

| Feature       | Key Risk                 | Mitigation                                                                                                  |
| ------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **CRM**       | OAuth token leakage      | Encrypt tokens with AES-GCM before KV storage; never log tokens; use short-lived access tokens with refresh |
| **CRM**       | Webhook spoofing         | Verify HubSpot/Salesforce webhook signatures; reject unsigned payloads                                      |
| **Mobile**    | Session hijacking via QR | QR auth tokens expire in 60s; bind to device fingerprint; require re-auth for sensitive ops                 |
| **Mobile**    | Push notification PII    | Never include call content in push payload; use generic notifications that link to the app                  |
| **IVR**       | Toll fraud               | Rate limit inbound calls per DID; monitor usage spikes; alert on anomalous patterns                         |
| **IVR**       | Menu injection           | Sanitize all IVR prompts; use parameterized TTS; validate menu option targets                               |
| **Analytics** | PII in sentiment data    | Store sentiment scores without source text; link to call_id for authorized lookback only                    |
| **Analytics** | ML bias                  | Document training data sources; flag predictions with confidence scores; human-in-the-loop for decisions    |
| **Exports**   | Data exfiltration        | Rate limit export requests; log every download; enforce plan-based row limits; encrypt at rest              |
| **Exports**   | Webhook SSRF             | Validate webhook URLs against allowlist; reject private IPs; use HMAC signatures on payloads                |

---

## Revenue & Growth Opportunities

### Per-Feature Revenue Impact

| Feature                | Revenue Model                                       | Est. ARR Impact (100 customers) | Growth Lever                                                              |
| ---------------------- | --------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| **CRM Integrations**   | Upgrade driver (Pro→Business for SF)                | +$36K–72K/yr                    | Stickiness — CRM sync creates deep platform dependency                    |
| **Mobile App**         | PWA free, push on Pro, native on Business           | +$12K–24K/yr                    | Engagement — mobile notifications increase daily active usage 2–3x        |
| **Inbound IVR**        | Per-DID monthly fee ($2–5/num) + Business plan gate | +$24K–60K/yr                    | TAM expansion — positions platform as full call center, not just outbound |
| **Advanced Analytics** | Business plan gate for sentiment, Enterprise for ML | +$48K–96K/yr                    | Differentiation — "AI-powered insights" justifies premium pricing         |
| **API Exports**        | Zapier/webhook on Pro, bulk on Business             | +$18K–36K/yr                    | Ecosystem — Zapier marketplace drives organic discovery                   |

### Strategic Opportunities

1. **Zapier Marketplace Listing** — Exports feature enables a Zapier partner listing, driving organic inbound from 5M+ Zapier users searching for voice/call tools
2. **HubSpot App Marketplace** — CRM integration qualifies for the HubSpot app marketplace (50K+ SMBs browsing monthly), with built-in co-marketing
3. **Salesforce AppExchange** — Business-tier SF integration positions WIB in the enterprise market at $99+/user/mo
4. **Mobile-First Verticals** — Field sales, real estate agents, and insurance adjusters need mobile call recording — PWA unlocks these segments without app store friction
5. **Inbound + IVR = CCAAS Positioning** — Adding inbound IVR moves WIB from "call recording tool" to "cloud contact center" — a 10x TAM expansion ($50B market)
6. **Sentiment Analytics for Compliance** — Financial services and insurance regulators increasingly require sentiment/emotion analysis on recorded calls — Enterprise upsell opportunity
7. **API-First Platform Play** — Exports + webhooks + Zapier enable WIB to become a "voice data platform" that feeds downstream systems, increasing switching costs
