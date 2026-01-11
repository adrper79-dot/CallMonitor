import { v4 as uuidv4 } from 'uuid'
import { ErrorDefinition, getErrorDefinition, getDefaultError } from './errorCatalog'

/**
 * Error Tracker
 * 
 * Tracks errors with unique IDs and structured logging.
 * Per ERROR_HANDLING_PLAN.txt
 */

export interface TrackedError {
  id: string
  code: string
  category: string
  severity: string
  internalMessage: string
  userMessage: string
  endpoint?: string
  method?: string
  userId?: string | null
  organizationId?: string | null
  timestamp: string
  stackTrace?: string
  requestInfo?: Record<string, any>
  details?: Record<string, any>
}

/**
 * Generate unique error tracking ID
 * Format: ERR_YYYYMMDD_ABC123
 */
function generateErrorId(): string {
  const date = new Date()
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ERR_${dateStr}_${random}`
}

/**
 * Track an error
 */
export function trackError(
  error: Error | { code: string; message?: string; details?: any },
  context?: {
    endpoint?: string
    method?: string
    userId?: string | null
    organizationId?: string | null
    requestInfo?: Record<string, any>
  }
): TrackedError {
  const errorCode = 'code' in error ? error.code : 'SYSTEM_ERROR'
  const errorDef = getErrorDefinition(errorCode) || getDefaultError()
  
  const tracked: TrackedError = {
    id: generateErrorId(),
    code: errorCode,
    category: errorDef.category,
    severity: errorDef.severity,
    internalMessage: errorDef.internalMessage,
    userMessage: errorDef.userMessage,
    endpoint: context?.endpoint,
    method: context?.method,
    userId: context?.userId,
    organizationId: context?.organizationId,
    timestamp: new Date().toISOString(),
    stackTrace: error instanceof Error ? error.stack : undefined,
    requestInfo: context?.requestInfo,
    details: 'details' in error ? error.details : undefined
  }

  // Log to console with severity
  const logLevel = tracked.severity === 'CRITICAL' ? 'error' : 
                   tracked.severity === 'HIGH' ? 'error' : 
                   tracked.severity === 'MEDIUM' ? 'warn' : 'info'
  
  // eslint-disable-next-line no-console
  console[logLevel](`[${tracked.id}] ${tracked.code}: ${tracked.internalMessage}`, {
    category: tracked.category,
    severity: tracked.severity,
    endpoint: tracked.endpoint,
    userId: tracked.userId ? '[REDACTED]' : null,
    organizationId: tracked.organizationId ? '[REDACTED]' : null
  })

  // Send to monitoring (Sentry integration)
  if (errorDef.shouldAlert) {
    const { captureError } = await import('@/lib/monitoring')
    captureError(tracked, {
      endpoint: tracked.endpoint,
      method: tracked.method,
      organizationId: tracked.organizationId
    })
  }

  return tracked
}

/**
 * Track error from AppError instance
 */
export function trackAppError(
  appError: { code: string; message: string; user_message?: string; severity?: string; details?: any },
  context?: {
    endpoint?: string
    method?: string
    userId?: string | null
    organizationId?: string | null
    requestInfo?: Record<string, any>
  }
): TrackedError {
  const errorDef = getErrorDefinition(appError.code) || getDefaultError()
  
  return trackError(
    {
      code: appError.code,
      message: appError.message,
      details: appError.details
    },
    context
  )
}
