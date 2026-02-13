'use client'

/**
 * /work/dialer — Standalone dialer page
 *
 * Power dialer mode: auto-advance through queue, dial next account.
 * Simplified view focused entirely on making calls fast.
 */

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import dynamic from 'next/dynamic'

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
  const { data: session } = useSession()
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => { if (data.organization?.id) setOrgId(data.organization.id) })
      .catch((err: any) => logger.error('Failed to load org for dialer', err))
  }, [session])

  return <Cockpit organizationId={orgId} />
}
