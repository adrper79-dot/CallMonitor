"use client"

import React, { useState, useEffect, Suspense } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useSearchParams } from 'next/navigation'
import TeamManagement from '@/components/team/TeamManagement'
import CallerIdManager from '@/components/voice/CallerIdManager'
import ShopperScriptManager from '@/components/voice/ShopperScriptManager'
import ScorecardTemplateLibrary from '@/components/voice/ScorecardTemplateLibrary'
import VoiceTargetManager from '@/components/voice/VoiceTargetManager'
import SurveyBuilder from '@/components/voice/SurveyBuilder'
import { RetentionSettings } from '@/components/settings/RetentionSettings'
import { UsageDisplay } from '@/components/settings/UsageDisplay'
import { BillingActions } from '@/components/settings/BillingActions'
import { SubscriptionManager } from '@/components/settings/SubscriptionManager'
import { PaymentMethodManager } from '@/components/settings/PaymentMethodManager'
import { InvoiceHistory } from '@/components/settings/InvoiceHistory'
import { PlanComparisonTable } from '@/components/settings/PlanComparisonTable'
import { AIAgentConfig } from '@/components/settings/AIAgentConfig'
import { WebhookList } from '@/components/settings/WebhookList'
import { WebhookSigningDocs } from '@/components/settings/WebhookSigningDocs'
import { apiGet } from '@/lib/apiClient'
import { useRBAC } from '@/hooks/useRBAC'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/layout/AppShell'
import { logger } from '@/lib/logger'
import { ProductTour, SETTINGS_TOUR } from '@/components/tour'

type TabId = 'call-config' | 'ai-control' | 'quality' | 'compliance' | 'team' | 'webhooks' | 'billing'

function SettingsPageContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const userId = (session?.user as any)?.id

  // Get tab from URL or default to 'call-config'
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabId>((tabParam as TabId) || 'call-config')

  const [organizationId, setOrganizationId] = React.useState<string>('')
  const [organizationName, setOrganizationName] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    async function fetchOrganization() {
      try {
        const data = await apiGet<{ organization_id?: string; organization_name?: string }>(
          `/api/users/${userId}/organization`
        )
        const orgId = data.organization_id || 'test-org-id'
        setOrganizationId(orgId)
        setOrganizationName(data.organization_name || 'Test Organization')
      } catch (e) {
        logger.error('Failed to fetch organization, using test-org-id', e, { userId })
        // Use test-org-id as fallback for testing
        setOrganizationId('test-org-id')
        setOrganizationName('Test Organization')
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
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto text-center px-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Sign in required</h2>
          <p className="text-gray-600 mb-6">Please sign in to access your settings.</p>
          <a
            href="/signin?callbackUrl=/settings"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Sign In
          </a>
          <p className="mt-4 text-sm text-gray-500">
            Don't have an account?{' '}
            <a href="/signup" className="text-primary-600 hover:text-primary-700">Create one</a>
          </p>
        </div>
      </main>
    )
  }

  // Organized tabs by job-to-be-done
  const tabs: { id: TabId; label: string; description: string }[] = [
    { id: 'call-config', label: 'Call Configuration', description: 'Targets, Caller ID, defaults' },
    { id: 'ai-control', label: 'AI & Intelligence', description: 'Transcription, translation, surveys' },
    { id: 'quality', label: 'Quality Assurance', description: 'AI quality evaluation scripts' },
    { id: 'team', label: 'Team & Access', description: 'Members, roles, permissions' },
    { id: 'webhooks', label: 'Webhooks', description: 'Event subscriptions & integrations' },
    { id: 'billing', label: 'Billing', description: 'Plan and payment' },
  ]

  const userEmail = session?.user?.email || undefined

  return (
    <AppShell organizationName={organizationName || undefined} userEmail={userEmail}>
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            {organizationName || 'Your Organization'}
            {plan && (
              <Badge variant="default" className="ml-2">
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Badge>
            )}
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Tab Navigation - Improved hierarchy */}
        <nav className="flex flex-wrap gap-2 mb-8" data-tour="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-tour={`tab-${tab.id}`}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
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
          {/* Call Configuration - Targets + Caller ID */}
          {activeTab === 'call-config' && (
            <div className="space-y-8">
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Call Targets</h2>
                  <p className="text-sm text-gray-500">
                    Add and manage phone numbers you want to test or monitor.
                  </p>
                </div>
                <VoiceTargetManager organizationId={organizationId} />
              </section>

              <div className="border-t border-gray-200 pt-8">
                <section className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Caller ID Management</h2>
                    <p className="text-sm text-gray-500">
                      Verify and manage phone numbers that appear as your caller ID.
                    </p>
                  </div>
                  <CallerIdManager organizationId={organizationId} />
                </section>
              </div>
            </div>
          )}

          {/* AI Control & Intelligence - AI settings + Surveys */}
          {activeTab === 'ai-control' && (
            <div className="space-y-8">
              <AIControlSection organizationId={organizationId ?? ''} canEdit={role === 'owner' || role === 'admin'} />

              <div className="border-t border-gray-200 pt-8">
                <section className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">AI Agent Configuration</h2>
                    <p className="text-sm text-gray-500">
                      Configure live translation, voice cloning, and AI model settings.
                    </p>
                  </div>
                  <AIAgentConfig
                    organizationId={organizationId}
                    plan={plan || 'free'}
                    canEdit={role === 'owner' || role === 'admin'}
                  />
                </section>
              </div>

              <div className="border-t border-gray-200 pt-8">
                <section className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Survey Builder</h2>
                    <p className="text-sm text-gray-500">
                      Create after-call surveys to gather customer feedback.
                    </p>
                  </div>
                  <SurveyBuilder organizationId={organizationId} />
                </section>
              </div>
            </div>
          )}

          {/* Quality Assurance */}
          {activeTab === 'quality' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">AI Quality Evaluation Scripts</h2>
                <p className="text-sm text-gray-500">
                  Create and manage scripts for AI-powered quality evaluations. For internal QA purposes only.
                </p>
              </div>
              <ShopperScriptManager organizationId={organizationId} />

              <div className="border-t border-gray-200 pt-8">
                <ScorecardTemplateLibrary
                  organizationId={organizationId}
                  disabled={!(plan === 'business' || plan === 'enterprise')}
                />
                {!(plan === 'business' || plan === 'enterprise') && (
                  <p className="text-xs text-gray-500 mt-2">
                    Upgrade to Business for scorecard templates and QA alerts.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Compliance - Retention & Legal Holds */}
          {activeTab === 'compliance' && (
            <RetentionSettings
              organizationId={organizationId}
              canEdit={role === 'owner' || role === 'admin'}
            />
          )}

          {/* Team Management */}
          {activeTab === 'team' && (
            <TeamManagement organizationId={organizationId} />
          )}

          {/* Webhooks - Integrations & Event Subscriptions */}
          {activeTab === 'webhooks' && (
            <div className="space-y-8">
              <section className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Webhook Subscriptions</h2>
                  <p className="text-sm text-gray-500">
                    Receive real-time notifications when events occur in your organization.
                  </p>
                </div>
                <WebhookList
                  organizationId={organizationId}
                  canEdit={role === 'owner' || role === 'admin'}
                />
              </section>

              <div className="border-t border-gray-200 pt-8">
                <section className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Developer Documentation</h2>
                    <p className="text-sm text-gray-500">
                      Learn how to verify webhook signatures and implement webhook handlers.
                    </p>
                  </div>
                  <WebhookSigningDocs />
                </section>
              </div>
            </div>
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

              {/* Usage Display */}
              <UsageDisplay organizationId={organizationId} plan={plan || 'free'} />

              {/* Subscription Manager - New Component */}
              <SubscriptionManager
                organizationId={organizationId}
                role={role || 'viewer'}
              />

              {/* Payment Methods - New Component */}
              <PaymentMethodManager
                organizationId={organizationId}
                role={role || 'viewer'}
              />

              {/* Invoice History - New Component */}
              <InvoiceHistory
                organizationId={organizationId}
                role={role || 'viewer'}
              />

              {/* Plan Comparison - New Component */}
              <PlanComparisonTable
                currentPlan={plan as 'free' | 'pro' | 'enterprise' || 'free'}
                organizationId={organizationId}
                role={role || 'viewer'}
              />

              <div className="bg-white rounded-md border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Upgrade Drivers</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { title: 'Audit‑Ready Evidence', detail: 'Custody‑grade bundles with canonical hashing.' },
                    { title: 'Export + Debug Bundle', detail: 'Deterministic exports with manifests + provenance.' },
                    { title: 'Verification Ready', detail: 'Verify bundles and manifests independently.' },
                  ].map((item) => (
                    <div key={item.title} className="bg-gray-50 rounded-md p-4 border border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{item.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <a href="/pricing" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    View pricing and plan details
                  </a>
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

      {/* Tutorial Tour */}
      <ProductTour tourId="settings" steps={SETTINGS_TOUR} />
    </AppShell>
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
