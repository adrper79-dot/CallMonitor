"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { toast } from '../components/ui/use-toast'
import Link from 'next/link'
import BulkCallUpload from '../components/BulkCallUpload'
import { useSession } from 'next-auth/react'
import { useVoiceConfig } from '../hooks/useVoiceConfig'

export default function Home() {
  const { data: session } = useSession()
  const [phone, setPhone] = useState('')
  const [from, setFrom] = useState('')
  const [record, setRecord] = useState(true)
  const [transcribe, setTranscribe] = useState(true)
  const [translate, setTranslate] = useState(false)
  const [translateFrom, setTranslateFrom] = useState('en')
  const [translateTo, setTranslateTo] = useState('es')
  const [loading, setLoading] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({})
  const { config, updateConfig } = useVoiceConfig(organizationId)
  const isSubmittingRef = useRef(false)

  // Fetch user's organization from their profile
  useEffect(() => {
    async function fetchOrganization() {
      console.log('fetchOrganization: checking session', { 
        hasSession: !!session, 
        hasUser: !!session?.user, 
        userId: session?.user?.id || null 
      })
      
      if (!session?.user?.id) {
        console.log('fetchOrganization: no session user ID, skipping')
        return
      }
      
      try {
        console.log('fetchOrganization: fetching for user', session.user.id)
        const res = await fetch(`/api/users/${session.user.id}/organization`)
        console.log('fetchOrganization: response', { status: res.status, ok: res.ok })
        
        if (res.ok) {
          const data = await res.json()
          console.log('fetchOrganization: got organization', data.organization_id)
          setOrganizationId(data.organization_id)
        } else {
          const error = await res.text()
          console.error('fetchOrganization: API error', { status: res.status, error })
        }
      } catch (err) {
        console.error('fetchOrganization: fetch failed', err)
      }
    }
    
    fetchOrganization()
  }, [session?.user?.id])

  // Fetch capabilities
  useEffect(() => {
    if (!organizationId) return
    
    fetch(`/api/call-capabilities?orgId=${encodeURIComponent(organizationId)}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.capabilities) {
          setCapabilities(json.capabilities)
        }
      })
      .catch(() => {})
  }, [organizationId])

  // Load translation settings from voice config
  useEffect(() => {
    if (config) {
      setTranslate(config.translation_enabled ?? false)
      setTranslateFrom(config.translate_from || 'en')
      setTranslateTo(config.translate_to || 'es')
    }
  }, [config])

  async function startCall(e: React.FormEvent) {
    e.preventDefault()
    
    // Prevent double submission (race condition protection)
    if (isSubmittingRef.current) {
      console.warn('startCall: already submitting, ignoring duplicate click')
      return
    }
    
    if (!organizationId) {
      toast({ 
        title: 'Error', 
        description: 'No organization found. Please contact support.', 
        variant: 'destructive' 
      })
      return
    }
    
    isSubmittingRef.current = true
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
          modulations: { 
            record, 
            transcribe,
            translate
          } 
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
      isSubmittingRef.current = false
    }
  }

  async function handleTranslateToggle(enabled: boolean) {
    setTranslate(enabled)
    if (organizationId && updateConfig) {
      try {
        await updateConfig({ translation_enabled: enabled })
      } catch (err) {
        console.error('Failed to update translation setting:', err)
      }
    }
  }

  async function handleTranslateFromChange(lang: string) {
    setTranslateFrom(lang)
    if (organizationId && updateConfig) {
      try {
        await updateConfig({ translate_from: lang })
      } catch (err) {
        console.error('Failed to update translate_from:', err)
      }
    }
  }

  async function handleTranslateToChange(lang: string) {
    setTranslateTo(lang)
    if (organizationId && updateConfig) {
      try {
        await updateConfig({ translate_to: lang })
      } catch (err) {
        console.error('Failed to update translate_to:', err)
      }
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
          
          {/* Debug: Show session and org status */}
          <div className="mb-4 p-3 bg-slate-800 rounded text-xs">
            <div>Session: {session ? '✅ Logged in' : '❌ Not logged in'}</div>
            <div>Organization: {organizationId ? `✅ ${organizationId}` : '❌ Not found'}</div>
          </div>
          
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

              <div className="space-y-3">
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={record} onChange={() => setRecord(r => !r)} /> 
                    Record
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={transcribe} onChange={() => setTranscribe(t => !t)} /> 
                    Transcribe
                  </label>
                </div>

                {/* Translation Toggle */}
                {capabilities.real_time_translation_preview && (
                  <div className="p-3 bg-slate-800 rounded border border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={translate} 
                          onChange={(e) => handleTranslateToggle(e.target.checked)} 
                        /> 
                        Live Translation
                      </label>
                      <Badge className="text-xs bg-blue-600 text-white">Preview</Badge>
                      <span 
                        className="text-xs text-blue-400 cursor-help" 
                        title="Real-time voice translation. Post-call transcripts are authoritative."
                      >
                        ℹ️
                      </span>
                    </div>
                    
                    {translate && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">From Language</label>
                          <select 
                            value={translateFrom} 
                            onChange={(e) => handleTranslateFromChange(e.target.value)}
                            className="w-full p-2 rounded bg-slate-700 text-white text-sm"
                          >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="it">Italian</option>
                            <option value="pt">Portuguese</option>
                            <option value="zh">Chinese</option>
                            <option value="ja">Japanese</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">To Language</label>
                          <select 
                            value={translateTo} 
                            onChange={(e) => handleTranslateToChange(e.target.value)}
                            className="w-full p-2 rounded bg-slate-700 text-white text-sm"
                          >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="it">Italian</option>
                            <option value="pt">Portuguese</option>
                            <option value="zh">Chinese</option>
                            <option value="ja">Japanese</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
