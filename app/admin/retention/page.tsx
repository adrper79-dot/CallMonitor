'use client'

/**
 * /admin/retention — Data retention policy management
 *
 * Composes existing RetentionSettings component (461 lines).
 */

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import dynamic from 'next/dynamic'

const RetentionSettings = dynamic(() => import('@/components/settings/RetentionSettings'), { ssr: false })

export default function AdminRetentionPage() {
  const { data: session } = useSession()
  const [orgId, setOrgId] = useState('')

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => { if (data.organization?.id) setOrgId(data.organization.id) })
      .catch((err: any) => logger.error('Failed to load org for retention', err))
  }, [session])

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Data Retention</h1>
        <p className="text-sm text-gray-500 mt-0.5">Compliance data lifecycle policies</p>
      </div>
      <RetentionSettings organizationId={orgId} canEdit={true} />
    </div>
  )
}
