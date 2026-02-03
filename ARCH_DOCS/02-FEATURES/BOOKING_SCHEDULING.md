# Cal.com-Style Booking & Scheduling Feature

**Last Updated:** January 27, 2026  
**Version:** 2.0.0  
**Status:** Implemented (AI Role Compliant)

> **AI Role Policy Reference:** [AI_ROLE_POLICY.md](../01-CORE/AI_ROLE_POLICY.md)

---

## ⚠️ AI Role Policy Compliance

Per the AI Role Policy:

1. **Recording disclosures** - All booked calls include recording disclosure
2. **Human agency** - Bookings are created by humans, not AI
3. **Confirmation capture** - If call modulations are enabled, operators capture confirmations
4. **No AI negotiation** - AI never negotiates on scheduled calls

### Booked Call Flow (AI Role Compliant)

```
1. Human creates booking (UI/Extension)
2. System schedules call (cron)
3. Call connects with recording disclosure  ← AI Role Phase 1
4. Human-to-human conversation
5. Operator uses confirmation prompts       ← AI Role Phase 2
6. Operator declares outcome                ← AI Role Phase 3
```

---

## Overview

The Booking & Scheduling feature provides Cal.com-style appointment booking that automatically triggers calls at scheduled times. This enables:

- **Scheduled Follow-up Calls** - Book calls for future execution
- **Automatic Call Origination** - Vercel Cron triggers calls at scheduled time
- **Attendee Management** - Track name, email, phone for each booking
- **Call Linking** - Bookings are linked to resulting calls for full audit trail

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Booking & Scheduling Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User creates booking via UI/Extension                           │
│     └──> POST /api/bookings                                        │
│     └──> booking_events.insert({ status: 'pending' })              │
│                                                                     │
│  2. Vercel Cron runs every minute                                  │
│     └──> GET /api/cron/scheduled-calls                             │
│     └──> SELECT * FROM booking_events WHERE status='pending'       │
│         AND start_time BETWEEN now() AND now()+1min                │
│                                                                     │
│  3. For each due booking:                                           │
│     └──> UPDATE booking_events SET status='calling'                │
│     └──> startCallHandler() via SignalWire                         │
│     └──> UPDATE booking_events SET call_id=X, status='completed'   │
│                                                                     │
│  4. Call executes normally                                          │
│     └──> Recording, transcription, translation (per voice_configs) │
│     └──> SignalWire webhook updates call status                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### booking_events table

```sql
CREATE TABLE public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  call_id uuid REFERENCES calls(id),  -- Links to resulting call
  
  -- Booking details
  title text NOT NULL,
  description text,
  
  -- Scheduling
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  timezone text DEFAULT 'UTC',
  
  -- Attendee info
  attendee_name text,
  attendee_email text,
  attendee_phone text NOT NULL,  -- Required for calling
  
  -- Status: pending → calling → completed/failed/cancelled
  status text NOT NULL DEFAULT 'pending',
  
  -- Reminders
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamptz,
  
  -- Call modulations override
  modulations jsonb DEFAULT '{}',
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);
```

### organizations additions

```sql
ALTER TABLE public.organizations 
  ADD COLUMN default_booking_duration integer DEFAULT 30,
  ADD COLUMN booking_enabled boolean DEFAULT false;
```

---

## API Endpoints

### GET /api/bookings

List bookings for the user's organization.

**Query Parameters:**
- `status` - Filter by status (pending, completed, etc.)
- `from` - Filter by start_time >= date
- `to` - Filter by start_time <= date
- `limit` - Max results (default 50)
- `offset` - Pagination offset

**Response:**
```json
{
  "success": true,
  "bookings": [
    {
      "id": "uuid",
      "title": "Follow-up Call",
      "start_time": "2026-01-15T10:00:00Z",
      "attendee_name": "John Doe",
      "attendee_phone": "+1234567890",
      "status": "pending"
    }
  ]
}
```

### POST /api/bookings

Create a new booking.

**Body:**
```json
{
  "title": "Follow-up Call",
  "description": "Discuss proposal",
  "start_time": "2026-01-15T10:00:00Z",
  "duration_minutes": 30,
  "attendee_name": "John Doe",
  "attendee_email": "john@example.com",
  "attendee_phone": "+1234567890",
  "notes": "Internal notes"
}
```

### PATCH /api/bookings/[id]

Update a booking (reschedule, update details).

### DELETE /api/bookings/[id]

Cancel a booking (sets status to 'cancelled').

### GET /api/cron/scheduled-calls

Vercel Cron endpoint that processes due bookings.

**Security:** Requires `CRON_SECRET` in production.

---

## RBAC & Plan Gating

Booking feature requires **Business** or **Enterprise** plan.

```typescript
// lib/rbac.ts
FEATURE_PLANS = {
  'booking': ['business', 'enterprise'],
}

ROLE_PERMISSIONS = {
  owner: { 'booking': ['read', 'write', 'execute'] },
  admin: { 'booking': ['read', 'write', 'execute'] },
  operator: { 'booking': ['read', 'write', 'execute'] },
  analyst: { 'booking': ['read'] },
  viewer: { 'booking': ['read'] },
}
```

---

## UI Components

### BookingModal

Located at `components/voice/BookingModal.tsx`

- Form for creating new bookings
- Date/time picker
- Duration selection
- Attendee details

### BookingsList

Located at `components/voice/BookingsList.tsx`

- List of upcoming bookings
- Status indicators
- Click to view details

---

## Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/scheduled-calls",
      "schedule": "* * * * *"
    }
  ]
}
```

**Environment Variables:**
- `CRON_SECRET` - Required for production security

---

## Chrome Extension Integration

The Chrome extension supports booking:

1. **Popup** - "📅 Schedule" button opens scheduling page
2. **Context Menu** - Right-click phone number → "Schedule Call"
3. **Click-to-Call** - Tooltip shows "Schedule" option

---

## Security

- **Authentication** - All endpoints require session auth
- **Authorization** - Only org members can access bookings
- **Cron Security** - `CRON_SECRET` header required in production
- **Plan Gating** - Feature only available on Business+ plans

---

## Future Enhancements

- [ ] Calendar sync (Google/Outlook OAuth)
- [ ] Email confirmations to attendees
- [ ] SMS reminders before calls
- [ ] Round-robin team scheduling
- [ ] Timezone auto-detection
- [ ] Recurring bookings
- [ ] Public booking page (like Cal.com)

---

## AI Role Policy Integration

When a booked call executes, the following AI Role features apply automatically:

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Recording disclosure | ✅ Automatic at call start |
| Phase 2 | Confirmation prompts | ✅ Available to operator |
| Phase 3 | Outcome declaration | ✅ Available post-call |
| Phase 4 | QA restrictions | ✅ If QA modulation enabled |

The booking system respects all call modulation settings from `voice_configs`:
- Recording disclosure is always given
- Survey disclaimers apply if after-call survey enabled
- Translation disclosures apply if live translation enabled

---

## References

- **AI Role Policy:** [ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md](../01-CORE/AI_ROLE_POLICY.md)
- MASTER_ARCHITECTURE.txt: Call-rooted design
- lib/rbac.ts: Feature gating
- vercel.json: Cron configuration
