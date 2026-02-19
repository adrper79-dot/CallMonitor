/**
 * Smart CSV Import Engine — Intelligent column mapping with fuzzy matching,
 * automatic data coercion, and multi-format support.
 *
 * Industry standard: Mimics Flatfile/OneSchema/CSVBox pattern:
 *   1. Parse any delimiter (CSV, TSV, pipe) via PapaParse
 *   2. Fuzzy-match column headers → schema fields (Levenshtein + alias table)
 *   3. Auto-detect & coerce data types (phone, currency, dates)
 *   4. Preview with inline validation + row-level error highlighting
 *   5. Allow manual override of any auto-detected mapping
 *
 * @see components/voice/SmartImportWizard.tsx (UI consumer)
 * @see workers/src/routes/collections.ts (POST /api/collections/import)
 * @see ARCH_DOCS/06-REFERENCE/TESTING.md
 */

// ─── E.164 phone format (matches workers/src/lib/schemas.ts) ────────────────
const E164_REGEX = /^\+[1-9]\d{1,14}$/

// ─── Schema Field Definitions ───────────────────────────────────────────────

export interface SchemaField {
  key: string
  label: string
  required: boolean
  type: 'string' | 'number' | 'phone' | 'email' | 'date' | 'enum'
  enumValues?: string[]
  maxLength?: number
  description?: string
  /** Aliases recognized during auto-mapping (lowercase, underscore-normalized) */
  aliases: string[]
}

/** Collection account import schema — the target fields */
export const COLLECTION_ACCOUNT_SCHEMA: SchemaField[] = [
  {
    key: 'name',
    label: 'Account Name',
    required: true,
    type: 'string',
    maxLength: 10_000,
    description: 'Full name of the debtor or account holder',
    aliases: [
      'name', 'full_name', 'fullname', 'customer_name', 'customername',
      'debtor_name', 'debtorname', 'account_name', 'accountname',
      'debtor', 'customer', 'client', 'client_name', 'clientname',
      'consumer', 'consumer_name', 'consumername', 'borrower',
      'borrower_name', 'borrowername', 'contact_name', 'contactname',
      'first_last', 'account_holder', 'accountholder',
      'patron', 'patron_name', 'member', 'member_name',
    ],
  },
  {
    key: 'balance_due',
    label: 'Balance Due',
    required: true,
    type: 'number',
    description: 'Current outstanding balance (USD)',
    aliases: [
      'balance_due', 'balancedue', 'balance', 'amount', 'amount_due',
      'amountdue', 'debt', 'total_due', 'totaldue', 'amount_owed',
      'amountowed', 'owed', 'open_balance', 'openbalance',
      'outstanding', 'outstanding_balance', 'outstandingbalance',
      'original_amount', 'originalamount', 'principal', 'total',
      'total_balance', 'totalbalance', 'remaining', 'remaining_balance',
      'current_balance', 'currentbalance', 'bal', 'amt',
      'invoice_amount', 'invoiceamount',
    ],
  },
  {
    key: 'primary_phone',
    label: 'Primary Phone',
    required: true,
    type: 'phone',
    description: 'Phone number — any format (we auto-convert to E.164)',
    aliases: [
      'primary_phone', 'primaryphone', 'phone', 'phone_number',
      'phonenumber', 'mobile', 'cell', 'telephone', 'tel',
      'contact_phone', 'contactphone', 'cell_phone', 'cellphone',
      'mobile_phone', 'mobilephone', 'main_phone', 'mainphone',
      'phone_1', 'phone1', 'daytime_phone', 'daytimephone',
      'home_phone', 'homephone', 'customerphone',
    ],
  },
  {
    key: 'secondary_phone',
    label: 'Secondary Phone',
    required: false,
    type: 'phone',
    description: 'Alternate phone number',
    aliases: [
      'secondary_phone', 'secondaryphone', 'alt_phone', 'altphone',
      'alternate_phone', 'alternatephone', 'work_phone', 'workphone',
      'phone_2', 'phone2', 'other_phone', 'otherphone',
      'evening_phone', 'eveningphone',
    ],
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    type: 'email',
    maxLength: 254,
    description: 'Email address',
    aliases: [
      'email', 'email_address', 'emailaddress', 'e_mail',
      'contact_email', 'contactemail', 'mail', 'customer_email',
      'customeremail',
    ],
  },
  {
    key: 'external_id',
    label: 'Account / Reference ID',
    required: false,
    type: 'string',
    maxLength: 200,
    description: 'Your internal account or reference number',
    aliases: [
      'external_id', 'externalid', 'account_id', 'accountid',
      'account_number', 'accountnumber', 'reference', 'ref',
      'id', 'account_no', 'accountno', 'acct_no', 'acctno',
      'account_num', 'accountnum', 'ref_no', 'refno',
      'invoice_number', 'invoicenumber', 'invoice_num', 'invoicenum',
      'case_number', 'casenumber', 'file_number', 'filenumber',
      'record_id', 'recordid', 'client_ref', 'clientref',
    ],
  },
  {
    key: 'address',
    label: 'Address',
    required: false,
    type: 'string',
    maxLength: 1_000,
    description: 'Mailing address (can include city/state/zip)',
    aliases: [
      'address', 'street_address', 'streetaddress', 'mailing_address',
      'mailingaddress', 'full_address', 'fulladdress', 'addr',
      'street', 'address_1', 'address1', 'location',
    ],
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    type: 'enum',
    enumValues: ['active', 'paid', 'partial', 'disputed', 'archived'],
    description: 'Account status (defaults to "active")',
    aliases: [
      'status', 'account_status', 'accountstatus', 'state',
      'acct_status', 'current_status', 'currentstatus',
    ],
  },
  {
    key: 'notes',
    label: 'Notes',
    required: false,
    type: 'string',
    maxLength: 5_000,
    description: 'Notes, comments, or memo',
    aliases: [
      'notes', 'comments', 'memo', 'remarks', 'description',
      'comment', 'note', 'remark', 'internal_notes', 'internalnotes',
    ],
  },
  {
    key: 'promise_date',
    label: 'Promise to Pay Date',
    required: false,
    type: 'date',
    description: 'Expected payment date',
    aliases: [
      'promise_date', 'promisedate', 'ptp_date', 'ptpdate',
      'promise_to_pay', 'promisetopay', 'ptp', 'pay_date', 'paydate',
    ],
  },
  {
    key: 'promise_amount',
    label: 'Promise Amount',
    required: false,
    type: 'number',
    description: 'Promised payment amount (USD)',
    aliases: [
      'promise_amount', 'promiseamount', 'ptp_amount', 'ptpamount',
      'promised_amount', 'promisedamount',
    ],
  },
]

