'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { apiPost, apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import {
  COLLECTION_ACCOUNT_SCHEMA,
  smartColumnMapping,
  transformRow,
  validateAllRows,
  downloadTemplate,
  type ColumnMatch,
  type SchemaField,
  type ValidationSummary,
} from '@/lib/smart-csv-import'

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface SmartImportWizardProps {
  onComplete?: () => void
  onImportStart?: () => void
  /** Show compact version for onboarding embed */
  compact?: boolean
}

type Step = 'upload' | 'map' | 'preview' | 'result'

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * SmartImportWizard — Industry-standard CSV import experience
 *
 * 4-step wizard: Upload → Map Columns → Preview & Validate → Results.
 * Features:
 *   - Drag-and-drop + click-to-browse file selector
 *   - PapaParse for robust CSV/TSV parsing (handles quoted fields, newlines)
 *   - Fuzzy column matching (Levenshtein + alias table)
 *   - Automatic phone normalization (any US format → E.164)
 *   - Currency coercion ($1,500.50 → 1500.5)
 *   - Status mapping (Overdue → active, Settled → paid)
 *   - Live preview with row-level validation highlighting
 *   - Downloadable CSV template
 *   - Import history sidebar
 *
 * ARCH_DOCS: 04-FEATURES/DATA_IMPORT.md
 *
 * @see lib/smart-csv-import.ts (engine)
 * @see workers/src/routes/collections.ts (POST /api/collections/import)
 */
