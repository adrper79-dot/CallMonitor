'use client'

/**
 * /accounts/import — CSV account import
 *
 * Upload CSV files to bulk-import collection accounts.
 * Validates columns, previews data, then posts to /api/accounts/import.
 */

import React, { useState, useRef } from 'react'
import { apiPostFormData } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle,
  Loader2, Download, X, ArrowRight,
} from 'lucide-react'

interface PreviewRow {
  [key: string]: string
}

export default function AccountImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const REQUIRED_COLUMNS = ['name', 'phone', 'balance_due']

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) {
        setError('CSV must have a header row and at least one data row')
        return
      }
      const hdrs = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
      setHeaders(hdrs)

      const missing = REQUIRED_COLUMNS.filter((c) => !hdrs.includes(c))
      if (missing.length > 0) {
        setError(`Missing required columns: ${missing.join(', ')}`)
      }

      const rows = lines.slice(1, 6).map((line) => {
        const vals = line.split(',').map((v) => v.trim().replace(/['"]/g, ''))
        const row: PreviewRow = {}
        hdrs.forEach((h, i) => { row[h] = vals[i] || '' })
        return row
      })
      setPreview(rows)
    }
    reader.readAsText(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await apiPostFormData<{ imported?: number; count?: number; errors?: number }>(
        '/api/collections/import',
        formData
      )
      setResult({ imported: data.imported || data.count || 0, errors: data.errors || 0 })
      logger.info('Account import completed', { imported: data.imported })
    } catch (err: any) {
      logger.error('Account import failed', { error: err?.message })
      setError(err?.message || 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setHeaders([])
    setPreview([])
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Upload className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Import Accounts</h1>
        </div>
        <p className="text-sm text-gray-500">Upload a CSV file to bulk-import collection accounts</p>
      </div>

      {/* Success state */}
      {result && (
        <Card className="border-green-200 dark:border-green-800 mb-6">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Complete</h2>
            <p className="text-sm text-gray-500 mt-1">
              {result.imported} accounts imported{result.errors > 0 ? `, ${result.errors} errors` : ''}
            </p>
            <Button onClick={reset} variant="outline" className="mt-4">Import Another</Button>
          </CardContent>
        </Card>
      )}

      {!result && (
        <>
          {/* Upload zone */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {file ? file.name : 'Click to select CSV file'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Required columns: name, phone, balance_due
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {preview.length > 0 && !error && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Preview (first {preview.length} rows)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 border-b">
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-gray-500">
                            {h}
                            {REQUIRED_COLUMNS.includes(h) && <span className="text-red-500 ml-0.5">*</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                          {headers.map((h) => (
                            <td key={h} className="px-3 py-2 text-gray-700 dark:text-gray-300">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Upload button */}
          {file && !error && (
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading} className="gap-1.5">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {uploading ? 'Importing...' : 'Start Import'}
              </Button>
              <Button variant="outline" onClick={reset}>Cancel</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
