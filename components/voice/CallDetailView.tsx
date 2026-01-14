"use client"

import React from 'react'
import { useCallDetails } from '@/hooks/useCallDetails'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import CallModulations from './CallModulations'
import ArtifactViewer from './ArtifactViewer'

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
      <section aria-labelledby="call-header" className="p-4 bg-slate-950 rounded-md border border-slate-800">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="call-header" className="text-xl font-semibold text-slate-100 mb-2">
              Call {call.id}
            </h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-slate-400">Status:</span>
              <Badge variant={statusVariant}>{call.status || 'unknown'}</Badge>
            </div>
            {call.call_sid && (
              <div className="text-xs text-slate-500 font-mono">
                SID: {call.call_sid}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400 mb-1">Duration</div>
            <div className="text-lg font-mono text-slate-100">
              {formatDuration(call.started_at, call.ended_at)}
            </div>
            {score && (
              <div className="mt-2">
                <div className="text-sm text-slate-400 mb-1">Score</div>
                <Badge variant={score.score >= 80 ? 'success' : score.score >= 60 ? 'warning' : 'error'}>
                  {score.score}%
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-400">Started</div>
            <div className="text-slate-100">
              {call.started_at ? new Date(call.started_at).toLocaleString() : '—'}
            </div>
          </div>
          {call.ended_at && (
            <div>
              <div className="text-slate-400">Ended</div>
              <div className="text-slate-100">
                {new Date(call.ended_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="Quick actions" className="flex gap-2">
        {recording?.recording_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Scroll to artifact viewer recording tab
              document.getElementById('artifact-recording')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Play Recording
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
            View Transcript
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
            View Manifest
          </Button>
        )}
      </section>

      {/* Modulations Panel */}
      {organizationId && (
        <CallModulations
          callId={call.id}
          organizationId={organizationId}
          initialModulations={{
            record: config?.record ?? false,
            transcribe: config?.transcribe ?? false,
            translate: config?.translate ?? false,
            survey: config?.survey ?? false,
            synthetic_caller: config?.synthetic_caller ?? false,
          }}
          onChange={onModulationChange || (async () => {})}
        />
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
