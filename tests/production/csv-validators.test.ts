/**
 * CSV Pre-Validators — Unit Tests
 *
 * Tests the client-side CSV validation library.
 * These are pure function tests — no API calls, no DB.
 */

import { describe, it, expect } from 'vitest'
import {
  validateCsvRow,
  validateCsvRows,
  formatValidationMessage,
  detectColumnMapping,
  applyColumnMapping,
} from '../../lib/csv-validators'

describe('CSV Pre-Validators', () => {
  // ── Single Row Validation ───────────────────────────────────────────────

  describe('validateCsvRow', () => {
    it('should accept a valid row with all required fields', () => {
      const result = validateCsvRow(
        { name: 'John Doe', balance_due: 1500.5, primary_phone: '+15551234567' },
        0
      )
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.row).toBe(1) // 1-indexed
    })

    it('should accept a valid row with all optional fields', () => {
      const result = validateCsvRow(
        {
          name: 'Jane Smith',
          balance_due: 2500,
          primary_phone: '+15559876543',
          secondary_phone: '+15551112222',
          email: 'jane@example.com',
          external_id: 'ACCT-001',
          address: '123 Main St, City, ST 12345',
          status: 'active',
          notes: 'Good payment history',
          promise_amount: 500,
          promise_date: '2026-03-01',
        },
        0
      )
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject missing name', () => {
      const result = validateCsvRow(
        { name: '', balance_due: 100, primary_phone: '+15551234567' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'name', message: 'Name is required' })
      )
    })

    it('should reject non-numeric balance', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: 'abc', primary_phone: '+15551234567' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'balance_due' }))
    })

    it('should reject negative balance', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: -100, primary_phone: '+15551234567' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'balance_due', message: 'Balance cannot be negative' })
      )
    })

    it('should reject balance exceeding maximum', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: 100_000_000, primary_phone: '+15551234567' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'balance_due' }))
    })

    it('should reject missing phone', () => {
      const result = validateCsvRow({ name: 'Test', balance_due: 100 }, 0)
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'primary_phone', message: 'Primary phone is required' })
      )
    })

    it('should reject invalid E.164 phone - missing plus', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: 100, primary_phone: '15551234567' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'primary_phone' }))
    })

    it('should reject invalid E.164 phone - too short', () => {
      const result = validateCsvRow({ name: 'Test', balance_due: 100, primary_phone: '+1' }, 0)
      expect(result.valid).toBe(false)
    })

    it('should reject invalid E.164 phone - starts with +0', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: 100, primary_phone: '+0551234567' },
        0
      )
      expect(result.valid).toBe(false)
    })

    it('should reject invalid secondary phone', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: 100, primary_phone: '+15551234567', secondary_phone: 'bad' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'secondary_phone' }))
    })

    it('should reject invalid email format', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: 100, primary_phone: '+15551234567', email: 'not-an-email' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'email' }))
    })

    it('should reject invalid status', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: 100, primary_phone: '+15551234567', status: 'unknown' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'status' }))
    })

    it('should collect multiple errors on one row', () => {
      const result = validateCsvRow(
        { name: '', balance_due: -1, primary_phone: 'bad', email: 'bad' },
        0
      )
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(4)
    })

    it('should handle string balance from CSV parsing', () => {
      const result = validateCsvRow(
        { name: 'Test', balance_due: '1500.50', primary_phone: '+15551234567' },
        0
      )
      expect(result.valid).toBe(true)
    })

    it('should accept valid statuses', () => {
      for (const status of ['active', 'paid', 'partial', 'disputed', 'archived']) {
        const result = validateCsvRow(
          { name: 'Test', balance_due: 100, primary_phone: '+15551234567', status },
          0
        )
        expect(result.valid).toBe(true)
      }
    })
  })

  // ── Batch Validation ────────────────────────────────────────────────────

  describe('validateCsvRows', () => {
    it('should summarize all-valid rows', () => {
      const summary = validateCsvRows([
        { name: 'A', balance_due: 100, primary_phone: '+15551111111' },
        { name: 'B', balance_due: 200, primary_phone: '+15552222222' },
      ])
      expect(summary.totalRows).toBe(2)
      expect(summary.validRows).toBe(2)
      expect(summary.invalidRows).toBe(0)
      expect(summary.validData).toHaveLength(2)
      expect(summary.invalidData).toHaveLength(0)
    })

    it('should summarize mixed valid/invalid rows', () => {
      const summary = validateCsvRows([
        { name: 'Valid', balance_due: 100, primary_phone: '+15551111111' },
        { name: '', balance_due: -1, primary_phone: 'bad' },
        { name: 'Also Valid', balance_due: 300, primary_phone: '+15553333333' },
      ])
      expect(summary.totalRows).toBe(3)
      expect(summary.validRows).toBe(2)
      expect(summary.invalidRows).toBe(1)
      expect(summary.errorsByField).toHaveProperty('name')
      expect(summary.errorsByField).toHaveProperty('balance_due')
      expect(summary.errorsByField).toHaveProperty('primary_phone')
    })

    it('should count errors by field correctly', () => {
      const summary = validateCsvRows([
        { name: '', balance_due: 100, primary_phone: '+15551111111' },
        { name: '', balance_due: 200, primary_phone: '+15552222222' },
        { name: 'OK', balance_due: 300, primary_phone: 'bad' },
      ])
      expect(summary.errorsByField.name).toBe(2)
      expect(summary.errorsByField.primary_phone).toBe(1)
    })

    it('should handle empty input', () => {
      const summary = validateCsvRows([])
      expect(summary.totalRows).toBe(0)
      expect(summary.validRows).toBe(0)
      expect(summary.invalidRows).toBe(0)
    })
  })

  // ── Format Message ──────────────────────────────────────────────────────

  describe('formatValidationMessage', () => {
    it('should show success for all-valid rows', () => {
      const msg = formatValidationMessage({
        totalRows: 5,
        validRows: 5,
        invalidRows: 0,
        validData: [],
        invalidData: [],
        errorsByField: {},
      })
      expect(msg).toContain('✅')
      expect(msg).toContain('5')
    })

    it('should show warning with error breakdown', () => {
      const msg = formatValidationMessage({
        totalRows: 10,
        validRows: 7,
        invalidRows: 3,
        validData: [],
        invalidData: [],
        errorsByField: { primary_phone: 2, balance_due: 1 },
      })
      expect(msg).toContain('⚠️')
      expect(msg).toContain('3')
      expect(msg).toContain('primary_phone')
      expect(msg).toContain('7 valid rows')
    })
  })

  // ── Column Mapping ──────────────────────────────────────────────────────

  describe('detectColumnMapping', () => {
    it('should map standard column names', () => {
      const mapping = detectColumnMapping(['Name', 'Balance Due', 'Phone', 'Email'])
      expect(mapping['Name']).toBe('name')
      expect(mapping['Balance Due']).toBe('balance_due')
      expect(mapping['Phone']).toBe('primary_phone')
      expect(mapping['Email']).toBe('email')
    })

    it('should map industry-standard aliases', () => {
      const mapping = detectColumnMapping([
        'Customer Name',
        'Amount Owed',
        'Telephone',
        'Account Number',
      ])
      expect(mapping['Customer Name']).toBe('name')
      expect(mapping['Amount Owed']).toBe('balance_due')
      expect(mapping['Telephone']).toBe('primary_phone')
      expect(mapping['Account Number']).toBe('external_id')
    })

    it('should handle mixed case and underscores', () => {
      const mapping = detectColumnMapping(['FULL_NAME', 'AMOUNT_DUE', 'CELL'])
      expect(mapping['FULL_NAME']).toBe('name')
      expect(mapping['AMOUNT_DUE']).toBe('balance_due')
      expect(mapping['CELL']).toBe('primary_phone')
    })

    it('should skip unrecognized columns', () => {
      const mapping = detectColumnMapping(['Name', 'RandomColumn', 'Phone'])
      expect(Object.keys(mapping)).toHaveLength(2)
      expect(mapping['RandomColumn']).toBeUndefined()
    })
  })

  // ── Apply Column Mapping ────────────────────────────────────────────────

  describe('applyColumnMapping', () => {
    it('should remap CSV columns to schema fields', () => {
      const rows = [{ 'Customer Name': 'John', Amount: '$1,500.50', Phone: '+15551234567' }]
      const mapping = { 'Customer Name': 'name', Amount: 'balance_due', Phone: 'primary_phone' }

      const result = applyColumnMapping(rows, mapping)
      expect(result[0].name).toBe('John')
      expect(result[0].balance_due).toBe(1500.5)
      expect(result[0].primary_phone).toBe('+15551234567')
    })

    it('should coerce string balance with dollar signs and commas', () => {
      const rows = [{ balance_due: '$2,500.00' }]
      const result = applyColumnMapping(rows, {})
      expect(result[0].balance_due).toBe(2500)
    })

    it('should coerce string promise_amount', () => {
      const rows = [{ promise_amount: '$500.00' }]
      const result = applyColumnMapping(rows, {})
      expect(result[0].promise_amount).toBe(500)
    })

    it('should pass through unmapped columns', () => {
      const rows = [{ custom_field: 'value', name: 'Test' }]
      const result = applyColumnMapping(rows, {})
      expect(result[0].custom_field).toBe('value')
      expect(result[0].name).toBe('Test')
    })
  })
})
