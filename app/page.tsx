"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { toast } from '../components/ui/use-toast'
import Link from 'next/link'
import BulkCallUpload from '../components/BulkCallUpload'
import { useSession } from 'next-auth/react'

export default function Home() {
  const { data: session } = useSession()
  const [phone, setPhone] = useState('')
  const [from, setFrom] = useState('')
  const [record, setRecord] = useState(true)
  const [transcribe, setTranscribe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  // Fetch user's organization from their profile
  useEffect(() => {
    async function fetchOrganization() {
      if (!session?.user?.id) return
      
      try {
        const res = await fetch(`/api/users/${session.user.id}/organization`)
        if (res.ok) {
          const data = await res.json()
          setOrganizationId(data.organization_id)
        }
      } catch (err) {
        console.error('Failed to fetch organization:', err)
      }
    }
    
    fetchOrganization()
  }, [session?.user?.id])

  async function startCall(e: React.FormEvent) {
    e.preventDefault()
    
    if (!organizationId) {
      toast({ 
        title: 'Error', 
        description: 'No organization found. Please contact support.', 
        variant: 'destructive' 
      })
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          organization_id: organizationId, 
          from_number: from || undefined, 
          phone_number: phone, 
          flow_type: from ? 'bridge' : 'outbound', 
          modulations: { record, transcribe } 
        })
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
            <Button onClick={() => setShowBulkUpload(!showBulkUpload)} variant="outline">
              {showBulkUpload ? '📞 Single Call' : '📋 Bulk Upload'}
            </Button>
            <a href="/ARCH_DOCS/FE_GUIDE" className="inline-block"><Button>FE Guide</Button></a>
          </div>

          {showBulkUpload ? (
            <BulkCallUpload organizationId={organizationId || ''} />
          ) : (
            <form onSubmit={startCall} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">From (Agent or From number, optional)</label>
                <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="+15551234 or agent-id" className="w-full p-2 rounded bg-slate-800 text-white mb-2" />
                <label className="block text-sm text-slate-300 mb-1">To (E.164)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15555551234" className="w-full p-2 rounded bg-slate-800 text-white" />
                <p className="text-xs text-slate-500 mt-1">Provide both From and To to create a bridged two-leg call; leave From empty for single outbound.</p>
              </div>

              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2"><input type="checkbox" checked={record} onChange={() => setRecord(r => !r)} /> Record</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={transcribe} onChange={() => setTranscribe(t => !t)} /> Transcribe</label>
              </div>

              <div>
                <Button type="submit" disabled={loading || !phone}>{loading ? 'Starting…' : 'Start Call'}</Button>
              </div>
            </form>
          )}
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
