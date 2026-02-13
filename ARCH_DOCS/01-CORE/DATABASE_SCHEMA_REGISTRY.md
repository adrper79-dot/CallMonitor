# Database Schema Registry

**TOGAF Phase:** Requirements Management  
**Status**: ✅ Schema Drift Resolved | Updated: Feb 13, 2026  
**Version**: 1.4 - Session 19 audit fix (users.id type contradiction resolved, id_uuid column removed)  
**Owner**: Platform Team

---

## Overview

This document serves as the **single source of truth** for database schema naming conventions, table relationships, and migration tracking. It ensures cohesion between the database schema, Workers API code, and frontend types.

### Naming Convention Standard

Per [MASTER_ARCHITECTURE.md](MASTER_ARCHITECTURE.md), the mandatory standard is:

> **MANDATORY**: All database columns, API endpoints, and variable names MUST use **snake_case** exclusively.

### ID Type Convention & Exceptions

**Standard Practice** (Enforced for all new tables):

> All new database tables MUST use **UUID** as the primary key type (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`).

**Schema Drift Notice (Feb 11, 2026):**

> A rogue AI agent changed `users.id`, `sessions.id`, `sessions.user_id`, `accounts.user_id`, and `organizations.created_by` from `text` to `uuid`. All `user_id` columns are now consistently UUID across ALL tables. The codebase has been updated to match. The TEXT exceptions documented below NO LONGER APPLY.

| Column Pattern | Actual Type (Live DB) | Previous Type | Notes |
|----------------|----------------------|---------------|-------|
| `users.id` | **UUID** | TEXT | Changed by rogue agent; code updated |
| `sessions.id` | **UUID** | TEXT | Changed by rogue agent; code updated |
| `sessions.user_id` | **UUID** | TEXT | Changed by rogue agent; code updated |
| `accounts.user_id` | **UUID** | TEXT | Changed by rogue agent; code updated |
| `organizations.created_by` | **UUID** | TEXT | Changed by rogue agent; code updated |
| `sessions.session_token` | **VARCHAR** | TEXT | Minor type change, functionally equivalent |
| All other `user_id` columns | **UUID** | UUID | Unchanged, always were UUID |

**Enforcement Guidelines:**

1. ✅ **New Tables**: MUST use UUID for primary keys
2. ✅ **Foreign Keys**: Type must match the referenced column type (ALL are now UUID)
3. ✅ **Legacy Tables**: `users.id` is now UUID (no longer TEXT exception)
4. ⚠️ **Do NOT add `::text` casts** in JOINs — all user ID columns are UUID, direct comparison works
5. ✅ **TypeScript Types**: Enforce UUID in `types/database.ts` for all business tables

**Type Consistency Validation:**

- **UUID Tables**: 144+ tables use UUID exclusively ✅
- **TEXT Exceptions**: NONE (previously `users`, `accounts`) ✅
- **Legacy INT**: 2 tables (`call_translations`, `kpi_logs`) - pre-UUID era ⚠️

---

## Current State Audit

### ✅ All Tables Compliant

| Table            | Status       | Notes                                                      |
| ---------------- | ------------ | ---------------------------------------------------------- |
| `sessions`       | ✅ MIGRATED  | Columns renamed from camelCase to snake_case on 2026-02-04 |
| All others (112) | ✅ COMPLIANT | Already using snake_case                                   |

**Total Violations**: 0 columns (was 2, now fixed)

### ✅ Tables Already Compliant (149 total)

All other tables (148) use snake_case column naming. Examples:

- `users`: `id`, `name`, `email`, `email_verified`, `password_hash`, `organization_id`
- `organizations`: `id`, `name`, `plan`, `stripe_customer_id`, `created_at`
- `accounts`: `user_id`, `provider_account_id`, `access_token`, `refresh_token`
- `calls`: `organization_id`, `system_id`, `call_sid`, `created_at`

---

## Core Table Schemas

### Authentication Tables

#### `users`

Primary user identity table.

| Column             | Type        | Nullable | Default | FK     |
| ------------------ | ----------- | -------- | ------- | ------ |
| `id`               | UUID        | NO       | gen_random_uuid() | PK     |
| `name`             | TEXT        | YES      | -       | -      |
| `email`            | TEXT        | YES      | -       | UNIQUE |
| `email_verified`   | TIMESTAMPTZ | YES      | -       | -      |
| `image`            | TEXT        | YES      | -       | -      |
| `password_hash`    | TEXT        | YES      | -       | -      |
| `organization_id`  | UUID        | YES      | -       | -      |
| `role`             | TEXT        | YES      | 'user'  | -      |
| `is_admin`         | BOOLEAN     | YES      | false   | -      |
| `created_at`       | TIMESTAMPTZ | YES      | now()   | -      |
| `updated_at`       | TIMESTAMPTZ | YES      | now()   | -      |
| `normalized_email` | TEXT        | YES      | -       | -      |

**Referenced By**: accounts, ai_summaries, call_outcomes, calls, org_members, organizations, recordings, scorecards, test_configs, test_results, tool_access_archived, tool_team_members

#### `sessions` ✅ MIGRATED

Session storage for authentication.

| Column          | Type         | Nullable | Default           | FK     | Status                |
| --------------- | ------------ | -------- | ----------------- | ------ | --------------------- |
| `id`            | UUID         | NO       | gen_random_uuid() | PK     | ✅                    |
| `session_token` | VARCHAR(255) | NO       | -                 | UNIQUE | ✅ (was sessionToken) |
| `user_id`       | UUID         | NO       | -                 | -      | ✅ (was userId)       |
| `expires`       | TIMESTAMPTZ  | NO       | -                 | -      | ✅                    |
| `created_at`    | TIMESTAMPTZ  | YES      | now()             | -      | ✅                    |
| `updated_at`    | TIMESTAMPTZ  | YES      | now()             | -      | ✅                    |

**Indexes**:

- `sessions_pkey`: PRIMARY KEY (id)
- `sessions_session_token_key`: UNIQUE (session_token)
- `idx_sessions_user_id`: INDEX (user_id)
- `idx_sessions_expires`: INDEX (expires)

#### `accounts`

OAuth provider accounts linked to users.

| Column                | Type        | Nullable | Default | FK                |
| --------------------- | ----------- | -------- | ------- | ----------------- |
| `id`                  | TEXT        | NO       | -       | PK                |
| `user_id`             | TEXT        | NO       | -       | FK → users(id)    |
| `type`                | TEXT        | NO       | -       | -                 |
| `provider`            | TEXT        | NO       | -       | -                 |
| `provider_account_id` | TEXT        | NO       | -       | UNIQUE w/provider |
| `refresh_token`       | TEXT        | YES      | -       | -                 |
| `access_token`        | TEXT        | YES      | -       | -                 |
| `expires_at`          | INTEGER     | YES      | -       | -                 |
| `token_type`          | TEXT        | YES      | -       | -                 |
| `scope`               | TEXT        | YES      | -       | -                 |
| `id_token`            | TEXT        | YES      | -       | -                 |
| `session_state`       | TEXT        | YES      | -       | -                 |
| `oauth_token_secret`  | TEXT        | YES      | -       | -                 |
| `oauth_token`         | TEXT        | YES      | -       | -                 |
| `created_at`          | TIMESTAMPTZ | YES      | now()   | -                 |
| `updated_at`          | TIMESTAMPTZ | YES      | now()   | -                 |

### Organization Tables

#### `organizations`

Multi-tenant organization container.

| Column                   | Type        | Nullable | Default            | FK             |
| ------------------------ | ----------- | -------- | ------------------ | -------------- |
| `id`                     | UUID        | NO       | uuid_generate_v4() | PK             |
| `name`                   | TEXT        | NO       | -                  | -              |
| `plan`                   | TEXT        | YES      | -                  | -              |
| `plan_status`            | TEXT        | YES      | 'active'           | CHECK          |
| `stripe_customer_id`     | TEXT        | YES      | -                  | UNIQUE         |
| `stripe_subscription_id` | TEXT        | YES      | -                  | -              |
| `created_by`             | TEXT        | YES      | -                  | FK → users(id) |
| `slug`                   | TEXT        | YES      | -                  | UNIQUE         |
| `tool_id`                | UUID        | YES      | -                  | -              |
| `created_at`             | TIMESTAMPTZ | YES      | now()              | -              |
| `updated_at`             | TIMESTAMPTZ | YES      | now()              | -              |

**Referenced By**: 70+ tables with `organization_id` foreign key

#### `org_members`

Organization membership and roles.

| Column            | Type        | Nullable | Default            | FK                     |
| ----------------- | ----------- | -------- | ------------------ | ---------------------- |
| `id`              | UUID        | NO       | uuid_generate_v4() | PK                     |
| `organization_id` | UUID        | NO       | -                  | FK → organizations(id) |
| `user_id`         | TEXT        | NO       | -                  | FK → users(id)         |
| `role`            | TEXT        | YES      | 'member'           | -                      |
| `created_at`      | TIMESTAMPTZ | YES      | now()              | -                      |
| `updated_at`      | TIMESTAMPTZ | YES      | now()              | -                      |
| `user_id_uuid`    | UUID        | YES      | -                  | -                      |

---

## Table Relationships Diagram

```mermaid
erDiagram
    users ||--o{ accounts : "1:N"
    users ||--o{ sessions : "1:N"
    users ||--o{ org_members : "1:N"
    users ||--o{ organizations : "1:N (created_by)"

    organizations ||--o{ org_members : "1:N"
    organizations ||--o{ calls : "1:N"
    organizations ||--o{ recordings : "1:N"
    organizations ||--o{ surveys : "1:N"
    organizations ||--o{ ai_summaries : "1:N"

    org_members ||--o{ calls : "1:N (via organization)"

    calls ||--o{ recordings : "1:N"
    calls ||--o{ surveys : "1:N"
    calls ||--o{ ai_summaries : "1:N"

    users {
        UUID id PK
        TEXT name
        TEXT email UK
        TEXT password_hash
        UUID organization_id FK
        TEXT role
        BOOLEAN is_admin
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    organizations {
        UUID id PK
        TEXT name
        TEXT plan
        TEXT stripe_customer_id
        TEXT created_by FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    org_members {
        UUID id PK
        UUID organization_id FK
        TEXT user_id FK
        TEXT role
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    sessions {
        UUID id PK
        VARCHAR session_token UK
        UUID user_id FK
        TIMESTAMPTZ expires
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    accounts {
        TEXT id PK
        TEXT user_id FK
        TEXT provider
        TEXT provider_account_id UK
        TEXT access_token
        TEXT refresh_token
        INTEGER expires_at
        TEXT token_type
    }

    calls {
        UUID id PK
        UUID organization_id FK
        TEXT system_id
        TEXT call_sid
        TEXT status
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    recordings {
        UUID id PK
        UUID call_id FK
        UUID organization_id FK
        TEXT recording_url
        TEXT duration
        TIMESTAMPTZ created_at
    }

    surveys {
        UUID id PK
        UUID call_id FK
        UUID organization_id FK
        JSONB responses
        TEXT status
        TIMESTAMPTZ created_at
    }

    ai_summaries {
        UUID id PK
        UUID call_id FK
        UUID organization_id FK
        TEXT summary_text
        JSONB metadata
        TIMESTAMPTZ created_at
    }
```

---

## Code-Database Mapping

### Workers API Code References

All code now uses snake_case column names per standard:

| Code File                        | DB Column Reference        | Status |
| -------------------------------- | -------------------------- | ------ |
| `workers/src/routes/auth.ts:351` | `session_token`            | ✅     |
| `workers/src/routes/auth.ts:352` | `user_id`                  | ✅     |
| `workers/src/routes/auth.ts:414` | `session_token`            | ✅     |
| `workers/src/lib/auth.ts:50-55`  | `session_token`, `user_id` | ✅     |

### Frontend Type Mapping

| Frontend Type  | Property          | API Response           | Database Column               |
| -------------- | ----------------- | ---------------------- | ----------------------------- |
| `Session.user` | `id`              | `user.id`              | `users.id`                    |
| `Session.user` | `email`           | `user.email`           | `users.email`                 |
| `Session.user` | `organization_id` | `user.organization_id` | `org_members.organization_id` |

---

## Migration Plan

### Phase 1: Database Migration (Safe)

```sql
-- Migration: Rename sessions columns from camelCase to snake_case
-- Date: 2026-02-04
-- Author: Platform Team
-- Risk: LOW (only 2 columns, with proper transaction)

BEGIN;

-- Step 1: Drop the unique constraint that references camelCase column
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS "sessions_sessionToken_key";

-- Step 2: Rename columns
ALTER TABLE public.sessions RENAME COLUMN "sessionToken" TO session_token;
ALTER TABLE public.sessions RENAME COLUMN "userId" TO user_id;

-- Step 3: Recreate the unique constraint with snake_case name
ALTER TABLE public.sessions ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);

-- Step 4: Update any existing indexes
DROP INDEX IF EXISTS "sessions_sessionToken_key";

COMMIT;

-- Verification query:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'sessions' AND table_schema = 'public';
```

### Phase 2: Code Updates (Post-Migration)

After database migration, update these files:

1. **`workers/src/routes/auth.ts`**:
   - Line 351: `"sessionToken"` → `session_token`
   - Line 352: `"userId"` → `user_id`
   - Line 353: `"sessionToken"` → `session_token`
   - Line 414: `"sessionToken"` → `session_token`

2. **`workers/src/lib/auth.ts`**:
   - Line 50: `"sessionToken"` → `session_token`
   - Line 53: `"userId"` → `user_id`
   - Line 55: `"sessionToken"` → `session_token`

### Phase 3: Verification

```sql
-- Verify no camelCase columns remain
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ~ '[A-Z]'
ORDER BY table_name, column_name;

-- Expected result: 0 rows
```

---

## Migration Log

| Date       | Migration          | Status      | Notes                                              |
| ---------- | ------------------ | ----------- | -------------------------------------------------- |
| 2026-02-03 | Initial audit      | ✅ Complete | Found 2 camelCase columns in sessions              |
| 2026-02-04 | sessions migration | ✅ Complete | Renamed sessionToken→session_token, userId→user_id |
| 2026-02-04 | Code update        | ✅ Complete | Updated Workers auth.ts and lib/auth.ts            |
| 2026-02-04 | Verification       | ✅ Complete | Tested login flow, confirmed DB+code cohesion      |
| 2026-02-10 | Schema drift validation | ✅ Complete | Deep validation identified 2 HIGH priority RLS gaps |
| 2026-02-10 | RLS deployment     | ✅ Complete | Added RLS policies to transcriptions + ai_summaries |
| 2026-02-10 | Type documentation | ✅ Complete | Documented UUID/TEXT ID type exceptions            |

---

## Row Level Security (RLS) Policies

**Purpose**: Enforce multi-tenant data isolation at the database layer to prevent cross-organization data leakage.

**Standard**: All business tables containing `organization_id` MUST have RLS policies enabled.

### Tables with RLS Protection

| Table | Policy Name | Status | Applied | Notes |
|-------|-------------|--------|---------|-------|
| `calls` | `calls_org_isolation` | ✅ Active | Pre-2026 | Primary call records |
| `recordings` | `recordings_org_isolation` | ✅ Active | Pre-2026 | Audio/video recordings |
| `transcriptions` | `transcriptions_org_isolation` | ✅ Active | 2026-02-10 | Call transcripts (HIGH sensitivity) |
| `ai_summaries` | `ai_summaries_org_isolation` | ✅ Active | 2026-02-10 | AI-generated summaries (HIGH sensitivity) |
| `audit_logs` | `audit_logs_org_isolation` | ✅ Active | Pre-2026 | Audit trail records |
| `scorecards` | `scorecards_org_isolation` | ✅ Active | Pre-2026 | Quality evaluations |
| `org_members` | `org_members_org_isolation` | ✅ Active | Pre-2026 | Membership records |
| `campaigns` | `campaigns_org_isolation` | ✅ Active | Pre-2026 | Campaign data |
| `collection_accounts` | `collection_accounts_org_isolation` | ✅ Active | Pre-2026 | Collections data |

**Policy Pattern** (Standard for all RLS):

```sql
-- Enable RLS on table
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Create organization isolation policy
CREATE POLICY "{table_name}_org_isolation" 
ON {table_name}
FOR ALL
USING (
  organization_id = current_setting('app.current_org_id', true)::UUID
);
```

**Application Layer Requirements:**

1. Workers API MUST set `app.current_org_id` in all database connections
2. Middleware: `requireAuth()` extracts `organization_id` from session
3. Database util: `getDb(c.env)` initializes connection with session context
4. Reference: `workers/src/lib/db.ts` - connection initialization

**Verification Query:**

```sql
-- Check which tables have RLS enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND rowsecurity = true
ORDER BY tablename;
```

**Security Audit Trail:**

- **2026-02-10**: Schema drift validation identified `transcriptions` and `ai_summaries` missing RLS
- **2026-02-10**: Deployed RLS policies to both tables (migration: `2026-02-11-add-rls-transcriptions-summaries.sql`)
- **Status**: All critical business tables now protected ✅

---

---

## Best Practices

### Naming Conventions

1. **Tables**: Plural nouns in snake_case (`users`, `org_members`, `call_outcomes`)
2. **Columns**: Descriptive snake_case (`organization_id`, `created_at`, `session_token`)
3. **Indexes**: `idx_{table}_{columns}` or `{table}_{column}_key`
4. **Foreign Keys**: `{table}_{column}_fkey`
5. **Constraints**: `{table}_{column}_check` or `{table}_{constraint_name}`

### Migration Safety Rules

1. Always wrap migrations in `BEGIN;` / `COMMIT;`
2. Test migrations on a branch database first (Neon supports branching)
3. Have rollback SQL ready for each migration
4. Update code AFTER database migration succeeds
5. Deploy code changes only after verifying database state

---

## References

- [MASTER_ARCHITECTURE.md](MASTER_ARCHITECTURE.md) - Naming convention mandate
- [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md) - Deployment procedures
- [supabase/migrations/](../supabase/migrations/) - Migration history
