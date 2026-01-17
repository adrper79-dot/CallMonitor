# Webhook Configuration UI Implementation Plan

**Status:** Ready for Implementation  
**Priority:** 🟡 High Priority (Analytics + Webhooks sprint)  
**Estimated Time:** 2 days (16 hours)  
**Completion Target:** 50% → 100%  
**Last Updated:** January 16, 2026

---

## Executive Summary

**Current State:**
- ✅ Backend: 100% Complete
  - `webhook_subscriptions` table in database
  - `webhook_deliveries` table for delivery tracking
  - `/api/webhooks/subscriptions` (GET, POST) - List & Create
  - `lib/webhookDelivery.ts` - Delivery service with HMAC signing
  - RBAC: Owner/Admin only
  - Audit logging enabled
  - Rate limiting implemented

- ❌ Frontend: 0% Complete
  - No Settings tab for webhooks
  - No components for CRUD operations
  - No UI for webhook testing
  - No delivery logs viewer

**Gap:** Settings page needs "Webhooks" tab with full CRUD interface for webhook management.

---

## Architecture Review

### Existing Backend Infrastructure

#### Database Schema (✅ Complete)
```sql
-- webhook_subscriptions table
CREATE TABLE webhook_subscriptions (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,                    -- User-friendly name
  url TEXT NOT NULL,                     -- Target endpoint
  secret TEXT NOT NULL,                  -- HMAC signing secret (whsec_...)
  events TEXT[] NOT NULL,                -- Array of event types
  active BOOLEAN DEFAULT true,           -- Enable/disable toggle
  retry_policy TEXT DEFAULT 'exponential', -- none|fixed|exponential
  max_retries INTEGER DEFAULT 5,
  timeout_ms INTEGER DEFAULT 30000,
  headers JSONB DEFAULT '{}',            -- Custom headers
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT webhook_subscriptions_unique_url UNIQUE (organization_id, url)
);

-- webhook_deliveries table (for logs)
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES webhook_subscriptions(id),
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',         -- pending|processing|delivered|failed|retrying
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  CONSTRAINT webhook_deliveries_idempotent UNIQUE (subscription_id, event_type, event_id)
);
```

#### API Endpoints (✅ Complete)

**GET /api/webhooks/subscriptions**
- Returns: Array of webhook subscriptions
- Auth: Owner/Admin only
- Features:
  * Secrets masked (shows last 4 chars only)
  * Sorted by created_at DESC
  * Scoped to user's organization

**POST /api/webhooks/subscriptions**
- Creates new webhook subscription
- Auth: Owner/Admin only
- Validation:
  * Name: 1-100 characters
  * URL: Must be valid HTTP/HTTPS
  * Events: At least 1 valid event type
  * Retry policy: none|fixed|exponential
  * Max retries: Capped at 10
  * Timeout: Capped at 60s
- Returns: Full webhook object WITH SECRET (only shown once)
- Feature flag check: `org_feature_flags.webhooks` must be enabled
- Audit logged

**🔴 MISSING: UPDATE/DELETE Endpoints**
- Need: `PUT /api/webhooks/subscriptions/[id]` or `PATCH /api/webhooks/subscriptions/[id]`
- Need: `DELETE /api/webhooks/subscriptions/[id]`

#### Event Types (✅ Complete)
```typescript
export type WebhookEventType = 
  | 'call.started'
  | 'call.answered'
  | 'call.completed'
  | 'call.failed'
  | 'call.disposition_set'
  | 'recording.available'
  | 'recording.transcribed'
  | 'transcript.completed'
  | 'translation.completed'
  | 'survey.completed'
  | 'scorecard.completed'
  | 'evidence.exported'
```

### Design System Alignment

**Reference:** [DESIGN_SYSTEM.md](c:\Users\Ultimate Warrior\My project\gemini-project\ARCH_DOCS\04-DESIGN\DESIGN_SYSTEM.md)

**Key Principles:**
1. **Invisible Design** - UI should disappear, focus on functionality
2. **Trust Through Restraint** - Professional, minimal, not flashy
3. **One Primary Action** - Each screen has ONE obvious thing to do
4. **Data Over Decoration** - Show information, not decorations
5. **White Space = Confidence** - Generous spacing signals quality

