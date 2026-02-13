'use client'

import React, { useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRBAC } from '@/hooks/useRBAC'
import ShopperScriptManager from '@/components/voice/ShopperScriptManager'
import ScorecardTemplateLibrary from '@/components/voice/ScorecardTemplateLibrary'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

/**
 * /settings/quality — QA scripts + scorecard templates.
 * Extracted from the former settings mega-page "quality" tab.
 * Owner/admin only.
 */
export default function QualityPage() {
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

  const { role, plan } = useRBAC(organizationId)
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
        Owner or admin access required for Evidence Quality settings.
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Evidence Quality</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          QA evaluation scripts and scorecard templates for call quality assurance.
        </p>
      </div>

      {/* QA Scripts */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            AI Quality Evaluation Scripts
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and manage scripts for AI-powered quality evaluations. For internal QA purposes
            only.
          </p>
        </div>
        <ShopperScriptManager organizationId={organizationId} />
      </section>

      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* Scorecard Templates */}
      <section className="space-y-4">
        <ScorecardTemplateLibrary
          organizationId={organizationId}
          disabled={!(plan === 'business' || plan === 'enterprise')}
        />
        {!(plan === 'business' || plan === 'enterprise') && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Upgrade to Business for scorecard templates and QA alerts.
          </p>
        )}
      </section>
    </div>
  )
}