// ─── Fuzzy Matching ─────────────────────────────────────────────────────────

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** Similarity score 0–1 (1 = identical) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

export interface ColumnMatch {
  csvHeader: string
  schemaField: string | null
  confidence: number // 0–1
  matchType: 'exact' | 'alias' | 'fuzzy' | 'none'
}

/**
 * Normalize a header string for comparison:
 * "Customer Name" → "customername"
 * "Balance_Due" → "balancedue"
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_\-./()]+/g, '')
}

/**
 * Also produce an underscore-normalized variant for alias matching:
 * "Customer Name" → "customer_name"
 */
function underscoreNormalize(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s\-./()]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Smart column mapping: exact match → alias match → fuzzy match.
 *
 * Returns matches sorted by confidence, with each schema field
 * assigned to at most one CSV column (best match wins).
 */
export function smartColumnMapping(
  csvHeaders: string[],
  schema: SchemaField[] = COLLECTION_ACCOUNT_SCHEMA
): ColumnMatch[] {
  const results: ColumnMatch[] = []
  const assignedFields = new Set<string>()
  const assignedHeaders = new Set<string>()

  // Phase 1: Exact key match
  for (const header of csvHeaders) {
    const norm = normalizeHeader(header)
    const under = underscoreNormalize(header)
    for (const field of schema) {
      if (assignedFields.has(field.key)) continue
      if (norm === normalizeHeader(field.key) || under === field.key) {
        results.push({
          csvHeader: header,
          schemaField: field.key,
          confidence: 1.0,
          matchType: 'exact',
        })
        assignedFields.add(field.key)
        assignedHeaders.add(header)
        break
      }
    }
  }

  // Phase 2: Alias match
  for (const header of csvHeaders) {
    if (assignedHeaders.has(header)) continue
    const norm = normalizeHeader(header)
    const under = underscoreNormalize(header)

    let bestField: string | null = null
    let bestConf = 0

    for (const field of schema) {
      if (assignedFields.has(field.key)) continue
      for (const alias of field.aliases) {
        const aliasNorm = normalizeHeader(alias)
        if (norm === aliasNorm || under === alias) {
          bestField = field.key
          bestConf = 0.95
          break
        }
      }
      if (bestField) break
    }

    if (bestField) {
      results.push({
        csvHeader: header,
        schemaField: bestField,
        confidence: bestConf,
        matchType: 'alias',
      })
      assignedFields.add(bestField)
      assignedHeaders.add(header)
    }
  }

  // Phase 3: Fuzzy match (Levenshtein) for remaining unmatched headers
  for (const header of csvHeaders) {
    if (assignedHeaders.has(header)) continue
    const norm = normalizeHeader(header)

    let bestField: string | null = null
    let bestScore = 0

    for (const field of schema) {
      if (assignedFields.has(field.key)) continue

      // Check against field key
      const keyScore = similarity(norm, normalizeHeader(field.key))
      if (keyScore > bestScore) {
        bestScore = keyScore
        bestField = field.key
      }

      // Check against all aliases
      for (const alias of field.aliases) {
        const aliasScore = similarity(norm, normalizeHeader(alias))
        if (aliasScore > bestScore) {
          bestScore = aliasScore
          bestField = field.key
        }
      }
    }

    // Only accept fuzzy matches above 0.6 threshold
    if (bestField && bestScore >= 0.6) {
      results.push({
        csvHeader: header,
        schemaField: bestField,
        confidence: bestScore,
        matchType: 'fuzzy',
      })
      assignedFields.add(bestField)
      assignedHeaders.add(header)
    } else {
      results.push({
        csvHeader: header,
        schemaField: null,
        confidence: 0,
        matchType: 'none',
      })
    }
  }

  return results
}

