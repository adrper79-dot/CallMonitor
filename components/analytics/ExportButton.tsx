'use client'

import { useState } from 'react'

/**
 * ExportButton - Professional Design System v3.0
 * 
 * Export analytics data to CSV or JSON
 * Clean, professional design following architectural standards
 */

interface ExportButtonProps {
  type: 'calls' | 'surveys' | 'sentiment'
  startDate: string
  endDate: string
}

export function ExportButton({ type, startDate, endDate }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (format: 'csv' | 'json') => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(
        `/api/analytics/export?type=${type}&format=${format}&startDate=${startDate}&endDate=${endDate}`,
        { credentials: 'include' }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Export failed' } }))
        throw new Error(errorData.error?.message || 'Export failed')
      }

      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      console.error('Export failed:', err)
      setError(err.message || 'Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => handleExport('csv')}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Exporting...' : 'Export CSV'}
        </button>
        <button
          onClick={() => handleExport('json')}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Exporting...' : 'Export JSON'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  )
}

export default ExportButton
