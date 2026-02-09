'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiPost, apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface AITogglePanelProps {
  callId: string
  organizationId: string
  isCallActive: boolean
}

/**
 * AITogglePanel — Switch between AI and Human call handling modes.
 *
 * During an active call, the agent can toggle AI mode on/off.
 * AI mode uses the org's configured prompt to drive the conversation
 * via gather→OpenAI→speak loop until handoff or call end.
 *
 * Professional Design System v3.0
 */
export function AITogglePanel({ callId, organizationId, isCallActive }: AITogglePanelProps) {
  const [mode, setMode] = useState<'human' | 'ai'>('human')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activateAI = useCallback(async () => {
    if (!callId || loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await apiPost('/api/ai-toggle/activate', {
        call_id: callId,
        mode: 'ai',
      })
      if (res?.success) {
        setMode('ai')
      } else {
        setError(res?.error || 'Failed to activate AI mode')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to activate AI')
      logger.error('AI toggle activate error', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [callId, loading])

  const deactivateAI = useCallback(async () => {
    if (!callId || loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await apiPost('/api/ai-toggle/deactivate', {
        call_id: callId,
        mode: 'human',
        reason: 'Agent takeover',
      })
      if (res?.success) {
        setMode('human')
      } else {
        setError(res?.error || 'Failed to deactivate AI mode')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to deactivate AI')
      logger.error('AI toggle deactivate error', { error: err?.message })
    } finally {
      setLoading(false)
    }
  }, [callId, loading])

  // Check current status on mount
  React.useEffect(() => {
    if (!callId) return
    apiGet<any>(`/api/ai-toggle/status/${callId}`)
      .then((res) => {
        if (res?.mode) setMode(res.mode)
      })
      .catch(() => {})
  }, [callId])

  if (!isCallActive) {
    return null
  }

  return (
    <div className="rounded-xl border p-4 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{mode === 'ai' ? '🤖' : '👤'}</span>
          <h3 className="font-semibold text-sm">Call Mode</h3>
          <Badge
            variant={mode === 'ai' ? 'default' : 'secondary'}
            className={`text-xs ${mode === 'ai' ? 'bg-blue-500 animate-pulse' : ''}`}
          >
            {mode === 'ai' ? 'AI Active' : 'Human'}
          </Badge>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-3">
        {mode === 'ai'
          ? 'AI is handling the conversation. Click below to take over.'
          : 'You are handling the call. Click below to let AI take over.'}
      </p>

      {/* Toggle button */}
      <div className="flex gap-2">
        {mode === 'human' ? (
          <Button
            onClick={activateAI}
            disabled={loading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
          >
            {loading ? 'Activating...' : '🤖 Activate AI Mode'}
          </Button>
        ) : (
          <Button
            onClick={deactivateAI}
            disabled={loading}
            size="sm"
            variant="destructive"
            className="flex-1"
          >
            {loading ? 'Taking over...' : '👤 Take Over (Human)'}
          </Button>
        )}
      </div>

      {/* Error */}
      {error && <div className="mt-2 text-xs text-red-500 bg-red-500/10 rounded p-2">{error}</div>}

      {/* AI disclosure */}
      {mode === 'ai' && (
        <div className="mt-3 text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded p-2">
          ℹ️ Per AI Role Policy, the caller has been notified that AI is assisting. AI will hand off
          if the caller requests a human agent.
        </div>
      )}
    </div>
  )
}
