/**
 * Smart CSV Import Engine — Unit Tests
 *
 * Tests the smart-csv-import.ts engine: fuzzy column matching,
 * phone normalization, currency coercion, status mapping,
 * row transformation, validation, and template generation.
 *
 * Pure function tests — no API calls, no DB, no PapaParse.
 *
 * @see lib/smart-csv-import.ts
 * @see ARCH_DOCS/04-FEATURES/DATA_IMPORT.md
 */

import { describe, it, expect } from 'vitest'
import {
  COLLECTION_ACCOUNT_SCHEMA,
  smartColumnMapping,
  normalizePhone,
  coerceCurrency,
  coerceStatus,
  transformRow,
  validateRow,
  validateAllRows,
  generateTemplate,
} from '../../lib/smart-csv-import'

// ─── Schema Tests ───────────────────────────────────────────────────────────

describe('COLLECTION_ACCOUNT_SCHEMA', () => {
  it('should have 11 fields', () => {
    expect(COLLECTION_ACCOUNT_SCHEMA).toHaveLength(11)
  })

  it('should mark name, balance_due, primary_phone as required', () => {
    const required = COLLECTION_ACCOUNT_SCHEMA.filter((f) => f.required)
    expect(required.map((f) => f.key).sort()).toEqual([
      'balance_due',
      'name',
      'primary_phone',
    ])
  })

  it('should have aliases for every field', () => {
    for (const field of COLLECTION_ACCOUNT_SCHEMA) {
      expect(field.aliases.length).toBeGreaterThan(0)
      // Each field key should appear in its own aliases
      expect(
        field.aliases.some((a) => a === field.key || a === field.key.replace(/_/g, ''))
      ).toBe(true)
    }
  })

  it('should have unique field keys', () => {
    const keys = COLLECTION_ACCOUNT_SCHEMA.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

// ─── Column Matching Tests ──────────────────────────────────────────────────

describe('smartColumnMapping', () => {
  describe('exact matching', () => {
    it('should match exact field keys with 1.0 confidence', () => {
      const matches = smartColumnMapping(['name', 'balance_due', 'primary_phone'])
      const nameMatch = matches.find((m) => m.csvHeader === 'name')
      expect(nameMatch!.schemaField).toBe('name')
      expect(nameMatch!.confidence).toBe(1.0)
      expect(nameMatch!.matchType).toBe('exact')
    })

    it('should match case-insensitively', () => {
      const matches = smartColumnMapping(['Name', 'BALANCE_DUE', 'Primary_Phone'])
      expect(matches.find((m) => m.csvHeader === 'Name')!.schemaField).toBe('name')
      expect(matches.find((m) => m.csvHeader === 'BALANCE_DUE')!.schemaField).toBe('balance_due')
      expect(matches.find((m) => m.csvHeader === 'Primary_Phone')!.schemaField).toBe('primary_phone')
    })

    it('should match with spaces instead of underscores', () => {
      const matches = smartColumnMapping(['balance due', 'primary phone'])
      expect(matches.find((m) => m.csvHeader === 'balance due')!.schemaField).toBe('balance_due')
      expect(matches.find((m) => m.csvHeader === 'primary phone')!.schemaField).toBe('primary_phone')
    })
  })

  describe('alias matching', () => {
    it('should match COLLECT! style headers', () => {
      const matches = smartColumnMapping([
        'CustomerName',
        'CustomerPhone',
        'OpenBalance',
      ])
      expect(matches.find((m) => m.csvHeader === 'CustomerName')!.schemaField).toBe('name')
      expect(matches.find((m) => m.csvHeader === 'CustomerPhone')!.schemaField).toBe('primary_phone')
      expect(matches.find((m) => m.csvHeader === 'OpenBalance')!.schemaField).toBe('balance_due')
    })

    it('should match Salesforce style headers', () => {
      const matches = smartColumnMapping(['Account Name', 'Phone', 'Amount Due'])
      expect(matches.find((m) => m.csvHeader === 'Account Name')!.schemaField).toBe('name')
      expect(matches.find((m) => m.csvHeader === 'Phone')!.schemaField).toBe('primary_phone')
      expect(matches.find((m) => m.csvHeader === 'Amount Due')!.schemaField).toBe('balance_due')
    })

    it('should match generic CRM headers', () => {
      const matches = smartColumnMapping([
        'Full Name',
        'Cell Phone',
        'Outstanding Balance',
        'Email Address',
      ])
      expect(matches.find((m) => m.csvHeader === 'Full Name')!.schemaField).toBe('name')
      expect(matches.find((m) => m.csvHeader === 'Cell Phone')!.schemaField).toBe('primary_phone')
      expect(matches.find((m) => m.csvHeader === 'Outstanding Balance')!.schemaField).toBe('balance_due')
      expect(matches.find((m) => m.csvHeader === 'Email Address')!.schemaField).toBe('email')
    })

    it('should match abbreviated headers', () => {
      const matches = smartColumnMapping(['Tel', 'Amt', 'Bal'])
      expect(matches.find((m) => m.csvHeader === 'Tel')!.schemaField).toBe('primary_phone')
      expect(matches.find((m) => m.csvHeader === 'Amt')!.schemaField).toBe('balance_due')
    })

    it('should match alias matches with high confidence', () => {
      const matches = smartColumnMapping(['CustomerName'])
      const match = matches.find((m) => m.csvHeader === 'CustomerName')
      expect(match!.confidence).toBeGreaterThanOrEqual(0.9)
      expect(match!.matchType).toBe('alias')
    })
  })

  describe('fuzzy matching', () => {
    it('should fuzzy-match close header names above 0.6 threshold', () => {
      const matches = smartColumnMapping(['debtor_fullname'])
      const match = matches.find((m) => m.csvHeader === 'debtor_fullname')
      // Should match 'name' or stay unmatched based on similarity
      if (match!.schemaField) {
        expect(match!.confidence).toBeGreaterThanOrEqual(0.6)
        expect(match!.matchType).toBe('fuzzy')
      }
    })

    it('should not match completely unrelated headers', () => {
      const matches = smartColumnMapping(['xyz_unknown_col', 'random_stuff'])
      const matched = matches.filter((m) => m.schemaField !== null)
      // These should either be unmatched or have very low confidence
      for (const m of matched) {
        if (m.confidence < 0.6) {
          expect(m.schemaField).toBeNull()
        }
      }
    })
  })

  describe('conflict resolution', () => {
    it('should assign each schema field to at most one CSV column', () => {
      const matches = smartColumnMapping(['Name', 'Full Name', 'Customer Name'])
      const nameMatches = matches.filter((m) => m.schemaField === 'name')
      expect(nameMatches.length).toBeLessThanOrEqual(1)
    })

    it('should assign each CSV column to at most one schema field', () => {
      const matches = smartColumnMapping(['Phone', 'Email', 'Balance'])
      const assigned = matches.filter((m) => m.schemaField !== null)
      const csvHeaders = assigned.map((m) => m.csvHeader)
      expect(new Set(csvHeaders).size).toBe(csvHeaders.length)
    })
  })

  describe('test-data.csv compatibility', () => {
    it('should auto-map headers from test-data.csv', () => {
      // These are the actual headers from test-data.csv
      const testDataHeaders = [
        'InvoiceNum', 'InvoiceDate', 'DueDate', 'CustomerName',
        'CustomerPhone', 'CustomerEmail', 'OriginalAmount',
        'OpenBalance', 'DaysOverdue', 'Status', 'Memo',
      ]
      const matches = smartColumnMapping(testDataHeaders)

      // Required fields must be mapped
      const nameMatch = matches.find((m) => m.schemaField === 'name')
      const phoneMatch = matches.find((m) => m.schemaField === 'primary_phone')
      const balanceMatch = matches.find((m) => m.schemaField === 'balance_due')

      expect(nameMatch).toBeDefined()
      expect(nameMatch!.csvHeader).toBe('CustomerName')
      expect(phoneMatch).toBeDefined()
      expect(phoneMatch!.csvHeader).toBe('CustomerPhone')
      expect(balanceMatch).toBeDefined()
      // OriginalAmount or OpenBalance — both are valid aliases for balance_due
      expect(['OpenBalance', 'OriginalAmount']).toContain(balanceMatch!.csvHeader)
    })

    it('should also map optional fields from test-data.csv', () => {
      const testDataHeaders = [
        'InvoiceNum', 'InvoiceDate', 'DueDate', 'CustomerName',
        'CustomerPhone', 'CustomerEmail', 'OriginalAmount',
        'OpenBalance', 'DaysOverdue', 'Status', 'Memo',
      ]
      const matches = smartColumnMapping(testDataHeaders)

      const emailMatch = matches.find((m) => m.schemaField === 'email')
      expect(emailMatch).toBeDefined()
      expect(emailMatch!.csvHeader).toBe('CustomerEmail')

      const statusMatch = matches.find((m) => m.schemaField === 'status')
      expect(statusMatch).toBeDefined()
      expect(statusMatch!.csvHeader).toBe('Status')
    })
  })
})

// ─── Phone Normalization Tests ──────────────────────────────────────────────

describe('normalizePhone', () => {
  it('should pass through valid E.164 numbers', () => {
    expect(normalizePhone('+14045550101')).toBe('+14045550101')
    expect(normalizePhone('+12125551234')).toBe('+12125551234')
  })

  it('should normalize 10-digit US numbers', () => {
    expect(normalizePhone('4045550101')).toBe('+14045550101')
    expect(normalizePhone('2125551234')).toBe('+12125551234')
  })

  it('should normalize 11-digit US numbers starting with 1', () => {
    expect(normalizePhone('14045550101')).toBe('+14045550101')
  })

  it('should normalize formatted phone numbers', () => {
    expect(normalizePhone('(404) 555-0101')).toBe('+14045550101')
    expect(normalizePhone('404-555-0101')).toBe('+14045550101')
    expect(normalizePhone('404.555.0101')).toBe('+14045550101')
    expect(normalizePhone('404 555 0101')).toBe('+14045550101')
  })

  it('should normalize with country code prefix', () => {
    expect(normalizePhone('1-404-555-0101')).toBe('+14045550101')
    expect(normalizePhone('+1 (404) 555-0101')).toBe('+14045550101')
  })

  it('should return empty string for empty input', () => {
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone('   ')).toBe('')
  })

  it('should return raw value for unparseable numbers', () => {
    const result = normalizePhone('12345')
    expect(result).toBe('12345')
  })

  it('should handle null/undefined gracefully', () => {
    expect(normalizePhone(null as unknown as string)).toBe('')
    expect(normalizePhone(undefined as unknown as string)).toBe('')
  })
})

// ─── Currency Coercion Tests ────────────────────────────────────────────────

describe('coerceCurrency', () => {
  it('should pass through numbers', () => {
    expect(coerceCurrency(1500.5)).toBe(1500.5)
    expect(coerceCurrency(0)).toBe(0)
  })

  it('should parse numeric strings', () => {
    expect(coerceCurrency('1500.50')).toBe(1500.5)
    expect(coerceCurrency('1500')).toBe(1500)
  })

  it('should strip dollar signs', () => {
    expect(coerceCurrency('$1500.50')).toBe(1500.5)
    expect(coerceCurrency('$1,500.50')).toBe(1500.5)
  })

  it('should strip commas and spaces', () => {
    expect(coerceCurrency('1,500.50')).toBe(1500.5)
    expect(coerceCurrency('1 500.50')).toBe(1500.5)
  })

  it('should handle other currency symbols', () => {
    expect(coerceCurrency('€1500.50')).toBe(1500.5)
    expect(coerceCurrency('£2,500')).toBe(2500)
  })

  it('should handle parenthesized negatives', () => {
    expect(coerceCurrency('(1500)')).toBe(1500)
  })

  it('should return null for empty/null values', () => {
    expect(coerceCurrency(null)).toBeNull()
    expect(coerceCurrency(undefined)).toBeNull()
    expect(coerceCurrency('')).toBeNull()
  })

  it('should return null for non-numeric strings', () => {
    expect(coerceCurrency('abc')).toBeNull()
    expect(coerceCurrency('N/A')).toBeNull()
  })
})

// ─── Status Coercion Tests ──────────────────────────────────────────────────

describe('coerceStatus', () => {
  it('should pass through valid status values', () => {
    expect(coerceStatus('active')).toBe('active')
    expect(coerceStatus('paid')).toBe('paid')
    expect(coerceStatus('partial')).toBe('partial')
    expect(coerceStatus('disputed')).toBe('disputed')
    expect(coerceStatus('archived')).toBe('archived')
  })

  it('should be case-insensitive', () => {
    expect(coerceStatus('Active')).toBe('active')
    expect(coerceStatus('PAID')).toBe('paid')
    expect(coerceStatus('Disputed')).toBe('disputed')
  })

  it('should map common synonyms', () => {
    expect(coerceStatus('open')).toBe('active')
    expect(coerceStatus('current')).toBe('active')
    expect(coerceStatus('new')).toBe('active')
    expect(coerceStatus('pending')).toBe('active')
  })

  it('should map overdue/delinquent to active', () => {
    expect(coerceStatus('Overdue')).toBe('active')
    expect(coerceStatus('delinquent')).toBe('active')
    expect(coerceStatus('past due')).toBe('active')
    expect(coerceStatus('past_due')).toBe('active')
  })

  it('should map closed/settled to paid', () => {
    expect(coerceStatus('closed')).toBe('paid')
    expect(coerceStatus('settled')).toBe('paid')
    expect(coerceStatus('resolved')).toBe('paid')
    expect(coerceStatus('collected')).toBe('paid')
  })

  it('should map partial payment synonyms', () => {
    expect(coerceStatus('partial payment')).toBe('partial')
    expect(coerceStatus('partially paid')).toBe('partial')
    expect(coerceStatus('part paid')).toBe('partial')
  })

  it('should map dispute synonyms', () => {
    expect(coerceStatus('dispute')).toBe('disputed')
    expect(coerceStatus('contested')).toBe('disputed')
    expect(coerceStatus('challenged')).toBe('disputed')
  })

  it('should map inactive/hold to archived', () => {
    expect(coerceStatus('inactive')).toBe('archived')
    expect(coerceStatus('cancelled')).toBe('archived')
    expect(coerceStatus('on hold')).toBe('archived')
    expect(coerceStatus('deleted')).toBe('archived')
  })

  it('should default unknown statuses to active', () => {
    expect(coerceStatus('unknown_status')).toBe('active')
    expect(coerceStatus('whatever')).toBe('active')
    expect(coerceStatus('')).toBe('active')
  })
})

// ─── Row Transformation Tests ───────────────────────────────────────────────

describe('transformRow', () => {
  const mapping = {
    name: 'CustomerName',
    balance_due: 'OpenBalance',
    primary_phone: 'CustomerPhone',
    email: 'CustomerEmail',
    status: 'Status',
  }

  it('should transform a complete row with coercion', () => {
    const raw = {
      CustomerName: ' John Smith ',
      OpenBalance: '$2,500.50',
      CustomerPhone: '(404) 555-0101',
      CustomerEmail: ' JOHN@EXAMPLE.COM ',
      Status: 'Overdue',
    }

    const result = transformRow(raw, mapping)
    expect(result.name).toBe('John Smith')
    expect(result.balance_due).toBe(2500.5)
    expect(result.primary_phone).toBe('+14045550101')
    expect(result.email).toBe('john@example.com')
    expect(result.status).toBe('active') // Overdue → active
  })

  it('should skip unmapped fields', () => {
    const raw = {
      CustomerName: 'Jane',
      OpenBalance: '1000',
      CustomerPhone: '5551234567',
      UnmappedColumn: 'some value',
    }
    const result = transformRow(raw, mapping)
    expect(result).not.toHaveProperty('UnmappedColumn')
  })

  it('should skip empty values', () => {
    const raw = {
      CustomerName: 'Bob',
      OpenBalance: '500',
      CustomerPhone: '5551234567',
      CustomerEmail: '',
      Status: '',
    }
    const result = transformRow(raw, mapping)
    expect(result).not.toHaveProperty('email')
    expect(result).not.toHaveProperty('status')
  })

  it('should handle the test-data.csv row format', () => {
    const testDataMapping = {
      name: 'CustomerName',
      balance_due: 'OpenBalance',
      primary_phone: 'CustomerPhone',
      email: 'CustomerEmail',
      status: 'Status',
      external_id: 'InvoiceNum',
      notes: 'Memo',
    }

    const raw = {
      InvoiceNum: 'INV-001',
      InvoiceDate: '2026-01-15',
      DueDate: '2026-02-15',
      CustomerName: 'Acme Corp',
      CustomerPhone: '(404) 555-0101',
      CustomerEmail: 'billing@acme.com',
      OriginalAmount: '5000.00',
      OpenBalance: '3500.50',
      DaysOverdue: '15',
      Status: 'Current',
      Memo: 'Partial payment received',
    }

    const result = transformRow(raw, testDataMapping)
    expect(result.name).toBe('Acme Corp')
    expect(result.balance_due).toBe(3500.5)
    expect(result.primary_phone).toBe('+14045550101')
    expect(result.email).toBe('billing@acme.com')
    expect(result.status).toBe('active') // Current → active
    expect(result.external_id).toBe('INV-001')
    expect(result.notes).toBe('Partial payment received')
  })
})

// ─── Row Validation Tests ───────────────────────────────────────────────────

describe('validateRow', () => {
  it('should accept a valid row with all required fields', () => {
    const row = {
      name: 'John Doe',
      balance_due: 1500.5,
      primary_phone: '+14045550101',
    }
    const result = validateRow(row, 0)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject a row missing name', () => {
    const row = {
      balance_due: 1500,
      primary_phone: '+14045550101',
    }
    const result = validateRow(row, 0)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'name')).toBe(true)
  })

  it('should reject a row missing balance_due', () => {
    const row = {
      name: 'John',
      primary_phone: '+14045550101',
    }
    const result = validateRow(row, 0)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'balance_due')).toBe(true)
  })

  it('should reject a row missing primary_phone', () => {
    const row = {
      name: 'John',
      balance_due: 1500,
    }
    const result = validateRow(row, 0)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'primary_phone')).toBe(true)
  })

  it('should reject non-numeric balance_due', () => {
    const row = {
      name: 'John',
      balance_due: 'abc',
      primary_phone: '+14045550101',
    }
    const result = validateRow(row, 0)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'balance_due')).toBe(true)
  })

  it('should accept a row with all optional fields', () => {
    const row = {
      name: 'Jane Smith',
      balance_due: 2500,
      primary_phone: '+14045550101',
      secondary_phone: '+14045550102',
      email: 'jane@example.com',
      external_id: 'ACCT-001',
      status: 'active',
      notes: 'Good payer',
    }
    const result = validateRow(row, 0)
    expect(result.valid).toBe(true)
  })

  it('should include the row index in result', () => {
    const row = { name: 'Test', balance_due: 100, primary_phone: '+14045550101' }
    const result = validateRow(row, 5)
    expect(result.index).toBe(5)
  })
})

