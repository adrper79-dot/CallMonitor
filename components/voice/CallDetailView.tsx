"use client"

import React from 'react'
import { useCallDetails } from '@/hooks/useCallDetails'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import CallModulations from './CallModulations'
import ArtifactViewer from './ArtifactViewer'
import CallAnalytics from './CallAnalytics'

export interface CallDetailViewProps {
  callId: string | null
  organizationId: string | null
  onModulationChange?: (mods: Record<string, boolean>) => Promise<void>
}

export default function CallDetailView({ callId, organizationId, onModulationChange }: CallDetailViewProps) {
  const { call, recording, transcript, translation, manifest, score, survey, loading, error } = useCallDetails(callId)
  const { config } = useVoiceConfig(organizationId)

  if (!callId) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Select a call from the list to view details
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Loading call details...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-800 rounded-md text-red-400">
        Error: {error}
      </div>
    )
  }

  if (!call) {
    return (
      <div className="p-4 bg-slate-900 rounded-md text-slate-400">
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
    call.status === 'in_progress' ? 'info' :
    'default'

  return (
    <div className="space-y-6">
      {/* Call Header */}
      <section aria-labelledby="call-header" className="p-4 bg-white rounded-lg border border-[#E5E5E5] shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="call-header" className="text-lg font-semibold text-[#333333] mb-2">
              Call {call.id}
            </h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[#666666] uppercase tracking-wide">Status:</span>
              <Badge variant={statusVariant}>{call.status || 'unknown'}</Badge>
            </div>
            {call.call_sid && (
              <div className="text-xs text-[#999999] font-mono">
                SID: {call.call_sid}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-[#666666] mb-1 uppercase tracking-wide">Duration</div>
            <div className="text-lg font-mono text-[#333333] tabular-nums">
              {formatDuration(call.started_at, call.ended_at)}
            </div>
            {score && (
              <div className="mt-2">
                <div className="text-xs text-[#666666] mb-1 uppercase tracking-wide">Score</div>
                <Badge variant={score.score >= 80 ? 'success' : score.score >= 60 ? 'warning' : 'error'}>
                  {score.score}%
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-[#E5E5E5] pt-4">
          <div>
            <div className="text-xs text-[#666666] uppercase tracking-wide mb-1">Started</div>
            <div className="text-[#333333]">
              {call.started_at ? new Date(call.started_at).toLocaleString() : '—'}
            </div>
          </div>
          {call.ended_at && (
            <div>
              <div className="text-xs text-[#666666] uppercase tracking-wide mb-1">Ended</div>
              <div className="text-[#333333]">
                {new Date(call.ended_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="Quick actions" className="flex flex-wrap gap-2">
        {recording?.recording_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              document.getElementById('artifact-recording')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            🎙️ Recording
          </Button>
        )}
        {transcript && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              document.getElementById('artifact-transcript')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            📝 Transcript
          </Button>
        )}
        {transcript?.sentiment_analysis && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              document.getElementById('call-analytics')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            📊 Analytics
          </Button>
        )}
        {manifest && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              document.getElementById('artifact-manifest')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            📋 Manifest
          </Button>
        )}
      </section>

      {/* Analytics Panel - AI-Powered Insights */}
      {transcript && (transcript.sentiment_analysis || transcript.entities || transcript.chapters) && (
        <section id="call-analytics" aria-label="Call Analytics">
          <CallAnalytics transcriptJson={transcript} />
        </section>
      )}

      {/* Modulations Used (Read-only Metadata) */}
      {organizationId && (
        <section aria-labelledby="modulations-used" className="p-4 bg-white rounded-lg border border-[#E5E5E5]">
          <h3 id="modulations-used" className="text-sm font-semibold text-[#333333] mb-3">
            Features Used for This Call
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${config?.record ? 'text-[#59A14F]' : 'text-[#999999]'}`}>
                {config?.record ? '✓' : '○'}
              </span>
              <span className="text-xs text-[#666666]">Recording</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${config?.transcribe ? 'text-[#59A14F]' : 'text-[#999999]'}`}>
                {config?.transcribe ? '✓' : '○'}
              </span>
              <span className="text-xs text-[#666666]">Transcribe</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${config?.translate ? 'text-[#59A14F]' : 'text-[#999999]'}`}>
                {config?.translate ? '✓' : '○'}
              </span>
              <span className="text-xs text-[#666666]">Translate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${config?.survey ? 'text-[#59A14F]' : 'text-[#999999]'}`}>
                {config?.survey ? '✓' : '○'}
              </span>
              <span className="text-xs text-[#666666]">Survey</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${config?.synthetic_caller ? 'text-[#59A14F]' : 'text-[#999999]'}`}>
                {config?.synthetic_caller ? '✓' : '○'}
              </span>
              <span className="text-xs text-[#666666]">Shopper</span>
            </div>
          </div>
          <p className="text-xs text-[#999999] mt-3 italic">
            These are the features that were active when this call was placed. To change settings for future calls, use the configuration above.
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
      />
    </div>
  )
}