**Color Palette:**
- Primary: Navy `#1E3A5F` (buttons, accents)
- Success: Emerald `#059669` (delivered webhooks)
- Error: Red `#DC2626` (failed webhooks)
- Warning: Amber `#D97706` (retrying webhooks)
- Info: Blue `#2563EB` (pending webhooks)
- Neutral: Gray scale for text, borders, backgrounds

**Typography:**
- Font: Inter (system font stack)
- Heading: text-lg font-semibold text-gray-900
- Body: text-sm text-gray-600
- Labels: text-xs font-medium text-gray-700

**Components:**
- Switch: Professional toggle (Navy primary)
- Badge: Subtle status indicators (light backgrounds)
- Buttons: Navy primary, gray secondary, red danger
- Forms: Clean inputs with proper validation states

---

## Implementation Plan

### Phase 1: Backend Completion (4 hours)

#### Task 1.1: Create Update Endpoint (1.5 hours)
**File:** `app/api/webhooks/subscriptions/[id]/route.ts`

**Functionality:**
```typescript
/**
 * PATCH /api/webhooks/subscriptions/[id]
 * Update an existing webhook subscription
 * 
 * Allowed updates:
 * - name
 * - url (validates, checks duplicates)
 * - events (validates event types)
 * - active (toggle on/off)
 * - retry_policy
 * - max_retries
 * - timeout_ms
 * - headers
 * 
 * NOT allowed to update:
 * - secret (regenerate via separate endpoint if needed)
 * - organization_id
 * - created_by
 */
```

**Implementation Steps:**
1. Create `app/api/webhooks/subscriptions/[id]/route.ts`
2. Copy auth pattern from main `route.ts`
3. Validate webhook exists and belongs to org
4. Validate all updatable fields
5. Handle duplicate URL check (exclude self)
6. Update webhook record
7. Log to audit_logs
8. Return updated webhook (with masked secret)

**Validation Rules:**
- Name: 1-100 chars (if provided)
- URL: Valid HTTP/HTTPS (if provided)
- Events: Non-empty array, all valid types (if provided)
- Active: Boolean (if provided)
- Retry policy: none|fixed|exponential (if provided)
- Max retries: 0-10 (if provided)
- Timeout: 1000-60000ms (if provided)

**Error Handling:**
- 401: Not authenticated
- 403: Not owner/admin, or webhook doesn't belong to org
- 404: Webhook not found
- 409: Duplicate URL (different webhook)
- 400: Validation errors
- 500: Database/server errors

**Audit Log:**
```typescript
{
  resource_type: 'webhook_subscription',
  resource_id: webhookId,
  action: 'update',
  before: oldWebhook,
  after: updatedWebhook
}
```

---

#### Task 1.2: Create Delete Endpoint (1 hour)
**File:** `app/api/webhooks/subscriptions/[id]/route.ts` (add to existing)

**Functionality:**
```typescript
/**
 * DELETE /api/webhooks/subscriptions/[id]
 * Delete a webhook subscription
 * 
 * Cascade behavior:
 * - Deletes all associated webhook_deliveries (ON DELETE CASCADE in DB)
 * - Audit logged
 */
```

**Implementation Steps:**
1. Add `DELETE` export to `[id]/route.ts`
2. Copy auth pattern
3. Validate webhook exists and belongs to org
4. Check if webhook has recent activity (optional warning)
5. Delete webhook (cascade handles deliveries)
6. Log to audit_logs
7. Return success message

**Audit Log:**
```typescript
{
  resource_type: 'webhook_subscription',
  resource_id: webhookId,
  action: 'delete',
  before: deletedWebhook
}
```

---

#### Task 1.3: Create Test Endpoint (1 hour)
**File:** `app/api/webhooks/subscriptions/[id]/test/route.ts`

**Functionality:**
```typescript
/**
 * POST /api/webhooks/subscriptions/[id]/test
 * Send a test webhook event
 * 
 * Purpose: Let users verify their endpoint receives webhooks correctly
 * 
 * Creates a synthetic webhook delivery with test payload
 */
```

