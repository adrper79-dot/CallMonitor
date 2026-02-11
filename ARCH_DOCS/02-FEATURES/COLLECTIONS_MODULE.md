# Collections Module

**Created:** February 11, 2026
**Status:** ✅ Production Ready
**Location:** `components/voice/` + `workers/src/routes/collections.ts`

> **Bulk debt collection management with CSV import, analytics, and payment tracking**

---

## Overview

The Collections Module provides comprehensive tools for managing debt collection portfolios, including:

- **Bulk CSV Import** - Upload thousands of accounts with auto-mapping
- **Collections Analytics** - Portfolio performance dashboard
- **Payment Tracking** - Complete payment history and running totals
- **Automated Calling** - Integration with campaign manager for bulk outreach

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   COLLECTIONS WORKFLOW                   │
│                                                          │
│  CSV Upload → Validation → Import → Campaign Creation   │
│                                                          │
│      ↓              ↓           ↓            ↓          │
│  BulkImport    AccountMgmt  Analytics    Payments      │
│  Wizard        (CRUD)       Dashboard    Tracking       │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Collections (portfolios)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Collection Accounts (individual debts)
CREATE TABLE collection_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Account details
  account_number TEXT NOT NULL,
  debtor_name TEXT NOT NULL,
  debtor_phone TEXT NOT NULL,
  debtor_email TEXT,

  -- Debt information
  original_balance NUMERIC(10,2) NOT NULL,
  current_balance NUMERIC(10,2) NOT NULL,
  last_payment_date DATE,

  -- Status tracking
  status TEXT DEFAULT 'active', -- active | partial | paid | disputed | archived
  notes TEXT,

  -- Metadata
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_balance CHECK (current_balance >= 0),
  CONSTRAINT valid_status CHECK (status IN ('active', 'partial', 'paid', 'disputed', 'archived'))
);

-- Collection Calls (call history)
CREATE TABLE collection_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Call outcome
  outcome TEXT, -- no-answer | voicemail | spoke-with-debtor | spoke-with-third-party | promise-to-pay | payment-arranged | dispute
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Collection Payments
CREATE TABLE collection_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_account_id UUID NOT NULL REFERENCES collection_accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Payment details
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT, -- check | credit-card | ach | cash | other
  reference_number TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 1. Bulk Import Wizard

### Component: BulkImportWizard.tsx

3-step wizard for CSV imports with intelligent column mapping.

#### Step 1: File Upload

```tsx
<BulkImportWizard
  collectionId={collectionId}
  onComplete={() => {
    console.log('Import complete!');
    refetchAccounts();
  }}
/>
```

**Features:**
- Drag-and-drop or file picker
- CSV parsing with auto-detection
- File size validation (max 5MB)
- Preview of first 5 rows

#### Step 2: Column Mapping

**Auto-Detection Aliases:**
```typescript
const columnAliases = {
  account_number: ['account', 'acct', 'account_no', 'account_num'],
  debtor_name: ['name', 'customer', 'debtor', 'full_name'],
  debtor_phone: ['phone', 'telephone', 'mobile', 'cell'],
  debtor_email: ['email', 'e-mail', 'email_address'],
  original_balance: ['balance', 'amount', 'original_amt', 'debt'],
  current_balance: ['current', 'remaining', 'owed', 'outstanding']
};
```

**Validation:**
- Phone numbers: E.164 format (`/^\+?[1-9]\d{1,14}$/`)
- Balance: Positive numeric values
- Required fields: account_number, debtor_name, debtor_phone, current_balance

#### Step 3: Review & Import

**Progress Tracking:**
```tsx
POST /api/collections/:id/accounts/bulk

// Response
{
  success: 450,
  failed: 50,
  errors: [
    { row: 23, field: 'debtor_phone', message: 'Invalid phone format' },
    { row: 45, field: 'current_balance', message: 'Must be positive number' }
  ]
}
```

**Error Handling:**
- Invalid rows skipped with detailed error messages
- Successful rows imported
- Downloadable error report (CSV)

---

## 2. Collections Analytics

### Component: CollectionsAnalytics.tsx

Real-time portfolio performance dashboard.

#### Key Metrics

