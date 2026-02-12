'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface NoteTemplate {
  id: string
  shortcode: string
  title: string
  content: string
  tags: string[]
  usage_count: number
}

interface NoteTemplatesProps {
  /** Called when a template is selected / expanded */
  onInsertTemplate: (content: string) => void
  /** Current text in the notes field — used for shortcode detection */
  currentText: string
}

/**
 * NoteTemplates — Shortcode-expanding note template overlay.
 *
 * Integrates with CallNotes.tsx:
 * - Detects when agent types /<shortcode> pattern in the notes field
 * - Shows autocomplete dropdown with matching templates
 * - On selection, replaces the shortcode with full template content
 * - Also shows a browse-all panel for discovering templates
 *
 * Shortcode format: /vm, /ptp, /callback, /dispute, etc.
 */
export default function NoteTemplates({ onInsertTemplate, currentText }: NoteTemplatesProps) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showBrowser, setShowBrowser] = useState(false)
  const [matchingTemplates, setMatchingTemplates] = useState<NoteTemplate[]>([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const prevTextRef = useRef(currentText)

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiGet('/api/productivity/note-templates')
      setTemplates(res.templates || [])
    } catch (err) {
      logger.error('NoteTemplates: fetch failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Detect shortcode patterns in current text
  useEffect(() => {
    if (templates.length === 0) return

    // Only trigger on text additions (typing), not deletions
    if (currentText.length <= prevTextRef.current.length) {
      prevTextRef.current = currentText
      setShowAutocomplete(false)
      return
    }
    prevTextRef.current = currentText

    // Check for partial shortcode at end of text
    const shortcodeMatch = currentText.match(/\/([a-z0-9_-]*)$/)
    if (!shortcodeMatch) {
      setShowAutocomplete(false)
      return
    }

    const partial = shortcodeMatch[1]

    // Find matching templates
    const matches = templates.filter((t) => {
      const code = t.shortcode.replace(/^\//, '')
      return code.startsWith(partial) || t.title.toLowerCase().includes(partial)
    })

    if (matches.length > 0 && partial.length > 0) {
      setMatchingTemplates(matches)
      setShowAutocomplete(true)
    } else {
      setShowAutocomplete(false)
    }
  }, [currentText, templates])

  const handleSelectTemplate = (template: NoteTemplate) => {
    // Replace the /<shortcode> pattern at end of text with template content
    const shortcodeMatch = currentText.match(/\/[a-z0-9_-]*$/)
    if (shortcodeMatch) {
      const prefix = currentText.slice(0, currentText.length - shortcodeMatch[0].length)
      onInsertTemplate(prefix + template.content)
    } else {
      onInsertTemplate(currentText + template.content)
    }
    setShowAutocomplete(false)

    // Track usage asynchronously
    const code = template.shortcode.replace(/^\//, '')
    apiPost(`/api/productivity/note-templates/expand/${code}`).catch(() => {})
  }

  const handleBrowseInsert = (template: NoteTemplate) => {
    onInsertTemplate(template.content)
    setShowBrowser(false)
  }

  if (loading) return null

  return (
    <>
      {/* Autocomplete Dropdown */}
      {showAutocomplete && matchingTemplates.length > 0 && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-md border border-gray-600 bg-gray-800 shadow-lg">
          {matchingTemplates.slice(0, 5).map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-700/50 first:rounded-t-md last:rounded-b-md"
            >
              <div>
                <span className="text-xs font-mono text-blue-400">{template.shortcode}</span>
                <span className="ml-2 text-sm text-gray-300">{template.title}</span>
              </div>
              <span className="text-xs text-gray-500">
                {template.content.slice(0, 30)}...
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Template Browser Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowBrowser(!showBrowser)}
          className="rounded-md bg-gray-700 px-2 py-1 text-xs text-gray-400 hover:text-gray-300"
          title="Browse note templates"
        >
          📝 Templates{templates.length > 0 ? ` (${templates.length})` : ''}
        </button>
        {templates.length > 0 && (
          <span className="text-xs text-gray-500">
            Type / to use shortcodes
          </span>
        )}
      </div>

      {/* Template Browser Panel */}
      {showBrowser && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-600 bg-gray-700/50">
          {templates.length === 0 ? (
            <p className="p-3 text-center text-xs text-gray-500">
              No templates yet. Create them in Settings.
            </p>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleBrowseInsert(template)}
                className="flex w-full items-start gap-2 border-b border-gray-600/50 px-3 py-2 text-left last:border-b-0 hover:bg-gray-600/30"
              >
                <span className="mt-0.5 whitespace-nowrap font-mono text-xs text-blue-400">
                  {template.shortcode}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-300">{template.title}</p>
                  <p className="truncate text-xs text-gray-500">{template.content}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </>
  )
}
