'use client'

import React, { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient'

interface RetentionPolicy {
  organization_id: string
  default_retention_class: 'default' | 'regulated' | 'legal_hold'
  default_retention_days: number
  regulated_retention_days: number
  auto_archive_after_days: number | null
  auto_delete_after_days: number | null
  legal_hold_contact_email: string | null
  legal_hold_notes: string | null
}

interface LegalHold {
  id: string
  hold_name: string
  matter_reference: string | null
  description: string | null
  applies_to_all: boolean
  call_ids: string[]
  status: 'active' | 'released' | 'expired'
  effective_from: string
  effective_until: string | null
  affected_call_count: number
  created_at: string
}

interface RetentionSettingsProps {
  organizationId: string
  canEdit: boolean
}

/**
 * Retention & Lifecycle Settings
 *
 * Manages org-level retention policies, legal holds, and export compliance.
 * Per ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md
 */
export function RetentionSettings({ organizationId, canEdit }: RetentionSettingsProps) {
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null)
  const [legalHolds, setLegalHolds] = useState<LegalHold[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New hold form state
  const [showNewHoldForm, setShowNewHoldForm] = useState(false)
  const [newHoldName, setNewHoldName] = useState('')
  const [newHoldMatter, setNewHoldMatter] = useState('')
  const [newHoldAppliesToAll, setNewHoldAppliesToAll] = useState(false)

  // Fetch policy and holds
  useEffect(() => {
    async function fetchData() {
      try {
        const [policyData, holdsData] = await Promise.all([
          apiGet<{ policy: RetentionPolicy }>('/api/retention').catch(() => ({ policy: null })),
          apiGet<{ legal_holds: LegalHold[] }>('/api/retention/legal-holds').catch(() => ({
            legal_holds: [],
          })),
        ])

        if (policyData.policy) {
          setPolicy(policyData.policy)
        }

        setLegalHolds(holdsData.legal_holds || [])
      } catch (err) {
        setError('Failed to load retention settings')
        logger.error('RetentionSettings: failed to load policy or holds', err, {
          organizationId,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [organizationId])

  // Save policy updates
  async function savePolicy(updates: Partial<RetentionPolicy>) {
    setSaving(true)
    setError(null)

    try {
      const data = await apiPut<{ policy: RetentionPolicy }>('/api/retention', updates)
      setPolicy(data.policy)
    } catch (err) {
      setError('Failed to save retention policy')
      logger.error('RetentionSettings: failed to save policy', err, {
        organizationId,
        updates,
      })
    } finally {
      setSaving(false)
    }
  }

  // Create legal hold
  async function createLegalHold() {
    if (!newHoldName.trim()) return

    setSaving(true)
    setError(null)

    try {
      const data = await apiPost<{ legal_hold: LegalHold }>('/api/retention/legal-holds', {
        hold_name: newHoldName,
        matter_reference: newHoldMatter || undefined,
        applies_to_all: newHoldAppliesToAll,
      })

      setLegalHolds((prev) => [data.legal_hold, ...prev])
      setShowNewHoldForm(false)
      setNewHoldName('')
      setNewHoldMatter('')
      setNewHoldAppliesToAll(false)
    } catch (err) {
      setError('Failed to create legal hold')
      logger.error('RetentionSettings: failed to create legal hold', err, {
        organizationId,
        holdName: newHoldName,
        appliesToAll: newHoldAppliesToAll,
      })
    } finally {
      setSaving(false)
    }
  }

  // Release legal hold
  async function releaseLegalHold(holdId: string, reason: string) {
    setSaving(true)
    setError(null)

    try {
      await apiDelete(
        `/api/retention/legal-holds/${holdId}?release_reason=${encodeURIComponent(reason)}`
      )

      setLegalHolds((prev) =>
        prev.map((h) => (h.id === holdId ? { ...h, status: 'released' as const } : h))
      )
    } catch (err) {
      setError('Failed to release legal hold')
      logger.error('RetentionSettings: failed to release legal hold', err, {
        organizationId,
        holdId,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="loading-spinner" />
        <span className="ml-3 text-gray-500">Loading retention settings...</span>
      </div>
    )
  }

  const activeHolds = legalHolds.filter((h) => h.status === 'active')

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Retention Policy Section */}
      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Retention Policy</h2>
          <p className="text-sm text-gray-500">
            Configure how long call evidence is retained and when it's automatically archived.
          </p>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-6 space-y-6">
          {/* Default Retention Class */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Default Retention Class
            </label>
            <select
              value={policy?.default_retention_class || 'default'}
              onChange={(e) => savePolicy({ default_retention_class: e.target.value as any })}
              disabled={!canEdit || saving}
              className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
            >
              <option value="default">Default (Standard)</option>
              <option value="regulated">Regulated (Extended retention)</option>
              <option value="legal_hold">Legal Hold (Indefinite)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Applied to all new calls. Existing calls are not affected.
            </p>
          </div>

          {/* Auto-Archive */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Auto-Archive After (Days)
              </label>
              <input
                type="number"
                min="0"
                value={policy?.auto_archive_after_days ?? 90}
                onChange={(e) =>
                  savePolicy({ auto_archive_after_days: parseInt(e.target.value) || null })
                }
                disabled={!canEdit || saving}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">0 = Never auto-archive</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Regulated Retention (Days)
              </label>
              <input
                type="number"
                min="0"
                value={policy?.regulated_retention_days ?? 2555}
                onChange={(e) =>
                  savePolicy({ regulated_retention_days: parseInt(e.target.value) || 0 })
                }
                disabled={!canEdit || saving}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                ~7 years (2555 days) for regulatory compliance
              </p>
            </div>
          </div>

          {/* Legal Hold Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Legal Hold Contact Email
            </label>
            <input
              type="email"
              value={policy?.legal_hold_contact_email || ''}
              onChange={(e) => savePolicy({ legal_hold_contact_email: e.target.value || null })}
              disabled={!canEdit || saving}
              placeholder="legal@company.com"
              className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Notified when legal holds are created or released
            </p>
          </div>
        </div>
      </section>

      {/* Legal Holds Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Legal Holds</h2>
            <p className="text-sm text-gray-500">
              Preserve evidence for litigation, audits, or regulatory requests.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowNewHoldForm(true)}
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              Create Legal Hold
            </button>
          )}
        </div>

        {/* Active Holds Warning */}
        {activeHolds.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {activeHolds.length} Active Legal Hold{activeHolds.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Evidence under legal hold cannot be deleted or exported without release.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* New Hold Form */}
        {showNewHoldForm && (
          <div className="bg-white rounded-md border border-gray-200 p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">New Legal Hold</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hold Name *</label>
              <input
                type="text"
                value={newHoldName}
                onChange={(e) => setNewHoldName(e.target.value)}
                placeholder="e.g., Smith v. Company - Document Preservation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matter Reference
              </label>
              <input
                type="text"
                value={newHoldMatter}
                onChange={(e) => setNewHoldMatter(e.target.value)}
                placeholder="e.g., Case #2026-CV-1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={newHoldAppliesToAll}
                onCheckedChange={setNewHoldAppliesToAll}
                aria-label="Apply to all calls"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Apply to all calls</p>
                <p className="text-xs text-gray-500">Hold all current and future call evidence</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowNewHoldForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={createLegalHold}
                disabled={!newHoldName.trim() || saving}
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Hold'}
              </button>
            </div>
          </div>
        )}

        {/* Holds List */}
        <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-200">
          {legalHolds.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No legal holds. Evidence can be exported and deleted normally.
            </div>
          ) : (
            legalHolds.map((hold) => (
              <div key={hold.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{hold.hold_name}</p>
                      <Badge variant={hold.status === 'active' ? 'warning' : 'default'}>
                        {hold.status}
                      </Badge>
                    </div>
                    {hold.matter_reference && (
                      <p className="text-xs text-gray-500 mt-0.5">{hold.matter_reference}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {hold.applies_to_all ? 'All calls' : `${hold.affected_call_count} calls`}
                      {' · '}
                      Created {new Date(hold.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {canEdit && hold.status === 'active' && (
                    <button
                      onClick={() => {
                        const reason = prompt('Enter reason for releasing this legal hold:')
                        if (reason) {
                          releaseLegalHold(hold.id, reason)
                        }
                      }}
                      disabled={saving}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Release
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Export Compliance Info */}
      <section className="bg-white rounded-md border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Export Compliance</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-success mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>All export requests are logged in the audit trail</span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-success mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Calls under legal hold cannot be exported until released</span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-success mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Retention policy compliance is verified before each export</span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-success mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Export bundles include cryptographic integrity verification</span>
          </li>
        </ul>
      </section>
    </div>
  )
}

export default RetentionSettings