```typescript
interface CollectionStats {
  total_accounts: number;
  total_original_balance: number;
  total_current_balance: number;
  total_recovered: number;
  recovery_rate: number; // (original - current) / original

  // Status distribution
  active_count: number;
  partial_count: number;
  paid_count: number;
  disputed_count: number;
  archived_count: number;
}
```

#### API Endpoint

```typescript
GET /api/collections/:id/stats

// Response
{
  total_accounts: 1000,
  total_original_balance: 5000000.00,
  total_current_balance: 3200000.00,
  total_recovered: 1800000.00,
  recovery_rate: 0.36, // 36%

  active_count: 600,
  partial_count: 200,
  paid_count: 150,
  disputed_count: 30,
  archived_count: 20
}
```

#### Visualizations

**1. Status Distribution (Bar Chart)**
```
Active    ████████████████████ 60%
Partial   ██████ 20%
Paid      █████ 15%
Disputed  █ 3%
Archived  █ 2%
```

**2. Recovery Progress**
```
Original:  $5,000,000
Recovered: $1,800,000 (36%)
Remaining: $3,200,000 (64%)
```

**3. Payment Timeline**
- Daily/weekly/monthly payment totals
- Running balance over time
- Collection velocity trends

---

## 3. Payment Tracking

### Component: PaymentHistoryChart.tsx

Visual timeline of all payments with running totals.

#### Data Structure

```typescript
interface PaymentRecord {
  id: string;
  account_number: string;
  debtor_name: string;
  amount: number;
  payment_date: string;
  payment_method: 'check' | 'credit-card' | 'ach' | 'cash' | 'other';
  reference_number?: string;
  running_total: number; // Cumulative sum
}
```

#### API Endpoint

```typescript
GET /api/collections/:id/payments

// Response
{
  payments: [
    {
      id: "...",
      account_number: "ACC001",
      debtor_name: "John Doe",
      amount: 500.00,
      payment_date: "2026-02-10",
      payment_method: "credit-card",
      reference_number: "TXN12345",
      running_total: 500.00
    },
    {
      id: "...",
      account_number: "ACC002",
      debtor_name: "Jane Smith",
      amount: 750.00,
      payment_date: "2026-02-11",
      payment_method: "ach",
      running_total: 1250.00
    }
  ],
  total_recovered: 1250.00
}
```

#### Features

- **Timeline View:** Chronological payment history
- **Running Total:** Cumulative recovery amount
- **Payment Methods:** Filter by payment type
- **Export:** Download as CSV/Excel
- **Drill-Down:** Click payment → view account details

---

## 4. Account Management (CRUD)

### List Accounts

```typescript
GET /api/collections/:id/accounts?page=1&limit=50&status=active

// Response
{
  accounts: [
    {
      id: "...",
      account_number: "ACC001",
      debtor_name: "John Doe",
      debtor_phone: "+15551234567",
      original_balance: 1000.00,
      current_balance: 500.00,
      status: "partial",
      last_payment_date: "2026-02-01",
      created_at: "2026-01-15T10:00:00Z"
    }
  ],
  pagination: {
    total: 1000,
    page: 1,
    limit: 50,
    pages: 20
  }
}
```

### Create Account

```typescript
POST /api/collections/:id/accounts

{
  account_number: "ACC002",
  debtor_name: "Jane Smith",
  debtor_phone: "+15559876543",
  debtor_email: "jane@example.com",
  original_balance: 2000.00,
  current_balance: 2000.00,
  notes: "Initial account creation"
}
```

### Update Account

```typescript
PUT /api/collections/:id/accounts/:accountId

{
  current_balance: 1500.00,
  status: "partial",
  notes: "Payment of $500 received"
}
```

### Record Payment

```typescript
POST /api/collections/:id/accounts/:accountId/payments

{
  amount: 500.00,
  payment_date: "2026-02-11",
  payment_method: "credit-card",
  reference_number: "TXN67890",
  notes: "Phone payment processed"
}

// Automatically updates account.current_balance
// Sets account.last_payment_date
// Updates account.status if fully paid
```

---

## 5. Campaign Integration

### Automated Calling Campaigns

**Workflow:**
1. Create collection
2. Import accounts via CSV
3. Filter accounts (e.g., `status = 'active' AND current_balance > 100`)
4. Create campaign with filtered accounts
5. Launch automated calling

**API Integration:**

