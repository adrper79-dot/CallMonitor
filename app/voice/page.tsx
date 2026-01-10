import React from 'react'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getServerSession } from 'next-auth/next'
import CallList from '@/components/voice/CallList'
import CallModulations from '@/components/voice/CallModulations'
import AudioPlayer from '@/components/voice/AudioPlayer'
import EvidenceManifestSummary from '@/components/voice/EvidenceManifestSummary'
import ActivityFeedEmbed from '@/components/voice/ActivityFeedEmbed'
import { Button } from '@/components/ui/button'

// Interfaces (derived from ARCH_DOCS/Schema.txt)
export interface Call {
  id: string
  organization_id: string | null
  system_id: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  created_by: string | null
  call_sid: string | null
}

export interface Recording {
  id: string
  organization_id: string
  call_sid: string
  recording_sid: string | null
  recording_url: string
  duration_seconds: number | null
  transcript_json: any | null
  status: string | null
  created_at: string | null
  updated_at: string | null
  tool_id: string
  created_by: string | null
}

export interface EvidenceManifest {
  id: string
  organization_id: string
  recording_id: string
  scorecard_id: string | null
  manifest: any
  created_at: string | null
}

export interface ActivityEvent {
  timestamp: string
  type: string
  title: string
  status?: string | null
}

type PageProps = {}

export default async function VoiceOperationsPage(_props: PageProps) {
  // server-side session check
  const session = await getServerSession()
  if (!session?.user?.id) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <h2 className="text-xl">Authentication required</h2>
          <p className="mt-2 text-slate-400">Please sign in to view Voice Operations.</p>
        </div>
      </div>
    )
  }

  // read-only: fetch calls using allowed columns from TOOL_TABLE_ALIGNMENT / Schema.txt
  let calls: Call[] = []
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('calls')
      .select('id,organization_id,system_id,status,started_at,ended_at,created_by,call_sid')

    if (error) throw error
    calls = (data || []) as Call[]
  } catch (e: any) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-500 text-4xl">⚠️</div>
          <h2 className="mt-4 text-xl">Error loading calls</h2>
          <p className="mt-2 text-slate-400">{String(e?.message ?? 'Failed to load calls')}</p>
          <Button onClick={() => { /* client can reload */ }} className="mt-4">Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="w-1/4 border-r border-slate-800 overflow-y-auto p-4">
        <h1 className="text-lg font-semibold mb-4">Calls</h1>
        {/* `CallList` is a client component that will inform the client shell when a call is selected */}
        <CallList calls={calls} />
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {/* Client shell manages selected call details and invokes server actions for details and modulation changes */}
        <ClientVoiceShell initialCalls={calls} />
      </main>

      <section className="w-1/4 border-l border-slate-800 overflow-y-auto p-4">
        <h3 className="text-lg font-semibold mb-4">Activity Feed</h3>
        <ActivityFeedEmbed />
      </section>
    </div>
  )
}

// Client-side shell: manages selection and calls server endpoints/actions
export const ClientVoiceShell = (props: { initialCalls: Call[] }) => {
  'use client'
  const { initialCalls } = props
  const ReactClient = React as any
  const [selectedCallId, setSelectedCallId] = ReactClient.useState(null)
  const [loading, setLoading] = ReactClient.useState(false)
  const [error, setError] = ReactClient.useState(null)
  const [callDetails, setCallDetails] = ReactClient.useState(null)

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
    // Call server action (via API route) to record the modulation intent (read/write boundary)
    try {
      await fetch('/api/calls/recordModulationIntent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: selectedCallId, modulations: mods })
      })
    } catch (e) {
      // swallow — page remains read-first, UI components should handle optimistic updates
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

      {/* Pass selection callback into CallList by DOM event: CallList is expected to provide a `data-call-id` on selection; simple delegation below */}
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
