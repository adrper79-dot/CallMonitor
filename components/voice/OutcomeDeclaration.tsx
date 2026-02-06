"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  OutcomeStatus,
  ConfidenceLevel,
  SummarySource,
  AgreedItem,
  DeclinedItem,
  AmbiguityItem,
  FollowUpAction,
  CallOutcome,
  OUTCOME_STATUS_CONFIG,
  CONFIDENCE_LEVEL_CONFIG,
  getOutcomeStatusConfig,
} from '@/lib/outcome/outcomeTypes'
import { apiPost, apiPut } from '@/lib/api-client'

// ============================================================================
// TYPES
// ============================================================================

interface OutcomeDeclarationProps {
  callId: string
  organizationId: string
  /** Whether the call is completed (required for outcome declaration) */
  callCompleted: boolean
  /** Existing outcome if already declared */
  existingOutcome?: CallOutcome | null
  /** Callback when outcome is saved */
  onOutcomeSaved?: (outcome: CallOutcome) => void
  /** Whether to allow AI summary generation */
  enableAISummary?: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * OutcomeDeclaration - Post-Call Outcome Capture
 * 
 * Per AI Role Policy (ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md):
 * - Humans declare outcomes, not AI
 * - AI may assist with summary generation, but humans MUST verify and confirm
 * - System records what was agreed/not agreed/ambiguous
 * 
 * "The system records what happened. The human declares the meaning."
 */
export function OutcomeDeclaration({
  callId,
  organizationId,
  callCompleted,
  existingOutcome,
  onOutcomeSaved,
  enableAISummary = true,
}: OutcomeDeclarationProps) {
  // Form state
  const [outcomeStatus, setOutcomeStatus] = useState<OutcomeStatus>(
    existingOutcome?.outcomeStatus || 'inconclusive'
  )
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>(
    existingOutcome?.confidenceLevel || 'high'
  )
  const [summaryText, setSummaryText] = useState(existingOutcome?.summaryText || '')
  const [summarySource, setSummarySource] = useState<SummarySource>(
    existingOutcome?.summarySource || 'human'
  )
  const [readbackConfirmed, setReadbackConfirmed] = useState(
    existingOutcome?.readbackConfirmed || false
  )

  // Items state
  const [agreedItems, setAgreedItems] = useState<AgreedItem[]>(
    existingOutcome?.agreedItems || []
  )
  const [declinedItems, setDeclinedItems] = useState<DeclinedItem[]>(
    existingOutcome?.declinedItems || []
  )
  const [ambiguities, setAmbiguities] = useState<AmbiguityItem[]>(
    existingOutcome?.ambiguities || []
  )
  const [followUpActions, setFollowUpActions] = useState<FollowUpAction[]>(
    existingOutcome?.followUpActions || []
  )

  // UI state
  const [isExpanded, setIsExpanded] = useState(!existingOutcome)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiSummaryWarning, setAiSummaryWarning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New item inputs
  const [newAgreedItem, setNewAgreedItem] = useState('')
  const [newDeclinedItem, setNewDeclinedItem] = useState('')
  const [newAmbiguity, setNewAmbiguity] = useState('')
  const [newFollowUp, setNewFollowUp] = useState('')

  /**
   * Generate AI Summary
   * Per AI Role Policy: AI generates, human verifies
   */
  const handleGenerateAISummary = useCallback(async () => {
    setIsGeneratingAI(true)
    setError(null)
    setAiSummaryWarning(false)

    try {
      const data = await apiPost(`/api/calls/${callId}/summary`, {
        use_call_transcript: true,
        include_structured_extraction: true,
      })
      
      const summary = data.data

      // Set the AI-generated summary
      setSummaryText(summary.summary_text)
      setSummarySource('ai_generated')
      setAiSummaryWarning(true)

      // Auto-populate potential items
      if (summary.potential_agreements?.length > 0) {
        setAgreedItems(
          summary.potential_agreements.map((term: string) => ({
            term,
            confirmed: false,
          }))
        )
      }

      if (summary.potential_concerns?.length > 0) {
        setAmbiguities(
          summary.potential_concerns.map((issue: string) => ({
            issue,
          }))
        )
      }

      if (summary.recommended_followup?.length > 0) {
        setFollowUpActions(
          summary.recommended_followup.map((action: string) => ({
            action,
          }))
        )
      }

    } catch (err: any) {
      setError(err.message || 'Failed to generate AI summary')
    } finally {
      setIsGeneratingAI(false)
    }
  }, [callId])

  /**
   * Submit outcome declaration
   */
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // If AI summary was used and not confirmed, mark as confirmed now
      const finalSummarySource: SummarySource = 
        summarySource === 'ai_generated' ? 'ai_confirmed' : summarySource

      const payload = {
        outcome_status: outcomeStatus,
        confidence_level: confidenceLevel,
        agreed_items: agreedItems,
        declined_items: declinedItems,
        ambiguities,
        follow_up_actions: followUpActions,
        summary_text: summaryText,
        summary_source: finalSummarySource,
        readback_confirmed: readbackConfirmed,
      }

      const data = existingOutcome 
        ? await apiPut(`/api/calls/${callId}/outcome`, payload)
        : await apiPost(`/api/calls/${callId}/outcome`, payload)
      
      if (onOutcomeSaved) {
        onOutcomeSaved(data.data.outcome)
      }

      setIsExpanded(false)
      setAiSummaryWarning(false)

    } catch (err: any) {
      setError(err.message || 'Failed to save outcome declaration')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    callId,
    existingOutcome,
    outcomeStatus,
    confidenceLevel,
    agreedItems,
    declinedItems,
    ambiguities,
    followUpActions,
    summaryText,
    summarySource,
    readbackConfirmed,
    onOutcomeSaved,
  ])

  // Add item helpers
  const addAgreedItem = () => {
    if (newAgreedItem.trim()) {
      setAgreedItems([...agreedItems, { term: newAgreedItem.trim(), confirmed: true }])
      setNewAgreedItem('')
    }
  }

  const addDeclinedItem = () => {
    if (newDeclinedItem.trim()) {
      setDeclinedItems([...declinedItems, { term: newDeclinedItem.trim() }])
      setNewDeclinedItem('')
    }
  }

  const addAmbiguity = () => {
    if (newAmbiguity.trim()) {
      setAmbiguities([...ambiguities, { issue: newAmbiguity.trim() }])
      setNewAmbiguity('')
    }
  }

  const addFollowUp = () => {
    if (newFollowUp.trim()) {
      setFollowUpActions([...followUpActions, { action: newFollowUp.trim() }])
      setNewFollowUp('')
    }
  }

  // Don't show if call is not completed
  if (!callCompleted) {
    return null
  }

  // Collapsed view for existing outcome
  if (!isExpanded && existingOutcome) {
    const config = getOutcomeStatusConfig(existingOutcome.outcomeStatus)
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${config.color}`}>
                {config.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Outcome Declared</h3>
                <p className="text-sm text-gray-500">{config.label}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)}>
              Edit
            </Button>
          </div>
          {existingOutcome.summaryText && (
            <p className="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-3">
              {existingOutcome.summaryText.slice(0, 200)}
              {existingOutcome.summaryText.length > 200 ? '...' : ''}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Declare Outcome</h3>
            <p className="text-xs text-gray-500">
              Record what was agreed, declined, or left unclear
            </p>
          </div>
          {existingOutcome && (
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* AI Summary Warning */}
        {aiSummaryWarning && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800 font-medium">
              AI-Generated Summary - Requires Human Review
            </p>
            <p className="text-xs text-amber-700 mt-1">
              This summary was generated by AI. Please review carefully and edit if needed before confirming.
            </p>
          </div>
        )}

        {/* Outcome Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Outcome Status <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(OUTCOME_STATUS_CONFIG) as OutcomeStatus[]).map((status) => {
              const config = OUTCOME_STATUS_CONFIG[status]
              return (
                <button
                  key={status}
                  onClick={() => setOutcomeStatus(status)}
                  className={`
                    p-3 rounded-md border text-left transition-colors
                    ${outcomeStatus === status
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${config.color}`}>
                      {config.icon}
                    </span>
                    <span className="font-medium text-gray-900 text-sm">{config.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Confidence Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confidence Level
          </label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(CONFIDENCE_LEVEL_CONFIG) as ConfidenceLevel[]).map((level) => {
              const config = CONFIDENCE_LEVEL_CONFIG[level]
              return (
                <button
                  key={level}
                  onClick={() => setConfidenceLevel(level)}
                  className={`
                    px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${confidenceLevel === level
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {config.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Agreed Items */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What Was Agreed
          </label>
          <div className="space-y-2">
            {agreedItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-green-50 rounded-md">
                <span className="text-green-600">✓</span>
                <span className="flex-1 text-sm text-gray-900">{item.term}</span>
                <button
                  onClick={() => setAgreedItems(agreedItems.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAgreedItem}
                onChange={(e) => setNewAgreedItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAgreedItem()}
                placeholder="Add agreed item..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <Button variant="outline" size="sm" onClick={addAgreedItem}>
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Declined Items */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What Was Declined / Not Agreed
          </label>
          <div className="space-y-2">
            {declinedItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded-md">
                <span className="text-red-600">✗</span>
                <span className="flex-1 text-sm text-gray-900">{item.term}</span>
                <button
                  onClick={() => setDeclinedItems(declinedItems.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newDeclinedItem}
                onChange={(e) => setNewDeclinedItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDeclinedItem()}
                placeholder="Add declined item..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <Button variant="outline" size="sm" onClick={addDeclinedItem}>
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Ambiguities */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ambiguities / Unclear Items
          </label>
          <div className="space-y-2">
            {ambiguities.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-yellow-50 rounded-md">
                <span className="text-yellow-600">?</span>
                <span className="flex-1 text-sm text-gray-900">{item.issue}</span>
                <button
                  onClick={() => setAmbiguities(ambiguities.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAmbiguity}
                onChange={(e) => setNewAmbiguity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAmbiguity()}
                placeholder="Add ambiguity..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <Button variant="outline" size="sm" onClick={addAmbiguity}>
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Follow-up Actions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Follow-up Actions
          </label>
          <div className="space-y-2">
            {followUpActions.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
                <span className="text-blue-600">→</span>
                <span className="flex-1 text-sm text-gray-900">{item.action}</span>
                <button
                  onClick={() => setFollowUpActions(followUpActions.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newFollowUp}
                onChange={(e) => setNewFollowUp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFollowUp()}
                placeholder="Add follow-up action..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <Button variant="outline" size="sm" onClick={addFollowUp}>
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Summary
            </label>
            {enableAISummary && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAISummary}
                disabled={isGeneratingAI}
              >
                {isGeneratingAI ? (
                  <>
                    <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  '✨ Generate AI Summary'
                )}
              </Button>
            )}
          </div>
          <textarea
            value={summaryText}
            onChange={(e) => {
              setSummaryText(e.target.value)
              // If user edits AI summary, mark as human-edited
              if (summarySource === 'ai_generated') {
                setSummarySource('human')
                setAiSummaryWarning(false)
              }
            }}
            placeholder="Enter a summary of the call outcome..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
            rows={4}
          />
          {summarySource !== 'human' && (
            <p className="text-xs text-gray-500 mt-1">
              Summary source: {summarySource === 'ai_generated' ? 'AI-generated (pending confirmation)' : 'AI-confirmed'}
            </p>
          )}
        </div>

        {/* Read-back Confirmation */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-md">
          <input
            type="checkbox"
            id="readback-confirmed"
            checked={readbackConfirmed}
            onChange={(e) => setReadbackConfirmed(e.target.checked)}
            className="mt-1"
          />
          <label htmlFor="readback-confirmed" className="text-sm text-gray-700">
            <span className="font-medium">Read-back Confirmed</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Check if the summary was read back to the customer and they confirmed it was accurate.
            </p>
          </label>
        </div>

        {/* AI Role Reminder */}
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
          <p className="text-xs text-blue-700">
            <strong>Reminder:</strong> You are declaring the outcome. The system records your declaration.
            AI may assist with summary generation, but you are responsible for verifying accuracy.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2 justify-end">
        {existingOutcome && (
          <Button variant="outline" onClick={() => setIsExpanded(false)} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-primary-600 hover:bg-primary-700 text-white"
        >
          {isSubmitting ? 'Saving...' : existingOutcome ? 'Update Outcome' : 'Declare Outcome'}
        </Button>
      </div>
    </div>
  )
}

export default OutcomeDeclaration
