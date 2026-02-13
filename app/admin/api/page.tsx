'use client'

/**
 * /admin/api — API keys & webhook management
 *
 * Composes existing webhook suite (WebhookOverview, WebhookList, etc.).
 */

import React, { useState, useEffect } from 'react'
import { Key, Webhook } from 'lucide-react'
import { useSession } from '@/components/AuthProvider'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'
import dynamic from 'next/dynamic'

const WebhookOverview = dynamic(() => import('@/components/settings/WebhookOverview').then(mod => mod.WebhookOverview), { ssr: false })
const WebhookList = dynamic(() => import('@/components/settings/WebhookList').then(mod => mod.WebhookList), { ssr: false })

type Tab = 'webhooks' | 'keys'

export default function AdminAPIPage() {
  const { data: session } = useSession()
  const [tab, setTab] = useState<Tab>('webhooks')
  const [orgId, setOrgId] = useState<string>('')

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return
    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => { if (data.organization?.id) setOrgId(data.organization.id) })
      .catch((err: any) => logger.error('Failed to load org', err))
  }, [session])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-4 h-4" /> },
    { key: 'keys', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">API & Webhooks</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage integrations and automation</p>
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

      {tab === 'webhooks' && <WebhookList organizationId={orgId} canEdit={true} />}
      {tab === 'keys' && (
        <div className="text-center py-12 text-gray-500">
          <Key className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium mb-1">API Key Management</p>
          <p className="text-xs text-gray-400">Coming in Phase 4 — use Settings → API tab for now</p>
        </div>
      )}
    </div>
  )
}
