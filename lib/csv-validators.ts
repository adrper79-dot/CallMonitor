/**
 * CSV Pre-Validators — Client-side validation before upload
 *
 * Validates collection account CSV data BEFORE sending to API.
 * Catches bad rows early, provides instant feedback, reduces support burden.
 *
 * Usage:
 *   import { validateCsvRows, formatValidationSummary } from '@/lib/csv-validators'
 *
 *   const results = validateCsvRows(parsedRows)
 *   const { valid, invalid, summary } = formatValidationSummary(results)
 *   // Submit only valid rows to /api/collections/import
 */

// ─── E.164 phone format (matches workers/src/lib/schemas.ts) ────────────────

const E164_REGEX = /^\+[1-9]\d{1,14}$/

// ─── Validation Error Types ─────────────────────────────────────────────────

export interface CsvRowError {
  field: string
  message: string
}

export interface CsvRowValidation {
  row: number
  valid: boolean
  errors: CsvRowError[]
  data: Record<string, unknown>
}

export interface CsvValidationSummary {
  totalRows: number
  validRows: number
  invalidRows: number
  validData: CsvRowValidation[]
  invalidData: CsvRowValidation[]
  errorsByField: Record<string, number>
}

// ─── Row-level Validators ───────────────────────────────────────────────────

/**
 * Validate a single CSV row for collection account import.
 * Mirrors CreateCollectionAccountSchema from workers/src/lib/schemas.ts.
 */
export function validateCsvRow(row: Record<string, unknown>, rowIndex: number): CsvRowValidation {
  const errors: CsvRowError[] = []

  // Required: name (non-empty string, max 10,000)
  const name = String(row.name ?? '').trim()
  if (!name) {
    errors.push({ field: 'name', message: 'Name is required' })
  } else if (name.length > 10_000) {
    errors.push({ field: 'name', message: 'Name exceeds 10,000 characters' })
  }

  // Required: balance_due (number >= 0, max 99,999,999.99)
  const balanceRaw = row.balance_due ?? row.balance ?? row.amount
  const balance = typeof balanceRaw === 'number' ? balanceRaw : parseFloat(String(balanceRaw ?? ''))
  if (isNaN(balance)) {
    errors.push({ field: 'balance_due', message: 'Balance must be a valid number' })
  } else if (balance < 0) {
    errors.push({ field: 'balance_due', message: 'Balance cannot be negative' })
  } else if (balance > 99_999_999.99) {
    errors.push({ field: 'balance_due', message: 'Balance exceeds maximum ($99,999,999.99)' })
  }

  // Required: primary_phone (E.164 format)
  const phone = String(row.primary_phone ?? row.phone ?? '').trim()
  if (!phone) {
    errors.push({ field: 'primary_phone', message: 'Primary phone is required' })
  } else if (!E164_REGEX.test(phone)) {
    errors.push({
      field: 'primary_phone',
      message: `Invalid E.164 format "${phone}" — must start with + and country code (e.g., +15551234567)`,
    })
  }

  // Optional: secondary_phone (E.164 if provided)
  const secondaryPhone = String(row.secondary_phone ?? '').trim()
  if (secondaryPhone && !E164_REGEX.test(secondaryPhone)) {
    errors.push({
      field: 'secondary_phone',
      message: `Invalid E.164 format "${secondaryPhone}"`,
    })
  }

  // Optional: email (basic format check)
  const emailRaw = String(row.email ?? '').trim()
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    errors.push({ field: 'email', message: `Invalid email format "${emailRaw}"` })
  } else if (emailRaw && emailRaw.length > 254) {
    errors.push({ field: 'email', message: 'Email exceeds 254 characters' })
  }

  // Optional: status (must be one of the allowed values)
  const status = String(row.status ?? 'active')
    .trim()
    .toLowerCase()
  const VALID_STATUSES = ['active', 'paid', 'partial', 'disputed', 'archived']
  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: `Invalid status "${status}" — must be: ${VALID_STATUSES.join(', ')}`,
    })
  }

  // Optional: external_id (max 10,000 chars)
  const externalId = String(row.external_id ?? '').trim()
  if (externalId && externalId.length > 10_000) {
    errors.push({ field: 'external_id', message: 'External ID exceeds 10,000 characters' })
  }

  // Optional: address (max 1,000 chars)
  const address = String(row.address ?? '').trim()
  if (address && address.length > 1_000) {
    errors.push({ field: 'address', message: 'Address exceeds 1,000 characters' })
  }

  // Optional: notes (max 5,000 chars)
  const notes = String(row.notes ?? '').trim()
  if (notes && notes.length > 5_000) {
    errors.push({ field: 'notes', message: 'Notes exceed 5,000 characters' })
  }

  // Optional: promise_amount (number >= 0 if provided)
  const promiseAmountRaw = row.promise_amount
  if (promiseAmountRaw != null && promiseAmountRaw !== '') {
    const promiseAmount =
      typeof promiseAmountRaw === 'number' ? promiseAmountRaw : parseFloat(String(promiseAmountRaw))
    if (isNaN(promiseAmount)) {
      errors.push({ field: 'promise_amount', message: 'Promise amount must be a valid number' })
    } else if (promiseAmount < 0) {
      errors.push({ field: 'promise_amount', message: 'Promise amount cannot be negative' })
    } else if (promiseAmount > 99_999_999.99) {
      errors.push({ field: 'promise_amount', message: 'Promise amount exceeds maximum' })
    }
  }

  return {
    row: rowIndex + 1,
    valid: errors.length === 0,
    errors,
    data: row,
  }
}