**Implementation Steps:**
1. Create `app/api/webhooks/subscriptions/[id]/test/route.ts`
2. Auth check (owner/admin)
3. Fetch webhook subscription
4. Generate test payload:
   ```typescript
   {
     event: 'call.completed',
     event_id: 'test-' + crypto.randomUUID(),
     timestamp: new Date().toISOString(),
     organization_id: org.id,
     data: {
       call_id: 'test-call-id',
       status: 'completed',
       duration: 120,
       from: '+15551234567',
       to: '+15557654321',
       _test: true  // Flag as test event
     }
   }
   ```
5. Call `deliverWebhook()` function from `lib/webhookDelivery.ts`
6. Return immediate response with delivery status
7. Optionally queue delivery for async processing

**Response:**
```typescript
{
  success: true,
  delivery: {
    id: 'uuid',
    status: 'pending',
    message: 'Test webhook queued. Check your endpoint for delivery.'
  }
}
```

---

#### Task 1.4: Create Deliveries Log Endpoint (30 minutes)
**File:** `app/api/webhooks/subscriptions/[id]/deliveries/route.ts`

**Functionality:**
```typescript
/**
 * GET /api/webhooks/subscriptions/[id]/deliveries
 * Get delivery logs for a specific webhook
 * 
 * Query params:
 * - limit (default 50, max 100)
 * - offset (pagination)
 * - status (filter: pending|delivered|failed|retrying)
 */
```

**Implementation Steps:**
1. Create `app/api/webhooks/subscriptions/[id]/deliveries/route.ts`
2. Auth check
3. Validate webhook exists and belongs to org
4. Parse query params (limit, offset, status filter)
5. Query `webhook_deliveries` table
6. Return deliveries sorted by created_at DESC
7. Include pagination metadata

**Response:**
```typescript
{
  success: true,
  deliveries: [
    {
      id: 'uuid',
      event_type: 'call.completed',
      event_id: 'call-uuid',
      status: 'delivered',
      attempts: 1,
      response_status: 200,
      response_time_ms: 245,
      created_at: '2026-01-16T12:00:00Z',
      delivered_at: '2026-01-16T12:00:01Z'
    }
  ],
  pagination: {
    total: 1234,
    limit: 50,
    offset: 0,
    hasMore: true
  }
}
```

---

### Phase 2: Frontend Components (8 hours)

#### Task 2.1: WebhookList Component (2 hours)
**File:** `components/settings/WebhookList.tsx`

**Purpose:** Display all webhook subscriptions with actions

**Props:**
```typescript
interface WebhookListProps {
  organizationId: string
  canEdit: boolean  // Owner/Admin check from Settings page
}
```

**Features:**
- Fetch webhooks from `/api/webhooks/subscriptions`
- Display in card/table layout
- Show: name, URL, active status, event count, created date
- Actions per webhook:
  * Edit button (opens WebhookForm in edit mode)
  * Delete button (with confirmation modal)
  * Test button (sends test webhook)
  * Toggle active/inactive
  * View deliveries button (opens WebhookDeliveryLog)
- Empty state: "No webhooks configured. Create one to get started."
- Loading state
- Error state

**Layout:**
```tsx
<div className="space-y-4">
  {/* Header with Create button */}
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-lg font-semibold text-gray-900">Webhook Subscriptions</h3>
      <p className="text-sm text-gray-500">
        Receive real-time notifications when events occur
      </p>
    </div>
    {canEdit && (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
      >
        Create Webhook
      </button>
    )}
  </div>

  {/* Webhook Cards */}
  {webhooks.map(webhook => (
    <div key={webhook.id} className="border border-gray-200 rounded-lg p-6">
      {/* Card content */}
    </div>
  ))}
</div>
```

**Card Content:**
- Row 1: Name (bold) + Active toggle + Actions menu (⋮)
- Row 2: URL (truncated, with copy button)
- Row 3: Badge for each event type (max 3 visible, "+X more")
- Row 4: Metadata (Created date, delivery success rate)

**Actions Menu:**
- Edit
- Test
- View Logs
- Delete (with confirmation)

**Delete Confirmation Modal:**
```tsx
<Modal>
  <h3>Delete Webhook?</h3>
  <p>
    This will permanently delete the webhook "{name}" and all its delivery logs.
    This action cannot be undone.
  </p>
  <div className="flex gap-3 justify-end">
    <button onClick={onCancel} className="secondary">Cancel</button>
    <button onClick={onConfirm} className="danger">Delete Webhook</button>
  </div>
</Modal>
```

---

