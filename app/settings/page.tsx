"use client"

import React from 'react'
import { useSession } from 'next-auth/react'
import CallModulations from '@/components/voice/CallModulations'
import { useRBAC } from '@/hooks/useRBAC'

export default function SettingsPage() {
  const { data: session } = useSession()
  const userId = session?.user?.id

  // Get organization ID from session or user
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [organizationName, setOrganizationName] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    async function fetchOrganization() {
      try {
        // Fetch user's organization
        const res = await fetch(`/api/users/${userId}`)
        if (!res.ok) throw new Error('Failed to fetch user')
        
        const data = await res.json()
        if (data.organization_id) {
          setOrganizationId(data.organization_id)
          
          // Fetch organization name
          const orgRes = await fetch(`/api/organizations/${data.organization_id}`)
          if (orgRes.ok) {
            const orgData = await orgRes.json()
            setOrganizationName(orgData.name || null)
          }
        }
      } catch (e) {
        console.error('Failed to fetch organization', e)
      } finally {
        setLoading(false)
      }
    }

    fetchOrganization()
  }, [userId])

  const { role, plan } = useRBAC(organizationId)

  async function handleModulationChange(mods: Record<string, boolean>) {
    console.log('Voice config updated:', mods)
    // The CallModulations component handles the API call internally
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-slate-400">Loading...</div>
        </div>
      </main>
    )
  }

  if (!session || !userId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
            <p className="text-slate-400">Please sign in to access settings.</p>
          </div>
        </div>
      </main>
    )
  }

  if (!organizationId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">No Organization</h2>
            <p className="text-slate-400">You need to be part of an organization to configure voice settings.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold">Voice Settings</h1>
          <p className="text-slate-400 mt-2">
            Configure default voice modulations for your organization
            {organizationName && ` (${organizationName})`}
          </p>
          {plan && (
            <div className="mt-2 inline-block px-3 py-1 bg-slate-800 rounded-full text-sm">
              <span className="text-slate-400">Plan:</span> <span className="font-medium">{plan}</span>
            </div>
          )}
        </header>

        {/* Voice Modulations */}
        <section className="bg-slate-900 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Default Call Modulations</h2>
          <p className="text-slate-400 text-sm mb-6">
            These settings apply to all new calls. You can override them for individual calls in Voice Operations.
          </p>
          
          <CallModulations
            callId="default-config"
            organizationId={organizationId}
            initialModulations={{
              record: false,
              transcribe: false,
              translate: false,
              survey: false,
              synthetic_caller: false,
            }}
            onChange={handleModulationChange}
          />
        </section>

        {/* Info Section */}
        <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">About Live Translation</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              <strong className="text-slate-100">Live Translation (Preview)</strong> provides real-time voice translation during calls using SignalWire AI Agents.
            </p>
            <p>
              <strong className="text-slate-100">Requirements:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Business or Enterprise plan</li>
              <li>Feature flag enabled: <code className="bg-slate-800 px-2 py-0.5 rounded">TRANSLATION_LIVE_ASSIST_PREVIEW=true</code></li>
              <li>Translation enabled in modulations</li>
              <li>From and To languages configured</li>
            </ul>
            <p className="mt-4 text-slate-400">
              <strong>Note:</strong> Live translation is executed in real-time but post-call transcripts (via AssemblyAI) remain the authoritative record.
            </p>
          </div>
        </section>

        {/* RBAC Info */}
        {role && (
          <section className="text-sm text-slate-400">
            <p>Your role: <span className="font-medium text-slate-300">{role}</span></p>
            {(role === 'owner' || role === 'admin') ? (
              <p className="text-green-400">✓ You can modify these settings</p>
            ) : (
              <p className="text-amber-400">⚠ Only Owners and Admins can modify settings</p>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
