'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { UnifiedInbox } from '@/components/inbox/UnifiedInbox'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import { logger } from '@/lib/logger'
import { apiGet } from '@/lib/apiClient'

export default function InboxPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string>('Your Organization')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const orgId = session.user.organization_id
      if (!orgId) {
        setLoading(false)
        return
      }
      setOrganizationId(orgId)

      // Fetch organization data
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
        <div className="animate-spin h-8 w-8 border-4 border-navy-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/signin')
    return null
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">No Organization Found</h2>
          <p className="mt-2 text-sm text-gray-600">Please contact support.</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedGate requiredRole="agent">
      <AppShell 
        organizationName={organizationName}
        organizationId={organizationId}
        userEmail={session?.user?.email}
      >
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-[1800px] mx-auto">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Unified Inbox</h1>
                  <p className="mt-1 text-sm text-gray-500">
                    All your messages, calls, and emails in one place
                  </p>
                </div>
              </div>
            </div>

            {/* Inbox Component */}
            <div className="p-6">
              <UnifiedInbox organizationId={organizationId} />
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedGate>
  )
}