// ─── Data Coercion / Normalization ──────────────────────────────────────────

/**
 * Normalize phone to E.164 automatically.
 * Handles: (404) 555-0101, 404-555-0101, 4045550101, 14045550101,
 *          +14045550101, 1-404-555-0101, etc.
 */
export function normalizePhone(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return ''

  // Already E.164
  if (E164_REGEX.test(trimmed)) return trimmed

  // Strip all non-digit characters
  const digits = trimmed.replace(/[^\d]/g, '')

  // US 10-digit
  if (digits.length === 10) return `+1${digits}`

  // US 11-digit starting with 1
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`

  // International with leading + but failed E164 check — try returning as-is
  if (trimmed.startsWith('+') && digits.length >= 7) return `+${digits}`

  // 7-digit (no area code) — can't normalize, return as-is
  return trimmed
}

/**
 * Coerce a currency string to a number.
 * Handles: $1,500.50, 1500.50, "1,500", "$1500", "1 500.50" (EU space separator)
 */
export function coerceCurrency(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  if (raw == null || raw === '') return null
  const cleaned = String(raw)
    .replace(/[$€£¥₹,\s]/g, '')
    .replace(/[()]/g, '') // some systems use (1500) for negative
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Coerce a status string to a valid enum value.
 * Maps common variations to schema-expected values.
 */
export function coerceStatus(raw: string): string {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
  const STATUS_MAP: Record<string, string> = {
    active: 'active',
    open: 'active',
    current: 'active',
    new: 'active',
    pending: 'active',
    paid: 'paid',
    closed: 'paid',
    settled: 'paid',
    resolved: 'paid',
    collected: 'paid',
    partial: 'partial',
    'partial payment': 'partial',
    'partially paid': 'partial',
    'part paid': 'partial',
    disputed: 'disputed',
    dispute: 'disputed',
    contested: 'disputed',
    challenged: 'disputed',
    archived: 'archived',
    inactive: 'archived',
    cancelled: 'archived',
    canceled: 'archived',
    removed: 'archived',
    deleted: 'archived',
    hold: 'archived',
    'on hold': 'archived',
    overdue: 'active', // map overdue to active in our system
    delinquent: 'active',
    'past due': 'active',
    'past_due': 'active',
    pastdue: 'active',
  }
  return STATUS_MAP[normalized] ?? 'active'
}

/**
 * Transform a raw CSV row using the column mapping + automatic coercion.
 * Returns a cleaned object ready for API submission.
 */
export function transformRow(
  rawRow: Record<string, string>,
  mapping: Record<string, string>, // schemaField → csvHeader
  schema: SchemaField[] = COLLECTION_ACCOUNT_SCHEMA
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const field of schema) {
    const csvHeader = mapping[field.key]
    if (!csvHeader) continue

    const rawValue = rawRow[csvHeader]
    if (rawValue == null || rawValue === '') continue

    switch (field.type) {
      case 'phone':
        result[field.key] = normalizePhone(rawValue)
        break
      case 'number':
        result[field.key] = coerceCurrency(rawValue)
        break
      case 'email':
        result[field.key] = rawValue.trim().toLowerCase()
        break
      case 'enum':
        result[field.key] = coerceStatus(rawValue)
        break
      case 'date':
        result[field.key] = rawValue.trim()
        break
      default:
        result[field.key] = rawValue.trim()
    }
  }

  return result
}

// ─── Row-Level Validation ───────────────────────────────────────────────────

export interface RowValidationError {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidatedRow {
  index: number
  data: Record<string, unknown>
  errors: RowValidationError[]
  valid: boolean
}

export interface ValidationSummary {
  totalRows: number
  validRows: number
  invalidRows: number
  warningRows: number
  rows: ValidatedRow[]
  errorsByField: Record<string, number>
  topIssues: string[]
}

/**
 * Validate a single transformed row against the schema.
 */
export function validateRow(
  row: Record<string, unknown>,
  index: number,
  schema: SchemaField[] = COLLECTION_ACCOUNT_SCHEMA
): ValidatedRow {
  const errors: RowValidationError[] = []

  for (const field of schema) {
    const value = row[field.key]

    // Required field missing
    if (field.required && (value == null || value === '')) {
      errors.push({
        field: field.key,
        message: `${field.label} is required`,
        severity: 'error',
      })
      continue
    }

    if (value == null || value === '') continue

    // Type-specific validation
    switch (field.type) {
      case 'phone': {
        const phone = String(value)
        if (!E164_REGEX.test(phone)) {
          errors.push({
            field: field.key,
            message: `Invalid phone format "${phone}" — could not auto-convert to E.164`,
            severity: 'error',
          })
        }
        break
      }
      case 'number': {
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push({
            field: field.key,
            message: `"${value}" is not a valid number`,
            severity: 'error',
          })
        } else if (value < 0) {
          errors.push({
            field: field.key,
            message: `${field.label} cannot be negative`,
            severity: 'error',
          })
        } else if (value > 99_999_999.99) {
          errors.push({
            field: field.key,
            message: `${field.label} exceeds maximum ($99,999,999.99)`,
            severity: 'error',
          })
        }
        break
      }
      case 'email': {
        const email = String(value)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({
            field: field.key,
            message: `Invalid email format "${email}"`,
            severity: 'warning',
          })
        }
        break
      }
      case 'string': {
        if (field.maxLength && String(value).length > field.maxLength) {
          errors.push({
            field: field.key,
            message: `${field.label} exceeds ${field.maxLength} characters`,
            severity: 'warning',
          })
        }
        break
      }
    }
  }

  return {
    index,
    data: row,
    errors,
    valid: !errors.some((e) => e.severity === 'error'),
  }
}

/**
 * Validate all rows and produce a summary with top issues.
 */
export function validateAllRows(
  rows: Record<string, unknown>[],
  schema?: SchemaField[]
): ValidationSummary {
  const validated = rows.map((row, i) => validateRow(row, i, schema))
  const errorsByField: Record<string, number> = {}

  for (const row of validated) {
    for (const err of row.errors) {
      if (err.severity === 'error') {
        errorsByField[err.field] = (errorsByField[err.field] || 0) + 1
      }
    }
  }

  const topIssues = Object.entries(errorsByField)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([field, count]) => {
      const label = (schema ?? COLLECTION_ACCOUNT_SCHEMA).find((f) => f.key === field)?.label ?? field
      return `${label}: ${count} error${count > 1 ? 's' : ''}`
    })

  const validCount = validated.filter((r) => r.valid).length
  const warningCount = validated.filter(
    (r) => r.valid && r.errors.some((e) => e.severity === 'warning')
  ).length

  return {
    totalRows: rows.length,
    validRows: validCount,
    invalidRows: rows.length - validCount,
    warningRows: warningCount,
    rows: validated,
    errorsByField,
    topIssues,
  }
}

// ─── Template Generator ─────────────────────────────────────────────────────

/**
 * Generate a downloadable CSV template with all schema fields as headers.
 * Includes a sample row with example data.
 */
export function generateTemplate(
  schema: SchemaField[] = COLLECTION_ACCOUNT_SCHEMA
): string {
  const headers = schema.map((f) => f.label)
  const sampleRow = schema.map((f) => {
    switch (f.key) {
      case 'name': return 'John Doe'
      case 'balance_due': return '1500.00'
      case 'primary_phone': return '(555) 123-4567'
      case 'secondary_phone': return '(555) 987-6543'
      case 'email': return 'john@example.com'
      case 'external_id': return 'ACCT-001'
      case 'address': return '"123 Main St, Springfield, IL 62701"'
      case 'status': return 'active'
      case 'notes': return '"Initial placement"'
      case 'promise_date': return '2026-03-15'
      case 'promise_amount': return '500.00'
      default: return ''
    }
  })

  return [headers.join(','), sampleRow.join(',')].join('\n')
}

/**
 * Trigger browser download of the template CSV.
 */
export function downloadTemplate(): void {
  const csv = generateTemplate()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'wordisbond_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