```typescript
POST /api/campaigns

{
  name: "Collections Campaign - March 2026",
  collection_id: "...", // Link to collection
  target_phones: accounts.map(a => a.debtor_phone),
  script_template: "collections_reminder",
  schedule: {
    start_time: "09:00",
    end_time: "17:00",
    timezone: "America/New_York"
  }
}
```

**Call Outcomes:**
```typescript
// After call completes, record outcome
POST /api/collections/:id/accounts/:accountId/calls

{
  call_id: "...",
  outcome: "promise-to-pay",
  notes: "Agreed to pay $300 by 2026-02-20"
}
```

---

## 6. Security & Compliance

### Multi-Tenant Isolation

```sql
-- All queries filtered by organization_id
SELECT * FROM collection_accounts
WHERE organization_id = $org_id; -- RLS enforced
```

### PII Protection

- Phone numbers encrypted at rest
- Email addresses redacted in audit logs
- Call recordings encrypted in R2

### FDCPA Compliance

- **Calling Hours:** Enforced via campaign scheduling (8am-9pm local time)
- **Do Not Call:** Integration with DNC registry
- **Call Recording:** All calls recorded with disclosure
- **Dispute Handling:** Disputed accounts flagged and excluded from campaigns

### Audit Trail

```sql
-- All actions logged
SELECT action, user_id, details, created_at
FROM audit_logs
WHERE action LIKE 'COLLECTION_%'
ORDER BY created_at DESC;
```

---

## 7. Best Practices

### 1. CSV Import Guidelines

**Recommended Format:**
```csv
account_number,debtor_name,debtor_phone,debtor_email,original_balance,current_balance,status
ACC001,John Doe,+15551234567,john@example.com,1000.00,500.00,partial
ACC002,Jane Smith,+15559876543,jane@example.com,2000.00,2000.00,active
```

**Tips:**
- Use E.164 phone format (`+15551234567`)
- Include column headers in first row
- Use decimal format for balances (1000.00 not $1,000)
- Max file size: 5MB (~10,000 accounts)

### 2. Payment Recording

**Always include:**
- Payment date (defaults to today if omitted)
- Payment method (helps with reconciliation)
- Reference number (check number, transaction ID)

**Automatic Actions:**
- `current_balance` decremented by payment amount
- If `current_balance = 0`, status set to `paid`
- If `0 < current_balance < original_balance`, status set to `partial`

### 3. Campaign Optimization

**Filter Strategies:**
```sql
-- High-value accounts only
WHERE current_balance > 1000

-- Recent activity
WHERE last_payment_date < CURRENT_DATE - INTERVAL '30 days'

-- Exclude recent contacts
WHERE NOT EXISTS (
  SELECT 1 FROM collection_calls
  WHERE collection_account_id = collection_accounts.id
    AND created_at > CURRENT_DATE - INTERVAL '7 days'
)
```

---

## 8. Troubleshooting

### Issue: CSV import failing

**Common Causes:**
- Invalid phone format (must be E.164: `+15551234567`)
- Negative balances (not allowed)
- Missing required fields
- Duplicate account numbers

**Solution:**
```typescript
// Download error report from import results
// Fix errors in CSV
// Re-upload
```

---

### Issue: Analytics not updating

**Cause:** Materialized view needs refresh.

**Solution:**
```sql
REFRESH MATERIALIZED VIEW collection_stats;
```

---

### Issue: Payment not updating balance

**Diagnosis:**
```sql
-- Check if payment was recorded
SELECT * FROM collection_payments
WHERE collection_account_id = $account_id
ORDER BY created_at DESC;

-- Check current balance
SELECT current_balance FROM collection_accounts
WHERE id = $account_id;
```

**Fix:** Ensure payment amount doesn't exceed current balance.

---

## Related Documentation

- [CAMPAIGN_MANAGER.md](CAMPAIGN_MANAGER.md) - Automated calling campaigns
- [BULK_UPLOAD_FEATURE.md](BULK_UPLOAD_FEATURE.md) - CSV import patterns
- [SECURITY_HARDENING.md](../03-INFRASTRUCTURE/SECURITY_HARDENING.md) - RLS and PII protection

---

**Last Updated:** February 11, 2026
**Maintained By:** Collections Team
**Next Review:** March 11, 2026
