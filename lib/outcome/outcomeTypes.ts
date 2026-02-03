/**
 * Outcome Declaration Types
 * 
 * Per AI Role Policy (ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md):
 * - Humans declare outcomes, not AI
 * - AI may assist with summary generation, but humans verify and confirm
 * - System records what was agreed/not agreed/ambiguous
 * 
 * "The system records what happened. The human declares the meaning."
 */

// ============================================================================
// OUTCOME STATUS
// ============================================================================

export type OutcomeStatus =
  | 'agreed'            // All parties agreed on terms
  | 'declined'          // Customer/party declined
  | 'partial'           // Some items agreed, some not
  | 'inconclusive'      // No clear outcome
  | 'pending_review'    // Needs management review
  | 'follow_up_required'// Requires follow-up call

export type ConfidenceLevel =
  | 'high'      // Clear, explicit agreement/decline
  | 'medium'    // Implicit or somewhat ambiguous
  | 'low'       // Needs review, many uncertainties
  | 'disputed'  // Parties disagree on outcome

export type SummarySource =
  | 'human'           // Human-written summary
  | 'ai_generated'    // AI-generated, unconfirmed
  | 'ai_confirmed'    // AI-generated, human-confirmed

export type AISummaryReviewStatus =
  | 'pending'    // Not yet reviewed
  | 'approved'   // Human approved as accurate
  | 'edited'     // Human edited before approval
  | 'rejected'   // Human rejected as inaccurate

// ============================================================================
// OUTCOME ITEMS
// ============================================================================

export interface AgreedItem {
  term: string
  confirmed: boolean
  timestampSeconds?: number
}

export interface DeclinedItem {
  term: string
  reason?: string
  timestampSeconds?: number
}

export interface AmbiguityItem {
  issue: string
  context?: string
  timestampSeconds?: number
}

export interface FollowUpAction {
  action: string
  dueDate?: string
  assignee?: string
}

// ============================================================================
// CALL OUTCOME
// ============================================================================

export interface CallOutcome {
  id: string
  callId: string
  organizationId: string
  
  // Outcome status
  outcomeStatus: OutcomeStatus
  confidenceLevel: ConfidenceLevel
  
  // Items
  agreedItems: AgreedItem[]
  declinedItems: DeclinedItem[]
  ambiguities: AmbiguityItem[]
  followUpActions: FollowUpAction[]
  
  // Summary
  summaryText?: string
  summarySource: SummarySource
  
  // Declaration
  declaredBy: string
  declaredAt: string
  
  // Read-back
  readbackConfirmed: boolean
  readbackTimestampSeconds?: number
  readbackConfirmedBy?: string
  
  // Audit
  createdAt: string
  updatedAt: string
}

// ============================================================================
// AI SUMMARY
// ============================================================================

export interface AISummary {
  id: string
  callId: string
  organizationId: string
  
  // Summary content
  summaryText: string
  topicsDiscussed: string[]
  potentialAgreements: string[]
  potentialConcerns: string[]
  recommendedFollowup: string[]
  
  // Generation metadata
  modelUsed?: string
  inputTokens?: number
  outputTokens?: number
  generationTimeMs?: number
  
  // Review
  reviewStatus: AISummaryReviewStatus
  reviewedBy?: string
  reviewedAt?: string
  editedSummaryText?: string
  
  // Warnings
  warnings: string[]
  
  // Audit
  createdAt: string
  updatedAt: string
}

// ============================================================================
// API REQUEST/RESPONSE
// ============================================================================

export interface CreateOutcomeRequest {
  outcome_status: OutcomeStatus
  confidence_level?: ConfidenceLevel
  agreed_items?: AgreedItem[]
  declined_items?: DeclinedItem[]
  ambiguities?: AmbiguityItem[]
  follow_up_actions?: FollowUpAction[]
  summary_text?: string
  summary_source?: SummarySource
  readback_confirmed?: boolean
  readback_timestamp_seconds?: number
  readback_confirmed_by?: string
}

export interface GenerateSummaryRequest {
  transcript_text?: string
  use_call_transcript?: boolean
  include_structured_extraction?: boolean
}

export interface GenerateSummaryResponse {
  summary_text: string
  topics_discussed: string[]
  potential_agreements: string[]
  potential_concerns: string[]
  recommended_followup: string[]
  warnings: string[]
  model_used: string
  generation_time_ms: number
}

// ============================================================================
// UI CONFIGURATION
// ============================================================================

export const OUTCOME_STATUS_CONFIG: Record<OutcomeStatus, {
  label: string
  description: string
  icon: string
  color: string
}> = {
  agreed: {
    label: 'Agreed',
    description: 'All parties agreed on the terms',
    icon: '✓',
    color: 'bg-green-100 text-green-800',
  },
  declined: {
    label: 'Declined',
    description: 'Customer/party declined the offer',
    icon: '✗',
    color: 'bg-red-100 text-red-800',
  },
  partial: {
    label: 'Partial Agreement',
    description: 'Some items agreed, some not',
    icon: '◐',
    color: 'bg-yellow-100 text-yellow-800',
  },
  inconclusive: {
    label: 'Inconclusive',
    description: 'No clear outcome from the call',
    icon: '?',
    color: 'bg-gray-100 text-gray-800',
  },
  pending_review: {
    label: 'Pending Review',
    description: 'Needs management review',
    icon: '⏳',
    color: 'bg-blue-100 text-blue-800',
  },
  follow_up_required: {
    label: 'Follow-up Required',
    description: 'Requires a follow-up call',
    icon: '↻',
    color: 'bg-purple-100 text-purple-800',
  },
}

export const CONFIDENCE_LEVEL_CONFIG: Record<ConfidenceLevel, {
  label: string
  description: string
  color: string
}> = {
  high: {
    label: 'High Confidence',
    description: 'Clear, explicit agreement or decline',
    color: 'bg-green-100 text-green-800',
  },
  medium: {
    label: 'Medium Confidence',
    description: 'Somewhat implicit or ambiguous',
    color: 'bg-yellow-100 text-yellow-800',
  },
  low: {
    label: 'Low Confidence',
    description: 'Many uncertainties, needs review',
    color: 'bg-orange-100 text-orange-800',
  },
  disputed: {
    label: 'Disputed',
    description: 'Parties disagree on the outcome',
    color: 'bg-red-100 text-red-800',
  },
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get display configuration for an outcome status
 */
export function getOutcomeStatusConfig(status: OutcomeStatus) {
  return OUTCOME_STATUS_CONFIG[status] || OUTCOME_STATUS_CONFIG.inconclusive
}

/**
 * Get display configuration for a confidence level
 */
export function getConfidenceConfig(level: ConfidenceLevel) {
  return CONFIDENCE_LEVEL_CONFIG[level] || CONFIDENCE_LEVEL_CONFIG.medium
}
