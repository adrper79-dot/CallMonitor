"use client"

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useCallDetails } from '@/hooks/useCallDetails'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import CallModulations from './CallModulations'
import ArtifactViewer from './ArtifactViewer'
import CallAnalytics from './CallAnalytics'
import { OutcomeDeclaration } from './OutcomeDeclaration'
import type { CallOutcome } from '@/lib/outcome/outcomeTypes'
import { apiGet } from '@/lib/apiClient'
import { BondAICopilot } from '@/components/bond-ai'

export interface CallDetailViewProps {
  callId: string | null
  organizationId: string | null
  onModulationChange?: (mods: Record<string, boolean>) => Promise<void>
}

/**
 * CallDetailView - Professional Design System v3.0
 * 
 * Comprehensive call details with evidence review access.
 * Light theme, no emojis, clear hierarchy.
 */
export default function CallDetailView({ callId, organizationId, onModulationChange }: CallDetailViewProps) {
  const { call, recording, transcript, translation, manifest, score, survey, transcriptionStatus, loading, error } = useCallDetails(callId)
  const { config } = useVoiceConfig(organizationId)
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [callOutcome, setCallOutcome] = useState<CallOutcome | null>(null)
  const [outcomeLoading, setOutcomeLoading] = useState(false)

  // Fetch existing outcome when call changes
  const fetchOutcome = useCallback(async () => {
    if (!callId) return

    setOutcomeLoading(true)
    try {
      const data = await apiGet(`/api/calls/${callId}/outcome`)

      if (data.success && data.data?.outcome) {
        setCallOutcome(data.data.outcome)
      }
    } catch (err) {
      // Silently fail - outcome may not exist yet
      console.debug('No existing outcome found')
    } finally {
      setOutcomeLoading(false)
    }
  }, [callId])

  useEffect(() => {
    if (callId && call?.status === 'completed') {
      fetchOutcome()
    } else {
      setCallOutcome(null)
    }
  }, [callId, call?.status, fetchOutcome])

  // Handle outcome saved
  const handleOutcomeSaved = useCallback((outcome: CallOutcome) => {
    setCallOutcome(outcome)
    toast({
      title: 'Outcome Declared',
      description: 'Call outcome has been recorded successfully',
    })
  }, [toast])

  // Download evidence bundle
  async function handleDownloadEvidence() {
    if (!callId) return

    try {
      setExporting(true)
      // Note: apiGet returns JSON by default, need raw fetch for blob
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
      const token = localStorage.getItem('wb-session-token')
      const res = await fetch(`${API_BASE}/api/calls/${callId}/export`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include',
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(errorData.error || 'Failed to export evidence')
      }

      // Get the blob and trigger download
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evidence-${callId.slice(0, 8)}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Evidence Downloaded',
        description: 'Complete evidence bundle exported successfully',
      })
    } catch (err: any) {
      toast({
        title: 'Export Failed',
        description: err?.message || 'Failed to download evidence bundle',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  if (!callId) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">Select a call to view details</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500">Loading call details...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-error-light border border-red-200 rounded-md text-error">
        Error: {error}
      </div>
    )
  }

  if (!call) {
    return (
      <div className="p-4 bg-gray-50 rounded-md text-gray-500 text-center">
        Call not found
      </div>
    )
  }

  const formatDuration = (started: string | null, ended: string | null) => {
    if (!started) return '—'
    if (!ended) return 'In progress...'
    const start = new Date(started)
    const end = new Date(ended)
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const statusVariant =
    call.status === 'completed' ? 'success' :
      call.status === 'failed' || call.status === 'no-answer' || call.status === 'busy' ? 'error' :
        call.status === 'in_progress' ? 'default' :
          'default'

  return (
    <div className="space-y-6">
      {/* Call Header */}
      <section aria-labelledby="call-header" className="p-4 bg-white rounded-md border border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="call-header" className="text-lg font-semibold text-gray-900 mb-2">
              Call Details
            </h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Status:</span>
              <Badge variant={statusVariant}>{call.status || 'unknown'}</Badge>
            </div>
            <div className="text-xs text-gray-400 font-mono">
              ID: {call.id.slice(0, 8)}...
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Duration</div>
            <div className="text-lg font-mono text-gray-900 tabular-nums">
              {formatDuration(call.started_at, call.ended_at)}
            </div>
            {score && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Score</div>
                <Badge variant={score.score >= 80 ? 'success' : score.score >= 60 ? 'warning' : 'error'}>
                  {score.score}%
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Started</div>
            <div className="text-gray-900">
              {call.started_at ? new Date(call.started_at).toLocaleString() : '—'}
            </div>
          </div>
          {call.ended_at && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ended</div>
              <div className="text-gray-900">
                {new Date(call.ended_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="Quick actions" className="flex flex-wrap gap-2">
        {/* Review Evidence - Always visible for completed calls */}
        {call.status === 'completed' && (
          <Link href={`/review?callId=${call.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Review Evidence
            </Button>
          </Link>
        )}

        {/* Download Evidence - Export complete bundle */}
        {call.status === 'completed' && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleDownloadEvidence}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Evidence
              </>
            )}
          </Button>
        )}

        {recording?.recording_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              document.getElementById('artifact-recording')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Recording
          </Button>
        )}
        {transcript && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              document.getElementById('artifact-transcript')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Transcript
          </Button>
        )}
        {transcript?.sentiment_analysis && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              document.getElementById('call-analytics')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </Button>
        )}
        {manifest && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              document.getElementById('artifact-manifest')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Manifest
          </Button>
        )}
      </section>

      {/* Outcome Declaration - Post-Call Outcome Capture */}
      {/* Per AI Role Policy: Humans declare outcomes, not AI */}
      {['completed', 'failed', 'no-answer', 'busy', 'in_progress'].includes(call.status || '') && organizationId && (
        <section aria-label="Outcome Declaration">
          <OutcomeDeclaration
            callId={call.id}
            organizationId={organizationId}
            callCompleted={['completed', 'failed', 'no-answer', 'busy'].includes(call.status || '')}
            existingOutcome={callOutcome}
            onOutcomeSaved={handleOutcomeSaved}
            enableAISummary={true}
          />
        </section>
      )}

      {/* Analytics Panel - AI-Powered Insights */}
      {transcript && (transcript.sentiment_analysis || transcript.entities || transcript.chapters) && (
        <section id="call-analytics" aria-label="Call Analytics">
          <CallAnalytics transcriptJson={transcript} />
        </section>
      )}

      {/* Bond AI Call Co-Pilot */}
      <section aria-label="AI Co-Pilot">
        <BondAICopilot callId={call.id} />
      </section>

      {/* Modulations Used (Read-only Metadata) */}
      {organizationId && (
        <section aria-labelledby="modulations-used" className="p-4 bg-white rounded-md border border-gray-200">
          <h3 id="modulations-used" className="text-sm font-semibold text-gray-900 mb-3">
            Features Used for This Call
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <FeatureIndicator label="Recording" enabled={config?.record} />
            <FeatureIndicator label="Transcribe" enabled={config?.transcribe} />
            <FeatureIndicator label="Translate" enabled={config?.translate} />
            <FeatureIndicator label="Survey" enabled={config?.survey} />
            <FeatureIndicator label="Shopper" enabled={config?.synthetic_caller} />
          </div>
          <p className="text-xs text-gray-400 mt-3 italic">
            These are the features that were active when this call was placed.
          </p>
        </section>
      )}

      {/* Artifact Viewer */}
      <ArtifactViewer
        callId={call.id}
        recording={recording}
        transcript={transcript}
        translation={translation}
        manifest={manifest}
        score={score}
        survey={survey}
        transcriptionStatus={transcriptionStatus}
      />
    </div>
  )
}

function FeatureIndicator({ label, enabled }: { label: string; enabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {enabled ? (
        <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  )
}
