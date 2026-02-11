'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'
import ReviewMode from '@/components/review/ReviewMode'
import ScorecardTemplateLibrary from '@/components/voice/ScorecardTemplateLibrary'
import { ProductTour, REVIEW_TOUR } from '@/components/tour'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

function ReviewPageContent() {
  const searchParams = useSearchParams()
  const callId = searchParams.get('callId')
  const tab = searchParams.get('tab')
  const { data: session } = useSession()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'review' | 'templates'>(
    tab === 'templates' ? 'templates' : 'review'
  )

  // Fetch organization from user
  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return

    apiGet<{
      success: boolean
      organization: { id: string; name: string; plan: string; plan_status: string }
      role: string
    }>(`/api/users/${userId}/organization`)
      .then((data) => {
        if (data.organization?.id) {
          setOrganizationId(data.organization.id)
        }
      })
      .catch((err) => logger.error('Failed to fetch organization', { error: err }))
  }, [session])

  const tabs = [
    { id: 'review' as const, label: 'Quality Audit' },
    { id: 'templates' as const, label: 'Scoring Matrices' },
  ]

  return (
    <AppShell>
      {/* Page Header with Tabs */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <h1 className="text-2xl font-semibold text-gray-900">Call Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">Audit interactions, score performance, and manage scoring libraries</p>
          <div className="flex gap-6 mt-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'review' && (
          <>
            {callId ? (
              <ReviewMode callId={callId} organizationId={organizationId} />
            ) : (
              <div className="p-6 bg-white border border-gray-200 rounded-md">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Evidence Review</h2>
                <p className="text-gray-500">No call specified. Please provide a callId parameter.</p>
                <p className="text-sm text-gray-400 mt-2">Example: /review?callId=abc-123-def</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'templates' && (
          <ScorecardTemplateLibrary
            organizationId={organizationId || ''}
            disabled={!organizationId}
          />
        )}
      </div>

      {/* Tutorial Tour */}
      <ProductTour tourId="review" steps={REVIEW_TOUR} />
    </AppShell>
  )
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="loading-spinner" />
          <span className="ml-3 text-gray-500">Loading...</span>
        </div>
      }
    >
      <ReviewPageContent />
    </Suspense>
  )
}
