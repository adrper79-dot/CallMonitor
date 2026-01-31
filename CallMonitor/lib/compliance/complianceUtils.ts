/**
 * Compliance Utilities for AI Role Policy
 * 
 * Per AI Role Policy (ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md):
 * - Enforces feature combination restrictions
 * - AI Quality Evaluation cannot be combined with confirmations/outcomes
 * - Surveys are feedback-only, not for agreements
 * 
 * "People speak the commitments. The system ensures those commitments are captured correctly."
 */

import { logger } from '@/lib/logger'

// ============================================================================
// TYPES
// ============================================================================

export type ComplianceRestrictionCode =
  | 'QA_NO_CONFIRMATIONS'
  | 'QA_NO_OUTCOMES'
  | 'QA_NO_AGREEMENTS'
  | 'SURVEY_NO_AGREEMENTS'
  | 'AI_NO_NEGOTIATION'

export type ViolationAction = 'block' | 'warn' | 'log'

export interface ComplianceRestriction {
  code: ComplianceRestrictionCode
  name: string
  description: string
  action: ViolationAction
}

export interface ComplianceCheckResult {
  allowed: boolean
  warning?: boolean
  restrictionCode?: ComplianceRestrictionCode
  restrictionName?: string
  description?: string
  violationId?: string
}

export interface CallFeatureContext {
  isQAEvaluation?: boolean     // synthetic_caller enabled
  isSurvey?: boolean           // survey enabled
  hasConfirmations?: boolean   // confirmation capture attempted
  hasOutcome?: boolean         // outcome declaration attempted
  hasAgreements?: boolean      // agreement capture attempted
}

// ============================================================================
// COMPLIANCE RESTRICTIONS
// ============================================================================

export const COMPLIANCE_RESTRICTIONS: Record<ComplianceRestrictionCode, ComplianceRestriction> = {
  QA_NO_CONFIRMATIONS: {
    code: 'QA_NO_CONFIRMATIONS',
    name: 'QA calls cannot capture confirmations',
    description: 'AI Quality Evaluation calls are for internal QA purposes only. Confirmation capture should not be enabled on QA evaluation calls as they do not involve actual customer agreements.',
    action: 'warn',
  },
  QA_NO_OUTCOMES: {
    code: 'QA_NO_OUTCOMES',
    name: 'QA calls cannot have outcome declarations',
    description: 'AI Quality Evaluation calls should not have outcome declarations as they are evaluations, not real business transactions.',
    action: 'warn',
  },
  QA_NO_AGREEMENTS: {
    code: 'QA_NO_AGREEMENTS',
    name: 'QA calls cannot record agreements',
    description: 'AI Quality Evaluation calls cannot be used to capture binding agreements as the AI is acting as a simulated caller.',
    action: 'block',
  },
  SURVEY_NO_AGREEMENTS: {
    code: 'SURVEY_NO_AGREEMENTS',
    name: 'Survey calls are feedback only',
    description: 'Survey calls are for collecting feedback and do not constitute contractual agreements. Confirmation capture should not be enabled.',
    action: 'warn',
  },
  AI_NO_NEGOTIATION: {
    code: 'AI_NO_NEGOTIATION',
    name: 'AI never negotiates',
    description: 'AI must never negotiate on behalf of any party. All negotiations must be conducted by humans.',
    action: 'block',
  },
}

// ============================================================================
// COMPLIANCE CHECKS
// ============================================================================

/**
 * Check if a feature operation is allowed given the call context
 */
export function checkCompliance(
  feature: 'confirmation' | 'outcome' | 'agreement',
  context: CallFeatureContext
): ComplianceCheckResult {
  // QA Evaluation restrictions
  if (context.isQAEvaluation) {
    switch (feature) {
      case 'confirmation':
        return {
          allowed: true, // Allow but warn
          warning: true,
          ...COMPLIANCE_RESTRICTIONS.QA_NO_CONFIRMATIONS,
        }
      case 'outcome':
        return {
          allowed: true, // Allow but warn
          warning: true,
          ...COMPLIANCE_RESTRICTIONS.QA_NO_OUTCOMES,
        }
      case 'agreement':
        return {
          allowed: false, // Block
          ...COMPLIANCE_RESTRICTIONS.QA_NO_AGREEMENTS,
        }
    }
  }

  // Survey restrictions
  if (context.isSurvey) {
    if (feature === 'agreement' || feature === 'confirmation') {
      return {
        allowed: true, // Allow but warn
        warning: true,
        ...COMPLIANCE_RESTRICTIONS.SURVEY_NO_AGREEMENTS,
      }
    }
  }

  // No restrictions
  return { allowed: true }
}

/**
 * Check if a call configuration has potential compliance conflicts
 */
export function checkConfigurationConflicts(config: {
  synthetic_caller?: boolean
  survey?: boolean
  record?: boolean
  transcribe?: boolean
}): ComplianceRestriction[] {
  const conflicts: ComplianceRestriction[] = []

  // QA Evaluation with any agreement-related feature is a potential conflict
  if (config.synthetic_caller) {
    conflicts.push(COMPLIANCE_RESTRICTIONS.QA_NO_CONFIRMATIONS)
    conflicts.push(COMPLIANCE_RESTRICTIONS.QA_NO_OUTCOMES)
  }

  return conflicts
}

/**
 * Get warning message for UI display
 */
export function getComplianceWarning(result: ComplianceCheckResult): string | null {
  if (!result.warning && result.allowed) {
    return null
  }

  if (!result.allowed) {
    return `Blocked: ${result.restrictionName}. ${result.description}`
  }

  return `Warning: ${result.restrictionName}. ${result.description}`
}

// ============================================================================
// UI HELPERS
// ============================================================================

export const COMPLIANCE_WARNING_STYLES = {
  block: 'bg-red-50 border-red-200 text-red-800',
  warn: 'bg-amber-50 border-amber-200 text-amber-800',
  log: 'bg-blue-50 border-blue-200 text-blue-800',
} as const

export const QA_EVALUATION_DISCLOSURE = 
  'This is an automated quality assurance evaluation call. This call is for internal evaluation purposes only and does not constitute any service agreement or commitment.'

export const SURVEY_DISCLAIMER = 
  'This is an automated customer satisfaction survey. Your responses are for feedback purposes only and do not constitute any agreement or commitment.'

export const TRANSLATION_DISCLOSURE = 
  'This call includes AI-powered real-time translation. Translation is provided to assist communication and may not capture every nuance. Please confirm understanding of important terms directly with the other party.'

export const RECORDING_DISCLOSURE = 
  'This call may be recorded for quality assurance and compliance purposes. By continuing, you consent to recording.'

// ============================================================================
// API HELPER
// ============================================================================

/**
 * Log a compliance violation via API
 */
export async function logComplianceViolation(
  callId: string,
  restrictionCode: ComplianceRestrictionCode,
  violationType: 'blocked' | 'warned' | 'detected',
  context?: Record<string, any>
): Promise<void> {
  try {
    await fetch('/api/compliance/violations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        call_id: callId,
        restriction_code: restrictionCode,
        violation_type: violationType,
        context,
      }),
    })
  } catch (error) {
    // Silently fail - compliance logging should not block operations
    logger.warn('Failed to log compliance violation', { error, callId, restrictionCode })
  }
}
