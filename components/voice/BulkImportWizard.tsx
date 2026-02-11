'use client'

import { useState, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiPost, apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import {
  applyColumnMapping,
  detectColumnMapping,
  validateCsvRows,
} from '@/lib/csv-validators'

interface ColumnMapping {
  name: string
  balance_due: string
  primary_phone: string
  email?: string
  external_id?: string
  notes?: string
}

interface ImportResult {
  id: string
  file_name: string
  rows_total: number
  rows_imported: number
  rows_skipped: number
  errors: Array<{ row: number; error: string }> | null
}

interface ImportHistory {
  id: string
  file_name: string
  rows_total: number
  rows_imported: number
  rows_skipped: number
  status: string
  created_at: string
}

const REQUIRED_COLUMNS = ['name', 'balance_due', 'primary_phone'] as const
const OPTIONAL_COLUMNS = ['email', 'external_id', 'secondary_phone', 'notes', 'address'] as const

interface BulkImportWizardProps {
  onComplete?: () => void
  onImportStart?: () => void
  initialShowHistory?: boolean
}

/**
 * BulkImportWizard — CSV file import for collection accounts
 *
 * 3-step wizard: Upload → Map Columns → Review & Import.
 * Uses POST /api/collections/import endpoint.
 */
export default function BulkImportWizard({
  onComplete,
  onImportStart,
  initialShowHistory = false,
}: BulkImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [csvData, setCsvData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const [showHistory, setShowHistory] = useState(initialShowHistory)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Parse CSV text into rows
  function parseCsv(text: string): string[][] {
    const lines = text.split('\n').filter((line) => line.trim())
    return lines.map((line) => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    })
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setResult(null)

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5 MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = parseCsv(text)

      if (rows.length < 2) {
        setError('CSV must contain a header row and at least one data row')
        return
      }

      setFileName(file.name)
      setHeaders(rows[0])
      setCsvData(rows.slice(1))

      // Auto-map columns using schema aliases
      const detected = detectColumnMapping(rows[0])
      const autoMapping: Record<string, string> = {}
      for (const [csvColumn, schemaField] of Object.entries(detected)) {
        autoMapping[schemaField] = csvColumn
      }
      setMapping(autoMapping)
      setStep(2)
    }
    reader.onerror = () => setError('Failed to read file')
    reader.readAsText(file)
  }

  function handleMappingChange(field: string, csvColumn: string) {
    setMapping((prev) => ({ ...prev, [field]: csvColumn }))
  }

  const canProceedToStep3 = useMemo(() => {
    return REQUIRED_COLUMNS.every((col) => mapping[col] && headers.includes(mapping[col]))
  }, [mapping, headers])

  const mappedRows = useMemo(() => {
    if (!headers.length || csvData.length === 0) return []
    return csvData.map((row) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((header, idx) => {
        obj[header] = row[idx]
      })
      return obj
    })
  }, [headers, csvData])

  const validationSummary = useMemo(() => {
    if (!canProceedToStep3 || mappedRows.length === 0) return null
    const applied = applyColumnMapping(mappedRows, invertMapping(mapping))
    const summary = validateCsvRows(applied)
    if (summary.invalidRows === 0) {
      return `All ${summary.totalRows} rows are valid and ready to import.`
    }
    const topFields = Object.entries(summary.errorsByField)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([field, count]) => `${field}: ${count}`)
      .join(', ')
    return `${summary.invalidRows} of ${summary.totalRows} rows have errors. Top issues: ${topFields}.`
  }, [mappedRows, mapping, canProceedToStep3])

  async function handleImport() {
    setImporting(true)
    setError(null)
    onImportStart?.()

    try {
      // Build accounts from CSV data using mapping
      const accounts = csvData
        .map((row) => {
          const account: Record<string, string | number | undefined> = {}
          for (const [field, csvCol] of Object.entries(mapping)) {
            const colIndex = headers.indexOf(csvCol)
            if (colIndex >= 0) {
              const value = row[colIndex]
              if (field === 'balance_due') {
                account[field] = parseFloat(value.replace(/[,$]/g, '')) || 0
              } else if (field === 'primary_phone' || field === 'secondary_phone') {
                account[field] = normalizePhone(value)
              } else {
                account[field] = value || undefined
              }
            }
          }
          return account
        })
        .filter((a) => a.name && a.primary_phone)

      if (accounts.length === 0) {
        setError('No valid accounts found after mapping. Check that name and phone columns are correct.')
        setImporting(false)
        return
      }

      const data = await apiPost<{ import: ImportResult }>('/api/collections/import', {
        file_name: fileName,
        accounts,
        column_mapping: mapping,
      })

      setResult(data.import)
      setStep(3)
      onComplete?.()
    } catch (err: any) {
      logger.error('Bulk import failed', { error: err })
      setError(err?.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function loadHistory() {
    try {
      const data = await apiGet<{ imports: ImportHistory[] }>('/api/collections/imports')
      setImportHistory(data.imports || [])
      setShowHistory(true)
    } catch (err: any) {
      logger.error('Failed to load import history', { error: err })
    }
  }

  function reset() {
    setStep(1)
    setCsvData([])
    setHeaders([])
    setFileName('')
    setMapping({})
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Bulk Import Accounts</h3>
          <p className="text-sm text-gray-500">Import collection accounts from a CSV file</p>
        </div>
        <button
          onClick={loadHistory}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View Import History
        </button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                step >= s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s ? '\u2713' : s}
            </div>
            <span className="text-xs text-gray-500">
              {s === 1 ? 'Upload' : s === 2 ? 'Map Columns' : 'Results'}
            </span>
            {s < 3 && <div className="w-8 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
          />
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <label
                htmlFor="csv-upload"
                className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Choose a CSV file
              </label>
              <p className="text-xs text-gray-400 mt-1">Max 5 MB. Must include name, balance_due, and primary_phone columns.</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">
              File: <span className="font-mono text-gray-900">{fileName}</span>
            </p>
            <p className="text-xs text-gray-500">
              {csvData.length} rows detected with {headers.length} columns
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Phone numbers are normalized when possible. Review the preview before importing.
            </p>
          </div>

          <div className="rounded-lg bg-white border border-gray-200 p-4 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Map CSV Columns</p>

            {/* Required fields */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Required</p>
              {REQUIRED_COLUMNS.map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 w-32 shrink-0">
                    {field.replace(/_/g, ' ')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">-- Select column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {mapping[field] && (
                    <Badge variant="info" className="text-xs">Mapped</Badge>
                  )}
                </div>
              ))}
            </div>

            {/* Optional fields */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Optional</p>
              {OPTIONAL_COLUMNS.map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 w-32 shrink-0">
                    {field.replace(/_/g, ' ')}
                  </label>
                  <select
                    value={mapping[field] || ''}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">-- Select column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {canProceedToStep3 && (
            <div className="rounded-lg bg-white border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview (first 3 rows)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(mapping).filter((k) => mapping[k]).map((field) => (
                        <th key={field} className="px-2 py-1 text-left font-medium text-gray-500">
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {csvData.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {Object.entries(mapping).filter(([, v]) => v).map(([field, csvCol]) => (
                          <td key={field} className="px-2 py-1 text-gray-700">
                            {row[headers.indexOf(csvCol)] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validationSummary && (
                <p className="text-xs text-gray-500 mt-3">{validationSummary}</p>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" size="sm" onClick={reset}>
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!canProceedToStep3 || importing}
            >
              {importing ? 'Importing...' : `Import ${csvData.length} Accounts`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && result && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white border border-gray-200 p-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Import Complete</h4>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-green-600">{result.rows_imported}</p>
                <p className="text-gray-500">Imported</p>
              </div>
              {result.rows_skipped > 0 && (
                <div>
                  <p className="text-2xl font-bold text-red-500">{result.rows_skipped}</p>
                  <p className="text-gray-500">Skipped</p>
                </div>
              )}
              <div>
                <p className="text-2xl font-bold text-gray-900">{result.rows_total}</p>
                <p className="text-gray-500">Total</p>
              </div>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-medium text-red-700 mb-2">Import Errors</p>
              <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>Row {err.row}: {err.error}</li>
                ))}
                {result.errors.length > 20 && (
                  <li>+ {result.errors.length - 20} more errors</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex justify-center">
            <Button size="sm" variant="secondary" onClick={reset}>
              Import Another File
            </Button>
          </div>
        </div>
      )}

      {/* Import History Modal */}
      {showHistory && (
        <div className="rounded-lg bg-white border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Import History</p>
            <button
              onClick={() => setShowHistory(false)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Close
            </button>
          </div>
          {importHistory.length === 0 ? (
            <p className="text-sm text-gray-400">No previous imports.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {importHistory.map((imp) => (
                <div key={imp.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{imp.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(imp.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      {' '}&mdash;{' '}
                      {imp.rows_imported}/{imp.rows_total} imported
                    </p>
                  </div>
                  <Badge
                    variant={imp.status === 'completed' ? 'success' : imp.status === 'failed' ? 'error' : 'info'}
                  >
                    {imp.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function invertMapping(mapping: Record<string, string>): Record<string, string> {
  const inverted: Record<string, string> = {}
  for (const [schemaField, csvColumn] of Object.entries(mapping)) {
    if (csvColumn) inverted[csvColumn] = schemaField
  }
  return inverted
}

function normalizePhone(value: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/[^\d]/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return trimmed
}
