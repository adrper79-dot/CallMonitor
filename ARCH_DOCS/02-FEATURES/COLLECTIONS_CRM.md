# Collections CRM — Feature Documentation

**Version:** v4.29  
**Added:** 2026-02-08  
**Status:** ✅ Production — 20/20 tests passing

---

## Overview

Collections CRM is a debt collection account management module integrated into the Word Is Bond voice intelligence platform. It enables call center agents to:

- **Import** debtor accounts via CSV bulk upload
- **Manage** accounts with full CRUD + search/filter
- **Record** payments with automatic balance tracking
- **Track** tasks (follow-ups, promises, escalations)
- **Monitor** portfolio health via aggregate stats (recovery rate, pending tasks)
- **Soft-delete** accounts preserving audit history

## Architecture

### Database Schema

4 tables in PostgreSQL 17 (migration: `migrations/2026-02-08-collections-crm.sql`):

| Table                    | Purpose                | Key Columns                                          |
| ------------------------ | ---------------------- | ---------------------------------------------------- |
| `collection_accounts`    | Debtor accounts        | name, balance_due, primary_phone, status, is_deleted |
| `collection_payments`    | Payment records        | account_id (FK), amount, method, reference_number    |
| `collection_tasks`       | Work items per account | account_id (FK), type, title, due_date, status       |
| `collection_csv_imports` | Import audit trail     | file_name, rows_total/imported/skipped, errors       |

All tables enforce `organization_id` for multi-tenant isolation.

### Indexes

- `idx_collection_accounts_org` — Fast org-scoped listing
- `idx_collection_accounts_org_balance` — Sort by balance_due DESC
- `idx_collection_accounts_org_status` — Status filter queries
- `idx_collection_accounts_external` — External ID lookup (CSV dedup)
- `idx_collection_payments_account` — Payments per account
- `idx_collection_payments_org` — Org-wide payment queries
- `idx_collection_tasks_account` — Tasks per account
- `idx_collection_tasks_org_status` — Active task filtering
- `idx_collection_tasks_due` — Due date ordering
- `idx_collection_csv_imports_org` — Import history listing

### API Endpoints

**Base path:** `/api/collections`

| Method | Path                 | Description                                | Rate Limit |
| ------ | -------------------- | ------------------------------------------ | ---------- |
| GET    | `/`                  | List accounts (search, status, pagination) | —          |
| POST   | `/`                  | Create account                             | 30/5min    |
| GET    | `/stats`             | Portfolio aggregate stats                  | —          |
| GET    | `/imports`           | CSV import history                         | —          |
| POST   | `/import`            | Bulk CSV import                            | 5/15min    |
| GET    | `/:id`               | Get single account                         | —          |
| PUT    | `/:id`               | Update account                             | 30/5min    |
| DELETE | `/:id`               | Soft-delete account                        | 30/5min    |
| GET    | `/:id/payments`      | List payments for account                  | —          |
| POST   | `/:id/payments`      | Record payment (auto-balance)              | 30/5min    |
| GET    | `/:id/tasks`         | List tasks for account                     | —          |
| POST   | `/:id/tasks`         | Create task                                | 30/5min    |
| PUT    | `/:id/tasks/:taskId` | Update task                                | 30/5min    |
| DELETE | `/:id/tasks/:taskId` | Delete task                                | 30/5min    |

### Query Parameters (GET /)

| Param    | Type   | Description                                                      |
| -------- | ------ | ---------------------------------------------------------------- |
| `status` | string | Filter by account status (active/paid/partial/disputed/archived) |
| `search` | string | ILIKE search on name and external_id                             |
| `limit`  | number | Results per page (default 50, max 200)                           |
| `offset` | number | Pagination offset                                                |

### Payment Auto-Balance

When a payment is recorded via `POST /:id/payments`:

1. Current `balance_due` is fetched
2. New balance = `max(0, current - amount)`
3. Account status auto-updates: `paid` if 0, `partial` if reduced, `active` otherwise
4. Audit log captures before/after balance

### CSV Import Flow

`POST /import` accepts:

```json
{
  "file_name": "accounts.csv",
  "accounts": [{ "name": "Debtor 1", "balance_due": 500, "primary_phone": "+15551234567" }],
  "column_mapping": { "col1": "name", "col2": "balance_due" }
}
```

Processing:

1. Creates `collection_csv_imports` record (status: processing)
2. Iterates accounts, inserts each individually (per-row error capture)
3. Updates import record with final counts and any row-level errors
4. Returns summary: total/imported/skipped/errors

## File Inventory

| File                                        | Purpose                  |
| ------------------------------------------- | ------------------------ |
| `workers/src/routes/collections.ts`         | All 15 route handlers    |
| `workers/src/lib/schemas.ts`                | 6 Zod validation schemas |
| `workers/src/lib/audit.ts`                  | 7 AuditAction constants  |
| `workers/src/lib/rate-limit.ts`             | 2 rate limiters          |
| `workers/src/index.ts`                      | Route registration       |
| `app/voice-operations/accounts/page.tsx`    | Frontend accounts page   |
| `tests/production/collections.test.ts`      | 20 integration tests     |
| `migrations/2026-02-08-collections-crm.sql` | Database migration       |

## Audit Trail

All mutations emit audit log events:

| Action         | Event Type                   |
| -------------- | ---------------------------- |
| Create account | `collection:account_created` |
| Update account | `collection:account_updated` |
| Delete account | `collection:account_deleted` |
| Record payment | `collection:payment_created` |
| Create task    | `collection:task_created`    |
| Update task    | `collection:task_updated`    |
| CSV import     | `collection:csv_imported`    |

## Security

- All endpoints require `Bearer` token authentication via `requireAuth()`
- All queries include `organization_id` in WHERE clause (multi-tenant isolation)
- All user input validated via Zod schemas before SQL execution
- All SQL uses parameterized queries (`$1, $2, ...`)
- Rate limiting on all mutation endpoints
- Soft-delete preserves data for compliance (is_deleted + deleted_at + deleted_by)

## Test Coverage

20 production integration tests covering:

- Full CRUD lifecycle (create → read → update → delete)
- Search and status filtering
- Payment recording with balance auto-update
- Task lifecycle (create → update → complete → delete)
- Portfolio stats aggregation
- Smart CSV import (fuzzy column matching) + import history
- 404 handling for non-existent accounts
- Soft-delete verification (deleted account returns 404)
- Test data cleanup
