'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import DashboardHome from '@/components/dashboard/DashboardHome'
import { FeatureFlagRedirect } from '@/components/layout/FeatureFlagRedirect'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import { BondAIAlertsPanel } from '@/components/bond-ai'
import { ProductTour, DASHBOARD_TOUR } from '@/components/tour'
import { logger } from '@/lib/logger'
import { apiGet } from '@/lib/apiClient'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string>('Your Organization')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Use organization from session
      const orgId = session.user.organization_id
      if (!orgId) {
        setLoading(false)
        return
      }
      setOrganizationId(orgId)

      // Fetch organization data from API for additional details
      apiGet('/api/organizations/current')
        .then((data) => {
          setOrganizationId(data.organization?.id || orgId)
          setOrganizationName(data.organization?.name || 'Your Organization')
          setLoading(false)
        })
        .catch((err) => {
          logger.error('Failed to fetch organization data', err)
          setOrganizationId(orgId)
          setLoading(false)
        })
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
  }, [session, status, router])

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session?.user) {
    return (
      <ProtectedGate
        title="Dashboard"
        description="Please sign in to access your dashboard."
        redirectUrl="/dashboard"
      />
    )
  }

  const userEmail = session.user.email || undefined

  return (
    <>
      <FeatureFlagRedirect to="/work" />
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back. Here&apos;s what&apos;s happening with your calls.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <DashboardHome organizationId={organizationId} />

        {/* Bond AI Alerts */}
        <div className="mt-8">
          <BondAIAlertsPanel compact />
        </div>
      </div>

      {/* Tutorial Tour */}
      <ProductTour tourId="dashboard" steps={DASHBOARD_TOUR} />
    </>
  )
}
