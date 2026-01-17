import { NextResponse } from 'next/server'
import { AppError } from '@/types/app-error'
import { trackAppError, trackError } from './errorTracker'
import { recordErrorKPI, recordSuccessKPI } from './kpi'

/**
 * API Handler Wrapper
 * 
 * Wraps API route handlers with error handling, tracking, and KPI collection.
 * Per ERROR_HANDLING_PLAN.txt
 */

export interface ApiHandlerContext {
  endpoint?: string
  method?: string
  userId?: string | null
  organizationId?: string | null
  requestInfo?: Record<string, any>
}

/**
 * Wrap API route handler with error handling
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<Response>,
  context?: ApiHandlerContext
) {
  return async (...args: T): Promise<Response> => {
    const startTime = Date.now()
    let response: Response

    try {
      // Extract endpoint and method from request if available
      const req = args[0] as Request
      const endpoint = context?.endpoint || new URL(req.url).pathname
      const method = context?.method || req.method

      // Call handler
      response = await handler(...args)

      // Record success KPI
      recordSuccessKPI(endpoint, method)

      // Add performance header
      const duration = Date.now() - startTime
      response.headers.set('X-Response-Time', `${duration}ms`)

      return response
    } catch (err: any) {
      // Track error
      const tracked = trackError(err, {
        endpoint: context?.endpoint,
        method: context?.method,
        userId: context?.userId,
        organizationId: context?.organizationId,
        requestInfo: context?.requestInfo
      })

      // Record error KPI
      recordErrorKPI(tracked)

      // Create AppError if not already
      const appError = err instanceof AppError ? err : new AppError({
        code: tracked.code,
        message: tracked.internalMessage,
        user_message: tracked.userMessage,
        severity: tracked.severity as any,
        details: tracked.details
      })

      // Return structured error response
      const errorResponse = {
        success: false,
        error: {
          id: tracked.id,
          code: tracked.code,
          message: tracked.userMessage,
          severity: tracked.severity.toLowerCase()
        }
      }

      // Include internal details only in development
      if (process.env.NODE_ENV === 'development') {
        (errorResponse.error as any).internal = {
          message: tracked.internalMessage,
          stack: tracked.stackTrace,
          details: tracked.details
        }
      }

      const httpStatus = appError.httpStatus || 500

      return NextResponse.json(errorResponse, { status: httpStatus })
    }
  }
}

/**
 * Create a standardized error response
 * Use this for inline error responses in API routes
 * Per ERROR_HANDLING_PLAN.txt
 */
export function apiError(
  code: string,
  message: string,
  httpStatus: number = 500,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
) {
  const errorId = `ERR_${new Date().toISOString().slice(0,10).replace(/-/g, '')}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  
  return NextResponse.json({
    success: false,
    error: {
      id: errorId,
      code,
      message,
      severity: severity.toLowerCase()
    }
  }, { status: httpStatus })
}

/**
 * Create a standardized success response
 */
export function apiSuccess<T extends Record<string, any>>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, ...data }, { status })
}

// Common error responses
export const ApiErrors = {
  unauthorized: () => apiError('UNAUTHORIZED', 'Authentication required', 401, 'MEDIUM'),
  forbidden: () => apiError('FORBIDDEN', 'You do not have permission to access this resource', 403, 'MEDIUM'),
  notFound: (resource: string = 'Resource') => apiError('NOT_FOUND', `${resource} not found`, 404, 'LOW'),
  badRequest: (message: string = 'Invalid request') => apiError('BAD_REQUEST', message, 400, 'LOW'),
  internal: (message: string = 'An unexpected error occurred') => apiError('INTERNAL_ERROR', message, 500, 'HIGH'),
  dbError: (message: string = 'Database operation failed') => apiError('DB_ERROR', message, 500, 'HIGH'),
  validationError: (message: string) => apiError('VALIDATION_ERROR', message, 400, 'LOW'),
  serviceUnavailable: (service: string) => apiError('SERVICE_UNAVAILABLE', `${service} is temporarily unavailable`, 503, 'HIGH'),
}
