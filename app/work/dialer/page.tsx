'use client'

/**
 * /work/dialer — Standalone dialer page
 *
 * Power dialer mode: auto-advance through queue, dial next account.
 * Simplified view focused entirely on making calls fast.
 */

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRBAC } from '@/hooks/useRBAC'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import { AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { signOut } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'

const Cockpit = dynamic(() => import('@/components/cockpit/Cockpit'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading Dialer...</p>
      </div>
    </div>
  ),
})

export default function DialerPage() {
  const { data: session, status } = useSession()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/signin' })
    } catch (error) {
      logger.error('Sign out failed', { error })
      // Fallback navigation
      window.location.href = '/signin'
    }
  }

  useEffect(() => {
    if (status === 'loading') return

    const user = session?.user as any
    if (!user?.id) return

    // Prefer organization_id from session (already available)
    if (user.organization_id) {
      setOrgId(user.organization_id)
      return
    }

    // Fallback: fetch org from API
    apiGet(`/api/users/${user.id}/organization`)
      .then((data: any) => {
        if (data.organization?.id) {
          setOrgId(data.organization.id)
          setOrgName(data.organization.name)
        } else {
          setError('No organization found for your account.')
        }
      })
      .catch((err: any) => {
        logger.error('Failed to load org for dialer', err)
        setError('Unable to load organization. Please try refreshing the page.')
      })
  }, [session, status])

  // Check role-based access
  const { role, loading: rbacLoading } = useRBAC(orgId)
  const hasDialerAccess = role && ['agent', 'analyst', 'operator', 'manager', 'compliance', 'admin', 'owner'].includes(role)

  if (status === 'loading' || rbacLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading Dialer...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-sm px-4">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dialer Unavailable</h2>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!hasDialerAccess) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-sm px-4">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Access Restricted</h2>
            <p className="mt-2 text-sm text-gray-500">
              The dialer requires agent-level permissions or higher. Your current role ({role || 'unknown'}) does not have access to make calls.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Contact your administrator to upgrade your role if you need dialer access.
            </p>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="mt-4"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Cockpit organizationId={orgId} />
    </div>
  )
}
