'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import ReviewMode from '@/components/review/ReviewMode'
import { ProductTour, REVIEW_TOUR } from '@/components/tour'
import { apiGet } from '@/lib/apiClient'

function ReviewPageContent() {
  const searchParams = useSearchParams()
  const callId = searchParams.get('callId')
  const { data: session } = useSession()
  const [organizationId, setOrganizationId] = useState<string | null>(null)

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
      .catch(console.error)
  }, [session])

  if (!callId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-white border border-gray-200 rounded-md">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Evidence Review</h1>
            <p className="text-gray-500">No call specified. Please provide a callId parameter.</p>
            <p className="text-sm text-gray-400 mt-2">Example: /review?callId=abc-123-def</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <ReviewMode callId={callId} organizationId={organizationId} />
      </div>

      {/* Tutorial Tour */}
      <ProductTour tourId="review" steps={REVIEW_TOUR} />
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
          <div className="loading-spinner" />
          <span className="ml-3 text-gray-500">Loading...</span>
        </div>
      }
    >
      <ReviewPageContent />
    </Suspense>
  )
}
