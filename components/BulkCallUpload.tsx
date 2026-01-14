"use client"

import React, { useState, useRef } from 'react'
import { Button } from './ui/button'

interface BulkUploadResult {
  phone_number: string
  description?: string
  notes?: string
  status: 'success' | 'error' | 'pending'
  call_id?: string
  error?: string
}

interface BulkUploadProps {
  organizationId: string
}

export default function BulkCallUpload({ organizationId }: BulkUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<BulkUploadResult[]>([])
  const [summary, setSummary] = useState<{ total: number; successful: number; failed: number } | null>(null)
  const isUploadingRef = useRef(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResults([])
      setSummary(null)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/voice/bulk-upload')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bulk_call_template.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download template:', error)
      alert('Failed to download template')
    }
  }

  const handleUpload = async () => {
    if (!file) return
    
    // Prevent double submission (race condition protection)
    if (isUploadingRef.current) {
      console.warn('handleUpload: already uploading, ignoring duplicate click')
      return
    }

    isUploadingRef.current = true
    setUploading(true)
    setResults([])
    setSummary(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organization_id', organizationId)

      const response = await fetch('/api/voice/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setResults(data.results)
        setSummary({
          total: data.total,
          successful: data.successful,
          failed: data.failed
        })
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed')
    } finally {
      setUploading(false)
      isUploadingRef.current = false
    }
  }

  const handleDownloadResults = () => {
    if (results.length === 0) return

    // Generate CSV with results
    const headers = ['phone_number', 'description', 'notes', 'status', 'call_id', 'error']
    const rows = results.map(r => [
      r.phone_number,
      r.description || '',
      r.notes || '',
      r.status,
      r.call_id || '',
      r.error || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk_call_results_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bulk Call Upload</h3>
          <p className="text-sm text-slate-400">Upload CSV file with phone numbers to make test calls</p>
        </div>
        <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
          📥 Download Template
        </Button>
      </div>

      {/* File Upload */}
      <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="bulk-upload-input"
        />
        <label
          htmlFor="bulk-upload-input"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          <div className="text-4xl">📄</div>
          <div className="text-sm">
            {file ? (
              <span className="text-green-400">✓ {file.name}</span>
            ) : (
              <span className="text-slate-400">Click to select CSV file</span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            CSV format: phone_number, description, notes
          </div>
        </label>
      </div>

      {/* Upload Button */}
      {file && (
        <Button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {uploading ? '⏳ Processing...' : '🚀 Start Bulk Calls'}
        </Button>
      )}

      {/* Summary */}
      {summary && (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-sm text-slate-400">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{summary.successful}</div>
              <div className="text-sm text-slate-400">Successful</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{summary.failed}</div>
              <div className="text-sm text-slate-400">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Results</h4>
            <Button onClick={handleDownloadResults} variant="outline" size="sm">
              💾 Download Results
            </Button>
          </div>
          <div className="bg-slate-900 rounded-lg border border-slate-800 max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
                <tr>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Phone Number</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-left p-3">Notes</th>
                  <th className="text-left p-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="p-3">
                      {result.status === 'success' ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-red-400">✗</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{result.phone_number}</td>
                    <td className="p-3 text-slate-300">{result.description || '-'}</td>
                    <td className="p-3 text-slate-400 text-xs">{result.notes || '-'}</td>
                    <td className="p-3">
                      {result.call_id ? (
                        <span className="text-xs text-green-400 font-mono">{result.call_id.slice(0, 8)}...</span>
                      ) : (
                        <span className="text-xs text-red-400">{result.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!file && !results.length && (
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg text-sm text-slate-400">
          <div className="font-semibold text-slate-300 mb-2">📋 Instructions:</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click "Download Template" to get the CSV template</li>
            <li>Fill in phone numbers (E.164 format: +15551234567)</li>
            <li>Add descriptions and optional notes</li>
            <li>Upload the CSV file</li>
            <li>Click "Start Bulk Calls" to initiate all calls</li>
            <li>Download results when complete</li>
          </ol>
        </div>
      )}
    </div>
  )
}