/**
 * Validate all CSV rows and produce a summary.
 * Use this before sending to /api/collections/import.
 */
export function validateCsvRows(rows: Record<string, unknown>[]): CsvValidationSummary {
  const results = rows.map((row, index) => validateCsvRow(row, index))

  const validData = results.filter((r) => r.valid)
  const invalidData = results.filter((r) => !r.valid)

  // Count errors by field for pattern detection
  const errorsByField: Record<string, number> = {}
  for (const result of invalidData) {
    for (const err of result.errors) {
      errorsByField[err.field] = (errorsByField[err.field] || 0) + 1
    }
  }

  return {
    totalRows: rows.length,
    validRows: validData.length,
    invalidRows: invalidData.length,
    validData,
    invalidData,
    errorsByField,
  }
}

/**
 * Format a human-readable summary of validation results.
 * Shows top error patterns to help users fix their CSV files.
 */
export function formatValidationMessage(summary: CsvValidationSummary): string {
  if (summary.invalidRows === 0) {
    return `✅ All ${summary.totalRows} rows are valid and ready to import.`
  }

  const lines = [`⚠️ ${summary.invalidRows} of ${summary.totalRows} rows have errors:`]

  // Top error patterns
  const sortedFields = Object.entries(summary.errorsByField)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  for (const [field, count] of sortedFields) {
    lines.push(`  • ${field}: ${count} error${count > 1 ? 's' : ''}`)
  }

  if (summary.validRows > 0) {
    lines.push(`\n${summary.validRows} valid rows can still be imported.`)
  }

  return lines.join('\n')
}

/**
 * Auto-detect common CSV column name variations and map to schema fields.
 * Returns a mapping of detected CSV header → schema field name.
 */
export function detectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const normalized = headers.map((h) =>
    h
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, '_')
  )

  const FIELD_ALIASES: Record<string, string[]> = {
    name: [
      'name',
      'full_name',
      'customer_name',
      'debtor_name',
      'account_name',
      'debtor',
      'customer',
    ],
    balance_due: [
      'balance_due',
      'balance',
      'amount',
      'amount_due',
      'debt',
      'total_due',
      'amount_owed',
      'owed',
    ],
    primary_phone: [
      'primary_phone',
      'phone',
      'phone_number',
      'mobile',
      'cell',
      'telephone',
      'tel',
      'contact_phone',
    ],
    secondary_phone: [
      'secondary_phone',
      'alt_phone',
      'alternate_phone',
      'home_phone',
      'work_phone',
      'phone_2',
      'phone2',
    ],
    email: ['email', 'email_address', 'e_mail', 'contact_email'],
    external_id: [
      'external_id',
      'account_id',
      'account_number',
      'reference',
      'ref',
      'id',
      'account_no',
      'acct_no',
    ],
    address: ['address', 'street_address', 'mailing_address', 'full_address', 'addr'],
    status: ['status', 'account_status', 'state'],
    notes: ['notes', 'comments', 'memo', 'remarks', 'description'],
    promise_date: ['promise_date', 'ptp_date', 'promise_to_pay', 'ptp'],
    promise_amount: ['promise_amount', 'ptp_amount', 'promised_amount'],
  }

  for (const [schemaField, aliases] of Object.entries(FIELD_ALIASES)) {
    const matchIndex = normalized.findIndex((h) => aliases.includes(h))
    if (matchIndex >= 0) {
      mapping[headers[matchIndex]] = schemaField
    }
  }

  return mapping
}

/**
 * Apply column mapping to raw CSV rows.
 * Transforms CSV column names to schema-expected field names.
 */
export function applyColumnMapping(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>
): Record<string, unknown>[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {}
    for (const [csvCol, value] of Object.entries(row)) {
      const schemaField = mapping[csvCol] || csvCol
      mapped[schemaField] = value
    }

    // Coerce balance_due to number if string
    if (typeof mapped.balance_due === 'string') {
      const cleaned = (mapped.balance_due as string).replace(/[$,\s]/g, '')
      const num = parseFloat(cleaned)
      if (!isNaN(num)) mapped.balance_due = num
    }

    // Coerce promise_amount to number if string
    if (typeof mapped.promise_amount === 'string') {
      const cleaned = (mapped.promise_amount as string).replace(/[$,\s]/g, '')
      const num = parseFloat(cleaned)
      if (!isNaN(num)) mapped.promise_amount = num
    }

    return mapped
  })
}
