"use client"

import React, { useState, useEffect } from 'react'
import supabase from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import CallList from '../../components/voice/CallList'
import CallModulations from '../../components/voice/CallModulations'
import AudioPlayer from '../../components/voice/AudioPlayer'
import EvidenceManifestSummary from '../../components/voice/EvidenceManifestSummary'
import ActivityFeedEmbed from '../../components/voice/ActivityFeedEmbed'
import { Button } from '../../components/ui/button'
import { AlertCircle } from 'lucide-react'
import { toast } from '../../components/ui/use-toast'

interface Call {
  id: string
  organization_id: string
  status: string
  started_at: string | null
  ended_at: string | null
  created_by: string
  duration?: number
  modulations?: Record<string, boolean>
}

interface Recording {
  id: string
  call_id: string
  recording_url: string
  transcript_json: any | null
  status: string
}

interface EvidenceManifest {
  id: string
  manifest: any
}

export default function VoiceOperationsPage() {
  const router = useRouter()
  const [calls, setCalls] = useState<Call[]>([])
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [manifest, setManifest] = useState<EvidenceManifest | null>(null)
  const [modulations, setModulations] = useState<Record<string, boolean>>({
    record: false,
    transcribe: false,
    translate: false,
    survey: false,
    synthetic_caller: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCalls() {
      setLoading(true)
      setError(null)
      try {
        const res = await supabase.from('calls').select('*').order('started_at', { ascending: false }).limit(50)
        setCalls(res.data || [])
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load calls')
        toast({ title: 'Error', description: String(e?.message ?? e), variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }

    loadCalls()
  }, [])

  useEffect(() => {
    if (!selectedCallId) return

    async function loadCallDetails() {
      setLoading(true)
      try {
        const callRes = await supabase.from('calls').select('*').eq('id', selectedCallId).single()
        const callData = callRes.data
        setSelectedCall(callData || null)

        const recRes = await supabase.from('recordings').select('*').eq('call_id', selectedCallId).single()
        setRecording(recRes.data || null)

        const manRes = await supabase.from('evidence_manifests').select('*').eq('recording_id', recRes.data?.id || '').single()
        setManifest(manRes.data || null)

        setModulations(callData?.modulations || modulations)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load call details')
      } finally {
        setLoading(false)
      }
    }

    loadCallDetails()
  }, [selectedCallId])

  const handleModulationChange = async (newMods: Record<string, boolean>) => {
    try {
      // call server endpoint - placeholder
      await fetch('/api/actions/updateModulations', { method: 'POST', body: JSON.stringify({ callId: selectedCallId, modulations: newMods }) })
      toast({ title: 'Success', description: 'Modulations updated' })
    } catch (err: any) {
      toast({ title: 'Error', description: String(err?.message ?? err), variant: 'destructive' })
    }
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl">Error loading calls</h2>
          <p className="mt-2 text-slate-400">{error}</p>
          <Button onClick={() => location.reload()} className="mt-4">Retry</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4">Loading Voice Operations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <aside className="w-1/4 border-r border-slate-800 overflow-y-auto p-4">
        <h1 className="text-lg font-semibold mb-4">Calls</h1>
        <CallList calls={calls} selectedCallId={selectedCallId} onSelect={setSelectedCallId} />
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {selectedCall ? (
          <>
            <header className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold">Call {selectedCall.id}</h2>
                <p className="text-slate-400">Status: {selectedCall.status} • Duration: {selectedCall.duration ?? 'N/A'} min</p>
              </div>
              <Button variant="outline">Start New Call</Button>
            </header>

            <section className="mb-8">
              <h3 className="text-lg mb-2">Modulations</h3>
              <CallModulations callId={selectedCall.id} initialModulations={modulations} onChange={handleModulationChange} />
            </section>

            <section className="mb-8">
              <h3 className="text-lg mb-2">Recording</h3>
              <AudioPlayer recordingUrl={recording?.recording_url || null} transcriptPreview={recording?.transcript_json ? JSON.stringify(recording.transcript_json, null, 2) : null} />
            </section>

            <section>
              <h3 className="text-lg mb-2">Evidence & Score</h3>
              <EvidenceManifestSummary manifest={manifest} />
            </section>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">Select a call from the left to view details</div>
        )}
      </main>

      <section className="w-1/4 border-l border-slate-800 overflow-y-auto p-4">
        <h3 className="text-lg font-semibold mb-4">Activity Feed</h3>
        <ActivityFeedEmbed callId={selectedCallId} limit={20} />
      </section>
    </div>
  )
}