#### Task 2.2: WebhookForm Component (3 hours)
**File:** `components/settings/WebhookForm.tsx`

**Purpose:** Create or edit webhook subscription

**Props:**
```typescript
interface WebhookFormProps {
  organizationId: string
  webhook?: WebhookSubscription  // If editing
  onClose: () => void
  onSuccess: () => void
}
```

**Form Fields:**

1. **Name** (required)
   - Input: text, 1-100 chars
   - Label: "Webhook Name"
   - Placeholder: "Slack notifications"
   - Help text: "Internal name to identify this webhook"

2. **URL** (required)
   - Input: text, URL validation
   - Label: "Endpoint URL"
   - Placeholder: "https://your-app.com/webhooks/word-is-bond"
   - Help text: "Must be HTTPS"
   - Validation: Check for valid HTTPS URL

3. **Events** (required, multi-select)
   - Label: "Events to Subscribe"
   - Multi-checkbox list:
     ```tsx
     <div className="grid grid-cols-2 gap-3">
       {WEBHOOK_EVENT_TYPES.map(event => (
         <label key={event} className="flex items-center gap-2">
           <input
             type="checkbox"
             checked={selectedEvents.includes(event)}
             onChange={() => toggleEvent(event)}
           />
           <span>{formatEventLabel(event)}</span>
         </label>
       ))}
     </div>
     ```
   - Help text: "Select at least one event type"
   - Validation: Must select at least 1 event

4. **Advanced Settings** (collapsible)
   - Retry Policy (dropdown):
     * None - Don't retry failed deliveries
     * Fixed - Retry with fixed interval
     * Exponential - Exponential backoff (recommended) ✅
   - Max Retries (number input, 0-10, default 5)
   - Timeout (number input, 1000-60000ms, default 30000)
   - Custom Headers (key-value pairs):
     ```tsx
     <div className="space-y-2">
       {headers.map((header, i) => (
         <div key={i} className="flex gap-2">
           <input placeholder="Header name" value={header.key} />
           <input placeholder="Header value" value={header.value} />
           <button onClick={() => removeHeader(i)}>Remove</button>
         </div>
       ))}
       <button onClick={addHeader}>+ Add Header</button>
     </div>
     ```

**Form Actions:**
- Cancel button (gray)
- Save button (navy primary)

**Validation:**
- Real-time field validation
- Show errors below each field
- Disable submit until all required fields valid

**Success Flow:**
- On create: Show alert with webhook secret
  ```tsx
  <Alert variant="success">
    <h4>Webhook Created!</h4>
    <p>Save this secret - it won't be shown again:</p>
    <code className="block bg-gray-100 p-3 rounded font-mono text-sm">
      {webhook.secret}
    </code>
    <button onClick={copySecret}>Copy Secret</button>
  </Alert>
  ```
- On update: Show success toast, close form
- Call `onSuccess()` to refresh list

**Error Handling:**
- Show API errors in alert at top of form
- Keep form data so user can fix and retry

---

#### Task 2.3: WebhookDeliveryLog Component (2 hours)
**File:** `components/settings/WebhookDeliveryLog.tsx`

**Purpose:** Show delivery logs for a webhook

**Props:**
```typescript
interface WebhookDeliveryLogProps {
  webhookId: string
  webhookName: string
  onClose: () => void
}
```

**Features:**
- Fetch deliveries from `/api/webhooks/subscriptions/[id]/deliveries`
- Display in table/list format
- Show: event type, timestamp, status, response time, attempts
- Status badge colors:
  * Delivered: Green
  * Pending: Blue
  * Retrying: Amber
  * Failed: Red
- Pagination controls (50 per page)
- Filter by status (all|pending|delivered|failed|retrying)
- Empty state: "No deliveries yet"
- Loading state
- Error state

**Layout:**
```tsx
<Modal size="large">
  <header>
    <h3>Delivery Logs - {webhookName}</h3>
    <button onClick={onClose}>×</button>
  </header>

  {/* Filters */}
  <div className="flex gap-3 mb-4">
    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
      <option value="all">All Statuses</option>
      <option value="pending">Pending</option>
      <option value="delivered">Delivered</option>
      <option value="failed">Failed</option>
      <option value="retrying">Retrying</option>
    </select>
  </div>

  {/* Table */}
  <table className="w-full">
    <thead>
      <tr>
        <th>Event</th>
        <th>Status</th>
        <th>Timestamp</th>
        <th>Response</th>
        <th>Attempts</th>
      </tr>
    </thead>
    <tbody>
      {deliveries.map(delivery => (
        <tr key={delivery.id}>
          <td>
            <Badge variant="info">{delivery.event_type}</Badge>
          </td>
          <td>
            <StatusBadge status={delivery.status} />
          </td>
          <td>{formatDate(delivery.created_at)}</td>
          <td>
            {delivery.response_status && (
              <span className={delivery.response_status >= 200 && delivery.response_status < 300 ? 'text-green-600' : 'text-red-600'}>
                {delivery.response_status} ({delivery.response_time_ms}ms)
              </span>
            )}
          </td>
          <td>{delivery.attempts}</td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* Pagination */}
  <div className="flex items-center justify-between mt-4">
    <span className="text-sm text-gray-500">
      Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
    </span>
    <div className="flex gap-2">
      <button onClick={prevPage} disabled={offset === 0}>Previous</button>
      <button onClick={nextPage} disabled={!hasMore}>Next</button>
    </div>
  </div>
</Modal>
```

---

#### Task 2.4: StatusBadge Component (30 minutes)
**File:** `components/settings/WebhookStatusBadge.tsx`

**Purpose:** Reusable badge for webhook delivery status

**Props:**
```typescript
interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'retrying'
}
```

**Implementation:**
```tsx
export function StatusBadge({ status }: StatusBadgeProps) {
  const variants = {
    pending: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending' },
    processing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Processing' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
    retrying: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Retrying' },
  }

  const variant = variants[status]

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variant.bg} ${variant.text}`}>
      {variant.label}
    </span>
  )
}
```

---

### Phase 3: Settings Page Integration (2 hours)

#### Task 3.1: Add Webhooks Tab (1 hour)
**File:** `app/settings/page.tsx`

**Changes:**

1. Add tab definition:
```typescript
const tabs: { id: TabId; label: string; description: string }[] = [
  { id: 'call-config', label: 'Call Configuration', description: 'Targets, Caller ID, defaults' },
  { id: 'ai-control', label: 'AI & Intelligence', description: 'Transcription, translation, surveys' },
  { id: 'quality', label: 'Quality Assurance', description: 'Secret shopper scripts' },
  { id: 'team', label: 'Team & Access', description: 'Members, roles, permissions' },
  { id: 'webhooks', label: 'Webhooks', description: 'Event subscriptions & integrations' }, // NEW
  { id: 'billing', label: 'Billing', description: 'Plan and payment' },
]
```

2. Add tab content:
```tsx
{/* Webhooks - Integrations & Event Subscriptions */}
{activeTab === 'webhooks' && (
  <div className="space-y-8">
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Webhook Subscriptions
        </h2>
        <p className="text-sm text-gray-500">
          Receive real-time notifications when events occur. Connect Word Is Bond to your own systems.
        </p>
      </div>
      <WebhookList 
        organizationId={organizationId} 
        canEdit={role === 'owner' || role === 'admin'}
      />
    </section>
  </div>
)}
```

3. Import components:
```typescript
import { WebhookList } from '@/components/settings/WebhookList'
```

4. Update TabId type:
```typescript
type TabId = 'call-config' | 'ai-control' | 'quality' | 'team' | 'webhooks' | 'billing'
```

---

#### Task 3.2: URL Routing Support (30 minutes)

**Support:** `?tab=webhooks` URL parameter

Currently implemented via:
```typescript
const searchParams = useSearchParams()
const tabParam = searchParams.get('tab')
const [activeTab, setActiveTab] = useState<TabId>((tabParam as TabId) || 'call-config')
```

**Works automatically** - no changes needed. Users can link directly to webhooks tab:
```
https://app.wordisbond.com/settings?tab=webhooks
```

---

#### Task 3.3: RBAC Enforcement (30 minutes)

**Requirement:** Only Owner/Admin can view/edit webhooks

**Implementation:**
```tsx
// Webhook tab visibility check
const canAccessWebhooks = role === 'owner' || role === 'admin'

