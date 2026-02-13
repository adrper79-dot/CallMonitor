'use client'

import React, { useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { useRBAC } from '@/hooks/useRBAC'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { AIAgentConfig } from '@/components/settings/AIAgentConfig'
import SurveyBuilder from '@/components/voice/SurveyBuilder'
import { Switch } from '@/components/ui/switch'
import { apiGet } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

/**
 * /settings/ai — AI control, agent config, survey builder.
 * Extracted from the former settings mega-page "ai-control" tab.
 */
export default function AISettingsPage() {
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
  const canEdit = role === 'owner' || role === 'admin'

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
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">AI & Intelligence</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure transcription, translation, AI agent, and surveys.
        </p>
      </div>

      {/* AI Control Toggles */}
      <AIControlToggles organizationId={organizationId} canEdit={canEdit} />

      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* AI Agent Config */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            AI Agent Configuration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure live translation, voice cloning, and AI model settings.
          </p>
        </div>
        <AIAgentConfig
          organizationId={organizationId}
          plan={plan || 'free'}
          canEdit={canEdit}
        />
      </section>

      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* Survey Builder */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Survey Builder
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create after-call surveys to gather customer feedback.
          </p>
        </div>
        <SurveyBuilder organizationId={organizationId} />
      </section>
    </div>
  )
}

/** AI feature toggles (transcription / translation) with evidence guarantee. */
function AIControlToggles({
  organizationId,
  canEdit,
}: {
  organizationId: string
  canEdit: boolean
}) {
  const { config, updateConfig, loading } = useVoiceConfig(organizationId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading AI settings...</span>
      </div>
    )
  }

  const features = [
    {
      key: 'transcribe',
      label: 'AI Transcription',
      description: 'Disable: Source recordings remain. Manual review only.',
    },
    {
      key: 'translate',
      label: 'AI Translation',
      description: 'Disable: Canonical transcripts remain. Translation off.',
    },
  ]

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          AI Control & Independence
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You own your data. We make that real.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        {features.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{f.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{f.description}</p>
            </div>
            <Switch
              checked={(config as any)?.[f.key] ?? false}
              onCheckedChange={(checked) => updateConfig({ [f.key]: checked })}
              disabled={!canEdit}
              aria-label={f.label}
            />
          </div>
        ))}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong className="text-gray-900 dark:text-white">Evidence Guarantee:</strong>{' '}
          Source recordings and canonical transcripts are always preserved, regardless of AI
          settings.
        </p>
      </div>
    </section>
  )
}
