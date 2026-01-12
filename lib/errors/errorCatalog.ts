/**
 * Error Catalog
 * 
 * Centralized error definitions with codes, categories, severities, and messages.
 * Per ERROR_HANDLING_PLAN.txt
 */

export type ErrorCategory = 'AUTH' | 'USER' | 'ORG' | 'DB' | 'TEST_CONFIG' | 'TEST_EXEC' | 'DATA' | 'SYSTEM' | 'EXTERNAL' | 'VOICE' | 'AI'
export type ErrorSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ErrorDefinition {
  code: string
  category: ErrorCategory
  severity: ErrorSeverity
  internalMessage: string
  userMessage: string
  httpStatus: number
  shouldAlert: boolean
  trackKPI: boolean
}

/**
 * Error Catalog
 */
export const ERROR_CATALOG: Record<string, ErrorDefinition> = {
  // Authentication errors
  'AUTH_REQUIRED': {
    code: 'AUTH_REQUIRED',
    category: 'AUTH',
    severity: 'HIGH',
    internalMessage: 'Authentication required',
    userMessage: 'Please sign in to continue',
    httpStatus: 401,
    shouldAlert: false,
    trackKPI: true
  },
  'AUTH_ORG_MISMATCH': {
    code: 'AUTH_ORG_MISMATCH',
    category: 'AUTH',
    severity: 'HIGH',
    internalMessage: 'User not authorized for organization',
    userMessage: 'You do not have access to this organization',
    httpStatus: 401,
    shouldAlert: false,
    trackKPI: true
  },
  'FORBIDDEN': {
    code: 'FORBIDDEN',
    category: 'AUTH',
    severity: 'HIGH',
    internalMessage: 'Insufficient permissions',
    userMessage: 'You do not have permission to perform this action',
    httpStatus: 403,
    shouldAlert: false,
    trackKPI: true
  },

  // Database errors
  'DB_QUERY_FAILED': {
    code: 'DB_QUERY_FAILED',
    category: 'DB',
    severity: 'HIGH',
    internalMessage: 'Database query failed',
    userMessage: 'Could not retrieve data. Please try again.',
    httpStatus: 500,
    shouldAlert: true,
    trackKPI: true
  },
  'DB_INSERT_FAILED': {
    code: 'DB_INSERT_FAILED',
    category: 'DB',
    severity: 'HIGH',
    internalMessage: 'Database insert failed',
    userMessage: 'Could not save data. Please try again.',
    httpStatus: 500,
    shouldAlert: true,
    trackKPI: true
  },
  'DB_UPDATE_FAILED': {
    code: 'DB_UPDATE_FAILED',
    category: 'DB',
    severity: 'HIGH',
    internalMessage: 'Database update failed',
    userMessage: 'Could not update data. Please try again.',
    httpStatus: 500,
    shouldAlert: true,
    trackKPI: true
  },

  // Voice/Call errors
  'CALL_START_FAILED': {
    code: 'CALL_START_FAILED',
    category: 'VOICE',
    severity: 'HIGH',
    internalMessage: 'Failed to start call',
    userMessage: 'Unable to place call. Please try again.',
    httpStatus: 500,
    shouldAlert: true,
    trackKPI: true
  },
  'SIGNALWIRE_CONFIG_MISSING': {
    code: 'SIGNALWIRE_CONFIG_MISSING',
    category: 'EXTERNAL',
    severity: 'CRITICAL',
    internalMessage: 'SignalWire credentials missing',
    userMessage: 'System configuration error. Please contact support.',
    httpStatus: 500,
    shouldAlert: true,
    trackKPI: true
  },
  'SIGNALWIRE_API_ERROR': {
    code: 'SIGNALWIRE_API_ERROR',
    category: 'EXTERNAL',
    severity: 'HIGH',
    internalMessage: 'SignalWire API error',
    userMessage: 'Call service temporarily unavailable. Please try again.',
    httpStatus: 502,
    shouldAlert: true,
    trackKPI: true
  },

  // AI/Transcription errors
  'ASSEMBLYAI_API_ERROR': {
    code: 'ASSEMBLYAI_API_ERROR',
    category: 'AI',
    severity: 'HIGH',
    internalMessage: 'AssemblyAI API error',
    userMessage: 'Transcription service temporarily unavailable.',
    httpStatus: 502,
    shouldAlert: true,
    trackKPI: true
  },
  'TRANSCRIPTION_FAILED': {
    code: 'TRANSCRIPTION_FAILED',
    category: 'AI',
    severity: 'MEDIUM',
    internalMessage: 'Transcription processing failed',
    userMessage: 'Transcription could not be completed.',
    httpStatus: 500,
    shouldAlert: false,
    trackKPI: true
  },
  'LIVE_TRANSLATE_EXECUTION_FAILED': {
    code: 'LIVE_TRANSLATE_EXECUTION_FAILED',
    category: 'EXTERNAL',
    severity: 'MEDIUM',
    internalMessage: 'Live translation execution failed',
    userMessage: 'Live translation encountered an issue. Post-call transcript is still available.',
    httpStatus: 500,
    shouldAlert: false,
    trackKPI: true
  },
  'LIVE_TRANSLATE_VENDOR_DOWN': {
    code: 'LIVE_TRANSLATE_VENDOR_DOWN',
    category: 'EXTERNAL',
    severity: 'HIGH',
    internalMessage: 'Live translation vendor service unavailable',
    userMessage: 'Live translation service is temporarily unavailable. Post-call transcript will be available.',
    httpStatus: 503,
    shouldAlert: true,
    trackKPI: true
  },

  // Organization/Plan errors
  'PLAN_LIMIT_EXCEEDED': {
    code: 'PLAN_LIMIT_EXCEEDED',
    category: 'ORG',
    severity: 'MEDIUM',
    internalMessage: 'Plan limit exceeded',
    userMessage: 'This feature is not available on your current plan. Please upgrade.',
    httpStatus: 403,
    shouldAlert: false,
    trackKPI: true
  },
  'ORG_NOT_FOUND': {
    code: 'ORG_NOT_FOUND',
    category: 'ORG',
    severity: 'MEDIUM',
    internalMessage: 'Organization not found',
    userMessage: 'Organization not found',
    httpStatus: 404,
    shouldAlert: false,
    trackKPI: false
  },

  // System errors
  'SYSTEM_ERROR': {
    code: 'SYSTEM_ERROR',
    category: 'SYSTEM',
    severity: 'CRITICAL',
    internalMessage: 'Unexpected system error',
    userMessage: 'An unexpected error occurred. Please try again.',
    httpStatus: 500,
    shouldAlert: true,
    trackKPI: true
  },
  'SERVICE_UNAVAILABLE': {
    code: 'SERVICE_UNAVAILABLE',
    category: 'SYSTEM',
    severity: 'HIGH',
    internalMessage: 'Service temporarily unavailable',
    userMessage: 'Service temporarily unavailable. Please try again later.',
    httpStatus: 503,
    shouldAlert: true,
    trackKPI: true
  },

  // Input validation errors
  'INVALID_INPUT': {
    code: 'INVALID_INPUT',
    category: 'USER',
    severity: 'MEDIUM',
    internalMessage: 'Invalid input provided',
    userMessage: 'Invalid input. Please check your request and try again.',
    httpStatus: 400,
    shouldAlert: false,
    trackKPI: false
  },
  'INVALID_PHONE': {
    code: 'INVALID_PHONE',
    category: 'USER',
    severity: 'MEDIUM',
    internalMessage: 'Invalid phone number format',
    userMessage: 'The phone number provided is invalid. Please verify and try again.',
    httpStatus: 400,
    shouldAlert: false,
    trackKPI: false
  },
}

/**
 * Get error definition by code
 */
export function getErrorDefinition(code: string): ErrorDefinition | null {
  return ERROR_CATALOG[code] || null
}

/**
 * Get default error definition for unknown errors
 */
export function getDefaultError(): ErrorDefinition {
  return ERROR_CATALOG['SYSTEM_ERROR']
}