// In tab list, conditionally show:
{canAccessWebhooks && (
  <button
    key="webhooks"
    onClick={() => setActiveTab('webhooks')}
    className={...}
  >
    Webhooks
  </button>
)}
```

**Or:** Always show tab, but display permission message if not authorized:
```tsx
{activeTab === 'webhooks' && (
  <>
    {!canAccessWebhooks ? (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Admin Access Required
        </h3>
        <p className="text-sm text-gray-500">
          Only organization owners and admins can configure webhooks.
        </p>
      </div>
    ) : (
      <WebhookList organizationId={organizationId} canEdit={true} />
    )}
  </>
)}
```

**Recommendation:** Show tab to all, but gate functionality. This provides better UX (users know feature exists but need permission).

---

### Phase 4: Testing & Polish (2 hours)

#### Task 4.1: Manual Testing (1 hour)

**Test Scenarios:**

1. **Create Webhook**
   - Fill form with valid data
   - Submit and verify creation
   - Verify secret shown only once
   - Verify webhook appears in list

2. **Edit Webhook**
   - Change name, URL, events
   - Submit and verify update
   - Verify changes reflected in list

3. **Delete Webhook**
   - Click delete, confirm modal
   - Verify webhook removed from list
   - Verify deliveries cascade deleted (check DB)

4. **Test Webhook**
   - Click test button
   - Verify test payload sent
   - Check external endpoint received payload
   - Verify HMAC signature valid

5. **Toggle Active/Inactive**
   - Toggle switch
   - Verify status updated
   - Verify deliveries respect active status

6. **View Delivery Logs**
   - Click view logs
   - Verify logs displayed correctly
   - Test status filter
   - Test pagination

7. **RBAC Enforcement**
   - Login as member (not owner/admin)
   - Verify webhooks tab hidden or gated
   - Verify API returns 403 for non-admin

8. **Error Handling**
   - Test with invalid URL
   - Test with duplicate URL
   - Test with no events selected
   - Verify error messages displayed

9. **Empty States**
   - Test with no webhooks created
   - Test with no delivery logs
   - Verify helpful empty state messages

10. **Responsive Design**
    - Test on mobile (320px, 375px, 414px)
    - Test on tablet (768px, 1024px)
    - Test on desktop (1280px, 1440px, 1920px)

---

#### Task 4.2: Integration Testing (30 minutes)

**Test with real webhook endpoint:**

1. Use [webhook.site](https://webhook.site) for testing
2. Create webhook with webhook.site URL
3. Trigger real event (e.g., complete a call)
4. Verify webhook delivered
5. Verify HMAC signature valid
6. Check delivery log shows success

**Test retry logic:**
1. Use endpoint that returns 500 error
2. Verify exponential backoff
3. Verify max retries respected
4. Verify delivery log shows attempts

---

#### Task 4.3: Documentation Updates (30 minutes)

**Files to Update:**

1. **CURRENT_STATUS.md**
   - Update Webhooks completion: 50% → 100%
   - Add frontend components to feature list

2. **ARCHITECTURE_VISUAL_GUIDE.md**
   - Add Webhooks UI to Site Architecture diagram
   - Update feature completeness matrix

3. **GAP_ANALYSIS_JAN_16_2026.md**
   - Move Webhooks from "High Priority Gaps" to "Completed"
   - Update completion percentage

4. **API.md** (docs/API.md)
   - Document new endpoints:
     * PATCH /api/webhooks/subscriptions/[id]
     * DELETE /api/webhooks/subscriptions/[id]
     * POST /api/webhooks/subscriptions/[id]/test
     * GET /api/webhooks/subscriptions/[id]/deliveries

---

## File Structure Summary

**New Files (7):**
```
app/api/webhooks/subscriptions/[id]/route.ts           (PATCH, DELETE)
app/api/webhooks/subscriptions/[id]/test/route.ts     (POST)
app/api/webhooks/subscriptions/[id]/deliveries/route.ts (GET)
components/settings/WebhookList.tsx
components/settings/WebhookForm.tsx
components/settings/WebhookDeliveryLog.tsx
components/settings/WebhookStatusBadge.tsx
```

**Modified Files (1):**
```
app/settings/page.tsx  (Add webhooks tab, integrate WebhookList)
```

**Dependencies:**
- No new packages needed
- Uses existing: React, NextAuth, Supabase Admin, crypto, TypeScript
- Design system: Existing Badge, Switch, components

---

## Timeline Breakdown

| Phase | Task | Hours | Status |
|-------|------|-------|--------|
| **Phase 1: Backend** | | **4.0** | |
| 1.1 | Create Update Endpoint | 1.5 | ⏳ Not Started |
| 1.2 | Create Delete Endpoint | 1.0 | ⏳ Not Started |
| 1.3 | Create Test Endpoint | 1.0 | ⏳ Not Started |
| 1.4 | Create Deliveries Endpoint | 0.5 | ⏳ Not Started |
| **Phase 2: Frontend** | | **8.0** | |
| 2.1 | WebhookList Component | 2.0 | ⏳ Not Started |
| 2.2 | WebhookForm Component | 3.0 | ⏳ Not Started |
| 2.3 | WebhookDeliveryLog Component | 2.0 | ⏳ Not Started |
| 2.4 | StatusBadge Component | 0.5 | ⏳ Not Started |
| **Phase 3: Integration** | | **2.0** | |
| 3.1 | Add Webhooks Tab | 1.0 | ⏳ Not Started |
| 3.2 | URL Routing Support | 0.5 | ⏳ Already Works |
| 3.3 | RBAC Enforcement | 0.5 | ⏳ Not Started |
| **Phase 4: Testing** | | **2.0** | |
| 4.1 | Manual Testing | 1.0 | ⏳ Not Started |
| 4.2 | Integration Testing | 0.5 | ⏳ Not Started |
| 4.3 | Documentation Updates | 0.5 | ⏳ Not Started |
| **TOTAL** | | **16.0 hours (2 days)** | |

---

## Success Criteria

**Completion Definition (100%):**
- ✅ All CRUD operations working (Create, Read, Update, Delete)
- ✅ Test webhook functionality working
- ✅ Delivery logs viewable with filtering
- ✅ RBAC enforced (Owner/Admin only)
- ✅ Settings page has Webhooks tab
- ✅ All components follow Design System v3.0
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Error handling comprehensive
- ✅ Empty states helpful
- ✅ Manual testing complete
- ✅ Integration testing with real endpoint
- ✅ Documentation updated

---

## Technical Decisions

### Why Modal for WebhookForm?
- Form is complex (10+ fields)
- Users stay in context on Settings page
- Can cancel without losing position in list
- Matches pattern from AIAgentConfig (inline form)

**Alternative:** Inline form (expand/collapse in list)
**Decision:** Modal for create/edit, inline for simple toggles

### Why Table for Delivery Logs?
- Delivery logs are read-only data
- Table format shows multiple columns efficiently
- Supports sorting and filtering
- Common pattern for logs/history

### Why PATCH not PUT?
- PATCH allows partial updates (only changed fields)
- More flexible for future enhancements
- Matches REST best practices for updates
- Used elsewhere in codebase (e.g., `/api/bookings/[id]`)

### Why Separate Test Endpoint?
- Testing is distinct action from CRUD
- Doesn't modify webhook config
- Can be rate-limited independently
- Clear separation of concerns

---

## Dependencies & Blockers

### Dependencies (None)
- ✅ Database schema exists
- ✅ Base API endpoints exist (GET, POST)
- ✅ Delivery service exists (`lib/webhookDelivery.ts`)
- ✅ RBAC system exists
- ✅ Design system defined
- ✅ UI components exist (Badge, Switch, etc)

### Potential Blockers
- **None identified** - All infrastructure complete

---

## Future Enhancements (Out of Scope)

### Phase 2 Features (Post-MVP)
1. **Webhook Templates**
   - Pre-configured webhooks for Slack, Discord, Teams
   - One-click setup

2. **Webhook Logs Search**
   - Full-text search in delivery logs
   - Filter by event type, status, date range

3. **Webhook Performance Metrics**
   - Success rate over time
   - Average response time
   - Failure patterns

4. **Webhook Replay**
   - Manually replay failed deliveries
   - Bulk replay option

5. **Webhook Signature Verification Helper**
   - Code snippets for common languages
   - Online signature validator tool

6. **Webhook Pause/Resume**
   - Temporarily disable without deleting
   - Scheduled enable/disable

7. **Webhook Event Preview**
   - See example payload for each event type
   - Before creating webhook

---

## Notes & Considerations

### Security
- **HMAC Signature:** Already implemented in `lib/webhookDelivery.ts`
- **Secret Rotation:** Not in scope (future enhancement)
- **HTTPS Only:** Enforced in URL validation
- **Rate Limiting:** Already implemented on API routes
- **RBAC:** Owner/Admin only access enforced

### Performance
- **Pagination:** Delivery logs paginated (50 per page)
- **Filtering:** Status filter to reduce data transfer
- **Caching:** Consider React Query for webhook list caching (optional)

### UX
- **Secret Warning:** Show secret only once on create, prominent warning
- **Delete Confirmation:** Always confirm destructive actions
- **Loading States:** Show loading spinners during API calls
- **Error Messages:** Clear, actionable error messages
- **Empty States:** Helpful guidance when no data

### Accessibility
- **Keyboard Navigation:** All actions keyboard accessible
- **Screen Readers:** Proper ARIA labels
- **Focus Management:** Modals trap focus, restore on close
- **Color Contrast:** Meet WCAG AA standards (Design System v3.0)

---

## Example API Calls

### Create Webhook
```bash
POST /api/webhooks/subscriptions
Content-Type: application/json

