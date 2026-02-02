# RTI Implementation Plan

**Objective:** Implement the Return-Traffic Intelligence (RTI) layer as defined in `LAW-RTI`, enabling "Silence by Design".

This plan strictly adheres to the **Append-Only** and **Non-Authoritative** principles found in `LAW-RTI`.

---

## 1. The Build (Schema & Storage)

**Status:** ✅ Designed & Ready
**Migration:** `migrations/2026-01-20-rti-layer.sql`

The database schema implements the immutable data model:
*   `attention_policies`: Human-authored rules.
*   `attention_events`: Normalized return traffic (Immutable).
*   `attention_decisions`: Judgment log (Immutable/Append-Only).
*   `digests`: Periodic summaries.

**Action:** Execute migration `2026-01-20-rti-layer.sql` to initialize the RTI layer.

---

## 2. Service Architecture (The Plan)

The RTI layer will be implemented as a specialized service module: `@/lib/rti`.

### A. Type Definitions (`@/lib/rti/types.ts`)

```typescript
// Normalized attention event
export interface AttentionEvent {
  id: string
  organization_id: string
  event_type: 'call_completed' | 'alert_triggered' | 'webhook_failed' | ...
  source_table: string
  source_id: string
  occurred_at: string
  payload_snapshot: Record<string, any>
  input_refs: Array<{ table: string, id: string }>
}

// Policy definition
export interface AttentionPolicy {
  id: string
  policy_type: 'quiet_hours' | 'threshold' | 'recurring_suppress' | ...
  policy_config: Record<string, any>
  priority: number
}

// Decision result
export interface AttentionDecision {
  decision: 'escalate' | 'suppress' | 'include_in_digest' | 'needs_review'
  reason: string
  policy_id?: string
}
```

### B. Event Normalization (`@/lib/rti/eventIngest.ts`)

**Function:** `captureAttentionEvent(params: EventParams)`
*   **Purpose:** Ingests raw signals (e.g., from `processWebhookAsync` or `startCallHandler`) and normalizes them.
*   **Process:**
    1.  Validate input payload.
    2.  Construct `input_refs` from source.
    3.  Insert into `attention_events` (via `supabaseAdmin`).
    4.  **Trigger:** Asynchronously invoke `evaluatePoliciesForEvent(eventId)`.

### C. Policy Engine (`@/lib/rti/policyEngine.ts`)

**Function:** `evaluatePoliciesForEvent(eventId: string)`
*   **Purpose:** Applies active `attention_policies` to a new event.
*   **Logic:**
    1.  Fetch event details and active policies for the organization (ordered by priority).
    2.  Iterate through policies:
        *   **Quiet Hours:** Check `currentTime` vs `policy_config.schedule`.
        *   **Recurring Noise:** Query `attention_events` for recent duplicates of `source_id/event_type`.
        *   **Threshold:** Check `payload_snapshot.severity` vs `policy_config.threshold`.
    3.  **Result:** First decisive match determines outcome. Default: `needs_review`.
    4.  **Persist:** Insert into `attention_decisions`.
    5.  **Execute Side Effect:** If `decision === 'escalate'`, trigger Notification Service.

### D. Digest Generator (`@/lib/rti/digest.ts`)

**Function:** `generateDailyDigest(organizationId: string)`
*   **Purpose:** "Morning Clean Slate".
*   **Process:**
    1.  Query `attention_decisions` where `decision IN ('suppress', 'include_in_digest')` for the past 24h.
    2.  Group by Event Type / Policy.
    3.  Generate Summary Text (e.g., "15 recurring alerts suppressed").
    4.  Calculate Silence Metrics (Silence Rate).
    5.  Insert into `digests`.

---

## 3. Operational Flows (Processes)

### Process 1: The Attention Firewall (Real-time)
1.  **Source System** (e.g., SignalWire Webhook) detects failure.
2.  **Source** calls `captureAttentionEvent()`.
3.  **RTI** inserts `attention_event`.
4.  **RTI** runs `evaluatePoliciesForEvent()`.
5.  **Policy Engine** finds "Recurring Suppression" rule match.
6.  **RTI** inserts `attention_decision` (Suppress).
7.  **Result:** No notification sent. **Silence achieved.**

### Process 2: The Escalation Break-Through
1.  **Source System** detects Critical Severity Alert.
2.  **RTI** captures event.
3.  **Policy Engine** evaluates "Quiet Hours" -> No Match (Severity > Critical).
4.  **Policy Engine** evaluates "Escalation Threshold" -> Match!
5.  **RTI** inserts `attention_decision` (Escalate).
6.  **RTI** triggers `NotificationService.sendAlert()`.
7.  **User** notified immediately.

---

## 4. API Surface

These endpoints expose RTI to the frontend (Dashboard/Admin).

### A. Dashboard Feeds
*   `GET /api/rti/feed`
    *   Returns merged stream of Events + Decisions.
    *   Filters: `status=escalated`, `status=needs_review`.
*   `GET /api/rti/digests`
    *   Returns historical digests.

### B. Admin Management
*   `POST /api/rti/policies`
    *   Create/Update routing policies.
    *   RBAC: Owner/Admin only.
*   `GET /api/rti/metrics`
    *   Returns `Silence Rate`, `Unnecessary Escalation Rate`.

---

## 5. Security & Isolation

*   **RLS Implemented**: Schema enforces strict `organization_id` isolation.
*   **Immutable History**: Database triggers prevent modification of Events/Decisions, ensuring auditability.
*   **Attribution**: All decisions log `produced_by`.

---

## 6. Next Steps

1.  **Run Migration**: `npm run db:migrate` (or apply SQL).
2.  **Scaffold Service**: Create `lib/rti/` directory.
3.  **Implement Engine**: Write `policyEngine.ts`.
4.  **Wire Sources**: Connect `alert` triggers and `webhook` failures to RTI.
