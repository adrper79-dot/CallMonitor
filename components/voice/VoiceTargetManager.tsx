'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useVoiceConfig } from '@/hooks/useVoiceConfig'
import { logger } from '@/lib/logger'

import { apiGet, apiPost, apiDelete } from '@/lib/apiClient'

interface VoiceTarget {
  id: string
  phone_number: string
  name?: string
  description?: string
  is_active: boolean
  created_at: string
}

interface VoiceTargetManagerProps {
  organizationId: string | null
  onTargetSelect?: (targetId: string | null) => void
}

/**
 * VoiceTargetManager - Professional Design System v3.0
 * Light theme, no emojis, Navy primary color
 */
export default function VoiceTargetManager({
  organizationId,
  onTargetSelect,
}: VoiceTargetManagerProps) {
  const [targets, setTargets] = useState<VoiceTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [newNumber, setNewNumber] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

  // Current selected target
  const { config, updateConfig } = useVoiceConfig(organizationId)
  const selectedTargetId = config?.target_id

  const fetchTargets = useCallback(async () => {
    if (!organizationId) return

    try {
      setLoading(true)
      setError(null)
      const data = await apiGet(`/api/voice/targets?orgId=${encodeURIComponent(organizationId)}`)

      setTargets(data.targets || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load targets')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchTargets()
  }, [fetchTargets])

  const handleAddTarget = async () => {
    if (!newNumber || !organizationId) return

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/
    if (!e164Regex.test(newNumber)) {
      setError('Phone number must be in E.164 format (e.g., +12025551234)')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const data = await apiPost('/api/voice/targets', {
        organization_id: organizationId,
        phone_number: newNumber,
        name: newName || undefined,
        description: newDescription || undefined,
      })

      setShowAddForm(false)
      setNewNumber('')
      setNewName('')
      setNewDescription('')
      fetchTargets()

      // Auto-select the new target if it's the first one
      if (targets.length === 0 && data.target?.id) {
        await updateConfig({ target_id: data.target.id })
        onTargetSelect?.(data.target.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add target')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectTarget = async (targetId: string) => {
    if (!organizationId) return

    try {
      setError(null)
      await updateConfig({ target_id: targetId })
      onTargetSelect?.(targetId)
    } catch (err: any) {
      setError(err.message || 'Failed to select target')
    }
  }

  const handleDeleteTarget = async (targetId: string) => {
    if (!confirm('Delete this target number?')) return

    try {
      await apiDelete(`/api/voice/targets/${targetId}`)

      // Clear selection if deleting selected target
      if (selectedTargetId === targetId) {
        await updateConfig({ target_id: null })
        onTargetSelect?.(null)
      }
      fetchTargets()
    } catch (err) {
      logger.error('VoiceTargetManager: failed to delete target', err, {
        organizationId,
        targetId,
      })
    }
  }

  if (!organizationId) {
    return <div className="text-gray-500 p-4">Organization required</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Call Targets</h3>
          <p className="text-sm text-gray-500">
            Add phone numbers to call for testing and monitoring
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? 'outline' : 'primary'}
        >
          {showAddForm ? 'Cancel' : 'Add Number'}
        </Button>
      </div>

      {/* Current Selection */}
      {selectedTargetId && (
        <div className="p-4 bg-success-light rounded-md border border-green-200">
          <div className="text-sm text-gray-600 mb-1">Currently Selected Target:</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono text-gray-900">
              {targets.find((t) => t.id === selectedTargetId)?.phone_number || selectedTargetId}
            </span>
            <Badge variant="success">Active</Badge>
          </div>
          {targets.find((t) => t.id === selectedTargetId)?.name && (
            <div className="text-sm text-gray-500 mt-1">
              {targets.find((t) => t.id === selectedTargetId)?.name}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-error-light border border-red-200 rounded-md text-error text-sm">
          {error}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-white rounded-md border border-gray-200 space-y-4">
          <h4 className="font-medium text-gray-900">Add New Target Number</h4>

          <Input
            label="Phone Number"
            type="tel"
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            placeholder="+12025551234"
            hint="E.164 format required (e.g., +12025551234)"
          />

          <Input
            label="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Main Support Line"
          />

          <Input
            label="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="24/7 customer support line"
          />

          <Button
            onClick={handleAddTarget}
            disabled={saving || !newNumber}
            variant="primary"
            className="w-full"
          >
            {saving ? 'Adding...' : 'Add Target Number'}
          </Button>
        </div>
      )}

      {/* Targets List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading targets...</div>
      ) : targets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Target Numbers</h4>
          <p className="text-gray-500 mb-4">Add a phone number to start making test calls</p>
          <Button onClick={() => setShowAddForm(true)}>Add Your First Target</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {targets.map((target) => (
            <div
              key={target.id}
              className={`flex items-center justify-between p-3 rounded-md border transition-colors cursor-pointer ${
                selectedTargetId === target.id
                  ? 'bg-success-light border-green-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleSelectTarget(target.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-900">{target.phone_number}</span>
                  {selectedTargetId === target.id && <Badge variant="success">Selected</Badge>}
                  {target.is_active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="warning">Inactive</Badge>
                  )}
                </div>
                {target.name && <div className="text-sm text-gray-500">{target.name}</div>}
                {target.description && (
                  <div className="text-xs text-gray-400">{target.description}</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectTarget(target.id)
                  }}
                  disabled={selectedTargetId === target.id}
                >
                  {selectedTargetId === target.id ? 'Selected' : 'Select'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteTarget(target.id)
                  }}
                  className="text-error hover:text-error"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="p-3 bg-info-light border border-blue-200 rounded-md text-sm">
        <strong className="text-gray-900">How it works:</strong>
        <ul className="text-gray-600 mt-1 list-disc list-inside">
          <li>Add phone numbers you want to call (support lines, test numbers)</li>
          <li>Select a target to make it active for the next call</li>
          <li>All calls will go to the selected target number</li>
          <li>Use with Secret Shopper scripts for quality testing</li>
        </ul>
      </div>
    </div>
  )
}