{
  "name": "Slack Notifications",
  "url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
  "events": [
    "call.completed",
    "call.failed",
    "survey.completed"
  ],
  "retry_policy": "exponential",
  "max_retries": 5,
  "timeout_ms": 30000
}

Response 201:
{
  "success": true,
  "subscription": {
    "id": "uuid",
    "organization_id": "uuid",
    "name": "Slack Notifications",
    "url": "https://hooks.slack.com/services/...",
    "secret": "whsec_abc123...",  // ONLY SHOWN ONCE
    "events": ["call.completed", "call.failed", "survey.completed"],
    "active": true,
    "retry_policy": "exponential",
    "max_retries": 5,
    "timeout_ms": 30000,
    "created_at": "2026-01-16T12:00:00Z"
  },
  "message": "Webhook created. Save the secret - it will not be shown again."
}
```

### Update Webhook
```bash
PATCH /api/webhooks/subscriptions/[id]
Content-Type: application/json

{
  "name": "Slack Notifications (Updated)",
  "events": [
    "call.completed",
    "call.failed",
    "survey.completed",
    "scorecard.completed"  // Added
  ]
}

Response 200:
{
  "success": true,
  "subscription": {
    "id": "uuid",
    "name": "Slack Notifications (Updated)",
    "events": ["call.completed", "call.failed", "survey.completed", "scorecard.completed"],
    "secret": "whsec_...abc123",  // Masked
    "updated_at": "2026-01-16T12:05:00Z"
  }
}
```

### Delete Webhook
```bash
DELETE /api/webhooks/subscriptions/[id]

