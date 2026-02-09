'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/apiClient'

interface TranslationSegment {
  id: number
  original_text: string
  translated_text: string
  source_language: string
  target_language: string
  segment_index: number
  confidence: number | null
  timestamp: string
}

interface LiveTranslationPanelProps {
  callId: string
  organizationId: string
  sourceLanguage: string
  targetLanguage: string
  isActive: boolean
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
  ja: 'Japanese',
  pt: 'Portuguese',
  it: 'Italian',
  ko: 'Korean',
  ar: 'Arabic',
}

/**
 * LiveTranslationPanel — Real-time translated text feed during active calls
 *
 * Connects to the SSE stream at /api/voice/translate/stream and displays
 * translated utterances as they arrive. Auto-scrolls, shows status, and
 * provides a language pair indicator.
 *
 * Professional Design System v3.0
 */
export function LiveTranslationPanel({
  callId,
  organizationId,
  sourceLanguage,
  targetLanguage,
  isActive,
}: LiveTranslationPanelProps) {
  const [segments, setSegments] = useState<TranslationSegment[]>([])
  const [status, setStatus] = useState<'connecting' | 'active' | 'ended' | 'error'>('connecting')
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [segments, collapsed])

  // SSE connection lifecycle
  useEffect(() => {
    if (!isActive || !callId) {
      setStatus('ended')
      return
    }

    // EventSource doesn't support custom headers — use fetch-based SSE reader
    // with centralized apiFetch (resolves API URL + attaches Bearer token automatically)
    const abortController = new AbortController()

    async function connectStream() {
      try {
        setStatus('connecting')
        const sseUrl = `/api/voice/translate/stream?callId=${encodeURIComponent(callId)}`

        const response = await apiFetch(sseUrl, {
          headers: {
            Accept: 'text/event-stream',
          },
          signal: abortController.signal,
        })

        if (!response.ok) {
          setStatus('error')
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          setStatus('error')
          return
        }

        setStatus('active')
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          let currentEvent = ''
          let currentData = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6).trim()
            } else if (line === '' && currentEvent && currentData) {
              // Process complete event
              try {
                const parsed = JSON.parse(currentData)

                if (currentEvent === 'translation') {
                  setSegments((prev) => {
                    // Dedupe by segment_index
                    if (prev.some((s) => s.segment_index === parsed.segment_index)) return prev
                    return [...prev, parsed]
                  })
                } else if (currentEvent === 'status') {
                  if (parsed.status === 'ended') setStatus('ended')
                } else if (currentEvent === 'done') {
                  setStatus('ended')
                } else if (currentEvent === 'error') {
                  setStatus('error')
                }
              } catch {
                // Skip malformed JSON
              }
              currentEvent = ''
              currentData = ''
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setStatus('error')
        }
      }
    }

    connectStream()

    return () => {
      abortController.abort()
    }
  }, [callId, isActive])

  const statusConfig = {
    connecting: { color: 'bg-blue-500', label: 'Connecting...', animate: true },
    active: { color: 'bg-success', label: 'Translating', animate: true },
    ended: { color: 'bg-gray-400', label: 'Ended', animate: false },
    error: { color: 'bg-error', label: 'Error', animate: false },
  }

  const statusInfo = statusConfig[status]
  const fromLabel = LANGUAGE_LABELS[sourceLanguage] || sourceLanguage
  const toLabel = LANGUAGE_LABELS[targetLanguage] || targetLanguage

  return (
    <div className="rounded-lg border border-primary-200 bg-white overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-primary-50 border-b border-primary-200 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${statusInfo.color} ${statusInfo.animate ? 'animate-pulse' : ''}`}
            />
            <span className="text-sm font-medium text-gray-900">Live Translation</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {fromLabel} → {toLabel}
          </Badge>
          {segments.length > 0 && (
            <span className="text-xs text-gray-500">{segments.length} segments</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{statusInfo.label}</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Translation Feed */}
      {!collapsed && (
        <div ref={scrollRef} className="max-h-64 overflow-y-auto p-3 space-y-2">
          {segments.length === 0 && status === 'active' && (
            <div className="text-center py-6">
              <div className="text-sm text-gray-400">Waiting for speech...</div>
              <div className="text-xs text-gray-300 mt-1">
                Translations appear here in real-time
              </div>
            </div>
          )}

          {segments.length === 0 && status === 'connecting' && (
            <div className="text-center py-6">
              <div className="text-sm text-gray-400">Connecting to translation stream...</div>
            </div>
          )}

          {segments.map((seg) => (
            <div key={seg.segment_index} className="flex gap-3 text-sm">
              <div className="flex-1 space-y-0.5">
                <p className="text-gray-400 text-xs leading-relaxed">{seg.original_text}</p>
                <p className="text-gray-900 leading-relaxed">{seg.translated_text}</p>
              </div>
              {seg.confidence != null && (
                <span className="text-xs text-gray-300 self-start mt-0.5 tabular-nums">
                  {Math.round(seg.confidence * 100)}%
                </span>
              )}
            </div>
          ))}

          {status === 'error' && (
            <div className="text-center py-4">
              <div className="text-sm text-error">Translation stream interrupted</div>
              <div className="text-xs text-gray-400 mt-1">Check your connection and try again</div>
            </div>
          )}

          {status === 'ended' && segments.length > 0 && (
            <div className="text-center py-2 border-t border-gray-100 mt-2">
              <span className="text-xs text-gray-400">
                Translation complete — {segments.length} segments
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
