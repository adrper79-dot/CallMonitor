'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import VoiceOperationsClient from '@/components/voice/VoiceOperationsClient'
import { logger } from '@/lib/logger'
import { ProtectedGate } from '@/components/ui/ProtectedGate'
import { TroubleshootChatToggle } from '@/components/admin/TroubleshootChatToggle'
import { AlertTriangle } from 'lucide-react'

// Interfaces (derived from ARCH_DOCS/Schema.txt)
export interface Call {
  id: string
  organization_id: string | null
  system_id: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  created_by: string | null
  call_sid: string | null
}

export default function VoiceOperationsPage() {
  const { data: session, status } = useSession()
  const [calls, setCalls] = useState<Call[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Fetch calls and organization data from API
      Promise.all([
        fetch('/api/calls').then((res) => res.json()),
        fetch('/api/organizations/current').then((res) => res.json()),
      ])
        .then(([callsData, orgData]) => {
          setCalls(callsData.calls || [])
          setOrganizationId(orgData.organization?.id || null)
          setOrganizationName(orgData.organization?.name || null)
          setLoading(false)
        })
        .catch((err) => {
          logger.error('Failed to fetch voice operations data', err)
          setError(err.message || 'Failed to load data')
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
        title="Voice Operations"
        description="Please sign in to access your voice dashboard and manage calls."
        redirectUrl="/voice-operations"
      />
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-900">
        <div className="text-center max-w-sm px-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Unable to load calls</h2>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <VoiceOperationsClient
        initialCalls={calls}
        organizationId={organizationId}
        organizationName={organizationName || undefined}
      />
      <TroubleshootChatToggle />
    </>
  )
}
