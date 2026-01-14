# Tier 1 Features Migration Fix

## Problem
Running `2026-01-14-tier1-features.sql` failed with:
```
ERROR: 42703: column "organization_id" does not exist
```

## Root Cause
The migration assumes the `calls` table already has an `organization_id` column, but it doesn't exist in your database yet.

## Solution

### Option 1: Use Fixed Migration (Recommended)
The fixed migration checks for and adds the missing column automatically:

```bash
psql $SUPABASE_CONNECTION_STRING -f migrations/2026-01-14-tier1-features-fixed.sql
```

**What's Different:**
- Adds prerequisite check for `organization_id` column
- Creates it if missing before proceeding
- Uses `DROP POLICY IF EXISTS` to avoid conflicts
- Safe to run multiple times

---

## Option 2: Manual Two-Step Process

If you prefer to fix manually:

### Step 1: Add Missing Column
```sql
ALTER TABLE calls ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
```

### Step 2: Run Original Migration
```bash
psql $SUPABASE_CONNECTION_STRING -f migrations/2026-01-14-tier1-features.sql
```

---

## What Gets Created

This migration adds Tier 1 features to your database:

### 1. **Call Disposition** ✅
- `calls.disposition` - Outcome tagging (sale, no_answer, etc.)
- `calls.disposition_set_at` - Timestamp
- `calls.disposition_set_by` - User who set it
- `calls.disposition_notes` - Additional notes

### 2. **Call Notes** ✅
- New `call_notes` table
- Structured tags (checkboxes)
- Short notes (max 500 chars)
- Audit trail

### 3. **Consent Tracking** ✅
- `calls.consent_method` - How consent was obtained
- `calls.consent_timestamp` - When consent given
- `recordings.consent_captured` - Flag for evidence

### 4. **Webhook System** ✅
- `webhook_subscriptions` - Subscribe to events
- `webhook_deliveries` - Delivery tracking with retries
- Events: call.*, recording.*, transcript.*, etc.

### 5. **Feature Flags / Kill Switches** ✅
- `org_feature_flags` - Per-org feature control
- `global_feature_flags` - Platform-level emergency stop
- Usage limits (daily/monthly)

### 6. **WebRTC Sessions** ✅
- `webrtc_sessions` - Browser-based calling
- Connection state tracking
- Quality metrics (jitter, packet loss, etc.)

### 7. **Helper Functions** ✅
- `is_feature_enabled()` - Check if feature enabled
- `increment_feature_usage()` - Track usage against limits

---

## After Migration

### Verify Tables Created
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'call_notes',
  'webhook_subscriptions',
  'webhook_deliveries',
  'org_feature_flags',
  'global_feature_flags',
  'webrtc_sessions'
)
ORDER BY table_name;
```

**Expected Output:**
```
call_notes
global_feature_flags
org_feature_flags
webrtc_sessions
webhook_deliveries
webhook_subscriptions
```

### Verify Calls Table Columns
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'calls'
AND column_name IN (
  'organization_id',
  'disposition',
  'disposition_set_at',
  'consent_method',
  'consent_timestamp'
)
ORDER BY column_name;
```

---

## Using the New Features

### 1. Set Call Disposition
```sql
UPDATE calls 
SET 
  disposition = 'sale',
  disposition_set_at = NOW(),
  disposition_set_by = 'user-uuid',
  disposition_notes = 'Customer purchased premium plan'
WHERE id = 'call-uuid';
```

### 2. Add Call Note
```sql
INSERT INTO call_notes (call_id, organization_id, tags, note, created_by)
VALUES (
  'call-uuid',
  'org-uuid',
  ARRAY['objection_raised', 'pricing_discussed'],
  'Customer concerned about cost but interested',
  'user-uuid'
);
```

### 3. Create Webhook Subscription
```sql
INSERT INTO webhook_subscriptions (
  organization_id, 
  name, 
  url, 
  secret, 
  events
)
VALUES (
  'org-uuid',
  'CRM Integration',
  'https://your-domain.com/webhook/calls',
  'your-hmac-secret',
  ARRAY['call.completed', 'recording.available']
);
```

### 4. Check Feature Enabled
```sql
SELECT is_feature_enabled('org-uuid', 'recording');
-- Returns: true/false
```

### 5. Disable Feature for Org
```sql
INSERT INTO org_feature_flags (organization_id, feature, enabled)
VALUES ('org-uuid', 'recording', false)
ON CONFLICT (organization_id, feature) 
DO UPDATE SET enabled = false;
```

---

## API Integration

These features will need corresponding API endpoints:

### New Endpoints Needed:
1. ✅ `PUT /api/calls/:id/disposition` - Set disposition
2. ✅ `POST /api/calls/:id/notes` - Add note
3. ✅ `GET /api/calls/:id/notes` - List notes
4. ✅ `POST /api/webhooks` - Create subscription
5. ✅ `GET /api/webhooks` - List subscriptions
6. ✅ `GET /api/webhooks/:id/deliveries` - View delivery history
7. ✅ `GET /api/features` - List feature flags
8. ✅ `PUT /api/features/:feature` - Toggle feature
9. ✅ `POST /api/webrtc/session` - Create WebRTC session
10. ✅ `GET /api/webrtc/token` - Get JWT for browser calling

---

## Frontend UI Needed

### 1. Call Disposition Dropdown
```typescript
// After call ends, show dropdown
<select name="disposition">
  <option>sale</option>
  <option>no_answer</option>
  <option>voicemail</option>
  <option>not_interested</option>
  <option>follow_up</option>
  <option>callback_scheduled</option>
</select>
```

### 2. Call Notes Widget
```typescript
// Checkboxes + short text input
<div className="call-notes">
  <label><input type="checkbox" value="objection_raised" /> Objection Raised</label>
  <label><input type="checkbox" value="pricing_discussed" /> Pricing Discussed</label>
  <textarea maxLength={500} placeholder="Brief note..." />
</div>
```

### 3. Webhooks Management
- List subscriptions
- Create new webhook
- View delivery history
- Retry failed deliveries

### 4. Feature Flags Dashboard
- Toggle features on/off per org
- Set usage limits
- View current usage

---

## Status

**Migration**: ✅ Fixed and ready  
**Database Schema**: ✅ Complete  
**API Endpoints**: ⚠️ Need to be built  
**Frontend UI**: ⚠️ Need to be built  
**Documentation**: ✅ Complete

**Next Steps**:
1. Run fixed migration
2. Build API endpoints for new features
3. Build frontend UI components
4. Test with real calls

---

## Files

| File | Purpose |
|------|---------|
| `migrations/2026-01-14-tier1-features-fixed.sql` | Fixed migration (use this) |
| `migrations/2026-01-14-tier1-features.sql` | Original (has bug) |
| `TIER1_MIGRATION_FIX.md` | This documentation |

**Deploy Command:**
```bash
psql "$SUPABASE_URL" -f migrations/2026-01-14-tier1-features-fixed.sql
```
