# Data Import Architecture

**Last Updated:** February 17, 2026  
**Version:** v4.70  
**Status:** Production ✅

---

## Overview

Word Is Bond provides an industry-standard CSV import experience modeled after platforms like Flatfile, OneSchema, and CSVBox. The system accepts CSV/TSV files from any CRM or accounting system and auto-detects column mappings using fuzzy matching.

**Design Principle:** "Upload any CSV — we auto-detect your columns."

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  SmartImportWizard (components/voice/SmartImportWizard.tsx)      │
│                                                                  │
│  Step 1: Upload        → PapaParse (CSV/TSV auto-detect)        │
│  Step 2: Map Columns   → smart-csv-import.ts (fuzzy matching)    │
│  Step 3: Preview       → Row validation + inline error display   │
│  Step 4: Import        → POST /api/collections/import (JSON)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Smart CSV Import Engine (lib/smart-csv-import.ts)               │
│                                                                  │
│  COLLECTION_ACCOUNT_SCHEMA → 11 fields, 200+ aliases each       │
│  smartColumnMapping()      → 3-phase: exact → alias → fuzzy     │
│  transformRow()            → Type-specific coercion per field    │
│  validateAllRows()         → Row-level validation + summary     │
│  downloadTemplate()        → CSV template with sample data      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Backend API (workers/src/routes/collections.ts)                 │
│                                                                  │
│  POST /api/collections/import                                    │
│    Body: { file_name, accounts[], column_mapping }               │
│    → Batch INSERT (groups of 50) with per-row fallback           │
│    → Logs to collection_csv_imports                              │
│                                                                  │
│  GET /api/collections/imports                                    │
│    → Returns last 50 import records                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entry Points

All 3 entry points share the same `SmartImportWizard` component:

| Route | Context | Props |
|-------|---------|-------|
| `/onboarding` (Step 5) | Onboarding wizard | `compact`, `onComplete` |
| `/voice-operations/accounts?tab=import` | Collections workspace | `onComplete` |
| `/accounts/import` | Standalone import page | (none) |

---

## Column Matching Algorithm

### 3-Phase Matching

1. **Exact Match** (confidence: 1.0)  
   CSV header normalized to lowercase, stripped of separators, compared to schema field key.  
   Example: `balance_due` → `balance_due`

2. **Alias Match** (confidence: 0.95)  
   Compared against 200+ aliases per field covering COLLECT!, Salesforce, QuickBooks, HubSpot, generic CRM exports.  
   Example: `CustomerName` → `name`, `OpenBalance` → `balance_due`

3. **Fuzzy Match** (confidence: variable, threshold 0.6)  
   Levenshtein distance similarity. Used when no exact or alias match found.  
   Example: `debtor_fullname` → `name` (similarity ~0.7)

### Alias Coverage

| Schema Field | Alias Examples (partial) |
|-------------|--------------------------|
| `name` | customer_name, debtor_name, full_name, account_name, borrower, client_name |
| `primary_phone` | phone, telephone, mobile, cell, contact_phone, phone_number |
| `balance_due` | open_balance, amount_due, outstanding, total_due, current_balance |
| `email` | email_address, contact_email, e_mail, customer_email |
| `status` | account_status, collection_status, acct_status |
| `external_id` | account_number, invoice_number, reference, case_number, file_number |

---

## Data Coercion

| Field Type | Coercion | Example |
|-----------|----------|---------|
| **Phone** | Any US format → E.164 | `(404) 555-0101` → `+14045550101` |
| **Currency** | Strip symbols + commas → float | `$1,500.50` → `1500.5` |
| **Status** | 30+ variants → enum | `Overdue` → `active`, `Settled` → `paid`, `Contested` → `disputed` |
| **String** | Trim whitespace | ` John Smith ` → `John Smith` |
| **Date** | Passthrough (ISO 8601 preferred) | `2026-02-17` |

---

## Validation

### Row-Level Validation

