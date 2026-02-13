'use client'

import React, { useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRBAC } from '@/hooks/useRBAC'
import TeamManagement from '@/components/team/TeamManagement'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

/**
 * /settings/team — Team members, roles, and permissions.
 * Extracted from the former settings mega-page "team" tab.
 * Owner/admin only.
 */
export default function TeamPage() {
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

  const { role } = useRBAC(organizationId)
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

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

  if (!isOwnerOrAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Owner or admin access required for Team Management.
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Team & Access</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage team members, roles, and permissions.
        </p>
      </div>

      <TeamManagement organizationId={organizationId} />
    </div>
  )
}
