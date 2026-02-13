'use client'

import React, { useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import VoiceTargetManager from '@/components/voice/VoiceTargetManager'
import CallerIdManager from '@/components/voice/CallerIdManager'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

/**
 * /settings/call-config — Voice targets + Caller ID management.
 * Extracted from the former settings mega-page "call-config" tab.
 */
export default function CallConfigPage() {
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id
  const [organizationId, setOrganizationId] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    apiGet<{ organization: { id: string } }>(`/api/users/${userId}/organization`)
      .then((d) => setOrganizationId(d.organization?.id || ''))
      .catch((e) => logger.error('Failed to fetch org', e, { userId }))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    )
  }

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Organization not found. Please sign in again.
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Call Configuration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage voice targets and caller ID numbers.
        </p>
      </div>

      {/* Call Targets */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Call Targets</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add and manage phone numbers you want to test or monitor.
          </p>
        </div>
        <VoiceTargetManager organizationId={organizationId} />
      </section>

      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* Caller ID */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Caller ID Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Verify and manage phone numbers that appear as your caller ID.
          </p>
        </div>
        <CallerIdManager organizationId={organizationId} />
      </section>
    </div>
  )
}
