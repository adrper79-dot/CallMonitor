'use client'

import React, { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

const NoteTemplates = dynamic(() => import('@/components/voice/NoteTemplates'), { ssr: false })

export default function TemplatesPage() {
  const [preview, setPreview] = useState('')

  const handleInsert = useCallback((content: string) => {
    setPreview(content)
  }, [])

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Note Templates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Browse and preview call note templates</p>
      </div>
      <NoteTemplates onInsertTemplate={handleInsert} currentText={preview} />
      {preview && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 mb-1">Preview</p>
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{preview}</p>
        </div>
      )}
    </div>
  )
}
