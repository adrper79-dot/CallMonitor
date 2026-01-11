import React from 'react'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getServerSession } from 'next-auth/next'
import CallList from '@/components/voice/CallList'
import CallModulations from '@/components/voice/CallModulations'
import AudioPlayer from '@/components/voice/AudioPlayer'
import EvidenceManifestSummary from '@/components/voice/EvidenceManifestSummary'
import ActivityFeedEmbed from '@/components/voice/ActivityFeedEmbed'
import { Button } from '@/components/ui/button'
import ClientVoiceShell from '@/components/voice/ClientVoiceShell'

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

// Client-side shell moved to a separate client component for app-router compatibility