Response 200:
{
  "success": true,
  "message": "Webhook deleted successfully"
}
```

### Test Webhook
```bash
POST /api/webhooks/subscriptions/[id]/test

Response 200:
{
  "success": true,
  "delivery": {
    "id": "delivery-uuid",
    "status": "pending",
    "message": "Test webhook queued. Check your endpoint for delivery."
  }
}
```

### Get Delivery Logs
```bash
GET /api/webhooks/subscriptions/[id]/deliveries?limit=50&offset=0&status=all

Response 200:
{
  "success": true,
  "deliveries": [
    {
      "id": "uuid",
      "event_type": "call.completed",
      "event_id": "call-uuid",
      "status": "delivered",
      "attempts": 1,
      "response_status": 200,
      "response_time_ms": 245,
      "created_at": "2026-01-16T12:00:00Z",
      "delivered_at": "2026-01-16T12:00:01Z"
    }
  ],
  "pagination": {
    "total": 1234,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Conclusion

This plan provides complete implementation guidance for Webhook Configuration UI. All backend infrastructure exists, requiring only 4 new API endpoints. Frontend requires 4 new components following existing Design System patterns. Total effort: **2 days (16 hours)**.

Upon completion, Webhook feature will be **100% complete** (currently 50%), moving project from **82% → 85%** overall completion.

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 (Backend endpoints)
3. Proceed to Phase 2 (Frontend components)
4. Complete Phase 3 (Integration)
5. Finish Phase 4 (Testing & documentation)

**Questions or adjustments needed?** Ready to begin implementation.
