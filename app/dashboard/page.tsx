'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import DashboardHome from '@/components/dashboard/DashboardHome'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import { logger } from '@/lib/logger'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string>('Your Organization')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Fetch organization data from API
      fetch('/api/organizations/current')
        .then((res) => res.json())
        .then((data) => {
          setOrganizationId(data.organization?.id || null)
          setOrganizationName(data.organization?.name || 'Your Organization')
          setLoading(false)
        })
        .catch((err) => {
          logger.error('Failed to fetch organization data', err)
          setLoading(false)
        })
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
  }, [session, status])

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
    <AppShell organizationName={organizationName} userEmail={userEmail}>
      {/* Page Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back. Here's what's happening with your calls.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <DashboardHome organizationId={organizationId} />
      </div>
    </AppShell>
  )
}
