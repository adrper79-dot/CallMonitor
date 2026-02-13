'use client'

/**
 * /admin/ai — AI model configuration
 *
 * Composes existing AIAgentConfig component.
 * Admin-only: owner/admin roles have full edit access.
 */

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import dynamic from 'next/dynamic'

const AIAgentConfig = dynamic(
  () => import('@/components/settings/AIAgentConfig').then(mod => mod.AIAgentConfig),
  { ssr: false }
)

export default function AdminAIPage() {
  const { data: session } = useSession()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>('base')

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => {
        if (data.organization?.id) {
          setOrgId(data.organization.id)
          setPlan(data.organization.plan || 'base')
        }
      })
      .catch((err: any) => logger.error('Failed to load org for AI config', err))
  }, [session])

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Configuration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Model settings, prompts & automation rules</p>
      </div>
      <AIAgentConfig organizationId={orgId || ''} plan={plan} canEdit={true} />
    </div>
  )
}
