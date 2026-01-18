# Database Schema Validation Report

**Generated:** 2026-01-27  
**Status:** ✅ All Issues Fixed  
**Build Status:** ✅ Compiles Successfully

---

## Executive Summary

A comprehensive deep validation was performed across all API routes and services to ensure table names, column names, and field references match the production database schema. Several critical mismatches were discovered and fixed.

---

## Issues Found & Fixed

### 1. ❌ → ✅ `app/api/reports/schedules/route.ts`

**Issue:** Column name mismatches in POST endpoint

| Line | Code Used | DB Has | Status |
|------|-----------|--------|--------|
| 97 | `cron_pattern` | `schedule_pattern` | ✅ Fixed |
| 101 | `next_run` | `next_run_at` | ✅ Fixed |
| - | Missing | `name` (required) | ✅ Fixed |

**Fix Applied:**
```typescript
// Before
.insert({
  cron_pattern: cronPattern,
  next_run: nextRun,
  // missing 'name' field
})

// After
.insert({
  name: template.name || 'Scheduled Report', // Required field
  schedule_pattern: cronPattern, // Fixed column name
  next_run_at: nextRun, // Fixed column name
})
```

---

### 2. ❌ → ✅ `app/api/cron/scheduled-reports/route.ts`

**Issue A:** Column name mismatches (already fixed in previous session)

| Line | Code Used | DB Has | Status |
|------|-----------|--------|--------|
| 60 | `next_run` | `next_run_at` | ✅ Fixed |
| 116 | `cron_pattern` | `schedule_pattern` | ✅ Fixed |
| 182-183 | `last_run`, `next_run` | `last_run_at`, `next_run_at` | ✅ Fixed |

**Issue B:** Non-existent columns used

| Line | Code Used | Reality | Status |
|------|-----------|---------|--------|
| 147 | `report_type` | Not in `generated_reports` | ✅ Fixed - Removed |
| 148-149 | `date_range_start/end` | Not in schema | ✅ Fixed - Moved to `parameters` |
| 150 | `generated_by: null` | Column is NOT NULL | ✅ Fixed - Use `created_by` |
| 184 | `last_report_id` | Not in `scheduled_reports` | ✅ Fixed - Removed |
| 199 | `last_error` | Not in schema | ✅ Fixed - Removed |

**Fix Applied:**
```typescript
// generated_reports insert - Before
.insert({
  report_type: reportType,       // ❌ Column doesn't exist
  date_range_start: start_date,  // ❌ Column doesn't exist
  date_range_end: end_date,      // ❌ Column doesn't exist
  generated_by: null,            // ❌ NOT NULL violation
})

// After
.insert({
  name: `${report_templates.name} - ${start_date.split('T')[0]}`, // Required
  parameters: { date_range: { start: start_date, end: end_date } }, // Correct field
  generated_by: scheduledReport.created_by, // Valid user
})

// scheduled_reports update - Before
.update({
  last_report_id: generatedReport.id, // ❌ Column doesn't exist
  last_error: error.message,          // ❌ Column doesn't exist
})

// After
.update({
  last_run_at: new Date().toISOString(),
  next_run_at: nextRun,
  updated_at: new Date().toISOString(),
})
```

---

## Tables Verified ✅

### Core Tables (Schema.txt confirmed)

| Table | Status | Notes |
|-------|--------|-------|
| `users` | ✅ | All API references valid |
| `organizations` | ✅ | All API references valid |
| `org_members` | ✅ | All API references valid |
| `calls` | ✅ | All API references valid |
| `recordings` | ✅ | All API references valid |
| `ai_runs` | ✅ | All API references valid |
| `voice_configs` | ✅ | Includes `live_translate` column |
| `audit_logs` | ✅ | All API references valid |

### Billing Tables (Stripe)

| Table | Status | Notes |
|-------|--------|-------|
| `stripe_subscriptions` | ✅ | Used correctly in billing routes |
| `stripe_invoices` | ✅ | Used correctly in webhook handlers |
| `stripe_payment_methods` | ✅ | Used correctly |
| `stripe_events` | ✅ | Used correctly |
| `usage_records` | ✅ | Correct columns in usageTracker.ts |
| `usage_limits` | ✅ | Correct columns |

### Report Tables

| Table | Status | Notes |
|-------|--------|-------|
| `report_templates` | ✅ | All references valid |
| `generated_reports` | ✅ | Fixed - requires `name` |
| `scheduled_reports` | ✅ | Fixed - uses correct column names |
| `report_access_log` | ✅ | Used correctly |

### Campaign Tables

