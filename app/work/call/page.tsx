'use client'

/**
 * /work/call — Cockpit workspace page
 *
 * Wraps the Cockpit component (3-column agent workspace).
 * Accepts ?account=<id> query param to pre-select an account.
 */

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import dynamic from 'next/dynamic'

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

  return <Cockpit organizationId={orgId} organizationName={orgName} />
}
