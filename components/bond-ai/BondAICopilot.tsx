'use client'

import React, { useState } from 'react'
import { apiGet, apiPost } from '@/lib/apiClient'

interface CopilotProps {
  callId?: string
  scorecardId?: string
  className?: string
}

export default function BondAICopilot({ callId, scorecardId, className }: CopilotProps) {
  const [guidance, setGuidance] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [latency, setLatency] = useState<number | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  const askCopilot = async (query?: string) => {
    const q = query || question.trim()
    if (!q || loading) return

    setLoading(true)
    setGuidance(null)
    setQuestion('')

    try {
      const data = await apiPost('/api/bond-ai/copilot', {
        call_id: callId,
        agent_question: q,
        scorecard_id: scorecardId,
      })

      if (data.success) {
        setGuidance(data.guidance)
        setLatency(data.latency_ms)
      }
    } catch (err: any) {
      setGuidance(`Unable to get guidance: ${err.message || 'Please try again'}`)
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    { label: 'Compliance check', query: 'Am I meeting all compliance requirements for this call?' },
    { label: 'Objection tips', query: 'Give me tips for handling the customer objection' },
    { label: 'Script check', query: 'Am I following the script correctly?' },
    { label: 'Closing guidance', query: 'What is the best way to close this conversation?' },
  ]

  return (
    <div className={`bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-900 border border-indigo-200 dark:border-indigo-800 rounded-xl overflow-hidden ${className || ''}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-600 text-white"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
          </svg>
          <span className="text-sm font-semibold">Call Co-Pilot</span>
          {loading && <span className="text-xs text-indigo-200 animate-pulse">Thinking...</span>}
        </div>
        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-4">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={() => askCopilot(action.query)}
                disabled={loading}
                className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/40 disabled:opacity-50 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Custom question input */}
          <div className="flex gap-2 mb-3">
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askCopilot()}
              placeholder="Ask the co-pilot..."
              disabled={loading}
              className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => askCopilot()}
              disabled={!question.trim() || loading}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-40 hover:bg-indigo-700 transition-colors"
            >
              Ask
            </button>
          </div>

          {/* Guidance response */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
              <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
              Getting guidance...
            </div>
          )}

          {guidance && !loading && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
              <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {guidance}
              </div>
              {latency && (
                <div className="text-[10px] text-gray-400 mt-2">
                  Response in {latency}ms
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