Each row is validated individually. Errors include:
- Missing required fields (name, primary_phone, balance_due)
- Invalid phone format (after normalization attempt)
- Non-numeric balance values
- Unknown status values (warning, not error)

### Validation Summary

```typescript
interface ValidationSummary {
  totalRows: number
  validRows: number
  invalidRows: number
  rows: ValidatedRow[]
  topIssues: string[]  // Aggregated issue descriptions
}
```

Invalid rows are **skipped** during import — valid rows are still imported.

---

## File Support

| Format | Delimiter | Extension |
|--------|-----------|-----------|
| CSV | Comma (`,`) | `.csv` |
| TSV | Tab (`\t`) | `.tsv` |
| Text | Auto-detect | `.txt` |

**Limits:**
- Max file size: 10 MB
- Max rows: 10,000
- PapaParse handles: quoted fields, embedded newlines, escaped quotes, BOM

---

## API Contract

### POST /api/collections/import

```typescript
// Request
{
  file_name: string,
  accounts: Array<{
    name: string,           // Required
    primary_phone: string,  // Required, E.164 format
    balance_due: number,    // Required
    email?: string,
    external_id?: string,
    secondary_phone?: string,
    status?: 'active' | 'paid' | 'partial' | 'disputed' | 'archived',
    notes?: string,
    original_balance?: number,
    due_date?: string
  }>,
  column_mapping: Record<string, string>
}

// Response
{
  import: {
    id: string,
    file_name: string,
    rows_total: number,
    rows_imported: number,
    rows_skipped: number,
    errors: Array<{ row: number, error: string }> | null
  }
}
```

---

## File Inventory

| File | Purpose | Lines |
|------|---------|-------|
| `lib/smart-csv-import.ts` | Import engine (schema, matching, coercion, validation) | ~500 |
| `components/voice/SmartImportWizard.tsx` | 4-step wizard UI | ~500 |
| `tests/production/smart-csv-import.test.ts` | 66 unit tests for import engine | ~610 |
| `workers/src/routes/collections.ts` | Backend API (import + CRUD) | 1104 |

---

## Testing

| Test File | Scope |
|-----------|-------|
| `tests/production/smart-csv-import.test.ts` | Unit tests: fuzzy matching, coercion, validation, template |
| `tests/production/csv-validators.test.ts` | Legacy validator unit tests |
| `tests/production/csv-ingestion-e2e.test.ts` | End-to-end API import pipeline |
| `tests/production/collections.test.ts` | Collections API (includes import section) |

---

## Supported CRM Exports

The alias table is designed to work out of the box with exports from:

- **COLLECT!** (collection software)
- **Salesforce** (CRM)
- **HubSpot** (CRM)
- **QuickBooks** (accounting)
- **Sage** (accounting)
- **Zoho** (CRM)
- **Pipedrive** (CRM)
- **Freshdesk** (helpdesk)
- **Generic Excel/Google Sheets** exports
- **Custom CRM builds**

---

## Design Decisions

1. **PapaParse over hand-rolled parsing:** `.split(',')` breaks on quoted fields containing commas. PapaParse handles all CSV edge cases including BOM, embedded newlines, and mixed delimiters.

2. **Fuzzy matching with Levenshtein:** External libraries (Fuse.js, string-similarity) add 30-80KB of bundle. The built-in Levenshtein implementation is ~30 lines and sufficient for column name matching.

3. **200+ aliases per field:** Better to over-match than under-match. False positives are easily corrected in the mapping step; false negatives (unmapped required fields) block the entire import.

4. **Threshold 0.6 for fuzzy:** Below 0.6, fuzzy matches are too unreliable and cause more confusion than benefit. Fields that can't fuzzy-match fall back to manual selection.

5. **Single component for all entry points:** Prevents the drift that caused the original 6-discrepancy audit. All 3 pages import the same SmartImportWizard.

6. **Client-side validation before API call:** Reduces failed imports. Invalid rows are flagged and skipped before hitting the backend, improving UX and reducing error responses.