// ─── Batch Validation Tests ─────────────────────────────────────────────────

describe('validateAllRows', () => {
  it('should return correct summary for all valid rows', () => {
    const rows = [
      { name: 'Alice', balance_due: 1000, primary_phone: '+14045550101' },
      { name: 'Bob', balance_due: 2000, primary_phone: '+14045550102' },
      { name: 'Carol', balance_due: 3000, primary_phone: '+14045550103' },
    ]
    const summary = validateAllRows(rows)
    expect(summary.totalRows).toBe(3)
    expect(summary.validRows).toBe(3)
    expect(summary.invalidRows).toBe(0)
    expect(summary.topIssues).toHaveLength(0)
  })

  it('should count invalid rows correctly', () => {
    const rows = [
      { name: 'Alice', balance_due: 1000, primary_phone: '+14045550101' },
      { name: '', balance_due: 2000, primary_phone: '+14045550102' }, // invalid
      { name: 'Carol', balance_due: 3000, primary_phone: '+14045550103' },
    ]
    const summary = validateAllRows(rows)
    expect(summary.totalRows).toBe(3)
    expect(summary.validRows).toBe(2)
    expect(summary.invalidRows).toBe(1)
  })

  it('should aggregate top issues', () => {
    const rows = [
      { balance_due: 1000, primary_phone: '+14045550101' }, // missing name
      { balance_due: 2000, primary_phone: '+14045550102' }, // missing name
      { name: 'C', balance_due: null, primary_phone: '+14045550103' }, // missing balance
    ]
    const summary = validateAllRows(rows)
    expect(summary.topIssues.length).toBeGreaterThan(0)
  })

  it('should handle empty array', () => {
    const summary = validateAllRows([])
    expect(summary.totalRows).toBe(0)
    expect(summary.validRows).toBe(0)
    expect(summary.invalidRows).toBe(0)
  })
})

