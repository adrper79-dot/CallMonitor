'use client'

/**
 * /admin/feature-flags — Feature flag management
 *
 * Manages global and organization-specific feature flags.
 * Admin-only: owner/admin roles have full access.
 */

import React, { useState, useEffect } from 'react'
import { useSession } from '@/components/AuthProvider'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient'
import { logger } from '@/lib/logger'

interface FeatureFlag {
  id: string
  feature: string
  enabled: boolean
  created_at: string
  disabled_reason?: string
  disabled_at?: string
  disabled_by?: string
  daily_limit?: number
  monthly_limit?: number
  current_daily_usage?: number
  current_monthly_usage?: number
  usage_reset_at?: string
  updated_at?: string
  organization_id?: string
}

export default function AdminFeatureFlagsPage() {
  const { data: session } = useSession()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [globalFlags, setGlobalFlags] = useState<FeatureFlag[]>([])
  const [orgFlags, setOrgFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'global' | 'org'>('global')

  useEffect(() => {
    const userId = (session?.user as any)?.id
    if (!userId) return

    apiGet(`/api/users/${userId}/organization`)
      .then((data: any) => {
        if (data.organization?.id) {
          setOrgId(data.organization.id)
          loadFlags(data.organization.id)
        }
      })
      .catch((err: any) => logger.error('Failed to load org for feature flags', err))
  }, [session])

  const loadFlags = async (organizationId: string) => {
    setLoading(true)
    try {
      const [globalRes, orgRes] = await Promise.all([
        apiGet('/api/feature-flags/global'),
        apiGet('/api/feature-flags/org')
      ])
      setGlobalFlags(globalRes.data || [])
      setOrgFlags(orgRes.data || [])
    } catch (error) {
      logger.error('Failed to load feature flags', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFlag = async (flag: FeatureFlag, type: 'global' | 'org') => {
    try {
      const endpoint = type === 'global' ? `/api/feature-flags/global/${flag.feature}` : `/api/feature-flags/org/${flag.feature}`
      await apiPut(endpoint, { enabled: !flag.enabled })
      if (orgId) loadFlags(orgId)
    } catch (error) {
      logger.error('Failed to toggle feature flag', error)
    }
  }

  const createFlag = async (type: 'global' | 'org', feature: string) => {
    try {
      const endpoint = type === 'global' ? '/api/feature-flags/global' : '/api/feature-flags/org'
      await apiPost(endpoint, { feature, enabled: true })
      if (orgId) loadFlags(orgId)
    } catch (error) {
      logger.error('Failed to create feature flag', error)
    }
  }

  const deleteFlag = async (flag: FeatureFlag, type: 'global' | 'org') => {
    if (!confirm(`Delete ${flag.feature}?`)) return
    try {
      const endpoint = type === 'global' ? `/api/feature-flags/global/${flag.feature}` : `/api/feature-flags/org/${flag.feature}`
      await apiDelete(endpoint)
      if (orgId) loadFlags(orgId)
    } catch (error) {
      logger.error('Failed to delete feature flag', error)
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Feature Flags</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage global and organization-specific feature flags</p>
      </div>

      <div className="mb-4">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('global')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'global'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Global Flags
          </button>
          <button
            onClick={() => setActiveTab('org')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'org'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Organization Flags
          </button>
        </div>
      </div>

      {activeTab === 'global' && (
        <GlobalFlagsTab
          flags={globalFlags}
          onToggle={(flag) => toggleFlag(flag, 'global')}
          onCreate={(feature) => createFlag('global', feature)}
          onDelete={(flag) => deleteFlag(flag, 'global')}
        />
      )}

      {activeTab === 'org' && (
        <OrgFlagsTab
          flags={orgFlags}
          onToggle={(flag) => toggleFlag(flag, 'org')}
          onCreate={(feature) => createFlag('org', feature)}
          onDelete={(flag) => deleteFlag(flag, 'org')}
        />
      )}
    </div>
  )
}

function GlobalFlagsTab({ flags, onToggle, onCreate, onDelete }: {
  flags: FeatureFlag[]
  onToggle: (flag: FeatureFlag) => void
  onCreate: (feature: string) => void
  onDelete: (flag: FeatureFlag) => void
}) {
  const [newFeature, setNewFeature] = useState('')

  return (
    <div>
      <div className="mb-4">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="New feature name"
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
          />
          <button
            onClick={() => {
              if (newFeature.trim()) {
                onCreate(newFeature.trim())
                setNewFeature('')
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {flags.map((flag) => (
          <div key={flag.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg dark:border-gray-700">
            <div>
              <div className="font-medium">{flag.feature}</div>
              <div className="text-sm text-gray-500">Created: {new Date(flag.created_at).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs rounded-full ${flag.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {flag.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={() => onToggle(flag)}
                className="px-3 py-1 text-sm bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                Toggle
              </button>
              <button
                onClick={() => onDelete(flag)}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrgFlagsTab({ flags, onToggle, onCreate, onDelete }: {
  flags: FeatureFlag[]
  onToggle: (flag: FeatureFlag) => void
  onCreate: (feature: string) => void
  onDelete: (flag: FeatureFlag) => void
}) {
  const [newFeature, setNewFeature] = useState('')

  return (
    <div>
      <div className="mb-4">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="New feature name"
            value={newFeature}
            onChange={(e) => setNewFeature(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700"
          />
          <button
            onClick={() => {
              if (newFeature.trim()) {
                onCreate(newFeature.trim())
                setNewFeature('')
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {flags.map((flag) => (
          <div key={flag.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg dark:border-gray-700">
            <div>
              <div className="font-medium">{flag.feature}</div>
              <div className="text-sm text-gray-500">
                Created: {new Date(flag.created_at).toLocaleDateString()}
                {flag.daily_limit && ` | Daily: ${flag.current_daily_usage || 0}/${flag.daily_limit}`}
                {flag.monthly_limit && ` | Monthly: ${flag.current_monthly_usage || 0}/${flag.monthly_limit}`}
              </div>
              {flag.disabled_reason && (
                <div className="text-sm text-red-600">Disabled: {flag.disabled_reason}</div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs rounded-full ${flag.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {flag.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={() => onToggle(flag)}
                className="px-3 py-1 text-sm bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                Toggle
              </button>
              <button
                onClick={() => onDelete(flag)}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}