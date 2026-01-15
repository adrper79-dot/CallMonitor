"use client"

import React, { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import TeamManagement from '@/components/team/TeamManagement'
import CallerIdManager from '@/components/voice/CallerIdManager'
import ShopperScriptManager from '@/components/voice/ShopperScriptManager'
import VoiceTargetManager from '@/components/voice/VoiceTargetManager'
import SurveyBuilder from '@/components/voice/SurveyBuilder'
import { useRBAC } from '@/hooks/useRBAC'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

type TabId = 'ai-control' | 'targets' | 'team' | 'caller-id' | 'shopper' | 'surveys' | 'billing'

function SettingsPageContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const userId = (session?.user as any)?.id
  
  // Get tab from URL or default to 'ai-control'
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabId>((tabParam as TabId) || 'ai-control')

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
        const res = await fetch(`/api/users/${userId}/organization`, { credentials: 'include' })
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


  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="loading-spinner" />
            <span className="ml-3 text-gray-500">Loading...</span>
          </div>
        </div>
      </main>
    )
  }

  if (!session || !userId) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-500">Please sign in to access settings.</p>
          <a href="/api/auth/signin" className="mt-4 inline-block px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
            Sign In
          </a>
        </div>
      </main>
    )
  }

  if (!organizationId) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Organization</h2>
          <p className="text-gray-500">You need to be part of an organization to access settings.</p>
        </div>
      </main>
    )
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'ai-control', label: 'AI Control' },
    { id: 'targets', label: 'Targets' },
    { id: 'surveys', label: 'Surveys' },
    { id: 'team', label: 'Team' },
    { id: 'caller-id', label: 'Caller ID' },
    { id: 'shopper', label: 'Secret Shopper' },
    { id: 'billing', label: 'Billing' },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">
                {organizationName || 'Your Organization'}
                {plan && (
                  <Badge variant="default" className="ml-2">
                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </Badge>
                )}
              </p>
            </div>
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
              Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <nav className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className="space-y-8">
          {/* AI Control & Independence */}
          {activeTab === 'ai-control' && (
            <AIControlSection organizationId={organizationId} canEdit={role === 'owner' || role === 'admin'} />
          )}

          {/* Voice Targets - Numbers to Call */}
          {activeTab === 'targets' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Call Targets</h2>
                <p className="text-sm text-gray-500">
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
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Survey Builder</h2>
                <p className="text-sm text-gray-500">
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
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Caller ID Management</h2>
                <p className="text-sm text-gray-500">
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
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Secret Shopper Scripts</h2>
                <p className="text-sm text-gray-500">
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
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Billing & Plan</h2>
                <p className="text-sm text-gray-500">
                  Manage your subscription and payment methods.
                </p>
              </div>
              
              <div className="bg-white rounded-md border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Current Plan</p>
                    <p className="text-2xl font-semibold text-gray-900 capitalize">{plan || 'Free'}</p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-500">Calls this month</p>
                    <p className="text-xl font-semibold text-gray-900">—</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-500">Minutes used</p>
                    <p className="text-xl font-semibold text-gray-900">—</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-500">Team members</p>
                    <p className="text-xl font-semibold text-gray-900">—</p>
                  </div>
                </div>

                <button className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors">
                  Manage Subscription
                </button>
              </div>

              <div className="bg-white rounded-md border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Available Plans</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { name: 'Pro', price: '$49/mo', features: ['Recording', 'Transcription', 'Survey'] },
                    { name: 'Business', price: '$149/mo', features: ['+ Translation', '+ Secret Shopper', '+ Voice Cloning'] },
                    { name: 'Enterprise', price: 'Custom', features: ['+ SSO', '+ API Access', '+ Dedicated Support'] },
                  ].map(p => (
                    <div key={p.name} className="bg-gray-50 rounded-md p-4 border border-gray-200">
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xl font-bold text-primary-600 my-2">{p.price}</p>
                      <ul className="text-sm text-gray-600 space-y-1">
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
            <div className="text-sm text-gray-500 border-t border-gray-200 pt-4">
              Your role: <span className="text-gray-900 font-medium">{role}</span>
              {(role === 'owner' || role === 'admin') ? (
                <span className="text-success ml-2">Full settings access</span>
              ) : (
                <span className="text-warning ml-2">Limited access</span>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

/**
 * AI Control & Independence Section
 * Reference: ROLLOUT_EXECUTION_PLAN.md TASK 5
 */
function AIControlSection({ 
  organizationId, 
  canEdit 
}: { 
  organizationId: string
  canEdit: boolean 
}) {
  const { config, updateConfig, loading } = useVoiceConfig(organizationId)
  
  const features = [
    {
      key: 'transcribe',
      label: 'AI Transcription',
      description: 'Disable: Source recordings remain. Manual review only.',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: 'translate',
      label: 'AI Translation',
      description: 'Disable: Canonical transcripts remain. Translation off.',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
    },
  ]
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500">Loading AI settings...</span>
      </div>
    )
  }
  
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">AI Control & Independence</h2>
        <p className="text-sm text-gray-500">
          You own your data. We make that real.
        </p>
      </div>
      
      <div className="bg-white rounded-md border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-success-light flex items-center justify-center">
            <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Evidence Independence</h3>
            <p className="text-sm text-gray-500">Disable any AI feature without losing your source evidence</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {features.map(feature => (
            <div 
              key={feature.key}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-md border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <div className="text-gray-400">
                  {feature.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{feature.label}</p>
                  <p className="text-xs text-gray-500">{feature.description}</p>
                </div>
              </div>
              <Switch
                checked={(config as any)?.[feature.key] ?? false}
                onCheckedChange={(checked) => updateConfig({ [feature.key]: checked })}
                disabled={!canEdit}
                aria-label={feature.label}
              />
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-info-light rounded-md border border-blue-200">
          <p className="text-sm text-gray-700">
            <strong className="text-gray-900">Why this matters:</strong> Your call 
            evidence must be defensible in disputes, audits, and legal proceedings. 
            AI assists — but never replaces — the source of truth. Source recordings 
            and canonical transcripts are always preserved, regardless of AI settings.
          </p>
        </div>
      </div>
      
      {/* Evidence Guarantee */}
      <div className="bg-white rounded-md border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Evidence Guarantee</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-gray-900">Source recordings</strong> are never modified after capture</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-gray-900">Canonical transcripts</strong> are versioned and cryptographically hashed</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-gray-900">Evidence manifests</strong> provide full provenance chain</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-success mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong className="text-gray-900">Export bundles</strong> are self-contained and vendor-independent</span>
          </li>
        </ul>
      </div>
    </section>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto flex items-center justify-center h-64">
          <div className="loading-spinner" />
          <span className="ml-3 text-gray-500">Loading...</span>
        </div>
      </main>
    }>
      <SettingsPageContent />
    </Suspense>
  )
}
