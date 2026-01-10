"use client"

import React, { useState } from 'react'
import { Button } from '../components/ui/button'
import { toast } from '../components/ui/use-toast'
import Link from 'next/link'

export default function Home() {
  const [phone, setPhone] = useState('')
  const [record, setRecord] = useState(true)
  const [transcribe, setTranscribe] = useState(true)
  const [loading, setLoading] = useState(false)

  async function startCall(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: '00000000-0000-0000-0000-000000000000', phone_number: phone, modulations: { record, transcribe } })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error?.message || 'Failed')
      toast({ title: 'Call started', description: `Call ${data.call_id} created` })
      setPhone('')
    } catch (err: any) {
      toast({ title: 'Error', description: String(err?.message ?? err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <header className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold">CallMonitor • Voice Operations</h1>
        <p className="text-slate-400 mt-2">Single unified surface for call creation, modulation, and evidence review. See ARCH_DOCS/FE_GUIDE for UX guidance.</p>
      </header>

      <section className="max-w-4xl mx-auto grid grid-cols-3 gap-6">
        <article className="col-span-2 bg-slate-900 p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex gap-3 mb-6">
            <Link href="/voice"><Button>Open Voice Operations</Button></Link>
            <Link href="/voice"><Button>Recent Calls</Button></Link>
            <a href="/ARCH_DOCS/FE_GUIDE" className="inline-block"><Button>FE Guide</Button></a>
          </div>

          <form onSubmit={startCall} className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Phone (E.164)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15555551234" className="w-full p-2 rounded bg-slate-800 text-white" />
            </div>

            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2"><input type="checkbox" checked={record} onChange={() => setRecord(r => !r)} /> Record</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={transcribe} onChange={() => setTranscribe(t => !t)} /> Transcribe</label>
            </div>

            <div>
              <Button type="submit" disabled={loading || !phone}>{loading ? 'Starting…' : 'Start Call'}</Button>
            </div>
          </form>
        </article>

        <aside className="bg-slate-900 p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-3">Docs</h3>
          <ul className="space-y-2 text-slate-300">
            <li><a href="/ARCH_DOCS/MASTER_ARCHITECTURE.txt">Master Architecture</a></li>
            <li><a href="/ARCH_DOCS/SCHEMA.txt">Schema</a></li>
            <li><a href="/ARCH_DOCS/FREESWITCH_RUNBOOK.md">Media Plane Runbook</a></li>
          </ul>
        </aside>
      </section>
    </main>
  )
}
