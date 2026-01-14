"use client"

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import CallModulations from '@/components/voice/CallModulations'
import TeamManagement from '@/components/team/TeamManagement'
import CallerIdManager from '@/components/voice/CallerIdManager'
import ShopperScriptManager from '@/components/voice/ShopperScriptManager'
import VoiceTargetManager from '@/components/voice/VoiceTargetManager'
import SurveyBuilder from '@/components/voice/SurveyBuilder'
import { useRBAC } from '@/hooks/useRBAC'

type TabId = 'voice' | 'targets' | 'team' | 'caller-id' | 'shopper' | 'surveys' | 'billing'

export default function SettingsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const userId = (session?.user as any)?.id
  
  // Get tab from URL or default to 'voice'
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabId>((tabParam as TabId) || 'voice')

  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [organizationName, setOrganizationName] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    async function fetchOrganization() {
      try {
        const res = await fetch(`/api/users/${userId}/organization`)
        if (!res.ok) throw new Error('Failed to fetch organization')
        
        const data = await res.json()
        if (data.organization_id) {
          setOrganizationId(data.organization_id)
          setOrganizationName(data.organization_name || null)
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
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
          </div>
        </div>
      </main>
    )
  }

  if (!session || !userId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-slate-400">Please sign in to access settings.</p>
          <a href="/api/auth/signin" className="mt-4 inline-block px-6 py-2 bg-teal-600 rounded-lg hover:bg-teal-700">
            Sign In
          </a>
        </div>
      </main>
    )
  }

  if (!organizationId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">No Organization</h2>
          <p className="text-slate-400">You need to be part of an organization to access settings.</p>
        </div>
      </main>
    )
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'voice', label: 'Voice', icon: '🎙️' },
    { id: 'targets', label: 'Targets', icon: '🎯' },
    { id: 'surveys', label: 'Surveys', icon: '📊' },
    { id: 'team', label: 'Team', icon: '👥' },
    { id: 'caller-id', label: 'Caller ID', icon: '📞' },
    { id: 'shopper', label: 'Secret Shopper', icon: '🕵️' },
    { id: 'billing', label: 'Billing', icon: '💳' },
  ]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>⚙️</span> Settings
              </h1>
              <p className="text-sm text-slate-400">
                {organizationName || 'Your Organization'}
                {plan && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-900/50 text-amber-300 rounded-full text-xs">
                    {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
                  </span>
                )}
              </p>
            </div>
            <a href="/dashboard" className="text-sm text-slate-400 hover:text-white">
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <nav className="flex gap-1 mb-8 p-1 bg-slate-800/50 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="space-y-8">
          {/* Voice Settings */}
          {activeTab === 'voice' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Voice Configuration</h2>
                <p className="text-slate-400 text-sm">
                  Default settings for recording, transcription, and translation.
                </p>
              </div>
              
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
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
              </div>

              {/* Info Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                  <h3 className="font-medium text-white mb-2">📊 Analytics Included</h3>
                  <p className="text-sm text-slate-400">
                    All transcriptions now include sentiment analysis, entity detection, and topic chapters automatically.
                  </p>
                </div>
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                  <h3 className="font-medium text-white mb-2">🌐 Live Translation</h3>
                  <p className="text-sm text-slate-400">
                    Real-time voice translation during calls. Available on Business and Enterprise plans.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Voice Targets - Numbers to Call */}
          {activeTab === 'targets' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Call Targets</h2>
                <p className="text-slate-400 text-sm">
                  Add and manage phone numbers you want to test or monitor.
                </p>
              </div>
              <VoiceTargetManager organizationId={organizationId} />
            </section>
          )}

          {/* Survey Builder */}
          {activeTab === 'surveys' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Survey Builder</h2>
                <p className="text-slate-400 text-sm">
                  Create after-call surveys to gather customer feedback.
                </p>
              </div>
              <SurveyBuilder organizationId={organizationId} />
            </section>
          )}

          {/* Team Management */}
          {activeTab === 'team' && (
            <TeamManagement organizationId={organizationId} />
          )}

          {/* Caller ID Management */}
          {activeTab === 'caller-id' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Caller ID Management</h2>
                <p className="text-slate-400 text-sm">
                  Verify and manage phone numbers that appear as your caller ID.
                </p>
              </div>
              <CallerIdManager organizationId={organizationId} />
            </section>
          )}

          {/* Secret Shopper */}
          {activeTab === 'shopper' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Secret Shopper Scripts</h2>
                <p className="text-slate-400 text-sm">
                  Create and manage scripts for quality assurance evaluations.
                </p>
              </div>
              <ShopperScriptManager organizationId={organizationId} />
            </section>
          )}

          {/* Billing */}
          {activeTab === 'billing' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Billing & Plan</h2>
                <p className="text-slate-400 text-sm">
                  Manage your subscription and payment methods.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-xl border border-amber-700/50 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-amber-400 uppercase tracking-wide">Current Plan</p>
                    <p className="text-3xl font-bold text-amber-200 capitalize">{plan || 'Free'}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-900/50 text-green-400 rounded-full text-sm">
                    Active
                  </span>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-sm text-slate-400">Calls this month</p>
                    <p className="text-2xl font-bold text-white">—</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-sm text-slate-400">Minutes used</p>
                    <p className="text-2xl font-bold text-white">—</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-sm text-slate-400">Team members</p>
                    <p className="text-2xl font-bold text-white">—</p>
                  </div>
                </div>

                <button className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors">
                  Manage Subscription
                </button>
              </div>

              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                <h3 className="font-medium text-white mb-4">Available Plans</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { name: 'Pro', price: '$49/mo', features: ['Recording', 'Transcription', 'Survey'] },
                    { name: 'Business', price: '$149/mo', features: ['+ Translation', '+ Secret Shopper', '+ Voice Cloning'] },
                    { name: 'Enterprise', price: 'Custom', features: ['+ SSO', '+ API Access', '+ Dedicated Support'] },
                  ].map(p => (
                    <div key={p.name} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="text-2xl font-bold text-teal-400 my-2">{p.price}</p>
                      <ul className="text-sm text-slate-400 space-y-1">
                        {p.features.map(f => (
                          <li key={f}>✓ {f}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Role Info */}
          {role && (
            <div className="text-sm text-slate-500 border-t border-slate-800 pt-4">
              Your role: <span className="text-slate-300">{role}</span>
              {(role === 'owner' || role === 'admin') ? (
                <span className="text-green-400 ml-2">• Full settings access</span>
              ) : (
                <span className="text-amber-400 ml-2">• Limited access</span>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