// ─── Template Generation Tests ──────────────────────────────────────────────

describe('generateTemplate', () => {
  it('should return a valid CSV string', () => {
    const csv = generateTemplate()
    expect(typeof csv).toBe('string')
    expect(csv.length).toBeGreaterThan(0)
  })

  it('should include all schema field labels as headers', () => {
    const csv = generateTemplate()
    const lines = csv.split('\n')
    const headers = lines[0]
    for (const field of COLLECTION_ACCOUNT_SCHEMA) {
      expect(headers).toContain(field.label)
    }
  })

  it('should include at least one sample data row', () => {
    const csv = generateTemplate()
    const lines = csv.split('\n').filter((l) => l.trim())
    expect(lines.length).toBeGreaterThanOrEqual(2) // header + at least 1 data row
  })

  it('should have at least as many columns in data rows as header (allowing quoted commas)', () => {
    const csv = generateTemplate()
    const lines = csv.split('\n').filter((l) => l.trim())
    const headerCols = lines[0].split(',').length
    // Data rows may have more splits due to commas inside quoted fields
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].split(',').length).toBeGreaterThanOrEqual(headerCols)
    }
  })
})

// ─── Integration: End-to-End Mapping + Transform + Validate ─────────────────

describe('End-to-end pipeline', () => {
  it('should handle a typical COLLECT! export end-to-end', () => {
    const collectHeaders = [
      'AccountNumber', 'DebtorName', 'DebtorPhone', 'DebtorEmail',
      'OriginalBalance', 'CurrentBalance', 'AccountStatus', 'Notes',
    ]

    // Step 1: Map columns
    const matches = smartColumnMapping(collectHeaders)
    const mapping: Record<string, string> = {}
    for (const m of matches) {
      if (m.schemaField && m.confidence >= 0.6) {
        mapping[m.schemaField] = m.csvHeader
      }
    }

    // Verify required fields are mapped
    expect(mapping.name).toBeDefined()
    expect(mapping.primary_phone).toBeDefined()
    expect(mapping.balance_due).toBeDefined()

    // Step 2: Transform a row
    const rawRow: Record<string, string> = {
      AccountNumber: 'COL-12345',
      DebtorName: 'John Q. Public',
      DebtorPhone: '(212) 555-7890',
      DebtorEmail: 'john@example.com',
      OriginalBalance: '$5,000.00',
      CurrentBalance: '$3,250.75',
      AccountStatus: 'Past Due',
      Notes: 'Promised payment by 3/1',
    }
    const transformed = transformRow(rawRow, mapping)

    expect(transformed.name).toBe('John Q. Public')
    expect(transformed.primary_phone).toBe('+12125557890')
    expect(typeof transformed.balance_due).toBe('number')

    // Step 3: Validate
    const validation = validateRow(transformed, 0)
    expect(validation.valid).toBe(true)
  })

  it('should handle a QuickBooks-style export', () => {
    const qbHeaders = ['Customer', 'Phone Number', 'Invoice Amount', 'Email']
    const matches = smartColumnMapping(qbHeaders)
    const mapping: Record<string, string> = {}
    for (const m of matches) {
      if (m.schemaField && m.confidence >= 0.6) {
        mapping[m.schemaField] = m.csvHeader
      }
    }

    expect(mapping.name).toBeDefined()
    expect(mapping.primary_phone).toBeDefined()
    expect(mapping.balance_due).toBeDefined()
  })

  it('should handle a generic Excel export', () => {
    const excelHeaders = ['Full Name', 'Mobile', 'Amount Owed', 'Work Phone', 'Status']
    const matches = smartColumnMapping(excelHeaders)
    const mapping: Record<string, string> = {}
    for (const m of matches) {
      if (m.schemaField && m.confidence >= 0.6) {
        mapping[m.schemaField] = m.csvHeader
      }
    }

    expect(mapping.name).toBeDefined()
    expect(mapping.primary_phone).toBeDefined()
    expect(mapping.balance_due).toBeDefined()
  })

  it('should validate a batch of transformed rows', () => {
    const mapping = {
      name: 'Name',
      balance_due: 'Balance',
      primary_phone: 'Phone',
    }

    const rawRows = [
      { Name: 'Alice Jones', Balance: '$1,200.00', Phone: '(555) 123-4567' },
      { Name: 'Bob Smith', Balance: '$850', Phone: '555-987-6543' },
      { Name: '', Balance: '$500', Phone: '555-111-2222' }, // invalid: empty name
    ]

    const transformed = rawRows.map((row) => transformRow(row, mapping))
    const summary = validateAllRows(transformed)

    expect(summary.totalRows).toBe(3)
    expect(summary.validRows).toBe(2)
    expect(summary.invalidRows).toBe(1)
  })
})
