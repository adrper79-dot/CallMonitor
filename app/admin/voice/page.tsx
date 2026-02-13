'use client'

/**
 * /admin/voice — Telnyx voice configuration
 *
 * Composes CallerIdManager and VoiceTargetManager.
 */

import React, { useState, useEffect } from 'react'
import { Phone, Target } from 'lucide-react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import dynamic from 'next/dynamic'

const CallerIdManager = dynamic(() => import('@/components/voice/CallerIdManager'), { ssr: false })
const VoiceTargetManager = dynamic(() => import('@/components/voice/VoiceTargetManager'), { ssr: false })

type Tab = 'caller-ids' | 'targets'

export default function AdminVoicePage() {
  const { data: session } = useSession()
  const [tab, setTab] = useState<Tab>('caller-ids')
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => { if (data.organization?.id) setOrgId(data.organization.id) })
      .catch((err: any) => logger.error('Failed to load org for voice config', err))
  }, [session])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'caller-ids', label: 'Caller IDs', icon: <Phone className="w-4 h-4" /> },
    { key: 'targets', label: 'Voice Targets', icon: <Target className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Voice Configuration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Telnyx phone numbers, caller IDs & routing</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'caller-ids' && <CallerIdManager organizationId={orgId} />}
      {tab === 'targets' && <VoiceTargetManager organizationId={orgId} />}
    </div>
  )
}