| Table | Status | Notes |
|-------|--------|-------|
| `campaigns` | ✅ | All references valid |
| `campaign_calls` | ✅ | All references valid |
| `campaign_audit_log` | ✅ | All references valid |
| `caller_id_numbers` | ✅ | All references valid |

### Webhook Tables

| Table | Status | Notes |
|-------|--------|-------|
| `webhook_subscriptions` | ✅ | All references valid |
| `webhook_deliveries` | ✅ | All references valid |
| `webhook_failures` | ✅ | All references valid |

### Feature Flag Tables

| Table | Status | Notes |
|-------|--------|-------|
| `global_feature_flags` | ✅ | Used in features route |
| `org_feature_flags` | ✅ | Used in features route |

### SSO Tables

| Table | Status | Notes |
|-------|--------|-------|
| `org_sso_configs` | ✅ | Used in SSO service |
| `sso_login_events` | ✅ | Used in SSO service |

### WebRTC Tables

| Table | Status | Notes |
|-------|--------|-------|
| `webrtc_sessions` | ✅ | Used in webrtc routes |

### Evidence/Compliance Tables

| Table | Status | Notes |
|-------|--------|-------|
| `evidence_manifests` | ✅ | All references valid |
| `evidence_bundles` | ✅ | All references valid |
| `transcript_versions` | ✅ | Used in evidenceManifest.ts |
| `artifact_provenance` | ✅ | Used in evidenceManifest.ts |
| `call_notes` | ✅ | Used in calls API |
| `scored_recordings` | ✅ | Used in scoring service |
| `call_confirmations` | ✅ | Used in confirmations API |
| `call_outcomes` | ✅ | Used in outcome API |
| `call_outcome_history` | ✅ | Used in outcome API |
| `ai_summaries` | ✅ | Used in summary API |

---

## Voice Config Column Verification

The `voice_configs` table columns were verified:

```sql
-- From Schema.txt (confirmed exists)
live_translate boolean DEFAULT false      -- ✅ Exists
translate boolean DEFAULT false           -- ✅ Exists
translate_from text                       -- ✅ Exists
translate_to text                         -- ✅ Exists
record boolean DEFAULT false              -- ✅ Exists
transcribe boolean DEFAULT false          -- ✅ Exists
survey boolean DEFAULT false              -- ✅ Exists
synthetic_caller boolean DEFAULT false    -- ✅ Exists
```

All API routes use these columns correctly.

---

## Scheduled Reports Column Verification

The `scheduled_reports` table columns:

```sql
-- From 20260117000001_reports.sql
id UUID PRIMARY KEY                       -- ✅
template_id UUID NOT NULL                 -- ✅
organization_id UUID NOT NULL             -- ✅
name TEXT NOT NULL                        -- ✅ Required
schedule_pattern TEXT NOT NULL            -- ✅ (NOT cron_pattern)
schedule_time TIME                        -- ✅
schedule_days INTEGER[]                   -- ✅
timezone TEXT                             -- ✅
delivery_method TEXT                      -- ✅
delivery_config JSONB                     -- ✅
is_active BOOLEAN                         -- ✅
last_run_at TIMESTAMPTZ                   -- ✅ (NOT last_run)
next_run_at TIMESTAMPTZ                   -- ✅ (NOT next_run)
created_by UUID NOT NULL                  -- ✅
created_at TIMESTAMPTZ                    -- ✅
updated_at TIMESTAMPTZ                    -- ✅
```

**Missing from schema (code removed references):**
- `last_report_id` - Not in schema
- `last_error` - Not in schema

---

## Build Verification

```
✅ Next.js 14.2.35
✅ Compiled successfully
✅ Linting and checking validity of types - PASSED
✅ Generating static pages (25/25)
✅ All API routes compiled
```

---

## Recommendations

### Optional Schema Enhancements

If you want to track the last report generated and errors, add a migration:

```sql
-- Optional: Add tracking columns to scheduled_reports
ALTER TABLE scheduled_reports 
  ADD COLUMN IF NOT EXISTS last_report_id UUID REFERENCES generated_reports(id),
  ADD COLUMN IF NOT EXISTS last_error TEXT;
```

### Code Quality

1. ✅ All table names are valid
2. ✅ All column names are valid
3. ✅ Required fields are provided
4. ✅ NOT NULL constraints are respected
5. ✅ Foreign key references are valid

---

## Files Modified in This Validation

| File | Changes |
|------|---------|
| `app/api/reports/schedules/route.ts` | Fixed column names, added `name` field |
| `app/api/cron/scheduled-reports/route.ts` | Fixed column names, removed non-existent columns |

---

## Validation Complete

All identified database schema mismatches have been corrected. The codebase now uses correct table and column names that match the production database schema.
