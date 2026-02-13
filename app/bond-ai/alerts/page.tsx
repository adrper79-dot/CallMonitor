'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/components/AuthProvider'
import { FeatureFlagRedirect } from '@/components/layout/FeatureFlagRedirect'
import { BondAIAlertsPanel } from '@/components/bond-ai'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

export default function BondAIAlertsPage() {
  const { data: session } = useSession()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationPlan, setOrganizationPlan] = useState<string | null>(null)

  // Fetch organization data
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
          setOrganizationPlan(data.organization.plan)
        }
      })
      .catch((err) => logger.error('Failed to fetch organization', { error: err }))
  }, [session])

  // Redirect if not Pro plan
  if (organizationPlan && organizationPlan !== 'pro') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Pro Plan Required</h1>
          <p className="text-gray-500">AI Alerts are available with the Pro plan.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <FeatureFlagRedirect to="/work" />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">AI Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time notifications and insights from Bond AI
          </p>
        </div>

        <BondAIAlertsPanel />
      </div>
    </>
  )
}