'use client'

import IntegrationHub from '@/components/settings/IntegrationHub'

export default function IntegrationsSettingsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Integrations</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Connect your tools and automate workflows across your organization.
        </p>
      </div>
      <IntegrationHub />
    </div>
  )
}