export default function SmartImportWizard({
  onComplete,
  onImportStart,
  compact = false,
}: SmartImportWizardProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMatches, setColumnMatches] = useState<ColumnMatch[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // schemaField → csvHeader
  const [validation, setValidation] = useState<ValidationSummary | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const schema = COLLECTION_ACCOUNT_SCHEMA
  const requiredFields = schema.filter((f) => f.required)
  const optionalFields = schema.filter((f) => !f.required)

  // ── File Processing ────────────────────────────────────────────────────

  const processFile = useCallback(
    (file: File) => {
      setError(null)
      setResult(null)

      // Validate file type
      const validTypes = ['.csv', '.tsv', '.txt']
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!validTypes.includes(ext)) {
        setError(
          `Unsupported file type "${ext}". We accept CSV, TSV, and TXT files. ` +
            'For Excel files (.xlsx), save as CSV first.'
        )
        return
      }

      // Max 10 MB
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be under 10 MB. For larger files, split into batches.')
        return
      }

      setFileName(file.name)
      setFileSize(file.size)

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            setError(
              `Could not parse file: ${results.errors[0].message}. ` +
                'Check that the file is a valid CSV with comma or tab separators.'
            )
            return
          }

          if (results.data.length === 0) {
            setError('File is empty or has no data rows. Make sure there is a header row followed by data.')
            return
          }

          if (results.data.length > 10_000) {
            setError(
              `File has ${results.data.length.toLocaleString()} rows (max 10,000). ` +
                'Split your file into smaller batches.'
            )
            return
          }

          const headers = results.meta.fields ?? []
          setCsvHeaders(headers)
          setParsedData(results.data)

          // Run smart column matching
          const matches = smartColumnMapping(headers, schema)
          setColumnMatches(matches)

          // Build initial mapping from auto-detected matches
          const autoMapping: Record<string, string> = {}
          for (const match of matches) {
            if (match.schemaField && match.confidence >= 0.6) {
              autoMapping[match.schemaField] = match.csvHeader
            }
          }
          setMapping(autoMapping)

          setStep('map')
        },
        error: (err) => {
          setError(`Failed to read file: ${err.message}`)
        },
      })
    },
    [schema]
  )

  // ── Drag & Drop ────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  // ── Column Mapping ─────────────────────────────────────────────────────

  const handleMappingChange = useCallback((schemaField: string, csvHeader: string) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (csvHeader === '') {
        delete next[schemaField]
      } else {
        next[schemaField] = csvHeader
      }
      return next
    })
  }, [])

  const allRequiredMapped = useMemo(() => {
    return requiredFields.every((f) => mapping[f.key] && csvHeaders.includes(mapping[f.key]))
  }, [mapping, csvHeaders, requiredFields])

  const mappingConfidence = useMemo(() => {
    if (columnMatches.length === 0) return 0
    const matched = columnMatches.filter((m) => m.schemaField && m.confidence >= 0.6)
    return Math.round((matched.length / Math.min(columnMatches.length, schema.length)) * 100)
  }, [columnMatches, schema])

  // ── Preview & Validation ───────────────────────────────────────────────

  const transformedRows = useMemo(() => {
    if (!allRequiredMapped || parsedData.length === 0) return []
    return parsedData.map((row) => transformRow(row, mapping, schema))
  }, [parsedData, mapping, schema, allRequiredMapped])

  const handleProceedToPreview = useCallback(() => {
    const summary = validateAllRows(transformedRows, schema)
    setValidation(summary)
    setStep('preview')
  }, [transformedRows, schema])

  // ── Import ─────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!validation) return

    setImporting(true)
    setError(null)
    setImportProgress(10)
    onImportStart?.()

    try {
      const validAccounts = validation.rows
        .filter((r) => r.valid)
        .map((r) => r.data)

      if (validAccounts.length === 0) {
        setError('No valid accounts to import. Fix the errors shown above and try again.')
        setImporting(false)
        return
      }

      setImportProgress(30)

      const data = await apiPost<{ import: ImportResult }>('/api/collections/import', {
        file_name: fileName,
        accounts: validAccounts,
        column_mapping: mapping,
      })

      setImportProgress(100)
      setResult(data.import)
      setStep('result')
      onComplete?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed'
      logger.error('Smart import failed', { error: err })
      setError(message)
    } finally {
      setImporting(false)
    }
  }, [validation, fileName, mapping, onComplete, onImportStart])

  // ── History ────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const data = await apiGet<{ imports: ImportHistory[] }>('/api/collections/imports')
      setImportHistory(data.imports || [])
      setShowHistory(true)
    } catch (err) {
      logger.error('Failed to load import history', { error: err })
    }
  }, [])

  // ── Reset ──────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStep('upload')
    setParsedData([])
    setCsvHeaders([])
    setColumnMatches([])
    setMapping({})
    setValidation(null)
    setResult(null)
    setError(null)
    setFileName('')
    setFileSize(0)
    setImportProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────

  const stepIndex = { upload: 0, map: 1, preview: 2, result: 3 }
  const steps = [
    { key: 'upload', label: 'Upload' },
    { key: 'map', label: 'Map Columns' },
    { key: 'preview', label: 'Preview' },
    { key: 'result', label: 'Import' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {compact ? 'Import Contacts' : 'Smart Import'}
          </h3>
          <p className="text-sm text-gray-500">
            Upload any CSV — we auto-detect your columns
          </p>
        </div>
        {!compact && (
          <div className="flex items-center gap-3">
            <button
              onClick={downloadTemplate}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Template
            </button>
            <button
              onClick={loadHistory}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Import History
            </button>
          </div>
        )}
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                stepIndex[step] > i
                  ? 'bg-green-500 text-white'
                  : stepIndex[step] === i
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {stepIndex[step] > i ? '✓' : i + 1}
            </div>
            <span className={`text-xs ${stepIndex[step] === i ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px ${stepIndex[step] > i ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* ─── Step 1: Upload ──────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
                </p>
                <p className="text-sm text-blue-600 mt-1">or click to browse</p>
              </div>
              <p className="text-xs text-gray-400">
                CSV, TSV, or TXT — up to 10,000 rows, 10 MB max
              </p>
            </div>
          </div>

          {/* Format help */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Works with any format</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                COLLECT! exports
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                QuickBooks / Sage
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Salesforce / HubSpot
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Excel → Save as CSV
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Any custom CRM export
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Tab-separated (TSV)
              </div>
            </div>
            <p className="text-xs text-gray-400">
              We need at minimum: a <strong>name</strong>, <strong>phone number</strong> (any format), and <strong>balance</strong>.
              Column names don&apos;t need to match exactly — we&apos;ll auto-detect them.
            </p>
          </div>
        </div>
      )}

      {/* ─── Step 2: Column Mapping ──────────────────────────────────────── */}
      {step === 'map' && (
        <div className="space-y-4">
          {/* File info bar */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{fileName}</p>
                <p className="text-xs text-gray-500">
                  {parsedData.length.toLocaleString()} rows &middot; {csvHeaders.length} columns &middot;{' '}
                  {(fileSize / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Badge variant={mappingConfidence >= 80 ? 'success' : mappingConfidence >= 50 ? 'info' : 'error'}>
              {mappingConfidence}% auto-matched
            </Badge>
          </div>

          {/* Auto-mapping confidence banner */}
          {mappingConfidence >= 80 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-700">
                Great match! We auto-detected most of your columns. Review & adjust if needed.
              </p>
            </div>
          )}
          {mappingConfidence < 50 && mappingConfidence > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-amber-700">
                Some columns couldn&apos;t be auto-detected. Please map them manually below.
              </p>
            </div>
          )}

          {/* Mapping table */}
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {/* Required fields */}
            <div className="p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Required Fields
              </p>
            </div>
            {requiredFields.map((field) => (
              <FieldMappingRow
                key={field.key}
                field={field}
                csvHeaders={csvHeaders}
                currentMapping={mapping[field.key] || ''}
                match={columnMatches.find((m) => m.schemaField === field.key)}
                onChange={(val) => handleMappingChange(field.key, val)}
                sampleValues={parsedData.slice(0, 3).map((row) => row[mapping[field.key]] || '')}
              />
            ))}

            {/* Optional fields */}
            <div className="p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Optional Fields
              </p>
            </div>
            {optionalFields.map((field) => (
              <FieldMappingRow
                key={field.key}
                field={field}
                csvHeaders={csvHeaders}
                currentMapping={mapping[field.key] || ''}
                match={columnMatches.find((m) => m.schemaField === field.key)}
                onChange={(val) => handleMappingChange(field.key, val)}
                sampleValues={parsedData.slice(0, 3).map((row) => row[mapping[field.key]] || '')}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="secondary" size="sm" onClick={reset}>
              ← Back
            </Button>
            <Button
              size="sm"
              onClick={handleProceedToPreview}
              disabled={!allRequiredMapped}
            >
              Preview Import →
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Preview & Validate ──────────────────────────────────── */}
      {step === 'preview' && validation && (
        <div className="space-y-4">
          {/* Validation summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{validation.totalRows}</p>
              <p className="text-xs text-gray-500">Total Rows</p>
            </div>
            <div className="bg-white border border-green-200 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{validation.validRows}</p>
              <p className="text-xs text-gray-500">Ready to Import</p>
            </div>
            {validation.invalidRows > 0 && (
              <div className="bg-white border border-red-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{validation.invalidRows}</p>
                <p className="text-xs text-gray-500">Errors (skipped)</p>
              </div>
            )}
            {validation.invalidRows === 0 && (
              <div className="bg-white border border-green-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">0</p>
                <p className="text-xs text-gray-500">Errors</p>
              </div>
            )}
          </div>

          {/* Top issues */}
          {validation.topIssues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">Common Issues Found</p>
              <ul className="text-xs text-amber-700 space-y-1">
                {validation.topIssues.map((issue, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {issue}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-600 mt-2">
                Rows with errors will be skipped. Valid rows will still be imported.
              </p>
            </div>
          )}

          {validation.invalidRows === 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-700 font-medium">
                All {validation.totalRows} rows are valid and ready to import!
              </p>
            </div>
          )}

          {/* Data preview table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Data Preview</p>
              <p className="text-xs text-gray-400">
                Showing first {Math.min(10, validation.rows.length)} of {validation.totalRows} rows
              </p>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-10">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-10">Status</th>
                    {schema
                      .filter((f) => mapping[f.key])
                      .map((f) => (
                        <th key={f.key} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">
                          {f.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {validation.rows.slice(0, 10).map((row) => (
                    <tr
                      key={row.index}
                      className={row.valid ? '' : 'bg-red-50/50'}
                    >
                      <td className="px-3 py-1.5 text-gray-400">{row.index + 1}</td>
                      <td className="px-3 py-1.5">
                        {row.valid ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span
                            className="text-red-500 cursor-help"
                            title={row.errors.map((e) => e.message).join('\n')}
                          >
                            ✗
                          </span>
                        )}
                      </td>
                      {schema
                        .filter((f) => mapping[f.key])
                        .map((f) => {
                          const hasError = row.errors.some((e) => e.field === f.key)
                          return (
                            <td
                              key={f.key}
                              className={`px-3 py-1.5 max-w-[180px] truncate ${
                                hasError ? 'text-red-600 font-medium' : 'text-gray-700'
                              }`}
                              title={hasError ? row.errors.find((e) => e.field === f.key)?.message : String(row.data[f.key] ?? '')}
                            >
                              {String(row.data[f.key] ?? '—')}
                            </td>
                          )
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import progress */}
          {importing && (
            <div className="space-y-2">
              <Progress value={importProgress} />
              <p className="text-xs text-gray-500 text-center">Importing accounts...</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="secondary" size="sm" onClick={() => setStep('map')} disabled={importing}>
              ← Adjust Mapping
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing || validation.validRows === 0}
            >
              {importing
                ? 'Importing...'
                : `Import ${validation.validRows.toLocaleString()} Account${validation.validRows === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Results ─────────────────────────────────────────────── */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900">Import Complete!</h4>
            <div className="flex justify-center gap-8 text-sm">
              <div>
                <p className="text-3xl font-bold text-green-600">{result.rows_imported}</p>
                <p className="text-gray-500">Imported</p>
              </div>
              {result.rows_skipped > 0 && (
                <div>
                  <p className="text-3xl font-bold text-amber-500">{result.rows_skipped}</p>
                  <p className="text-gray-500">Skipped</p>
                </div>
              )}
              <div>
                <p className="text-3xl font-bold text-gray-900">{result.rows_total}</p>
                <p className="text-gray-500">Total</p>
              </div>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-700 mb-2">Server-side Errors</p>
              <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>Row {err.row}: {err.error}</li>
                ))}
                {result.errors.length > 20 && (
                  <li className="text-red-500 font-medium">
                    + {result.errors.length - 20} more errors
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button size="sm" variant="secondary" onClick={reset}>
              Import Another File
            </Button>
          </div>
        </div>
      )}

      {/* ─── Import History Panel ────────────────────────────────────────── */}
      {showHistory && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
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
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {' — '}
                      {imp.rows_imported}/{imp.rows_total} imported
                    </p>
                  </div>
                  <Badge
                    variant={
                      imp.status === 'completed'
                        ? 'success'
                        : imp.status === 'failed'
                          ? 'error'
                          : 'info'
                    }
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

// ─── Field Mapping Row Sub-Component ────────────────────────────────────────

function FieldMappingRow({
  field,
  csvHeaders,
  currentMapping,
  match,
  onChange,
  sampleValues,
}: {
  field: SchemaField
  csvHeaders: string[]
  currentMapping: string
  match?: ColumnMatch
  onChange: (value: string) => void
  sampleValues: string[]
}) {
  const confidenceBadge = match && match.confidence >= 0.6 && (
    <Badge
      variant={match.confidence >= 0.9 ? 'success' : 'info'}
      className="text-[10px] ml-1"
    >
      {match.matchType === 'exact'
        ? 'exact'
        : match.matchType === 'alias'
          ? 'alias'
          : `~${Math.round(match.confidence * 100)}%`}
    </Badge>
  )

  const samples = sampleValues.filter(Boolean).slice(0, 3)

  return (
    <div className="p-3 flex items-start gap-3">
      {/* Field label */}
      <div className="w-36 shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-gray-700">
            {field.label}
          </span>
          {field.required && <span className="text-red-500 text-xs">*</span>}
          {confidenceBadge}
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">{field.description}</p>
      </div>

      {/* Dropdown */}
      <div className="flex-1">
        <select
          value={currentMapping}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded border px-3 py-1.5 text-sm ${
            field.required && !currentMapping
              ? 'border-red-300 bg-red-50'
              : currentMapping
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300'
          }`}
        >
          <option value="">— Skip this field —</option>
          {csvHeaders.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        {/* Sample values preview */}
        {samples.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-gray-400">Sample:</span>
            {samples.map((s, i) => (
              <span key={i} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
