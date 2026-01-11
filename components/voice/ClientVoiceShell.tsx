"use client"

import React from 'react'
import CallModulations from '@/components/voice/CallModulations'
import AudioPlayer from '@/components/voice/AudioPlayer'
import EvidenceManifestSummary from '@/components/voice/EvidenceManifestSummary'
import ActivityFeedEmbed from '@/components/voice/ActivityFeedEmbed'
import { Button } from '@/components/ui/button'

export default function ClientVoiceShell(props: { initialCalls: any[] }) {
  const { initialCalls } = props
  const [selectedCallId, setSelectedCallId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [callDetails, setCallDetails] = React.useState<any | null>(null)

  async function loadCall(callId: string) {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/calls/getCallStatus?callId=${encodeURIComponent(callId)}`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setCallDetails(json)
      setSelectedCallId(callId)
    } catch (e: any) {
      setError(String(e?.message ?? 'Failed to load call'))
    } finally { setLoading(false) }
  }

  async function handleModulationChange(mods: Record<string, boolean>) {
    try {
      await fetch('/api/calls/recordModulationIntent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: selectedCallId, modulations: mods })
      })
    } catch (e) {
      console.error('modulation intent failed', e)
    }
  }

  return (
    <div className="space-y-4">
      {!selectedCallId ? (
        <div className="text-slate-400">Select a call from the left to view details.</div>
      ) : null}

      {error ? (
        <div className="p-3 bg-rose-900 text-rose-100 rounded">Error: {error}</div>
      ) : null}

      {loading ? (
        <div className="p-3 bg-slate-900 text-slate-400 rounded">Loading call...</div>
      ) : null}

      {callDetails ? (
        <article className="space-y-4">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Call {callDetails.call?.id || selectedCallId}</h2>
              <div className="text-xs text-slate-400">Status: {callDetails.call?.status || 'unknown'}</div>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
              <CallModulations
                callId={callDetails.call?.id || 'unknown'}
                initialModulations={callDetails.modulations || { record: false, transcribe: false, translate: false, survey: false, synthetic_caller: false }}
                onChange={handleModulationChange}
              />

              <AudioPlayer recordingUrl={callDetails.recording?.recording_url || null} transcriptPreview={callDetails.recording?.transcript_json?.text || null} />

              <EvidenceManifestSummary manifest={callDetails.evidence_manifest || null} />
            </div>

            <aside className="space-y-4">
              <div className="p-3 bg-slate-900 rounded">
                <div className="text-sm text-slate-400">Call SID</div>
                <div className="text-sm text-slate-100">{callDetails.call?.call_sid || '—'}</div>
              </div>

              <ActivityFeedEmbed callId={selectedCallId || undefined} events={callDetails.activity || []} />
            </aside>
          </div>
        </article>
      ) : null}

      <div className="mt-4">
        <div className="text-xs text-slate-500">Note: UI is read-first; modulation changes record an intent.</div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          document.addEventListener('call:selected', function(e){
            try{ const id = e.detail?.id; if(id) { window.fetch('/_next/static/chunks/empty.js'); /* noop to satisfy bundler */ } }
            catch(e){ }
          })
        })()
      ` }} />
    </div>
  )
}
