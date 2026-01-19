"use client"

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import {
  ConfirmationTemplate,
  ConfirmationType,
  ConfirmerRole,
  ChecklistStatus,
  DEFAULT_CONFIRMATION_TEMPLATES,
  getStatusColor,
  getStatusIcon,
  CONFIRMER_ROLE_CONFIG,
} from '@/lib/confirmation/promptDefinitions'

// ============================================================================
// TYPES
// ============================================================================

interface ConfirmationChecklistItem {
  id: string
  template: ConfirmationTemplate
  status: ChecklistStatus
  confirmedAt?: string
  confirmerRole?: ConfirmerRole
  recordingTimestamp?: number
  notes?: string
}

interface ConfirmationPromptsProps {
  callId: string
  organizationId: string
  /** Current duration of the call in seconds */
  callDuration: number
  /** Templates to show (defaults to all required + general) */
  templates?: ConfirmationTemplate[]
  /** Callback when a confirmation is captured */
  onConfirmationCaptured?: (confirmation: {
    templateId: string
    confirmationType: ConfirmationType
    confirmerRole: ConfirmerRole
    recordingTimestamp: number
    notes?: string
  }) => Promise<void>
  /** Callback when a confirmation is skipped */
  onConfirmationSkipped?: (templateId: string, reason: string) => Promise<void>
  /** Whether the call is currently active */
  isCallActive?: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ConfirmationPrompts - Guided Confirmation Capture
 * 
 * Per AI Role Policy (ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md):
 * - Displays prompts to GUIDE the operator
 * - The OPERATOR asks the question (not AI)
 * - The CUSTOMER answers verbally
 * - The OPERATOR clicks to mark confirmed
 * 
 * "The operator asks the question, the customer answers, the operator marks it captured."
 */
export function ConfirmationPrompts({
  callId,
  organizationId,
  callDuration,
  templates = DEFAULT_CONFIRMATION_TEMPLATES.filter(t => t.isRequired || t.useCases.includes('general')),
  onConfirmationCaptured,
  onConfirmationSkipped,
  isCallActive = true,
}: ConfirmationPromptsProps) {
  // Initialize checklist from templates
  const [checklist, setChecklist] = useState<ConfirmationChecklistItem[]>(() =>
    templates.map(template => ({
      id: `${callId}-${template.id}`,
      template,
      status: 'pending' as ChecklistStatus,
    }))
  )

  // Modal state for confirmation capture
  const [activeItem, setActiveItem] = useState<ConfirmationChecklistItem | null>(null)
  const [confirmerRole, setConfirmerRole] = useState<ConfirmerRole>('customer')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Skip modal state
  const [skipItem, setSkipItem] = useState<ConfirmationChecklistItem | null>(null)
  const [skipReason, setSkipReason] = useState('')

  /**
   * Handle marking a confirmation as captured
   */
  const handleConfirm = useCallback(async () => {
    if (!activeItem) return

    setIsSubmitting(true)
    try {
      // Call API to save confirmation
      if (onConfirmationCaptured) {
        await onConfirmationCaptured({
          templateId: activeItem.template.id,
          confirmationType: activeItem.template.type,
          confirmerRole,
          recordingTimestamp: callDuration,
          notes: notes || undefined,
        })
      }

      // Update local state
      setChecklist(prev =>
        prev.map(item =>
          item.id === activeItem.id
            ? {
                ...item,
                status: 'confirmed' as ChecklistStatus,
                confirmedAt: new Date().toISOString(),
                confirmerRole,
                recordingTimestamp: callDuration,
                notes,
              }
            : item
        )
      )

      // Reset modal
      setActiveItem(null)
      setConfirmerRole('customer')
      setNotes('')
    } catch (error) {
      logger.error('Failed to save confirmation', error as Error, { activeItem: activeItem?.id })
    } finally {
      setIsSubmitting(false)
    }
  }, [activeItem, confirmerRole, notes, callDuration, onConfirmationCaptured])

  /**
   * Handle skipping a confirmation
   */
  const handleSkip = useCallback(async () => {
    if (!skipItem || !skipReason) return

    setIsSubmitting(true)
    try {
      // Call API to save skip
      if (onConfirmationSkipped) {
        await onConfirmationSkipped(skipItem.template.id, skipReason)
      }

      // Update local state
      setChecklist(prev =>
        prev.map(item =>
          item.id === skipItem.id
            ? { ...item, status: 'skipped' as ChecklistStatus, notes: skipReason }
            : item
        )
      )

      // Reset modal
      setSkipItem(null)
      setSkipReason('')
    } catch (error) {
      logger.error('Failed to skip confirmation', error as Error, { skipItem: skipItem?.id })
    } finally {
      setIsSubmitting(false)
    }
  }, [skipItem, skipReason, onConfirmationSkipped])

  /**
   * Format duration for display
   */
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Count stats
  const confirmedCount = checklist.filter(i => i.status === 'confirmed').length
  const requiredCount = checklist.filter(i => i.template.isRequired).length
  const requiredConfirmed = checklist.filter(i => i.template.isRequired && i.status === 'confirmed').length

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Confirmation Checklist</h3>
          </div>
          <Badge variant={requiredConfirmed === requiredCount ? 'success' : 'default'}>
            {confirmedCount}/{checklist.length} Complete
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Ask the customer and mark when confirmed
        </p>
      </div>

      {/* Checklist Items */}
      <div className="divide-y divide-gray-100">
        {checklist.map((item) => (
          <div
            key={item.id}
            className={`p-4 ${
              item.status === 'confirmed'
                ? 'bg-green-50'
                : item.status === 'skipped'
                ? 'bg-yellow-50'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium
                ${getStatusColor(item.status)}
              `}>
                {getStatusIcon(item.status)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.template.icon}</span>
                  <span className="font-medium text-gray-900">{item.template.label}</span>
                  {item.template.isRequired && (
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  )}
                </div>
                
                {/* Prompt text - what to ask */}
                <p className="text-sm text-gray-600 mt-1">
                  {item.template.promptText}
                </p>

                {/* Confirmed details */}
                {item.status === 'confirmed' && item.recordingTimestamp !== undefined && (
                  <p className="text-xs text-green-700 mt-1">
                    ✓ Confirmed by {CONFIRMER_ROLE_CONFIG[item.confirmerRole || 'customer'].label} at {formatTimestamp(item.recordingTimestamp)}
                  </p>
                )}

                {/* Skipped reason */}
                {item.status === 'skipped' && item.notes && (
                  <p className="text-xs text-yellow-700 mt-1">
                    Skipped: {item.notes}
                  </p>
                )}
              </div>

              {/* Actions */}
              {item.status === 'pending' && isCallActive && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSkipItem(item)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setActiveItem(item)}
                    className="bg-primary-600 hover:bg-primary-700 text-white"
                  >
                    Mark Confirmed
                  </Button>
                </div>
              )}

              {item.status !== 'pending' && (
                <Badge className={getStatusColor(item.status)}>
                  {item.status === 'confirmed' ? 'Confirmed' : item.status === 'skipped' ? 'Skipped' : item.status}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* AI Role Reminder */}
      <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
        <p className="text-xs text-blue-700">
          <strong>Reminder:</strong> You ask the question. The customer answers. You mark it confirmed.
        </p>
      </div>

      {/* Confirmation Modal */}
      {activeItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Confirm: {activeItem.template.label}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* What to ask */}
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">{activeItem.template.description}</p>
                <p className="text-sm font-medium text-gray-900 mt-2">
                  "{activeItem.template.promptText}"
                </p>
              </div>

              {/* Who confirmed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Who confirmed?
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(CONFIRMER_ROLE_CONFIG) as ConfirmerRole[]).map(role => (
                    <button
                      key={role}
                      onClick={() => setConfirmerRole(role)}
                      className={`
                        px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                        ${confirmerRole === role
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      {CONFIRMER_ROLE_CONFIG[role].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recording timestamp */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Recording timestamp:</span>
                <Badge variant="secondary">{formatTimestamp(callDuration)}</Badge>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional context..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveItem(null)
                  setNotes('')
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? 'Saving...' : 'Confirm Captured'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Modal */}
      {skipItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Skip: {skipItem.template.label}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {skipItem.template.isRequired && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    This is a required confirmation. Please provide a reason for skipping.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for skipping
                </label>
                <textarea
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="Why is this being skipped?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                  rows={3}
                  required
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSkipItem(null)
                  setSkipReason('')
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSkip}
                disabled={isSubmitting || !skipReason.trim()}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {isSubmitting ? 'Saving...' : 'Skip Confirmation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConfirmationPrompts
