'use client'

/**
 * /work/call — Cockpit workspace page
 *
 * Wraps the Cockpit component (3-column agent workspace).
 * Accepts ?account=<id> query param to pre-select an account.
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

// Dynamic import to avoid SSR issues with WebRTC hooks
const Cockpit = dynamic(() => import('@/components/cockpit/Cockpit'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading Cockpit...</p>
      </div>
    </div>
  ),
})

export default function WorkCallPage() {
  const { data: session } = useSession()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | undefined>(undefined)

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
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => {
        if (data.organization?.id) setOrgId(data.organization.id)
        if (data.organization?.name) setOrgName(data.organization.name)
      })
      .catch((err: any) => logger.error('Failed to load org for cockpit', err))
  }, [session])

  // Check role-based access
  const { role, loading: rbacLoading } = useRBAC(orgId)
  const hasDialerAccess = role && ['agent', 'analyst', 'operator', 'manager', 'compliance', 'admin', 'owner'].includes(role)

  if (rbacLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading Cockpit...</p>
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
              The cockpit requires agent-level permissions or higher. Your current role ({role || 'unknown'}) does not have access to make calls.
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
      <Cockpit organizationId={orgId} organizationName={orgName} />
    </div>
  )
}
