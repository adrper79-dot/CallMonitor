# Schema Drift Analysis Report

**Generated:** 2026-02-04  
**Status:** Action Required

## Executive Summary

The codebase has **significant schema drift** from `schema.sql`. Multiple code files reference tables and columns that don't exist in the documented schema. A comprehensive migration file has been created to fix this.

---

## CRITICAL: Missing Tables

| Table                  | Used In        | Purpose                           |
| ---------------------- | -------------- | --------------------------------- |
| `call_outcomes`        | `calls.ts`     | Store call outcome declarations   |
| `ai_summaries`         | `calls.ts`     | Store AI-generated call summaries |
| `usage_stats`          | `scheduled.ts` | Daily aggregated usage metrics    |
| `billing_events`       | `webhooks.ts`  | Stripe billing event log          |
| `call_outcome_history` | `calls.ts`     | Audit trail for outcome changes   |

---

## Column Mismatches by Table

### `users` Table

| Column             | In Schema | In Code          | Fix                |
| ------------------ | --------- | ---------------- | ------------------ |
| `password_hash`    | ❌        | ✅ `auth.ts:152` | Added in migration |
| `organization_id`  | ❌        | ✅ `auth.ts`     | Added in migration |
| `role`             | ❌        | ✅               | Added in migration |
| `is_admin`         | ❌        | ✅               | Added in migration |
| `created_at`       | ❌        | ✅ `auth.ts:152` | Added in migration |
| `updated_at`       | ❌        | ✅ `auth.ts:152` | Added in migration |
| `normalized_email` | ❌        | ✅               | Added in migration |

### `calls` Table

| Column         | In Schema | In Code | Fix                |
| -------------- | --------- | ------- | ------------------ |
| `phone_number` | ❌        | ✅      | Added in migration |
| `from_number`  | ❌        | ✅      | Added in migration |
| `direction`    | ❌        | ✅      | Added in migration |
| `flow_type`    | ❌        | ✅      | Added in migration |
| `user_id`      | ❌        | ✅      | Added in migration |
| `created_at`   | ❌        | ✅      | Added in migration |
| `updated_at`   | ❌        | ✅      | Added in migration |

### `organizations` Table

| Column       | In Schema | In Code          | Fix                               |
| ------------ | --------- | ---------------- | --------------------------------- |
| `owner_id`   | ❌        | ✅ `auth.ts:207` | ⚠️ Code fixed to use `created_by` |
| `updated_at` | ❌        | ✅               | Added in migration                |
| `slug`       | ❌        | ✅               | Added in migration                |

### `ai_runs` Table

| Column              | In Schema | In Code | Fix                |
| ------------------- | --------- | ------- | ------------------ |
| `organization_id`   | ❌        | ✅      | Added in migration |
| `error`             | ❌        | ✅      | Added in migration |
| `assemblyai_status` | ❌        | ✅      | Added in migration |
| `purpose`           | ❌        | ✅      | Added in migration |
| `input`             | ❌        | ✅      | Added in migration |
| `created_at`        | ❌        | ✅      | Added in migration |
| `updated_at`        | ❌        | ✅      | Added in migration |

---

## Code Files Fixed

| File                           | Issue                                   | Status   |
| ------------------------------ | --------------------------------------- | -------- |
| `workers/src/routes/webrtc.ts` | INSERT used non-existent columns        | ✅ Fixed |
| `workers/src/routes/calls.ts`  | INSERT used non-existent columns        | ✅ Fixed |
| `workers/src/routes/auth.ts`   | Used `owner_id` instead of `created_by` | ✅ Fixed |

---

## Migration File Created

**File:** `migrations/2026-02-04-schema-alignment-comprehensive.sql`

This comprehensive migration:

1. Adds missing columns to `users`, `calls`, `organizations`, `ai_runs`, `booking_events`, `campaigns`, `recordings`
2. Creates missing tables: `call_outcomes`, `call_outcome_history`, `ai_summaries`, `usage_stats`, `billing_events`
3. Adds all necessary indexes
4. Creates `updated_at` triggers

---

## Action Required

### Option 1: Run Migration on Production (Recommended)

```bash
# Connect to Neon and run the migration
psql $DATABASE_URL -f migrations/2026-02-04-schema-alignment-comprehensive.sql
```

### Option 2: Regenerate schema.sql from Production

If migrations have already been applied to production but not reflected in `schema.sql`:

```bash
pg_dump $DATABASE_URL --schema-only > schema.sql
```

---

## Root Cause Analysis

The `schema.sql` file was generated at a point in time and not kept in sync as migrations were added. Multiple migration files exist in `migrations/` that have (presumably) been applied to production:

- `2026-01-26-add-user-auth-columns.sql`
- `2026-02-02-schema-drift-fixes.sql`

But `schema.sql` was never regenerated to reflect these changes.

---

## Recommendation

1. **Run** `2026-02-04-schema-alignment-comprehensive.sql` on Neon production
2. **Regenerate** `schema.sql` from production: `pg_dump --schema-only`
3. **Add CI check** to prevent schema.sql drift in future
